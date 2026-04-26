---
title: Local Development
summary: Local startup and verification commands for Confa modules.
doc_type: how-to
status: active
owner: core-team
last_reviewed: 2026-04-26
applies_to:
  - backend/
  - frontend/client/
  - frontend/admin-client/
  - agents/
  - deploy/
canonical_sources:
  - backend/api/docker-compose.yml
  - backend/api/src/main/resources/application.yml
  - frontend/client/package.json
  - frontend/admin-client/package.json
  - agents/package.json
related:
  - docs/references/repo-map.md
  - docs/contracts/shared-runtime-contracts.md
---

# Local Development

Use the package manager and working directory for the module you are changing. Do not rely on root-level npm or Maven commands.

## Backend Dependencies

Local MySQL, Redis, and MinIO are defined in `backend/api/docker-compose.yml`.

```bash
cd backend/api
docker compose up -d
```

Defaults from `application.yml` match the local compose file for MySQL and Redis:

- MySQL: `localhost:3306`, database `confa`, user `confa`, password `confa`.
- Redis: `localhost:6379`.
- MinIO: `http://localhost:9000`, root user `minioadmin`, password `minioadmin`.

LiveKit is not included in this local compose file. Run a local LiveKit instance separately or point `LIVEKIT_URL` and `VITE_LIVEKIT_WS_URL` at an available server.

## Backend API

From `backend/`:

```bash
./mvnw -pl api spring-boot:run
```

Routine verification:

```bash
./mvnw -pl api test
```

Create a Liquibase migration skeleton:

```bash
bash scripts/liquibase/new_migration.sh api add_feature_table "short migration comment"
```

## Client SPA

From `frontend/client/`:

```bash
npm install
npm run dev
```

Build and lint:

```bash
npm run build
npm run lint
```

Required build-time env:

- `VITE_API_BASE`
- `VITE_LIVEKIT_WS_URL`

## Admin SPA

From `frontend/admin-client/`:

```bash
npm install
npm run dev
```

Build and lint:

```bash
npm run build
npm run lint
```

Required build-time env:

- `VITE_API_BASE`

## Agents Worker

From `agents/`:

```bash
pnpm install
pnpm download-files
pnpm dev
```

Type-check:

```bash
pnpm build
```

Local agent development needs LiveKit worker credentials and provider keys in `.env.local`. The selected provider path controls which keys are required.

## Deployment Config Checks

From `deploy/`, when a real `.env` exists:

```bash
docker compose --env-file .env config
```

Do not run `build_push.sh` casually. It builds and pushes multi-architecture images.

