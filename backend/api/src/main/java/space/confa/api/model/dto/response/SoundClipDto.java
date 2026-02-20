package space.confa.api.model.dto.response;

import java.time.Instant;

public record SoundClipDto(
        Long id,
        Long ownerUserId,
        String sourceRoomName,
        boolean sharedToCurrentRoom,
        String name,
        String contentType,
        Long sizeBytes,
        Integer durationMs,
        String contentUrl,
        Instant createdAt
) {}
