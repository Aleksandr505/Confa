package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import space.confa.api.configuration.properties.AppProp;
import space.confa.api.infrastructure.db.repository.WorkspaceInviteRepository;
import space.confa.api.infrastructure.db.repository.WorkspaceRepository;
import space.confa.api.model.dto.request.AcceptInviteDto;
import space.confa.api.model.dto.request.CreateInviteDto;
import space.confa.api.model.dto.response.WorkspaceInviteDto;
import space.confa.api.model.dto.response.WorkspaceDto;
import space.confa.api.model.entity.WorkspaceInviteEntity;
import space.confa.api.shared.mapper.MessengerMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkspaceInviteService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration DEFAULT_INVITE_TTL = Duration.ofDays(7);
    private static final int DEFAULT_INVITE_MAX_USES = 10;

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceInviteRepository workspaceInviteRepository;
    private final DatabaseClient databaseClient;
    private final AppProp appProp;

    @Transactional
    public Mono<WorkspaceInviteDto> createInvite(Long userId, Long workspaceId, CreateInviteDto dto) {
        return workspaceRepository.findById(workspaceId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found")))
                .flatMap(workspace -> {
                    if (!userId.equals(workspace.getOwnerUserId())) {
                        return Mono.error(new ResponseStatusException(
                                HttpStatus.FORBIDDEN,
                                "Only workspace owner can invite"
                        ));
                    }

                    String token = generateInviteToken();
                    String hashed = hashToken(token);

                    Instant expiresAt = dto != null && dto.ttlSeconds() != null
                            ? Instant.now().plusSeconds(dto.ttlSeconds())
                            : Instant.now().plus(DEFAULT_INVITE_TTL);

                    int maxUses = dto != null && dto.maxUses() != null
                            ? dto.maxUses()
                            : DEFAULT_INVITE_MAX_USES;

                    WorkspaceInviteEntity invite = WorkspaceInviteEntity.builder()
                            .workspaceId(workspaceId)
                            .tokenHash(hashed)
                            .expiresAt(expiresAt)
                            .maxUses(maxUses)
                            .usedCount(0)
                            .createdBy(userId)
                            .build();

                    return workspaceInviteRepository.save(invite)
                            .map(saved -> new WorkspaceInviteDto(
                                    token,
                                    buildInviteUrl(token),
                                    workspace.getId(),
                                    workspace.getName(),
                                    saved.getExpiresAt(),
                                    saved.getMaxUses(),
                                    saved.getUsedCount()
                            ));
                });
    }

    @Transactional
    public Mono<WorkspaceDto> acceptInvite(Long userId, AcceptInviteDto dto) {
        String tokenHash = hashToken(dto.token());

        return workspaceInviteRepository.findByTokenHash(tokenHash)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found")))
                .flatMap(invite -> {
                    if (invite.getExpiresAt() != null && Instant.now().isAfter(invite.getExpiresAt())) {
                        return Mono.error(new ResponseStatusException(HttpStatus.GONE, "Invite is expired"));
                    }
                    if (invite.getMaxUses() != null && invite.getUsedCount() != null
                            && invite.getUsedCount() >= invite.getMaxUses()) {
                        return Mono.error(new ResponseStatusException(HttpStatus.GONE, "Invite limit exceeded"));
                    }

                    return databaseClient.sql("""
                                    INSERT INTO workspace_member (workspace_id, user_id)
                                    VALUES (:workspaceId, :userId)
                                    ON DUPLICATE KEY UPDATE workspace_id = workspace_id
                                    """)
                            .bind("workspaceId", invite.getWorkspaceId())
                            .bind("userId", userId)
                            .then()
                            .then(workspaceInviteRepository.incrementUsage(invite.getId())
                                    .onErrorResume(e -> {
                                        log.warn("Failed to increment invite usage", e);
                                        return Mono.empty();
                                    }))
                            .then(workspaceRepository.findById(invite.getWorkspaceId()))
                            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace not found")))
                            .map(MessengerMapper::toWorkspaceDto);
                });
    }

    private String buildInviteUrl(String token) {
        if (appProp.clientBaseUrl() == null || appProp.clientBaseUrl().isBlank()) {
            return null;
        }

        String base = appProp.clientBaseUrl().replaceAll("/+$", "");
        return base + "/invite/" + token;
    }

    private String generateInviteToken() {
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
