---
title: Documentation Playbook
summary: Practical rules for keeping Confa documentation useful for coding agents and maintainers.
doc_type: reference
status: active
owner: core-team
last_reviewed: 2026-04-26
source_of_truth: true
applies_to:
  - README.md
  - AGENTS.md
  - backend/
  - frontend/
  - agents/
  - deploy/
---

# Documentation Playbook

## Purpose

Use this playbook when adding, pruning, or restructuring documentation in this repository.

Good documentation here should help an agent answer four questions quickly:

- what part of Confa is being changed;
- which source files are canonical;
- which contracts are shared across modules;
- how the change should be validated.

Do not use this file as a reason to create a large docs tree. Add documentation only when it records knowledge that is useful for future changes.

## Repository Documentation Map

- `README.md`: human-facing overview of the whole system.
- `AGENTS.md`: root agent routing, shared constraints, and verification commands.
- `<module>/AGENTS.md`: local rules that differ from the repository defaults.
- `docs/`: durable cross-cutting knowledge that does not belong to a single source directory.
- `plans/`: temporary working plans for active or recently completed multi-step tasks.
- Existing code, migrations, manifests, and deployment files remain the source of truth for behavior.

Current major areas:

- `backend/api`: Spring Boot WebFlux API, auth, R2DBC repositories, Liquibase migrations, LiveKit integration, S3-compatible storage.
- `frontend/client`: user SPA for rooms, LiveKit conferencing, workspaces, DMs, avatars, and soundboard.
- `frontend/admin-client`: admin SPA for bootstrap, users, active rooms, participants, and agents.
- `agents`: LiveKit Agents worker and STT/LLM/TTS provider wiring.
- `deploy`: Docker Compose, Caddy, LiveKit config, env generation, and image build scripts.

## What To Document

Document a change when it affects any of these:

- API endpoints, DTO fields, JWT claims, auth rules, or frontend API wrappers;
- database schema, migrations, indexes, enum values, or soft-delete behavior;
- LiveKit room names, token flow, participant identities, participant metadata, or agent control topics;
- environment variables, deployment topology, Caddy routing, object storage, Redis, MySQL, or LiveKit settings;
- operational commands, validation steps, failure modes, or recovery procedures;
- local development setup that is not obvious from package manifests or build files.

Skip documentation when the code is self-explanatory and the behavior is local, private, and covered by nearby names or tests.

Use `plans/` instead of durable docs when the content is task-specific, temporary, or only needed for handoff during implementation.

## Canonical Sources

Prefer linking to canonical artifacts instead of duplicating them in prose.

- Backend contracts: controllers, DTOs, services, security config, and Liquibase migrations under `backend/api`.
- Frontend contracts: `frontend/*/src/api.ts`, auth/http helpers, route definitions, and LiveKit UI code.
- Agent contracts: `agents/src/agent.ts`, role config, metadata shape, and data-channel topic handling.
- Deployment contracts: `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/livekit.yaml`, and env generation scripts.

If documentation conflicts with source code, fix the documentation or explicitly call out the mismatch. Do not preserve stale text for compatibility.

## Writing Rules

- Keep root and local `AGENTS.md` files short. Put detailed explanations or runbooks in `docs/` or module `README.md` files.
- Do not duplicate the same command, env variable list, or architecture description across many files.
- Prefer concrete paths, commands, DTO names, endpoint names, and env var names over broad guidance.
- Make shared contracts explicit when a change crosses backend, frontend, agents, or deploy.
- Avoid placeholder directories and empty pages. A smaller accurate docs set is better than a complete-looking but empty tree.
- Mark generated or compiled artifacts clearly when they are tracked, and tell agents whether to edit sources or generated outputs.
- Keep diagrams and screenshots secondary. Text, tables, schemas, migrations, and source links should carry the durable facts.

## Front Matter

Permanent files under `docs/` should start with front matter when it adds useful metadata:

```yaml
---
title: <document title>
summary: <one-sentence summary>
doc_type: overview | reference | how-to | runbook | decision
status: draft | active | deprecated | superseded
owner: <team or maintainer>
last_reviewed: YYYY-MM-DD
applies_to:
  - <path or module>
canonical_sources:
  - <path to source of truth>
related:
  - <path to related doc>
---
```

Do not add metadata fields that nobody will maintain. At minimum, prefer `title`, `summary`, `status`, `last_reviewed`, and `applies_to`.

## Agent Workflow

When asked to update documentation:

1. Inspect the relevant code, manifests, README files, and existing `AGENTS.md` files first.
2. Decide the smallest useful documentation change.
3. Update the nearest relevant file instead of creating a new top-level page by default.
4. If behavior changed, update docs in the same change as code.
5. If a contract changed, update every affected module's references or types.
6. Remove or rewrite stale text instead of adding contradictory notes.
7. Verify links, paths, commands, and file names before finishing.

## Useful Documentation Shapes

- Overview: one short entry point that routes readers to the right files.
- Reference: stable facts such as env vars, endpoints, DTO fields, commands, or invariants.
- How-to: a goal-oriented procedure with prerequisites and verification.
- Runbook: operational failure, diagnosis, recovery, and rollback steps.
- Decision record: context, decision, consequences, and follow-up work for meaningful architecture choices.

Do not mix all of these in one large page unless it is only a brief index.

## Verification

For documentation-only changes:

- Check that all referenced paths exist.
- Check that commands match the package manager and working directory for the module.
- Check that mentioned env vars, endpoints, DTOs, and LiveKit topics exist in source.
- Run `git diff --check` to catch whitespace issues.

For documentation tied to behavior changes, also run the relevant module checks from `AGENTS.md`.

## Anti-Patterns

- A giant root instruction file that repeats all module documentation.
- New docs created from assumptions without reading the source.
- Empty scaffolds such as `architecture/`, `operations/`, or `templates/` with no real content.
- Tool-specific instruction files that duplicate `AGENTS.md` and drift.
- Contracts described only in prose when a DTO, schema, migration, or config file is the actual source of truth.
- Long generic advice that does not tell an agent what to inspect, edit, or verify in this repository.
