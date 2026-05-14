---
title: Persistent Conference Chat And Image Attachments
status: active
owner: core-team
created: 2026-04-26
updated: 2026-05-13
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
- client-side image compression before upload;
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
- Image processing pipeline:
  - recommended direction: client compresses images before upload for latency and bandwidth;
  - backend still treats client output as untrusted and repeats validation, decoding, metadata stripping, and size/dimension enforcement;
  - do not store original chat images by default; store only optimized display image and thumbnail, with original metadata recorded for audit/debug.

## Initial Image Limits

Use explicit starting limits instead of leaving media growth open-ended:

- accepted input types: `image/jpeg`, `image/png`, and `image/webp` if backend WebP decoding is supported;
- client upload target: compress to `<= 512000` bytes, approximately 500 KiB;
- client display dimensions target: downscale to a maximum edge of `1280px`;
- backend raw upload hard limit: configurable, suggested `5242880` bytes, approximately 5 MiB;
- backend decoded dimensions hard limit before resize: configurable, suggested max edge `4096px` and max total pixels `16000000`;
- backend stored display image limit: `<= 512000` bytes after backend optimization;
- backend stored display dimensions: maximum edge `1280px`;
- backend thumbnail dimensions: maximum edge `320px`;
- backend thumbnail size target: `<= 81920` bytes, approximately 80 KiB;
- maximum attachments per message: suggested first limit is `1` image.

If backend cannot produce a stored display image within the configured byte and dimension limits, reject the upload with a clear validation error instead of storing the oversized object.

## Storage Policy

Initial policy should be implemented before broad UI rollout:

- allow only `image/jpeg`, `image/png`, and `image/webp` at first;
- reject files above a configured upload size limit;
- verify file signatures and decoded image format instead of trusting only multipart `Content-Type`;
- decode and validate image dimensions server-side;
- reject image bombs through maximum pixel count and maximum dimensions before resizing;
- strip EXIF/metadata;
- generate a thumbnail;
- store an optimized display image instead of the original for chat attachments;
- keep object keys scoped by owner and message scope;
- track original size, original content type, stored size, width, height, stored content type, checksum, owner, and attachment status;
- soft-delete attachment rows when messages are deleted;
- delete orphaned uploads that were never attached to a message;
- add per-user or per-room upload limits before enabling unrestricted use.

Conference-room attachment retention should be conservative unless product requirements explicitly require permanent conference media history.

## Backend Plan

- [x] Decide whether room chat reuses `message` or gets a dedicated room message table.
- [x] Add migrations for persistent conference chat messages.
- [x] Add migrations for attachments and message/room-message attachment links.
- [x] Add attachment DTOs to message responses, including thumbnail URL, display URL, dimensions, size, content type, and alt/original filename metadata if retained.
- [x] Add backend attachment storage service with server-side image validation, optimization, metadata stripping, thumbnail generation, and stored-size enforcement.
- [x] Add upload status tracking such as `PENDING`, `ATTACHED`, and `DELETED` so orphaned uploads can be cleaned safely.
- [x] Add conference chat API:
  - `GET /rooms/{roomName}/messages`
  - `POST /rooms/{roomName}/messages`
  - optional delete/edit endpoints if included in first version.
- [x] Gate room chat APIs through `RoomAccessService.checkUserCanJoin`.
- [x] Extend messenger message APIs and DTOs to include attachments.
- [x] Support image-only messages by allowing an empty body when at least one attachment is attached.
- [x] Add cleanup path for orphaned attachments.
- [x] Add configurable limits through `application.yml` and deploy env vars.
- [x] Decide whether image content is served through access-checked backend proxy endpoints or short-lived presigned URLs.

## Frontend Plan

- [x] Replace or wrap LiveKit `<Chat />` in `Room.tsx` with a custom chat panel backed by API history.
- [x] Load conference chat history when entering or re-entering a room.
- [x] Send conference messages through the backend, not only through LiveKit local chat state.
- [x] Add optimistic UI only after backend persistence succeeds or with clear rollback.
- [x] Add shared client image compression helper for conference, channel, and DM composers.
- [x] Downscale selected images to the configured maximum edge and re-encode to the configured target size before upload.
- [x] Prefer `image/webp` output when browser and backend support it; otherwise fall back to JPEG for photos and PNG only when needed.
- [x] Add image picker and preview to conference chat.
- [x] Add image picker and preview to messenger channel/DM composers.
- [x] Show pre-upload metadata in preview: compressed size and dimensions.
- [x] Render thumbnails in message timelines.
- [x] Open full image view from thumbnails.
- [x] Show upload validation errors clearly.
- [x] Clear selected image state on successful send, failed send rollback, route change, or composer reset.

## Deployment And Operations Plan

- [x] Add env vars for raw upload size, stored display size, image dimensions, thumbnail dimensions, retention, per-user/per-room quotas, and storage bucket if needed.
- [x] Document storage growth risks in deployment docs.
- [x] Add a cleanup runbook or scheduled cleanup task for orphaned or expired attachments.
- [x] Confirm MinIO/S3 public URL behavior for thumbnails and display images.

## Verification

- [ ] Backend test: user can list room chat history only for rooms they can join.
- [ ] Backend test: posted conference chat message persists and appears after re-entry.
- [ ] Backend test: oversized or unsupported images are rejected.
- [ ] Backend test: image with spoofed multipart content type is rejected after decode/signature validation.
- [ ] Backend test: oversized decoded dimensions or pixel count are rejected before storage.
- [ ] Backend test: stored display image and thumbnail stay within configured byte and dimension limits.
- [ ] Backend test: attachment metadata is stored and linked to the message.
- [ ] Backend test: deleted message hides or soft-deletes attachments.
- [ ] Backend test: image-only message is allowed only when it has a valid attached image.
- [ ] Client test/manual: selected large image is compressed before upload to the configured byte and dimension targets.
- [ ] Client test/manual: conference chat history survives page reload or room re-entry.
- [ ] Client test/manual: messenger image attachment appears in channel and DM timelines.
- [x] Backend check: `cd backend && ./mvnw -pl api test`.
- [x] Client build: `cd frontend/client && npm run build`.

## Open Questions

- Should conference chat messages support edit/delete in the first version?
- Should conference chat history have retention by default, or should it persist indefinitely like messenger messages?
- What exact per-file, per-user, and per-room quotas are acceptable for current disk limits?
- Should images be served through backend proxy endpoints or direct presigned/object URLs?
- Should attachment upload be a single multipart message request or a separate upload-then-send flow with `PENDING` attachment status?
- If WebP decoding/encoding is not available server-side, should the first backend implementation accept only JPEG/PNG even if the client can produce WebP?
- Should conference attachments expire earlier than messenger attachments?

## Handoff Notes

Do not start with UI-only LiveKit Chat customization. The clarified requirement is persistent conference chat history, so the first architectural step is choosing and implementing a backend-backed room chat model.
