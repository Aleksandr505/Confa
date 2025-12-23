package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;
import space.confa.api.model.entity.RoomEntity;

@Repository
public interface RoomRepository extends R2dbcRepository<RoomEntity, Long> {
    Mono<RoomEntity> findByName(String name);
    Mono<Boolean> existsByName(String name);
}
