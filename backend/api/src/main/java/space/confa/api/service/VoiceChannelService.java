package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.VoiceChannelBindingRepository;
import space.confa.api.model.domain.ChannelType;
import space.confa.api.model.domain.VoiceChannelMode;
import space.confa.api.model.dto.response.LivekitTokenDto;
import space.confa.api.model.entity.VoiceChannelBindingEntity;

@Service
@RequiredArgsConstructor
public class VoiceChannelService {

    private final MessengerAccessService messengerAccessService;
    private final VoiceChannelBindingRepository voiceChannelBindingRepository;
    private final LivekitTokenService livekitTokenService;
    private final DatabaseClient databaseClient;

    public Mono<LivekitTokenDto> createTokenForChannel(Jwt jwt, Long channelId) {
        Long userId = Long.parseLong(jwt.getSubject());
        return messengerAccessService.getChannelForAccess(userId, channelId)
                .flatMap(channel -> {
                    if (channel.getType() != ChannelType.VOICE) {
                        return Mono.error(new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                "Channel is not voice"
                        ));
                    }
                    return voiceChannelBindingRepository.findByChannelId(channelId)
                            .switchIfEmpty(createDefaultBinding(channelId, userId))
                            .map(binding -> livekitTokenService.createTokenForRoom(jwt, binding.getLivekitRoomName()));
                });
    }

    private Mono<VoiceChannelBindingEntity> createDefaultBinding(Long channelId, Long userId) {
        String roomName = "voice-" + channelId;
        return databaseClient.sql("""
                        INSERT INTO voice_channel_binding (channel_id, livekit_room_name, mode, created_by_user_id)
                        VALUES (:channelId, :roomName, :mode, :userId)
                        ON DUPLICATE KEY UPDATE livekit_room_name = livekit_room_name
                        """)
                .bind("channelId", channelId)
                .bind("roomName", roomName)
                .bind("mode", VoiceChannelMode.PERMANENT.name())
                .bind("userId", userId)
                .then()
                .thenReturn(VoiceChannelBindingEntity.builder()
                        .channelId(channelId)
                        .livekitRoomName(roomName)
                        .mode(VoiceChannelMode.PERMANENT)
                        .createdByUserId(userId)
                        .build());
    }
}
