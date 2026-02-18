package space.confa.api.model.dto.response;

import space.confa.api.model.domain.UserRole;

import java.time.Instant;

public record MyProfileDto(
        Long id,
        String username,
        UserRole role,
        Instant createdAt
) {}
