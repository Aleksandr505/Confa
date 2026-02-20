package space.confa.api.service;

import io.livekit.server.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import space.confa.api.configuration.properties.LivekitProp;
import space.confa.api.model.dto.request.CreateLivekitTokenDto;
import space.confa.api.model.dto.response.LivekitTokenDto;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class LivekitTokenService {

    private final LivekitProp props;
    private final RoomAccessService roomAccessService;

    public Mono<LivekitTokenDto> createTokenForUser(Jwt userJwt, CreateLivekitTokenDto dto) {
        String roomName = dto.room() != null ? dto.room() : defaultRoom();
        long userId = Long.parseLong(userJwt.getSubject());

        return roomAccessService.checkUserCanJoin(userId, roomName)
                .then(Mono.fromSupplier(() -> buildToken(userJwt, roomName, dto.displayName())));
    }

    public LivekitTokenDto createTokenForRoom(Jwt userJwt, String roomName) {
        return buildToken(userJwt, roomName, null);
    }

    private LivekitTokenDto buildToken(Jwt userJwt, String roomName, String displayName) {
        AccessToken token = new AccessToken(props.apiKey(), props.apiSecret());

        if (displayName != null) {
            token.setName(displayName);
        }
        token.setIdentity(userJwt.getSubject());
        token.addGrants(
                new RoomJoin(true),
                new CanPublish(true),
                new CanSubscribe(true),
                new RoomName(roomName),
                new CanPublishSources(List.of("microphone", "camera", "screen_share", "screen_share_audio"))
        );
        token.setTtl(600L);
        return new LivekitTokenDto(token.toJwt());
    }

    private String defaultRoom() {
        return props.defaultRoom() != null ? props.defaultRoom() : "demo";
    }
}
