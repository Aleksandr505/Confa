---
title: Deployment Runbook
summary: Build, configure, deploy, and verify the current Confa Docker Compose stack.
doc_type: runbook
status: active
owner: core-team
last_reviewed: 2026-04-26
applies_to:
  - deploy/
  - backend/api/
  - frontend/client/
  - frontend/admin-client/
canonical_sources:
  - deploy/docker-compose.yml
  - deploy/Caddyfile
  - deploy/generate_envs.sh
  - deploy/build_push.sh
  - backend/api/Dockerfile
  - frontend/client/Dockerfile
  - frontend/admin-client/Dockerfile
related:
  - docs/operations/local-development.md
  - docs/security/auth-and-access.md
  - docs/contracts/shared-runtime-contracts.md
---

# Deployment Runbook

This runbook describes the current Docker Compose deployment assets under `deploy/`.

## Current Stack

`deploy/docker-compose.yml` defines these services:

| Service | Purpose |
| --- | --- |
| `caddy` | Public HTTP/TLS entry and reverse proxy. |
| `livekit` | LiveKit signaling and media server. |
| `api` | Spring Boot API container. |
| `client` | User SPA served by nginx. |
| `admin-client` | Admin SPA served by nginx. |
| `mysql` | MySQL database. |
| `redis` | Redis for backend runtime support. |
| `minio` | S3-compatible object storage. |
| `liquibase-migrations` | One-shot schema migration before API startup. |
| `ots` | OneTimeSecret service. |
| `ots-redis` | Redis instance for OneTimeSecret. |

Current gap: the compose file does not define an `agents` service. Add one before expecting AI voice agents to run as part of the deployed stack.

## Prerequisites

- Docker and Docker Compose on the build and target machines.
- Registry access for `API_IMAGE`, `CLIENT_IMAGE`, and `ADMIN_CLIENT_IMAGE`.
- DNS records for the public hosts configured in `deploy/Caddyfile`.
- A created Docker network named `shared_web`, or an updated compose file that creates the expected network.
- `deploy/libs/mysql-connector-j-8.3.0.jar` available for the Liquibase container mount.
- Real secrets for JWT, database, LiveKit, object storage, bootstrap, and OneTimeSecret.

Create the network when needed:

```bash
docker network create shared_web
```

## Generate And Edit Env Files

From repository root:

```bash
./deploy/generate_envs.sh prod
```

The current script creates:

- `deploy/.env`
- `deploy/client.build.env`

Edit generated files before deployment. Replace every placeholder secret and image reference.

Important runtime values in `deploy/.env`:

- `API_IMAGE`
- `CLIENT_IMAGE`
- `ADMIN_CLIENT_IMAGE`
- `DB_*`
- `PASSWORD_ENCODER_SECRET`
- `JWT_SECRET`
- `JWT_ACCESS_EXPIRATION`
- `JWT_REFRESH_EXPIRATION`
- `INIT_BOOTSTRAP_SERVICE_KEY`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `REDIS_*`
- `CLIENT_BASE_URL`
- `AVATAR_S3_*`
- `OTS_SECRET`

Important build-time values in `deploy/client.build.env`:

- `VITE_API_BASE`
- `VITE_LIVEKIT_WS_URL`

`build_push.sh` uses `VITE_API_BASE` for both frontend images and `VITE_LIVEKIT_WS_URL` for the user client image.

## Build And Push Images

From repository root:

```bash
REGISTRY=your-registry-or-namespace TAG=1.0.0 ./deploy/build_push.sh
```

The script:

1. Builds the backend jar with `cd backend && ./mvnw -q -DskipTests package`.
2. Copies the jar to `backend/api/target/app.jar`.
3. Builds and pushes multi-architecture images for:
   - `api`
   - `client`
   - `admin-client`

It does not build an agents image.

## Validate Compose Configuration

From `deploy/`, after `.env` is populated:

```bash
docker compose --env-file .env config
```

Fix interpolation errors before pulling or starting services.

## Deploy Or Update

On the target server, from the deployment directory containing `docker-compose.yml`, `Caddyfile`, `livekit.yaml`, `.env`, and `libs/mysql-connector-j-8.3.0.jar`:

```bash
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

The API waits for:

- healthy MySQL;
- completed `liquibase-migrations`;
- healthy Redis;
- started MinIO.

## Verify

Check containers:

```bash
docker compose --env-file .env ps
```

Check migration result:

```bash
docker compose --env-file .env logs liquibase-migrations
```

Check API logs:

```bash
docker compose --env-file .env logs -f api
```

Check public routing:

- user SPA host routes to `client`;
- API host routes to `api`;
- admin host is blocked outside the configured IP range;
- LiveKit host reaches `livekit`;
- S3 host reaches `minio`.

Check application behavior:

- `GET /admin/bootstrap/status` works from an allowed admin network.
- Login returns an `Authorization` header.
- Client can request a LiveKit token.
- A browser can connect to the configured LiveKit WebSocket URL.
- Avatar or sound URLs resolve through the configured S3-compatible endpoint.

## Migrations

Production compose runs Liquibase as a one-shot service before API startup.

The migration service mounts:

- `../backend/api/src/main/resources` to `/liquibase/changelog`;
- `./libs/mysql-connector-j-8.3.0.jar` to `/liquibase/lib/mysql-connector-java.jar`.

It applies:

```text
space/confa/api/db/changelog/liquibase-changelog.yaml
```

Do not edit already-applied migration files unless the environment is disposable and explicitly being reset.

## Rollback Notes

Rollback is currently manual:

- redeploy previous image tags through `.env`;
- restart compose with `docker compose --env-file .env up -d`;
- restore database from backup if a migration introduced incompatible schema changes.

Because migrations are forward-only, plan rollback before deploying risky database changes.

## Known Cleanup Items

- Add an `agents` service and image build path if production agents should be managed by this compose stack.
- Decide whether `deploy/README.md` should be replaced by this runbook or kept as a short pointer.
- Review generated env coverage: current `generate_envs.sh` does not generate a separate `admin.build.env`.

