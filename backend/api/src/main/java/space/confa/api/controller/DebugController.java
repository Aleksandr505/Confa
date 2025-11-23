package space.confa.api.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.AuthDto;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/debug")
@Profile("local")
public class DebugController {

    private final PasswordEncoder passwordEncoder;

    @PostMapping(value = "/password/encode", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<String> generateEncodedPassword(
            @RequestBody AuthDto authDto
    ) {
        return Mono.just(passwordEncoder.encode(authDto.password()));
    }

    @GetMapping("/me")
    public Mono<Map<String, Object>> me(Authentication auth) {
        if (auth == null) {
            return Mono.just(Map.of("authenticated", false));
        }
        return Mono.just(Map.of(
                "name", auth.getName(),
                "authorities", auth.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .toList()
        ));
    }

}
