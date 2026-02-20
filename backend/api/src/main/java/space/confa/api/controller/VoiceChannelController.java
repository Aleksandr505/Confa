package space.confa.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.response.LivekitTokenDto;
import space.confa.api.service.VoiceChannelService;

@RestController
@RequestMapping("/api/channels")
@RequiredArgsConstructor
public class VoiceChannelController {

    private final VoiceChannelService voiceChannelService;

    @PostMapping("/{channelId}/livekit-token")
    public Mono<LivekitTokenDto> createToken(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long channelId
    ) {
        return voiceChannelService.createTokenForChannel(jwt, channelId);
    }
}
