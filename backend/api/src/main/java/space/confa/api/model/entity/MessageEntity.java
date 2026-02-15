package space.confa.api.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import space.confa.api.model.domain.MessageKind;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@Table("message")
public class MessageEntity {
    @Id
    private Long id;
    private Long channelId;
    private Long senderUserId;
    private MessageKind kind;
    private String body;
    private Instant createdAt;
    private Instant editedAt;
    private Instant deletedAt;
    private Long deletedByUserId;
}
