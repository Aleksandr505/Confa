package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;
import space.confa.api.model.domain.AvatarScopeType;
import space.confa.api.model.entity.AvatarBindingEntity;

@Repository
public interface AvatarBindingRepository extends R2dbcRepository<AvatarBindingEntity, Long> {
    @Query("""
            SELECT *
            FROM avatar_binding
            WHERE user_id = :userId
              AND scope_type = :scopeType
              AND is_active = 1
            ORDER BY updated_at DESC
            LIMIT 1
            """)
    Mono<AvatarBindingEntity> findLatestActiveByUserAndScope(Long userId, AvatarScopeType scopeType);

    @Query("""
            SELECT *
            FROM avatar_binding
            WHERE user_id = :userId
              AND scope_type = :scopeType
              AND workspace_id = :workspaceId
              AND is_active = 1
            ORDER BY updated_at DESC
            LIMIT 1
            """)
    Mono<AvatarBindingEntity> findLatestActiveByUserAndWorkspaceScope(Long userId, AvatarScopeType scopeType, Long workspaceId);

    @Query("""
            SELECT *
            FROM avatar_binding
            WHERE user_id = :userId
              AND scope_type = :scopeType
              AND room_id = :roomId
              AND is_active = 1
            ORDER BY updated_at DESC
            LIMIT 1
            """)
    Mono<AvatarBindingEntity> findLatestActiveByUserAndRoomScope(Long userId, AvatarScopeType scopeType, Long roomId);
}
