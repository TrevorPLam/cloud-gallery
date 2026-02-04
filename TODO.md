# Cloud Gallery Product Roadmap

**Last Updated**: 2026-02-04

---

# ⚠️ **CODE QUALITY ANALYSIS — FIX BEFORE ADDING FEATURES**

**Analysis Date**: February 4, 2026  
**Application Code Status**: 6/10 - Functional but needs refactoring  
**Recommendation**: Complete all P0 fixes before implementing new features

## 🔴 **P0 — Critical Code Quality Issues**

### 1. **Client-Server Architecture Mismatch** 🚨 **BLOCKING**

**Problem**: Client and server are disconnected
- Client uses local `AsyncStorage` in `client/lib/storage.ts`
- Server has authentication but **no photo/album API endpoints**
- `server/routes.ts` only has `/api/auth` and `/api/upload` routes
- Client screens don't make any API calls - everything is local

**Impact**: Cannot sync data, no cloud storage, multi-device support impossible

**Fix Required**:
```
[ ] Create server photo CRUD endpoints (/api/photos)
[ ] Create server album CRUD endpoints (/api/albums)
[ ] Integrate client screens with API using React Query
[ ] Remove or refactor local AsyncStorage to be cache layer
[ ] Add sync logic between local and remote storage
```

---

### 2. **Data Persistence Layer is Fragile** 🚨

**File**: `client/lib/storage.ts`

**Problems**:
- ❌ No data validation (corrupt data can be saved)
- ❌ No transactions (multi-step operations can partially fail)
- ❌ Bidirectional relationships maintained manually (albums ↔ photos)
- ❌ Collision-prone ID generation: `Date.now().toString() + Math.random()`
- ❌ No migration strategy for schema changes
- ❌ No data integrity checks
- ❌ `try-catch` with silent failures (returns empty arrays)

**Example Issue**:
```typescript
// In deletePhoto() - if saveAlbums() fails, photo is deleted but albums still reference it
await savePhotos(filtered);  // succeeds
await saveAlbums(updatedAlbums);  // fails - data is now inconsistent!
```

**Fix Required**:
```
[ ] Add Zod schemas for data validation
[ ] Implement transactional updates or rollback mechanism
[ ] Generate UUIDs instead of timestamp+random
[ ] Add data integrity checks on load
[ ] Create migration system for schema changes
[ ] Add comprehensive error handling with user feedback
[ ] Consider using SQLite (expo-sqlite) for ACID transactions
```

**Recommended Approach**:
```typescript
// Use proper UUIDs
import { randomUUID } from 'expo-crypto';

// Validate before saving
const photoSchema = z.object({
  id: z.string().uuid(),
  uri: z.string().url(),
  // ... other fields
});

export async function addPhoto(photo: Photo): Promise<void> {
  // Validate
  const validated = photoSchema.parse(photo);
  
  // Transactional update
  const photos = await getPhotos();
  photos.unshift(validated);
  
  try {
    await savePhotos(photos);
  } catch (error) {
    // Proper error handling with user notification
    throw new Error('Failed to save photo: ' + error.message);
  }
}
```

---

### 3. **Missing Environment Variable Management** 🚨

**Problems**:
- ❌ No `.env.example` file
- ❌ No environment variable validation at startup
- ❌ Client requires `EXPO_PUBLIC_DOMAIN` but not documented
- ❌ Server has defaults for critical secrets (JWT_SECRET)
- ❌ No type-safe environment variable access

**Current Unsafe Pattern**:
```typescript
// client/lib/query-client.ts
export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;  // Can be undefined!
  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");  // Only fails at runtime
  }
  // ...
}
```

**Fix Required**:
```
[ ] Create .env.example with all required variables
[ ] Add environment validation at app startup
[ ] Create type-safe env config module
[ ] Document all environment variables in README
[ ] Remove default secrets from code
```

