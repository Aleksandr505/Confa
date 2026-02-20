package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;
import space.confa.api.model.entity.ChannelMemberEntity;

@Repository
public interface ChannelMemberRepository extends R2dbcRepository<ChannelMemberEntity, Long> {
    Mono<Boolean> existsByChannelIdAndUserId(Long channelId, Long userId);
}
