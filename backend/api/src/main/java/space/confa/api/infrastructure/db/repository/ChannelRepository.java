package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import space.confa.api.model.entity.ChannelEntity;

@Repository
public interface ChannelRepository extends R2dbcRepository<ChannelEntity, Long> {
    Flux<ChannelEntity> findAllByWorkspaceIdOrderByPositionAsc(Long workspaceId);
}
