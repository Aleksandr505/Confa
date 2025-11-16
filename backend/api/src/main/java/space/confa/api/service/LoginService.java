package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.AuthDto;
import space.confa.api.model.dto.response.TokenPairDto;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoginService {

    private final ReactiveAuthenticationManager reactiveAuthenticationManager;
    private final JWTService jwtService;
    private final UserService userService;

    public Mono<TokenPairDto> authenticate(AuthDto authDto) {
        var authenticationToken = new UsernamePasswordAuthenticationToken(authDto.username(), authDto.password());

        return reactiveAuthenticationManager.authenticate(authenticationToken)
                .cast(UsernamePasswordAuthenticationToken.class)
                .map(jwtService::generatePairJWT)
                .flatMap(pair -> Mono.just(new TokenPairDto(pair.access().getTokenValue(), pair.refresh().getTokenValue())))
                .doOnError(e -> log.error(e.getMessage(), e))
                .onErrorMap(throwable -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Authentication failed"));
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
