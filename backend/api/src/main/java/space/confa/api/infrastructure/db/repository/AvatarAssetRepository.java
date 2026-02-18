package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import space.confa.api.model.entity.AvatarAssetEntity;

@Repository
public interface AvatarAssetRepository extends R2dbcRepository<AvatarAssetEntity, Long> {}
