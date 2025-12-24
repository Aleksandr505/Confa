package space.confa.api.model.dto.response;

import space.confa.api.model.domain.RoomMemberRole;

public record RoomAccessDto(
        Long id,
        String name,
        RoomMemberRole role
) {}
