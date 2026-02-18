package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import space.confa.api.model.entity.AvatarAssetEntity;

@Repository
public interface AvatarAssetRepository extends R2dbcRepository<AvatarAssetEntity, Long> {
    @Query("""
            SELECT *
            FROM avatar_asset
            WHERE created_by_user_id = :userId
            ORDER BY created_at DESC
            """)
    Flux<AvatarAssetEntity> findAllByCreatedByUserId(Long userId);
}
