# Design Document: Client-Server Integration

## Overview

This design specifies the architecture for connecting the Cloud Gallery React Native client to the Express backend API. The integration transforms the app from a local-only photo manager into a cloud-synced, multi-device photo management system.

### Current State

**Backend (Server):**
- ✅ Express 5.0.1 server with PostgreSQL database
- ✅ Complete photo CRUD API at `/api/photos` (GET, POST, PUT, DELETE)
- ✅ JWT authentication middleware
- ✅ Database tables: `users`, `photos`, `albums`, `album_photos`
- ✅ Drizzle ORM with type-safe queries
- ✅ Zod validation schemas

**Frontend (Client):**
- ✅ React Native 0.81.5 with Expo 54
- ✅ React Query 5.90.7 installed but unused
- ✅ Photo screens using local AsyncStorage
- ✅ Album screens using local AsyncStorage
- ❌ No API integration
- ❌ No cloud sync
- ❌ No multi-device support

### Target State

After this integration:
- ✅ Client fetches photos from PostgreSQL via API
- ✅ Photos persist in cloud database
- ✅ Multi-device sync works automatically
- ✅ Optimistic updates for instant UI feedback
- ✅ React Query manages server state and caching
- ✅ AsyncStorage becomes cache layer (not primary storage)
- ✅ Album management fully integrated with server

### Key Design Decisions

1. **React Query for Server State**: Use TanStack Query for all server data fetching and mutations
2. **Optimistic Updates**: Apply UI changes immediately, rollback on error
3. **AsyncStorage as Cache**: Keep AsyncStorage for offline viewing, not as source of truth
4. **Sequential Uploads**: Upload photos one at a time to avoid overwhelming server
5. **JWT in Headers**: Use Authorization header (not cookies) for mobile compatibility
6. **Graceful Degradation**: Show cached data when offline, disable mutations



## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native Client                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PhotosScreen │  │ AlbumsScreen │  │ Other Screens│      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         └──────────────────┴──────────────────┘               │
│                            │                                  │
│                   ┌────────▼────────┐                        │
│                   │  React Query    │                        │
│                   │  (useQuery,     │                        │
│                   │   useMutation)  │                        │
│                   └────────┬────────┘                        │
│                            │                                  │
│                   ┌────────▼────────┐                        │
│                   │   API Client    │                        │
│                   │  (apiRequest)   │                        │
│                   └────────┬────────┘                        │
│                            │                                  │
│                   ┌────────▼────────┐                        │
│                   │  AsyncStorage   │                        │
│                   │  (JWT Token)    │                        │
│                   └─────────────────┘                        │
│                                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTPS
                            │ Authorization: Bearer {token}
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                      Express Server                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Routes  │  │ Photo Routes │  │ Album Routes │      │
│  │ /api/auth    │  │ /api/photos  │  │ /api/albums  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         └──────────────────┴──────────────────┘               │
│                            │                                  │
│                   ┌────────▼────────┐                        │
│                   │ Auth Middleware │                        │
│                   │ (JWT Verify)    │                        │
│                   └────────┬────────┘                        │
│                            │                                  │
│                   ┌────────▼────────┐                        │
│                   │  Drizzle ORM    │                        │
│                   └────────┬────────┘                        │
│                            │                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    PostgreSQL Database                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │
│  │  users  │  │ photos  │  │ albums  │  │ album_photos │  │
│  └─────────┘  └─────────┘  └─────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Photo Upload Flow:**
```
1. User selects photo → ImagePicker
2. PhotosScreen calls uploadMutation.mutate(photo)
3. React Query: onMutate → Optimistic update (add temp photo to UI)
4. API Client: POST /api/photos with JWT token
5. Server: Validate token → Insert to DB → Return photo with real ID
6. React Query: onSuccess → Replace temp photo with real photo
7. React Query: Invalidate 'photos' query → Refetch in background
```

**Photo Fetch Flow:**
```
1. PhotosScreen mounts → useQuery(['photos'])
2. React Query: Check cache → If stale, fetch from server
3. API Client: GET /api/photos with JWT token
4. Server: Validate token → Query DB → Return photos array
5. React Query: Update cache → Trigger re-render
6. PhotosScreen: Display photos in grid
```

