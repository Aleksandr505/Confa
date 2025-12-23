package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.CreateInviteDto;
import space.confa.api.model.dto.request.CreateRoomDto;
import space.confa.api.model.dto.response.RoomAccessDto;
import space.confa.api.model.dto.response.RoomInviteDto;
import space.confa.api.service.RoomAccessService;

@RestController
@RequestMapping("/rooms")
@RequiredArgsConstructor
public class RoomAccessController {

    private final RoomAccessService roomAccessService;

    @GetMapping("/my")
    public Flux<RoomAccessDto> getMyRooms(@AuthenticationPrincipal Jwt jwt) {
        return roomAccessService.getRoomsForUser(getUserId(jwt));
    }

    @PostMapping
    public Mono<RoomAccessDto> createRoom(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateRoomDto dto
    ) {
        return roomAccessService.createRoom(getUserId(jwt), dto);
    }

    @PostMapping("/{roomName}/invites")
    public Mono<RoomInviteDto> createInvite(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String roomName,
            @Valid @RequestBody(required = false) CreateInviteDto dto
    ) {
        return roomAccessService.createInvite(getUserId(jwt), roomName, dto);
    }

    private long getUserId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
