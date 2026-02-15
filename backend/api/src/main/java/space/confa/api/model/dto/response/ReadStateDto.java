package space.confa.api.model.dto.response;

import java.time.Instant;

public record ReadStateDto(
        Long channelId,
        Long userId,
        Long lastReadMessageId,
        Instant lastReadAt
) {}
