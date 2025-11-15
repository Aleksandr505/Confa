package space.confa.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import space.confa.api.model.dto.response.ParticipantInfoDto;
import space.confa.api.service.AgentService;

import java.util.List;

@RestController
@RequestMapping("/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final AgentService agentService;

    @GetMapping("/participants")
    public List<ParticipantInfoDto> getParticipantsByRoom(@RequestParam String room) {
        return agentService.getParticipantsByRoom(room);
    }
}
