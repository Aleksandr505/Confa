package space.confa.api.model.dto.response;

public record AgentInfoDto(
        String sid,
        String identity,
        String name,
        boolean muted
) {}
