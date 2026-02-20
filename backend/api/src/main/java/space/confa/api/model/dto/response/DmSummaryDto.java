package space.confa.api.model.dto.response;

import java.time.Instant;

public record DmSummaryDto(
        Long channelId,
        Long peerUserId,
        String peerUsername,
        String lastMessageBody,
        Instant lastMessageAt
) {}
