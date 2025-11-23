package space.confa.api.model.dto.response;

import lombok.Builder;

import java.time.Instant;

@Builder(toBuilder = true)
public record RoomMetadataDto(
        Boolean isAgentsEnabled,
        String enabledBy,
        Instant enabledAt,
        Integer maxAgents
) {}
