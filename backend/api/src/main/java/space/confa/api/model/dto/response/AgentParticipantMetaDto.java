package space.confa.api.model.dto.response;

public record AgentParticipantMetaDto(
        Boolean isMuted,
        String invitedBy
) {}
