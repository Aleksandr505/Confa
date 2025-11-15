package space.confa.api.model.dto.request;

public record MuteAgentDto(
        String room,
        String agentSid
) {}
