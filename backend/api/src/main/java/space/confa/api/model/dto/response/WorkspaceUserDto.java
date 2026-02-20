package space.confa.api.model.dto.response;

import space.confa.api.model.domain.UserRole;

import java.time.Instant;

public record WorkspaceUserDto(
        Long id,
        String username,
        UserRole role,
        Instant joinedAt
) {}
