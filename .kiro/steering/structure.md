# Project Structure

## Root Organization

```
/
├── client/          # React Native mobile app (Expo)
├── server/          # Express backend API
├── shared/          # Shared types and database schema
├── docs/            # Architecture and design documentation
├── scripts/         # Build and utility scripts
├── assets/          # Static assets (images, icons)
└── .kiro/           # Kiro AI configuration and steering
```

## Client Structure (client/)

```
client/
├── App.tsx                    # Root component with providers
├── index.js                   # Expo entry point
├── components/                # Reusable UI components
│   ├── AlbumCard.tsx
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── EmptyState.tsx
│   ├── ErrorBoundary.tsx
│   ├── ErrorFallback.tsx
│   ├── FloatingActionButton.tsx
│   ├── HeaderTitle.tsx
│   ├── KeyboardAwareScrollViewCompat.tsx
│   ├── PhotoGrid.tsx
│   ├── PhotoMetadataEditor.tsx
│   ├── SettingsRow.tsx
│   ├── SkeletonLoader.tsx
│   ├── Spacer.tsx
│   ├── StorageBar.tsx
│   ├── ThemedText.tsx
│   └── ThemedView.tsx
├── screens/                   # Main app screens
│   ├── AlbumsScreen.tsx       # Album list view
│   ├── AlbumDetailScreen.tsx  # Single album view
│   ├── PhotosScreen.tsx       # Photo grid timeline
│   ├── PhotoDetailScreen.tsx  # Full-screen photo view
│   ├── EditPhotoScreen.tsx    # Photo editing interface
│   ├── SearchScreen.tsx       # Search and filters
│   ├── ProfileScreen.tsx      # User profile and settings
│   ├── MapScreen.tsx          # Location-based photo view
│   └── TrashScreen.tsx        # Deleted photos
├── navigation/                # Navigation configuration
│   ├── RootStackNavigator.tsx      # Root navigation container
│   ├── MainTabNavigator.tsx        # Bottom tab navigation
│   ├── PhotosStackNavigator.tsx    # Photos tab stack
│   ├── AlbumsStackNavigator.tsx    # Albums tab stack
│   ├── SearchStackNavigator.tsx    # Search tab stack
│   └── ProfileStackNavigator.tsx   # Profile tab stack
├── lib/                       # Core utilities and services
│   ├── storage.ts             # AsyncStorage operations
│   ├── secure-storage.ts      # Encrypted storage wrapper
│   ├── query-client.ts        # React Query configuration
│   └── *.test.ts              # Unit and property tests
├── hooks/                     # Custom React hooks
│   ├── useTheme.ts
│   ├── useColorScheme.ts
│   └── useScreenOptions.ts
├── constants/                 # App constants
│   └── theme.ts               # Design tokens and colors
└── types/                     # TypeScript type definitions
    └── index.ts               # Core data models (Photo, Album, User)
```

## Server Structure (server/)

```
server/
├── index.ts                   # Express app entry point
├── db.ts                      # Database connection (Drizzle)
├── routes.ts                  # Main route aggregator
├── auth.ts                    # Authentication utilities
├── middleware.ts              # Express middleware (auth, validation)
├── security.ts                # Security utilities and headers
├── audit.ts                   # Audit logging
├── encryption.ts              # Encryption utilities
├── db-encryption.ts           # Database-level encryption
├── backup-encryption.ts       # Backup encryption
├── encrypted-storage.ts       # Encrypted file storage
├── storage.ts                 # File storage operations
├── file-validation.ts         # File type and size validation
├── captcha.ts                 # CAPTCHA verification
├── siem.ts                    # Security monitoring
├── auth-routes.ts             # /api/auth/* endpoints
├── auth-captcha-routes.ts     # /api/auth/captcha/* endpoints
├── photo-routes.ts            # /api/photos/* endpoints
├── album-routes.ts            # /api/albums/* endpoints
├── upload-routes.ts           # /api/upload/* endpoints
├── templates/                 # HTML templates
│   └── landing-page.html
└── *.test.ts                  # Unit and integration tests
```

## Shared Structure (shared/)

```
shared/
└── schema.ts                  # Drizzle ORM database schema
                               # (users, photos, albums tables)
```

## Documentation Structure (docs/)

```
docs/
├── architecture/              # System architecture docs
│   ├── 00_INDEX.md
│   ├── 10_OVERVIEW.md         # High-level system overview
│   ├── 20_RUNTIME_TOPOLOGY.md
│   ├── 30_MODULES_AND_DEPENDENCIES.md
│   ├── 40_KEY_FLOWS.md
│   └── 90_GLOSSARY.md
├── security/                  # Security documentation
│   ├── 10_THREAT_MODEL.md
│   ├── 11_IDENTITY_AND_ACCESS.md
│   ├── 12_CRYPTO_POLICY.md
│   ├── 13_APPSEC_BOUNDARIES.md
│   ├── 20_SUPPLY_CHAIN.md
│   ├── 30_CICD_HARDENING.md
│   ├── 40_AUDIT_AND_LOGGING.md
│   ├── 70_HIPAA_COMPLIANCE.md
│   └── templates/             # Security templates
├── testing/                   # Testing documentation
│   ├── 10_RUNNING_TESTS.md
│   ├── 20_COVERAGE.md
│   ├── 30_TEST_PATTERNS.md
│   └── 40_TEST_FACTORIES.md
├── design_guidelines.md       # UI/UX design specifications
├── backlog.md                 # Feature backlog
└── todo.md                    # Current tasks
```

## Configuration Files

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration with path aliases
- `babel.config.js` - Babel transpiler with module resolver
- `eslint.config.js` - ESLint 9 flat config with Prettier
- `app.json` - Expo app configuration
- `drizzle.config.ts` - Database ORM configuration
- `.env` - Environment variables (not in git)
- `.env.example` - Environment variable template

## Key Conventions

### File Naming
- **Components**: PascalCase (e.g., `AlbumCard.tsx`)
- **Utilities**: camelCase (e.g., `storage.ts`)
- **Tests**: `*.test.ts` or `*.test.tsx`
- **Property Tests**: `*.property.test.ts`

### Import Patterns
- Use path aliases: `@/components/Button` instead of `../../components/Button`
- Use `@shared/schema` for shared types between client/server

### Test Co-location
- Tests live alongside source files (e.g., `storage.ts` + `storage.test.ts`)
- Property-based tests use `.property.test.ts` suffix

### Navigation Architecture
- **Root**: Stack navigator (modals, auth flow)
- **Main**: Tab navigator (4 tabs: Photos, Albums, Search, Profile)
- **Per-Tab**: Stack navigators for each tab's screens

### API Routes
All backend routes prefixed with `/api/`:
- `/api/auth/*` - Authentication endpoints
- `/api/photos/*` - Photo CRUD operations
- `/api/albums/*` - Album CRUD operations
- `/api/upload/*` - File upload endpoints

### Data Flow
1. **Client** → React Query hooks → API calls
2. **Server** → Express routes → Middleware (auth, validation) → Database (Drizzle ORM)
3. **Local Storage** → AsyncStorage for offline/cached data

### Security Boundaries
- User data strictly isolated at database query level
- All routes protected by authentication middleware
- File uploads validated for type and size
- Encryption applied at multiple layers (storage, database, backups)
