package space.confa.api.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import space.confa.api.infrastructure.db.repository.UserRepository;
import space.confa.api.model.domain.JWTPair;
import space.confa.api.model.domain.UserRole;
import space.confa.api.model.domain.UserStatus;
import space.confa.api.model.dto.request.AuthDto;
import space.confa.api.model.entity.UserEntity;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class LoginServiceTest {

    @Test
    void approvedUserCanAuthenticate() {
        var loginService = loginServiceWithUser(userWithStatus(UserStatus.ACTIVE), true);

        StepVerifier.create(loginService.authenticate(new AuthDto("active", "secret")))
                .assertNext(tokens -> {
                    assertEquals("access-token", tokens.accessToken());
                    assertEquals("refresh-token", tokens.refreshToken());
                })
                .verifyComplete();
    }

    @Test
    void pendingUserCannotAuthenticate() {
        var loginService = loginServiceWithUser(userWithStatus(UserStatus.PENDING), true);

        StepVerifier.create(loginService.authenticate(new AuthDto("pending", "secret")))
                .expectErrorSatisfies(error -> {
                    var responseError = assertInstanceOf(ResponseStatusException.class, error);
                    assertEquals(HttpStatus.FORBIDDEN, responseError.getStatusCode());
                    assertEquals("Registration request is pending approval", responseError.getReason());
                })
                .verify();
    }

    @Test
    void rejectedUserCannotAuthenticate() {
        var loginService = loginServiceWithUser(userWithStatus(UserStatus.REJECTED), true);

        StepVerifier.create(loginService.authenticate(new AuthDto("rejected", "secret")))
                .expectErrorSatisfies(error -> {
                    var responseError = assertInstanceOf(ResponseStatusException.class, error);
                    assertEquals(HttpStatus.FORBIDDEN, responseError.getStatusCode());
                    assertEquals("Registration request was rejected", responseError.getReason());
                })
                .verify();
    }

    @Test
    void pendingUserWithWrongPasswordGetsGenericAuthenticationFailure() {
        var loginService = loginServiceWithUser(userWithStatus(UserStatus.PENDING), false);

        StepVerifier.create(loginService.authenticate(new AuthDto("pending", "wrong")))
                .expectErrorSatisfies(error -> {
                    var responseError = assertInstanceOf(ResponseStatusException.class, error);
                    assertEquals(HttpStatus.BAD_REQUEST, responseError.getStatusCode());
                    assertEquals("Authentication failed", responseError.getReason());
                })
                .verify();
    }

    private LoginService loginServiceWithUser(UserEntity user, boolean passwordMatches) {
        var userService = new UserService(null, null, userRepository((proxy, method, args) -> switch (method.getName()) {
            case "findAnyByUsername" -> Mono.just(user);
            default -> unsupported(method.getName());
        }));
        return new LoginService(
                authentication -> Mono.just(new UsernamePasswordAuthenticationToken("active", "secret")),
                new TestJwtService(),
                userService,
                new TestPasswordEncoder(passwordMatches)
        );
    }

    private UserRepository userRepository(InvocationHandler handler) {
        return (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class[]{UserRepository.class},
                handler
        );
    }

    private Object unsupported(String methodName) {
        throw new UnsupportedOperationException("Unexpected repository call: " + methodName);
    }

    private UserEntity userWithStatus(UserStatus status) {
        return UserEntity.builder()
                .id(1L)
                .role(UserRole.USER)
                .status(status)
                .username("user")
                .password("encoded")
                .build();
    }

    private static class TestJwtService extends JWTService {
        TestJwtService() {
            super(null, null, null);
        }

        @Override
        public JWTPair<Jwt, Jwt> generatePairJWT(UsernamePasswordAuthenticationToken authentication) {
            var now = Instant.now();
            return new JWTPair<>(
                    new Jwt("access-token", now, now.plusSeconds(60), Map.of("alg", "none"), Map.of("sub", "1")),
                    new Jwt("refresh-token", now, now.plusSeconds(60), Map.of("alg", "none"), Map.of("sub", "1"))
            );
        }
    }

    private record TestPasswordEncoder(boolean matches) implements PasswordEncoder {
        @Override
        public String encode(CharSequence rawPassword) {
            return "encoded";
        }

        @Override
        public boolean matches(CharSequence rawPassword, String encodedPassword) {
            return matches;
        }
    }
}
