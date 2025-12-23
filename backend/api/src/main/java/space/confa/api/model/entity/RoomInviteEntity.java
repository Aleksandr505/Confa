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
@Table("room_invite")
public class RoomInviteEntity {
    @Id
    private Long id;
    private Long roomId;
    private String tokenHash;
    private Instant expiresAt;
    private Integer maxUses;
    private Integer usedCount;
    private Long createdBy;
    private Instant createdAt;
    private Instant updatedAt;
}
