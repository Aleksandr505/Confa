---
title: Documentation Index
summary: Entry point for Confa repository documentation.
doc_type: overview
status: active
owner: core-team
last_reviewed: 2026-04-26
applies_to:
  - docs/
related:
  - docs/documentation-playbook.md
  - docs/references/repo-map.md
  - docs/architecture/system-context.md
---

# Documentation Index

Use this directory for durable cross-cutting knowledge about Confa. Keep module-specific instructions close to code in local `README.md` and `AGENTS.md` files.

## Start Here

- [Documentation Playbook](documentation-playbook.md): rules for adding or pruning documentation.
- [Repository Map](references/repo-map.md): source tree, module responsibilities, and verification commands.
- [System Context](architecture/system-context.md): runtime components, trust boundaries, and major flows.
- [Shared Runtime Contracts](contracts/shared-runtime-contracts.md): cross-module contracts that must stay in sync.
- [Local Development](operations/local-development.md): local commands and required services.
- [Glossary](glossary.md): project terms used across backend, frontend, agents, and deploy.

## Local Module Docs

- [Backend guidelines](../backend/AGENTS.md)
- [API module guidelines](../backend/api/AGENTS.md)
- [Frontend guidelines](../frontend/AGENTS.md)
- [Client SPA guidelines](../frontend/client/AGENTS.md)
- [Admin SPA guidelines](../frontend/admin-client/AGENTS.md)
- [Agents worker guidelines](../agents/AGENTS.md)
- [Deployment guidelines](../deploy/AGENTS.md)

## Documentation Rules

- Update docs in the same change when behavior, contracts, env vars, migrations, or operational steps change.
- Prefer links to canonical source files over duplicated prose.
- Do not add empty directories or placeholder pages.
- Keep root docs short and route readers to the nearest specific source.

