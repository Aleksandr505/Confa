package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;
import space.confa.api.model.entity.VoiceChannelBindingEntity;

@Repository
public interface VoiceChannelBindingRepository extends R2dbcRepository<VoiceChannelBindingEntity, Long> {
    Mono<VoiceChannelBindingEntity> findByChannelId(Long channelId);
}
