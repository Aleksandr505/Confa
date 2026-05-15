package space.confa.api.configuration.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "attachment")
public record AttachmentProp(
        Image image
) {
    public record Image(
            long maxRawUploadBytes,
            int maxRawEdge,
            long maxRawPixels,
            int maxDisplayEdge,
            long maxDisplayBytes,
            int maxThumbnailEdge,
            long maxThumbnailBytes,
            int maxAttachmentsPerMessage,
            long presignTtlSeconds,
            boolean cleanupEnabled,
            long pendingTtlSeconds,
            long deletedRetentionSeconds,
            int cleanupBatchSize,
            long cleanupFixedDelayMs,
            int maxPendingUploadsPerUser,
            int maxPendingUploadsPerScope,
            long maxStoredBytesPerUser,
            long maxStoredBytesPerScope
    ) {}
}
