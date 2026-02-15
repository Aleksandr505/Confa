package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.MessageRepository;
import space.confa.api.model.domain.MessageKind;
import space.confa.api.model.dto.request.CreateMessageDto;
import space.confa.api.model.dto.request.UpdateMessageDto;
import space.confa.api.model.dto.response.MessageDto;
import space.confa.api.model.dto.response.MessagePageDto;
import space.confa.api.model.entity.MessageEntity;
import space.confa.api.shared.mapper.MessengerMapper;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MessageService {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 100;

    private final MessageRepository messageRepository;
    private final MessengerAccessService messengerAccessService;
    private final DatabaseClient databaseClient;

    public Mono<MessagePageDto> getMessages(Long userId, Long channelId, Long cursor, Integer limit) {
        int safeLimit = limit == null ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);

        return messengerAccessService.getChannelForAccess(userId, channelId)
                .thenMany(fetchMessages(channelId, cursor, safeLimit))
                .collectList()
                .map(items -> new MessagePageDto(items, nextCursor(items)));
    }

    @Transactional
    public Mono<MessageDto> createMessage(Long userId, Long channelId, CreateMessageDto dto) {
        return messengerAccessService.getChannelForAccess(userId, channelId)
                .then(messageRepository.save(MessageEntity.builder()
                        .channelId(channelId)
                        .senderUserId(userId)
                        .kind(MessageKind.USER)
                        .body(dto.body().trim())
                        .build()))
                .map(MessengerMapper::toMessageDto);
    }

    @Transactional
    public Mono<MessageDto> updateMessage(Long userId, Long messageId, UpdateMessageDto dto) {
        return messageRepository.findById(messageId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found")))
                .flatMap(message -> {
                    if (!userId.equals(message.getSenderUserId())) {
                        return Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to message"));
                    }
                    return messageRepository.save(message.toBuilder()
                            .body(dto.body().trim())
                            .editedAt(Instant.now())
                            .build());
                })
                .map(MessengerMapper::toMessageDto);
    }

    @Transactional
    public Mono<Void> deleteMessage(Long userId, Long messageId) {
        return messageRepository.findById(messageId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found")))
                .flatMap(message -> {
                    if (!userId.equals(message.getSenderUserId())) {
                        return Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to message"));
                    }
                    return messageRepository.save(message.toBuilder()
                            .deletedAt(Instant.now())
                            .deletedByUserId(userId)
                            .build()).then();
                });
    }

    private Flux<MessageDto> fetchMessages(Long channelId, Long cursor, int limit) {
        String sql;
        DatabaseClient.GenericExecuteSpec spec;

        if (cursor == null) {
            sql = """
                    SELECT id, channel_id, sender_user_id, kind, body, created_at, edited_at, deleted_at
                    FROM message
                    WHERE channel_id = :channelId
                    ORDER BY id DESC
                    LIMIT :limit
                    """;
            spec = databaseClient.sql(sql)
                    .bind("channelId", channelId)
                    .bind("limit", limit);
        } else {
            sql = """
                    SELECT id, channel_id, sender_user_id, kind, body, created_at, edited_at, deleted_at
                    FROM message
                    WHERE channel_id = :channelId AND id < :cursor
                    ORDER BY id DESC
                    LIMIT :limit
                    """;
            spec = databaseClient.sql(sql)
                    .bind("channelId", channelId)
                    .bind("cursor", cursor)
                    .bind("limit", limit);
        }

        return spec.map((row, metadata) -> new MessageDto(
                row.get("id", Long.class),
                row.get("channel_id", Long.class),
                row.get("sender_user_id", Long.class),
                MessageKind.valueOf(row.get("kind", String.class)),
                row.get("body", String.class),
                row.get("created_at", Instant.class),
                row.get("edited_at", Instant.class),
                row.get("deleted_at", Instant.class)
        )).all();
    }

    private Long nextCursor(List<MessageDto> items) {
        if (items.isEmpty()) {
            return null;
        }
        return items.get(items.size() - 1).id();
    }
}
