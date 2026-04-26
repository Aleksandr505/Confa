# Confa Realtime Conferencing Platform

A compact but production-style demo of a secure, AI-assisted video conferencing stack:

* **LiveKit** – SFU & agents
* **Spring Boot WebFlux** – backend API
* **React + Vite** – client & admin SPAs
* **MySQL + Liquibase** – persistence & migrations
* **Caddy** – TLS & reverse proxy

---

## Tech Stack

**Backend**
`☕ Spring Boot` · `⚡ WebFlux` · `🔐 Spring Security (JWT)` · `🐬 MySQL` · `🧱 Liquibase` · `📡 LiveKit Java SDK`

**Client SPA**
`⚛️ React` · `⚡ Vite` · `🎥 @livekit/components-react` · `🎨 Custom CSS theme`

**Admin SPA**
`⚛️ React` · `⚡ Vite` · `🧭 Admin UI for users & agents`

**Agents Module**
`🧠 Node.js` · `🗣 LiveKit Agents` · `🤖 LLM/STT/TTS pluggable`

**Infra**
`🧊 Docker` · `🌐 Caddy` · `🎧 LiveKit Server`

---

## Documentation

Start with [`docs/index.md`](docs/index.md) for repository documentation.

Useful entry points:

* [`docs/references/repo-map.md`](docs/references/repo-map.md) – module map and verification commands
* [`docs/architecture/system-context.md`](docs/architecture/system-context.md) – runtime components and major flows
* [`docs/contracts/shared-runtime-contracts.md`](docs/contracts/shared-runtime-contracts.md) – contracts shared by backend, frontends, agents, and deploy
* [`docs/operations/local-development.md`](docs/operations/local-development.md) – local startup and validation
* [`docs/operations/deployment.md`](docs/operations/deployment.md) – deployment runbook for the current Compose stack
* [`docs/security/auth-and-access.md`](docs/security/auth-and-access.md) – auth, roles, bootstrap, CORS, and admin access
* [`docs/documentation-playbook.md`](docs/documentation-playbook.md) – rules for keeping docs useful
* [`plans/README.md`](plans/README.md) – working plans for multi-step tasks

---

## Architecture Overview

Public entrypoints:

* `https://example.com` – **Client SPA** (login + LiveKit conference UI)
* `https://api.example.com` – **Backend API** (auth, LiveKit tokens, admin & agent control)
* `https://live.example.com` – **LiveKit Server** (signaling + media)
* `https://admin.example.com` – **Admin SPA** (reachable only from VPN / allow-listed IPs)

Core ideas:

* Backend issues **JWT access/refresh tokens** and **LiveKit room tokens**.
* Roles: `USER` and `ADMIN`; admin-only endpoints for user & room management.
* Each room has metadata flag `isAgentsEnabled`; AI agents can be invited only when this flag is true.
* Admin access is protected twice:

    * application-level (JWT with `ADMIN` role), and
    * network-level (Caddy only trusts traffic from VPN / specific IPs).

---

## Main Components

### Backend API

Responsibilities:

* `POST /auth`, `POST /auth/refresh` – login + token refresh
* `POST /livekit/token` – issue LiveKit JWTs for rooms
* `/rooms/{room}/config` – expose room metadata (e.g. `isAgentsEnabled`)
* `/rooms/{room}/agents/enable|disable` – ADMIN-only toggles for agents feature
* `/rooms/{room}/agents` – list AI agents in a room
* `/rooms/{room}/agents/invite|kick` – control agents via LiveKit Room/Agent APIs
* `/admin/**` – user CRUD, block/unblock, first-admin bootstrap

### Client SPA (User)

Features:

* Login form → stores access token, handles refresh automatically
* Room page `/room/:roomId` with:

    * Pre-join screen (name, mic/cam, devices)
    * LiveKit connection via `<LiveKitRoom>` and `<VideoConference>`
    * Custom layout & permission banners
* If `isAgentsEnabled` is true:

    * Agent bar with invite roles
    * Agent selector + actions: mute/unmute, kick

### Admin SPA

Features:

* **Bootstrap**: when no admins exist, show one-time form with service key to create the first admin
* Login as admin
* User management:

    * list users, create, block/unblock, delete
* Room & agent visibility:

    * view current rooms/participants
    * filter agents vs users, kick agents, inspect their info

Network access is limited to VPN/IP allowlist on `admin.example.com`.

### Agents Module

Located in `agents/`, this module runs the **voice AI workers** that connect to LiveKit and power the agent experience in rooms.

Key points:

* Node.js / TypeScript service using `@livekit/agents`.
* Connects to LiveKit via `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
* Pluggable providers via environment variables:

    * `LLM_PROVIDER` – e.g. `openai` or `yandex`.
    * STT: Deepgram (`DEEPGRAM_API_KEY`).
    * TTS: Cartesia (`CARTESIA_API_KEY`).
* Keeps **per-agent state** (e.g. soft mute, invitedBy) in participant metadata so backend and frontend can read it.
* Listens for control messages from backend (mute/unmute, focus on user, leave room) over LiveKit data channels.
* Typical commands:

    * `pnpm dev` – development mode, verbose logs.
    * `pnpm start` – production worker mode (used in Docker).

High-level flow:

1. Backend issues a dispatch for a room (e.g. `/rooms/{room}/agents/invite`).
2. LiveKit sends a job to the agents worker.
3. Worker joins the room as `agent-<jobId>`.
4. Agent listens to audio → STT → LLM → TTS → publishes synthesized audio back to the room.
5. Backend and admin UI can mute/focus/kick the agent via control messages and participant metadata.

---

## Deployment (Short)

Typical production setup (see `deploy/docker-compose.yml` + `Caddyfile`):

* `caddy` – public entry, TLS for all domains
* `backend` – Spring Boot API
* `client` – user SPA (nginx)
* `admin-client` – admin SPA (nginx)
* `livekit` – LiveKit server
* `mysql` – database

The AI agents worker is implemented in `agents/`, but the current `deploy/docker-compose.yml` does not declare an `agents` service yet. See `docs/operations/deployment.md` for the current deployment runbook and known cleanup items.

Basic flow:

1. Build Docker images for `backend`, `client`, `admin-client`, and `agents`.
2. Configure environment (DB creds, JWT secret, LiveKit API keys, provider API keys, service admin key).
3. Set DNS: `example.com`, `api.example.com`, `live.example.com`, `admin.example.com`.
4. Start stack with Docker Compose.
5. Configure OpenVPN on a separate server; in Caddy allow only VPN host/IP for `admin.example.com`.

---

## Local Development

**Backend**

```bash
cd backend
./mvnw -pl api spring-boot:run
```

**Client SPA**

```bash
cd frontend/client
npm install
npm run dev
```

**Admin SPA**

```bash
cd frontend/admin-client
npm install
npm run dev
```

**Agents**

```bash
cd agents
pnpm install
pnpm download-files
pnpm dev
```

**LiveKit (dev)** – run official Docker image and point `LIVEKIT_URL` / `VITE_LIVEKIT_WS_URL` to it.

---

## Notes

* This project is a **demo / reference** setup for:

    * secure LiveKit conferencing,
    * multi-role backend with Spring WebFlux,
    * SPA clients (user + admin),
    * AI agents powered by pluggable LLM/STT/TTS providers,
    * network-hardening via VPN + reverse proxy.
* Review secrets management, JWT TTLs and DB schema before using it in production.
