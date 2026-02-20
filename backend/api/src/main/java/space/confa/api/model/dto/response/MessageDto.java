package space.confa.api.model.dto.response;

import space.confa.api.model.domain.MessageKind;

import java.time.Instant;
import java.util.List;

public record MessageDto(
        Long id,
        Long channelId,
        Long senderUserId,
        String senderUsername,
        MessageKind kind,
        String body,
        Long replyToMessageId,
        String replyToBody,
        String replyToSenderUsername,
        List<MessageReactionDto> reactions,
        Instant createdAt,
        Instant editedAt,
        Instant deletedAt
) {}
