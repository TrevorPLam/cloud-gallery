# AI-META: package.json

## Purpose
npm package manifest with scripts and dependencies for Cloud Gallery project

## Ownership
project/root

## Entrypoints
- npm scripts
- package managers (npm, yarn, pnpm)

## Dependencies
- Expo SDK 54
- React Native 0.81
- Express 5
- Drizzle ORM
- React Query

## Danger Zones
- `main` entry point must exist (currently: client/index.js)
- Version updates can break compatibility - check breaking changes on major bumps
- Scripts contain Replit-specific environment variables (REPLIT_DEV_DOMAIN, etc.)

## Change Safety
- ✅ Safe to add dev dependencies
- ✅ Safe to add new scripts
- ⚠️ Check breaking changes on major version bumps
- ⚠️ Script env vars are Replit-specific and may need adjustment for other platforms

## Tests
- `npm run check:types` - TypeScript validation
- `npm run lint` - ESLint validation
- `npm run expo:dev` - Start Expo development server
- `npm run server:dev` - Start Express backend

## Key Notes
- `main` points to client/index.js which registers the Expo app component
- Expo scripts use Replit environment variables for domain configuration
- React Native 0.81.5 requires compatible Expo version (54.x)
