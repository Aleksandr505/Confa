package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.CreateUserDto;
import space.confa.api.service.UserService;

@Slf4j
@RestController
@Profile("local")
@RequiredArgsConstructor
@RequestMapping("/admin")
public class AdminController {

    private final UserService userService;

    @PostMapping(value = "/users/create", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<String> createUser(
            @Valid @RequestBody CreateUserDto createUserDto
    ) {
        return userService.createUserByAdmin(createUserDto.username());
    }
}