**Multi-Device Sync Flow:**
```
Device A:
1. User uploads photo
2. Photo saved to server DB

Device B:
1. App returns to foreground
2. React Query: refetchOnWindowFocus triggers
3. Fetch latest photos from server
4. New photo appears in grid
```



## Components and Interfaces

### API Client Module (`client/lib/query-client.ts`)

**Purpose**: Centralized HTTP client for all server requests with authentication.

**Interface:**
```typescript
/**
 * Make authenticated API request
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param endpoint - API endpoint (e.g., '/api/photos')
 * @param body - Request body (optional)
 * @returns Promise<Response>
 * @throws Error if request fails or authentication required
 */
export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: any
): Promise<Response>

/**
 * Get authentication token from storage
 * @returns Promise<string | null>
 */
export async function getAuthToken(): Promise<string | null>

/**
 * Set authentication token in storage
 * @param token - JWT token from login
 */
export async function setAuthToken(token: string): Promise<void>

/**
 * Clear authentication token (logout)
 */
export async function clearAuthToken(): Promise<void>
```

**Implementation Details:**
- Base URL determined by environment: `http://localhost:5000` (dev) or production URL
- JWT token retrieved from AsyncStorage key `authToken`
- Authorization header format: `Bearer {token}`
- Automatic 401 handling: Clear token and throw authentication error
- Content-Type header: `application/json` for all requests
- Error responses parsed and thrown with descriptive messages

**Dependencies:**
- `@react-native-async-storage/async-storage` - Token storage
- Native `fetch` API - HTTP requests



### React Query Configuration

**Query Client Setup:**
```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes
      cacheTime: 30 * 60 * 1000,       // 30 minutes
      refetchOnWindowFocus: true,       // Sync on app foreground
      refetchOnReconnect: true,         // Sync on network restore
      retry: 3,                         // Retry failed requests 3 times
      retryDelay: (attemptIndex) =>    // Exponential backoff
        Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,                         // Retry mutations once
    },
  },
});
```

**Query Keys:**
- Photos list: `['photos']`
- Single photo: `['photos', photoId]`
- Albums list: `['albums']`
- Single album: `['albums', albumId]`
- Album photos: `['albums', albumId, 'photos']`

**Cache Invalidation Strategy:**
- After photo upload: Invalidate `['photos']`
- After photo update: Invalidate `['photos']` and `['photos', photoId]`
- After photo delete: Invalidate `['photos']` and all `['albums']` queries
- After album operation: Invalidate `['albums']` and `['photos']`



### PhotosScreen Integration

**Current Implementation:**
- Uses `useState` and `useCallback` for local state
- Calls `getPhotos()` and `addPhoto()` from storage.ts
- Manual loading state management

**New Implementation:**
```typescript
export default function PhotosScreen() {
  // Fetch photos using React Query
  const { 
    data: photos = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['photos'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/photos');
      const data = await res.json();
      return data.photos;
    },
  });

  // Upload mutation with optimistic update
  const uploadMutation = useMutation({
    mutationFn: async (photo: Omit<Photo, 'id' | 'createdAt' | 'modifiedAt'>) => {
      const res = await apiRequest('POST', '/api/photos', photo);
      return res.json();
    },
    onMutate: async (newPhoto) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['photos'] });
      
      // Snapshot previous value
      const previousPhotos = queryClient.getQueryData(['photos']);
      
      // Optimistically update
      queryClient.setQueryData(['photos'], (old: Photo[] = []) => [
        { ...newPhoto, id: 'temp-' + Date.now(), createdAt: Date.now(), modifiedAt: Date.now() },
        ...old,
      ]);
      
      return { previousPhotos };
    },
    onError: (err, newPhoto, context) => {
      // Rollback on error
      queryClient.setQueryData(['photos'], context?.previousPhotos);
    },
    onSettled: () => {
      // Refetch to get accurate data
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  const handleUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({...});
    if (!result.canceled) {
      for (const asset of result.assets) {
        uploadMutation.mutate({
          uri: asset.uri,
          width: asset.width || 0,
          height: asset.height || 0,
          filename: asset.fileName || `photo_${Date.now()}.jpg`,
          isFavorite: false,
        });
      }
    }
  };

  // Rest of component...
}
```

