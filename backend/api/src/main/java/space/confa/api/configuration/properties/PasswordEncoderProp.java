package space.confa.api.configuration.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("security.password-encoder")
public record PasswordEncoderProp(String secret) {
}
