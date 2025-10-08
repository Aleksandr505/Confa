package space.confa.api.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.authentication.UserDetailsRepositoryReactiveAuthenticationManager;
import org.springframework.security.core.userdetails.ReactiveUserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtReactiveAuthenticationManager;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;

@Configuration
public class AuthenticationConfiguration {

    @Bean
    ReactiveAuthenticationManager reactiveAuthenticationManager(
            PasswordEncoder passwordEncoder,
            ReactiveUserDetailsService reactiveUserDetailsService
    ) {
        var manager = new UserDetailsRepositoryReactiveAuthenticationManager(
                reactiveUserDetailsService
        );

        manager.setPasswordEncoder(passwordEncoder);
        return manager;
    }

    /*@Bean
    JwtReactiveAuthenticationManager jwtReactiveAuthenticationManager(
            ReactiveJwtDecoder reactiveJwtDecoder
    ) {
        var manager = new JwtReactiveAuthenticationManager(reactiveJwtDecoder);
        manager.setJwtAuthenticationConverter(new ReactiveJwtAuthenticationConverterAdapter(
                jwtAuthenticationConverter()
        ));
        return manager;
    }*/

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        var jwtAuthenticationConverter = new JwtAuthenticationConverter();
        jwtAuthenticationConverter.setJwtGrantedAuthoritiesConverter(getJwtGrantedAuthoritiesConverter());
        return jwtAuthenticationConverter;
    }

    private JwtGrantedAuthoritiesConverter getJwtGrantedAuthoritiesConverter() {
        var jwtGrantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
        jwtGrantedAuthoritiesConverter.setAuthorityPrefix("");
        return jwtGrantedAuthoritiesConverter;
    }
}
