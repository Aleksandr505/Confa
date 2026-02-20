package space.confa.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import space.confa.api.infrastructure.db.repository.ChannelRepository;
import space.confa.api.model.domain.ChannelType;
import space.confa.api.model.dto.request.CreateChannelDto;
import space.confa.api.model.dto.response.ChannelDto;
import space.confa.api.model.entity.ChannelEntity;
import space.confa.api.shared.mapper.MessengerMapper;

@Service
@RequiredArgsConstructor
public class ChannelService {

    private final ChannelRepository channelRepository;
    private final MessengerAccessService messengerAccessService;

    public Flux<ChannelDto> getChannelsForWorkspace(Long userId, Long workspaceId) {
        return messengerAccessService.ensureWorkspaceMember(userId, workspaceId)
                .thenMany(channelRepository.findAllByWorkspaceIdOrderByPositionAsc(workspaceId))
                .map(MessengerMapper::toChannelDto);
    }

    @Transactional
    public Mono<ChannelDto> createChannel(Long userId, Long workspaceId, CreateChannelDto dto) {
        if (dto.type() == ChannelType.DM) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "DM channel cannot be created here"));
        }

        String name = dto.name().trim();
        int position = dto.position() != null ? dto.position() : 0;
        boolean isPrivate = dto.isPrivate() != null && dto.isPrivate();

        return messengerAccessService.ensureWorkspaceMember(userId, workspaceId)
                .then(channelRepository.save(ChannelEntity.builder()
                        .workspaceId(workspaceId)
                        .type(dto.type())
                        .name(name)
                        .topic(dto.topic())
                        .isPrivate(isPrivate)
                        .position(position)
                        .createdByUserId(userId)
                        .build()))
                .map(MessengerMapper::toChannelDto);
    }

    public Mono<ChannelDto> getChannel(Long userId, Long channelId) {
        return messengerAccessService.getChannelForAccess(userId, channelId)
                .map(MessengerMapper::toChannelDto);
    }
}
