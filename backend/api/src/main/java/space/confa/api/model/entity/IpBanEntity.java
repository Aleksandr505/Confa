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
@Table("ip_ban")
public class IpBanEntity {
    @Id
    private Long id;
    private String ip;
    private String reason;
    private Instant bannedUntil;
    private Boolean permanent;
    private Instant createdAt;
    private Instant updatedAt;
}
