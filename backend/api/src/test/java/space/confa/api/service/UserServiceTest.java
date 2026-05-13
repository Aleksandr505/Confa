package space.confa.api.service;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import space.confa.api.infrastructure.db.repository.UserRepository;
import space.confa.api.model.domain.UserRole;
import space.confa.api.model.domain.UserStatus;
import space.confa.api.model.entity.UserEntity;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class UserServiceTest {

    private final PasswordEncoder passwordEncoder = new TestPasswordEncoder();

    @Test
    void registerUserCreatesPendingUserWithoutAdminAccess() {
        var savedUser = new AtomicReference<UserEntity>();
        var userRepository = userRepository((proxy, method, args) -> switch (method.getName()) {
            case "save" -> {
                savedUser.set((UserEntity) args[0]);
                yield Mono.just(args[0]);
            }
            default -> unsupported(method.getName());
        });
        var userService = new UserService(passwordEncoder, null, userRepository);

        StepVerifier.create(userService.registerUser(" new-user ", "secret"))
                .assertNext(user -> {
                    assertEquals(UserRole.USER, user.role());
                    assertEquals(UserStatus.PENDING, user.status());
                    assertEquals("new-user", user.username());
                    assertEquals("encoded", savedUser.get().getPassword());
                })
                .verifyComplete();
    }

    @Test
    void registerUserMapsDuplicateUsernameToConflict() {
        var userRepository = userRepository((proxy, method, args) -> switch (method.getName()) {
            case "save" -> Mono.error(new DuplicateKeyException("Duplicate entry"));
            default -> unsupported(method.getName());
        });
        var userService = new UserService(passwordEncoder, null, userRepository);

        StepVerifier.create(userService.registerUser("existing", "secret123"))
                .expectErrorSatisfies(error -> {
                    var responseError = assertInstanceOf(ResponseStatusException.class, error);
                    assertEquals(HttpStatus.CONFLICT, responseError.getStatusCode());
                    assertEquals("Username is already taken", responseError.getReason());
                })
                .verify();
    }

    @Test
    void approveUserActivatesOnlyPendingUsers() {
        var pendingUser = UserEntity.builder()
                .id(42L)
                .role(UserRole.USER)
                .status(UserStatus.PENDING)
                .username("new-user")
                .password("encoded")
                .build();

        var userRepository = userRepository((proxy, method, args) -> switch (method.getName()) {
            case "findById" -> Mono.just(pendingUser);
            case "save" -> Mono.just(args[0]);
            default -> unsupported(method.getName());
        });
        var userService = new UserService(passwordEncoder, null, userRepository);

        StepVerifier.create(userService.approveUser(42L, 7L))
                .assertNext(user -> {
                    assertEquals(UserStatus.ACTIVE, user.status());
                    assertEquals(7L, user.approvedByUserId());
                    assertNotNull(user.approvedAt());
                })
                .verifyComplete();
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

    private static class TestPasswordEncoder implements PasswordEncoder {
        @Override
        public String encode(CharSequence rawPassword) {
            return "encoded";
        }

        @Override
        public boolean matches(CharSequence rawPassword, String encodedPassword) {
            return false;
        }
    }
}
