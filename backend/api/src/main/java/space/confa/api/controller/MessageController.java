package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.CreateMessageDto;
import space.confa.api.model.dto.request.ReadChannelDto;
import space.confa.api.model.dto.request.ToggleReactionDto;
import space.confa.api.model.dto.request.UpdateMessageDto;
import space.confa.api.model.dto.response.MessageDto;
import space.confa.api.model.dto.response.MessagePageDto;
import space.confa.api.model.dto.response.MessageReactionDto;
import space.confa.api.model.dto.response.ReadStateDto;
import space.confa.api.service.MessageService;
import space.confa.api.service.ReadStateService;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final ReadStateService readStateService;

    @GetMapping("/channels/{channelId}/messages")
    public Mono<MessagePageDto> getMessages(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long channelId,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false) Integer limit
    ) {
        return messageService.getMessages(getUserId(jwt), channelId, cursor, limit);
    }

    @PostMapping("/channels/{channelId}/messages")
    public Mono<MessageDto> createMessage(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long channelId,
            @Valid @RequestBody CreateMessageDto dto
    ) {
        return messageService.createMessage(getUserId(jwt), channelId, dto);
    }

    @PatchMapping("/messages/{messageId}")
    public Mono<MessageDto> updateMessage(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long messageId,
            @Valid @RequestBody UpdateMessageDto dto
    ) {
        return messageService.updateMessage(getUserId(jwt), messageId, dto);
    }

    @DeleteMapping("/messages/{messageId}")
    public Mono<Void> deleteMessage(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long messageId
    ) {
        return messageService.deleteMessage(getUserId(jwt), messageId);
    }

    @GetMapping("/messages/{messageId}/reactions")
    public Mono<List<MessageReactionDto>> getMessageReactions(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long messageId
    ) {
        return messageService.getMessageReactions(getUserId(jwt), messageId);
    }

    @PostMapping("/messages/{messageId}/reactions")
    public Mono<List<MessageReactionDto>> addReaction(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long messageId,
            @Valid @RequestBody ToggleReactionDto dto
    ) {
        return messageService.addReaction(getUserId(jwt), messageId, dto.emoji());
    }

    @DeleteMapping("/messages/{messageId}/reactions/{emoji}")
    public Mono<List<MessageReactionDto>> removeReaction(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long messageId,
            @PathVariable String emoji
    ) {
        return messageService.removeReaction(getUserId(jwt), messageId, emoji);
    }

    @PostMapping("/channels/{channelId}/read")
    public Mono<ReadStateDto> updateReadState(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long channelId,
            @Valid @RequestBody ReadChannelDto dto
    ) {
        return readStateService.updateReadState(getUserId(jwt), channelId, dto.lastReadMessageId());
    }

    private long getUserId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
