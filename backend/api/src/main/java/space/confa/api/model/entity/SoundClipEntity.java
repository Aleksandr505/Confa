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
@Table("sound_clip")
public class SoundClipEntity {
    @Id
    private Long id;
    private Long ownerUserId;
    private Long sourceRoomId;
    private String name;
    private String bucket;
    private String objectKey;
    private String contentType;
    private Long sizeBytes;
    private Integer durationMs;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
}
