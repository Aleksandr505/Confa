package space.confa.api.model.dto.request;

import java.util.List;

public record CreateMessageDto(
        String body,
        Long replyToMessageId,
        List<Long> attachmentIds
) {}
