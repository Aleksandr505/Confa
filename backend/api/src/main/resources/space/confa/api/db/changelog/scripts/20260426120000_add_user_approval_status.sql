-- liquibase formatted sql
-- changeset Aleksandr505:20260426120000
-- comment: add user lifecycle status for registration approval

alter table user
    add column status enum('PENDING', 'ACTIVE', 'REJECTED') not null default 'ACTIVE' after role,
    add column approved_at timestamp null after blocked_at,
    add column approved_by_user_id bigint null after approved_at,
    add column rejected_at timestamp null after approved_by_user_id,
    add column rejected_by_user_id bigint null after rejected_at;

update user
set status = 'ACTIVE',
    approved_at = coalesce(approved_at, created_at)
where status = 'ACTIVE';

alter table user
    add constraint fk_user_approved_by foreign key (approved_by_user_id) references user (id),
    add constraint fk_user_rejected_by foreign key (rejected_by_user_id) references user (id);

create index idx_user_status_created_at on user (status, created_at);