**Key Changes:**
1. Replace `useState` with `useQuery`
2. Replace `addPhoto` with `useMutation`
3. Remove manual `loadPhotos` callback
4. Add optimistic updates for instant feedback
5. Add error handling with rollback
6. Use React Query's loading states



### Album Routes (Server)

**New File:** `server/album-routes.ts`

**Endpoints:**

```typescript
// GET /api/albums - List all albums for user
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user?.id;
  const albums = await db
    .select()
    .from(albums)
    .where(eq(albums.userId, userId))
    .orderBy(desc(albums.createdAt));
  res.json({ albums });
});

// POST /api/albums - Create album
router.post('/', authenticateToken, async (req, res) => {
  const { title, description } = req.body;
  const [album] = await db
    .insert(albums)
    .values({ userId: req.user?.id, title, description })
    .returning();
  res.status(201).json({ album });
});

// GET /api/albums/:id - Get album with photos
router.get('/:id', authenticateToken, async (req, res) => {
  const album = await db
    .select()
    .from(albums)
    .where(and(eq(albums.id, req.params.id), eq(albums.userId, req.user?.id)));
  
  const albumPhotosList = await db
    .select()
    .from(albumPhotos)
    .where(eq(albumPhotos.albumId, req.params.id))
    .orderBy(albumPhotos.position);
  
  res.json({ album: album[0], photoIds: albumPhotosList.map(ap => ap.photoId) });
});

// POST /api/albums/:id/photos - Add photo to album
router.post('/:id/photos', authenticateToken, async (req, res) => {
  const { photoId } = req.body;
  await db.insert(albumPhotos).values({
    albumId: req.params.id,
    photoId,
  });
  res.json({ message: 'Photo added to album' });
});

// DELETE /api/albums/:id/photos/:photoId - Remove photo from album
router.delete('/:id/photos/:photoId', authenticateToken, async (req, res) => {
  await db
    .delete(albumPhotos)
    .where(and(
      eq(albumPhotos.albumId, req.params.id),
      eq(albumPhotos.photoId, req.params.photoId)
    ));
  res.json({ message: 'Photo removed from album' });
});

// DELETE /api/albums/:id - Delete album
router.delete('/:id', authenticateToken, async (req, res) => {
  await db
    .delete(albums)
    .where(and(eq(albums.id, req.params.id), eq(albums.userId, req.user?.id)));
  res.json({ message: 'Album deleted' });
});
```

**Registration in `server/routes.ts`:**
```typescript
import albumRoutes from './album-routes';
app.use('/api/albums', albumRoutes);
```



## Data Models

### Client-Side Types

**Photo Interface** (from `client/types/index.ts`):
```typescript
interface Photo {
  id: string;              // UUID from server
  uri: string;             // Image URL/path
  width: number;           // Image dimensions
  height: number;
  createdAt: number;       // Unix timestamp (milliseconds)
  modifiedAt: number;
  filename: string;
  isFavorite: boolean;
  albumIds: string[];      // Array of album IDs (client-side only)
  location?: {             // Optional GPS data
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    country?: string;
  };
  camera?: {               // Optional camera metadata
    make: string;
    model: string;
    iso?: number;
    aperture?: string;
    shutter?: string;
    focalLength?: number;
  };
  exif?: Record<string, unknown>;
  tags?: string[];
  notes?: string;
  isPrivate?: boolean;
}
```

**Album Interface**:
```typescript
interface Album {
  id: string;
  title: string;
  description?: string;
  coverPhotoUri: string | null;
  photoIds: string[];      // Array of photo IDs (client-side only)
  createdAt: number;
  modifiedAt: number;
}
```

### Server-Side Schema

**Photos Table** (from `shared/schema.ts`):
```typescript
export const photos = pgTable('photos', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  uri: text('uri').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  filename: text('filename').notNull(),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  modifiedAt: timestamp('modified_at').defaultNow().notNull(),
  location: jsonb('location'),
  camera: jsonb('camera'),
  exif: jsonb('exif'),
  tags: text('tags').array(),
  notes: text('notes'),
  isPrivate: boolean('is_private').default(false).notNull(),
});
```

**Albums Table**:
```typescript
export const albums = pgTable('albums', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  coverPhotoUri: text('cover_photo_uri'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  modifiedAt: timestamp('modified_at').defaultNow().notNull(),
});
```

