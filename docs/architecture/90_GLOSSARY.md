# Glossary

[← Back to Index](./00_INDEX.md) | [← Previous: Key Flows](./40_KEY_FLOWS.md)

## Terms & Acronyms

### A

**Album**  
A user-created collection of photos. Contains references to photo IDs, not actual photo data. Has a cover photo and modification timestamps.  
_Location: `client/types/index.ts`_

**AsyncStorage**  
React Native's key-value storage system for persistent local data. Used to store photos, albums, and user profile on device.  
_Package: `@react-native-async-storage/async-storage`_

**ADR (Architecture Decision Record)**  
Documents explaining why specific architectural choices were made.  
_Location: `docs/adr/`_

### B

**Babel**  
JavaScript transpiler that converts modern JavaScript/TypeScript/JSX into backwards-compatible code.  
_Config: `babel.config.js`_

**Bidirectional Relationship**  
Photos know which albums contain them (albumIds array) AND albums know which photos they contain (photoIds array). Enables efficient queries in both directions.  
_Evidence: `client/types/index.ts` line 11-32_

### C

**CORS (Cross-Origin Resource Sharing)**  
HTTP security feature allowing the server to specify which origins can access resources. Configured to allow localhost and Replit domains.  
_Evidence: `server/index.ts` line 26-65_

**Cascading Delete**  
When deleting a photo, automatically remove it from all albums and update album covers if needed.  
_Evidence: `client/lib/storage.ts` line 44-60_

### D

**Drizzle ORM**  
TypeScript-first database ORM for PostgreSQL. Schema defined but not connected in MVP.  
_Config: `drizzle.config.ts`, Schema: `shared/schema.ts`_

**Date Grouping**  
Photos organized by time ranges: Today, Yesterday, Last 7 Days, Last Month, or by Month/Year.  
_Evidence: `client/lib/storage.ts` line 218-278_

### E

**Expo**  
Development platform for React Native providing native module access, OTA updates, and simplified workflow.  
_Config: `app.json`, SDK Version: 54_

**Empty State**  
UI shown when no data exists. Uses illustrations to guide users to first action.  
_Component: `client/components/EmptyState.tsx`_

**ESLint**  
JavaScript/TypeScript linter for code quality and consistency.  
_Config: `eslint.config.js`_

### F

**FAB (Floating Action Button)**  
Circular button fixed to bottom-right for primary actions (photo upload). Gold accent color.  
_Component: `client/components/FloatingActionButton.tsx`_

**FlashList**  
High-performance list component from Shopify with better performance than FlatList.  
_Package: `@shopify/flash-list`, Used in: `client/components/PhotoGrid.tsx`_

### G

**Gesture Handler**  
React Native library enabling native touch gestures (swipe, pinch, pan).  
_Package: `react-native-gesture-handler`_

### H

**Haptics**  
Tactile feedback (vibrations) when user interacts with UI elements.  
_Package: `expo-haptics`_

**HTTP Server**  
Node.js server created by Express, listens on port 5000.  
_Evidence: `server/index.ts` line 134-143_

### I

**Import Alias**  
`@/` prefix for imports resolves to `client/` directory. Example: `import { Button } from '@/components/Button'`  
_Config: `tsconfig.json` paths, `babel.config.js` module-resolver_

### J

**JSX**  
JavaScript XML syntax for writing React components. Transpiled by Babel.

**JWT (JSON Web Token)**  
Future authentication token format (not yet implemented).

### K

**KeyboardProvider**  
Manages keyboard appearance and behavior across the app.  
_Package: `react-native-keyboard-controller`_

### L

**Landing Page**  
HTML page shown when scanning Expo Go QR code.  
_Template: `server/templates/landing-page.html`_

### M

**Metro**  
JavaScript bundler for React Native, part of Expo workflow.  
_Port: 8081_

**Modal**  
Screen presented over current screen (PhotoDetailScreen, AlbumDetailScreen).  
_Navigation: `client/navigation/RootStackNavigator.tsx`_

**MVP (Minimum Viable Product)**  
Current state: local-only app without backend API or cloud storage.

### N

**Navigation Container**  
Root component from React Navigation wrapping all navigators.  
_Evidence: `client/App.tsx` line 33_

### O

**ORM (Object-Relational Mapping)**  
Database abstraction layer (Drizzle) converting between database tables and TypeScript objects.

**OTA (Over-The-Air)**  
Expo feature for updating app without App Store submission (not configured in MVP).

### P

**Photo**  
Core data type representing a user's photo with metadata (uri, dimensions, timestamps, favorites, album relationships).  
_Type: `client/types/index.ts` line 11-22_

**PostgreSQL**  
Relational database configured but not connected in MVP. Schema ready via Drizzle.  
_Schema: `shared/schema.ts`_

**Provider**  
React context provider wrapping app with functionality (React Query, Navigation, Gestures, etc.).  
_Evidence: `client/App.tsx` line 27-41_

### Q

**Query Client**  
React Query instance managing server state cache and refetch logic.  
_Config: `client/lib/query-client.ts`_

### R

**React Native**  
Framework for building native mobile apps using React and JavaScript/TypeScript.  
_Version: 0.81.5_

**React Query**  
Data fetching and caching library with automatic background refetching.  
_Package: `@tanstack/react-query`, Version: 5.90.7_

**Reanimated**  
React Native animation library using worklets for smooth 60fps animations.  
_Package: `react-native-reanimated`_

**Replit**  
Cloud development environment hosting this project. Provides dynamic domains and environment variables.  
_Evidence: `package.json` scripts use `$REPLIT_DEV_DOMAIN`_

