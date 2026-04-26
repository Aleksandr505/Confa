# Database Migration Guidelines

## Scope

This directory contains Liquibase changelogs for the API module. `liquibase-changelog.yaml` includes all files from `scripts/`.

## Migration Format

- Use Liquibase formatted SQL files in `scripts/`.
- Prefer creating files with `cd backend && bash scripts/liquibase/new_migration.sh api <name> "<comment>"`.
- File names should start with a timestamp, following the existing pattern: `yyyyMMddHHmmss_description.sql`.
- Every migration must start with:

```sql
-- liquibase formatted sql
-- changeset <author>:<timestamp>
-- comment: <short reason>
```

## Schema Rules

- Keep migrations forward-only. Do not edit already-applied migrations unless this is explicitly a local-only cleanup.
- Use InnoDB tables and explicit foreign-key constraints.
- Add indexes alongside new query paths.
- Preserve soft-delete columns such as `deleted_at` when extending tables that already use soft deletion.
- Keep enum values aligned with Java domain enums and frontend TypeScript unions in the same change.

## Verification

When possible, apply migrations against a local MySQL instance with the same changelog path used by `deploy/docker-compose.yml`. If that is not available, at least inspect SQL for ordering, FK targets, and enum/string compatibility with Java entities.
