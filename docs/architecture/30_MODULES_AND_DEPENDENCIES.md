# Modules and Dependencies

[← Back to Index](./00_INDEX.md) | [← Previous: Runtime Topology](./20_RUNTIME_TOPOLOGY.md) | [Next: Key Flows →](./40_KEY_FLOWS.md)

## Module Map by Folder

```
Cloud-Gallery/
├── client/              Mobile app (React Native + Expo)
│   ├── components/      Reusable UI components (16 files)
│   ├── screens/         Top-level screen components (6 files)
│   ├── navigation/      Navigation configuration (6 files)
│   ├── hooks/           Custom React hooks (4 files)
│   ├── lib/             Client libraries (storage, query client)
│   ├── constants/       Design tokens (theme)
│   ├── types/           TypeScript type definitions
│   ├── App.tsx          Root component with providers
│   └── index.js         Expo entry point
│
├── server/              Backend server (Express)
│   ├── templates/       HTML templates (landing page)
│   ├── index.ts         Express app setup
│   ├── routes.ts        Route registration (empty)
│   └── storage.ts       In-memory storage (unused)
│
├── shared/              Shared code between client & server
│   └── schema.ts        Drizzle ORM database schema
│
├── scripts/             Build and utility scripts
│   └── build.js         Expo static build script
│
├── assets/              Static assets (images, fonts)
│
└── docs/                Documentation (this folder)
    ├── architecture/    System architecture docs
    ├── data/            Data layer documentation
    ├── api/             API documentation
    ├── integrations/    Third-party integrations
    └── adr/             Architecture Decision Records
```

## Client Architecture

### Navigation Structure

```
RootStackNavigator (root)
├── MainTabNavigator (main UI)
│   ├── PhotosStackNavigator (Photos tab)
│   │   └── PhotosScreen
│   ├── AlbumsStackNavigator (Albums tab)
│   │   └── AlbumsScreen
│   ├── SearchStackNavigator (Search tab)
│   │   └── SearchScreen
│   └── ProfileStackNavigator (Profile tab)
│       └── ProfileScreen
├── PhotoDetailScreen (modal)
└── AlbumDetailScreen (modal)
```

**Import Rules**:
- ✅ Screens can import from: components, hooks, lib, constants, types
- ✅ Components can import from: hooks, constants, types
- ❌ Components should NOT import from: screens, navigation
- ❌ Navigation should NOT import from: screens (use dynamic imports if needed)

**Evidence**:
- `/client/navigation/RootStackNavigator.tsx` - Root navigation
- `/client/navigation/MainTabNavigator.tsx` - Tab bar
- `/client/screens/*.tsx` - 6 screen components

---

### Component Hierarchy

**Atomic Design Pattern** (implicit):

1. **Primitives** (base components):
   - `ThemedView` - Themed container
   - `ThemedText` - Themed typography
   - `Spacer` - Layout spacing
   - `Button` - Animated button

2. **Molecules** (composite components):
   - `Card` - Generic card container
   - `SettingsRow` - Settings list item
   - `StorageBar` - Storage usage bar
   - `FloatingActionButton` - FAB for actions

3. **Organisms** (complex components):
   - `PhotoGrid` - FlashList-based photo grid
   - `AlbumCard` - Album display with cover
   - `EmptyState` - Empty state with illustration
   - `ErrorFallback` - Error UI
   - `SkeletonLoader` - Loading states
   - `HeaderTitle` - Custom header

**Import Rules**:
- ✅ Organisms can import molecules and primitives
- ✅ Molecules can import primitives
- ❌ Primitives should NOT import molecules or organisms
- ✅ All components can use hooks and constants

**Evidence**:
- `/client/components/*.tsx` - 16 component files
- Imports follow hierarchy (check file imports)

---

### Data Flow

```
Screen Component
    ↓ (uses)
React Query Hook
    ↓ (calls)
Storage Functions (client/lib/storage.ts)
    ↓ (reads/writes)
AsyncStorage (React Native)
```

**Key Pattern**: Screens use React Query hooks that wrap storage functions for caching and synchronization.

