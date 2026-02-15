package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.ChannelMemberRepository;
import space.confa.api.infrastructure.db.repository.ChannelRepository;
import space.confa.api.infrastructure.db.repository.UserRepository;
import space.confa.api.model.domain.ChannelType;
import space.confa.api.model.dto.response.ChannelDto;
import space.confa.api.model.dto.response.DmSummaryDto;
import space.confa.api.model.entity.ChannelEntity;
import space.confa.api.model.entity.ChannelMemberEntity;
import space.confa.api.shared.mapper.MessengerMapper;

@Service
@RequiredArgsConstructor
public class DmService {

    private final DatabaseClient databaseClient;
    private final ChannelRepository channelRepository;
    private final ChannelMemberRepository channelMemberRepository;
    private final UserRepository userRepository;

    public Flux<DmSummaryDto> getDmList(Long userId) {
        return databaseClient.sql("""
                        SELECT c.id as channel_id, u.id as peer_user_id, u.username as peer_username
                        FROM channel c
                        JOIN channel_member cm_self ON cm_self.channel_id = c.id AND cm_self.user_id = :userId
                        JOIN channel_member cm_peer ON cm_peer.channel_id = c.id AND cm_peer.user_id <> :userId
                        JOIN user u ON u.id = cm_peer.user_id
                        WHERE c.type = 'DM'
                        ORDER BY c.created_at DESC
                        """)
                .bind("userId", userId)
                .map((row, metadata) -> new DmSummaryDto(
                        row.get("channel_id", Long.class),
                        row.get("peer_user_id", Long.class),
                        row.get("peer_username", String.class)
                ))
                .all();
    }

    @Transactional
    public Mono<ChannelDto> getOrCreateDm(Long userId, Long peerId) {
        if (userId.equals(peerId)) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot create DM with yourself"));
        }

        return userRepository.existsById(peerId)
                .filter(Boolean.TRUE::equals)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")))
                .then(getExistingDmChannelId(userId, peerId))
                .flatMap(channelId -> channelRepository.findById(channelId)
                        .map(MessengerMapper::toChannelDto))
                .switchIfEmpty(Mono.defer(() -> createDmChannel(userId, peerId)));
    }

    public Mono<Long> getExistingDmChannelId(Long userId, Long peerId) {
        long low = Math.min(userId, peerId);
        long high = Math.max(userId, peerId);

        return databaseClient.sql("""
                        SELECT channel_id
                        FROM dm_channel_index
                        WHERE user_low_id = :low AND user_high_id = :high
                        """)
                .bind("low", low)
                .bind("high", high)
                .map((row, metadata) -> row.get("channel_id", Long.class))
                .one();
    }

    @Transactional
    public Mono<ChannelDto> createDmChannel(Long userId, Long peerId) {
        long low = Math.min(userId, peerId);
        long high = Math.max(userId, peerId);

        return channelRepository.save(ChannelEntity.builder()
                        .type(ChannelType.DM)
                        .isPrivate(true)
                        .createdByUserId(userId)
                        .build())
                .flatMap(channel -> channelMemberRepository.save(ChannelMemberEntity.builder()
                                .channelId(channel.getId())
                                .userId(userId)
                                .build())
                        .then(channelMemberRepository.save(ChannelMemberEntity.builder()
                                .channelId(channel.getId())
                                .userId(peerId)
                                .build()))
                        .then(databaseClient.sql("""
                                INSERT INTO dm_channel_index (user_low_id, user_high_id, channel_id)
                                VALUES (:low, :high, :channelId)
                                """)
                                .bind("low", low)
                                .bind("high", high)
                                .bind("channelId", channel.getId())
                                .then())
                        .thenReturn(channel))
                .map(MessengerMapper::toChannelDto);
    }
}