**Recommended Solution**:
```typescript
// shared/env.ts
import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_DOMAIN: z.string().min(1),
  EXPO_PUBLIC_API_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'staging', 'production']),
});

export const env = envSchema.parse(process.env);

// Now use env.EXPO_PUBLIC_DOMAIN with type safety
```

---

### 4. **Type Safety Issues** 🔴

**Problems Found**:
- 20+ instances of `as any` in server code
- Missing explicit return types on many functions
- Incomplete error typing throughout
- Type assertions instead of proper type guards

**Examples**:
```typescript
// server/auth-routes.ts:251
const user = findUserByEmail((decoded as any).email);  // Should type decode properly

// server/audit.ts
userId: (req as any).user?.id,  // Should extend Request type

// Multiple files
} catch (error) {
  console.error(error);  // error is 'unknown', should be typed
}
```

**Fix Required**:
```
[ ] Remove all "as any" casts - add proper types
[ ] Add explicit return types to all functions
[ ] Create proper type guards for runtime checks
[ ] Extend Express Request type properly for custom properties
[ ] Type all catch blocks properly
```

**Recommended Pattern**:
```typescript
// Extend Express types properly
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
      requestId?: string;
      audit?: AuditContext;
    }
  }
}

// Proper error typing
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

// Type guards
function isJWTPayload(decoded: unknown): decoded is { id: string; email: string } {
  return (
    typeof decoded === 'object' &&
    decoded !== null &&
    'id' in decoded &&
    'email' in decoded
  );
}
```

---

### 5. **Hardcoded UI Values Breaking Responsiveness** 🔴

**File**: `client/components/PhotoGrid.tsx`

**Problem**:
```typescript
// Calculated at module load - never updates!
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;  // Hardcoded
const PHOTO_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
```

**Impact**:
- Doesn't respond to screen rotation
- Breaks on tablets (3 columns too narrow)
- Can't adjust for different screen sizes
- Won't work for web responsive design

**Fix Required**:
```
[ ] Use useWindowDimensions() hook instead of static dimensions
[ ] Make NUM_COLUMNS responsive based on screen width
[ ] Recalculate layout on dimension changes
[ ] Test on tablets, web, and various screen sizes
```

**Recommended Solution**:
```typescript
export function PhotoGrid({ ... }: PhotoGridProps) {
  const { width } = useWindowDimensions();
  
  // Responsive columns: 2 for phone portrait, 3 for landscape, 4+ for tablet
  const numColumns = width < 500 ? 2 : width < 768 ? 3 : 4;
  const photoSize = (width - GAP * (numColumns - 1)) / numColumns;
  
  return (
    <FlashList
      key={numColumns}  // Force re-render on column change
      numColumns={numColumns}
      estimatedItemSize={photoSize}
      // ...
    />
  );
}
```

---

### 6. **Console Logs in Production Code** 🟡

**Found**:
- 7 `console.log` / `console.error` statements in client code
- Should use proper logging service
- Can expose sensitive information

**Files**:
- `client/screens/PhotoDetailScreen.tsx` - Share error logging
- `client/lib/secure-storage.ts` - Multiple decryption error logs
- `client/components/ErrorFallback.tsx` - Restart error logging

**Fix Required**:
```
[ ] Create logging service with environment-aware levels
[ ] Replace all console.* calls with logger service
[ ] Ensure no sensitive data logged
[ ] Add structured logging with context
```

**Recommended Solution**:
```typescript
// client/lib/logger.ts
const isDev = __DEV__;

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (isDev) console.debug(message, data);
  },
  info: (message: string, data?: unknown) => {
    if (isDev) console.info(message, data);
  },
  warn: (message: string, data?: unknown) => {
    console.warn(message, data);
    // Send to error tracking in production
  },
  error: (message: string, error: Error, context?: unknown) => {
    console.error(message, error);
    // Send to Sentry/error tracking
  }
};
```

---

## 🟡 **P1 — High Priority Improvements**

### 7. **No Centralized Error Handling**