**Import Rules**:
- ✅ Screens import React Query hooks
- ✅ Storage functions are pure (no UI dependencies)
- ✅ Types imported by both screens and storage
- ❌ Storage should NOT import React components

**Evidence**:
- `/client/lib/storage.ts` - Storage operations (219 lines)
- `/client/lib/query-client.ts` - React Query configuration
- `/client/screens/*.tsx` - Usage of React Query hooks

---

### Hooks

**Custom Hooks**:
1. `useTheme()` - Theme values (colors, spacing, typography)
2. `useColorScheme()` - Dark/light mode detection
3. `useScreenOptions()` - Navigation header configuration

**Import Rules**:
- ✅ Hooks can import: constants, types
- ❌ Hooks should NOT import: components, screens
- ✅ Hooks can import other hooks

**Evidence**:
- `/client/hooks/useTheme.ts` - Theme hook
- `/client/hooks/useColorScheme.ts` - Color scheme detection
- `/client/hooks/useScreenOptions.ts` - Screen options factory

---

### Type System

**Core Types** (`client/types/index.ts`):
- `Photo` - Photo with metadata and album relationships
- `Album` - Album with photo references
- `StorageInfo` - Storage usage stats
- `DateGroup` - Grouped photos by date

**Import Rules**:
- ✅ Types can be imported anywhere
- ✅ Types are pure TypeScript (no runtime code)
- ✅ Use exact imports: `import { Photo } from '@/types'`

**Evidence**:
- `/client/types/index.ts` - 45 lines of type definitions

---

## Server Architecture

### Current Structure

```
server/
├── index.ts          Express app + middleware + error handling
├── routes.ts         Route registration (currently empty)
├── storage.ts        In-memory storage (unused in MVP)
└── templates/
    └── landing-page.html  Expo Go landing page
```

**Responsibilities**:
1. Serve static Expo build files
2. Provide landing page for Expo Go QR codes
3. CORS configuration for development
4. Ready for future API routes

**Import Rules** (future):
- ✅ Routes can import: storage, shared/schema
- ✅ Middleware can be extracted to separate files
- ❌ Server should NOT import from client/

**Evidence**:
- `/server/index.ts` - 150 lines of Express setup
- `/server/routes.ts` - 23 lines (empty routes)

---

## Shared Module

### Purpose
Code shared between client and server, primarily database schema.

**Current State**:
- `shared/schema.ts` - Drizzle ORM user schema (PostgreSQL)
- Used by: server (future), database migrations

**Import Rules**:
- ✅ Both client and server can import shared types
- ✅ Shared should be pure TypeScript + Drizzle schema
- ❌ Shared should NOT import from client or server

**Evidence**:
- `/shared/schema.ts` - 32 lines of schema definitions

---

## Dependency Directions

### Allowed Dependencies

```
┌─────────────────────────────────────┐
│  client/screens/                    │
│    ↓ can import                     │
│  client/components/                 │
│    ↓ can import                     │
│  client/hooks/                      │
│    ↓ can import                     │
│  client/constants/ & client/types/ │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  client/screens/                    │
│    ↓ can import                     │
│  client/lib/storage.ts              │
│    ↓ can import                     │
│  client/types/                      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  server/index.ts                    │
│    ↓ imports                        │
│  server/routes.ts                   │
│    ↓ imports (future)               │
│  shared/schema.ts                   │
└─────────────────────────────────────┘
```

### "Do Not Create Cycles" Rules

**Strict Rules**:
1. **Components MUST NOT import screens**
   - ❌ `import { PhotosScreen } from '@/screens/PhotosScreen'`
   - ✅ Pass data via props instead

2. **Hooks MUST NOT import components**
   - ❌ `import { Button } from '@/components/Button'`
   - ✅ Return data/callbacks from hooks, render in components

3. **Storage MUST NOT import React Query**
   - ❌ `import { useQuery } from '@tanstack/react-query'`
   - ✅ Storage functions are pure, React Query wraps them in screens

4. **Server MUST NOT import client code**
   - ❌ `import { Photo } from '../client/types'`
   - ✅ Use `shared/` for shared types

