package space.confa.api.model.dto.response;

import java.util.List;

public record MessagePageDto(
        List<MessageDto> items,
        Long nextCursor
) {}
