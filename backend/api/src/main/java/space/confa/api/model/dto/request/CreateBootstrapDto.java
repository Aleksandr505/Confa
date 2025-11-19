package space.confa.api.model.dto.request;

import jakarta.validation.constraints.NotBlank;

public record CreateBootstrapDto(
        @NotBlank String serviceKey,
        @NotBlank String username
) {}
