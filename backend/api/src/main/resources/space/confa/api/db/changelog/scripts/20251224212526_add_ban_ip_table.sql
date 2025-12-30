-- liquibase formatted sql
-- changeset Aleksandr505:20251224212526
-- comment: Table for blocking IP addresses

create table ip_ban
(
    id           bigint auto_increment primary key,
    ip           varchar(255)             not null,
    reason       varchar(255)             null,
    banned_until timestamp                null,
    permanent    tinyint(1) default 0     not null,
    created_at   timestamp default CURRENT_TIMESTAMP null,
    updated_at   timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP
) engine = InnoDB;

ALTER TABLE ip_ban ADD CONSTRAINT unique_ip_ban_ip UNIQUE (ip);
