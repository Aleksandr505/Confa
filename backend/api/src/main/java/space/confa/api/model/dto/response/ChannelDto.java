package space.confa.api.model.dto.response;

import space.confa.api.model.domain.ChannelType;

import java.time.Instant;

public record ChannelDto(
        Long id,
        Long workspaceId,
        ChannelType type,
        String name,
        String topic,
        Boolean isPrivate,
        Integer position,
        Long createdByUserId,
        Instant createdAt,
        Long unreadCount
) {}