**Problem**: Errors handled inconsistently
- Some functions return empty arrays on error
- Some functions throw
- Some functions fail silently
- No user feedback for failures

**Fix Required**:
```
[ ] Create centralized error handling service
[ ] Add error boundaries for each major screen
[ ] Show user-friendly error messages
[ ] Add retry mechanisms for transient failures
[ ] Log errors to monitoring service
```

---

### 8. **Performance Concerns for Large Libraries**

**Problems**:
- Loads all photos into memory (will crash with 10k+ photos)
- No pagination
- No virtual scrolling for album lists
- No image caching strategy documented
- FlashList `estimatedItemSize` might be inaccurate

**Fix Required**:
```
[ ] Implement pagination (load 100 photos at a time)
[ ] Add infinite scroll
[ ] Configure expo-image caching properly
[ ] Optimize FlashList estimatedItemSize
[ ] Implement database query limits
```

---

### 9. **Missing Abstraction Layers**

**Problem**: Direct dependencies throughout codebase
- Screens directly use `AsyncStorage` via storage.ts
- No repository pattern
- No service layer
- Difficult to swap implementations
- Hard to test

**Fix Required**:
```
[ ] Create repository interfaces
[ ] Add service layer for business logic
[ ] Abstract storage behind interface
[ ] Enable dependency injection for testing
```

**Recommended Architecture**:
```
client/
  services/          # Business logic
    PhotoService.ts
    AlbumService.ts
  repositories/      # Data access
    IPhotoRepository.ts (interface)
    LocalPhotoRepository.ts
    RemotePhotoRepository.ts
  lib/              # Infrastructure
    storage.ts      # Implementation detail
```

---

### 10. **No Offline/Online State Management**

**Problem**:
- App doesn't detect online/offline status
- No sync queue for offline changes
- No conflict resolution strategy
- Client has `query-client.ts` but doesn't use React Query properly

**Fix Required**:
```
[ ] Add NetInfo to detect connection status
[ ] Implement offline queue for mutations
[ ] Add sync status UI indicators
[ ] Handle conflicts (last-write-wins or user merge)
[ ] Use React Query's built-in offline support
```

---

### 11. **Incomplete React Query Integration**

**File**: `client/lib/query-client.ts`

**Problems**:
- React Query configured but not used in any screens
- Screens use `useState` + `useCallback` instead of `useQuery`
- Manual loading states instead of React Query's
- No optimistic updates
- No cache invalidation strategy

**Current (Manual)**:
```typescript
// PhotosScreen.tsx - doing this manually!
const [photos, setPhotos] = useState<Photo[]>([]);
const [isLoading, setIsLoading] = useState(true);

const loadPhotos = useCallback(async () => {
  const data = await getPhotos();
  setPhotos(data);
  setIsLoading(false);
}, []);
```

**Should Be**:
```typescript
// Using React Query properly
const { data: photos = [], isLoading } = useQuery({
  queryKey: ['photos'],
  queryFn: getPhotos,
});

// Mutations with optimistic updates
const addPhotoMutation = useMutation({
  mutationFn: addPhoto,
  onMutate: async (newPhoto) => {
    // Optimistic update
    await queryClient.cancelQueries({ queryKey: ['photos'] });
    const previousPhotos = queryClient.getQueryData(['photos']);
    queryClient.setQueryData(['photos'], old => [newPhoto, ...old]);
    return { previousPhotos };
  },
  onError: (err, newPhoto, context) => {
    // Rollback on error
    queryClient.setQueryData(['photos'], context.previousPhotos);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['photos'] });
  },
});
```

**Fix Required**:
```
[ ] Convert all data fetching to useQuery
[ ] Convert all mutations to useMutation
[ ] Add optimistic updates
[ ] Remove manual loading/error states
[ ] Add proper cache invalidation
```

---

## 🟢 **P2 — Nice to Have Improvements**

