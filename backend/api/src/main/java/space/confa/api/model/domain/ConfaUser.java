package space.confa.api.model.domain;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.Collection;

@Getter
@EqualsAndHashCode(callSuper = true)
public class ConfaUser extends User {
    private final long id;
    private final String name;

    public ConfaUser(
            long id,
            String username,
            String password,
            String name,
            boolean accountNonLocked,
            Collection<? extends GrantedAuthority> authorities
    ) {
        super(
                username,
                password,
                true,
                true,
                true,
                accountNonLocked,
                authorities
        );
        this.id = id;
        this.name = name;
    }
}
