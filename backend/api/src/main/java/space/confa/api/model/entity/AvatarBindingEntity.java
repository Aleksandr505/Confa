package space.confa.api.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import space.confa.api.model.domain.AvatarScopeType;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@Table("avatar_binding")
public class AvatarBindingEntity {
    @Id
    private Long id;
    private Long userId;
    private AvatarScopeType scopeType;
    private Long workspaceId;
    private Long roomId;
    private Long assetId;
    private Boolean isActive;
    private Instant createdAt;
    private Instant updatedAt;
}
