package space.confa.api.model.dto.request;

public record FocusAgentDto(
        String room,
        String activeAgentIdentity,
        String userIdentity
) {
}
