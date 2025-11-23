package space.confa.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.livekit.server.RoomServiceClient;
import livekit.LivekitModels;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import space.confa.api.model.dto.response.RoomMetadataDto;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RoomMetadataService {

    private final RoomServiceClient roomClient;
    private final ObjectMapper objectMapper;

    public RoomMetadataDto getRoomMetadata(String room) {
        try {
            var rooms = roomClient.listRooms(List.of(room)).execute().body();
            if (rooms == null || rooms.isEmpty()) {
                return new RoomMetadataDto(false, null, null, 1);
            }

            return Optional.ofNullable(rooms.getFirst())
                    .map(LivekitModels.Room::getMetadata)
                    .map(meta -> {
                        try {
                            return objectMapper.readValue(meta, RoomMetadataDto.class);
                        } catch (JsonProcessingException e) {
                            return null;
                        }
                    })
                    .orElse(new RoomMetadataDto(false, null, null, 1));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void enableAgents(String room, String adminUsername) {
        RoomMetadataDto meta = getRoomMetadata(room)
                .toBuilder()
                .isAgentsEnabled(true)
                .enabledBy(adminUsername)
                .enabledAt(Instant.now())
                .build();
        updateRoomMetadata(room, meta);
    }

    public void disableAgents(String room, String adminUsername) {
        RoomMetadataDto meta = getRoomMetadata(room)
                .toBuilder()
                .isAgentsEnabled(false)
                .enabledBy(adminUsername)
                .enabledAt(Instant.now())
                .build();
        updateRoomMetadata(room, meta);
    }

    private void updateRoomMetadata(String room, RoomMetadataDto dto) {
        try {
            String json = objectMapper.writeValueAsString(dto);
            roomClient.updateRoomMetadata(room, json).execute();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
