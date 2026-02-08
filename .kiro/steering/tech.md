# Technology Stack

## Frontend (Client)

- **React Native** 0.78.8 - Cross-platform mobile framework
- **Expo** 54.0.23 - Development platform and tooling
- **TypeScript** 5.9.2 - Type-safe JavaScript (strict mode enabled)
- **React Navigation** 7.0+ - App navigation and routing
- **React Query / TanStack Query** 5.90.7 - Server state management and caching
- **FlashList** - High-performance list rendering (10x faster than FlatList)
- **AsyncStorage** - Local data persistence
- **Zod** 3.24.2 - Runtime schema validation

## Backend (Server)

- **Node.js** - JavaScript runtime
- **Express** 5.0.1 - Web server framework
- **PostgreSQL** 15+ - Relational database
- **Drizzle ORM** 0.39.3 - Type-safe database queries
- **JWT** - Authentication tokens
- **Argon2id** - Password hashing (PHC winner, memory-hard)
- **Zod** - Request/response validation

## Development Tools

- **Vite** - Fast build tool
- **Vitest** 3.0.5 - Modern test runner
- **ESLint** 9.25.0 - Code linting
- **Prettier** 3.6.2 - Code formatting
- **TypeScript Compiler** - Type checking

## Common Commands

### Development

```bash
# Start both client and server
npm run dev

# Start server only (backend API)
npm run server:dev

# Start client only (mobile app)
npm start
# or
expo start

# Clear cache and restart
expo start --clear
```

### Database

```bash
# Apply schema changes to database
npm run db:push

# Open visual database browser
npm run db:studio

# Direct database access (SQL)
psql cloudgallery
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test storage.test.ts

# Watch mode (re-run on changes)
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Code Quality

```bash
# TypeScript type checking
npm run check:types

# Linting
npm run lint

# Format code
npm run format
```

### Build

```bash
# Production build
npm run build

# Build for specific platform
eas build --platform ios
eas build --platform android
```

## Environment Setup

Required environment variables (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT signing (min 32 chars)
- `NODE_ENV` - Environment (development/production/test)
- `PORT` - Server port (default: 5000)

## Code Style Conventions

- **TypeScript strict mode** - No `any` types allowed
- **Functional components** - Use hooks, not class components
- **Explicit return types** - All functions should declare return types
- **Error handling** - All async operations must have try/catch
- **JSDoc comments** - Document complex functions and public APIs
- **Conventional commits** - Use `feat:`, `fix:`, `docs:`, etc.
