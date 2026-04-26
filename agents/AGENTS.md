# Agents Worker Guidelines

## Purpose

This module is a Node.js/TypeScript LiveKit Agents worker. It accepts LiveKit dispatch jobs from the backend, joins rooms as voice AI participants, runs STT -> LLM -> TTS, and responds to backend control messages over LiveKit data channels.

## Package and Runtime

- Use pnpm. The lockfile is `pnpm-lock.yaml`.
- Source is ESM TypeScript. Imports that target local TS files should keep the `.js` extension used by NodeNext output.
- Prefer editing `.ts` sources. Existing `.js`, `.d.ts`, and `.map` files under `src/` are TypeScript compiler outputs; only update them deliberately when the task requires generated artifacts to stay in sync.
- Main scripts:
  - `pnpm dev`: run the worker in LiveKit agents development mode with debug logging.
  - `pnpm start`: run production worker mode.
  - `pnpm download-files`: pre-download LiveKit/Silero model files.
  - `pnpm build`: TypeScript verification.

## Source Layout

- `src/agent.ts`: worker entry point, dispatch acceptance, provider selection, room connection, metadata updates, and control message handling.
- `src/configuration/config.ts`: agent role definitions and instructions.
- `src/configuration/configurableAgent.ts`: `voice.Agent` subclass with hard-mute/wake-word behavior.
- `src/speechkit/`: Yandex SpeechKit STT/TTS adapters.

## Shared Contracts

- Backend dispatch metadata currently contains `{ "role": "<agent-role>" }`.
- Supported roles are `bored`, `friendly`, and `funny`; update backend/frontend role selectors if this union changes.
- Agent identities are accepted as `agent-<role>-<jobId>` and the backend/frontend rely on the `agent-` prefix.
- Participant metadata should remain JSON and include `isMuted` when mute state changes.
- Recognized control message topics include `control.muted`, `control.set_target`, `control.stop_tts`, and `control.leave`.

## Provider Configuration

- `.env.local` is loaded for local development and must not be committed.
- LiveKit credentials are expected via `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` as required by the LiveKit Agents runtime.
- Provider env vars include `STT_PROVIDER`, `LLM_PROVIDER`, `TTS_PROVIDER`, OpenAI keys, Cartesia keys, and Yandex Cloud/SpeechKit settings.
- Use `requireEnv` for variables that are mandatory for a selected provider path.

## Verification

Run `pnpm build` after TypeScript changes. For behavior changes, run `pnpm dev` against a real LiveKit instance and invite an agent through the backend.
