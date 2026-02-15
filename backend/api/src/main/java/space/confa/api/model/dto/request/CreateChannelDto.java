package space.confa.api.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import space.confa.api.model.domain.ChannelType;

public record CreateChannelDto(
        @NotNull
        ChannelType type,
        @NotBlank
        String name,
        String topic,
        Boolean isPrivate,
        Integer position
) {}