### 12. **Code Documentation**
- ✅ Excellent AI-META comments on most files
- ⚠️ Missing JSDoc on public APIs
- ⚠️ No architecture decision records (ADRs)

### 13. **Testing Gaps**
- ✅ Test files exist for security/server code
- ❌ No tests for client components
- ❌ No tests for storage layer
- ❌ No integration tests for client-server

### 14. **Code Duplication**
- Date grouping logic in storage.ts (should be separate utility)
- Modal patterns repeated (should be reusable Modal component)
- Loading states repeated (should use SWR pattern from React Query)

---

## ✅ **What's Already Good**

1. **TypeScript Strict Mode** - Excellent foundation
2. **AI-META Documentation** - Outstanding inline documentation
3. **Security Implementation** - Server has comprehensive security
4. **Modern Stack** - React Native, Expo, React Query, Zod
5. **Code Style** - Consistent with Prettier + ESLint
6. **Component Structure** - Clean separation of components
7. **Theme System** - Good theming with hooks

---

## 📋 **Recommended Fix Order**

**Week 1: Foundation**
1. Fix client-server architecture mismatch (create API endpoints)
2. Add environment variable validation
3. Create .env.example

**Week 2: Data Layer**
4. Refactor storage.ts with validation and transactions
5. Fix UUID generation
6. Remove all "as any" and improve type safety

**Week 3: Architecture**
7. Integrate React Query properly in all screens
8. Add abstraction layers (services/repositories)
9. Implement offline/online detection

**Week 4: UX & Performance**
10. Fix responsive layout issues
11. Add pagination for large libraries
12. Centralize error handling with user feedback

**After these fixes, the codebase will be ready for P0-P3 feature development.**

---

## Priority Framework

* **P0 – Critical must-have (foundational trust & reliability)**
* **P1 – High priority (organization, search, AI control, power UX)**
* **P2 – Medium priority (editing, sharing, convenience)**
* **P3 – Nice-to-have (delighters, premium features)**

This does **NOT** omit anything. Everything found in your entire context is included and sorted logically and sentiment-driven.

---

# 🟥 P0 — Foundational Must-Haves

*(If you fail these, consumers will NOT trust or adopt your app. Every competitor struggles here.)*

## 🔥 P0.1 — Reliability, Sync, Backup (the #1 consumer pain category)

* [ ] **True Backup Mode (Archive Vault)** — Write-once area separate from sync; no propagation of deletes.
* [ ] **Sync Health Dashboard** — "Last backup time," "Pending items," "Blocked because…".
* [ ] **Per-Item Truth Panel** — Local vs cloud copy, checksum, version, last-upload timestamp.
* [ ] **Audit & Repair Tool** — Detects missing photos, stuck uploads, corrupt indexing, broken albums.
* [ ] **Clear Device/Cloud States** — "Local only," "Synced," "Cloud only," "Pinned offline."
* [ ] **Resumable Uploads** — Handles network changes, reboots, throttling.
* [ ] **Background Upload Reliability** — No requirement to keep the app open.
* [ ] **Upload Queue Visibility** — Real-time ingestion log.
* [ ] **Multi-device consistency checks** — Identify devices out of sync.

## 🔥 P0.2 — Deletion Semantics (2nd most common pain)

* [ ] **Explicit Delete Actions**:
  * Delete from Device
  * Delete from Cloud
  * Remove from Backup (keep local)
  * Unlink Device (stop syncing)
* [ ] **Deletion Contract UI** — "This action affects: Device / Cloud / Shared Albums / Trash".
* [ ] **Safe Trash Retention** — Visible retention window & restore flow.
* [ ] **Undo restore with original album context**.

## 🔥 P0.3 — Duplicates & Data Integrity

* [ ] **Duplicate Prevention (idempotent uploads)** — Fingerprinting + hashes.
* [ ] **Duplicate Detection (exact + perceptual)** — Burst detection, reshares, screenshots.
* [ ] **Duplicate Merge** — Preserve albums, favorites, edits, metadata.
* [ ] **Auto-detect multi-folder camera paths** (Samsung/OneDrive conflicts).

