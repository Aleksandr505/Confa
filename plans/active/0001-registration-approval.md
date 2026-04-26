---
title: Registration With Admin Approval
status: active
owner: core-team
created: 2026-04-26
updated: 2026-04-26
applies_to:
  - backend/api/
  - frontend/client/
  - frontend/admin-client/
related_docs:
  - docs/security/auth-and-access.md
  - docs/contracts/shared-runtime-contracts.md
  - docs/references/repo-map.md
---

# Registration With Admin Approval

## Goal

Add self-service registration while keeping Confa closed by default. A new user can submit a registration request, but cannot log in or access the system until an admin approves the request.

## Scope

In scope:

- user lifecycle state for pending, active, and rejected users;
- public registration endpoint;
- admin queue/actions for approving or rejecting registration requests;
- client registration screen and pending-state messaging;
- admin UI for reviewing requests;
- docs and tests for auth behavior.

Out of scope:

- email verification;
- password reset;
- public workspace or room access;
- invitation-based auto-approval;
- notifications to admins or applicants.

## Context

- Relevant source paths:
  - `backend/api/src/main/java/space/confa/api/controller/LoginController.java`
  - `backend/api/src/main/java/space/confa/api/controller/AdminController.java`
  - `backend/api/src/main/java/space/confa/api/service/UserService.java`
  - `backend/api/src/main/java/space/confa/api/infrastructure/db/repository/UserRepository.java`
  - `backend/api/src/main/resources/space/confa/api/db/changelog/`
  - `frontend/client/src/pages/Login.tsx`
  - `frontend/client/src/api.ts`
  - `frontend/admin-client/src/pages/UsersPage.tsx`
  - `frontend/admin-client/src/api.ts`
- Relevant docs:
  - `docs/security/auth-and-access.md`
  - `docs/contracts/shared-runtime-contracts.md`
- Shared contracts or risks:
  - Login must only succeed for approved active users.
  - Admin-created users and bootstrap admin should remain immediately active.
  - Existing users need a migration to the active state.

## Proposed Data Model

- Add a user status enum, recommended values:
  - `PENDING`
  - `ACTIVE`
  - `REJECTED`
- Existing users should migrate to `ACTIVE`.
- New public registrations should start as `PENDING`.
- Admin-created users should start as `ACTIVE` unless the admin UI explicitly chooses another state later.
- Consider adding audit columns:
  - `approved_at`
  - `approved_by_user_id`
  - `rejected_at`
  - `rejected_by_user_id`

## Backend Plan

- [ ] Add Liquibase migration for user lifecycle fields.
- [ ] Add Java enum/domain representation for lifecycle status.
- [ ] Update `UserEntity`, DTOs, mappers, and repository SQL.
- [ ] Update `UserRepository.findByUsername` so only `ACTIVE` and not blocked users can authenticate.
- [ ] Add public registration API, likely `POST /auth/register`.
- [ ] Ensure registration does not issue JWT tokens.
- [ ] Add admin APIs for pending requests:
  - list pending requests;
  - approve request;
  - reject request.
- [ ] Keep bootstrap admin and admin-created users active by default.
- [ ] Return clear errors for pending/rejected users at login.

## Frontend Plan

- [ ] Add registration entry point from the user login page.
- [ ] Add registration form with username/password validation matching backend constraints.
- [ ] Show a clear post-registration pending message.
- [ ] Show a specific login error when the account is pending or rejected.
- [ ] Add admin UI section for pending registration requests.
- [ ] Add approve/reject actions with confirmation.
- [ ] Keep existing user management flows working for active users.

## Verification

- [ ] Backend test: existing active user can log in.
- [ ] Backend test: pending user cannot log in.
- [ ] Backend test: rejected user cannot log in.
- [ ] Backend test: approved user can log in after approval.
- [ ] Backend test: public registration creates `PENDING` user and does not return a token.
- [ ] Admin frontend build: `cd frontend/admin-client && npm run build`.
- [ ] Client frontend build: `cd frontend/client && npm run build`.
- [ ] Backend check: `cd backend && ./mvnw -pl api test`.

## Open Questions

- Should rejected users be able to submit another registration with the same username?
- Should admins see all statuses in one users table or a separate requests page?
- Should the registration form collect only username/password, or also display name/email later?
- Should rejection support an admin-visible reason now or be deferred?

## Handoff Notes

Implement backend lifecycle first. The frontend should not infer pending state from generic `401`; backend needs a stable error shape or status code behavior that the client can render.

