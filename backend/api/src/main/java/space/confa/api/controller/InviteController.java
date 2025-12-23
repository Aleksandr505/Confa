package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.AcceptInviteDto;
import space.confa.api.model.dto.response.RoomAccessDto;
import space.confa.api.service.RoomAccessService;

@RestController
@RequestMapping("/invites")
@RequiredArgsConstructor
public class InviteController {

    private final RoomAccessService roomAccessService;

    @PostMapping("/accept")
    public Mono<RoomAccessDto> acceptInvite(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AcceptInviteDto dto
    ) {
        return roomAccessService.acceptInvite(userId(jwt), dto);
    }

    private long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
