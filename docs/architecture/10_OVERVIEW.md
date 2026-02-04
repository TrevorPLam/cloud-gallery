# Cloud Gallery - System Overview

[← Back to Index](./00_INDEX.md)

## What Cloud Gallery Does

**Cloud Gallery** (also known as "Photo Vault") is a premium mobile photo storage and organization application. It competes with Google Photos by providing:

- **Gallery-quality presentation** of user photos with museum-like spacing and elegance
- **Local-first storage** using device AsyncStorage (no cloud backend in MVP)
- **Album organization** with manual photo curation
- **Smart search** by favorites and photo metadata
- **Cross-platform support** via React Native (iOS, Android, Web)

**Target Users**: Mobile users who want premium, elegant photo management without complex cloud sync.

**Current State**: MVP prototype with local storage. Backend server exists but is minimal (serves static files only).

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
│  │          Local Storage (AsyncStorage)                │  │
│  │  - Photos with metadata                              │  │
│  │  - Albums with photo references                      │  │
│  │  - User profile                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP (static files, future API)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Server (Node.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Express     │  │  Static File │  │  Future API  │     │
│  │  Server      │  │  Serving     │  │  Routes      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │     Database (Postgres - configured but unused)      │  │
│  │     - User schema defined via Drizzle ORM           │  │
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
- Serve Expo static build files
- Provide landing page for Expo Go
- CORS configuration for development

**Responsibilities** (future):
- REST API for photo uploads
- User authentication
- Database operations

**Current State**: Minimal - no active API routes yet

### 3. Shared Layer (shared/)

**Technology**: TypeScript + Drizzle ORM

**Responsibilities**:
- Database schema definitions
- Type definitions shared between client/server

**Current State**: User schema defined but not actively used

### 4. Data Storage

**Current (MVP)**: AsyncStorage (on-device key-value store)
- Photos array: `@photo_vault_photos`
- Albums array: `@photo_vault_albums`
- User profile: `@photo_vault_user`

**Future**: PostgreSQL via Drizzle ORM (schema defined in `shared/schema.ts`)

## Major Boundaries

### Client ↔ Server
- **Current**: Client is standalone (no server calls except static files)
- **Future**: REST API at `/api/*` endpoints
- **Protocol**: HTTP/HTTPS with CORS

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

1. **Local-first architecture**: All data stored on device for MVP, enabling offline-first experience
2. **Expo framework**: Simplified native module access and OTA updates
3. **React Query**: Centralized data fetching with built-in caching
4. **Minimal backend**: Server infrastructure ready but not required for MVP
5. **Bidirectional relationships**: Photos know their albums AND albums know their photos (easier queries)
6. **AsyncStorage for persistence**: Simple, no-setup storage solution for MVP

## Security & Privacy Boundaries

1. **No cloud storage in MVP**: All photos stay on device
2. **Media permissions**: Required for camera roll access
3. **No authentication in MVP**: Single local user per device
4. **Future auth**: PostgreSQL user schema prepared for username/password

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
- `/client/screens/` - Main UI screens (6 files)
- `/client/components/` - Reusable UI components (16 files)
- `/client/navigation/` - Navigation configuration (6 files)
- `/server/` - Backend server code (4 files)

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
