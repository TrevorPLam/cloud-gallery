# Backlog

## Meta
- **Purpose**: Track follow-up work discovered during sessions.
- **Inputs**: Session notes and post-task reflections.
- **Outputs**: Prioritized list of future tasks.
- **Invariants**: Items are small enough to complete in a single session.

## Proposed Tasks

1. **Add integration tests for presigned endpoints**
   - Cover `/api/upload/presigned/upload` and `/api/upload/presigned/download` with auth.
   - Rationale: Ensure routes stay aligned with signing utilities.

2. **Expand env validation usage**
   - Migrate more server modules to `server/config.ts` validation.
   - Rationale: Fail fast for missing env vars beyond presigned URLs.
