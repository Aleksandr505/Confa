package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.Modifying;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;
import space.confa.api.model.entity.RoomInviteEntity;

@Repository
public interface RoomInviteRepository extends R2dbcRepository<RoomInviteEntity, Long> {
    Mono<RoomInviteEntity> findByTokenHash(String tokenHash);

    @Modifying
    @Query("""
            UPDATE room_invite
            SET used_count = used_count + 1
            WHERE id = :id
            """)
    Mono<Integer> incrementUsage(Long id);
}
