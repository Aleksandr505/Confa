package space.confa.api.infrastructure.db.repository;

import org.jetbrains.annotations.NotNull;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;
import space.confa.api.model.entity.UserEntity;

@Repository
public interface UserRepository extends R2dbcRepository<UserEntity, Long> {

    @Query("""
            SELECT * FROM user
            WHERE username = :username
                AND blocked_at is null
            """)
    Mono<UserEntity> findByUsername(String username);

    @NotNull
    @Query("""
            SELECT * FROM user
            WHERE id = :id
                AND blocked_at is null
            """)
    Mono<UserEntity> findById(@NotNull Long id);
}
