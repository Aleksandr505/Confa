package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.PlaySoundDto;
import space.confa.api.model.dto.request.ShareSoundDto;
import space.confa.api.model.dto.response.SoundClipDto;
import space.confa.api.service.SoundService;

@RestController
@RequestMapping("/api/sounds")
@RequiredArgsConstructor
public class SoundController {

    private final SoundService soundService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Mono<SoundClipDto> upload(
            @AuthenticationPrincipal Jwt jwt,
            @RequestPart("file") FilePart file,
            @RequestParam(required = false) String name,
            @RequestParam String roomName
    ) {
        return readBytes(file)
                .flatMap(bytes -> soundService.upload(
                        userId(jwt),
                        roomName,
                        name,
                        bytes,
                        file.headers().getContentType() == null
                                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                                : file.headers().getContentType().toString(),
                        file.filename()
                ));
    }

    @GetMapping("/room/{roomName}")
    public Flux<SoundClipDto> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String roomName
    ) {
        return soundService.listForRoom(userId(jwt), roomName);
    }

    @DeleteMapping("/{soundId}")
    @PreAuthorize("hasRole('ADMIN')")
    public Mono<Void> delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long soundId
    ) {
        return soundService.delete(userId(jwt), soundId);
    }

    @PostMapping("/{soundId}/share")
    public Mono<Void> share(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long soundId,
            @Valid @RequestBody ShareSoundDto dto
    ) {
        return soundService.share(userId(jwt), soundId, dto.targetRoomName());
    }

    @DeleteMapping("/{soundId}/share/{targetRoomName}")
    public Mono<Void> unshare(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long soundId,
            @PathVariable String targetRoomName
    ) {
        return soundService.unshare(userId(jwt), soundId, targetRoomName);
    }

    @PostMapping("/{soundId}/play")
    public Mono<Void> play(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long soundId,
            @Valid @RequestBody PlaySoundDto dto
    ) {
        return soundService.play(userId(jwt), soundId, dto.roomName());
    }

    @GetMapping("/content/{soundId}")
    public Mono<ResponseEntity<byte[]>> content(@PathVariable Long soundId) {
        return soundService.getSoundContent(soundId)
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
