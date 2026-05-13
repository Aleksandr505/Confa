package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import space.confa.api.model.entity.MessageAttachmentEntity;

@Repository
public interface MessageAttachmentRepository extends R2dbcRepository<MessageAttachmentEntity, Long> {}
