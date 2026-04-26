# Admin SPA Guidelines

## Purpose

This is the admin React + Vite app. It handles first-admin bootstrap, admin login, user management, active room monitoring, participant visibility, and agent removal.

## Structure

- `src/App.tsx`: bootstrap state, routes, auth guard, and layout composition.
- `src/api.ts`: admin API functions and DTO types.
- `src/lib/http.ts`: authenticated fetch and token refresh.
- `src/components/AdminLayout.tsx`: shared navigation/layout.
- `src/pages/`: bootstrap, login, users, and rooms pages.
- `src/styles.css`, `src/App.css`, `src/index.css`: global app styling.

## Admin Contracts

- Admin APIs are protected by backend `/admin/**` security and should still assume the network-level admin host restriction described in deploy docs.
- Bootstrap flow calls `/admin/bootstrap/status` and `/admin/bootstrap`; do not expose or persist the service key beyond the form submission.
- User management DTOs mirror backend `UserDto` and admin create/block/unblock/delete endpoints.
- Room monitoring combines `/rooms`, `/rooms/{room}/participants`, and `/rooms/{room}/agents`; agent rows are identified by backend data and `agent-` identity fallback.

## UI and Safety

- Keep destructive actions explicit. The current agent kick flow uses confirmation; preserve this pattern for delete/block/kick operations.
- Keep admin screens dense and operational rather than decorative.
- Avoid sharing admin-only components or routes with the user SPA.

## Verification

Run from `frontend/admin-client`:

```bash
npm run build
npm run lint
```

