-- liquibase formatted sql
-- changeset Aleksandr505:20251004142601
-- comment: main table for users data

create table user
(
    id                   bigint auto_increment
        primary key,
    role                 enum('ADMIN', 'USER')     not null,
    username             varchar(255)              not null,
    password             varchar(255)              not null,
    blocked_at           timestamp                 null,
    created_at           timestamp                 default CURRENT_TIMESTAMP  null,
    updated_at           timestamp                 default CURRENT_TIMESTAMP  null on update CURRENT_TIMESTAMP,
    constraint username
        unique (username)
) engine = InnoDB;



