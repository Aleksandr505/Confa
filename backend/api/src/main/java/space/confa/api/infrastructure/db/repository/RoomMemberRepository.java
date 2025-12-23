package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.model.entity.RoomMemberEntity;
import space.confa.api.model.entity.UserEntity;

@Repository
public interface RoomMemberRepository extends R2dbcRepository<RoomMemberEntity, Long> {
    Mono<RoomMemberEntity> findByRoomIdAndUserId(Long roomId, Long userId);
    Flux<RoomMemberEntity> findByUserId(Long userId);

    @Query("""
            SELECT * FROM user
            WHERE username = :username
                AND blocked_at is null
            """)
    Mono<UserEntity> findByUsername(String username);
}
