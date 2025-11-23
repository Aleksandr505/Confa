package space.confa.api.service;

import io.livekit.server.AgentDispatchServiceClient;
import io.livekit.server.RoomServiceClient;
import livekit.LivekitModels;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import space.confa.api.model.dto.response.AgentInfoDto;
import space.confa.api.model.dto.response.AgentParticipantMetaDto;
import space.confa.api.service.parser.MetadataParser;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentService {

    private final RoomServiceClient roomClient;
    private final AgentDispatchServiceClient agentDispatchClient;

    private final RoomMetadataService roomMetadataService;
    private final MetadataParser metadataParser;

    public void invite(String room, String agentRole) {
        var meta = roomMetadataService.getRoomMetadata(room);
        if (!Boolean.TRUE.equals(meta.isAgentsEnabled())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Agent feature is disabled in this room"
            );
        }

        try {
            agentDispatchClient.createDispatch(room, "Agent", "{\"role\":\""+agentRole+"\"}")
                    .execute();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void kick(String room, String identity) {
        try {
            roomClient.removeParticipant(room, identity).execute();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void fullMute(String room, String agentSid, boolean muted) {
        try {
            var payload = ("{\"topic\":\"control.muted\",\"value\":" + muted + "}").getBytes(StandardCharsets.UTF_8);
            roomClient.sendData(room, payload, LivekitModels.DataPacket.Kind.RELIABLE, List.of(agentSid))
                    .execute();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public List<AgentInfoDto> getAgentsByRoom(String room) {
        try {
            List<LivekitModels.ParticipantInfo> infos = roomClient.listParticipants(room).execute().body();

            if (infos == null) {
                return List.of();
            }

            return infos.stream()
                    .filter(p -> p.getIdentity().startsWith("agent-"))
                    .map(p -> {
                        AgentParticipantMetaDto meta = metadataParser.parseAgentParticipantMeta(p.getMetadata());
                        return new AgentInfoDto(
                                p.getSid(),
                                p.getIdentity(),
                                p.getName(),
                                meta.isMuted()
                        );
                    })
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void focusAgent(String room, String activeAgentIdentity, String userIdentity) {
        try {
            List<LivekitModels.ParticipantInfo> infos = roomClient.listParticipants(room).execute().body();
            if (infos == null) {
                return;
            }

            for (var p : infos) {
                if (!p.getIdentity().startsWith("agent-")) {
                    continue;
                }

                boolean isActive = p.getIdentity().equals(activeAgentIdentity);
                fullMute(room, p.getSid(), !isActive);
            }

            String activeAgentSid = findParticipantSidByIdentity(room, activeAgentIdentity);
            if (activeAgentSid == null) {
                return;
            }

            var payload = ("{\"topic\":\"control.set_target\",\"value\":\"" + userIdentity + "\"}").getBytes(StandardCharsets.UTF_8);
            roomClient.sendData(room, payload, LivekitModels.DataPacket.Kind.RELIABLE, List.of(activeAgentSid))
                    .execute();


           /* String metaJson = """
          {
            "activeAgentIdentity":"%s",
            "agentListeningUser":"%s"
          }
          """.formatted(activeAgentIdentity, userIdentity);
            roomClient.updateRoomMetadata(room, metaJson).execute();*/

        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private String findParticipantSidByIdentity(String room, String identity) {
        try {
            List<LivekitModels.ParticipantInfo> infos = roomClient.listParticipants(room).execute().body();
            if (infos == null) {
                return null;
            }

            return infos.stream()
                    .filter(p -> p.getIdentity().equals(identity))
                    .map(LivekitModels.ParticipantInfo::getSid)
                    .findFirst()
                    .orElse(null);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

