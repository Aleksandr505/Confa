package space.confa.api.model.dto.response;

public record MessageReactionDto(
        String emoji,
        long count,
        boolean reactedByMe
) {}
