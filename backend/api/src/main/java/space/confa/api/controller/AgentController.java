package space.confa.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import space.confa.api.model.dto.request.FocusAgentDto;
import space.confa.api.model.dto.request.InviteAgentDto;
import space.confa.api.model.dto.request.KickAgentDto;
import space.confa.api.model.dto.request.MuteAgentDto;
import space.confa.api.model.dto.response.AgentInfoDto;
import space.confa.api.service.AgentService;

import java.util.List;

@RestController
@RequestMapping("/rooms/{room}/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;

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
        agentService.fullMute(room, req.agentSid(), true);
    }

    @PostMapping("/unmute")
    public void unmute(
            @PathVariable String room,
            @RequestBody MuteAgentDto req
    ) {
        agentService.fullMute(room, req.agentSid(), false);
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
