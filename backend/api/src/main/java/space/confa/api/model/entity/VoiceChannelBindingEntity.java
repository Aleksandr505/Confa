package space.confa.api.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import space.confa.api.model.domain.VoiceChannelMode;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@Table("voice_channel_binding")
public class VoiceChannelBindingEntity {
    @Id
    private Long channelId;
    private String livekitRoomName;
    private VoiceChannelMode mode;
    private Long createdByUserId;
    private Instant createdAt;
}
