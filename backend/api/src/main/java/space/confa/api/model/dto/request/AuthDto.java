package space.confa.api.model.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AuthDto(
        @NotBlank String username,
        @NotBlank String password
) { }
