# Key User Flows

[← Back to Index](./00_INDEX.md) | [← Previous: Modules](./30_MODULES_AND_DEPENDENCIES.md) | [Next: Glossary →](./90_GLOSSARY.md)

This document describes the critical user journeys through Cloud Gallery, including what triggers them, the steps involved, modules touched, potential failure modes, and validation tips.

---

## 1. App Launch & First Use

### Trigger
User opens app for the first time (fresh install) or subsequent launch.

### Steps

1. **App Registration** (`client/index.js`)
   - Expo loads and registers App component
   - Native bridge initializes

2. **Provider Setup** (`client/App.tsx`)
   - ErrorBoundary catches any initialization errors
   - QueryClientProvider initializes React Query cache
   - SafeAreaProvider calculates device safe areas
   - GestureHandlerRootView enables gestures
   - KeyboardProvider manages keyboard
   - NavigationContainer initializes routing

3. **Navigation Bootstrap** (`client/navigation/RootStackNavigator.tsx`)
   - RootStackNavigator mounts
   - MainTabNavigator loads with 4 tabs

4. **Default Screen Load** (`client/screens/PhotosScreen.tsx`)
   - PhotosScreen (Photos tab) is default active tab
   - React Query attempts to load photos from AsyncStorage
   - If empty, shows empty state with illustration

5. **Data Hydration** (`client/lib/storage.ts`)
   - `getPhotos()` reads from `@photo_vault_photos` key
   - `getAlbums()` reads from `@photo_vault_albums` key
   - `getUserProfile()` reads from `@photo_vault_user` key
   - Returns empty arrays/default profile if not found

### Modules Touched
- `client/index.js` - Entry point
- `client/App.tsx` - Provider setup
- `client/navigation/RootStackNavigator.tsx` - Root navigation
- `client/navigation/MainTabNavigator.tsx` - Tab bar
- `client/screens/PhotosScreen.tsx` - Default screen
- `client/lib/storage.ts` - Data loading

### Failure Modes
1. **AsyncStorage read failure**: Falls back to empty arrays
2. **Provider initialization error**: Caught by ErrorBoundary
3. **Navigation error**: Shows error screen with retry option

### Validation Tips
```bash
# Test fresh install
# 1. Delete app from device
# 2. Reinstall and launch
# 3. Should show empty Photos screen with illustration

# Check AsyncStorage keys
# Add logging to storage.ts getPhotos() to verify empty state
```

**Evidence**: 
- `client/index.js` line 1-14
- `client/App.tsx` line 1-49
- `client/screens/PhotosScreen.tsx`
- `client/lib/storage.ts` line 25-31

---

## 2. Primary User Journey: Browse Photos

### Trigger
User navigates to Photos tab (default) or taps Photos tab.

### Steps

1. **Screen Load** (`client/screens/PhotosScreen.tsx`)
   - React Query hook fetches photos via `getPhotos()`
   - Photos grouped by date using `groupPhotosByDate()`
   - Loading skeleton shown while fetching

2. **Date Grouping** (`client/lib/storage.ts`)
   - Groups photos into: Today, Yesterday, Last 7 Days, Last Month, or by Month/Year
   - Sorts groups chronologically (recent first)

3. **Grid Rendering** (`client/components/PhotoGrid.tsx`)
   - FlashList renders photos in 3-column grid
   - Each photo: square aspect ratio, 2px spacing
   - Section headers show date labels
   - Optimized for performance (virtualized list)

4. **Photo Selection** (user taps photo)
   - Navigation pushes PhotoDetailScreen as modal
   - Full-screen photo view with zoom capability
   - Bottom toolbar: share, favorite, delete actions

### Modules Touched
- `client/screens/PhotosScreen.tsx` - Main screen
- `client/lib/storage.ts` - Data fetching and grouping
- `client/components/PhotoGrid.tsx` - Grid rendering
- `client/components/EmptyState.tsx` - Empty state (if no photos)
- `client/components/SkeletonLoader.tsx` - Loading state
- `client/screens/PhotoDetailScreen.tsx` - Photo detail modal

