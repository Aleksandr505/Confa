# Deployment Guidelines

## Scope

This directory contains production-oriented deployment assets: Docker Compose, Caddy routing, LiveKit config, env generation, image build/push helpers, and Liquibase runtime wiring.

## Files

- `docker-compose.yml`: service topology for Caddy, LiveKit, API, client, admin client, MySQL, Redis, MinIO, Liquibase, and OneTimeSecret.
- `Caddyfile`: public host routing and admin host restrictions.
- `livekit.yaml`: LiveKit server configuration.
- `generate_envs.sh`: creates runtime and build-time env files for profiles.
- `build_push.sh`: builds and pushes Docker images.
- `libs/`: local JDBC driver mount for Liquibase; do not commit binary churn here.

## Deployment Contracts

- Keep `VITE_*` values separated from runtime backend env vars. Vite app env is baked into frontend images during build.
- `deploy/.env`, generated `*.build.env`, secrets, registry credentials, and local TLS/data files must stay uncommitted.
- Keep service names aligned with backend env defaults and compose DNS names: `mysql`, `redis`, `minio`, `livekit`, `api`, `client`, and `admin-client`.
- Liquibase mounts backend resources read-only and uses `space/confa/api/db/changelog/liquibase-changelog.yaml`; update compose if the changelog path changes.
- Preserve the `shared_web` network assumption unless all deployment docs and scripts are updated together.

## Verification

- For script changes, run the relevant script in a disposable profile or dry-run mentally if it would push images or require secrets.
- For Compose changes, prefer `docker compose --env-file .env config` in `deploy/` when a local env file is available.
- For Caddy changes, verify hostnames and admin access restrictions explicitly before production use.

