# Plans

Use this directory for active or recently completed implementation plans that are too large to keep only in chat.

Plans are working notes, not durable product documentation. When a plan produces lasting knowledge, move that knowledge into `docs/`, a module `README.md`, or an `AGENTS.md` file.

## When To Create A Plan

Create a plan for work that has at least one of these traits:

- touches multiple modules;
- changes shared API, LiveKit, database, auth, deployment, or agent contracts;
- needs multiple sessions or handoff between agents;
- has migration, rollout, rollback, or verification risk;
- requires a decision trail before implementation is complete.

Do not create a plan for a small local fix that can be understood from the code diff.

## Directory Layout

- `active/`: plans currently being implemented or investigated.
- `archive/`: completed plans worth keeping for historical context.
- `templates/task-plan.md`: starting point for new plans.

## Naming

Use a stable ordered slug for active plans:

```text
NNNN-short-task-name.md
```

Example:

```text
0003-agent-control-hardening.md
```

Keep `created` and `updated` dates in the plan front matter. When moving a completed plan to `archive/`, keep the same numbered filename unless there is a strong reason to rename it.

## Lifecycle

1. Copy `templates/task-plan.md` into `active/`.
2. Give it the next available `NNNN-` prefix.
3. Fill in goal, scope, affected paths, assumptions, and verification.
4. Keep the checklist current while work is in progress.
5. When finished, move reusable facts into durable docs.
6. Move the plan to `archive/` only if it remains useful; otherwise delete it.

## Rules

- Keep plans factual and task-specific.
- Link to source files and docs instead of pasting large code excerpts.
- Record open questions and blockers explicitly.
- Do not store secrets, credentials, private customer data, or generated build output in plans.
