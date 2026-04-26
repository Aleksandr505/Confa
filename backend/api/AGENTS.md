# API Module Guidelines

## Architecture

This is a Spring Boot 3 WebFlux API using Java 21, Spring Security JWT resource server support, R2DBC MySQL, Redis, Liquibase migrations, LiveKit server SDK clients, and S3-compatible avatar storage.

Main package layout:

- `controller/`: HTTP endpoints. Keep controllers thin and delegate business rules to services.
- `service/`: application logic for auth, users, rooms, agents, workspaces, channels, messages, avatars, sound clips, and LiveKit tokens.
- `infrastructure/db/repository/`: Spring Data R2DBC repositories and custom SQL queries.
- `model/dto/`: request and response records/classes that define frontend contracts.
- `model/entity/`: database entities mapped by R2DBC.
- `model/domain/`: enums and domain objects shared across services.
- `configuration/` and `security/`: app properties, beans, JWT, CORS, and authorization wiring.
- `handler/exception/`: global HTTP error handling.

## Reactive and Blocking Boundaries

- Preserve WebFlux return types for request flows. Prefer `Mono`/`Flux` for DB-backed logic.
- Do not call `.block()` in controller or service request paths.
- LiveKit Java SDK calls are blocking in the existing code. Keep them isolated behind services and wrap controller entry points with `Mono.fromRunnable` / `Mono.fromCallable` when exposing reactive endpoints.
- Repository methods should return Reactor types and keep SQL explicit when derived queries would hide important filters such as `blocked_at`, `deleted_at`, or membership checks.

## Security and Access Rules

- JWT roles come from the `scope` claim and are converted to `ROLE_*`.
- `/admin/**` requires `ADMIN`; `/auth` and `/auth/refresh` are public; room and LiveKit token endpoints require authentication unless security config is intentionally changed.
- When adding endpoints, check both `SecurityConfiguration` path rules and method-level `@PreAuthorize`.
- Keep user/room/workspace/channel membership checks in services, not in frontend-only logic.

## API Contracts

- Keep DTO names and field names stable unless all frontend callers are updated in the same change.
- For LiveKit agents, preserve these shared assumptions unless you migrate backend, frontend, and `agents/` together:
  - agent identities start with `agent-`;
  - agent participant metadata contains `isMuted`;
  - backend control messages use topics such as `control.muted`, `control.set_target`, `control.stop_tts`, and `control.leave`.
- For avatars and sound clips, preserve S3 object-key and URL semantics expected by the client.

## Persistence

- Schema changes must be Liquibase formatted SQL migrations, not ad hoc startup DDL.
- Keep MySQL table and column names consistent with existing singular table names such as `user`, `room`, `workspace`, `channel`, and `message`.
- Add indexes for new access patterns that read by foreign key, visibility flag, cursor, or soft-delete column.

## Verification

From `backend/`, run `./mvnw -pl api test` after Java, resource, or migration changes. If you changed only docs, no Maven run is required.

