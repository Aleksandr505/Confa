package space.confa.api.model.dto.request;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ResolveAvatarsBatchDto(
        @NotEmpty
        List<Long> userIds,
        Long workspaceId,
        String roomName
) {}
