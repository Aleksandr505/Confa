package space.confa.api.model.dto.response;

import java.time.Instant;

public record MessageAttachmentDto(
        Long id,
        String thumbnailUrl,
        String displayUrl,
        String originalFilename,
        String originalContentType,
        Long originalSizeBytes,
        String contentType,
        Long sizeBytes,
        Integer width,
        Integer height,
        Long thumbnailSizeBytes,
        Integer thumbnailWidth,
        Integer thumbnailHeight,
        Instant createdAt
) {}
