package space.confa.api.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import space.confa.api.model.domain.UserRole;

public record CreateUserDto(
        @NotBlank String username,
        @NotBlank String password,
        @NotNull UserRole role
) { }
