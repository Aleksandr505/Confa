package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.ReactiveUserDetailsService;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.UserRepository;
import space.confa.api.model.domain.ConfaUser;
import space.confa.api.model.domain.UserRole;
import space.confa.api.model.dto.response.BootstrapDto;
import space.confa.api.model.dto.response.BootstrapStatusDto;
import space.confa.api.model.dto.response.UserDto;
import space.confa.api.model.entity.UserEntity;
import space.confa.api.shared.mapper.UserMapper;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService implements ReactiveUserDetailsService {

    private final PasswordEncoder passwordEncoder;
    private final JWTService jwtService;
    private final UserRepository userRepository;

    @Value("${security.init-bootstrap.service-key}")
    private String serviceKey;

    public Mono<BootstrapStatusDto> getBootstrapStatus() {
        return userRepository.countAllByRole(UserRole.ADMIN)
                .map(count -> {
                    if (count > 0) {
                        return new BootstrapStatusDto(true);
                    }
                    return new BootstrapStatusDto(false);
                });
    }

    public Mono<BootstrapDto> bootstrapAdmin(String initServiceKey, String username) {
        if (!serviceKey.equals(initServiceKey)) {
            return Mono.error(new IllegalArgumentException("Invalid service key"));
        }

        var randomPassword = UUID.randomUUID().toString();
        return getBootstrapStatus()
                .filter(status -> Boolean.FALSE.equals(status.isInitialized()))
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Admin already initialized")))
                .flatMap(ignored -> createUser(username, randomPassword, UserRole.ADMIN))
                .map(ignored -> new BootstrapDto(username, randomPassword));
    }

    public Flux<UserDto> getUsers() {
        return userRepository.findAll()
                .map(UserMapper::mapToDto);
    }

    public Mono<UserDto> createUser(String username, String password, UserRole role) {
        var user = UserEntity.builder()
                .role(role)
                .username(username)
                .password(passwordEncoder.encode(password))
                .build();

        return userRepository.save(user)
                .map(UserMapper::mapToDto);
    }

    public Mono<UserDto> blockUser(Long id) {
        return userRepository.blockById(id)
                .flatMap(ignored -> userRepository.findById(id))
                .map(UserMapper::mapToDto);
    }

    public Mono<UserDto> unblockUser(Long id) {
        return userRepository.unblockById(id)
                .flatMap(ignored -> userRepository.findById(id))
                .map(UserMapper::mapToDto);
    }

    public Mono<Void> deleteUser(Long id) {
        return userRepository.deleteById(id);
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
