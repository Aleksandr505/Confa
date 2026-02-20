package space.confa.api.shared.mapper;

import space.confa.api.model.dto.response.ChannelDto;
import space.confa.api.model.dto.response.MessageDto;
import space.confa.api.model.dto.response.WorkspaceDto;
import space.confa.api.model.entity.ChannelEntity;
import space.confa.api.model.entity.MessageEntity;
import space.confa.api.model.entity.WorkspaceEntity;

import java.util.List;

public final class MessengerMapper {

    private MessengerMapper() {}

    public static WorkspaceDto toWorkspaceDto(WorkspaceEntity entity) {
        return new WorkspaceDto(
                entity.getId(),
                entity.getName(),
                entity.getSlug(),
                entity.getOwnerUserId(),
                entity.getCreatedAt()
        );
    }

    public static ChannelDto toChannelDto(ChannelEntity entity) {
        return new ChannelDto(
                entity.getId(),
                entity.getWorkspaceId(),
                entity.getType(),
                entity.getName(),
                entity.getTopic(),
                entity.getIsPrivate(),
                entity.getPosition(),
                entity.getCreatedByUserId(),
                entity.getCreatedAt()
        );
    }

    public static MessageDto toMessageDto(MessageEntity entity) {
        return new MessageDto(
                entity.getId(),
                entity.getChannelId(),
                entity.getSenderUserId(),
                null,
                entity.getKind(),
                entity.getBody(),
                entity.getReplyToMessageId(),
                null,
                null,
                List.of(),
                entity.getCreatedAt(),
                entity.getEditedAt(),
                entity.getDeletedAt()
        );
    }
}
