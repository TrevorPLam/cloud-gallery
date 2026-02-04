# Data Layer Documentation

[← Back to Architecture Index](../architecture/00_INDEX.md)

## Overview

Cloud Gallery's data layer in MVP is **local-first**, using React Native's AsyncStorage for all persistence. No cloud backend or database is connected yet, though PostgreSQL schema is prepared for future migration.

## Data Storage

### Current Implementation: AsyncStorage

**Technology**: `@react-native-async-storage/async-storage`  
**Type**: Key-value store (strings only)  
**Location**: Device local storage  
**Capacity**: Platform-dependent (typically ~6MB on iOS, ~10MB on Android)

### Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `@photo_vault_photos` | `Photo[]` | All user photos with metadata |
| `@photo_vault_albums` | `Album[]` | All user-created albums |
| `@photo_vault_user` | `UserProfile` | User profile (name, email, avatar) |

**Evidence**: `/client/lib/storage.ts` line 15-17

### Data Access Layer

**Module**: `/client/lib/storage.ts`  
**Lines**: 279 total  
**Exports**: 15 functions for CRUD operations

**Functions**:
- `getPhotos()` / `savePhotos(photos)` / `addPhoto(photo)` / `deletePhoto(photoId)`
- `getAlbums()` / `saveAlbums(albums)` / `createAlbum(title)` / `deleteAlbum(albumId)`
- `addPhotosToAlbum(albumId, photoIds)` / `removePhotoFromAlbum(albumId, photoId)`
- `toggleFavorite(photoId)`
- `getStorageInfo()`
- `getUserProfile()` / `saveUserProfile(profile)`
- `clearAllData()`
- `groupPhotosByDate(photos)` (utility)

## Schema Definitions

### Photo Schema

```typescript
interface Photo {
  id: string;                // Unique ID (timestamp-based)
  uri: string;               // File path (file:///)
  width: number;             // Pixel width
  height: number;            // Pixel height
  createdAt: number;         // Unix timestamp (ms)
  modifiedAt: number;        // Unix timestamp (ms)
  filename: string;          // Original filename
  isFavorite: boolean;       // Favorite flag
  albumIds: string[];        // Albums containing this photo
}
```

**Evidence**: `/client/types/index.ts` line 11-22

**Constraints**:
- `id` must be unique (generated via `Date.now().toString()`)
- `uri` must be valid file path
- `albumIds` must reference existing album IDs (enforced in app logic)

### Album Schema

```typescript
interface Album {
  id: string;                // Unique ID (timestamp-based)
  title: string;             // User-provided name
  coverPhotoUri: string | null; // URI of cover photo
  photoIds: string[];        // Photos in this album
  createdAt: number;         // Unix timestamp (ms)
  modifiedAt: number;        // Unix timestamp (ms)
}
```

**Evidence**: `/client/types/index.ts` line 24-32

**Constraints**:
- `id` must be unique
- `title` can be empty (validation needed)
- `photoIds` must reference existing photo IDs (enforced in app logic)
- `coverPhotoUri` automatically set to first photo

### User Profile Schema

```typescript
interface UserProfile {
  name: string;              // Display name
  email: string;             // Email address
  avatarUri: string | null;  // Avatar image URI
}
```

**Evidence**: `/client/lib/storage.ts` line 19-23

**Default Values**:
- name: "Guest User"
- email: "guest@example.com"
- avatarUri: null

## Data Relationships

### Bidirectional Photo ↔ Album Relationship

**Pattern**: Both entities reference each other for efficient queries

```
Photo {
  albumIds: ['album1', 'album2']  // Photo knows its albums
}

Album {
  photoIds: ['photo1', 'photo2']  // Album knows its photos
}
```

**Maintenance**:
- When adding photo to album: Update BOTH photo.albumIds AND album.photoIds
- When removing photo: Update BOTH sides + cascade to cover photo
- When deleting photo: Remove from all albums + update covers

**Evidence**: `/client/lib/storage.ts` line 106-180

### Data Integrity Rules

1. **No orphaned references**: All photoIds must reference existing photos
2. **No orphaned albums**: Empty albums are allowed (valid state)
3. **Cover photo validity**: Album cover must reference a photo in that album
4. **Deduplication**: Same photo cannot be added to album twice

**Enforcement**: Application logic (no database constraints)

## Migrations

### Current State: No Migration System

**Why**: AsyncStorage is schemaless JSON storage. Changes are applied at runtime through code.

**Version Handling**: Not implemented. If schema changes:
1. Update TypeScript types
2. Update storage functions to handle old/new formats
3. Consider one-time migration function on app update

**Example Future Migration**:
```typescript
// If adding new field to Photo:
async function migratePhotosV1toV2() {
  const photos = await getPhotos();
  const migrated = photos.map(photo => ({
    ...photo,
    tags: photo.tags || [], // Add new field with default
  }));
  await savePhotos(migrated);
}
```