**Album-Photos Junction Table**:
```typescript
export const albumPhotos = pgTable('album_photos', {
  albumId: varchar('album_id').notNull().references(() => albums.id, { onDelete: 'cascade' }),
  photoId: varchar('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at').defaultNow().notNull(),
  position: integer('position').default(0).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.albumId, table.photoId] }),
}));
```

### Data Transformation

**Server to Client:**
- Timestamps: Convert PostgreSQL `timestamp` to Unix milliseconds
- Album relationships: Fetch `albumPhotos` junction table and build `photoIds` array
- Photo relationships: Query `albumPhotos` to build `albumIds` array

**Client to Server:**
- Timestamps: Convert Unix milliseconds to ISO string or Date object
- Album relationships: Send individual API calls to add/remove photos from albums
- Omit client-only fields: `albumIds` and `photoIds` not sent to server



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Authorization Header Inclusion

*For any* API request made by the API_Client, the request SHALL include an Authorization header with the format "Bearer {token}" where token is retrieved from AsyncStorage.

**Validates: Requirements 1.2, 8.1, 8.6**

**Rationale**: Authentication is critical for security. Every request must prove the user's identity. This property ensures no request bypasses authentication.

**Test Strategy**: Generate random API requests (different methods, endpoints, bodies) and verify each includes the Authorization header with correct format.

### Property 2: Photo Sorting Consistency

*For any* set of photos returned from the server, when displayed in the PhotosScreen grid, they SHALL be sorted by createdAt timestamp in descending order (newest first).

**Validates: Requirements 2.3**

**Rationale**: Users expect to see their most recent photos first. This property ensures consistent ordering regardless of server response order.

**Test Strategy**: Generate random photo sets with various timestamps and verify sorting is always newest-first.

### Property 3: Upload Request Completeness

*For any* photo upload, the POST request to /api/photos SHALL include all required fields: uri, width, height, filename, and isFavorite.

**Validates: Requirements 3.1, 3.2**

**Rationale**: Server validation requires these fields. Missing fields cause 400 errors. This property ensures uploads never fail due to incomplete data.

**Test Strategy**: Generate random photo objects and verify upload requests always include all required fields.



### Property 4: Optimistic Update Replacement

*For any* successful photo upload, the temporary photo with ID prefix "temp-" SHALL be replaced with the server-returned photo containing a real UUID.

**Validates: Requirements 3.4**

**Rationale**: Optimistic updates use temporary IDs for instant feedback. After server confirmation, real IDs must replace temps to maintain data integrity.

**Test Strategy**: Upload photos and verify temporary IDs are replaced with UUIDs matching server response.

### Property 5: Sequential Upload Ordering

*For any* batch of multiple selected photos, uploads SHALL be initiated sequentially (one completes before next starts), not concurrently.

**Validates: Requirements 3.6**

**Rationale**: Concurrent uploads can overwhelm server and mobile network. Sequential uploads ensure reliable completion and easier error handling.

**Test Strategy**: Upload multiple photos and verify only one upload request is in-flight at any time.

### Property 6: Cache Invalidation After Upload

*For any* completed photo upload (success or failure), the React Query cache for key ['photos'] SHALL be invalidated to trigger a refetch.

**Validates: Requirements 3.7**

**Rationale**: After upload, the server may have modified data (timestamps, IDs). Invalidation ensures UI shows accurate server state.

**Test Strategy**: Monitor cache invalidation calls after uploads and verify ['photos'] is always invalidated.

### Property 7: Metadata Update Propagation

*For any* photo metadata update (favorite, tags, notes), a PUT request to /api/photos/:id SHALL be sent with the updated fields.

**Validates: Requirements 4.1, 4.2, 4.3**

**Rationale**: Metadata changes must persist to server for multi-device sync. This property ensures all metadata updates reach the database.

**Test Strategy**: Generate random metadata changes and verify PUT requests are sent with correct data.

### Property 8: Optimistic Metadata Updates

*For any* metadata mutation, the UI SHALL reflect the change immediately before the server responds.

**Validates: Requirements 4.4**

**Rationale**: Optimistic updates make the app feel instant. Users shouldn't wait for network round-trips for simple changes.

