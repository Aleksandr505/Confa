package space.confa.api.model.dto.response;

import space.confa.api.model.domain.AvatarScopeType;

import java.time.Instant;

public record AvatarViewDto(
        Long userId,
        Long assetId,
        AvatarScopeType scopeType,
        String contentUrl,
        Instant updatedAt
) {}
