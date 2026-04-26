# Backend Guidelines

## Scope

This directory is a Java 21 Maven parent project. The only application module today is `api/`; utility scripts live under `scripts/`.

## Maven

- Run Maven from `backend/` with the wrapper.
- Use `./mvnw -pl api test` for normal backend verification.
- Use `./mvnw -pl api spring-boot:run` for local API startup when database, Redis, LiveKit, and object storage env vars are available.
- Add new Maven dependencies in the narrowest useful `pom.xml`. Shared version management belongs in `backend/pom.xml`; API-only dependencies belong in `backend/api/pom.xml`.

## Conventions

- Keep Java source under `backend/api/src/main/java/space/confa/api`.
- Keep Liquibase changelog files under `backend/api/src/main/resources/space/confa/api/db/changelog`.
- Use `bash scripts/liquibase/new_migration.sh api <name> "<comment>"` to create migration skeletons when possible.
- Do not add blocking infrastructure work to startup unless it is required for the API to serve safely.