5. **No circular imports between modules**
   - TypeScript will error if you create a cycle
   - Use `npm run check:types` to verify

**Evidence**:
- Check imports in any file with `grep -n "^import" client/components/Button.tsx`
- TypeScript errors if cycles exist

---

## Import Path Aliases

**Configured in `tsconfig.json` and `babel.config.js`**:

```typescript
import { Photo } from '@/types'           // → client/types/index.ts
import { Button } from '@/components/Button' // → client/components/Button.tsx
import { useTheme } from '@/hooks/useTheme'  // → client/hooks/useTheme.ts
import { Colors } from '@/constants/theme'   // → client/constants/theme.ts
```

**Rules**:
- ✅ Use `@/` for all internal imports in client
- ✅ Use relative paths `../` only for adjacent files
- ❌ Do NOT use relative paths across directories

**Evidence**:
- `/tsconfig.json` - `paths` configuration
- `/babel.config.js` - `babel-plugin-module-resolver` setup

---

## External Dependencies

### Client Dependencies (Production)

**React Native & Expo** (core):
- `react`, `react-native`, `expo` - App framework
- `react-dom`, `react-native-web` - Web support

**Navigation**:
- `@react-navigation/*` - Screen routing

**Data Management**:
- `@tanstack/react-query` - Server state
- `@react-native-async-storage/async-storage` - Local storage

**UI & Interactions**:
- `@shopify/flash-list` - High-performance lists
- `react-native-reanimated` - Animations
- `react-native-gesture-handler` - Gestures
- `expo-haptics` - Tactile feedback

**Media & Device**:
- `expo-image-picker` - Photo selection
- `expo-media-library` - Media access
- `expo-image` - Optimized image component
- `expo-sharing` - Share functionality

**Evidence**: `/package.json` dependencies (lines 29-74)

---

### Server Dependencies (Production)

**Core**:
- `express` - HTTP server

**Database** (configured but unused):
- `drizzle-orm` - ORM
- `pg` - PostgreSQL driver

**Utilities**:
- `tsx` - TypeScript execution

**Evidence**: `/package.json` dependencies (lines 39-74)

---

### Dev Dependencies

**TypeScript**:
- `typescript`, `@types/*` - Type safety

**Linting & Formatting**:
- `eslint`, `prettier` - Code quality
- `eslint-config-expo` - Expo-specific rules

**Build Tools**:
- `babel-plugin-module-resolver` - Import aliases
- `drizzle-kit` - Database migrations

**Evidence**: `/package.json` devDependencies (lines 76-89)

---

## Module Size Guidelines

**Keep modules focused**:
- Components: < 200 lines (extract if larger)
- Screens: < 300 lines (extract complex logic to hooks)
- Hooks: < 100 lines (single responsibility)
- Storage functions: Pure functions, no side effects

**Current Largest Files**:
1. `/client/lib/storage.ts` - 279 lines (acceptable - data layer)
2. `/server/index.ts` - 150 lines (acceptable - setup code)
3. `/client/screens/*.tsx` - ~100-200 lines each

---

## Validation

### Check Import Rules
```bash
# Find all imports in client components
grep -r "^import.*from" client/components/

# Ensure no screen imports
grep -r "screens" client/components/
# Should return: no results

# Check for cycles
npm run check:types
# Will error if circular dependencies exist
```

### Check Module Structure
```bash
# Count components
ls -1 client/components/*.tsx | wc -l
# Should be: 16

# Count screens
ls -1 client/screens/*.tsx | wc -l
# Should be: 6
```

## Evidence Files

**Module Structure**:
- All folders listed above exist and contain described files
- Use `tree -L 2 client/` to verify structure

**Import Configuration**:
- `/tsconfig.json` - Path aliases (`@/*`)
- `/babel.config.js` - Module resolver plugin

**Dependencies**:
- `/package.json` - All external dependencies

---

[← Back to Index](./00_INDEX.md) | [← Previous: Runtime Topology](./20_RUNTIME_TOPOLOGY.md) | [Next: Key Flows →](./40_KEY_FLOWS.md)
