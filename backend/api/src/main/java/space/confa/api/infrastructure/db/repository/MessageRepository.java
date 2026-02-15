package space.confa.api.infrastructure.db.repository;

import org.springframework.data.r2dbc.repository.R2dbcRepository;
import org.springframework.stereotype.Repository;
import space.confa.api.model.entity.MessageEntity;

@Repository
public interface MessageRepository extends R2dbcRepository<MessageEntity, Long> {}