**Test Strategy**: Trigger metadata changes and verify UI updates synchronously (within 50ms) before async server response.

### Property 9: Cache Update After Metadata Success

*For any* successful metadata update, the React Query cache SHALL be updated with the new metadata values.

**Validates: Requirements 4.6**

**Rationale**: Cache must stay in sync with server. After successful updates, cache should reflect new values without full refetch.

**Test Strategy**: Update metadata and verify cache contains new values after mutation succeeds.

### Property 10: Deletion Request Propagation

*For any* confirmed photo deletion, a DELETE request to /api/photos/:id SHALL be sent to the server.

**Validates: Requirements 5.1**

**Rationale**: Deletions must propagate to server for multi-device sync. This property ensures deletions aren't just local.

**Test Strategy**: Delete photos and verify DELETE requests are sent with correct photo IDs.

### Property 11: Optimistic Deletion

*For any* photo deletion, the photo SHALL be removed from the UI immediately when deletion is initiated.

**Validates: Requirements 5.2**

**Rationale**: Users expect instant feedback. Optimistic deletion makes the app feel responsive.

**Test Strategy**: Initiate deletion and verify photo disappears from UI synchronously before server response.

### Property 12: Cache Cleanup After Deletion

*For any* successful photo deletion, the photo SHALL be removed from the React Query cache.

**Validates: Requirements 5.3**

**Rationale**: Deleted photos shouldn't reappear from cache. Cache cleanup ensures consistency.

**Test Strategy**: Delete photos and verify they're removed from cache after successful deletion.

### Property 13: Album Cache Invalidation After Photo Deletion

*For any* photo deletion, all album-related React Query caches SHALL be invalidated.

**Validates: Requirements 5.6**

**Rationale**: Deleting a photo affects albums containing it. Album caches must refetch to show updated photo counts and covers.

**Test Strategy**: Delete photos that are in albums and verify album caches are invalidated.



### Property 14: Album Operation Requests

*For any* album operation (create, add photo, remove photo, delete), the appropriate HTTP request SHALL be sent to the corresponding /api/albums endpoint.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

**Rationale**: All album operations must persist to server. This property ensures no album changes are lost.

**Test Strategy**: Perform various album operations and verify correct API requests are sent.

### Property 15: Dual Cache Invalidation for Albums

*For any* album operation completion, both ['albums'] and ['photos'] query caches SHALL be invalidated.

**Validates: Requirements 6.6**

