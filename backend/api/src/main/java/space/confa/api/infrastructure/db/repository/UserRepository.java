package space.confa.api.infrastructure.db.repository;

import org.jetbrains.annotations.NotNull;
import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.model.domain.UserRole;
import space.confa.api.model.domain.UserStatus;
import space.confa.api.model.entity.UserEntity;

@Repository
public interface UserRepository extends R2dbcRepository<UserEntity, Long> {

    @Query("""
            SELECT * FROM user
            WHERE username = :username
                AND status = 'ACTIVE'
                AND blocked_at is null
            """)
    Mono<UserEntity> findByUsername(String username);

    @Query("""
            SELECT * FROM user
            WHERE username = :username
            """)
    Mono<UserEntity> findAnyByUsername(String username);

    @Query("""
            SELECT * FROM user
            WHERE status = :status
            ORDER BY created_at ASC
            """)
    Flux<UserEntity> findAllByStatus(@NotNull UserStatus status);

    @Query("""
            SELECT count(*) FROM user
            WHERE role = :role
                AND status = 'ACTIVE'
                AND blocked_at is null
            """)
    Mono<Integer> countAllByRole(@NotNull UserRole role);

    @Modifying
    @Query("""
            UPDATE user
                SET blocked_at = NOW()
            WHERE id = :id
            """)
    Mono<Integer> blockById(@NotNull Long id);

    @Modifying
    @Query("""
            UPDATE user
                SET blocked_at = null
            WHERE id = :id
            """)
    Mono<Integer> unblockById(@NotNull Long id);
}
