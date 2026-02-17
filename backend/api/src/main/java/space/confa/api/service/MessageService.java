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
import space.confa.api.model.dto.response.MessageReactionDto;
import space.confa.api.model.entity.MessageEntity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class MessageService {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 100;
    private static final int MAX_EMOJI_LENGTH = 32;

    private final MessageRepository messageRepository;
    private final MessengerAccessService messengerAccessService;
    private final DatabaseClient databaseClient;

    public Mono<MessagePageDto> getMessages(Long userId, Long channelId, Long cursor, Integer limit) {
        int safeLimit = limit == null ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);

        return messengerAccessService.getChannelForAccess(userId, channelId)
                .thenMany(fetchMessages(channelId, cursor, safeLimit))
                .collectList()
                .flatMap(items -> enrichWithReactions(userId, items)
                        .map(enriched -> new MessagePageDto(enriched, nextCursor(enriched))));
    }

    @Transactional
    public Mono<MessageDto> createMessage(Long userId, Long channelId, CreateMessageDto dto) {
        return messengerAccessService.getChannelForAccess(userId, channelId)
                .then(validateReplyTarget(channelId, dto.replyToMessageId()))
                .then(messageRepository.save(MessageEntity.builder()
                        .channelId(channelId)
                        .senderUserId(userId)
                        .kind(MessageKind.USER)
                        .body(dto.body().trim())
                        .replyToMessageId(dto.replyToMessageId())
                        .build()))
                .flatMap(saved -> fetchMessageById(userId, saved.getId()));
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
                .flatMap(saved -> fetchMessageById(userId, saved.getId()));
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

    public Mono<List<MessageReactionDto>> getMessageReactions(Long userId, Long messageId) {
        return messageRepository.findById(messageId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found")))
                .flatMap(message -> messengerAccessService.getChannelForAccess(userId, message.getChannelId())
                        .then(fetchReactionsForMessages(userId, List.of(messageId))))
                .map(map -> map.getOrDefault(messageId, List.of()));
    }

    @Transactional
    public Mono<List<MessageReactionDto>> addReaction(Long userId, Long messageId, String rawEmoji) {
        String emoji = normalizeEmoji(rawEmoji);
        return messageRepository.findById(messageId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found")))
                .flatMap(message -> messengerAccessService.getChannelForAccess(userId, message.getChannelId())
                        .then(databaseClient.sql("""
                                INSERT IGNORE INTO message_reaction (message_id, user_id, emoji)
                                VALUES (:messageId, :userId, :emoji)
                                """)
                                .bind("messageId", messageId)
                                .bind("userId", userId)
                                .bind("emoji", emoji)
                                .fetch()
                                .rowsUpdated()
                                .then()))
                .then(getMessageReactions(userId, messageId));
    }

    @Transactional
    public Mono<List<MessageReactionDto>> removeReaction(Long userId, Long messageId, String rawEmoji) {
        String emoji = normalizeEmoji(rawEmoji);
        return messageRepository.findById(messageId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found")))
                .flatMap(message -> messengerAccessService.getChannelForAccess(userId, message.getChannelId())
                        .then(databaseClient.sql("""
                                DELETE FROM message_reaction
                                WHERE message_id = :messageId AND user_id = :userId AND emoji = :emoji
                                """)
                                .bind("messageId", messageId)
                                .bind("userId", userId)
                                .bind("emoji", emoji)
                                .fetch()
                                .rowsUpdated()
                                .then()))
                .then(getMessageReactions(userId, messageId));
    }

    private Flux<MessageDto> fetchMessages(Long channelId, Long cursor, int limit) {
        String sql;
        DatabaseClient.GenericExecuteSpec spec;

        if (cursor == null) {
            sql = """
                    SELECT m.id,
                           m.channel_id,
                           m.sender_user_id,
                           u.username as sender_username,
                           m.kind,
                           m.body,
                           m.reply_to_message_id,
                           rm.body as reply_to_body,
                           ru.username as reply_to_sender_username,
                           m.created_at,
                           m.edited_at,
                           m.deleted_at
                    FROM message m
                    LEFT JOIN user u ON u.id = m.sender_user_id
                    LEFT JOIN message rm ON rm.id = m.reply_to_message_id
                    LEFT JOIN user ru ON ru.id = rm.sender_user_id
                    WHERE m.channel_id = :channelId
                    ORDER BY m.id DESC
                    LIMIT :limit
                    """;
            spec = databaseClient.sql(sql)
                    .bind("channelId", channelId)
                    .bind("limit", limit);
        } else {
            sql = """
                    SELECT m.id,
                           m.channel_id,
                           m.sender_user_id,
                           u.username as sender_username,
                           m.kind,
                           m.body,
                           m.reply_to_message_id,
                           rm.body as reply_to_body,
                           ru.username as reply_to_sender_username,
                           m.created_at,
                           m.edited_at,
                           m.deleted_at
                    FROM message m
                    LEFT JOIN user u ON u.id = m.sender_user_id
                    LEFT JOIN message rm ON rm.id = m.reply_to_message_id
                    LEFT JOIN user ru ON ru.id = rm.sender_user_id
                    WHERE m.channel_id = :channelId AND m.id < :cursor
                    ORDER BY m.id DESC
                    LIMIT :limit
                    """;
            spec = databaseClient.sql(sql)
                    .bind("channelId", channelId)
                    .bind("cursor", cursor)
                    .bind("limit", limit);
        }

        return spec.map((row, metadata) -> mapRowToMessageDto(row)).all();
    }

    private Long nextCursor(List<MessageDto> items) {
        if (items.isEmpty()) {
            return null;
        }
        return items.get(items.size() - 1).id();
    }

    private Mono<Void> validateReplyTarget(Long channelId, Long replyToMessageId) {
        if (replyToMessageId == null) {
            return Mono.empty();
        }
        return messageRepository.findById(replyToMessageId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reply target not found")))
                .flatMap(message -> {
                    if (!Objects.equals(message.getChannelId(), channelId)) {
                        return Mono.error(new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                "Reply target must be in the same channel"
                        ));
                    }
                    return Mono.empty();
                })
                .then();
    }

    private Mono<MessageDto> fetchMessageById(Long userId, Long messageId) {
        return databaseClient.sql("""
                SELECT m.id,
                       m.channel_id,
                       m.sender_user_id,
                       u.username as sender_username,
                       m.kind,
                       m.body,
                       m.reply_to_message_id,
                       rm.body as reply_to_body,
                       ru.username as reply_to_sender_username,
                       m.created_at,
                       m.edited_at,
                       m.deleted_at
                FROM message m
                LEFT JOIN user u ON u.id = m.sender_user_id
                LEFT JOIN message rm ON rm.id = m.reply_to_message_id
                LEFT JOIN user ru ON ru.id = rm.sender_user_id
                WHERE m.id = :messageId
                """)
                .bind("messageId", messageId)
                .map((row, metadata) -> mapRowToMessageDto(row))
                .one()
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found")))
                .flatMap(dto -> enrichWithReactions(userId, List.of(dto))
                        .map(items -> items.get(0)));
    }

    private MessageDto mapRowToMessageDto(io.r2dbc.spi.Row row) {
        return new MessageDto(
                row.get("id", Long.class),
                row.get("channel_id", Long.class),
                row.get("sender_user_id", Long.class),
                row.get("sender_username", String.class),
                MessageKind.valueOf(row.get("kind", String.class)),
                row.get("body", String.class),
                row.get("reply_to_message_id", Long.class),
                row.get("reply_to_body", String.class),
                row.get("reply_to_sender_username", String.class),
                List.of(),
                row.get("created_at", Instant.class),
                row.get("edited_at", Instant.class),
                row.get("deleted_at", Instant.class)
        );
    }

    private Mono<List<MessageDto>> enrichWithReactions(Long userId, List<MessageDto> items) {
        if (items.isEmpty()) {
            return Mono.just(items);
        }
        List<Long> messageIds = items.stream().map(MessageDto::id).toList();
        return fetchReactionsForMessages(userId, messageIds)
                .map(reactionsMap -> items.stream().map(item -> new MessageDto(
                        item.id(),
                        item.channelId(),
                        item.senderUserId(),
                        item.senderUsername(),
                        item.kind(),
                        item.body(),
                        item.replyToMessageId(),
                        item.replyToBody(),
                        item.replyToSenderUsername(),
                        reactionsMap.getOrDefault(item.id(), List.of()),
                        item.createdAt(),
                        item.editedAt(),
                        item.deletedAt()
                )).toList());
    }

    private Mono<Map<Long, List<MessageReactionDto>>> fetchReactionsForMessages(Long userId, List<Long> messageIds) {
        String placeholders = String.join(",", java.util.Collections.nCopies(messageIds.size(), "?"));
        String sql = """
                SELECT mr.message_id,
                       mr.emoji,
                       COUNT(*) as reaction_count,
                       MAX(CASE WHEN mr.user_id = ? THEN 1 ELSE 0 END) as reacted_by_me
                FROM message_reaction mr
                WHERE mr.message_id IN (%s)
                GROUP BY mr.message_id, mr.emoji
                ORDER BY mr.message_id, reaction_count DESC, mr.emoji
                """.formatted(placeholders);

        DatabaseClient.GenericExecuteSpec spec = databaseClient.sql(sql).bind(0, userId);
        for (int i = 0; i < messageIds.size(); i++) {
            spec = spec.bind(i + 1, messageIds.get(i));
        }

        return spec.map((row, metadata) -> new Object[] {
                row.get("message_id", Long.class),
                new MessageReactionDto(
                        row.get("emoji", String.class),
                        row.get("reaction_count", Long.class) == null ? 0L : row.get("reaction_count", Long.class),
                        (row.get("reacted_by_me", Number.class) != null) && row.get("reacted_by_me", Number.class).intValue() > 0
                )
        }).all().collectList().map(rows -> {
            Map<Long, List<MessageReactionDto>> map = new HashMap<>();
            for (Object[] item : rows) {
                Long messageId = (Long) item[0];
                MessageReactionDto reaction = (MessageReactionDto) item[1];
                map.computeIfAbsent(messageId, ignored -> new ArrayList<>()).add(reaction);
            }
            return map;
        });
    }

    private String normalizeEmoji(String rawEmoji) {
        if (rawEmoji == null || rawEmoji.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Emoji is required");
        }
        String emoji = rawEmoji.trim();
        if (emoji.length() > MAX_EMOJI_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Emoji is too long");
        }
        return emoji;
    }
}
