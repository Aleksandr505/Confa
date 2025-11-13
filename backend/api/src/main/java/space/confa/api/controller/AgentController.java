package space.confa.api.controller;


import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import space.confa.api.model.dto.request.InviteAgentDto;
import space.confa.api.model.dto.request.TargetAgentDto;
import space.confa.api.service.AgentService;

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
    public void remove(@RequestBody TargetAgentDto req) {
        agentService.kick(req.room(), req.agentIdentity());
    }

    @PostMapping("/mute")
    public void mute(@RequestBody TargetAgentDto req) {
        agentService.fullMute(req.room(), req.agentIdentity(), true);
    }

    @PostMapping("/unmute")
    public void unmute(@RequestBody TargetAgentDto req) {
        agentService.fullMute(req.room(), req.agentIdentity(), false);
    }
}
