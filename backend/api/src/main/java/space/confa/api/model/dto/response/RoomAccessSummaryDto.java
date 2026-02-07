package space.confa.api.model.dto.response;

import space.confa.api.model.domain.RoomMemberRole;

import java.util.List;

public record RoomAccessSummaryDto(
        Long id,
        String name,
        RoomMemberRole role,
        Integer participantCount,
        List<String> participantNames
) {}
