package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.WorkspaceMemberRepository;
import space.confa.api.infrastructure.db.repository.WorkspaceRepository;
import space.confa.api.model.dto.request.CreateWorkspaceDto;
import space.confa.api.model.dto.response.WorkspaceDto;
import space.confa.api.model.entity.WorkspaceEntity;
import space.confa.api.model.entity.WorkspaceMemberEntity;
import space.confa.api.shared.mapper.MessengerMapper;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final DatabaseClient databaseClient;

    public Flux<WorkspaceDto> getWorkspacesForUser(Long userId) {
        return databaseClient.sql("""
                        SELECT w.id, w.name, w.slug, w.owner_user_id, w.created_at
                        FROM workspace_member wm
                        JOIN workspace w ON w.id = wm.workspace_id
                        WHERE wm.user_id = :userId
                        ORDER BY w.created_at DESC
                        """)
                .bind("userId", userId)
                .map((row, metadata) -> new WorkspaceDto(
                        row.get("id", Long.class),
                        row.get("name", String.class),
                        row.get("slug", String.class),
                        row.get("owner_user_id", Long.class),
                        row.get("created_at", java.time.Instant.class)
                ))
                .all();
    }

    @Transactional
    public Mono<WorkspaceDto> createWorkspace(Long userId, CreateWorkspaceDto dto) {
        String name = dto.name().trim();
        String slug = dto.slug().trim();

        return workspaceRepository.existsBySlug(slug)
                .filter(Boolean.FALSE::equals)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.CONFLICT, "Workspace slug exists")))
                .flatMap(ignored -> workspaceRepository.save(
                        WorkspaceEntity.builder()
                                .name(name)
                                .slug(slug)
                                .ownerUserId(userId)
                                .build()
                ).flatMap(workspace -> workspaceMemberRepository.save(
                        WorkspaceMemberEntity.builder()
                                .workspaceId(workspace.getId())
                                .userId(userId)
                                .build()
                ).thenReturn(MessengerMapper.toWorkspaceDto(workspace))));
    }
}
