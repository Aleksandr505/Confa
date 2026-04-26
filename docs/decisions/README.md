---
title: Decision Log
summary: Index and conventions for architecture decision records.
doc_type: overview
status: active
owner: core-team
last_reviewed: 2026-04-26
applies_to:
  - docs/decisions/
related:
  - docs/documentation-playbook.md
  - docs/architecture/system-context.md
---

# Decision Log

Use this directory for decisions that affect architecture, operational risk, module boundaries, or cross-module contracts.

Create a decision record when a future maintainer would need to know why a design was chosen, not just what the code does.

## File Naming

Use this format:

```text
YYYYMMDD-short-decision-title.md
```

## Decision Record Shape

Each decision should include:

- context;
- decision;
- consequences;
- alternatives considered when they matter;
- follow-up work or review date if the decision is temporary.

Do not add decision records for routine implementation details that are already clear from code.

