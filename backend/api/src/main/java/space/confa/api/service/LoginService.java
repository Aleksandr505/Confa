package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import space.confa.api.model.domain.UserStatus;
import space.confa.api.model.dto.request.AuthDto;
import space.confa.api.model.dto.response.TokenPairDto;
import space.confa.api.model.entity.UserEntity;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoginService {

    private final ReactiveAuthenticationManager reactiveAuthenticationManager;
    private final JWTService jwtService;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public Mono<TokenPairDto> authenticate(AuthDto authDto) {
        return userService.findAnyByUsername(authDto.username())
                .flatMap(user -> authenticateKnownUser(authDto, user))
                .switchIfEmpty(Mono.defer(() -> authenticateActiveUser(authDto)));
    }

    private Mono<TokenPairDto> authenticateKnownUser(AuthDto authDto, UserEntity user) {
        if (!passwordEncoder.matches(authDto.password(), user.getPassword())) {
            return Mono.error(authenticationFailed());
        }

        if (user.getStatus() == UserStatus.PENDING) {
            return Mono.error(new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Registration request is pending approval"
            ));
        }
        if (user.getStatus() == UserStatus.REJECTED) {
            return Mono.error(new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Registration request was rejected"
            ));
        }

        return authenticateActiveUser(authDto);
    }

    private Mono<TokenPairDto> authenticateActiveUser(AuthDto authDto) {
        var authenticationToken = new UsernamePasswordAuthenticationToken(authDto.username(), authDto.password());
        return reactiveAuthenticationManager.authenticate(authenticationToken)
                .cast(UsernamePasswordAuthenticationToken.class)
                .map(jwtService::generatePairJWT)
                .flatMap(pair -> Mono.just(new TokenPairDto(pair.access().getTokenValue(), pair.refresh().getTokenValue())))
                .doOnError(e -> log.error(e.getMessage(), e))
                .onErrorMap(throwable -> throwable instanceof ResponseStatusException
                        ? throwable
                        : authenticationFailed());
    }

    private ResponseStatusException authenticationFailed() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Authentication failed");
    }

    public Mono<String> refreshToken(String refreshToken) {
        var userId = userService.getUserIdFromToken(refreshToken);

        return userService.findById(userId)
                .map(user ->
                        jwtService.generateAccessJWT(
                                jwtService.getAuthJwtClaims(refreshToken),
                                jwtService.getAuthJwtSubject(refreshToken)
                        ).getTokenValue()
                );
    }
}
