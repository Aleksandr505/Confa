package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.ReactiveUserDetailsService;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.UserRepository;
import space.confa.api.model.domain.ConfaUser;
import space.confa.api.model.domain.UserRole;
import space.confa.api.model.domain.UserStatus;
import space.confa.api.model.dto.response.BootstrapDto;
import space.confa.api.model.dto.response.BootstrapStatusDto;
import space.confa.api.model.dto.response.MyProfileDto;
import space.confa.api.model.dto.response.UserDto;
import space.confa.api.model.entity.UserEntity;
import space.confa.api.shared.mapper.UserMapper;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.springframework.http.HttpStatus.NOT_FOUND;

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
                .status(UserStatus.ACTIVE)
                .username(username)
                .password(passwordEncoder.encode(password))
                .approvedAt(Instant.now())
                .build();

        return userRepository.save(user)
                .map(UserMapper::mapToDto);
    }

    public Mono<UserDto> registerUser(String username, String password) {
        var normalizedUsername = username.trim();

        return userRepository.save(UserEntity.builder()
                        .role(UserRole.USER)
                        .status(UserStatus.PENDING)
                        .username(normalizedUsername)
                        .password(passwordEncoder.encode(password))
                        .build())
                .onErrorMap(DataIntegrityViolationException.class, e -> new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Username is already taken"
                ))
                .map(UserMapper::mapToDto);
    }

    public Flux<UserDto> getRegistrationRequests() {
        return userRepository.findAllByStatus(UserStatus.PENDING)
                .map(UserMapper::mapToDto);
    }

    public Mono<UserDto> approveUser(Long id, Long adminUserId) {
        return userRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResponseStatusException(NOT_FOUND, "User not found")))
                .flatMap(user -> {
                    if (user.getStatus() != UserStatus.PENDING) {
                        return Mono.error(new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                "Only pending users can be approved"
                        ));
                    }

                    return userRepository.save(user.toBuilder()
                            .status(UserStatus.ACTIVE)
                            .approvedAt(Instant.now())
                            .approvedByUserId(adminUserId)
                            .rejectedAt(null)
                            .rejectedByUserId(null)
                            .build());
                })
                .map(UserMapper::mapToDto);
    }

    public Mono<UserDto> rejectUser(Long id, Long adminUserId) {
        return userRepository.findById(id)
                .switchIfEmpty(Mono.error(new ResponseStatusException(NOT_FOUND, "User not found")))
                .flatMap(user -> {
                    if (user.getStatus() != UserStatus.PENDING) {
                        return Mono.error(new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                "Only pending users can be rejected"
                        ));
                    }

                    return userRepository.save(user.toBuilder()
                            .status(UserStatus.REJECTED)
                            .rejectedAt(Instant.now())
                            .rejectedByUserId(adminUserId)
                            .approvedAt(null)
                            .approvedByUserId(null)
                            .build());
                })
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

    public Mono<UserEntity> findAnyByUsername(String username) {
        return userRepository.findAnyByUsername(username);
    }

    public Mono<MyProfileDto> getMyProfile(Long userId) {
        return userRepository.findById(userId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(NOT_FOUND, "User not found")))
                .map(user -> new MyProfileDto(
                        user.getId(),
                        user.getUsername(),
                        user.getRole(),
                        user.getCreatedAt()
                ));
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
