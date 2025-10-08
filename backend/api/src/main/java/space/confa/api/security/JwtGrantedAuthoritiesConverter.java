package space.confa.api.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Collection;
import java.util.Collections;
import java.util.Optional;
import java.util.stream.Collectors;

public class JwtGrantedAuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    private static final String ROLES_CLAIM = "scope";

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        if (Optional.ofNullable(jwt.getClaimAsStringList(ROLES_CLAIM)).isEmpty()) {
            return Collections.emptyList();
        }

        return jwt.getClaimAsStringList(ROLES_CLAIM).stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toUnmodifiableList());
    }
}