### S

**SafeAreaProvider**  
React Native context providing safe area insets (avoiding notches, status bars).  
_Package: `react-native-safe-area-context`_

**Stack Navigator**  
Navigation pattern where screens stack on top of each other (push/pop).  
_Evidence: `client/navigation/*StackNavigator.tsx` files_

**Storage Info**  
Statistics about photo storage usage (used bytes, photo count, album count).  
_Type: `client/types/index.ts` line 34-39_

### T

**Tab Navigator**  
Bottom tab bar with 4 tabs (Photos, Albums, Search, Profile).  
_Evidence: `client/navigation/MainTabNavigator.tsx`_

**ThemedText / ThemedView**  
Base components with automatic light/dark theme support.  
_Components: `client/components/ThemedText.tsx`, `client/components/ThemedView.tsx`_

**TypeScript**  
Typed superset of JavaScript providing compile-time type checking.  
_Version: 5.9.2, Config: `tsconfig.json`_

**tsx**  
TypeScript execution engine for Node.js (runs server code).  
_Usage: `npm run server:dev` uses `tsx server/index.ts`_

### U

**URI (Uniform Resource Identifier)**  
String identifying photo location. In MVP: local file paths (file:///...).  
_Example: photo.uri in Photo type_

**User Profile**  
User data stored locally (name, email, avatar). No authentication in MVP.  
_Storage: `client/lib/storage.ts`, Key: `@photo_vault_user`_

### V

**Validation**  
Type checking (TypeScript) and linting (ESLint) to ensure code correctness.  
_Commands: `npm run check:types`, `npm run lint`_

### W

**Worklets**  
JavaScript functions running on the UI thread for smooth animations (used by Reanimated).  
_Package: `react-native-worklets`_

### Z

**Zod**  
TypeScript schema validation library. Used with Drizzle for runtime type checking.  
_Package: `zod`, `drizzle-zod`_

---

## Domain Language

### Photo Vault Specific Terms

**Gallery-Quality Presentation**  
Design principle: generous whitespace, museum-like spacing, elegant aesthetics. Not cramped like warehouse storage.  
_Reference: `design_guidelines.md` line 18-24_

**Local-First Architecture**  
Design pattern where all data stored on device first, cloud sync is optional/future enhancement.  
_Current State: MVP is local-only_

**Bidirectional Relationship Pattern**  
Data modeling where both entities reference each other (photos ↔ albums) for efficient queries.  
_Implementation: `client/lib/storage.ts` maintains both sides_

**Cascading Operations**  
When modifying one entity (photo), automatically update related entities (albums).  
_Examples: Cascading delete, cover photo updates_

**Date-Based Grouping**  
Photos organized by intelligent time ranges, not flat chronological list.  
_Algorithm: `client/lib/storage.ts` line 218-278_

---

## File Extensions

| Extension | Meaning | Example |
|-----------|---------|---------|
| `.tsx` | TypeScript + JSX (React components) | `App.tsx` |
| `.ts` | TypeScript (logic, types, configs) | `storage.ts` |
| `.js` | JavaScript | `index.js` |
| `.json` | JSON configuration | `package.json` |
| `.md` | Markdown documentation | `README.md` |

---

## Storage Keys

| Key | Type | Contents |
|-----|------|----------|
| `@photo_vault_photos` | Photo[] | Array of all photos with metadata |
| `@photo_vault_albums` | Album[] | Array of all albums |
| `@photo_vault_user` | UserProfile | User name, email, avatar |

_Evidence: `client/lib/storage.ts` line 15-17_

---

## Common Abbreviations in Code

| Abbrev | Full Term | Context |
|--------|-----------|---------|
| `uri` | Uniform Resource Identifier | Photo file path |
| `id` | Identifier | Unique string for entities |
| `px` | Pixels | UI measurements |
| `ctx` | Context | React context |
| `nav` | Navigation | React Navigation |
| `req/res` | Request/Response | Express HTTP |
| `env` | Environment | Environment variables |
| `dev/prod` | Development/Production | Environments |

---

## Port Numbers

| Port | Service | Evidence |
|------|---------|----------|
| 5000 | Express backend server | `server/index.ts` line 137 |
| 8081 | Metro bundler (Expo) | React Native default |
| 19000+ | Expo Dev Tools | Expo default |

---

## Color Palette Reference

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Charcoal Blue | #2D3748 | Primary UI color |
| Muted Gold | #D4AF37 | Accent (FAB, favorites) |
| Cool White | #FAFBFC | Background |
| Pure White | #FFFFFF | Cards, modals |
| Near Black | #1A202C | Primary text |
| Warm Gray | #718096 | Secondary text |
| Soft Gray | #E2E8F0 | Borders |

_Evidence: `design_guidelines.md` line 105-115, `client/constants/theme.ts`_

---

## Quick Reference Commands

```bash
# Development
npm run expo:dev        # Start mobile app
npm run server:dev      # Start backend
npm run check:types     # TypeScript validation
npm run lint           # Code linting
npm run format         # Code formatting

# Database (not connected)
npm run db:push        # Push schema to database

# Build
npm run expo:static:build    # Build static Expo app
npm run server:build         # Build server
npm run server:prod          # Run production server
```

---

## Related Documentation

- **Design System**: `/design_guidelines.md`
- **Project Overview**: `/replit.md`
- **AI Metadata**: `/AI_DOCUMENTATION_REPORT.md`
- **Architecture Index**: `docs/architecture/00_INDEX.md`

---

[← Back to Index](./00_INDEX.md) | [← Previous: Key Flows](./40_KEY_FLOWS.md)
