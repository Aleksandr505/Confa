---
title: System Context
summary: Runtime view of Confa components, trust boundaries, and major flows.
doc_type: overview
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
  - deploy/docker-compose.yml
  - deploy/Caddyfile
  - backend/api/src/main/resources/application.yml
  - backend/api/src/main/java/space/confa/api/configuration/SecurityConfiguration.java
related:
  - docs/contracts/shared-runtime-contracts.md
  - docs/references/repo-map.md
---

# System Context

Confa combines a Spring Boot API, two React SPAs, LiveKit media infrastructure, a LiveKit Agents worker, MySQL, Redis, MinIO-compatible object storage, and Caddy routing.

## Runtime Components

| Component | Runtime role | Canonical source |
| --- | --- | --- |
| Client SPA | User login, rooms, conferencing, workspaces, channels, DMs, avatars, and soundboard UI. | `frontend/client/src/` |
| Admin SPA | Bootstrap, user management, room monitoring, participant visibility, and agent removal. | `frontend/admin-client/src/` |
| API | Auth, JWT issuance, room access, LiveKit tokens, admin operations, messenger data, avatars, sounds, and agent control. | `backend/api/src/main/java/space/confa/api/` |
| LiveKit server | Signaling and media transport for rooms and voice channels. | `deploy/livekit.yaml` |
| Agents worker | Voice AI participants dispatched into LiveKit rooms. | `agents/src/agent.ts` |
| MySQL | Persistent relational data. | Liquibase migrations under `backend/api/src/main/resources/space/confa/api/db/changelog/` |
| Redis | Reactive Redis dependency for invite/session-related runtime support. | `backend/api/src/main/resources/application.yml` |
| MinIO or S3-compatible storage | Avatar and sound object storage. | `backend/api/src/main/resources/application.yml`, `deploy/docker-compose.yml` |
| Caddy | Public TLS entry and reverse proxy restrictions. | `deploy/Caddyfile` |

## Public Entrypoints

| Host pattern | Target service | Notes |
| --- | --- | --- |
| `example.com` | `client:80` | User SPA. |
| `api.example.com` | `api:8080` | Backend API. `/admin/*` is IP-restricted in Caddy and role-restricted in Spring Security. |
| `admin.example.com` | `admin-client:80` | Admin SPA, IP-restricted in Caddy. |
| `live.example.com` | `livekit:7880` | LiveKit signaling endpoint. |
| `s3.example.com` | `minio:9000` | Public S3-compatible endpoint for presigned asset URLs. |
| `minio-admin.example.com` | `minio:9001` | MinIO console, IP-restricted in Caddy. |
| `pass.example.com` | `ots:3000` | OneTimeSecret service. |

## Trust Boundaries

- Browser clients authenticate to the API with JWT access tokens and refresh via cookie-backed `/auth/refresh`.
- Spring Security requires `ADMIN` for `/admin/**`, authentication for `/rooms/**` and `/livekit/token`, and permits `/auth` plus `/auth/refresh`.
- Admin access has two layers: Caddy IP filtering and backend role checks.
- The API owns LiveKit server credentials and issues room tokens to authenticated users.
- The agents worker connects to LiveKit with worker credentials and receives dispatch jobs from LiveKit after the backend creates a dispatch.
- Object storage credentials stay server-side. Browsers consume presigned or proxied content URLs.

## Major Flows

### Login And Refresh

1. Client or admin SPA posts credentials to `POST /auth`.
2. API returns an access token in the `Authorization` header and sets refresh state through cookies.
3. Frontend `src/lib/http.ts` retries once through `POST /auth/refresh` after a `401`.

### User Conference Room

1. User opens `/room/:roomId` or a voice channel view.
2. Client requests a LiveKit token from `POST /livekit/token` or `POST /api/channels/{channelId}/livekit-token`.
3. Client connects to LiveKit through `VITE_LIVEKIT_WS_URL`.
4. Backend and frontend read room metadata such as `isAgentsEnabled` from `/rooms/{room}/config`.

### Agent Dispatch And Control

1. Client calls `/rooms/{room}/agents/invite` with an agent role.
2. API verifies room metadata and creates a LiveKit dispatch.
3. Agents worker accepts the job, joins as an identity starting with `agent-`, and publishes participant metadata.
4. Backend controls the agent through LiveKit data-channel topics such as `control.muted` and `control.set_target`.
5. Client and admin UI list agents through `/rooms/{room}/agents`.

### Messenger And Workspace

1. User SPA loads workspaces and channels from `/api/workspaces` and `/api/workspaces/{workspaceId}/channels`.
2. Text channels and DMs load messages through `/api/channels/{channelId}/messages` and `/api/dm/{peerId}/messages`.
3. Read state is updated through `/api/channels/{channelId}/read`.
4. Avatars are resolved in batches through `/api/avatars/resolve-batch`.

