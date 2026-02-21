package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.response.ReadStateDto;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class ReadStateService {

    private final MessengerAccessService messengerAccessService;
    private final DatabaseClient databaseClient;

    public Mono<ReadStateDto> updateReadState(Long userId, Long channelId, Long lastReadMessageId) {
        Instant now = Instant.now();

        return messengerAccessService.getChannelForAccess(userId, channelId)
                .then(validateMessageBelongsToChannel(channelId, lastReadMessageId))
                .then(databaseClient.sql("""
                        INSERT INTO channel_read_state (channel_id, user_id, last_read_message_id, last_read_at)
                        VALUES (:channelId, :userId, :lastReadMessageId, :lastReadAt)
                        ON DUPLICATE KEY UPDATE
                            last_read_message_id = VALUES(last_read_message_id),
                            last_read_at = VALUES(last_read_at)
                        """)
                        .bind("channelId", channelId)
                        .bind("userId", userId)
                        .bind("lastReadMessageId", lastReadMessageId)
                        .bind("lastReadAt", now)
                .then())
                .thenReturn(new ReadStateDto(channelId, userId, lastReadMessageId, now));
    }

    private Mono<Void> validateMessageBelongsToChannel(Long channelId, Long messageId) {
        return databaseClient.sql("""
                        SELECT id
                        FROM message
                        WHERE id = :messageId
                          AND channel_id = :channelId
                        LIMIT 1
                        """)
                .bind("messageId", messageId)
                .bind("channelId", channelId)
                .map((row, metadata) -> row.get("id", Long.class))
                .one()
                .switchIfEmpty(Mono.error(new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Message does not belong to channel"
                )))
                .then();
    }
}
