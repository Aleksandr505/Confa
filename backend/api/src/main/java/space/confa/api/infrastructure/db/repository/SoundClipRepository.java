package space.confa.api.infrastructure.db.repository;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Flux;
import space.confa.api.model.entity.SoundClipEntity;

public interface SoundClipRepository extends ReactiveCrudRepository<SoundClipEntity, Long> {
    Flux<SoundClipEntity> findAllByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long ownerUserId);
}
