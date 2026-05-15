package space.confa.api.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.CreateMessageDto;
import space.confa.api.model.dto.response.MessageDto;
import space.confa.api.model.dto.response.MessagePageDto;
import space.confa.api.service.MessageService;

@RestController
@RequestMapping("/rooms/{roomName}/messages")
@RequiredArgsConstructor
public class RoomMessageController {

    private final MessageService messageService;

    @GetMapping
    public Mono<MessagePageDto> getRoomMessages(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String roomName,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false) Integer limit
    ) {
        return messageService.getRoomMessages(userId(jwt), roomName, cursor, limit);
    }

    @PostMapping
    public Mono<MessageDto> createRoomMessage(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String roomName,
            @Valid @RequestBody CreateMessageDto dto
    ) {
        return messageService.createRoomMessage(userId(jwt), roomName, dto);
    }

    private long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}
