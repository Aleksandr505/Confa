package space.confa.api.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import space.confa.api.model.domain.ChannelType;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@Table("channel")
public class ChannelEntity {
    @Id
    private Long id;
    private Long workspaceId;
    private ChannelType type;
    private String name;
    private String topic;
    private Boolean isPrivate;
    private Integer position;
    private Long createdByUserId;
    private Instant createdAt;
    private Instant updatedAt;
}
