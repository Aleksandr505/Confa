package space.confa.api.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.r2dbc.repository.config.EnableR2dbcRepositories;

@Configuration
@EnableR2dbcRepositories(basePackages = "space.confa.api.infrastructure.db.repository")
public class R2dbcConfiguration {
}
