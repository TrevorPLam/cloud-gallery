# Technology Stack

## Frontend (client/)

**Framework**: React Native 0.81.5 + Expo SDK 54
**Language**: TypeScript 5.9.2 (strict mode enabled)
**UI**: React 19.1.0

### Key Libraries
- **Navigation**: `@react-navigation/*` (v7) - Native Stack + Bottom Tabs
- **State/Data**: `@tanstack/react-query` (v5.90.7) - Server state and caching
- **Storage**: `@react-native-async-storage/async-storage` - Local persistence
- **Images**: `expo-image`, `expo-image-picker`, `expo-image-manipulator`, `expo-media-library`
- **Lists**: `@shopify/flash-list` - High-performance scrolling
- **Animations**: `react-native-reanimated` (v4.1.1)
- **Maps**: `react-native-maps`
- **Validation**: `zod` + `zod-validation-error`

### Path Aliases
- `@/*` → `./client/*`
- `@shared/*` → `./shared/*`

Must be kept in sync between `tsconfig.json` and `babel.config.js`.

## Backend (server/)

**Framework**: Express 5.0.1
**Database**: PostgreSQL 8.x
**ORM**: Drizzle ORM 0.39.3 + drizzle-zod
**Language**: TypeScript 5.9.2
**Runtime**: Node.js with tsx for development

### Key Libraries
- **Authentication**: `jsonwebtoken`, `argon2`, `bcrypt`
- **Encryption**: `crypto-js`
- **File Upload**: `multer`, `file-type`
- **Validation**: `zod`
- **Rate Limiting**: `express-rate-limit`

## Testing

**Framework**: Vitest 3.0.5
**Property-Based Testing**: `fast-check` 4.5.3
**DOM Environment**: `happy-dom` 20.0.0
**API Testing**: `supertest` 7.0.0
**React Testing**: `@testing-library/react` 16.1.0

## Build Tools

- **Bundler**: Metro (via Expo)
- **Transpiler**: Babel with `babel-preset-expo`
- **Server Build**: esbuild
- **Type Checking**: TypeScript compiler
- **Linting**: ESLint 9 (flat config) + Prettier 3.6.2
- **Database Migrations**: drizzle-kit

## Common Commands

### Development
```bash
# Start Expo dev server (mobile app)
npm run expo:dev

# Start backend server
npm run server:dev

# Start backend without database
npm run server:dev:nodb
```

### Testing
```bash
# Run all tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

### Code Quality
```bash
# Type checking
npm run check:types

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Check formatting
npm run check:format

# Format code
npm run format
```

### Database
```bash
# Push schema changes to database
npm run db:push
```

### Build
```bash
# Build Expo static bundle
npm run expo:static:build

# Build backend for production
npm run server:build

# Run production server
npm run server:prod
```

### Security
```bash
# Run security checks
npm run security:check

# Audit dependencies
npm run security:audit

# Generate SBOM
npm run security:sbom
```

## Platform Notes

### Windows Compatibility
- Shell: cmd (not bash)
- Command separator: `&` (cmd) or `;` (PowerShell)
- Use `cross-env` for environment variables in scripts

### Expo Configuration
- New Architecture enabled (`newArchEnabled: true`)
- React Compiler experimental feature enabled
- Platform-specific permissions configured in `app.json`

## Important Constraints

1. **Babel Plugin Order**: `react-native-reanimated/plugin` must be last
2. **Path Aliases**: Must match between TypeScript and Babel configs
3. **Strict TypeScript**: All code must pass strict type checking
4. **Test Files**: Excluded from TypeScript compilation (see `tsconfig.json`)
5. **ESLint + Prettier**: Integrated - Prettier runs as ESLint plugin
