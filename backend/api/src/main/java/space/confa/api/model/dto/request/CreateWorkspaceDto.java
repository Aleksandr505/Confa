package space.confa.api.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateWorkspaceDto(
        @NotBlank
        String name,
        @NotBlank
        @Pattern(
                regexp = "^[a-zA-Z0-9_-]{3,64}$",
                message = "Slug may contain letters, numbers, dash and underscore"
        )
        String slug
) {}
