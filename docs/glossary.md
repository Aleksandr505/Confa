---
title: Glossary
summary: Shared project terms used across Confa modules.
doc_type: reference
status: active
owner: core-team
last_reviewed: 2026-04-26
applies_to:
  - backend/
  - frontend/
  - agents/
  - deploy/
related:
  - docs/contracts/shared-runtime-contracts.md
  - docs/architecture/system-context.md
---

# Glossary

| Term | Meaning |
| --- | --- |
| Admin SPA | React app in `frontend/admin-client` for bootstrap, users, room monitoring, and agent management. |
| Agent | AI voice participant run by the LiveKit Agents worker. Agent identities start with `agent-`. |
| Agent role | Worker persona selected by dispatch metadata. Current roles are `bored`, `friendly`, and `funny`. |
| Bootstrap | First-admin creation flow guarded by `INIT_BOOTSTRAP_SERVICE_KEY`. |
| Channel | Workspace communication unit. Current channel types are `TEXT`, `VOICE`, and `DM`. |
| Client SPA | User-facing React app in `frontend/client`. |
| Confa room | Application room record or LiveKit room name depending on context. Check the surrounding controller/service before changing behavior. |
| Dispatch | LiveKit job request created by the backend to invite an agent worker into a room. |
| DM | Direct-message channel between two users. |
| LiveKit room token | JWT issued by the backend so a browser can connect to LiveKit. |
| Participant metadata | JSON metadata attached to a LiveKit participant. Agents use it for state such as `isMuted`. |
| Room metadata | JSON metadata attached to a LiveKit room. The client uses `isAgentsEnabled` to decide whether agent controls should be available. |
| Soundboard | User SPA feature for room-bound audio clips backed by API sound endpoints and object storage. |
| Workspace | Top-level collaboration container that owns channels and members. |

