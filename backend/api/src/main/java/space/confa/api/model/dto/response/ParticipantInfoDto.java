package space.confa.api.model.dto.response;

import livekit.LivekitModels;

public record ParticipantInfoDto(
        String sid,
        String identity,
        String name,
        LivekitModels.ParticipantInfo.Kind kind,
        String metadata
) {}
