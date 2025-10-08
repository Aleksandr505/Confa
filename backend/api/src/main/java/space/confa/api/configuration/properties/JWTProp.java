package space.confa.api.configuration.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("security.jwt")
public record JWTProp(
        String issuer,
        String authSecret,
        String accessExpiration,
        String refreshExpiration,
        String recoveryPasswordExpiration
) {}
