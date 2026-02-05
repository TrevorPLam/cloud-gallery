# AI-META Headers

**Purpose:** Document the standard metadata headers added to server files so agents and developers can quickly understand ownership, entrypoints, dependencies, and change risks.

## Standard Header Template

```typescript
// AI-META-BEGIN
// AI-META: <Brief description of file purpose>
// OWNERSHIP: <domain>/<subdomain>
// ENTRYPOINTS: <Where this code is called from>
// DEPENDENCIES: <Key external dependencies>
// DANGER: <Critical risks or side effects - REQUIRED if any>
// CHANGE-SAFETY: <Guidance on when changes are safe/unsafe>
// TESTS: <Path to test files>
// AI-META-END
```

## Usage Guidelines

- Place the header at the very top of the file before any imports.
- Keep descriptions short and accurate; update as dependencies/entrypoints change.
- Always include a meaningful **DANGER** line for security-sensitive modules.
- When no tests exist, note it explicitly and add a backlog item to cover the gap.

## Why This Matters

- Improves review quality by making risks explicit.
- Helps AI agents and new contributors understand critical boundaries quickly.
- Reduces accidental changes to security-sensitive areas.
