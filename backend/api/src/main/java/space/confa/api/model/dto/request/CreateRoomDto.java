package space.confa.api.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record CreateRoomDto(
        @NotBlank
        @Pattern(regexp = "^[a-zA-Z0-9_-]{3,64}$", message = "Room name may contain letters, numbers, dash and underscore")
        String name,
        @NotNull
        Boolean isPrivate
) {}