### Failure Modes
1. **No photos**: Shows empty state with "No photos yet" message
2. **AsyncStorage error**: Falls back to empty array
3. **FlashList rendering error**: Caught by ErrorBoundary
4. **Image load failure**: Shows placeholder or error state

### Validation Tips
```bash
# Test with sample photos
# 1. Add photos via upload flow
# 2. Verify date grouping is correct
# 3. Check grid layout (3 columns, even spacing)
# 4. Test photo tap → detail screen
# 5. Verify smooth scrolling (no jank)

# Performance check
# 1. Add 100+ photos
# 2. Scroll rapidly - should stay smooth
# 3. Check FlashList estimatedItemSize matches actual
```

**Evidence**:
- `client/screens/PhotosScreen.tsx` - Main implementation
- `client/lib/storage.ts` line 218-278 - Date grouping algorithm
- `client/components/PhotoGrid.tsx` - Grid component

---

## 3. Data Write Path: Photo Upload

### Trigger
User taps FloatingActionButton (+) on Photos or Albums screen.

### Steps

1. **Upload Trigger** (`client/screens/PhotosScreen.tsx`)
   - FloatingActionButton pressed
   - Haptic feedback triggered

2. **Permission Check** (`expo-image-picker`)
   - Request media library permission
   - If denied, show permission prompt
   - If granted, proceed

3. **Photo Selection** (`expo-image-picker`)
   - Open device photo picker
   - User selects one or more photos
   - Picker returns photo URIs and metadata

4. **Photo Processing** (screen component)
   - Extract: uri, width, height, filename
   - Generate unique ID: `Date.now().toString()`
   - Create Photo object with metadata

5. **Data Write** (`client/lib/storage.ts` - `addPhoto()`)
   - Load existing photos array
   - Prepend new photo (most recent first)
   - Write to AsyncStorage key `@photo_vault_photos`

6. **React Query Update**
   - Invalidate photos query
   - Triggers re-fetch
   - UI updates automatically

7. **UI Update**
   - New photo appears at top of grid
   - Grid re-renders with new item
   - Haptic feedback on success

### Modules Touched
- `client/components/FloatingActionButton.tsx` - Upload trigger
- `expo-image-picker` - Photo selection
- `client/screens/PhotosScreen.tsx` - Upload orchestration
- `client/lib/storage.ts` - `addPhoto()`, `savePhotos()`
- `@react-native-async-storage/async-storage` - Persistence
- React Query - Cache invalidation

### Failure Modes
1. **Permission denied**: Show alert explaining need for permission
2. **Picker cancelled**: No action, user returns to screen
3. **AsyncStorage write failure**: Show error toast
4. **Invalid photo data**: Skip photo, log error
5. **Storage quota exceeded**: Show storage full warning

### Validation Tips
```bash
# Test upload flow
# 1. Tap FAB
# 2. Select 1 photo - verify appears at top
# 3. Select multiple photos - verify all added
# 4. Check AsyncStorage has correct data structure

# Test error cases
# 1. Deny permission - verify prompt shown
# 2. Fill storage - verify graceful handling
# 3. Select corrupt image - verify skipped safely
```

**Evidence**:
- `client/lib/storage.ts` line 38-42 - `addPhoto()` implementation
- Photo selection in screens (search for `expo-image-picker`)
- `client/components/FloatingActionButton.tsx`

---

## 4. Authentication & Authorization

### Current State: NOT IMPLEMENTED IN MVP

**Future Flow** (when backend is connected):

1. User launches app
2. Check for stored auth token
3. If no token → show login/signup screen
4. User enters username/password
5. POST to `/api/auth/login`
6. Server validates against `users` table (PostgreSQL)
7. Server returns JWT token
8. Client stores token in AsyncStorage
9. All API requests include token in Authorization header
10. Token validated on server for protected routes

