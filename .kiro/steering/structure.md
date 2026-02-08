# Project Structure

## Repository Organization

```
cloud-gallery/
├── client/              # React Native mobile app
├── server/              # Express.js backend API
├── shared/              # Code shared between client & server
├── docs/                # Project documentation
├── tests/               # Test utilities and factories
├── scripts/             # Build and utility scripts
└── assets/              # Static assets (images, icons)
```

## Client Structure (`client/`)

```
client/
├── App.tsx              # Application entry point
├── index.js             # Expo entry file
│
├── screens/             # Full-page views
│   ├── PhotosScreen.tsx         # Main photo library
│   ├── AlbumsScreen.tsx         # Album collection view
│   ├── PhotoDetailScreen.tsx    # Single photo view
│   ├── AlbumDetailScreen.tsx    # Photos within album
│   ├── SearchScreen.tsx         # Photo search
│   └── ProfileScreen.tsx        # User settings
│
├── components/          # Reusable UI components
│   ├── PhotoGrid.tsx            # High-performance photo grid
│   ├── AlbumCard.tsx            # Album grid item
│   ├── FloatingActionButton.tsx # Upload button
│   ├── EmptyState.tsx           # Empty state placeholder
│   ├── ErrorBoundary.tsx        # Error catching
│   ├── SkeletonLoader.tsx       # Loading placeholders
│   └── Themed*.tsx              # Dark/light mode wrappers
│
├── navigation/          # React Navigation setup
│   ├── RootStackNavigator.tsx   # Top-level container
│   ├── MainTabNavigator.tsx     # Bottom tab bar
│   ├── PhotosStackNavigator.tsx # Photo screens stack
│   ├── AlbumsStackNavigator.tsx # Album screens stack
│   ├── SearchStackNavigator.tsx # Search screens stack
│   └── ProfileStackNavigator.tsx# Profile screens stack
│
├── lib/                 # Utilities and services
│   ├── storage.ts               # Local data persistence (⚠️ needs refactor)
│   ├── storage.test.ts          # Storage tests
│   ├── query-client.ts          # React Query configuration
│   ├── secure-storage.ts        # Encrypted storage
│   └── secure-storage.test.ts   # Secure storage tests
│
├── hooks/               # Custom React hooks
│   ├── useTheme.ts              # Dark/light theme hook
│   ├── useColorScheme.ts        # Native color scheme
│   └── useScreenOptions.ts      # Navigation configs
│
├── constants/           # App-wide constants
│   └── theme.ts                 # Colors, spacing, typography
│
└── types/               # TypeScript type definitions
    └── index.ts                 # Photo, Album, User types
```

## Server Structure (`server/`)

```
server/
├── index.ts             # Server bootstrap (middleware, security)
├── routes.ts            # Route registration (⚠️ incomplete)
├── db.ts                # Database connection helper
│
├── auth-routes.ts       # Authentication endpoints (/api/auth)
├── auth.ts              # Auth middleware (JWT validation)
├── photo-routes.ts      # Photo CRUD endpoints (/api/photos)
├── album-routes.ts      # Album CRUD endpoints (/api/albums)
├── upload-routes.ts     # File upload endpoints (/api/upload)
│
├── middleware.ts        # Custom middleware functions
├── security.ts          # Security utilities (rate limiting, CORS, CSP)
├── encryption.ts        # Data encryption utilities
├── backup-encryption.ts # Backup file encryption
├── captcha.ts           # CAPTCHA validation
├── audit.ts             # Audit logging system
├── siem.ts              # Security monitoring
│
├── file-validation.ts   # File upload validation
├── storage.ts           # Server-side file storage
├── encrypted-storage.ts # Encrypted file storage
├── db-encryption.ts     # Database encryption layer
│
└── templates/           # Email/notification templates
```

## Shared Code (`shared/`)

```
shared/
├── schema.ts            # Database schemas (Drizzle ORM)
│                        # ⚠️ Currently only has users table
│                        # TODO: Add photos, albums, album_photos tables
└── schema.test.ts       # Schema validation tests
```

## Documentation (`docs/`)

```
docs/
├── architecture/        # System architecture documentation
│   ├── 00_INDEX.md
│   ├── 10_OVERVIEW.md
│   ├── 20_RUNTIME_TOPOLOGY.md
│   ├── 30_MODULES_AND_DEPENDENCIES.md
│   ├── 40_KEY_FLOWS.md
│   └── 90_GLOSSARY.md
│
├── api/                 # API documentation
│   └── 00_INDEX.md
│
├── security/            # Security documentation
│   ├── 00_INDEX.md
│   ├── 10_THREAT_MODEL.md
│   ├── 11_IDENTITY_AND_ACCESS.md
│   └── ... (comprehensive security docs)
│
├── testing/             # Testing documentation
│   ├── 00_INDEX.md
│   ├── 10_RUNNING_TESTS.md
│   ├── 20_COVERAGE.md
│   └── 30_TEST_PATTERNS.md
│
├── adr/                 # Architecture Decision Records
│   └── README.md
│
└── archive/             # Old documentation
```

## Key Files

### Configuration Files

- `package.json` - Dependencies and npm scripts
- `tsconfig.json` - TypeScript configuration (strict mode)
- `drizzle.config.ts` - Database ORM configuration
- `vitest.config.ts` - Test runner configuration
- `eslint.config.js` - Linting rules
- `babel.config.js` - JavaScript transpiler config
- `app.json` - Expo app configuration
- `.env` - Environment variables (not in git)
- `.env.example` - Environment variable template

### Important Documentation

- `AGENTS.md` - Comprehensive AI agent guide (2000+ lines)
- `README.md` - Project overview and setup instructions
- `docs/design_guidelines.md` - UI/UX design principles

## File Naming Conventions

- **Components**: PascalCase (e.g., `PhotoGrid.tsx`)
- **Screens**: PascalCase with "Screen" suffix (e.g., `PhotosScreen.tsx`)
- **Utilities**: camelCase (e.g., `storage.ts`, `query-client.ts`)
- **Tests**: Same name as file with `.test.ts` suffix (e.g., `storage.test.ts`)
- **Types**: camelCase for files, PascalCase for type names

## Import Path Aliases

The project uses `@/` alias for client imports:

```typescript
// Instead of: import { Photo } from '../../types'
import { Photo } from '@/types';

// Instead of: import { useTheme } from '../../hooks/useTheme'
import { useTheme } from '@/hooks/useTheme';
```

## Critical Files Requiring Attention

Based on AGENTS.md analysis, these files need immediate work:

1. **`shared/schema.ts`** - Missing photo/album tables
2. **`server/routes.ts`** - Missing photo/album endpoint registration
3. **`client/lib/storage.ts`** - Needs validation and UUID refactor
4. **`client/screens/PhotosScreen.tsx`** - Needs API integration
5. **`client/screens/AlbumsScreen.tsx`** - Needs API integration

## Code Organization Principles

- **Separation of Concerns**: UI components separate from business logic
- **Colocation**: Tests live next to the code they test
- **Shared Code**: Database schemas and types in `shared/` folder
- **Type Safety**: TypeScript types defined close to usage
- **Modularity**: Small, focused files with single responsibility