**Rationale**: Album operations affect both albums and photos (e.g., adding photo to album changes photo's albumIds). Both caches must refetch.

**Test Strategy**: Perform album operations and verify both cache keys are invalidated.

### Property 16: Album Cover Photo Selection

*For any* album with at least one photo, the coverPhotoUri SHALL be the URI of the first photo in the photoIds array.

**Validates: Requirements 6.7**

**Rationale**: Albums need visual representation. First photo is a simple, consistent choice for cover.

**Test Strategy**: Create albums with photos and verify cover is always the first photo's URI.

### Property 17: Error Message Display

*For any* failed network request, the Client SHALL display a user-friendly error message to the user.

**Validates: Requirements 9.1**

**Rationale**: Users need feedback when operations fail. Generic error messages prevent confusion.

**Test Strategy**: Simulate various network failures and verify error messages are displayed.

### Property 18: Validation Error Detail Extraction

*For any* 400 Bad Request response containing validation error details, those details SHALL be extracted and displayed to the user.

**Validates: Requirements 9.4**

**Rationale**: Validation errors need specific feedback (e.g., "filename is required"). Generic messages don't help users fix issues.

**Test Strategy**: Send invalid data and verify validation error details are shown.

### Property 19: Retry Button Presence

*For any* error state, the UI SHALL provide a "Retry" button or mechanism to reattempt the failed operation.

**Validates: Requirements 9.5**

**Rationale**: Transient failures (network issues) should be retryable without restarting the app.

**Test Strategy**: Trigger errors and verify retry buttons are present and functional.

### Property 20: API Error Logging

*For any* API error (4xx, 5xx, network failure), the error SHALL be logged to the console with request details.

**Validates: Requirements 9.7**

**Rationale**: Debugging requires visibility into failures. Console logs help developers diagnose issues.

**Test Strategy**: Trigger various errors and verify console logs contain error details.

### Property 21: Upload Progress Indication

*For any* photo upload in progress, a progress indicator SHALL be displayed on the photo thumbnail.

**Validates: Requirements 10.3**

**Rationale**: Users need feedback during uploads. Progress indicators show the app is working.

**Test Strategy**: Initiate uploads and verify progress indicators appear on thumbnails.

### Property 22: Mutation Failure Toast

*For any* failed mutation (upload, update, delete), an error toast notification SHALL be displayed.

**Validates: Requirements 10.5**

**Rationale**: Mutation failures need prominent feedback. Toasts are non-blocking but visible.

**Test Strategy**: Trigger mutation failures and verify error toasts appear.

### Property 23: Concurrent Upload Limit

*For any* batch upload, a maximum of 3 photos SHALL be uploading concurrently at any time.

**Validates: Requirements 12.3**

**Rationale**: Too many concurrent uploads overwhelm server and mobile network. Limiting concurrency ensures reliability.

**Test Strategy**: Upload large batches and verify no more than 3 uploads are in-flight simultaneously.



## Error Handling

### Authentication Errors (401 Unauthorized)

**Scenario**: JWT token expired or invalid

**Handling**:
1. API Client detects 401 response
2. Clear JWT token from AsyncStorage
3. Clear all React Query caches
4. Redirect user to login screen
5. Show message: "Session expired. Please log in again."

**Code**:
```typescript
if (response.status === 401) {
  await clearAuthToken();
  queryClient.clear();
  navigation.navigate('Login');
  throw new Error('Authentication required. Please log in again.');
}
```

### Network Errors

**Scenario**: No internet connection, request timeout, DNS failure

**Handling**:
1. React Query automatic retry (3 attempts with exponential backoff)
2. If all retries fail, show error message
3. Display cached data if available
4. Show "Retry" button
5. Automatically refetch when network restored (refetchOnReconnect)

**Error Messages**:
- Network timeout: "Request timed out. Please check your connection and try again."
- No connection: "No internet connection. Showing cached data."
- DNS failure: "Cannot reach server. Please try again later."

### Server Errors (500, 502, 503)

**Scenario**: Server crash, database error, deployment in progress

**Handling**:
1. Show generic error message: "Server error. Please try again later."
2. Log error details to console for debugging
3. Provide "Retry" button
4. React Query automatic retry (1 attempt for mutations)

**Code**:
```typescript
if (response.status >= 500) {
  console.error('Server error:', response.status, await response.text());
  throw new Error('Server error. Please try again later.');
}
```

### Validation Errors (400 Bad Request)

**Scenario**: Invalid data sent to server (missing required fields, wrong types)

**Handling**:
1. Parse validation error details from response
2. Show specific error messages for each field
3. Highlight invalid fields in UI
4. No automatic retry (user must fix data)

**Example Response**:
```json
{
  "error": "Validation error",
  "details": [
    { "path": ["filename"], "message": "Filename is required" },
    { "path": ["width"], "message": "Width must be a positive integer" }
  ]
}
```

**UI Display**:
```
❌ Upload failed:
• Filename is required
• Width must be a positive integer
```

### Optimistic Update Rollback

**Scenario**: Mutation fails after optimistic UI update

**Handling**:
1. React Query onError callback triggered
2. Restore previous data from context
3. Show error message
4. Provide "Retry" button

**Code**:
```typescript
onError: (err, newPhoto, context) => {
  // Rollback optimistic update
  queryClient.setQueryData(['photos'], context?.previousPhotos);
  
  // Show error
  showErrorToast('Upload failed. Please try again.');
}
```

### Conflict Errors (409 Conflict)

**Scenario**: Concurrent modification (e.g., photo deleted on another device)

**Handling**:
1. Show message: "This item was modified on another device."
2. Invalidate cache to fetch latest data
3. Ask user to retry operation

### Rate Limiting (429 Too Many Requests)

**Scenario**: Too many requests in short time

**Handling**:
1. Parse Retry-After header from response
2. Show message: "Too many requests. Please wait {seconds} seconds."
3. Disable actions temporarily
4. Automatically retry after delay



## Testing Strategy

### Dual Testing Approach

This integration requires both **unit tests** and **property-based tests** for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs
- Both are complementary and necessary for complete validation

### Unit Testing

**Focus Areas**:
- Specific API request examples (GET /api/photos with auth token)
- Error handling scenarios (401, 500, network timeout)
- Edge cases (empty photo list, missing token, invalid data)
- Integration points (React Query + API Client)
- UI state transitions (loading → success → error)

**Example Unit Tests**:

```typescript
describe('API Client', () => {
  it('should include Authorization header in requests', async () => {
    await setAuthToken('test-token-123');
    const response = await apiRequest('GET', '/api/photos');
    expect(response.request.headers.Authorization).toBe('Bearer test-token-123');
  });

  it('should throw error when token is missing', async () => {
    await clearAuthToken();
    await expect(apiRequest('GET', '/api/photos')).rejects.toThrow('Authentication required');
  });

  it('should clear token on 401 response', async () => {
    mockFetch.mockResolvedValueOnce({ status: 401, ok: false });
    await expect(apiRequest('GET', '/api/photos')).rejects.toThrow();
    expect(await getAuthToken()).toBeNull();
  });
});

describe('PhotosScreen', () => {
  it('should display skeleton loader while loading', () => {
    const { getByTestId } = render(<PhotosScreen />);
    expect(getByTestId('skeleton-loader')).toBeVisible();
  });

  it('should display error message on fetch failure', async () => {
    mockUseQuery.mockReturnValue({ error: new Error('Network error'), isLoading: false });
    const { getByText } = render(<PhotosScreen />);
    expect(getByText(/network error/i)).toBeVisible();
  });
});
```

**Test Coverage Goals**:
- API Client: 95%+ (critical security component)
- React Query hooks: 90%+
- Screen components: 85%+
- Error handling: 100% (all error paths tested)



### Property-Based Testing

**Focus Areas**:
- Universal properties that hold for all inputs
- Authorization header inclusion for any request
- Photo sorting for any photo set
- Optimistic updates for any mutation
- Cache invalidation for any operation

**Property Test Configuration**:
- Minimum 100 iterations per test (due to randomization)
- Use `fast-check` library for JavaScript/TypeScript
- Tag each test with design property reference

**Example Property Tests**:

```typescript
import fc from 'fast-check';

describe('Property: Authorization Header Inclusion', () => {
  /**
   * Feature: client-server-integration
   * Property 1: For any API request, Authorization header SHALL be included
   */
  it('should include Authorization header for any request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),  // Random method
        fc.webUrl(),                                       // Random endpoint
        fc.option(fc.object()),                           // Random body
        async (method, endpoint, body) => {
          await setAuthToken('test-token');
          const response = await apiRequest(method, endpoint, body);
          expect(response.request.headers.Authorization).toBe('Bearer test-token');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property: Photo Sorting Consistency', () => {
  /**
   * Feature: client-server-integration
   * Property 2: For any photo set, display SHALL be sorted by createdAt descending
   */
  it('should sort photos newest-first for any photo set', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.uuid(),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string(),
          isFavorite: fc.boolean(),
        })),
        (photos) => {
          const sorted = sortPhotosByDate(photos);
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].createdAt).toBeGreaterThanOrEqual(sorted[i + 1].createdAt);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property: Upload Request Completeness', () => {
  /**
   * Feature: client-server-integration
   * Property 3: For any photo upload, request SHALL include all required fields
   */
  it('should include all required fields for any photo', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 4000 }),
          height: fc.integer({ min: 1, max: 4000 }),
          filename: fc.string({ minLength: 1 }),
          isFavorite: fc.boolean(),
        }),
        async (photo) => {
          const requestBody = buildUploadRequest(photo);
          expect(requestBody).toHaveProperty('uri');
          expect(requestBody).toHaveProperty('width');
          expect(requestBody).toHaveProperty('height');
          expect(requestBody).toHaveProperty('filename');
          expect(requestBody).toHaveProperty('isFavorite');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Property Test Library**:
- Use `fast-check` for TypeScript/JavaScript property-based testing
- Install: `npm install --save-dev fast-check`
- Documentation: https://fast-check.dev/

**Test Execution**:
```bash
# Run all tests
npm test

# Run only property tests
npm test -- --grep "Property:"

# Run with coverage
npm test -- --coverage
```



### Integration Testing

**Multi-Device Sync Tests**:
```typescript
describe('Multi-Device Sync', () => {
  it('should sync photo upload across devices', async () => {
    // Device A: Upload photo
    const deviceA = createTestClient('user-1');
    await deviceA.uploadPhoto(testPhoto);
    
    // Device B: Refetch photos
    const deviceB = createTestClient('user-1');
    await deviceB.refetchPhotos();
    
    // Verify photo appears on Device B
    expect(deviceB.photos).toContainEqual(expect.objectContaining({
      uri: testPhoto.uri,
      filename: testPhoto.filename,
    }));
  });

  it('should sync photo deletion across devices', async () => {
    // Setup: Photo exists on both devices
    const deviceA = createTestClient('user-1');
    const deviceB = createTestClient('user-1');
    const photo = await deviceA.uploadPhoto(testPhoto);
    await deviceB.refetchPhotos();
    
    // Device A: Delete photo
    await deviceA.deletePhoto(photo.id);
    
    // Device B: Refetch
    await deviceB.refetchPhotos();
    
    // Verify photo removed from Device B
    expect(deviceB.photos).not.toContainEqual(expect.objectContaining({ id: photo.id }));
  });
});
```

**End-to-End Flow Tests**:
```typescript
describe('Complete Photo Lifecycle', () => {
  it('should handle upload → view → edit → delete flow', async () => {
    // Upload
    const uploadResult = await uploadPhoto(testPhoto);
    expect(uploadResult.id).toBeTruthy();
    
    // View
    const photos = await fetchPhotos();
    expect(photos).toContainEqual(expect.objectContaining({ id: uploadResult.id }));
    
    // Edit (favorite)
    await toggleFavorite(uploadResult.id);
    const updatedPhoto = await fetchPhoto(uploadResult.id);
    expect(updatedPhoto.isFavorite).toBe(true);
    
    // Delete
    await deletePhoto(uploadResult.id);
    const photosAfterDelete = await fetchPhotos();
    expect(photosAfterDelete).not.toContainEqual(expect.objectContaining({ id: uploadResult.id }));
  });
});
```

### Performance Testing

**Metrics to Measure**:
- Initial photo load time: < 2 seconds
- Cached photo display: < 100ms
- Optimistic update response: < 50ms
- Background refetch time: < 1 second

**Performance Test Example**:
```typescript
describe('Performance', () => {
  it('should display cached photos within 100ms', async () => {
    // Pre-populate cache
    await fetchPhotos();
    
    // Measure cached display time
    const startTime = performance.now();
    const { getByTestId } = render(<PhotosScreen />);
    const photoGrid = await waitFor(() => getByTestId('photo-grid'));
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100);
  });

  it('should apply optimistic updates within 50ms', async () => {
    const { getByTestId } = render(<PhotosScreen />);
    
    const startTime = performance.now();
    fireEvent.press(getByTestId('favorite-button'));
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(50);
    expect(getByTestId('favorite-icon')).toBeVisible();
  });
});
```

### Test Data Factories

**Photo Factory**:
```typescript
export function createTestPhoto(overrides?: Partial<Photo>): Photo {
  return {
    id: faker.string.uuid(),
    uri: faker.image.url(),
    width: faker.number.int({ min: 100, max: 4000 }),
    height: faker.number.int({ min: 100, max: 4000 }),
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    filename: faker.system.fileName(),
    isFavorite: false,
    albumIds: [],
    ...overrides,
  };
}
```

**Album Factory**:
```typescript
export function createTestAlbum(overrides?: Partial<Album>): Album {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.words(3),
    coverPhotoUri: null,
    photoIds: [],
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    ...overrides,
  };
}
```

### Mocking Strategy

**Mock API Responses**:
```typescript
// Mock successful photo fetch
mockFetch.mockResolvedValueOnce({
  ok: true,
  status: 200,
  json: async () => ({ photos: [testPhoto1, testPhoto2] }),
});

// Mock 401 error
mockFetch.mockResolvedValueOnce({
  ok: false,
  status: 401,
  statusText: 'Unauthorized',
});

// Mock network error
mockFetch.mockRejectedValueOnce(new Error('Network request failed'));
```

**Mock React Query**:
```typescript
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  })),
}));
```

