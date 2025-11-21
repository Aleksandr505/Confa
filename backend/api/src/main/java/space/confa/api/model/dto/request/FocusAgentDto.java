package space.confa.api.model.dto.request;

public record FocusAgentDto(
        String activeAgentIdentity,
        String userIdentity
) {
}
