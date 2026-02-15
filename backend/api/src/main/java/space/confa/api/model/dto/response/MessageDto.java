package space.confa.api.model.dto.response;

import space.confa.api.model.domain.MessageKind;

import java.time.Instant;

public record MessageDto(
        Long id,
        Long channelId,
        Long senderUserId,
        MessageKind kind,
        String body,
        Instant createdAt,
        Instant editedAt,
        Instant deletedAt
) {}
