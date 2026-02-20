package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;
import space.confa.api.model.entity.WorkspaceEntity;

@Repository
public interface WorkspaceRepository extends R2dbcRepository<WorkspaceEntity, Long> {
    Mono<Boolean> existsBySlug(String slug);
}
