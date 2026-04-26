# Client SPA Guidelines

## Purpose

This is the user-facing React + Vite app. It handles login, room entry, LiveKit conferencing, agent controls, workspaces, channels, DMs, avatars, and soundboard flows.

## Structure

- `src/main.tsx`: route definitions and auth loaders.
- `src/api.ts`: backend API wrapper functions and DTO types.
- `src/lib/http.ts`: authenticated fetch, token refresh, JSON handling, and FormData header behavior.
- `src/lib/auth.ts` and `src/auth.ts`: token/session helpers and compatibility exports.
- `src/pages/`: route-level screens, including `Room.tsx` for LiveKit conferencing and `AppShell.tsx` for workspace navigation.
- `src/components/`: reusable UI such as message timeline and soundboard.
- `src/styles/`: route and feature CSS.

## Client Contracts

- Keep access tokens attached through `src/lib/http.ts`; do not hand-roll auth headers in new API helpers unless login semantics require raw `fetch`.
- Room and channel voice flows use LiveKit tokens from `/livekit/token` and `/api/channels/{id}/livekit-token`.
- Agent UI depends on backend and worker contracts:
  - identities starting with `agent-`;
  - metadata-derived muted state;
  - room metadata flag `isAgentsEnabled`.
- Avatar URLs can be relative API paths or absolute URLs. Preserve the existing conversion to `${VITE_API_BASE}${contentUrl}` for relative paths.

## React and State

- Keep route-level fetching inside pages or shell context. Avoid introducing a global state library unless the task clearly requires it.
- Existing message views use polling and cursor/page DTOs. Preserve read-state updates and avatar resolution caches when changing channel or DM flows.
- Be careful with browser-only APIs such as `localStorage`, `AudioContext`, media devices, and `performance`; keep them inside effects or event handlers.

## Verification

Run from `frontend/client`:

```bash
npm run build
npm run lint
```

For conferencing changes, also exercise the app against a running backend and LiveKit server when available.

