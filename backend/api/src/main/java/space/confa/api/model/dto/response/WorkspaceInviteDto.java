package space.confa.api.model.dto.response;

import java.time.Instant;

public record WorkspaceInviteDto(
        String token,
        String inviteUrl,
        Long workspaceId,
        String workspaceName,
        Instant expiresAt,
        Integer maxUses,
        Integer usedCount
) {}
