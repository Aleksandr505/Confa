package space.confa.api.model.dto.response;

import jakarta.validation.constraints.NotBlank;

public record TokenPairDto(
        @NotBlank String accessToken,
        @NotBlank String refreshToken
) { }
