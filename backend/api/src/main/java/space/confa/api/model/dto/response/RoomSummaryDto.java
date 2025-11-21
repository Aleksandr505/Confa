package space.confa.api.model.dto.response;

public record RoomSummaryDto(
        String sid,
        String name,
        Integer numParticipants,
        String metadata
) {}
