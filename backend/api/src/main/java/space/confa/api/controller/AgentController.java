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
@RequestMapping("/agents")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;

    @PostMapping("/invite")
    public void invite(@RequestBody InviteAgentDto req) {
        agentService.invite(req.room(), req.requestedBy());
    }

    @PostMapping("/remove")
    public void remove(@RequestBody KickAgentDto req) {
        agentService.kick(req.room(), req.agentIdentity());
    }

    @PostMapping("/mute")
    public void mute(@RequestBody MuteAgentDto req) {
        agentService.fullMute(req.room(), req.agentSid(), true);
    }

    @PostMapping("/unmute")
    public void unmute(@RequestBody MuteAgentDto req) {
        agentService.fullMute(req.room(), req.agentSid(), false);
    }

    @GetMapping
    public List<AgentInfoDto> getAgentsByRoom(@RequestParam String room) {
        return agentService.getAgentsByRoom(room);
    }

    @PostMapping("/focus")
    public void focusAgent(
            @RequestBody FocusAgentDto req
    ) {
        agentService.focusAgent(req.room(), req.activeAgentIdentity(), req.userIdentity());
    }
}
