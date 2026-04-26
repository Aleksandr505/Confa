# Frontend Guidelines

## Scope

`frontend/client` and `frontend/admin-client` are separate React + TypeScript + Vite apps. They share backend contracts but have independent package-lock files, styles, routes, and Docker images.

## Shared Conventions

- Use npm in both frontend apps.
- Keep API calls in `src/api.ts` or narrow helpers under `src/lib/`.
- Keep token storage and refresh behavior in the existing auth/http helpers.
- Use `VITE_API_BASE` for backend HTTP calls. The user client also uses `VITE_LIVEKIT_WS_URL`.
- Do not duplicate DTO shapes casually. If backend DTOs change, update the TypeScript types and all callers together.
- Keep build-time env behavior in mind: Vite embeds `VITE_*` values at build time.

## UI Work

- Preserve each app's current visual language unless the task asks for a redesign.
- Keep dense operational screens clear and predictable. Avoid adding marketing-style sections to app surfaces.
- For LiveKit UI changes, test camera/mic permission states, prejoin, connection state, and participant metadata-driven controls where possible.

