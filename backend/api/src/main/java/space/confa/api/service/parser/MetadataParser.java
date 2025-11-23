package space.confa.api.service.parser;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import space.confa.api.model.dto.response.AgentParticipantMetaDto;
import space.confa.api.model.dto.response.RoomMetadataDto;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class MetadataParser {

    private final ObjectMapper objectMapper;

    public AgentParticipantMetaDto parseAgentParticipantMeta(String raw) {
        if (raw == null || raw.isBlank()) {
            return new AgentParticipantMetaDto(false, null);
        }
        try {
            return objectMapper.readValue(raw, AgentParticipantMetaDto.class);
        } catch (IOException e) {
            return new AgentParticipantMetaDto(false, null);
        }
    }

    public RoomMetadataDto parseRoomMeta(String raw) {
        if (raw == null || raw.isBlank()) {
            return RoomMetadataDto.builder()
                    .isAgentsEnabled(false)
                    .build();
        }
        try {
            return objectMapper.readValue(raw, RoomMetadataDto.class);
        } catch (IOException e) {
            return RoomMetadataDto.builder()
                    .isAgentsEnabled(false)
                    .build();
        }
    }
}
