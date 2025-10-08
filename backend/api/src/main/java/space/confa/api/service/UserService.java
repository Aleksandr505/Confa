package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.ReactiveUserDetailsService;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.UserRepository;
import space.confa.api.model.domain.ConfaUser;
import space.confa.api.model.domain.UserRole;
import space.confa.api.model.entity.UserEntity;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService implements ReactiveUserDetailsService {

    private final PasswordEncoder passwordEncoder;
    private final JWTService jwtService;
    private final UserRepository userRepository;

    public Mono<String> createUserByAdmin(String username) {
        var randomPassword = UUID.randomUUID().toString();
        return createUser(username, randomPassword)
                .thenReturn(randomPassword);
    }

    public Mono<UserEntity> createUser(String username, String password) {
        var user = UserEntity.builder()
                .role(UserRole.USER)
                .username(username)
                .password(passwordEncoder.encode(password))
                .build();

        return userRepository.save(user);
    }

    public Mono<UserDetails> findById(Long id) {
        return userRepository.findById(id)
                .flatMap(this::userDetailsFrom);
    }

    public Long getUserIdFromToken(String tokenValue) {
        return Long.parseLong(jwtService.getAuthJwtSubject(tokenValue));
    }

    @Override
    public Mono<UserDetails> findByUsername(String username) {
        return userRepository.findByUsername(username)
                .flatMap(this::userDetailsFrom);
    }

    private Mono<UserDetails> userDetailsFrom(UserEntity user) {
        var authority = List.of(new SimpleGrantedAuthority(user.getRole().name()));
        return Mono.just(new ConfaUser(
                user.getId(),
                user.getUsername(),
                user.getPassword(),
                user.getUsername(),
                true,
                authority));
    }
}
