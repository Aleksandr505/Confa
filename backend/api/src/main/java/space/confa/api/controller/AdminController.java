package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.CreateBootstrapDto;
import space.confa.api.model.dto.request.CreateUserDto;
import space.confa.api.model.dto.response.BootstrapDto;
import space.confa.api.model.dto.response.BootstrapStatusDto;
import space.confa.api.model.dto.response.UserDto;
import space.confa.api.service.UserService;

import java.security.Principal;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/admin")
public class AdminController {

    private final UserService userService;

    @GetMapping(value = "/bootstrap/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<BootstrapStatusDto> getBootstrapStatus() {
        return userService.getBootstrapStatus();
    }

    @PostMapping(value = "/bootstrap", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<BootstrapDto> bootstrapAdmin(
            @RequestBody @Valid CreateBootstrapDto createBootstrapDto
    ) {
        return userService.bootstrapAdmin(createBootstrapDto.serviceKey(), createBootstrapDto.username());
    }

    @GetMapping(value = "/users", produces = MediaType.APPLICATION_JSON_VALUE)
    public Flux<UserDto> getUsers() {
        return userService.getUsers();
    }

    @GetMapping(value = "/registration-requests", produces = MediaType.APPLICATION_JSON_VALUE)
    public Flux<UserDto> getRegistrationRequests() {
        return userService.getRegistrationRequests();
    }

    @PostMapping(value = "/users", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<UserDto> createUser(
            @Valid @RequestBody CreateUserDto dto
    ) {
        return userService.createUser(dto.username(), dto.password(), dto.role());
    }

    @PatchMapping(value = "/users/{id}/block", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<UserDto> blockUser(
            @PathVariable Long id
    ) {
        return userService.blockUser(id);
    }

    @PatchMapping(value = "/users/{id}/unblock", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<UserDto> unblockUser(
            @PathVariable Long id
    ) {
        return userService.unblockUser(id);
    }

    @PatchMapping(value = "/users/{id}/approve", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<UserDto> approveUser(
            @PathVariable Long id,
            Principal principal
    ) {
        return userService.approveUser(id, Long.parseLong(principal.getName()));
    }

    @PatchMapping(value = "/users/{id}/reject", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<UserDto> rejectUser(
            @PathVariable Long id,
            Principal principal
    ) {
        return userService.rejectUser(id, Long.parseLong(principal.getName()));
    }

    @DeleteMapping(value = "/users/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<Void> deleteUser(
            @PathVariable Long id
    ) {
        return userService.deleteUser(id);
    }
}