### Modules Prepared
- `shared/schema.ts` - User schema with username/password fields
- Database configured but not connected

### Failure Modes (Future)
1. **Invalid credentials**: Show error message
2. **Network timeout**: Retry with exponential backoff
3. **Token expired**: Refresh token or redirect to login
4. **Server unavailable**: Offline mode (local data only)

### Validation Tips (Future)
```bash
# Test auth flow
# 1. Register new user
# 2. Log out and log in
# 3. Test invalid password
# 4. Test network offline
# 5. Test token expiry
```

**Evidence**:
- `shared/schema.ts` line 17-23 - User schema
- Auth not yet implemented in client or server

---

## 5. Album Management Flow

### Trigger
User navigates to Albums tab or taps "New Album" button.

### Steps

1. **Album Creation**
   - User taps "+ New Album" in header
   - Modal prompts for album title
   - User enters title and confirms
   - `createAlbum(title)` called

2. **Data Write** (`client/lib/storage.ts`)
   - Generate album ID: `Date.now().toString()`
   - Create Album object: empty photoIds array, null coverPhotoUri
   - Prepend to albums array
   - Write to AsyncStorage key `@photo_vault_albums`

3. **UI Update**
   - New album card appears at top
   - Shows placeholder cover (no photos yet)
   - React Query invalidates and re-fetches

4. **Add Photos to Album**
   - User taps album card → AlbumDetailScreen
   - User taps "Add Photos" button
   - Photo picker shows all photos
   - User selects photos to add
   - `addPhotosToAlbum(albumId, photoIds)` called

5. **Bidirectional Relationship** (`client/lib/storage.ts` line 106-142)
   - Update album: add photoIds to album.photoIds array
   - Update photos: add albumId to each photo.albumIds array
   - Set album cover to first photo if not set
   - Write both albums and photos to AsyncStorage

6. **Album Display**
   - Album card shows cover photo
   - Photo count badge displays number of photos
   - Tapping album → AlbumDetailScreen with filtered photos

### Modules Touched
- `client/screens/AlbumsScreen.tsx` - Album list
- `client/screens/AlbumDetailScreen.tsx` - Album contents
- `client/components/AlbumCard.tsx` - Album display
- `client/lib/storage.ts` - Album CRUD operations

### Failure Modes
1. **Empty title**: Validate before creating
2. **Duplicate album names**: Allowed (no unique constraint)
3. **AsyncStorage write failure**: Show error, rollback
4. **Photo-album relationship desync**: Use bidirectional updates

### Validation Tips
```bash
# Test album flow
# 1. Create album with title "Vacation"
# 2. Add 5 photos to album
# 3. Verify photo.albumIds includes album ID
# 4. Verify album.photoIds includes photo IDs
# 5. Delete album - verify photos updated

# Test edge cases
# 1. Create album with empty title (should prevent)
# 2. Add same photo twice (should deduplicate)
# 3. Remove photo from album (should update both)
# 4. Delete photo - should remove from all albums
```

**Evidence**:
- `client/lib/storage.ts` line 85-104 - Album creation
- `client/lib/storage.ts` line 106-142 - Add photos to album
- `client/types/index.ts` line 11-32 - Bidirectional relationship

---

## 6. Search Flow

### Trigger
User navigates to Search tab.

### Steps

1. **Search Screen Load** (`client/screens/SearchScreen.tsx`)
   - Shows search bar at top
   - Displays recent searches (if any)
   - Shows filter options: All Photos, Favorites

2. **Favorite Filter** (current implementation)
   - User taps "Favorites" filter
   - Filters photos where `photo.isFavorite === true`
   - Displays filtered photos in grid

3. **Text Search** (future feature)
   - User types in search bar
   - Filters photos by filename (case-insensitive)
   - Shows results in real-time

### Modules Touched
- `client/screens/SearchScreen.tsx` - Search UI
- `client/lib/storage.ts` - Photo filtering
- `client/components/PhotoGrid.tsx` - Results display

