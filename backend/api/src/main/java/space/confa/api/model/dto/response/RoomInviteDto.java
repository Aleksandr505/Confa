package space.confa.api.model.dto.response;

import java.time.Instant;

public record RoomInviteDto(
        String token,
        String inviteUrl,
        String roomName,
        Instant expiresAt,
        Integer maxUses,
        Integer usedCount
) {}
