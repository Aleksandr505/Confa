package space.confa.api.model.dto.request;

import jakarta.validation.constraints.NotBlank;

public record AcceptInviteDto(
        @NotBlank String token
) {}