### Failure Modes
1. **No results**: Show empty state "No favorites yet"
2. **Search query empty**: Show all photos or recent searches
3. **AsyncStorage read error**: Fall back to empty results

### Validation Tips
```bash
# Test search
# 1. Mark 3 photos as favorites
# 2. Go to Search tab
# 3. Tap Favorites filter
# 4. Verify only favorited photos shown
# 5. Clear filter - verify all photos shown
```

**Evidence**:
- `client/screens/SearchScreen.tsx` - Search implementation
- `client/lib/storage.ts` line 62-70 - Toggle favorite function

---

## 7. Data Deletion Flow

### Trigger
User deletes a photo from PhotoDetailScreen or ProfileScreen.

### Steps

1. **Delete Trigger**
   - User taps delete button (trash icon)
   - Confirmation alert shows: "Delete photo?"
   - User confirms

2. **Cascading Delete** (`client/lib/storage.ts` line 44-60)
   - Remove photo from photos array
   - For each album containing the photo:
     - Remove photoId from album.photoIds
     - If photo was cover, set new cover to next photo
     - If album is now empty, set coverPhotoUri to null
   - Write both photos and albums to AsyncStorage

3. **React Query Update**
   - Invalidate photos query
   - Invalidate albums query
   - UI re-renders without deleted photo

4. **Navigation**
   - If in PhotoDetailScreen, navigate back to previous screen
   - Photo disappears from grid

### Modules Touched
- `client/screens/PhotoDetailScreen.tsx` - Delete trigger
- `client/lib/storage.ts` - `deletePhoto()` with cascade
- React Query - Cache invalidation

### Failure Modes
1. **AsyncStorage write failure**: Show error, don't navigate back
2. **Relationship desync**: Cascading delete ensures consistency
3. **Undo not available**: Warn user before deletion

### Validation Tips
```bash
# Test deletion
# 1. Create album with 3 photos
# 2. Delete middle photo
# 3. Verify album now has 2 photos
# 4. Delete cover photo
# 5. Verify new cover photo is set
# 6. Delete last photo
# 7. Verify album cover is null

# Test cascade
# 1. Add photo to 3 different albums
# 2. Delete photo
# 3. Verify removed from all 3 albums
```

**Evidence**:
- `client/lib/storage.ts` line 44-60 - Cascading delete implementation
- Bidirectional relationship ensures consistency

---

## Cross-Flow Validation

### Data Consistency Checks
```bash
# After any operation, verify:
# 1. All photo.albumIds reference existing albums
# 2. All album.photoIds reference existing photos
# 3. Album covers reference valid photo URIs
# 4. No orphaned records

# Run this pseudo-check:
photos = await getPhotos()
albums = await getAlbums()

# Check photo → album links
photos.forEach(photo => {
  photo.albumIds.forEach(albumId => {
    assert(albums.find(a => a.id === albumId))
  })
})

# Check album → photo links
albums.forEach(album => {
  album.photoIds.forEach(photoId => {
    assert(photos.find(p => p.id === photoId))
  })
})
```

### Performance Testing
```bash
# Test with large datasets
# 1. Add 500 photos
# 2. Create 50 albums
# 3. Add 100 photos to 1 album
# 4. Verify all operations remain responsive
# 5. Check AsyncStorage size limits
```

---

## Evidence Summary

**Key Files for Flows**:
- `/client/lib/storage.ts` - All data operations (279 lines)
- `/client/screens/*.tsx` - 6 screen components with user interactions
- `/client/components/PhotoGrid.tsx` - Main display component
- `/client/navigation/*.tsx` - Navigation configuration

**Test Commands**:
```bash
# Type checking
npm run check:types

# Run app
npm run expo:dev
npm run server:dev

# Linting
npm run lint
```

---

[← Back to Index](./00_INDEX.md) | [← Previous: Modules](./30_MODULES_AND_DEPENDENCIES.md) | [Next: Glossary →](./90_GLOSSARY.md)
