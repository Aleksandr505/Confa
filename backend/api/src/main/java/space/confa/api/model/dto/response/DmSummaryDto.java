package space.confa.api.model.dto.response;

public record DmSummaryDto(
        Long channelId,
        Long peerUserId,
        String peerUsername
) {}
