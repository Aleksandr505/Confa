package space.confa.api.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.relational.core.mapping.Table;
import space.confa.api.model.domain.UserRole;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@Table("user")
public final class UserEntity {
    private Long id;
    private UserRole role;
    private String username;
    private String password;
    private Instant blockedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
