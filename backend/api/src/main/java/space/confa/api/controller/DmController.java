package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.CreateMessageDto;
import space.confa.api.model.dto.response.ChannelDto;
import space.confa.api.model.dto.response.DmSummaryDto;
import space.confa.api.model.dto.response.MessageDto;
import space.confa.api.model.dto.response.MessagePageDto;
import space.confa.api.service.DmService;
import space.confa.api.service.MessageService;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DmController {

    private final DmService dmService;
    private final MessageService messageService;

    @GetMapping("/dms")
    public Flux<DmSummaryDto> getDms(@AuthenticationPrincipal Jwt jwt) {
        return dmService.getDmList(getUserId(jwt));
    }

    @PostMapping("/dm/{peerId}")
    public Mono<ChannelDto> getOrCreateDm(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long peerId
    ) {
        return dmService.getOrCreateDm(getUserId(jwt), peerId);
    }

    @GetMapping("/dm/{peerId}/messages")
    public Mono<MessagePageDto> getDmMessages(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long peerId,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false) Integer limit
    ) {
        long userId = getUserId(jwt);
        return dmService.getExistingDmChannelId(userId, peerId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "DM not found")))
                .flatMap(channelId -> messageService.getMessages(userId, channelId, cursor, limit));
    }

    @PostMapping("/dm/{peerId}/messages")
    public Mono<MessageDto> createDmMessage(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long peerId,
            @Valid @RequestBody CreateMessageDto dto
    ) {
        long userId = getUserId(jwt);
        return dmService.getOrCreateDm(userId, peerId)
                .flatMap(channel -> messageService.createMessage(userId, channel.id(), dto));
    }

    private long getUserId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
