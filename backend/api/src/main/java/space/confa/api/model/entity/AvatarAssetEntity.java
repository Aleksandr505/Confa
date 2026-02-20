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
@Table("avatar_asset")
public class AvatarAssetEntity {
    @Id
    private Long id;
    private String bucket;
    private String keyOriginal;
    private String keyPng;
    private String originalContentType;
    private Long originalSizeBytes;
    private Integer width;
    private Integer height;
    private String checksumSha256;
    private Long createdByUserId;
    private Instant createdAt;
}
