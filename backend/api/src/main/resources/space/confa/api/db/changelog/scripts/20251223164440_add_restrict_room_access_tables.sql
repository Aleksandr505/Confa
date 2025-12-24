-- liquibase formatted sql
-- changeset Aleksandr505:20251223164440
-- comment: Tables for restrict access to rooms for owner and invited members

create table room
(
    id         bigint auto_increment primary key,
    name       varchar(255)              not null,
    owner_id   bigint                    not null,
    created_at timestamp  default CURRENT_TIMESTAMP null,
    updated_at timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint unique_room_name unique (name),
    constraint fk_room_owner foreign key (owner_id) references user (id)
) engine = InnoDB;

create table room_member
(
    id         bigint auto_increment primary key,
    room_id    bigint       not null,
    user_id    bigint       not null,
    role       enum('OWNER', 'MEMBER') not null,
    created_at timestamp default CURRENT_TIMESTAMP null,
    updated_at timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint unique_room_member unique (room_id, user_id),
    constraint fk_room_member_room foreign key (room_id) references room (id),
    constraint fk_room_member_user foreign key (user_id) references user (id)
) engine = InnoDB;

create index idx_room_member_user on room_member (user_id);

create table room_invite
(
    id          bigint auto_increment primary key,
    room_id     bigint       not null,
    token_hash  char(64)     not null,
    expires_at  timestamp    null,
    max_uses    int          default 1 not null,
    used_count  int          default 0 not null,
    created_by  bigint       not null,
    created_at  timestamp    default CURRENT_TIMESTAMP null,
    updated_at timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint unique_room_invite_token unique (token_hash),
    constraint fk_room_invite_room foreign key (room_id) references room (id),
    constraint fk_room_invite_creator foreign key (created_by) references user (id)
) engine = InnoDB;
