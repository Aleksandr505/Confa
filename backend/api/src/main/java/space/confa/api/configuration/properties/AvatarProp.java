package space.confa.api.configuration.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "avatar")
public record AvatarProp(
        long maxUploadBytes,
        long presignTtlSeconds,
        Storage storage
) {
    public record Storage(
            String endpoint,
            String region,
            String bucket,
            String accessKey,
            String secretKey,
            boolean pathStyle
    ) {}
}
