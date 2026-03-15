# Backlog

This backlog captures follow-up tasks discovered during sessions.

## 2026-03-15

- **Done**: Update API and architecture docs to reflect current server (14+ mounted routes) and hybrid client; see `docs/api/00_INDEX.md`, `docs/architecture/10_OVERVIEW.md`, README, AGENTS.md.
- **Done**: Mount storage routes in `server/routes.ts` so `/api/storage` is available at runtime.
- **Done**: Clarify security story in README and docs: local metadata encryption (AES-256-GCM, optional) vs server backup/storage.
- Fix remaining test failures (~69 as of 2026-03-15): align DB mocks with Drizzle chainable API in all service tests (e.g. `orderBy`, `groupBy`, thenable `where`); tighten or constrain property-test generators (memories, sync, backup, public-links); fix unhandled async rejections in property tests (ensure `fc.assert`/async properties are awaited and errors caught).

## 2026-02-05

- Add integration tests for `server/photo-routes.ts` that validate user-scoped query behavior and pagination boundary handling.
- Add integration tests for `server/upload-routes.ts` multipart size and MIME rejection paths to complement unit-level file validation coverage.
- Consider migrating `test:check-focused` from shell `grep` to a Node-based script for improved cross-platform compatibility.
