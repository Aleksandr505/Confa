---
title: Shared Runtime Contracts
summary: Cross-module contracts that backend, frontends, agents, and deploy must keep aligned.
doc_type: reference
status: active
owner: core-team
last_reviewed: 2026-04-26
applies_to:
  - backend/api/
  - frontend/client/
  - frontend/admin-client/
  - agents/
  - deploy/
canonical_sources:
  - backend/api/src/main/java/space/confa/api/controller/
  - backend/api/src/main/java/space/confa/api/model/dto/
  - frontend/client/src/api.ts
  - frontend/admin-client/src/api.ts
  - agents/src/agent.ts
  - deploy/generate_envs.sh
  - deploy/docker-compose.yml
related:
  - docs/architecture/system-context.md
  - docs/glossary.md
  - docs/security/auth-and-access.md
---

# Shared Runtime Contracts

This page records contracts that cross module boundaries. Treat the listed source files as canonical and update this page when the contract changes.

## Authentication

| Contract | Current behavior | Canonical source |
| --- | --- | --- |
| Login endpoint | `POST /auth` returns access token through the `Authorization` response header. | `LoginController.java`, `frontend/*/src/api.ts` |
| Refresh endpoint | `POST /auth/refresh` is called automatically after `401` responses. | `LoginController.java`, `frontend/*/src/lib/http.ts` |
| Role claim | JWT authorities are read from the `scope` claim and converted to `ROLE_*`. | `SecurityConfiguration.java` |
| Admin access | `/admin/**` requires `ADMIN`; deploy additionally restricts admin paths by IP. | `SecurityConfiguration.java`, `deploy/Caddyfile` |

## Main HTTP Surface

| Area | Representative endpoints | Primary callers |
| --- | --- | --- |
| Auth | `/auth`, `/auth/refresh` | Client SPA, Admin SPA |
| Admin | `/admin/bootstrap/status`, `/admin/bootstrap`, `/admin/users` | Admin SPA |
| Rooms | `/rooms`, `/rooms/my`, `/rooms/{room}/config`, `/rooms/{room}/participants` | Client SPA, Admin SPA |
| LiveKit token | `/livekit/token`, `/api/channels/{channelId}/livekit-token` | Client SPA |
| Agents | `/rooms/{room}/agents`, `/invite`, `/kick`, `/mute`, `/focus`, `/enable`, `/disable` | Client SPA, Admin SPA |
| Workspaces | `/api/workspaces`, `/api/workspaces/{workspaceId}/members`, `/api/workspaces/{workspaceId}/channels` | Client SPA |
| Messages and DMs | `/api/channels/{channelId}/messages`, `/api/dms`, `/api/dm/{peerId}/messages` | Client SPA |
| Avatars | `/api/avatars/me`, `/api/avatars/resolve`, `/api/avatars/resolve-batch`, `/api/avatars/content/{assetId}` | Client SPA |
| Sounds | `/api/sounds`, `/api/rooms/{roomName}/sounds`, `/api/sounds/{soundId}/play` | Client SPA |

Do not change endpoint paths or DTO field names without updating backend controllers, backend DTOs, frontend `src/api.ts` types, and affected UI code together.

## LiveKit Agent Contract

| Contract | Value |
| --- | --- |
| Agent role union | `bored`, `friendly`, `funny` |
| Dispatch metadata | JSON object with `role` |
| Agent identity prefix | `agent-` |
| Current worker identity format | `agent-<role>-<jobId>` |
| Participant metadata | JSON object including `isMuted` |
| Backend list filter | participant identity starts with `agent-` |
| Control topics handled by worker | `control.muted`, `control.set_target`, `control.stop_tts`, `control.leave` |
| Control topics sent by backend today | `control.muted`, `control.set_target` |

Changing any item in this table requires coordinated changes in `backend/api`, `frontend/client`, `frontend/admin-client`, and `agents`.

## Environment Variables

| Variable family | Used by | Notes |
| --- | --- | --- |
| `APP_*` | API | Application name and port. |
| `DB_*` | API, Compose, Liquibase | MySQL connection and migration credentials. |
| `REDIS_*` | API, Compose | Redis host, port, and optional password. |
| `JWT_*` | API | Auth secret and access/refresh TTLs. |
| `PASSWORD_ENCODER_SECRET` | API | Password encoding secret. |
| `INIT_BOOTSTRAP_SERVICE_KEY` | API, Admin SPA flow | Required for first admin bootstrap. |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | API, agents runtime | API uses these for server-side LiveKit operations; agents runtime also needs LiveKit credentials. |
| `CLIENT_BASE_URL` | API | Used when producing client-facing invite links. |
| `AVATAR_S3_*` | API, Compose | S3-compatible storage endpoint, bucket, credentials, region, and path-style behavior. |
| `VITE_API_BASE` | Client SPA, Admin SPA | Build-time API base URL embedded by Vite. |
| `VITE_LIVEKIT_WS_URL` | Client SPA | Build-time LiveKit WebSocket URL embedded by Vite. |
| `LLM_PROVIDER`, `STT_PROVIDER`, `TTS_PROVIDER` | Agents worker | Selects provider paths in `agents/src/agent.ts`. |
| Provider API keys | Agents worker | OpenAI, Cartesia, Deepgram, and Yandex variables depend on selected provider. |

## Database Contract

- Liquibase formatted SQL files under `backend/api/src/main/resources/space/confa/api/db/changelog/scripts/` are the schema history.
- `liquibase-changelog.yaml` includes all scripts from that directory.
- Java domain enums and frontend TypeScript unions must stay compatible with MySQL enum columns.
- Soft-delete columns such as `deleted_at` must be preserved in list queries and indexes.
