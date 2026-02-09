Cloud-Gallery: Current State Specification

1. Overview
Cloud-Gallery is a mobile-first photo management application built with a React Native (Expo) frontend and an Express/Postgres backend. It currently provides fundamental functionality for uploading, viewing, organizing, and securing photos, with a strong emphasis on security and encryption.

2. Technology Stack
Frontend (Client)
Framework: Expo (React Native)
Navigation: React Navigation (Native Stack + Bottom Tabs)
State/Data Fetching: React Query (@tanstack/react-query)
Key Libraries:
expo-image (Optimized image loading)
expo-image-manipulator (Basic editing)
react-native-reanimated (Animations)
drizzle-orm (Likely for local data structure or shared schema usage)
Backend (Server)
Framework: Express.js
Database: PostgreSQL
ORM: Drizzle ORM
Authentication: JWT (JSON Web Tokens)
Storage: Local filesystem (uploads directory)
Validation: Zod

3. Existing Features
3.1 Authentication & Security
User Accounts: Registration and Login.
Encryption: Strong focus on encryption foundations (backup-encryption, db-encryption, 
encryption.ts
).
Authorization: Middleware ensures users can only access their own data.
3.2 Photo Management
View: Scrollable grid of photos.
Upload: Single file upload capability.
Delete: Two-stage deletion (Soft Delete -> Trash -> Permanent Delete).
Restore: Restore from Trash.
Favorites: Toggle favorite status on photos.
3.3 Albums
CRUD: Create, Read, Update, Delete albums.
Organization: Add/Remove photos to/from albums.
Ordering: Photos in albums have a position field for custom ordering.
3.4 Search
Client-Side Only: Fetches all photo metadata and filters locally.
Scope: Matches filenames only.
Filters:
"Favorites" chip.
"Recent" chip (slice of last 20).
Limitation: Does not scale; no semantic or metadata search.
3.5 Editing
Capabilities: Rotate (90°), Flip Horizontal.
Undo: Basic session-based undo stack.
Save Behavior: "Destructive" replacement – uploads a new image and updates the record pointer.

4. Data Flow & Architecture
API First: The client communicates via a RESTful API (/api/photos, /api/albums, etc.).
User Isolation: Strictly enforced at the database query level (where(eq(userId, ...))).
Pagination: Implemented on the server (limit/offset) for the main photo feed, but the Search screen appears to bypass this optimization by loading all photos (needs verification of getPhotos implementation in client/lib/storage).

5. Identified Gaps (vs. Google Photos)
No AI/ML: No object, face, or scene recognition.
Limited Search: filename-only search is insufficient for photo libraries.
Basic Editing: Missing crop, filters, lighting adjustments.
Sharing: No shared albums or public links found.
Sync: No evidence of background sync or incremental backup; relies on manual action/foreground state.