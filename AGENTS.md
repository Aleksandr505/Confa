# Repository Guidelines

## Project Shape

Confa is a realtime conferencing and messenger monorepo. The main parts are:

- `backend/`: Java 21 Maven parent with the Spring Boot WebFlux API in `backend/api`.
- `frontend/client/`: user React + Vite SPA for login, rooms, conferencing, workspaces, DMs, avatars, and soundboard UI.
- `frontend/admin-client/`: admin React + Vite SPA for bootstrap, users, rooms, participants, and agents.
- `agents/`: Node.js/TypeScript LiveKit Agents worker.
- `deploy/`: Docker Compose, Caddy, LiveKit, env generation, and image build scripts.

Prefer the closest nested `AGENTS.md` when working inside a module.

## General Rules

- Keep cross-module contracts explicit. API DTOs, LiveKit room names, participant identities, participant metadata, JWT claims, and env variable names are shared by multiple modules.
- Do not commit secrets or generated local state. Keep `.env`, `*.local`, `node_modules`, `dist`, `target`, and deployment build envs out of source changes.
- Existing README files are useful context, but the source code is authoritative when they differ.
- Use the package manager already present in each module: Maven wrapper in `backend`, npm in both frontend apps, pnpm in `agents`.
- Keep changes scoped to the module being modified. Avoid broad formatting-only churn across Java, TypeScript, CSS, YAML, or SQL files.

## Common Verification

- Backend API: `cd backend && ./mvnw -pl api test`
- User SPA: `cd frontend/client && npm run build` and `npm run lint`
- Admin SPA: `cd frontend/admin-client && npm run build` and `npm run lint`
- Agents worker: `cd agents && pnpm build`

Run the checks that match the files you changed. If a check needs external services or credentials, state that instead of faking coverage.

