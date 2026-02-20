package space.confa.api.model.dto.response;

import java.time.Instant;

public record WorkspaceDto(
        Long id,
        String name,
        String slug,
        Long ownerUserId,
        Instant createdAt
) {}
