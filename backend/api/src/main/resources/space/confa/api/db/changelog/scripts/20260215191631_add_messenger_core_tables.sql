-- liquibase formatted sql
-- changeset Aleksandr505:20260215191631
-- comment: base app shell structure

create table workspace
(
    id             bigint auto_increment primary key,
    name           varchar(255)              not null,
    slug           varchar(128)              not null,
    owner_user_id  bigint                    not null,
    created_at     timestamp default CURRENT_TIMESTAMP null,
    updated_at     timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint unique_workspace_slug unique (slug),
    constraint fk_workspace_owner foreign key (owner_user_id) references user (id)
) engine = InnoDB;

create table workspace_member
(
    id            bigint auto_increment primary key,
    workspace_id  bigint                    not null,
    user_id       bigint                    not null,
    joined_at     timestamp default CURRENT_TIMESTAMP null,
    constraint unique_workspace_member unique (workspace_id, user_id),
    constraint fk_workspace_member_workspace foreign key (workspace_id) references workspace (id),
    constraint fk_workspace_member_user foreign key (user_id) references user (id)
) engine = InnoDB;

create index idx_workspace_member_user on workspace_member (user_id);

create table channel
(
    id                 bigint auto_increment primary key,
    workspace_id       bigint                    null,
    type               enum('TEXT','VOICE','DM') not null,
    name               varchar(255)              null,
    topic              varchar(255)              null,
    is_private         tinyint(1) default 0      not null,
    position           int default 0             not null,
    created_by_user_id bigint                    not null,
    created_at         timestamp default CURRENT_TIMESTAMP null,
    updated_at         timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint fk_channel_workspace foreign key (workspace_id) references workspace (id),
    constraint fk_channel_creator foreign key (created_by_user_id) references user (id)
) engine = InnoDB;

create index idx_channel_workspace on channel (workspace_id);

create table channel_member
(
    id         bigint auto_increment primary key,
    channel_id bigint                    not null,
    user_id    bigint                    not null,
    joined_at  timestamp default CURRENT_TIMESTAMP null,
    constraint unique_channel_member unique (channel_id, user_id),
    constraint fk_channel_member_channel foreign key (channel_id) references channel (id),
    constraint fk_channel_member_user foreign key (user_id) references user (id)
) engine = InnoDB;

create index idx_channel_member_user on channel_member (user_id);

create table message
(
    id                 bigint auto_increment primary key,
    channel_id         bigint                    not null,
    sender_user_id     bigint                    null,
    kind               enum('USER','SYSTEM','BOT') not null,
    body               text                      not null,
    created_at         timestamp default CURRENT_TIMESTAMP null,
    edited_at          timestamp                 null,
    deleted_at         timestamp                 null,
    deleted_by_user_id bigint                    null,
    constraint fk_message_channel foreign key (channel_id) references channel (id),
    constraint fk_message_sender foreign key (sender_user_id) references user (id),
    constraint fk_message_deleted_by foreign key (deleted_by_user_id) references user (id)
) engine = InnoDB;

create index idx_message_channel_created_at on message (channel_id, created_at);
create index idx_message_channel_id on message (channel_id, id);

create table channel_read_state
(
    channel_id           bigint                    not null,
    user_id              bigint                    not null,
    last_read_message_id bigint                    null,
    last_read_at         timestamp                 null,
    updated_at           timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    primary key (channel_id, user_id),
    constraint fk_read_state_channel foreign key (channel_id) references channel (id),
    constraint fk_read_state_user foreign key (user_id) references user (id),
    constraint fk_read_state_message foreign key (last_read_message_id) references message (id)
) engine = InnoDB;

create table voice_channel_binding
(
    channel_id         bigint                    not null,
    livekit_room_name  varchar(255)              not null,
    mode               enum('PERMANENT','TEMPORAL') not null,
    created_by_user_id bigint                    not null,
    created_at         timestamp default CURRENT_TIMESTAMP null,
    primary key (channel_id),
    constraint unique_voice_channel_room unique (livekit_room_name),
    constraint fk_voice_channel_binding_channel foreign key (channel_id) references channel (id),
    constraint fk_voice_channel_binding_user foreign key (created_by_user_id) references user (id)
) engine = InnoDB;

create table dm_channel_index
(
    user_low_id  bigint                    not null,
    user_high_id bigint                    not null,
    channel_id   bigint                    not null,
    created_at   timestamp default CURRENT_TIMESTAMP null,
    primary key (user_low_id, user_high_id),
    unique (channel_id),
    constraint fk_dm_index_user_low foreign key (user_low_id) references user (id),
    constraint fk_dm_index_user_high foreign key (user_high_id) references user (id),
    constraint fk_dm_index_channel foreign key (channel_id) references channel (id)
) engine = InnoDB;
