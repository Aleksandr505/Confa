---
title: Auth And Access
summary: Authentication, authorization, bootstrap, CORS, and admin access rules in Confa.
doc_type: reference
status: active
owner: core-team
last_reviewed: 2026-04-26
applies_to:
  - backend/api/
  - frontend/client/
  - frontend/admin-client/
  - deploy/
canonical_sources:
  - backend/api/src/main/java/space/confa/api/configuration/SecurityConfiguration.java
  - backend/api/src/main/java/space/confa/api/controller/LoginController.java
  - backend/api/src/main/java/space/confa/api/service/JWTService.java
  - backend/api/src/main/java/space/confa/api/service/UserService.java
  - deploy/Caddyfile
related:
  - docs/contracts/shared-runtime-contracts.md
  - docs/architecture/system-context.md
---

# Auth And Access

This page summarizes current auth and access behavior. Source files listed in `canonical_sources` remain authoritative.

## Identity Model

| Concept | Current behavior |
| --- | --- |
| User roles | `ADMIN` and `USER`. |
| JWT subject | User id as a string. |
| JWT role claim | `scope`, containing granted authorities. |
| Spring authority mapping | Values from `scope` are prefixed with `ROLE_` by Spring Security. |
| JWT signing | HS256 with `JWT_SECRET` through Nimbus encoder/decoder. |
| Access token TTL | `JWT_ACCESS_EXPIRATION`, default `PT10M`. |
| Refresh token TTL | `JWT_REFRESH_EXPIRATION`, default `PT12H`. |

## Login Flow

1. Browser posts credentials to `POST /auth`.
2. API rate-limits by `clientIp:username`.
3. API checks active IP bans before authentication.
4. On success, API returns `204 No Content` with access token in the `Authorization` header.
5. API sets `refresh_token` as an HTTP-only, secure, `SameSite=Strict` cookie scoped to `/auth`.
6. Frontend `src/lib/http.ts` attaches the access token to authenticated requests.

The `Authorization` response header is exposed through CORS so browser clients can read it.

## Refresh Flow

1. Frontend request receives `401`.
2. Frontend posts to `POST /auth/refresh` with credentials included.
3. API validates the refresh token cookie and returns a new access token in the `Authorization` header.
4. Frontend retries the original request once.

## Authorization Rules

Spring Security currently applies these path rules:

| Path | Access |
| --- | --- |
| `OPTIONS /**` | Public. |
| `/auth`, `/auth/refresh` | Public. |
| `/admin/**` | Requires `ADMIN`. |
| `/rooms/**` | Requires authentication. |
| `/livekit/token` | Requires authentication. |
| All other paths | Requires authentication. |

Controllers may add method-level rules with `@PreAuthorize`. For example, enabling or disabling room agents is admin-only in `AgentController`.

## Admin Bootstrap

The admin bootstrap flow exists so the first admin can be created when no admin users exist.

| Endpoint | Purpose |
| --- | --- |
| `GET /admin/bootstrap/status` | Returns whether an admin already exists. |
| `POST /admin/bootstrap` | Creates the first admin if the service key matches `INIT_BOOTSTRAP_SERVICE_KEY`. |

`UserService.bootstrapAdmin` generates a random password and returns it once. Do not log or persist that password outside the intended bootstrap response.

## Login Throttling And IP Bans

| Control | Current behavior |
| --- | --- |
| Per IP and username rate limit | 5 attempts per 10 minutes. |
| Failed-login window | 15 minutes. |
| Ban threshold | 6 failures in the window. |
| First temporary ban | 15 minutes. |
| Later temporary ban | 1 hour when ban counter reaches the second rule. |
| Ban counter TTL | 24 hours. |

The rate limiter is in memory. IP ban counters use Redis and persisted ban rows.

## CORS

Allowed origin patterns are currently hard-coded in `SecurityConfiguration`:

- `http://localhost:5173`
- `https://confa.space`
- `https://admin.confa.space`

Allowed methods are `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, and `OPTIONS`. Credentials are allowed.

If frontend hosts change, update both CORS and deployment routing.

## Network Access Controls

Caddy adds network-level restrictions:

- `admin.example.com` is available only to configured `remote_ip` values.
- `api.example.com/admin/*` is available only to configured `remote_ip` values.
- `minio-admin.example.com` is available only to configured `remote_ip` values.

These restrictions do not replace backend role checks. Keep both layers.

## Change Checklist

When changing auth or access behavior:

- Update backend security config and affected controllers together.
- Update frontend auth/http helpers if login, refresh, or token transport changes.
- Update `deploy/Caddyfile` if admin host or IP restrictions change.
- Update CORS if public frontend origins change.
- Update `docs/contracts/shared-runtime-contracts.md` when endpoint or JWT contracts change.
- Verify with backend tests and at least one browser login flow when possible.

