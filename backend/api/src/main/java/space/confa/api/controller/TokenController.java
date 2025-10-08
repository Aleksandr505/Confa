package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.CreateLivekitTokenDto;
import space.confa.api.model.dto.response.LivekitTokenDto;
import space.confa.api.service.LivekitTokenService;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/livekit")
public class TokenController {

    private final LivekitTokenService livekitTokenService;

    @PostMapping(value = "/token", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<LivekitTokenDto> createToken(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateLivekitTokenDto dto
    ) {
        return livekitTokenService.createToken(jwt, dto);
    }
}
