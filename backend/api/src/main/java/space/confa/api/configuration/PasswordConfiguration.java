package space.confa.api.configuration;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;
import space.confa.api.configuration.properties.PasswordEncoderProp;

import static org.springframework.security.crypto.password.Pbkdf2PasswordEncoder.SecretKeyFactoryAlgorithm.PBKDF2WithHmacSHA256;

@Configuration
@RequiredArgsConstructor
public class PasswordConfiguration {
    private final PasswordEncoderProp passwordEncoderProp;
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new Pbkdf2PasswordEncoder(
                passwordEncoderProp.secret(),
                8,
                185000,
                PBKDF2WithHmacSHA256);
    }
}
