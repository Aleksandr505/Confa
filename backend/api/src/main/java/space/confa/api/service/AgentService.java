package space.confa.api.service;

import io.livekit.server.AgentDispatchServiceClient;
import io.livekit.server.RoomServiceClient;
import livekit.LivekitModels;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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

    public void invite(String room, String by) {
        try {
            var dispatch = agentDispatchClient.createDispatch(
                    room,
                    "Agent",
                    "{\"agentEnabled\":true,\"agentRequestedBy\":\""+by+"\"}").execute().body();
            log.info("Agent invited to room " + dispatch);

            var list = agentDispatchClient.listDispatch(room).execute().body();
            log.info("Dispatch list: " + list);
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

    public void fullMute(String room, String agentIdentity, boolean muted) {
        try {
            var payload = ("{\"topic\":\"control.muted\",\"value\":" + muted + "}").getBytes(StandardCharsets.UTF_8);
            roomClient.sendData(room, payload, LivekitModels.DataPacket.Kind.RELIABLE, List.of(agentIdentity))
                    .execute();

            roomClient.updateRoomMetadata(room, "{\"agentMuted\":" + muted + "}")
                    .execute();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

