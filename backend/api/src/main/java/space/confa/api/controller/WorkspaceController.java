package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.CreateWorkspaceDto;
import space.confa.api.model.dto.response.WorkspaceDto;
import space.confa.api.model.dto.response.WorkspaceUserDto;
import space.confa.api.service.WorkspaceService;

@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    @GetMapping
    public Flux<WorkspaceDto> getMyWorkspaces(@AuthenticationPrincipal Jwt jwt) {
        return workspaceService.getWorkspacesForUser(getUserId(jwt));
    }

    @PostMapping
    public Mono<WorkspaceDto> createWorkspace(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateWorkspaceDto dto
    ) {
        return workspaceService.createWorkspace(getUserId(jwt), dto);
    }

    @GetMapping("/{workspaceId}/members")
    public Flux<WorkspaceUserDto> getWorkspaceMembers(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long workspaceId
    ) {
        return workspaceService.getWorkspaceUsers(getUserId(jwt), workspaceId);
    }

    private long getUserId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
