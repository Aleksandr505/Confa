-- liquibase formatted sql
-- changeset Aleksandr505:20260513120000
-- comment: room chat messages and image attachments

alter table message
    modify column channel_id bigint null,
    add column room_id bigint null after channel_id,
    add constraint fk_message_room foreign key (room_id) references room (id),
    add constraint chk_message_single_scope check (
        (channel_id is not null and room_id is null)
        or (channel_id is null and room_id is not null)
    );

create index idx_message_room_id on message (room_id, id);
create index idx_message_room_created_at on message (room_id, created_at);

create table message_attachment
(
    id                    bigint auto_increment primary key,
    message_id            bigint                                      null,
    channel_id            bigint                                      null,
    room_id               bigint                                      null,
    owner_user_id         bigint                                      not null,
    status                enum('PENDING','ATTACHED','DELETED')        not null default 'PENDING',
    bucket                varchar(128)                                not null,
    display_object_key    varchar(512)                                not null,
    thumbnail_object_key  varchar(512)                                not null,
    original_filename     varchar(255)                                null,
    original_content_type varchar(128)                                not null,
    original_size_bytes   bigint                                      not null,
    stored_content_type   varchar(128)                                not null,
    stored_size_bytes     bigint                                      not null,
    width                 int                                         not null,
    height                int                                         not null,
    thumbnail_size_bytes  bigint                                      not null,
    thumbnail_width       int                                         not null,
    thumbnail_height      int                                         not null,
    checksum_sha256       char(64)                                    not null,
    created_at            timestamp default CURRENT_TIMESTAMP         null,
    attached_at           timestamp                                   null,
    deleted_at            timestamp                                   null,
    constraint fk_message_attachment_message foreign key (message_id) references message (id),
    constraint fk_message_attachment_channel foreign key (channel_id) references channel (id),
    constraint fk_message_attachment_room foreign key (room_id) references room (id),
    constraint fk_message_attachment_owner foreign key (owner_user_id) references user (id),
    constraint chk_message_attachment_single_scope check (
        (channel_id is not null and room_id is null)
        or (channel_id is null and room_id is not null)
    )
) engine = InnoDB;

create index idx_message_attachment_message on message_attachment (message_id, status);
create index idx_message_attachment_pending on message_attachment (owner_user_id, status, created_at);
create index idx_message_attachment_channel on message_attachment (channel_id, status, created_at);
create index idx_message_attachment_room on message_attachment (room_id, status, created_at);
