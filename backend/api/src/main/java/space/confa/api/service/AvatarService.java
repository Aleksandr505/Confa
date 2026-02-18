package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import space.confa.api.configuration.properties.AvatarProp;
import space.confa.api.infrastructure.db.repository.AvatarAssetRepository;
import space.confa.api.infrastructure.db.repository.AvatarBindingRepository;
import space.confa.api.infrastructure.db.repository.RoomMemberRepository;
import space.confa.api.infrastructure.db.repository.RoomRepository;
import space.confa.api.infrastructure.db.repository.UserRepository;
import space.confa.api.infrastructure.db.repository.WorkspaceMemberRepository;
import space.confa.api.model.domain.AvatarScopeType;
import space.confa.api.model.dto.response.AvatarViewDto;
import space.confa.api.model.entity.AvatarAssetEntity;
import space.confa.api.model.entity.AvatarBindingEntity;
import space.confa.api.model.entity.RoomEntity;
import space.confa.api.service.storage.AvatarStorageService;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AvatarService {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/png",
            "image/jpeg"
    );

    private final AvatarProp avatarProp;
    private final AvatarStorageService avatarStorageService;
    private final AvatarAssetRepository avatarAssetRepository;
    private final AvatarBindingRepository avatarBindingRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final DatabaseClient databaseClient;

    public Mono<AvatarViewDto> uploadAvatar(
            Long userId,
            AvatarScopeType scopeType,
            Long workspaceId,
            String roomName,
            byte[] originalBytes,
            String contentType,
            String originalFilename
    ) {
        return ensureUserExists(userId)
                .then(validateFile(contentType, originalBytes))
                .then(resolveScopeContext(userId, scopeType, workspaceId, roomName))
                .flatMap(scope -> processImage(originalBytes)
                        .flatMap(processed -> storeObjects(userId, originalBytes, processed, contentType, originalFilename)
                                .flatMap(uploaded -> avatarAssetRepository.save(AvatarAssetEntity.builder()
                                                .bucket(avatarProp.storage().bucket())
                                                .keyOriginal(uploaded.keyOriginal())
                                                .keyPng(uploaded.keyPng())
                                                .originalContentType(contentType)
                                                .originalSizeBytes((long) originalBytes.length)
                                                .width(processed.width())
                                                .height(processed.height())
                                                .checksumSha256(sha256Hex(originalBytes))
                                                .createdByUserId(userId)
                                                .build())
                                        .flatMap(asset -> activateBinding(userId, scope, asset.getId())
                                                .flatMap(binding -> toAvatarViewDto(userId, asset, binding.getScopeType(), binding.getUpdatedAt()))
                                        ))));
    }

    public Mono<AvatarViewDto> resolveAvatar(Long targetUserId, Long workspaceId, String roomName) {
        return ensureUserExists(targetUserId)
                .then(resolveRoomId(roomName))
                .flatMap(roomId -> resolveBinding(targetUserId, workspaceId, roomId))
                .flatMap(binding -> avatarAssetRepository.findById(binding.getAssetId())
                        .flatMap(asset -> toAvatarViewDto(
                                targetUserId,
                                asset,
                                binding.getScopeType(),
                                binding.getUpdatedAt()
                        ))
                        .switchIfEmpty(Mono.just(new AvatarViewDto(targetUserId, null, null, null, null))))
                .defaultIfEmpty(new AvatarViewDto(targetUserId, null, null, null, null));
    }

    public Mono<List<AvatarViewDto>> resolveAvatarsBatch(List<Long> userIds, Long workspaceId, String roomName) {
        if (userIds == null || userIds.isEmpty()) {
            return Mono.just(List.of());
        }
        Set<Long> unique = new LinkedHashSet<>(userIds);
        return Flux.fromIterable(unique)
                .flatMapSequential(userId -> resolveAvatar(userId, workspaceId, roomName))
                .collectList();
    }

    public Mono<AvatarContent> getAvatarContent(Long assetId) {
        return avatarAssetRepository.findById(assetId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Avatar not found")))
                .flatMap(asset -> Mono.fromCallable(() -> new AvatarContent(
                                avatarStorageService.getObject(asset.getKeyPng()),
                                "image/png"))
                        .subscribeOn(Schedulers.boundedElastic())
                        .onErrorMap(error -> {
                            log.warn("Failed to load avatar content assetId={}", assetId, error);
                            return new ResponseStatusException(HttpStatus.NOT_FOUND, "Avatar content not found");
                        }));
    }

    private Mono<Void> ensureUserExists(Long userId) {
        return userRepository.existsById(userId)
                .flatMap(exists -> exists
                        ? Mono.<Void>empty()
                        : Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")));
    }

    private Mono<Void> validateFile(String contentType, byte[] bytes) {
        if (contentType == null || contentType.isBlank() || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported content type"));
        }
        if (bytes == null || bytes.length == 0) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty"));
        }
        if (bytes.length > avatarProp.maxUploadBytes()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Avatar exceeds size limit"));
        }
        return Mono.empty();
    }

    private Mono<ScopeContext> resolveScopeContext(Long userId, AvatarScopeType scopeType, Long workspaceId, String roomName) {
        AvatarScopeType safeScope = scopeType == null ? AvatarScopeType.GLOBAL : scopeType;
        return switch (safeScope) {
            case GLOBAL -> Mono.just(new ScopeContext(AvatarScopeType.GLOBAL, null, null));
            case WORKSPACE -> {
                if (workspaceId == null) {
                    yield Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "workspaceId is required"));
                }
                yield workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, userId)
                        .flatMap(isMember -> isMember
                                ? Mono.just(new ScopeContext(AvatarScopeType.WORKSPACE, workspaceId, null))
                                : Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to workspace")));
            }
            case ROOM -> {
                if (roomName == null || roomName.isBlank()) {
                    yield Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "roomName is required"));
                }
                yield roomRepository.findByName(roomName)
                        .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found")))
                        .flatMap(room -> roomMemberRepository.findByRoomIdAndUserId(room.getId(), userId)
                                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to room")))
                                .thenReturn(new ScopeContext(AvatarScopeType.ROOM, null, room.getId())));
            }
        };
    }

    private Mono<Long> resolveRoomId(String roomName) {
        if (roomName == null || roomName.isBlank()) {
            return Mono.justOrEmpty((Long) null);
        }
        return roomRepository.findByName(roomName)
                .map(RoomEntity::getId)
                .switchIfEmpty(Mono.justOrEmpty((Long) null));
    }

    private Mono<ProcessedImage> processImage(byte[] originalBytes) {
        return Mono.fromCallable(() -> {
                    BufferedImage image = ImageIO.read(new ByteArrayInputStream(originalBytes));
                    if (image == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to decode image");
                    }
                    int width = image.getWidth();
                    int height = image.getHeight();
                    if (width <= 0 || height <= 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid image dimensions");
                    }
                    if (width > 4096 || height > 4096) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image dimensions are too large");
                    }

                    ByteArrayOutputStream pngOut = new ByteArrayOutputStream();
                    boolean encoded = ImageIO.write(image, "png", pngOut);
                    if (!encoded) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to encode PNG");
                    }
                    return new ProcessedImage(width, height, pngOut.toByteArray());
                })
                .subscribeOn(Schedulers.boundedElastic());
    }

    private Mono<StoredKeys> storeObjects(
            Long userId,
            byte[] originalBytes,
            ProcessedImage processed,
            String contentType,
            String filename
    ) {
        return Mono.fromCallable(() -> {
                    String token = UUID.randomUUID().toString();
                    String extension = extensionFrom(contentType, filename);
                    String keyBase = "avatars/users/" + userId + "/" + token;
                    String keyOriginal = keyBase + "-orig." + extension;
                    String keyPng = keyBase + ".png";
                    return new StoredKeys(keyOriginal, keyPng);
                })
                .flatMap(keys -> Mono.fromRunnable(() -> {
                            avatarStorageService.putObject(keys.keyOriginal(), originalBytes, contentType);
                            avatarStorageService.putObject(keys.keyPng(), processed.pngBytes(), "image/png");
                        })
                        .subscribeOn(Schedulers.boundedElastic())
                        .thenReturn(keys));
    }

    private Mono<AvatarBindingEntity> activateBinding(Long userId, ScopeContext scope, Long assetId) {
        return deactivateExistingBinding(userId, scope)
                .then(avatarBindingRepository.save(AvatarBindingEntity.builder()
                        .userId(userId)
                        .scopeType(scope.scopeType())
                        .workspaceId(scope.workspaceId())
                        .roomId(scope.roomId())
                        .assetId(assetId)
                        .isActive(true)
                        .build()));
    }

    private Mono<Void> deactivateExistingBinding(Long userId, ScopeContext scope) {
        if (scope.scopeType() == AvatarScopeType.WORKSPACE) {
            return databaseClient.sql("""
                            UPDATE avatar_binding
                            SET is_active = 0, updated_at = NOW()
                            WHERE user_id = :userId
                              AND scope_type = :scopeType
                              AND workspace_id = :workspaceId
                              AND is_active = 1
                            """)
                    .bind("userId", userId)
                    .bind("scopeType", scope.scopeType().name())
                    .bind("workspaceId", scope.workspaceId())
                    .fetch()
                    .rowsUpdated()
                    .then();
        }
        if (scope.scopeType() == AvatarScopeType.ROOM) {
            return databaseClient.sql("""
                            UPDATE avatar_binding
                            SET is_active = 0, updated_at = NOW()
                            WHERE user_id = :userId
                              AND scope_type = :scopeType
                              AND room_id = :roomId
                              AND is_active = 1
                            """)
                    .bind("userId", userId)
                    .bind("scopeType", scope.scopeType().name())
                    .bind("roomId", scope.roomId())
                    .fetch()
                    .rowsUpdated()
                    .then();
        }
        return databaseClient.sql("""
                        UPDATE avatar_binding
                        SET is_active = 0, updated_at = NOW()
                        WHERE user_id = :userId
                          AND scope_type = :scopeType
                          AND is_active = 1
                        """)
                .bind("userId", userId)
                .bind("scopeType", scope.scopeType().name())
                .fetch()
                .rowsUpdated()
                .then();
    }

    private Mono<AvatarBindingEntity> resolveBinding(Long userId, Long workspaceId, Long roomId) {
        Mono<AvatarBindingEntity> global = avatarBindingRepository
                .findLatestActiveByUserAndScope(userId, AvatarScopeType.GLOBAL);

        Mono<AvatarBindingEntity> workspace = workspaceId == null
                ? Mono.empty()
                : avatarBindingRepository.findLatestActiveByUserAndWorkspaceScope(
                userId, AvatarScopeType.WORKSPACE, workspaceId
        );

        Mono<AvatarBindingEntity> room = roomId == null
                ? Mono.empty()
                : avatarBindingRepository.findLatestActiveByUserAndRoomScope(
                userId, AvatarScopeType.ROOM, roomId
        );

        return room.switchIfEmpty(workspace).switchIfEmpty(global);
    }

    private Mono<AvatarViewDto> toAvatarViewDto(
            Long userId,
            AvatarAssetEntity asset,
            AvatarScopeType scopeType,
            Instant updatedAt
    ) {
        Instant safeUpdatedAt = updatedAt == null ? Instant.now() : updatedAt;
        return Mono.fromCallable(() -> avatarStorageService.generatePresignedGetUrl(
                        asset.getKeyPng(),
                        Duration.ofSeconds(Math.max(60, avatarProp.presignTtlSeconds()))
                ))
                .subscribeOn(Schedulers.boundedElastic())
                .map(url -> new AvatarViewDto(userId, asset.getId(), scopeType, url, safeUpdatedAt))
                .onErrorResume(error -> {
                    log.warn("Failed to generate presigned avatar URL assetId={}", asset.getId(), error);
                    return Mono.just(new AvatarViewDto(userId, asset.getId(), scopeType, null, safeUpdatedAt));
                });
    }

    private String extensionFrom(String contentType, String originalFilename) {
        if (contentType != null) {
            String lower = contentType.toLowerCase(Locale.ROOT);
            if (lower.contains("png")) return "png";
            if (lower.contains("jpeg") || lower.contains("jpg")) return "jpg";
            if (lower.contains("webp")) return "webp";
        }
        if (originalFilename != null) {
            int idx = originalFilename.lastIndexOf('.');
            if (idx > 0 && idx < originalFilename.length() - 1) {
                return originalFilename.substring(idx + 1).toLowerCase(Locale.ROOT);
            }
        }
        return "bin";
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
            // SHA-256 is always available in JVM, fallback is here for safety.
            return new String(bytes, StandardCharsets.ISO_8859_1).hashCode() + "";
        }
    }

    public record AvatarContent(byte[] bytes, String contentType) {}

    private record ProcessedImage(int width, int height, byte[] pngBytes) {}
    private record StoredKeys(String keyOriginal, String keyPng) {}
    private record ScopeContext(AvatarScopeType scopeType, Long workspaceId, Long roomId) {}
}
