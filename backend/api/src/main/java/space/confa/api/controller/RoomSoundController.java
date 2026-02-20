package space.confa.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import space.confa.api.model.dto.response.SoundClipDto;
import space.confa.api.service.SoundService;
import reactor.core.publisher.Mono;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomSoundController {

    private final SoundService soundService;

    @GetMapping(value = "/{roomName}/sounds", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<List<SoundClipDto>> listRoomSounds(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String roomName
    ) {
        return soundService.listForRoom(Long.parseLong(jwt.getSubject()), roomName).collectList();
    }

    @GetMapping(value = "/{roomName}/sounds/available", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<List<SoundClipDto>> listAvailableRoomSounds(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String roomName
    ) {
        return soundService.listAvailableForRoom(Long.parseLong(jwt.getSubject()), roomName).collectList();
    }
}
