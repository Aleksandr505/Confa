package space.confa.api.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@Table("workspace")
public class WorkspaceEntity {
    @Id
    private Long id;
    private String name;
    private String slug;
    private Long ownerUserId;
    private Instant createdAt;
    private Instant updatedAt;
}
