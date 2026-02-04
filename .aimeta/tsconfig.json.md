# AI-META: tsconfig.json

## Purpose
TypeScript compiler configuration with path aliases for Expo project

## Ownership
build/config

## Entrypoints
- `npm run check:types` - Type checking
- IDE type checking and IntelliSense
- Build-time compilation

## Dependencies
- expo/tsconfig.base.json (base configuration)
- TypeScript compiler

## Danger Zones
- **paths** must match babel.config.js aliases for consistent resolution
- **strict mode** enforces type safety - disabling will hide type errors
- **test files excluded** from compilation (affects what gets bundled)

## Change Safety
- ✅ Safe to add new path aliases (must sync with babel.config.js)
- ⚠️ Do not disable strict mode - it ensures type safety
- ⚠️ exclude list affects build scope and bundle size
- ⚠️ Removing path aliases will break imports throughout the codebase

## Tests
- `npm run check:types` - Validate all TypeScript

## Key Notes
- **paths** match babel module-resolver for consistent import resolution:
  - `@/*` → `./client/*`
  - `@shared/*` → `./shared/*`
- Both bundler (Metro) and type checker must use same aliases
- **types: ["node"]** enables Node.js type definitions for server code
- **strict: true** catches common JavaScript errors at compile time
- Test files (*.test.ts) are excluded to keep production bundle clean
