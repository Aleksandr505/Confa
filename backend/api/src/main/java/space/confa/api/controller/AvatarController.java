package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import space.confa.api.model.domain.AvatarScopeType;
import space.confa.api.model.dto.request.ResolveAvatarsBatchDto;
import space.confa.api.model.dto.response.AvatarViewDto;
import space.confa.api.service.AvatarService;

import java.util.List;

@RestController
@RequestMapping("/api/avatars")
@RequiredArgsConstructor
public class AvatarController {

    private final AvatarService avatarService;

    @PutMapping(path = "/me", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Mono<AvatarViewDto> uploadMyAvatar(
            @AuthenticationPrincipal Jwt jwt,
            @RequestPart("file") FilePart file,
            @RequestParam(defaultValue = "GLOBAL") AvatarScopeType scopeType,
            @RequestParam(required = false) Long workspaceId,
            @RequestParam(required = false) String roomName
    ) {
        return readBytes(file)
                .flatMap(bytes -> avatarService.uploadAvatar(
                        userId(jwt),
                        scopeType,
                        workspaceId,
                        roomName,
                        bytes,
                        file.headers().getContentType() == null
                                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                                : file.headers().getContentType().toString(),
                        file.filename()
                ));
    }

    @GetMapping("/resolve")
    public Mono<AvatarViewDto> resolveSingle(
            @RequestParam Long userId,
            @RequestParam(required = false) Long workspaceId,
            @RequestParam(required = false) String roomName
    ) {
        return avatarService.resolveAvatar(userId, workspaceId, roomName);
    }

    @PostMapping("/resolve-batch")
    public Mono<List<AvatarViewDto>> resolveBatch(
            @Valid @RequestBody ResolveAvatarsBatchDto dto
    ) {
        return avatarService.resolveAvatarsBatch(dto.userIds(), dto.workspaceId(), dto.roomName());
    }

    @GetMapping("/content/{assetId}")
    public Mono<ResponseEntity<byte[]>> getAvatarContent(
            @PathVariable Long assetId
    ) {
        return avatarService.getAvatarContent(assetId)
                .map(content -> ResponseEntity.ok()
                        .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                        .contentType(MediaType.parseMediaType(content.contentType()))
                        .body(content.bytes()));
    }

    private Mono<byte[]> readBytes(FilePart filePart) {
        return DataBufferUtils.join(filePart.content())
                .map(buffer -> {
                    byte[] bytes = new byte[buffer.readableByteCount()];
                    buffer.read(bytes);
                    DataBufferUtils.release(buffer);
                    return bytes;
                });
    }

    private long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
