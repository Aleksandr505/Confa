package space.confa.api.configuration.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "livekit")
public record LivekitProp(String host, String apiKey, String apiSecret, String defaultRoom) { }
