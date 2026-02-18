-- liquibase formatted sql
-- changeset Aleksandr505:20260218120921
-- comment: avatar assets and scope bindings

create table avatar_asset
(
    id                    bigint auto_increment primary key,
    bucket                varchar(128)              not null,
    key_original          varchar(512)              not null,
    key_png               varchar(512)              not null,
    original_content_type varchar(128)              not null,
    original_size_bytes   bigint                    not null,
    width                 int                       not null,
    height                int                       not null,
    checksum_sha256       char(64)                  not null,
    created_by_user_id    bigint                    not null,
    created_at            timestamp default CURRENT_TIMESTAMP null,
    constraint fk_avatar_asset_created_by foreign key (created_by_user_id) references user (id)
) engine = InnoDB;

create index idx_avatar_asset_created_by on avatar_asset (created_by_user_id);

create table avatar_binding
(
    id          bigint auto_increment primary key,
    user_id     bigint                                  not null,
    scope_type  enum('GLOBAL','WORKSPACE','ROOM')      not null,
    workspace_id bigint                                 null,
    room_id     bigint                                  null,
    asset_id    bigint                                  not null,
    is_active   tinyint(1) default 1                   not null,
    created_at  timestamp default CURRENT_TIMESTAMP     null,
    updated_at  timestamp default CURRENT_TIMESTAMP     null on update CURRENT_TIMESTAMP,
    constraint fk_avatar_binding_user foreign key (user_id) references user (id),
    constraint fk_avatar_binding_workspace foreign key (workspace_id) references workspace (id),
    constraint fk_avatar_binding_room foreign key (room_id) references room (id),
    constraint fk_avatar_binding_asset foreign key (asset_id) references avatar_asset (id)
) engine = InnoDB;

create index idx_avatar_binding_lookup on avatar_binding (user_id, scope_type, is_active, workspace_id, room_id, updated_at);

