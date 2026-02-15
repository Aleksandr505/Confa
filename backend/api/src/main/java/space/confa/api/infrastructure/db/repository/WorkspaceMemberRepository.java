package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.model.entity.WorkspaceMemberEntity;

@Repository
public interface WorkspaceMemberRepository extends R2dbcRepository<WorkspaceMemberEntity, Long> {
    Mono<Boolean> existsByWorkspaceIdAndUserId(Long workspaceId, Long userId);
    Flux<WorkspaceMemberEntity> findAllByUserId(Long userId);
}
