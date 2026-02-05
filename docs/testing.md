# Testing Guide

## Meta
- **Purpose**: Document test execution and focused-test safeguards.
- **Inputs**: Test commands (`npm run test`, `npm run test:check-focused`).
- **Outputs**: Test results and non-zero exit codes on violations.
- **Invariants**: Focused tests (`.only`) and skipped suites are not allowed in commits.

## Focused-Test Safeguards

Two safeguards prevent focused/skipped tests from slipping into the codebase:

1. **Vitest config** disallows `.only()` in committed tests.
2. **Focused-test scan** searches the repo and fails the script if a focused/skipped test is found.
3. **CI enforcement** runs the focused-test scan on every PR.

### Commands

```bash
npm run test
npm run test:check-focused
```

If `test:check-focused` reports matches, remove the `.only()`/`.skip()` before committing.
