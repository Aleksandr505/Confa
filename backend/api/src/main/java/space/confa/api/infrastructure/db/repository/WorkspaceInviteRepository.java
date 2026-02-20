package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;
import space.confa.api.model.entity.WorkspaceInviteEntity;
import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;

@Repository
public interface WorkspaceInviteRepository extends R2dbcRepository<WorkspaceInviteEntity, Long> {
    Mono<WorkspaceInviteEntity> findByTokenHash(String tokenHash);

    @Modifying
    @Query("""
            UPDATE workspace_invite
            SET used_count = used_count + 1
            WHERE id = :id
            """)
    Mono<Integer> incrementUsage(Long id);
}