## Data Invariants

### Critical Invariants (Must Always Be True)

1. **Unique IDs**: No two photos or albums share the same ID
2. **Valid Timestamps**: All timestamps are positive numbers
3. **Valid URIs**: All photo URIs point to accessible files
4. **Referential Integrity**: 
   - Every photo.albumIds[i] references an existing album
   - Every album.photoIds[i] references an existing photo
5. **Cover Photo Validity**: 
   - If album.coverPhotoUri is not null, it must match one of the photos in album.photoIds

### Performance Invariants

1. **Array Size**: Photos/albums arrays should stay under 10,000 items
2. **String Size**: Individual photo URIs under 2KB
3. **Total Storage**: Keep under 5MB to stay within AsyncStorage limits

## Future: PostgreSQL Schema

**Prepared Schema**: `/shared/schema.ts`

```typescript
const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
```

**Evidence**: `/shared/schema.ts` line 17-23

**Not Yet Implemented**:
- Photo table
- Album table
- Photo-Album junction table
- Database migrations via Drizzle Kit

**Migration Path** (future):
1. Create photos, albums, photo_albums tables
2. Migrate AsyncStorage data to PostgreSQL
3. Update storage.ts to use Drizzle queries
4. Add user authentication

**Configuration**: `/drizzle.config.ts` (PostgreSQL connection ready)

## Testing Data Layer

### Manual Testing

```bash
# Test photo operations
1. Add photo → verify appears in getPhotos()
2. Delete photo → verify removed + albums updated
3. Toggle favorite → verify flag updates

# Test album operations
1. Create album → verify in getAlbums()
2. Add photo to album → verify bidirectional link
3. Delete album → verify photos updated

# Test data integrity
1. Check no orphaned references after deletions
2. Verify cover photos always valid
3. Check deduplication works
```

### Automated Testing (Not Yet Implemented)

```typescript
// Future test example
describe('storage', () => {
  it('maintains bidirectional relationship', async () => {
    const photo = { id: '1', albumIds: [] };
    const album = { id: 'a1', photoIds: [] };
    
    await addPhotosToAlbum('a1', ['1']);
    
    const updatedPhoto = await getPhotos().find(p => p.id === '1');
    const updatedAlbum = await getAlbums().find(a => a.id === 'a1');
    
    expect(updatedPhoto.albumIds).toContain('a1');
    expect(updatedAlbum.photoIds).toContain('1');
  });
});
```

## Performance Considerations

### AsyncStorage Performance

**Read Performance**: 
- Single key read: ~5-10ms
- Multiple key reads: Use `AsyncStorage.multiGet()` (not implemented)

**Write Performance**:
- Single key write: ~10-20ms
- Large arrays (1000+ items): 50-100ms
- Batch writes: Use `AsyncStorage.multiSet()` (not implemented)

### Optimization Opportunities

1. **Pagination**: Load photos in chunks (not implemented)
2. **Indexing**: Create separate indices for favorites, recent photos
3. **Compression**: Compress large JSON before storing
4. **Caching**: React Query handles caching (implemented)

### Current Bottlenecks

1. **Full Array Loads**: Every operation loads entire photos/albums arrays
2. **No Transactions**: Multiple writes can leave inconsistent state on crash
3. **No Backup**: User data not backed up (local-only)

## Troubleshooting

### "Photos not persisting"
```bash
# Check AsyncStorage
# Add logging to storage.ts getPhotos() and savePhotos()
console.log('Loaded photos:', photos.length);

# Verify key is correct
const keys = await AsyncStorage.getAllKeys();
console.log('Storage keys:', keys);
```

### "Album-photo relationship broken"
```bash
# Run integrity check
const photos = await getPhotos();
const albums = await getAlbums();

albums.forEach(album => {
  album.photoIds.forEach(photoId => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) {
      console.error(`Orphaned photo ${photoId} in album ${album.id}`);
    }
  });
});
```

### "Storage quota exceeded"
```bash
# Check current usage
const info = await getStorageInfo();
console.log('Used:', info.usedBytes / 1024 / 1024, 'MB');

# Clear if needed
await clearAllData(); // WARNING: Deletes everything
```

## Evidence Files

**Data Layer Implementation**:
- `/client/lib/storage.ts` - All CRUD operations (279 lines)
- `/client/types/index.ts` - Schema definitions (45 lines)
- `/shared/schema.ts` - Future PostgreSQL schema (32 lines)

**Configuration**:
- `/drizzle.config.ts` - Database ORM config (future use)

**Package Dependencies**:
- `@react-native-async-storage/async-storage@2.2.0`
- `drizzle-orm@0.39.3` (not yet used)
- `pg@8.16.3` (not yet used)

---

[← Back to Architecture Index](../architecture/00_INDEX.md)
