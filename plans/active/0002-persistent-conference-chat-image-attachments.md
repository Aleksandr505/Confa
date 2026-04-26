---
title: Persistent Conference Chat And Image Attachments
status: active
owner: core-team
created: 2026-04-26
updated: 2026-04-26
applies_to:
  - backend/api/
  - frontend/client/
  - deploy/
related_docs:
  - docs/contracts/shared-runtime-contracts.md
  - docs/architecture/system-context.md
  - docs/operations/deployment.md
---

# Persistent Conference Chat And Image Attachments

## Goal

Persist conference chat history and add image attachments to both conference chat and messenger chats without allowing uncontrolled media growth in object storage.

## Scope

In scope:

- persistent conference room chat history;
- image attachments for conference chat messages;
- image attachments for messenger channel and DM messages;
- storage policy for validation, optimization, quotas, cleanup, and retention;
- client UI for upload preview and image rendering;
- backend APIs and database migrations;
- docs for shared message and attachment contracts.

Out of scope:

- arbitrary file attachments;
- video, audio, GIF animation support, or document previews;
- end-to-end encryption;
- full realtime delivery infrastructure beyond the minimal approach chosen for the first implementation;
- rich text editor changes unrelated to images.

## Context

- Current conference chat:
  - `frontend/client/src/pages/Room.tsx` renders LiveKit `<Chat />`.
  - LiveKit chat state is not canonical and does not survive user re-entry as backend history.
- Current messenger chat:
  - `backend/api/src/main/java/space/confa/api/service/MessageService.java`
  - `backend/api/src/main/java/space/confa/api/model/entity/MessageEntity.java`
  - `frontend/client/src/pages/ChannelView.tsx`
  - `frontend/client/src/pages/DmView.tsx`
- Current room access:
  - `backend/api/src/main/java/space/confa/api/model/entity/RoomEntity.java`
  - `backend/api/src/main/java/space/confa/api/service/RoomAccessService.java`
- Current object storage patterns:
  - avatar storage through S3-compatible storage;
  - sound clips through room-bound sound APIs;
  - MinIO in local and deploy compose.
- Relevant docs:
  - `docs/contracts/shared-runtime-contracts.md`
  - `docs/architecture/system-context.md`
  - `docs/operations/deployment.md`

## Key Decisions To Make First

- Conference chat canonical source:
  - recommended direction: backend database is canonical;
  - LiveKit chat/data messages may be used only as a delivery or refresh signal.
- Conference message storage model:
  - option A: new `room_chat_message` table keyed by `room_id`;
  - option B: generalize existing `message` table to support both `channel_id` and `room_id`;
  - recommended first step: choose explicitly before migration; avoid keeping two incompatible message DTOs if attachment support should be shared.
- Realtime behavior:
  - first version can use polling consistent with current messenger screens;
  - later version can add WebSocket/SSE/LiveKit data notification.
- Image upload path:
  - recommended direction: backend-mediated upload first, so backend can validate, resize, strip metadata, and control storage usage.

## Storage Policy

Initial policy should be implemented before broad UI rollout:

- allow only `image/jpeg`, `image/png`, and `image/webp` at first;
- reject files above a configured upload size limit;
- decode and validate image dimensions server-side;
- strip EXIF/metadata;
- generate a thumbnail;
- store an optimized display image instead of the original when possible;
- keep object keys scoped by owner and message scope;
- track original size, stored size, width, height, content type, and owner;
- soft-delete attachment rows when messages are deleted;
- delete orphaned uploads that were never attached to a message;
- add per-user or per-room upload limits before enabling unrestricted use.

Open limit values should be decided before implementation. Suggested starting point: small upload limit, bounded image dimensions, and conservative retention for conference-room attachments.

## Backend Plan

- [ ] Decide whether room chat reuses `message` or gets a dedicated room message table.
- [ ] Add migrations for persistent conference chat messages.
- [ ] Add migrations for attachments and message/room-message attachment links.
- [ ] Add backend attachment storage service with server-side image validation and optimization.
- [ ] Add conference chat API:
  - `GET /rooms/{roomName}/messages`
  - `POST /rooms/{roomName}/messages`
  - optional delete/edit endpoints if included in first version.
- [ ] Gate room chat APIs through `RoomAccessService.checkUserCanJoin`.
- [ ] Extend messenger message APIs and DTOs to include attachments.
- [ ] Add cleanup path for orphaned attachments.
- [ ] Add configurable limits through `application.yml` and deploy env vars.

## Frontend Plan

- [ ] Replace or wrap LiveKit `<Chat />` in `Room.tsx` with a custom chat panel backed by API history.
- [ ] Load conference chat history when entering or re-entering a room.
- [ ] Send conference messages through the backend, not only through LiveKit local chat state.
- [ ] Add optimistic UI only after backend persistence succeeds or with clear rollback.
- [ ] Add image picker and preview to conference chat.
- [ ] Add image picker and preview to messenger channel/DM composers.
- [ ] Render thumbnails in message timelines.
- [ ] Open full image view from thumbnails.
- [ ] Show upload validation errors clearly.

## Deployment And Operations Plan

- [ ] Add env vars for upload size, image dimensions, retention, and storage bucket if needed.
- [ ] Document storage growth risks in deployment docs.
- [ ] Add a cleanup runbook or scheduled cleanup task for orphaned or expired attachments.
- [ ] Confirm MinIO/S3 public URL behavior for thumbnails and display images.

## Verification

- [ ] Backend test: user can list room chat history only for rooms they can join.
- [ ] Backend test: posted conference chat message persists and appears after re-entry.
- [ ] Backend test: oversized or unsupported images are rejected.
- [ ] Backend test: attachment metadata is stored and linked to the message.
- [ ] Backend test: deleted message hides or soft-deletes attachments.
- [ ] Client test/manual: conference chat history survives page reload or room re-entry.
- [ ] Client test/manual: messenger image attachment appears in channel and DM timelines.
- [ ] Backend check: `cd backend && ./mvnw -pl api test`.
- [ ] Client build: `cd frontend/client && npm run build`.

## Open Questions

- Should conference chat messages support edit/delete in the first version?
- Should conference chat history have retention by default, or should it persist indefinitely like messenger messages?
- What exact per-file, per-user, and per-room quotas are acceptable for current disk limits?
- Should images be served through backend proxy endpoints or direct presigned/object URLs?
- Should attachment upload be a single multipart message request or a separate upload-then-send flow?

## Handoff Notes

Do not start with UI-only LiveKit Chat customization. The clarified requirement is persistent conference chat history, so the first architectural step is choosing and implementing a backend-backed room chat model.

