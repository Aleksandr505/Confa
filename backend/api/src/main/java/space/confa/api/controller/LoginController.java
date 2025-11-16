package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import space.confa.api.configuration.properties.JWTProp;
import space.confa.api.model.domain.AppHttpHeader;
import space.confa.api.model.dto.request.AuthDto;
import space.confa.api.model.dto.response.TokenPairDto;
import space.confa.api.service.LoginService;

import java.time.Duration;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/auth")
public class LoginController {

    private final LoginService loginService;
    private final JWTProp jwtProp;

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<ResponseEntity<Void>> authenticate(
            @Valid @RequestBody AuthDto authDto
    ) {
        return loginService.authenticate(authDto)
                .map(pair -> {
                    ResponseCookie refreshCookie = ResponseCookie
                            .from("refresh_token", pair.refreshToken())
                            .httpOnly(true)
                            .secure(true)
                            .sameSite("Strict")
                            .path("/auth")
                            .maxAge(Duration.parse(jwtProp.refreshExpiration()))
                            .build();

                    return ResponseEntity.noContent()
                            .header(HttpHeaders.AUTHORIZATION, pair.accessToken())
                            .header(AppHttpHeader.ACCESS_CONTROL_EXPOSE_HEADERS, HttpHeaders.AUTHORIZATION)
                            .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                            .build();
                });
    }

    @PostMapping(value = "/refresh", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<ResponseEntity<Void>> refreshToken(
            @CookieValue("refresh_token") String refreshToken
    ) {
        return loginService.refreshToken(refreshToken)
                .map(freshToken -> ResponseEntity.noContent()
                        .header(
                                AppHttpHeader.ACCESS_CONTROL_EXPOSE_HEADERS,
                                HttpHeaders.AUTHORIZATION
                        )
                        .header(HttpHeaders.AUTHORIZATION, freshToken)
                        .build()
                );
    }
}
