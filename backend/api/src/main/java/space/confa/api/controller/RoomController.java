package space.confa.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import space.confa.api.model.dto.response.ParticipantInfoDto;
import space.confa.api.model.dto.response.RoomSummaryDto;
import space.confa.api.service.RoomService;

import java.util.List;

@RestController
@RequestMapping("/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @GetMapping
    public List<RoomSummaryDto> getActiveRooms() {
        return roomService.getActiveRooms();
    }

    @GetMapping("/{room}/participants")
    public List<ParticipantInfoDto> getParticipantsByRoom(@PathVariable String room) {
        return roomService.getParticipantsByRoom(room);
    }
}
