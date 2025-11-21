package space.confa.api.service;

import io.livekit.server.RoomServiceClient;
import livekit.LivekitModels;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import space.confa.api.model.dto.response.ParticipantInfoDto;
import space.confa.api.model.dto.response.RoomSummaryDto;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomServiceClient roomClient;

    public List<RoomSummaryDto> getActiveRooms() {
        try {
            var rooms = roomClient.listRooms(null).execute().body();
            if (rooms == null) {
                return List.of();
            }

            List<RoomSummaryDto> result = new ArrayList<>();

            for (var room : rooms) {
                if (room.getNumParticipants() <= 0) {
                    continue;
                }

                var participantsResp = getParticipantsByRoom(room.getName());
                if (participantsResp.isEmpty()) {
                    continue;
                }

                result.add(new RoomSummaryDto(
                        room.getSid(),
                        room.getName(),
                        room.getNumParticipants(),
                        room.getMetadata()
                ));
            }

            return result;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public List<ParticipantInfoDto> getParticipantsByRoom(String room) {
        try {
            List<LivekitModels.ParticipantInfo> infos = roomClient.listParticipants(room).execute().body();

            if (infos == null) {
                return List.of();
            }

            return infos.stream()
                    .map(p -> new ParticipantInfoDto(
                            p.getSid(),
                            p.getIdentity(),
                            p.getName(),
                            p.getKind(),
                            p.getMetadata()
                    ))
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
