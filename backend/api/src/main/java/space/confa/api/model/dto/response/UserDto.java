package space.confa.api.model.dto.response;

import space.confa.api.model.domain.UserRole;

import java.time.Instant;

public record UserDto(
        Long id,
        UserRole role,
        String username,
        String password,
        Instant blockedAt,
        Instant createdAt,
        Instant updatedAt
) {}
