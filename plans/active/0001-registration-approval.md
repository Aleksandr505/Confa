---
title: Registration With Admin Approval
status: active
owner: core-team
created: 2026-04-26
updated: 2026-05-13
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

- [x] Add Liquibase migration for user lifecycle fields.
- [x] Add Java enum/domain representation for lifecycle status.
- [x] Update `UserEntity`, DTOs, mappers, and repository SQL.
- [x] Update `UserRepository.findByUsername` so only `ACTIVE` and not blocked users can authenticate.
- [x] Add public registration API, likely `POST /auth/register`.
- [x] Ensure registration does not issue JWT tokens.
- [x] Add admin APIs for pending requests:
  - list pending requests;
  - approve request;
  - reject request.
- [x] Keep bootstrap admin and admin-created users active by default.
- [x] Return clear errors for pending/rejected users at login.

## Frontend Plan

- [x] Add registration entry point from the user login page.
- [x] Add registration form with username/password validation matching backend constraints.
- [x] Show a clear post-registration pending message.
- [x] Show a specific login error when the account is pending or rejected.
- [x] Add admin UI section for pending registration requests.
- [x] Add approve/reject actions with confirmation.
- [x] Keep existing user management flows working for active users.

## Verification

- [x] Backend test: existing active user can log in.
- [x] Backend test: pending user cannot log in.
- [x] Backend test: rejected user cannot log in.
- [x] Backend test: approved user can log in after approval.
- [x] Backend test: public registration creates `PENDING` user and does not return a token.
- [x] Admin frontend build: `cd frontend/admin-client && npm run build`.
- [x] Client frontend build: `cd frontend/client && npm run build`.
- [x] Backend check: `cd backend && ./mvnw -pl api clean test`.

## Open Questions

- Should rejected users be able to submit another registration with the same username?
- Should admins see all statuses in one users table or a separate requests page?
- Should the registration form collect only username/password, or also display name/email later?
- Should rejection support an admin-visible reason now or be deferred?

## Handoff Notes

Backend, client, and admin implementation is in place. Backend unit tests cover the core registration lifecycle, login gating, duplicate username conflicts, and wrong-password handling for pending users. Registration now has backend validation and throttling, and admin user DTOs do not expose password hashes. Frontend lint still fails on pre-existing baseline issues outside this plan's changed lines.
