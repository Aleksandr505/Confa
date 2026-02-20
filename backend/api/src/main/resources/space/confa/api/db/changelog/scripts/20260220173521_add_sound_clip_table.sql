-- liquibase formatted sql
-- changeset Aleksandr505:20260220173521
-- comment: room-bound soundboard clips with sharing

create table sound_clip
(
    id              bigint auto_increment primary key,
    owner_user_id   bigint                                  not null,
    source_room_id  bigint                                  not null,
    name            varchar(96)                             not null,
    bucket          varchar(128)                            not null,
    object_key      varchar(512)                            not null,
    content_type    varchar(128)                            not null,
    size_bytes      bigint                                  not null,
    duration_ms     int                                     null,
    created_at      timestamp default CURRENT_TIMESTAMP     null,
    updated_at      timestamp default CURRENT_TIMESTAMP     null on update CURRENT_TIMESTAMP,
    deleted_at      timestamp                               null,
    constraint fk_sound_clip_owner foreign key (owner_user_id) references user (id),
    constraint fk_sound_clip_source_room foreign key (source_room_id) references room (id)
) engine = InnoDB;

create index idx_sound_clip_source_room on sound_clip (source_room_id, deleted_at, created_at);
create index idx_sound_clip_owner on sound_clip (owner_user_id, deleted_at, created_at);

create table sound_clip_share
(
    id              bigint auto_increment primary key,
    sound_clip_id   bigint                                  not null,
    target_room_id  bigint                                  not null,
    shared_by_user_id bigint                                not null,
    created_at      timestamp default CURRENT_TIMESTAMP     null,
    deleted_at      timestamp                               null,
    constraint fk_sound_share_clip foreign key (sound_clip_id) references sound_clip (id),
    constraint fk_sound_share_room foreign key (target_room_id) references room (id),
    constraint fk_sound_share_user foreign key (shared_by_user_id) references user (id),
    constraint uq_sound_share_clip_room unique (sound_clip_id, target_room_id)
) engine = InnoDB;

create index idx_sound_share_target_room on sound_clip_share (target_room_id, deleted_at, created_at);

