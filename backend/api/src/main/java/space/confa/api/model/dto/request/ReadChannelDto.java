package space.confa.api.model.dto.request;

import jakarta.validation.constraints.NotNull;

public record ReadChannelDto(
        @NotNull
        Long lastReadMessageId
) {}
