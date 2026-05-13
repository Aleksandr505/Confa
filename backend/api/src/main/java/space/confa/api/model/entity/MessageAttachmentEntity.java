package space.confa.api.model.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;
import space.confa.api.model.domain.MessageAttachmentStatus;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@Table("message_attachment")
public class MessageAttachmentEntity {
    @Id
    private Long id;
    private Long messageId;
    private Long channelId;
    private Long roomId;
    private Long ownerUserId;
    private MessageAttachmentStatus status;
    private String bucket;
    private String displayObjectKey;
    private String thumbnailObjectKey;
    private String originalFilename;
    private String originalContentType;
    private Long originalSizeBytes;
    private String storedContentType;
    private Long storedSizeBytes;
    private Integer width;
    private Integer height;
    private Long thumbnailSizeBytes;
    private Integer thumbnailWidth;
    private Integer thumbnailHeight;
    private String checksumSha256;
    private Instant createdAt;
    private Instant attachedAt;
    private Instant deletedAt;
}
