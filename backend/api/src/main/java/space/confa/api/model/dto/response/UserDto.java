package space.confa.api.model.dto.response;

import space.confa.api.model.domain.UserRole;
import space.confa.api.model.domain.UserStatus;

import java.time.Instant;

public record UserDto(
        Long id,
        UserRole role,
        UserStatus status,
        String username,
        Instant blockedAt,
        Instant approvedAt,
        Long approvedByUserId,
        Instant rejectedAt,
        Long rejectedByUserId,
        Instant createdAt,
        Instant updatedAt
) {}
