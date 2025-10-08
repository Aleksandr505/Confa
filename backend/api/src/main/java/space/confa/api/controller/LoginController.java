package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import space.confa.api.model.domain.AppHttpHeader;
import space.confa.api.model.dto.request.AuthDto;
import space.confa.api.model.dto.response.TokenPairDto;
import space.confa.api.service.LoginService;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/auth")
public class LoginController {

    private final LoginService loginService;

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<ResponseEntity<Void>> authenticate(
            @Valid @RequestBody AuthDto authDto
    ) {
        return loginService.authenticate(authDto)
                .map(pair -> ResponseEntity.noContent()
                        .header(
                                AppHttpHeader.ACCESS_CONTROL_EXPOSE_HEADERS,
                                HttpHeaders.AUTHORIZATION,
                                AppHttpHeader.REFRESH_TOKEN
                        )
                        .header(HttpHeaders.AUTHORIZATION, pair.accessToken())
                        .header(AppHttpHeader.REFRESH_TOKEN, pair.refreshToken())
                        .build()
                );
    }

    @PostMapping(value = "/refresh", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<ResponseEntity<Void>> refreshToken(
            @Valid
            @RequestBody
            TokenPairDto tokenPairDto
    ) {
        return Mono.just(tokenPairDto)
                .flatMap(loginService::refreshToken)
                .map(freshToken -> ResponseEntity.noContent()
                        .header(
                                AppHttpHeader.ACCESS_CONTROL_EXPOSE_HEADERS,
                                HttpHeaders.AUTHORIZATION,
                                AppHttpHeader.REFRESH_TOKEN
                        )
                        .header(HttpHeaders.AUTHORIZATION, freshToken)
                        .build()
                );
    }
}
