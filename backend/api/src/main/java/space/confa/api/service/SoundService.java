package space.confa.api.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.livekit.server.RoomServiceClient;
import livekit.LivekitModels;
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
import space.confa.api.infrastructure.db.repository.RoomMemberRepository;
import space.confa.api.infrastructure.db.repository.RoomRepository;
import space.confa.api.infrastructure.db.repository.SoundClipRepository;
import space.confa.api.infrastructure.db.repository.UserRepository;
import space.confa.api.model.dto.response.SoundClipDto;
import space.confa.api.model.entity.RoomEntity;
import space.confa.api.model.entity.SoundClipEntity;
import space.confa.api.service.storage.AvatarStorageService;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SoundService {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "audio/mpeg",
            "audio/ogg",
            "audio/wav",
            "audio/webm"
    );
    private static final int MAX_NAME_LENGTH = 96;

    private final SoundClipRepository soundClipRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final DatabaseClient databaseClient;
    private final AvatarStorageService avatarStorageService;
    private final AvatarProp avatarProp;
    private final ObjectMapper objectMapper;
    private final RoomServiceClient roomServiceClient;
    private final RoomAccessService roomAccessService;

    public Mono<SoundClipDto> upload(
            Long userId,
            String roomName,
            String displayName,
            byte[] bytes,
            String contentType,
            String originalFilename
    ) {
        String safeContentType = normalizeContentType(contentType);
        String safeName = normalizeName(displayName, originalFilename);

        return ensureUserExists(userId)
                .then(validateFile(bytes, safeContentType))
                .then(resolveMemberRoom(userId, roomName))
                .flatMap(room -> Mono.fromCallable(() -> {
                            String ext = extensionFrom(safeContentType, originalFilename);
                            String objectKey = "sounds/users/" + userId + "/" + UUID.randomUUID() + "." + ext;
                            avatarStorageService.putObject(objectKey, bytes, safeContentType);
                            return SoundClipEntity.builder()
                                    .ownerUserId(userId)
                                    .sourceRoomId(room.getId())
                                    .name(safeName)
                                    .bucket(avatarProp.storage().bucket())
                                    .objectKey(objectKey)
                                    .contentType(safeContentType)
                                    .sizeBytes((long) bytes.length)
                                    .durationMs(null)
                                    .build();
                        }).subscribeOn(Schedulers.boundedElastic())
                )
                .flatMap(soundClipRepository::save)
                .flatMap(sound -> toDto(sound, false));
    }

    public Flux<SoundClipDto> listForRoom(Long userId, String roomName) {
        return resolveMemberRoom(userId, roomName)
                .flatMapMany(room -> querySoundsForRoom(room.getId())
                        .flatMapSequential(raw -> toDto(
                                raw.sound(),
                                raw.shared()
                        )));
    }

    public Flux<SoundClipDto> listAvailableForRoom(Long userId, String roomName) {
        return resolveMemberRoom(userId, roomName)
                .flatMapMany(room -> queryAvailableSoundsForRoom(userId, room.getId())
                        .flatMapSequential(sound -> toDto(sound, false)));
    }

    public Mono<Void> share(Long userId, Long soundId, String targetRoomName) {
        return soundClipRepository.findById(soundId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound not found")))
                .flatMap(sound -> {
                    if (sound.getDeletedAt() != null) {
                        return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound not found"));
                    }
                    return roomRepository.findById(sound.getSourceRoomId())
                            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Source room not found")))
                            .flatMap(sourceRoom -> ensureUserRoomMember(userId, sourceRoom.getId())
                                    .then(resolveMemberRoom(userId, targetRoomName))
                                    .flatMap(targetRoom -> {
                                        if (targetRoom.getId().equals(sourceRoom.getId())) {
                                            return Mono.error(new ResponseStatusException(
                                                    HttpStatus.BAD_REQUEST,
                                                    "Target room must be different from source room"
                                            ));
                                        }
                                        return databaseClient.sql("""
                                                        INSERT INTO sound_clip_share (sound_clip_id, target_room_id, shared_by_user_id, deleted_at)
                                                        VALUES (:soundId, :targetRoomId, :sharedByUserId, NULL)
                                                        ON DUPLICATE KEY UPDATE
                                                            shared_by_user_id = VALUES(shared_by_user_id),
                                                            deleted_at = NULL
                                                        """)
                                                .bind("soundId", soundId)
                                                .bind("targetRoomId", targetRoom.getId())
                                                .bind("sharedByUserId", userId)
                                                .fetch()
                                                .rowsUpdated()
                                                .then();
                                    }));
                });
    }

    public Mono<Void> unshare(Long userId, Long soundId, String targetRoomName) {
        return soundClipRepository.findById(soundId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound not found")))
                .flatMap(sound -> {
                    if (sound.getDeletedAt() != null) {
                        return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound not found"));
                    }
                    return roomRepository.findById(sound.getSourceRoomId())
                            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Source room not found")))
                            .flatMap(sourceRoom -> ensureUserRoomMember(userId, sourceRoom.getId())
                                    .then(resolveMemberRoom(userId, targetRoomName))
                                    .flatMap(targetRoom -> databaseClient.sql("""
                                                    UPDATE sound_clip_share
                                                    SET deleted_at = NOW()
                                                    WHERE sound_clip_id = :soundId
                                                      AND target_room_id = :targetRoomId
                                                      AND deleted_at IS NULL
                                                    """)
                                            .bind("soundId", soundId)
                                            .bind("targetRoomId", targetRoom.getId())
                                            .fetch()
                                            .rowsUpdated()
                                            .then()));
                });
    }

    public Mono<Void> delete(Long userId, Long soundId) {
        return soundClipRepository.findById(soundId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound not found")))
                .flatMap(sound -> {
                    if (sound.getDeletedAt() != null) {
                        return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound not found"));
                    }
                    sound.setDeletedAt(Instant.now());
                    return soundClipRepository.save(sound)
                            .then(databaseClient.sql("""
                                    UPDATE sound_clip_share
                                    SET deleted_at = NOW()
                                    WHERE sound_clip_id = :soundId
                                      AND deleted_at IS NULL
                                    """)
                                    .bind("soundId", soundId)
                                    .fetch()
                                    .rowsUpdated()
                                    .then());
                });
    }

    public Mono<Void> play(Long userId, Long soundId, String roomName) {
        if (roomName == null || roomName.isBlank()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "roomName is required"));
        }
        return resolveMemberRoom(userId, roomName)
                .flatMap(room -> soundClipRepository.findById(soundId)
                        .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound not found")))
                        .flatMap(sound -> {
                            if (sound.getDeletedAt() != null) {
                                return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound not found"));
                            }
                            return canPlayInRoom(sound.getId(), room.getId())
                                    .flatMap(canPlay -> canPlay
                                            ? sendPlayEvent(sound, userId, roomName)
                                            : Mono.error(new ResponseStatusException(
                                            HttpStatus.FORBIDDEN,
                                            "Sound is not available in this room"
                                    )));
                        }));
    }

    public Mono<SoundContent> getSoundContent(Long soundId) {
        return soundClipRepository.findById(soundId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound not found")))
                .flatMap(sound -> {
                    if (sound.getDeletedAt() != null) {
                        return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound not found"));
                    }
                    return Mono.fromCallable(() -> new SoundContent(
                                    avatarStorageService.getObject(sound.getObjectKey()),
                                    sound.getContentType()))
                            .subscribeOn(Schedulers.boundedElastic())
                            .onErrorMap(error -> {
                                log.warn("Failed to load sound content soundId={}", soundId, error);
                                return new ResponseStatusException(HttpStatus.NOT_FOUND, "Sound content not found");
                            });
                });
    }

    private Mono<RoomEntity> resolveMemberRoom(Long userId, String roomName) {
        if (roomName == null || roomName.isBlank()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "roomName is required"));
        }
        return roomRepository.findByName(roomName)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found")))
                .flatMap(room -> ensureUserRoomMember(userId, room.getId()).thenReturn(room));
    }

    private Mono<Void> ensureUserRoomMember(Long userId, Long roomId) {
        return roomMemberRepository.findByRoomIdAndUserId(roomId, userId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to room")))
                .then();
    }

    private Flux<SoundQueryRow> querySoundsForRoom(Long roomId) {
        return databaseClient.sql("""
                SELECT sc.id,
                       sc.owner_user_id,
                       sc.source_room_id,
                       sc.name,
                       sc.bucket,
                       sc.object_key,
                       sc.content_type,
                       sc.size_bytes,
                       sc.duration_ms,
                       sc.created_at,
                       sc.updated_at,
                       sc.deleted_at,
                       CASE WHEN sc.source_room_id = :roomId THEN 0 ELSE 1 END AS is_shared
                FROM sound_clip sc
                WHERE sc.deleted_at IS NULL
                  AND (
                      sc.source_room_id = :roomId
                      OR EXISTS (
                          SELECT 1
                          FROM sound_clip_share ss
                          WHERE ss.sound_clip_id = sc.id
                            AND ss.target_room_id = :roomId
                            AND ss.deleted_at IS NULL
                      )
                  )
                ORDER BY sc.created_at DESC
                """)
                .bind("roomId", roomId)
                .map((row, meta) -> new SoundQueryRow(
                        SoundClipEntity.builder()
                                .id(row.get("id", Long.class))
                                .ownerUserId(row.get("owner_user_id", Long.class))
                                .sourceRoomId(row.get("source_room_id", Long.class))
                                .name(row.get("name", String.class))
                                .bucket(row.get("bucket", String.class))
                                .objectKey(row.get("object_key", String.class))
                                .contentType(row.get("content_type", String.class))
                                .sizeBytes(row.get("size_bytes", Long.class))
                                .durationMs(row.get("duration_ms", Integer.class))
                                .createdAt(row.get("created_at", Instant.class))
                                .updatedAt(row.get("updated_at", Instant.class))
                                .deletedAt(row.get("deleted_at", Instant.class))
                                .build(),
                        row.get("is_shared", Number.class) != null && row.get("is_shared", Number.class).intValue() > 0
                ))
                .all();
    }

    private Flux<SoundClipEntity> queryAvailableSoundsForRoom(Long userId, Long roomId) {
        return databaseClient.sql("""
                SELECT sc.id,
                       sc.owner_user_id,
                       sc.source_room_id,
                       sc.name,
                       sc.bucket,
                       sc.object_key,
                       sc.content_type,
                       sc.size_bytes,
                       sc.duration_ms,
                       sc.created_at,
                       sc.updated_at,
                       sc.deleted_at
                FROM sound_clip sc
                JOIN room_member rm
                  ON rm.room_id = sc.source_room_id
                 AND rm.user_id = :userId
                WHERE sc.deleted_at IS NULL
                  AND sc.source_room_id <> :roomId
                  AND NOT EXISTS (
                      SELECT 1
                      FROM sound_clip_share ss
                      WHERE ss.sound_clip_id = sc.id
                        AND ss.target_room_id = :roomId
                        AND ss.deleted_at IS NULL
                  )
                ORDER BY sc.created_at DESC
                """)
                .bind("userId", userId)
                .bind("roomId", roomId)
                .map((row, meta) -> SoundClipEntity.builder()
                        .id(row.get("id", Long.class))
                        .ownerUserId(row.get("owner_user_id", Long.class))
                        .sourceRoomId(row.get("source_room_id", Long.class))
                        .name(row.get("name", String.class))
                        .bucket(row.get("bucket", String.class))
                        .objectKey(row.get("object_key", String.class))
                        .contentType(row.get("content_type", String.class))
                        .sizeBytes(row.get("size_bytes", Long.class))
                        .durationMs(row.get("duration_ms", Integer.class))
                        .createdAt(row.get("created_at", Instant.class))
                        .updatedAt(row.get("updated_at", Instant.class))
                        .deletedAt(row.get("deleted_at", Instant.class))
                        .build())
                .all();
    }

    private Mono<Boolean> canPlayInRoom(Long soundId, Long roomId) {
        return databaseClient.sql("""
                SELECT CASE
                           WHEN sc.source_room_id = :roomId THEN 1
                           WHEN EXISTS (
                               SELECT 1
                               FROM sound_clip_share ss
                               WHERE ss.sound_clip_id = sc.id
                                 AND ss.target_room_id = :roomId
                                 AND ss.deleted_at IS NULL
                           ) THEN 1
                           ELSE 0
                       END AS can_play
                FROM sound_clip sc
                WHERE sc.id = :soundId
                  AND sc.deleted_at IS NULL
                """)
                .bind("roomId", roomId)
                .bind("soundId", soundId)
                .map((row, meta) -> row.get("can_play", Number.class))
                .one()
                .map(num -> num != null && num.intValue() > 0)
                .defaultIfEmpty(false);
    }

    private Mono<Void> sendPlayEvent(SoundClipEntity sound, Long userId, String roomName) {
        return roomAccessService.checkUserCanJoin(userId, roomName)
                .then(generateSoundUrl(sound)
                        .flatMap(url -> Mono.fromRunnable(() -> {
                            try {
                                List<LivekitModels.ParticipantInfo> participants = roomServiceClient.listParticipants(roomName)
                                        .execute()
                                        .body();
                                if (participants == null || participants.isEmpty()) {
                                    return;
                                }
                                List<String> sids = participants.stream()
                                        .map(LivekitModels.ParticipantInfo::getSid)
                                        .toList();

                                Map<String, Object> payload = new LinkedHashMap<>();
                                payload.put("v", 1);
                                payload.put("type", "sound.play");
                                payload.put("soundId", sound.getId());
                                payload.put("name", sound.getName());
                                payload.put("url", url);
                                payload.put("from", String.valueOf(userId));
                                payload.put("ts", Instant.now().toEpochMilli());

                                byte[] bytes = objectMapper.writeValueAsBytes(payload);
                                roomServiceClient.sendData(roomName, bytes, LivekitModels.DataPacket.Kind.RELIABLE, sids)
                                        .execute();
                            } catch (IOException e) {
                                throw new UncheckedIOException(e);
                            }
                        }).subscribeOn(Schedulers.boundedElastic()).then()));
    }

    private Mono<SoundClipDto> toDto(SoundClipEntity sound, boolean sharedToCurrentRoom) {
        Mono<String> sourceRoomMono = roomRepository.findById(sound.getSourceRoomId())
                .map(RoomEntity::getName)
                .defaultIfEmpty("");
        Mono<String> soundUrlMono = generateSoundUrl(sound);
        return sourceRoomMono.zipWith(soundUrlMono, (sourceRoomName, soundUrl) -> new SoundClipDto(
                sound.getId(),
                sound.getOwnerUserId(),
                sourceRoomName,
                sharedToCurrentRoom,
                sound.getName(),
                sound.getContentType(),
                sound.getSizeBytes(),
                sound.getDurationMs(),
                soundUrl,
                sound.getCreatedAt()
        ));
    }

    private Mono<String> generateSoundUrl(SoundClipEntity sound) {
        return Mono.fromCallable(() -> avatarStorageService.generatePresignedGetUrl(
                        sound.getObjectKey(),
                        Duration.ofSeconds(Math.max(60, avatarProp.presignTtlSeconds()))
                ))
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(error -> {
                    log.warn("Failed to generate presigned sound URL soundId={}", sound.getId(), error);
                    return Mono.just("/api/sounds/content/" + sound.getId());
                });
    }

    private Mono<Void> ensureUserExists(Long userId) {
        return userRepository.existsById(userId)
                .flatMap(exists -> exists
                        ? Mono.<Void>empty()
                        : Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")));
    }

    private Mono<Void> validateFile(byte[] bytes, String contentType) {
        if (bytes == null || bytes.length == 0) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty"));
        }
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported content type"));
        }
        if (bytes.length > avatarProp.maxUploadBytes()) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sound exceeds size limit"));
        }
        return Mono.empty();
    }

    private String normalizeContentType(String raw) {
        String value = raw == null ? "" : raw.toLowerCase(Locale.ROOT).trim();
        if (value.equals("audio/mp3")) {
            return "audio/mpeg";
        }
        return value;
    }

    private String normalizeName(String rawName, String filename) {
        String base = rawName == null || rawName.isBlank()
                ? filenameWithoutExt(filename)
                : rawName.trim();
        if (base.isBlank()) {
            return "sound";
        }
        return base.length() > MAX_NAME_LENGTH ? base.substring(0, MAX_NAME_LENGTH) : base;
    }

    private String filenameWithoutExt(String filename) {
        if (filename == null || filename.isBlank()) return "sound";
        int slash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
        String leaf = slash >= 0 ? filename.substring(slash + 1) : filename;
        int dot = leaf.lastIndexOf('.');
        return dot > 0 ? leaf.substring(0, dot) : leaf;
    }

    private String extensionFrom(String contentType, String filename) {
        if (contentType.equals("audio/mpeg")) return "mp3";
        if (contentType.equals("audio/ogg")) return "ogg";
        if (contentType.equals("audio/wav")) return "wav";
        if (contentType.equals("audio/webm")) return "webm";
        String name = filename == null ? "" : filename.toLowerCase(Locale.ROOT);
        int dot = name.lastIndexOf('.');
        if (dot > 0 && dot < name.length() - 1) return name.substring(dot + 1);
        return "bin";
    }

    public record SoundContent(
            byte[] bytes,
            String contentType
    ) {}

    private record SoundQueryRow(
            SoundClipEntity sound,
            boolean shared
    ) {}
}
