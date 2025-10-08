package space.confa.api.configuration;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import space.confa.api.configuration.properties.JWTProp;
import space.confa.api.shared.validator.JWTPairValidator;

import javax.crypto.spec.SecretKeySpec;

@Configuration
@RequiredArgsConstructor
public class JwtConfiguration {
    private final JWTProp jwtProp;
    private static final String ALGORITHM_NAME = MacAlgorithm.HS256.getName();

    private SecretKeySpec getAuthSecretKey() {
        return new SecretKeySpec(
                jwtProp.authSecret().getBytes(),
                ALGORITHM_NAME
        );
    }

    @Bean
    JWTPairValidator jwtPairValidator(JwtDecoder jwtDecoder) {
        return new JWTPairValidator(jwtDecoder);
    }

    @Bean
    @Primary
    ReactiveJwtDecoder reactiveJwtAuthDecoder() {
        return NimbusReactiveJwtDecoder.withSecretKey(
                getAuthSecretKey()
        ).build();
    }

    @Bean
    @Primary
    JwtDecoder jwtAuthDecoder() {
        return NimbusJwtDecoder.withSecretKey(
                getAuthSecretKey()
        ).build();
    }

    @Bean
    @Primary
    JwtEncoder jwtAuthEncoder() {
        return new NimbusJwtEncoder(
                new ImmutableSecret<>(getAuthSecretKey())
        );
    }

}
