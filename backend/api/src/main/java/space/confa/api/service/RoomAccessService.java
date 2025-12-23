package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.configuration.properties.AppProp;
import space.confa.api.infrastructure.db.repository.RoomInviteRepository;
import space.confa.api.infrastructure.db.repository.RoomMemberRepository;
import space.confa.api.infrastructure.db.repository.RoomRepository;
import space.confa.api.model.domain.RoomMemberRole;
import space.confa.api.model.dto.request.AcceptInviteDto;
import space.confa.api.model.dto.request.CreateInviteDto;
import space.confa.api.model.dto.request.CreateRoomDto;
import space.confa.api.model.dto.response.RoomAccessDto;
import space.confa.api.model.dto.response.RoomInviteDto;
import space.confa.api.model.entity.RoomEntity;
import space.confa.api.model.entity.RoomInviteEntity;
import space.confa.api.model.entity.RoomMemberEntity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomAccessService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration DEFAULT_INVITE_TTL = Duration.ofDays(7);
    private static final int DEFAULT_INVITE_MAX_USES = 10;

    private final RoomRepository roomRepository;
    private final RoomMemberRepository roomMemberRepository;
    private final RoomInviteRepository roomInviteRepository;
    private final DatabaseClient databaseClient;
    private final AppProp appProp;

    @Transactional
    public Mono<RoomAccessDto> createRoom(Long userId, CreateRoomDto dto) {
        String roomName = dto.name().trim();

        return roomRepository.existsByName(roomName)
                .filter(Boolean.FALSE::equals)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.CONFLICT, "Room already exists")))
                .flatMap(ignored -> roomRepository.save(
                        RoomEntity.builder()
                                .name(roomName)
                                .ownerId(userId)
                                .isPrivate(dto.isPrivate())
                                .build()
                ).flatMap(room -> roomMemberRepository.save(
                        RoomMemberEntity.builder()
                                .roomId(room.getId())
                                .userId(userId)
                                .role(RoomMemberRole.OWNER)
                                .build()
                        ).thenReturn(toAccessDto(room, RoomMemberRole.OWNER)))
                );
    }

    public Flux<RoomAccessDto> getRoomsForUser(Long userId) {
        return databaseClient.sql("""
                        SELECT r.id, r.name, r.is_private, rm.role
                        FROM room_member rm
                        JOIN room r ON r.id = rm.room_id
                        WHERE rm.user_id = :userId
                        ORDER BY r.created_at DESC
                        """)
                .bind("userId", userId)
                .map((row, metadata) -> new RoomAccessDto(
                        row.get("id", Long.class),
                        row.get("name", String.class),
                        RoomMemberRole.valueOf(Objects.requireNonNull(row.get("role", String.class))),
                        asBoolean(row.get("is_private"))
                ))
                .all();
    }

    public Mono<Void> checkUserCanJoin(Long userId, String roomName) {
        return roomRepository.findByName(roomName)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found")))
                .flatMap(room -> roomMemberRepository.findByRoomIdAndUserId(room.getId(), userId)
                        .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to room")))
                        .then());
    }

    @Transactional
    public Mono<RoomInviteDto> createInvite(Long userId, String roomName, CreateInviteDto dto) {
        return roomRepository.findByName(roomName)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found")))
                .flatMap(room -> roomMemberRepository.findByRoomIdAndUserId(room.getId(), userId)
                        .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to room")))
                        .flatMap(member -> {
                            if (member.getRole() != RoomMemberRole.OWNER) {
                                return Mono.error(new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Only owner can invite to the room"
                                ));
                            }

                            String token = generateInviteToken();
                            String hashed = hashToken(token);

                            Instant expiresAt;
                            if (dto != null && dto.ttlSeconds() != null) {
                                expiresAt = Instant.now().plusSeconds(dto.ttlSeconds());
                            } else {
                                expiresAt = Instant.now().plus(DEFAULT_INVITE_TTL);
                            }

                            int maxUses = dto != null && dto.maxUses() != null
                                    ? dto.maxUses()
                                    : DEFAULT_INVITE_MAX_USES;

                            RoomInviteEntity invite = RoomInviteEntity.builder()
                                    .roomId(room.getId())
                                    .tokenHash(hashed)
                                    .expiresAt(expiresAt)
                                    .maxUses(maxUses)
                                    .usedCount(0)
                                    .createdBy(userId)
                                    .build();

                            return roomInviteRepository.save(invite)
                                    .map(saved -> new RoomInviteDto(
                                            token,
                                            buildInviteUrl(token),
                                            room.getName(),
                                            saved.getExpiresAt(),
                                            saved.getMaxUses(),
                                            saved.getUsedCount()
                                    ));
                        }));
    }

    @Transactional
    public Mono<RoomAccessDto> acceptInvite(Long userId, AcceptInviteDto dto) {
        String tokenHash = hashToken(dto.token());

        return roomInviteRepository.findByTokenHash(tokenHash)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found")))
                .flatMap(invite -> {
                    if (invite.getExpiresAt() != null && Instant.now().isAfter(invite.getExpiresAt())) {
                        return Mono.error(new ResponseStatusException(HttpStatus.GONE, "Invite is expired"));
                    }
                    if (invite.getMaxUses() != null && invite.getUsedCount() != null
                            && invite.getUsedCount() >= invite.getMaxUses()) {
                        return Mono.error(new ResponseStatusException(HttpStatus.GONE, "Invite limit exceeded"));
                    }

                    return roomMemberRepository.findByRoomIdAndUserId(invite.getRoomId(), userId)
                            .flatMap(member -> ensureMemberAndBuildResponse(invite, member, false))
                            .switchIfEmpty(Mono.defer(() -> ensureMemberAndBuildResponse(
                                    invite,
                                    RoomMemberEntity.builder()
                                            .roomId(invite.getRoomId())
                                            .userId(userId)
                                            .role(RoomMemberRole.MEMBER)
                                            .build(),
                                    true
                            )));
                });
    }

    private String buildInviteUrl(String token) {
        if (appProp.clientBaseUrl() == null || appProp.clientBaseUrl().isBlank()) {
            return null;
        }

        String base = appProp.clientBaseUrl().replaceAll("/+$", "");
        return base + "/invite/" + token;
    }

    private RoomAccessDto toAccessDto(RoomEntity room, RoomMemberRole role) {
        return new RoomAccessDto(room.getId(), room.getName(), role, Boolean.TRUE.equals(room.getIsPrivate()));
    }

    private Mono<RoomAccessDto> ensureMemberAndBuildResponse(RoomInviteEntity invite, RoomMemberEntity member, boolean incrementUsage) {
        Mono<RoomMemberEntity> ensureMember = member.getId() == null
                ? roomMemberRepository.save(member)
                : Mono.just(member);

        Mono<Integer> usageUpdate = incrementUsage
                ? roomInviteRepository.incrementUsage(invite.getId())
                .onErrorResume(e -> {
                    log.warn("Failed to increment invite usage", e);
                    return Mono.empty();
                })
                : Mono.empty();

        return ensureMember.flatMap(savedMember ->
                usageUpdate.then(roomRepository.findById(invite.getRoomId()))
                        .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found")))
                        .map(room -> toAccessDto(room, savedMember.getRole()))
        );
    }

    private String generateInviteToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private boolean asBoolean(Object value) {
        if (value instanceof Boolean b) {
            return b;
        }
        if (value instanceof Number n) {
            return n.intValue() != 0;
        }
        return false;
    }
}
