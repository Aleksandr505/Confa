package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.ChannelMemberRepository;
import space.confa.api.infrastructure.db.repository.ChannelRepository;
import space.confa.api.infrastructure.db.repository.WorkspaceMemberRepository;
import space.confa.api.model.domain.ChannelType;
import space.confa.api.model.entity.ChannelEntity;

@Service
@RequiredArgsConstructor
public class MessengerAccessService {

    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final ChannelMemberRepository channelMemberRepository;
    private final ChannelRepository channelRepository;

    public Mono<Void> ensureWorkspaceMember(Long userId, Long workspaceId) {
        return workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, userId)
                .filter(Boolean.TRUE::equals)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to workspace")))
                .then();
    }

    public Mono<ChannelEntity> getChannelForAccess(Long userId, Long channelId) {
        return channelRepository.findById(channelId)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found")))
                .flatMap(channel -> {
                    if (channel.getType() == ChannelType.DM) {
                        return channelMemberRepository.existsByChannelIdAndUserId(channelId, userId)
                                .filter(Boolean.TRUE::equals)
                                .switchIfEmpty(Mono.error(new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "No access to channel"
                                )))
                                .thenReturn(channel);
                    }

                    return ensureWorkspaceMember(userId, channel.getWorkspaceId())
                            .then(Mono.defer(() -> {
                                if (Boolean.TRUE.equals(channel.getIsPrivate())) {
                                    return channelMemberRepository.existsByChannelIdAndUserId(channelId, userId)
                                            .filter(Boolean.TRUE::equals)
                                            .switchIfEmpty(Mono.error(new ResponseStatusException(
                                                    HttpStatus.FORBIDDEN,
                                                    "No access to channel"
                                            )))
                                            .thenReturn(channel);
                                }
                                return Mono.just(channel);
                            }));
                });
    }
}
