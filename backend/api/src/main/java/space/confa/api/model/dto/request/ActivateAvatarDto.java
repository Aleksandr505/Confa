package space.confa.api.model.dto.request;

import jakarta.validation.constraints.NotNull;
import space.confa.api.model.domain.AvatarScopeType;

public record ActivateAvatarDto(
        @NotNull Long assetId,
        AvatarScopeType scopeType,
        Long workspaceId,
        String roomName
) {}
