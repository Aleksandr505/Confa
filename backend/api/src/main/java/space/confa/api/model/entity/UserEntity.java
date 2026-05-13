package space.confa.api.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import space.confa.api.model.domain.UserRole;
import space.confa.api.model.domain.UserStatus;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@Table("user")
public final class UserEntity {
    @Id
    private Long id;
    private UserRole role;
    private UserStatus status;
    private String username;
    private String password;
    private Instant blockedAt;
    private Instant approvedAt;
    private Long approvedByUserId;
    private Instant rejectedAt;
    private Long rejectedByUserId;
    private Instant createdAt;
    private Instant updatedAt;
}
