package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import space.confa.api.configuration.properties.AttachmentProp;
import space.confa.api.configuration.properties.AvatarProp;
import space.confa.api.infrastructure.db.repository.MessageAttachmentRepository;
import space.confa.api.model.domain.MessageAttachmentStatus;
import space.confa.api.model.dto.response.MessageAttachmentDto;
import space.confa.api.model.entity.MessageAttachmentEntity;
import space.confa.api.service.storage.AvatarStorageService;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageAttachmentService {

    private static final String STORED_CONTENT_TYPE = "image/jpeg";

    private final AttachmentProp attachmentProp;
    private final AvatarProp avatarProp;
    private final AvatarStorageService avatarStorageService;
    private final MessageAttachmentRepository messageAttachmentRepository;
    private final MessengerAccessService messengerAccessService;
    private final RoomAccessService roomAccessService;
    private final DatabaseClient databaseClient;

    public Mono<MessageAttachmentDto> uploadImage(
            Long userId,
            Long channelId,
            String roomName,
            byte[] bytes,
            String contentType,
            String originalFilename
    ) {
        Scope scope = resolveRequestedScope(channelId, roomName);
        Mono<Scope> access = scope.channelId() != null
                ? messengerAccessService.getChannelForAccess(userId, scope.channelId()).thenReturn(scope)
                : roomAccessService.getRoomForAccess(userId, scope.roomName())
                        .map(room -> new Scope(null, null, room.getId()));

        return access
                .flatMap(resolvedScope -> validateRawInput(bytes, contentType)
                        .then(processImage(bytes, normalizeContentType(contentType)))
                        .flatMap(processed -> storeProcessed(
                                userId,
                                resolvedScope,
                                processed,
                                bytes,
                                contentType,
                                originalFilename
                        )))
                .flatMap(this::toDto);
    }

    @Transactional
    public Mono<Void> attachPendingToMessage(
            Long userId,
            Long messageId,
            Long channelId,
            Long roomId,
            List<Long> attachmentIds
    ) {
        List<Long> safeIds = sanitizeAttachmentIds(attachmentIds);
        if (safeIds.isEmpty()) {
            return Mono.empty();
        }
        if (safeIds.size() > attachmentProp.image().maxAttachmentsPerMessage()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many attachments"));
        }

        return Flux.fromIterable(safeIds)
                .flatMapSequential(id -> messageAttachmentRepository.findById(id)
                        .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attachment not found"))))
                .collectList()
                .flatMap(attachments -> {
                    for (MessageAttachmentEntity attachment : attachments) {
                        validatePendingAttachment(userId, channelId, roomId, attachment);
                    }
                    return Flux.fromIterable(attachments)
                            .flatMapSequential(attachment -> databaseClient.sql("""
                                            UPDATE message_attachment
                                            SET message_id = :messageId,
                                                status = 'ATTACHED',
                                                attached_at = :attachedAt
                                            WHERE id = :attachmentId
                                              AND status = 'PENDING'
                                            """)
                                    .bind("messageId", messageId)
                                    .bind("attachedAt", Instant.now())
                                    .bind("attachmentId", attachment.getId())
                                    .fetch()
                                    .rowsUpdated())
                            .then();
                });
    }

    public Mono<Void> markMessageAttachmentsDeleted(Long messageId) {
        return databaseClient.sql("""
                        UPDATE message_attachment
                        SET status = 'DELETED',
                            deleted_at = :deletedAt
                        WHERE message_id = :messageId
                          AND status <> 'DELETED'
                        """)
                .bind("messageId", messageId)
                .bind("deletedAt", Instant.now())
                .fetch()
                .rowsUpdated()
                .then();
    }

    public Mono<Map<Long, List<MessageAttachmentDto>>> fetchDtosForMessages(List<Long> messageIds) {
        if (messageIds == null || messageIds.isEmpty()) {
            return Mono.just(Map.of());
        }

        String placeholders = String.join(",", java.util.Collections.nCopies(messageIds.size(), "?"));
        String sql = """
                SELECT *
                FROM message_attachment
                WHERE message_id IN (%s)
                  AND status = 'ATTACHED'
                ORDER BY message_id, id
                """.formatted(placeholders);

        DatabaseClient.GenericExecuteSpec spec = databaseClient.sql(sql);
        for (int i = 0; i < messageIds.size(); i++) {
            spec = spec.bind(i, messageIds.get(i));
        }

        return spec.map((row, metadata) -> mapRowToEntity(row)).all()
                .flatMapSequential(this::toDtoWithMessageId)
                .collectList()
                .map(items -> {
                    Map<Long, List<MessageAttachmentDto>> result = new HashMap<>();
                    for (AttachmentWithMessage item : items) {
                        result.computeIfAbsent(item.messageId(), ignored -> new ArrayList<>()).add(item.dto());
                    }
                    return result;
                });
    }

    private Scope resolveRequestedScope(Long channelId, String roomName) {
        boolean hasChannel = channelId != null;
        boolean hasRoom = roomName != null && !roomName.isBlank();
        if (hasChannel == hasRoom) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Exactly one attachment scope is required");
        }
        return new Scope(channelId, hasRoom ? roomName.trim() : null, null);
    }

    private Mono<Void> validateRawInput(byte[] bytes, String contentType) {
        AttachmentProp.Image limits = attachmentProp.image();
        String normalized = normalizeContentType(contentType);
        if (!isAllowedContentType(normalized)) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported image content type"));
        }
        if (bytes == null || bytes.length == 0) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty"));
        }
        if (bytes.length > limits.maxRawUploadBytes()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image exceeds raw upload limit"));
        }
        String detected = detectContentType(bytes);
        if (detected == null || !detected.equals(normalized)) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image content type does not match file data"));
        }
        return Mono.empty();
    }

    private Mono<ProcessedImage> processImage(byte[] originalBytes, String originalContentType) {
        return Mono.fromCallable(() -> {
                    AttachmentProp.Image limits = attachmentProp.image();
                    BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(originalBytes));
                    if (decoded == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to decode image");
                    }

                    int originalWidth = decoded.getWidth();
                    int originalHeight = decoded.getHeight();
                    long pixels = (long) originalWidth * (long) originalHeight;
                    if (originalWidth <= 0 || originalHeight <= 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid image dimensions");
                    }
                    if (originalWidth > limits.maxRawEdge()
                            || originalHeight > limits.maxRawEdge()
                            || pixels > limits.maxRawPixels()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image dimensions are too large");
                    }

                    EncodedImage display = encodeToLimit(decoded, limits.maxDisplayEdge(), limits.maxDisplayBytes(), 0.84f);
                    EncodedImage thumbnail = encodeToLimit(decoded, limits.maxThumbnailEdge(), limits.maxThumbnailBytes(), 0.76f);
                    return new ProcessedImage(
                            originalContentType,
                            display.bytes(),
                            display.width(),
                            display.height(),
                            thumbnail.bytes(),
                            thumbnail.width(),
                            thumbnail.height()
                    );
                })
                .subscribeOn(Schedulers.boundedElastic());
    }

    private Mono<MessageAttachmentEntity> storeProcessed(
            Long userId,
            Scope scope,
            ProcessedImage processed,
            byte[] originalBytes,
            String originalContentType,
            String originalFilename
    ) {
        return Mono.fromCallable(() -> {
                    String token = UUID.randomUUID().toString();
                    String scopePart = scope.channelId() != null
                            ? "channels/" + scope.channelId()
                            : "rooms/" + scope.roomId();
                    String keyBase = "message-attachments/users/" + userId + "/" + scopePart + "/" + token;
                    String displayKey = keyBase + "-display.jpg";
                    String thumbnailKey = keyBase + "-thumb.jpg";
                    avatarStorageService.putObject(displayKey, processed.displayBytes(), STORED_CONTENT_TYPE);
                    avatarStorageService.putObject(thumbnailKey, processed.thumbnailBytes(), STORED_CONTENT_TYPE);
                    return MessageAttachmentEntity.builder()
                            .channelId(scope.channelId())
                            .roomId(scope.roomId())
                            .ownerUserId(userId)
                            .status(MessageAttachmentStatus.PENDING)
                            .bucket(avatarProp.storage().bucket())
                            .displayObjectKey(displayKey)
                            .thumbnailObjectKey(thumbnailKey)
                            .originalFilename(cleanFilename(originalFilename))
                            .originalContentType(normalizeContentType(originalContentType))
                            .originalSizeBytes((long) originalBytes.length)
                            .storedContentType(STORED_CONTENT_TYPE)
                            .storedSizeBytes((long) processed.displayBytes().length)
                            .width(processed.displayWidth())
                            .height(processed.displayHeight())
                            .thumbnailSizeBytes((long) processed.thumbnailBytes().length)
                            .thumbnailWidth(processed.thumbnailWidth())
                            .thumbnailHeight(processed.thumbnailHeight())
                            .checksumSha256(sha256Hex(originalBytes))
                            .build();
                })
                .subscribeOn(Schedulers.boundedElastic())
                .flatMap(messageAttachmentRepository::save);
    }

    private EncodedImage encodeToLimit(BufferedImage source, int maxEdge, long maxBytes, float startQuality) {
        int targetWidth = scaledWidth(source.getWidth(), source.getHeight(), maxEdge);
        int targetHeight = scaledHeight(source.getWidth(), source.getHeight(), maxEdge);
        EncodedImage best = null;

        while (true) {
            BufferedImage resized = resizeToRgb(source, targetWidth, targetHeight);
            for (float quality = startQuality; quality >= 0.48f; quality -= 0.08f) {
                byte[] encoded = encodeJpeg(resized, quality);
                EncodedImage candidate = new EncodedImage(encoded, targetWidth, targetHeight);
                if (best == null || encoded.length < best.bytes().length) {
                    best = candidate;
                }
                if (encoded.length <= maxBytes) {
                    return candidate;
                }
            }
            if (targetWidth < 320 && targetHeight < 320) {
                break;
            }
            targetWidth = Math.max(1, Math.round(targetWidth * 0.84f));
            targetHeight = Math.max(1, Math.round(targetHeight * 0.84f));
        }

        if (best != null && best.bytes().length <= maxBytes) {
            return best;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image cannot be optimized to configured size");
    }

    private BufferedImage resizeToRgb(BufferedImage source, int width, int height) {
        BufferedImage target = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.setColor(java.awt.Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private byte[] encodeJpeg(BufferedImage image, float quality) {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "JPEG encoder is unavailable");
        }
        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             MemoryCacheImageOutputStream imageOut = new MemoryCacheImageOutputStream(out)) {
            ImageWriteParam params = writer.getDefaultWriteParam();
            params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            params.setCompressionQuality(Math.max(0.1f, Math.min(1f, quality)));
            writer.setOutput(imageOut);
            writer.write(null, new IIOImage(image, null, null), params);
            imageOut.flush();
            return out.toByteArray();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to encode image");
        } finally {
            writer.dispose();
        }
    }

    private int scaledWidth(int width, int height, int maxEdge) {
        if (width <= maxEdge && height <= maxEdge) {
            return width;
        }
        double scale = maxEdge / (double) Math.max(width, height);
        return Math.max(1, (int) Math.round(width * scale));
    }

    private int scaledHeight(int width, int height, int maxEdge) {
        if (width <= maxEdge && height <= maxEdge) {
            return height;
        }
        double scale = maxEdge / (double) Math.max(width, height);
        return Math.max(1, (int) Math.round(height * scale));
    }

    private void validatePendingAttachment(
            Long userId,
            Long channelId,
            Long roomId,
            MessageAttachmentEntity attachment
    ) {
        if (!userId.equals(attachment.getOwnerUserId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attachment does not belong to current user");
        }
        if (attachment.getStatus() != MessageAttachmentStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attachment is not pending");
        }
        if (!java.util.Objects.equals(channelId, attachment.getChannelId())
                || !java.util.Objects.equals(roomId, attachment.getRoomId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Attachment scope does not match message scope");
        }
    }

    private List<Long> sanitizeAttachmentIds(List<Long> attachmentIds) {
        if (attachmentIds == null || attachmentIds.isEmpty()) {
            return List.of();
        }
        return attachmentIds.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();
    }

    private MessageAttachmentEntity mapRowToEntity(io.r2dbc.spi.Row row) {
        return MessageAttachmentEntity.builder()
                .id(row.get("id", Long.class))
                .messageId(row.get("message_id", Long.class))
                .channelId(row.get("channel_id", Long.class))
                .roomId(row.get("room_id", Long.class))
                .ownerUserId(row.get("owner_user_id", Long.class))
                .status(MessageAttachmentStatus.valueOf(row.get("status", String.class)))
                .bucket(row.get("bucket", String.class))
                .displayObjectKey(row.get("display_object_key", String.class))
                .thumbnailObjectKey(row.get("thumbnail_object_key", String.class))
                .originalFilename(row.get("original_filename", String.class))
                .originalContentType(row.get("original_content_type", String.class))
                .originalSizeBytes(row.get("original_size_bytes", Long.class))
                .storedContentType(row.get("stored_content_type", String.class))
                .storedSizeBytes(row.get("stored_size_bytes", Long.class))
                .width(row.get("width", Integer.class))
                .height(row.get("height", Integer.class))
                .thumbnailSizeBytes(row.get("thumbnail_size_bytes", Long.class))
                .thumbnailWidth(row.get("thumbnail_width", Integer.class))
                .thumbnailHeight(row.get("thumbnail_height", Integer.class))
                .checksumSha256(row.get("checksum_sha256", String.class))
                .createdAt(row.get("created_at", Instant.class))
                .attachedAt(row.get("attached_at", Instant.class))
                .deletedAt(row.get("deleted_at", Instant.class))
                .build();
    }

    private Mono<AttachmentWithMessage> toDtoWithMessageId(MessageAttachmentEntity attachment) {
        return toDto(attachment).map(dto -> new AttachmentWithMessage(attachment.getMessageId(), dto));
    }

    private Mono<MessageAttachmentDto> toDto(MessageAttachmentEntity attachment) {
        Duration ttl = Duration.ofSeconds(Math.max(60, attachmentProp.image().presignTtlSeconds()));
        Mono<String> displayUrl = presign(attachment.getDisplayObjectKey(), ttl);
        Mono<String> thumbnailUrl = presign(attachment.getThumbnailObjectKey(), ttl);

        return Mono.zip(thumbnailUrl, displayUrl)
                .map(tuple -> new MessageAttachmentDto(
                        attachment.getId(),
                        tuple.getT1(),
                        tuple.getT2(),
                        attachment.getOriginalFilename(),
                        attachment.getOriginalContentType(),
                        attachment.getOriginalSizeBytes(),
                        attachment.getStoredContentType(),
                        attachment.getStoredSizeBytes(),
                        attachment.getWidth(),
                        attachment.getHeight(),
                        attachment.getThumbnailSizeBytes(),
                        attachment.getThumbnailWidth(),
                        attachment.getThumbnailHeight(),
                        attachment.getCreatedAt()
                ));
    }

    private Mono<String> presign(String objectKey, Duration ttl) {
        return Mono.fromCallable(() -> avatarStorageService.generatePresignedGetUrl(objectKey, ttl))
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(error -> {
                    log.warn("Failed to generate presigned attachment URL for key={}", objectKey, error);
                    return Mono.just("");
                });
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null) {
            return "";
        }
        return contentType.toLowerCase(Locale.ROOT).split(";")[0].trim();
    }

    private boolean isAllowedContentType(String contentType) {
        return "image/jpeg".equals(contentType) || "image/png".equals(contentType);
    }

    private String detectContentType(byte[] bytes) {
        if (bytes.length >= 3
                && (bytes[0] & 0xff) == 0xff
                && (bytes[1] & 0xff) == 0xd8
                && (bytes[2] & 0xff) == 0xff) {
            return "image/jpeg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xff) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4e
                && bytes[3] == 0x47
                && bytes[4] == 0x0d
                && bytes[5] == 0x0a
                && bytes[6] == 0x1a
                && bytes[7] == 0x0a) {
            return "image/png";
        }
        return null;
    }

    private String cleanFilename(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return null;
        }
        String cleaned = originalFilename.replace('\\', '/');
        int slash = cleaned.lastIndexOf('/');
        if (slash >= 0) {
            cleaned = cleaned.substring(slash + 1);
        }
        cleaned = cleaned.trim();
        if (cleaned.isEmpty()) {
            return null;
        }
        return cleaned.length() > 255 ? cleaned.substring(cleaned.length() - 255) : cleaned;
    }

    private String sha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format(Locale.ROOT, "%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return new String(bytes, StandardCharsets.ISO_8859_1).hashCode() + "";
        }
    }

    private record Scope(Long channelId, String roomName, Long roomId) {}

    private record ProcessedImage(
            String originalContentType,
            byte[] displayBytes,
            int displayWidth,
            int displayHeight,
            byte[] thumbnailBytes,
            int thumbnailWidth,
            int thumbnailHeight
    ) {}

    private record EncodedImage(byte[] bytes, int width, int height) {}
    private record AttachmentWithMessage(Long messageId, MessageAttachmentDto dto) {}
}
