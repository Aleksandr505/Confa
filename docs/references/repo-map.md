---
title: Repository Map
summary: Map of Confa modules, ownership boundaries, and routine verification commands.
doc_type: reference
status: active
owner: core-team
last_reviewed: 2026-04-26
applies_to:
  - backend/
  - frontend/
  - agents/
  - deploy/
canonical_sources:
  - README.md
  - AGENTS.md
  - backend/pom.xml
  - frontend/client/package.json
  - frontend/admin-client/package.json
  - agents/package.json
  - deploy/docker-compose.yml
related:
  - docs/index.md
  - docs/architecture/system-context.md
---

# Repository Map

Confa is a monorepo for realtime conferencing, messenger-style collaboration, AI voice agents, and deployment infrastructure.

## Top-Level Areas

| Path | Purpose | Primary stack | Verify with |
| --- | --- | --- | --- |
| `backend/` | Maven parent and backend utility scripts | Java 21, Maven | `cd backend && ./mvnw -pl api test` |
| `backend/api/` | Spring Boot WebFlux API | WebFlux, Security, R2DBC, MySQL, Redis, LiveKit SDK, S3-compatible storage | `cd backend && ./mvnw -pl api test` |
| `frontend/client/` | User SPA | React, TypeScript, Vite, LiveKit components | `npm run build`, `npm run lint` |
| `frontend/admin-client/` | Admin SPA | React, TypeScript, Vite | `npm run build`, `npm run lint` |
| `agents/` | LiveKit Agents worker | Node.js, TypeScript, pnpm, LiveKit Agents SDK | `pnpm build` |
| `deploy/` | Deployment topology and scripts | Docker Compose, Caddy, LiveKit, Liquibase | `docker compose --env-file .env config` when env exists |
| `docs/` | Cross-cutting repository documentation | Markdown with front matter | `git diff --check` |
| `plans/` | Active and archived implementation plans | Markdown task plans | `git diff --check` |

## Backend API Layout

| Path | Content |
| --- | --- |
| `controller/` | HTTP endpoints for auth, admin, rooms, agents, workspaces, channels, DMs, messages, avatars, and sounds. |
| `service/` | Business logic and integrations with LiveKit, JWT, Redis, persistence, and storage. |
| `infrastructure/db/repository/` | R2DBC repositories and SQL queries. |
| `model/dto/` | Request and response contracts consumed by frontends. |
| `model/entity/` | R2DBC database entities. |
| `model/domain/` | Domain enums and small domain records. |
| `configuration/`, `security/` | Beans, properties, JWT, CORS, and authorization configuration. |
| `src/main/resources/space/confa/api/db/changelog/` | Liquibase changelog and formatted SQL migrations. |

## Frontend Layout

Both frontend apps keep API functions in `src/api.ts` and authenticated fetch behavior in `src/lib/http.ts`.

The user SPA has route-level pages for login, home, room conferencing, workspace shell, channels, DMs, and invites. Its LiveKit UI is centered around `frontend/client/src/pages/Room.tsx` and `VoiceChannelView.tsx`.

The admin SPA has route-level pages for bootstrap, login, users, and rooms. It combines LiveKit room participant data with agent state from the backend.

## Generated Or Derived Files

- `node_modules/`, `dist/`, `target/`, `.env`, `*.local`, and deployment build env files are local or generated and should not be edited as source.
- `agents/src/*.js`, `agents/src/*.d.ts`, and maps are tracked TypeScript compiler outputs. Prefer editing `.ts` sources unless a task explicitly requires generated outputs to be synchronized.
- Liquibase SQL migrations are hand-authored canonical schema history once created.
