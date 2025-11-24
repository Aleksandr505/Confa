# Agents Module

## Overview

The **agents** module contains a Node.js / TypeScript service that runs LiveKit voice AI agents. It connects to a LiveKit Cloud or self‑hosted LiveKit server and spawns one or more agents that can join rooms, listen to participants, and respond with synthesized speech.

Key responsibilities:

* Manage a single or multiple AI agents ("Agent" role) per room.
* Integrate with different LLM providers (e.g., OpenAI, YandexGPT) and TTS/STT providers.
* Respect mute / unmute and focus commands coming from the backend via LiveKit data messages.
* Keep per‑agent state (e.g., soft mute) in participant metadata, so backend and frontend can read it.

## Prerequisites

* Node.js 20+ and pnpm installed locally.
* Running LiveKit instance (Cloud or self-hosted).
* Valid API keys for:

    * LiveKit
    * LLM provider (OpenAI and/or YandexGPT)
    * STT provider (Deepgram)
    * TTS provider (Cartesia)

All configuration is provided through a local `.env.local` file.

## Environment variables

Typical variables used by the agents service:

```bash
LIVEKIT_URL=wss://live.example.com
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

LLM_PROVIDER=openai            # or "yandex"

DEEPGRAM_API_KEY=yourkey
OPENAI_API_KEY=...
CARTESIA_API_KEY=...

YANDEX_CLOUD_API_KEY=...
YANDEX_CLOUD_FOLDER=...
YANDEX_CLOUD_MODEL=...


```

Create `.env.local` in the project root and fill in the values.

## Installation

From the `agents` module directory:

```bash
pnpm install
```

This will install the agents SDK (`@livekit/agents`) and all provider plugins.

## Available scripts

The `package.json` exposes several scripts for local development and running the worker:

```json
"scripts": {
  "dev": "tsx src/agent.ts dev",
  "start": "tsx src/agent.ts start",
  "download-files": "tsx src/agent.ts download-files",
  "build": "tsc"
}
```

### `pnpm dev`

Runs the agents worker in **development mode**, usually with extended logging:

```bash
pnpm dev
```

### `pnpm start`

Runs the agents worker in **normal worker mode**. This is what you typically use in Docker / production:

```bash
pnpm start
```

The worker connects to LiveKit and waits for dispatch jobs. When the backend calls `createDispatch(...)` for a room, the worker spawns an agent into that room.

### `pnpm download-files`

Optional helper used by the LiveKit Agents CLI to pre-download model files (e.g. VAD models) before starting:

```bash
pnpm download-files
```

### `pnpm build`

Type-checks and compiles the TypeScript sources into JavaScript in `dist/`:

```bash
pnpm build
```

## High-level flow

1. Backend issues a dispatch for a room (e.g. `/rooms/{room}/agents/invite`).
2. LiveKit sends a job to the agents worker.
3. `src/agent.ts` accepts the job and connects to the room under an identity like `agent-<jobId>`.
4. The agent listens to remote audio, sends it through STT → LLM → TTS, and publishes synthesized audio back into the room.
5. Backend can soft-mute, change focus user, or ask the agent to leave via LiveKit data messages (`control.muted`, `control.set_target`, `control.leave`).

## Notes

* The module is designed to be **provider-agnostic** — switching LLM/STT/TTS backends is controlled via environment variables.
* Agent-specific state (e.g. `isMuted`, `invitedBy`) is stored in the agent participant's metadata so that Spring Boot backend and the frontend UI can consume it consistently.
