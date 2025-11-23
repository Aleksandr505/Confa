package space.confa.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import space.confa.api.model.dto.request.FocusAgentDto;
import space.confa.api.model.dto.request.InviteAgentDto;
import space.confa.api.model.dto.request.KickAgentDto;
import space.confa.api.model.dto.request.MuteAgentDto;
import space.confa.api.model.dto.response.AgentInfoDto;
import space.confa.api.service.AgentService;
import space.confa.api.service.RoomMetadataService;
import space.confa.api.service.RoomService;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/rooms/{room}/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final RoomMetadataService roomMetadataService;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/enable")
    public Mono<Void> enableAgents(
            @PathVariable String room,
            Principal principal
    ) {
        return Mono.fromRunnable(() -> roomMetadataService.enableAgents(room, principal.getName()));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/disable")
    public Mono<Void> disableAgents(
            @PathVariable String room,
            Principal principal
    ) {
        return Mono.fromRunnable(() -> roomMetadataService.disableAgents(room, principal.getName()));
    }

    @PostMapping("/invite")
    public void invite(
            @PathVariable String room,
            @RequestBody InviteAgentDto req
    ) {
        agentService.invite(room, req.requestedBy());
    }

    @PostMapping("/kick")
    public void remove(
            @PathVariable String room,
            @RequestBody KickAgentDto req
    ) {
        agentService.kick(room, req.agentIdentity());
    }

    @PostMapping("/mute")
    public void mute(
            @PathVariable String room,
            @RequestBody MuteAgentDto req
    ) {
        agentService.fullMute(room, req.agentSid(), req.isMuted());
    }

    @GetMapping
    public List<AgentInfoDto> getAgentsByRoom(@PathVariable String room) {
        return agentService.getAgentsByRoom(room);
    }

    @PostMapping("/focus")
    public void focusAgent(
            @PathVariable String room,
            @RequestBody FocusAgentDto req
    ) {
        agentService.focusAgent(room, req.activeAgentIdentity(), req.userIdentity());
    }
}
