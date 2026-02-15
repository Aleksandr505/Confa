package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.AcceptInviteDto;
import space.confa.api.model.dto.request.CreateInviteDto;
import space.confa.api.model.dto.response.WorkspaceInviteDto;
import space.confa.api.model.dto.response.WorkspaceDto;
import space.confa.api.service.WorkspaceInviteService;

@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceInviteController {

    private final WorkspaceInviteService workspaceInviteService;

    @PostMapping("/{workspaceId}/invites")
    public Mono<WorkspaceInviteDto> createInvite(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long workspaceId,
            @Valid @RequestBody(required = false) CreateInviteDto dto
    ) {
        return workspaceInviteService.createInvite(userId(jwt), workspaceId, dto);
    }

    @PostMapping("/invites/accept")
    public Mono<WorkspaceDto> acceptInvite(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AcceptInviteDto dto
    ) {
        return workspaceInviteService.acceptInvite(userId(jwt), dto);
    }

    private long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
