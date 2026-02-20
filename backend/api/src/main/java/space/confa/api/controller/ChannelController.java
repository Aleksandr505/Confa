package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.CreateChannelDto;
import space.confa.api.model.dto.response.ChannelDto;
import space.confa.api.service.ChannelService;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelService channelService;

    @GetMapping("/workspaces/{workspaceId}/channels")
    public Flux<ChannelDto> getChannels(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long workspaceId
    ) {
        return channelService.getChannelsForWorkspace(getUserId(jwt), workspaceId);
    }

    @PostMapping("/workspaces/{workspaceId}/channels")
    public Mono<ChannelDto> createChannel(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long workspaceId,
            @Valid @RequestBody CreateChannelDto dto
    ) {
        return channelService.createChannel(getUserId(jwt), workspaceId, dto);
    }

    @GetMapping("/channels/{channelId}")
    public Mono<ChannelDto> getChannel(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long channelId
    ) {
        return channelService.getChannel(getUserId(jwt), channelId);
    }

    private long getUserId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
