-- liquibase formatted sql
-- changeset Aleksandr505:20260217120000
-- comment: add message replies and reactions

alter table message
    add column reply_to_message_id bigint null after body,
    add constraint fk_message_reply_to foreign key (reply_to_message_id) references message (id);

create index idx_message_reply_to on message (reply_to_message_id);

create table message_reaction
(
    message_id  bigint                    not null,
    user_id     bigint                    not null,
    emoji       varchar(32)               not null,
    created_at  timestamp default CURRENT_TIMESTAMP null,
    primary key (message_id, user_id, emoji),
    constraint fk_message_reaction_message foreign key (message_id) references message (id),
    constraint fk_message_reaction_user foreign key (user_id) references user (id)
) engine = InnoDB;

create index idx_message_reaction_message_emoji on message_reaction (message_id, emoji);
