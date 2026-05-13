package space.confa.api.shared.mapper;

import lombok.experimental.UtilityClass;
import space.confa.api.model.dto.response.UserDto;
import space.confa.api.model.entity.UserEntity;

@UtilityClass
public class UserMapper {

    public UserDto mapToDto(UserEntity entity) {
        return new UserDto(
                entity.getId(),
                entity.getRole(),
                entity.getStatus(),
                entity.getUsername(),
                entity.getBlockedAt(),
                entity.getApprovedAt(),
                entity.getApprovedByUserId(),
                entity.getRejectedAt(),
                entity.getRejectedByUserId(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
