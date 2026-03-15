# Cloud Gallery - System Overview

[← Back to Index](./00_INDEX.md)

## What Cloud Gallery Does

**Cloud Gallery** (also known as "Photo Vault") is a premium mobile photo storage and organization application. It competes with Google Photos by providing:

- **Gallery-quality presentation** of user photos with museum-like spacing and elegance
- **Hybrid data model**: local storage (AsyncStorage, with optional client-side encryption) plus backend API when the user is authenticated
- **Album organization** with manual photo curation
- **Smart search** by favorites, metadata, and server-side search when connected
- **Cross-platform support** via React Native (iOS, Android, Web)

**Target Users**: Mobile users who want premium, elegant photo management with optional cloud sync and backup.

**Current State**: Full backend API is implemented. The client uses local storage always; when authenticated, it also uses the server for photos, albums, backup, sync, memories, sharing, partner sharing, faces, search, and smart albums. The server uses PostgreSQL via Drizzle when `DATABASE_URL` is set (otherwise runs in no-DB mode for development).

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile App (Client)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  React       │  │  React       │  │  React       │     │
│  │  Navigation  │  │  Query       │  │  Native      │     │
│  │              │  │  (caching)   │  │  Components  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Local Storage (AsyncStorage, optional encryption)   │  │
│  │  - Photos, albums, user profile                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP: static files + REST API at /api/*
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Server (Node.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Express     │  │  Static     │  │  REST API    │     │
│  │  Server      │  │  Serving    │  │  /api/*      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL + Drizzle ORM (when DATABASE_URL set)    │  │
│  │  - users, photos, albums, sharing, backup, sync, etc. │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Mobile Application (client/)

**Technology**: React Native 0.81 + Expo SDK 54

**Responsibilities**:
- UI rendering and user interactions
- Photo selection from device media library
- Local data persistence via AsyncStorage
- Navigation between screens
- Image optimization and display

**Key Libraries**:
- `@react-navigation/*` - Screen navigation
- `@tanstack/react-query` - Data fetching and caching
- `expo-image-picker` - Photo selection
- `expo-media-library` - Media access
- `@shopify/flash-list` - High-performance lists
- `react-native-reanimated` - Smooth animations

### 2. Backend Server (server/)

**Technology**: Express 5.x on Node.js

**Responsibilities** (current):
- Serve Expo static build files and landing page for Expo Go
- CORS and security middleware
- Full REST API at `/api/*`: auth, photos, albums, upload, ML, search, smart albums, memories, faces, sharing, partner-sharing, backup, sync
- PostgreSQL persistence via Drizzle when `DATABASE_URL` is set; optional no-DB mode for development

**Current State**: Full API implemented and mounted in `server/routes.ts`

### 3. Shared Layer (shared/)

**Technology**: TypeScript + Drizzle ORM

**Responsibilities**:
- Database schema definitions (users, photos, albums, faces, people, sharing, memories, smart albums, backup, sync, partner-sharing, storage usage, etc.)
- Zod validation schemas and type exports shared between client/server

**Current State**: Full schema in use by the server when database is enabled

### 4. Data Storage

**Client (always)**: AsyncStorage (on-device), with optional AES-256-GCM encryption for metadata via `client/lib/secure-storage.ts`
- Keys: `@photo_vault_photos`, `@photo_vault_albums`, `@photo_vault_user`

**Server (when authenticated and DB configured)**: PostgreSQL via Drizzle ORM; schema in `shared/schema.ts` (photos, albums, users, sharing, backup, sync, etc.)

## Major Boundaries

### Client ↔ Server
- **Current**: Client uses local storage always; when authenticated, it calls REST API at `/api/*` for photos, albums, backup, sync, sharing, memories, search, smart albums, etc.
- **Protocol**: HTTP/HTTPS with CORS; JWT in `Authorization` header for protected routes

### App ↔ Device
- **Media Access**: Via Expo permissions (camera roll, media library)
- **Storage**: Via AsyncStorage (React Native abstraction over native storage)
- **Platform APIs**: Via Expo modules (haptics, sharing, etc.)

### Navigation Layers
- **Tab Navigation**: 4 main tabs (Photos, Albums, Search, Profile)
- **Stack Navigation**: Per-tab navigation stacks
- **Modal Navigation**: Photo detail and album detail screens

## Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Mobile Framework | React Native | 0.81.5 | Cross-platform app development |
| Mobile Tooling | Expo | 54.x | Development workflow & native modules |
| UI Library | React | 19.1.0 | Component-based UI |
| Navigation | React Navigation | 7.x | Screen routing |
| State Management | React Query | 5.90.7 | Server state & caching |
| Local Storage | AsyncStorage | 2.2.0 | Persistent local data |
| Backend | Express | 5.0.1 | HTTP server |
| Database ORM | Drizzle | 0.39.3 | Type-safe database queries |
| Database | PostgreSQL | 8.x | Relational database (configured) |
| Language | TypeScript | 5.9.2 | Type safety |

## Key Design Decisions

1. **Hybrid local + server**: Local storage (with optional encryption) for device data; backend API for sync, backup, sharing, and ML when user is authenticated
2. **Expo framework**: Simplified native module access and OTA updates
3. **React Query**: Centralized data fetching with built-in caching
4. **Full backend**: Express API and PostgreSQL (when configured) for auth, photos, albums, upload, search, memories, sharing, backup, sync
5. **Bidirectional relationships**: Photos know their albums AND albums know their photos (easier queries)
6. **AsyncStorage + optional encryption**: Local persistence; optional client-side AES-256-GCM for sensitive metadata

## Security & Privacy Boundaries

1. **Local storage**: Photos and metadata can stay on device only, or sync/backup to server when authenticated
2. **Media permissions**: Required for camera roll access
3. **Authentication**: JWT-based auth; optional client-side encryption for local metadata (AES-256-GCM)
4. **Server**: PostgreSQL user and photo schema; Argon2 password hashing; protected routes require JWT

## Evidence

**Key Files**:
- Entry point: `/client/index.js` - Expo registration
- Root component: `/client/App.tsx` - Provider setup
- Server bootstrap: `/server/index.ts` - Express app
- Type definitions: `/client/types/index.ts` - Core data models
- Storage layer: `/client/lib/storage.ts` - AsyncStorage operations
- Database schema: `/shared/schema.ts` - Drizzle ORM schema
- Package manifest: `/package.json` - Dependencies and scripts

**Key Directories**:
- `/client/screens/` - Main UI screens (Photos, Albums, Search, Profile, Backup, Sync, Memories, etc.)
- `/client/components/` - Reusable UI components
- `/client/navigation/` - Navigation configuration (auth stack, main stack, tabs)
- `/server/` - Backend server (routes, auth, services, middleware)

**Configuration Files**:
- `/app.json` - Expo app configuration
- `/tsconfig.json` - TypeScript configuration
- `/babel.config.js` - Babel transpiler setup
- `/drizzle.config.ts` - Database ORM configuration

## Doc Maintenance Rules

### When to Update This Doc

**Update OVERVIEW.md when**:
1. Adding a new major component or service
2. Changing technology stack (library versions, new frameworks)
3. Modifying system boundaries (client-server communication)
4. Making architectural decisions that affect multiple modules

**Examples**:
- ✅ Adding cloud storage backend → Update architecture diagram
- ✅ Switching from AsyncStorage to SQLite → Update data storage section
- ✅ Adding authentication flow → Update boundaries section
- ❌ Adding a new UI component → No update needed (covered in modules doc)
- ❌ Fixing a bug → No update needed

### How to Keep Docs Current

1. **When adding features**: Check if it introduces new boundaries or components
2. **When changing dependencies**: Update technology stack table
3. **Monthly review**: Verify diagrams match current implementation
4. **Link new docs**: When creating specialized docs, link from relevant sections

### Validation

Run these checks before committing doc changes:
```bash
# Verify all referenced files exist
ls -la client/index.js client/App.tsx server/index.ts

# Check TypeScript compiles
npm run check:types

# Verify scripts work
npm run expo:dev --help
npm run server:dev --help
```

---

**Last Updated**: 2026-02-04  
**Next Review**: 2026-05-04  
[← Back to Index](./00_INDEX.md) | [Next: Runtime Topology →](./20_RUNTIME_TOPOLOGY.md)
