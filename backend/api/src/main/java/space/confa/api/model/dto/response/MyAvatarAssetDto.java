package space.confa.api.model.dto.response;

import java.time.Instant;

public record MyAvatarAssetDto(
        Long assetId,
        String contentUrl,
        String originalContentType,
        Long originalSizeBytes,
        Integer width,
        Integer height,
        Instant createdAt,
        boolean activeGlobal
) {}
