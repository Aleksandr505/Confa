package space.confa.api.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import space.confa.api.model.domain.RoomMemberRole;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@Table("room_member")
public class RoomMemberEntity {
    @Id
    private Long id;
    private Long roomId;
    private Long userId;
    private RoomMemberRole role;
    private Instant createdAt;
    private Instant updatedAt;
}
