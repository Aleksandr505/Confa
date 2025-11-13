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

    public Mono<LivekitTokenDto> createTokenForUser(Jwt userJwt, CreateLivekitTokenDto dto) {
        AccessToken token = new AccessToken(props.apiKey(), props.apiSecret());

        if (dto.displayName() != null) {
            token.setName(dto.displayName());
        }
        token.setIdentity(userJwt.getSubject());
        token.addGrants(
                new RoomJoin(true),
                new CanPublish(true),
                new CanSubscribe(true),
                new RoomName(dto.room() != null ? dto.room() : defaultRoom()),
                new CanPublishSources(List.of("microphone","camera"))
        );
        token.setTtl(600L);

        return Mono.just(new LivekitTokenDto(token.toJwt()));
    }

    private String defaultRoom() {
        return props.defaultRoom() != null ? props.defaultRoom() : "demo";
    }
}
