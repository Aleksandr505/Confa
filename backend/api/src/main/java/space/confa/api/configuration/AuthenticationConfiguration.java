package space.confa.api.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.authentication.UserDetailsRepositoryReactiveAuthenticationManager;
import org.springframework.security.core.userdetails.ReactiveUserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;

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
}