## 🔥 P0.4 — Export, Migration, Data Ownership

* [ ] **One-Click Export (full library)** — Originals, edits, metadata, people tags, albums.
* [ ] **Album-Preserving Export** — Albums → folders + manifest.
* [ ] **Export Verification Report** — Count parity, missing items, date drift.
* [ ] **Direct Import Connectors** from: Google, iCloud, OneDrive, Dropbox, Amazon.
* [ ] **Open metadata formats** (EXIF/XMP sidecars when needed).
* [ ] **"No lock-in" guarantee** — Long deprecation timelines.

## 🔥 P0.5 — Privacy & Trust (now mandatory for mainstream)

* [ ] **Privacy Dial** — Standard mode vs E2EE Vault mode.
* [ ] **E2EE Vault** for sensitive albums (disables some AI; store locally or encrypted cloud).
* [ ] **Transparent AI data-use disclosure** — Plain language.
* [ ] **Moderation Appeals Flow** — Human escalation for false positives.
* [ ] **No forced OS integration** — Always opt-in.

## 🔥 P0.6 — Performance & Scalability

* [ ] **Instant timeline scrolling** for 10k → 500k photos.
* [ ] **Indexing that doesn't freeze the UI**.
* [ ] **Predictable image preview quality** (no "corrupted-looking" low-res placeholders).
* [ ] **Configurable local caching** — "Keep X years offline."

---

# 🟧 P1 — High Priority (Search, Organization, AI, UX)

## 🔥 P1.1 — Search & AI (Consumer expectation, but must be fixable)

* [ ] **Dual Search Modes** — Classic (filters) + Ask (semantic).
* [ ] **Pro Filters Panel** — Date ranges, camera model, lens, location radius, file type, album intersection, filename.
* [ ] **Explain Results** — "Matched because: dog + backyard + 2023."
* [ ] **Offline/on-device indexing** (faces, scenes, OCR).
* [ ] **Manual tags/keywords**.
* [ ] **Manual face/pet management** — merge/split, override misidentification.
* [ ] **OCR search (text in photos)**.
* [ ] **Face/Pet recognition quality & correction tools**.
* [ ] **Unsupervised object clustering** (food, docs, receipts, screenshots).
* [ ] **Smart Albums** — dynamic, rule-based.

## 🔥 P1.2 — Library Organization (UX friction)

* [ ] **Folders + Albums + Hierarchy** (Lightroom-like DAM patterns).
* [ ] **Multiple views** — timeline, map, folders, people, pets, docs, screenshots.
* [ ] **High-performance web UI** (fixes iCloud/Amazon/Dropbox pain).
* [ ] **Fix broken album references** automatically.
* [ ] **Robust EXIF edit tools** — date/time shift, location edit.

## 🔥 P1.3 — Sync / OS Model Clarity

* [ ] **Explicit folder opt-in** — No auto-moving Desktop/Documents/Pictures.
* [ ] **Device roles** — Sync source, archive source, viewer-only.
* [ ] **Sandboxed vendor integrations** (Samsung/OneDrive-style conflicts eliminated).

## 🔥 P1.4 — Offline Mode

* [ ] **Pin albums for offline**.
* [ ] **Offline editing**.
* [ ] **Offline search** (metadata + thumbnails).
* [ ] **Offline timeline browsing** without lag.

---

# 🟨 P2 — Medium Priority (Editing, Sharing, UX polish)

## P2.1 — Editing Tools

* [ ] Basic editor: crop, rotate, color sliders, exposure.
* [ ] Advanced: curves, selective adjustments, noise reduction (Apple-quality).
* [ ] AI tools:
  * Magic Eraser / object removal
  * Unblur/sharpen
  * Portrait relight
