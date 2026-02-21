package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.ChannelRepository;
import space.confa.api.model.domain.ChannelType;
import space.confa.api.model.dto.request.CreateChannelDto;
import space.confa.api.model.dto.response.ChannelDto;
import space.confa.api.model.entity.ChannelEntity;
import space.confa.api.shared.mapper.MessengerMapper;

@Service
@RequiredArgsConstructor
public class ChannelService {

    private final ChannelRepository channelRepository;
    private final MessengerAccessService messengerAccessService;
    private final DatabaseClient databaseClient;

    public Flux<ChannelDto> getChannelsForWorkspace(Long userId, Long workspaceId) {
        return messengerAccessService.ensureWorkspaceMember(userId, workspaceId)
                .thenMany(databaseClient.sql("""
                        SELECT c.id,
                               c.workspace_id,
                               c.type,
                               c.name,
                               c.topic,
                               c.is_private,
                               c.position,
                               c.created_by_user_id,
                               c.created_at,
                               COALESCE((
                                   SELECT COUNT(*)
                                   FROM message m
                                   WHERE m.channel_id = c.id
                                     AND m.deleted_at IS NULL
                                     AND m.sender_user_id IS NOT NULL
                                     AND m.sender_user_id <> :userId
                                     AND (
                                         crs.last_read_message_id IS NULL
                                         OR m.id > crs.last_read_message_id
                                     )
                               ), 0) AS unread_count
                        FROM channel c
                        LEFT JOIN channel_read_state crs
                               ON crs.channel_id = c.id
                              AND crs.user_id = :userId
                        WHERE c.workspace_id = :workspaceId
                        ORDER BY c.position ASC, c.id ASC
                        """)
                        .bind("userId", userId)
                        .bind("workspaceId", workspaceId)
                        .map((row, metadata) -> new ChannelDto(
                                row.get("id", Long.class),
                                row.get("workspace_id", Long.class),
                                ChannelType.valueOf(row.get("type", String.class)),
                                row.get("name", String.class),
                                row.get("topic", String.class),
                                row.get("is_private", Boolean.class),
                                row.get("position", Integer.class),
                                row.get("created_by_user_id", Long.class),
                                row.get("created_at", java.time.Instant.class),
                                row.get("unread_count", Long.class)
                        ))
                        .all());
    }

    @Transactional
    public Mono<ChannelDto> createChannel(Long userId, Long workspaceId, CreateChannelDto dto) {
        if (dto.type() == ChannelType.DM) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "DM channel cannot be created here"));
        }

        String name = dto.name().trim();
        int position = dto.position() != null ? dto.position() : 0;
        boolean isPrivate = dto.isPrivate() != null && dto.isPrivate();

        return messengerAccessService.ensureWorkspaceMember(userId, workspaceId)
                .then(channelRepository.save(ChannelEntity.builder()
                        .workspaceId(workspaceId)
                        .type(dto.type())
                        .name(name)
                        .topic(dto.topic())
                        .isPrivate(isPrivate)
                        .position(position)
                        .createdByUserId(userId)
                        .build()))
                .map(MessengerMapper::toChannelDto);
    }

    public Mono<ChannelDto> getChannel(Long userId, Long channelId) {
        return messengerAccessService.getChannelForAccess(userId, channelId)
                .map(MessengerMapper::toChannelDto);
    }
}
