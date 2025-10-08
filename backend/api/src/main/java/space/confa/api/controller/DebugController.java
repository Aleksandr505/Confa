package space.confa.api.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.AuthDto;

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

}
