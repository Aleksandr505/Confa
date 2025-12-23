package space.confa.api.model.dto.request;

import jakarta.validation.constraints.Positive;

public record CreateInviteDto(
        @Positive(message = "TTL should be positive")
        Long ttlSeconds,
        @Positive(message = "maxUses should be positive")
        Integer maxUses
) {}