* [ ] Auto-enhance pipeline.
* [ ] Collages, animations, GIFs.
* [ ] Auto-generated highlight reels ("Memories" equivalent).
* [ ] Video trim, stabilize, color adjust.

*(Editing matters but does not prevent churn like sync/migration issues do.)*

## P2.2 — Sharing & Collaboration

* [ ] Shared albums.
* [ ] Collaborative albums (contributors).
* [ ] Auto-updating shared albums (person/pet-based).
* [ ] Family Library model with private subspaces.
* [ ] Public/private/expiring/password links.
* [ ] Event shares via QR/URL (wedding/birthday dropbox).
* [ ] Smart display integrations (Fire TV / Chromecast / Apple TV).

## P2.3 — Multi-User & Family Features

* [ ] Kid-photo auto-collection (multi-parent ingestion).
* [ ] Private spaces for adults.
* [ ] Shared settings overview ("Who sees what?").

---

# 🟩 P3 — Nice-to-Haves & Differentiators (Delighters)

## P3.1 — Hybrid Local/Cloud Models

* [ ] NAS/Local Drive integration (Synology/Nextcloud-style).
* [ ] "Mirror to external drive" option.
* [ ] Peer-to-peer device sync as backup fallback.

## P3.2 — Smart Cleanup Tools

* [ ] Bulk remove screenshots.
* [ ] Remove blurry photos.
* [ ] Remove near-duplicates but keep "best shot."
* [ ] Identify docs, receipts, memes.

## P3.3 — Creativity & Fun

* [ ] Generative AI memes ("Me Meme" style).
* [ ] Photo → stylized art transforms ("Remix").
* [ ] Automatic photo-to-video stories.
* [ ] Filters marketplace / community presets.

## P3.4 — Premium Power Options

* [ ] Pro camera upload (RAW+JPEG pairing).
* [ ] AI caption generation.
* [ ] Album timeline/notes (journaling).
* [ ] Batch metadata editing.
* [ ] Editing history + version control.

---

# 🟥 P0–P3 Consolidated Ranked Master Checklist (Everything)

Here is the full list, sorted top → bottom by priority and consumer sentiment weight:

1. **True Backup Mode (Archive Vault)**
2. **Sync Health Dashboard**
3. **Audit & Repair**
4. **Per-item Truth Panel**
5. **Deletion Contract UI**
6. **Explicit Delete Actions**
7. **Duplicate Prevention**
8. **Duplicate Detection + Merge**
9. **Export Originals + Metadata + Albums**
10. **Export Verification Report**
11. **Direct Import Connectors**
12. **Privacy Dial**
13. **E2EE Vault**
14. **Transparent AI data use**
15. **Moderation appeals / human review**
16. **Offline caching + local pinning**
17. **High-performance timeline scrolling**
18. **Dual Search Modes: Ask + Classic**
19. **Pro Filters Panel**
20. **Explain Results**
21. **Manual tagging / face editing**
22. **OCR search**
23. **Automatic smart albums**
24. **Hierarchical folders/albums**
25. **Robust web UI for huge libraries**
26. **Advanced EXIF editing**
27. **Explicit folder opt-in (no forced integration)**
28. **Sandboxed vendor integrations**
29. **Offline browsing**
30. **Basic editing tools**
31. **Advanced edits / AI edits**
32. **Collages / animations / auto movies**
33. **Shared albums & collaboration**
34. **Auto-updating shared albums**
35. **Family library with private zones**
36. **Permissioned sharing (password/expire)**
37. **Event QR upload links**
38. **Smart display integrations**
39. **Hybrid NAS/local modes**
40. **External drive mirror**
41. **Peer-to-peer sync fallback**
42. **Screenshot/blurry cleanup**
43. **Near-duplicate cleanup (best shot)**
44. **Generative fun tools (memes, art)**
45. **Photo-to-video stories**
46. **Plugin/preset marketplace**
47. **RAW+JPEG pairing**
48. **AI captions**
49. **Batch metadata editing**
50. **Editing version history**
