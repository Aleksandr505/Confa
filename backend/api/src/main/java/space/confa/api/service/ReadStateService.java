package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
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
}
