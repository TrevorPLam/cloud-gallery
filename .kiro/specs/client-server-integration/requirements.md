# Requirements Document: Client-Server Integration

## Introduction

This specification defines the requirements for connecting the Cloud Gallery React Native client application to the Express backend API. Currently, the client operates in isolation using local AsyncStorage, while a fully functional REST API exists on the server. This integration will enable cloud sync, multi-device access, and persistent photo storage in PostgreSQL.

The integration addresses a critical architectural gap: photos currently exist only on individual devices with no backup, sync, or multi-device access capabilities. By connecting to the server API, users will gain cloud backup, cross-device synchronization, and the foundation for future collaborative features.

## Glossary

- **Client**: The React Native mobile application running on user devices (iOS, Android, or web)
- **Server**: The Express.js backend API running on Node.js with PostgreSQL database
- **API_Client**: The HTTP client module responsible for making authenticated requests to the Server
- **React_Query**: TanStack Query library managing server state, caching, and synchronization
- **Photo_Store**: PostgreSQL database table storing photo metadata and references
- **Album_Store**: PostgreSQL database table storing album metadata
- **AsyncStorage**: React Native's local key-value storage (currently used, will become cache layer)
- **JWT_Token**: JSON Web Token used for authenticating API requests
- **Optimistic_Update**: UI update applied immediately before server confirmation
- **Cache_Invalidation**: Process of marking cached data as stale to trigger refetch
- **Mutation**: React Query operation that modifies server data (POST, PUT, DELETE)
- **Query**: React Query operation that fetches server data (GET)
- **Sync**: Process of ensuring client and server data are consistent
- **CRUD**: Create, Read, Update, Delete operations

## Requirements

### Requirement 1: API Client Configuration

**User Story:** As a developer, I want a centralized API client, so that all server requests are authenticated and consistently configured.

#### Acceptance Criteria

1. THE API_Client SHALL provide a function for making authenticated HTTP requests to the Server
2. WHEN making a request, THE API_Client SHALL include the JWT_Token from AsyncStorage in the Authorization header
3. WHEN the JWT_Token is missing, THE API_Client SHALL throw an authentication error
4. WHEN the Server returns 401 Unauthorized, THE API_Client SHALL clear the stored JWT_Token
5. THE API_Client SHALL use the correct base URL based on environment (localhost in development, production URL in production)
6. WHEN a request fails with network error, THE API_Client SHALL throw a descriptive error message
7. THE API_Client SHALL set Content-Type header to application/json for all requests

### Requirement 2: Photo Retrieval

**User Story:** As a user, I want to see all my photos when I open the app, so that I can browse my photo library.

#### Acceptance Criteria

1. WHEN the Photos screen loads, THE Client SHALL fetch photos from the Server using GET /api/photos
2. WHEN photos are loading, THE Client SHALL display a skeleton loader
3. WHEN photos load successfully, THE Client SHALL display them in a grid sorted by creation date (newest first)
4. WHEN the photo fetch fails, THE Client SHALL display an error message with retry option
5. WHEN the user pulls to refresh, THE Client SHALL refetch photos from the Server
6. THE Client SHALL cache fetched photos using React_Query for 5 minutes
7. WHEN returning to the Photos screen, THE Client SHALL show cached photos immediately while refetching in background

### Requirement 3: Photo Upload

**User Story:** As a user, I want to upload photos to the cloud, so that they are backed up and accessible from other devices.

#### Acceptance Criteria

1. WHEN a user selects photos from their device, THE Client SHALL send each photo to the Server using POST /api/photos
2. WHEN uploading a photo, THE Client SHALL include uri, width, height, filename, and isFavorite fields
3. WHEN a photo upload starts, THE Client SHALL show the photo immediately in the grid with a loading indicator (Optimistic_Update)
4. WHEN a photo upload succeeds, THE Client SHALL replace the temporary photo with the Server response containing the real ID
5. WHEN a photo upload fails, THE Client SHALL remove the optimistic photo and display an error message
6. WHEN multiple photos are selected, THE Client SHALL upload them sequentially
7. WHEN an upload completes, THE Client SHALL trigger Cache_Invalidation for the photos Query

### Requirement 4: Photo Metadata Updates

**User Story:** As a user, I want to edit photo details like favorites and tags, so that I can organize my library.

#### Acceptance Criteria

1. WHEN a user toggles favorite status, THE Client SHALL send the update to the Server using PUT /api/photos/:id
2. WHEN a user adds tags to a photo, THE Client SHALL send the updated tags array to the Server
3. WHEN a user adds notes to a photo, THE Client SHALL send the updated notes to the Server
4. WHEN updating photo metadata, THE Client SHALL apply the change immediately in the UI (Optimistic_Update)
5. WHEN a metadata update fails, THE Client SHALL revert the UI to the previous state and show an error
6. WHEN a metadata update succeeds, THE Client SHALL update the cached photo data
7. THE Client SHALL debounce text input updates by 500ms before sending to Server

### Requirement 5: Photo Deletion

**User Story:** As a user, I want to delete photos from the cloud, so that I can remove unwanted images.

#### Acceptance Criteria

1. WHEN a user confirms photo deletion, THE Client SHALL send DELETE /api/photos/:id to the Server
2. WHEN deletion starts, THE Client SHALL remove the photo from the UI immediately (Optimistic_Update)
3. WHEN deletion succeeds, THE Client SHALL remove the photo from React_Query cache
4. WHEN deletion fails, THE Client SHALL restore the photo in the UI and display an error message
5. WHEN deleting a photo, THE Client SHALL show a confirmation dialog before proceeding
6. WHEN a photo is deleted, THE Client SHALL trigger Cache_Invalidation for affected albums

### Requirement 6: Album Management

**User Story:** As a user, I want to organize photos into albums, so that I can group related images together.

#### Acceptance Criteria

1. WHEN the Albums screen loads, THE Client SHALL fetch albums from the Server using GET /api/albums
2. WHEN a user creates an album, THE Client SHALL send POST /api/albums with title and description
3. WHEN a user adds a photo to an album, THE Client SHALL send POST /api/albums/:id/photos with the photoId
4. WHEN a user removes a photo from an album, THE Client SHALL send DELETE /api/albums/:id/photos/:photoId
5. WHEN a user deletes an album, THE Client SHALL send DELETE /api/albums/:id
6. WHEN album operations complete, THE Client SHALL invalidate both albums and photos Query caches
7. THE Client SHALL display album cover photos using the first photo in the album

### Requirement 7: Multi-Device Synchronization

**User Story:** As a user, I want my photos to sync across all my devices, so that I can access them anywhere.

#### Acceptance Criteria

1. WHEN a photo is uploaded on device A, THE photo SHALL appear on device B after device B refetches
2. WHEN a photo is deleted on device A, THE photo SHALL disappear from device B after device B refetches
3. WHEN a photo is favorited on device A, THE favorite status SHALL sync to device B
4. WHEN the app returns to foreground, THE Client SHALL refetch photos to sync latest changes
5. WHEN network connectivity is restored, THE Client SHALL automatically refetch photos
6. THE Client SHALL use React_Query's refetchOnWindowFocus feature for automatic sync
7. THE Client SHALL use React_Query's refetchOnReconnect feature for network recovery

### Requirement 8: Authentication Integration

**User Story:** As a user, I want my API requests to be authenticated, so that only I can access my photos.

#### Acceptance Criteria

1. WHEN making any API request, THE API_Client SHALL include the JWT_Token in the Authorization header
2. WHEN the JWT_Token is expired, THE Server SHALL return 401 Unauthorized
3. WHEN receiving 401 Unauthorized, THE Client SHALL clear the JWT_Token and redirect to login
4. WHEN a user logs out, THE Client SHALL clear the JWT_Token and all React_Query caches
5. WHEN a user logs in, THE Client SHALL store the JWT_Token in AsyncStorage
6. THE API_Client SHALL format the Authorization header as "Bearer {token}"
7. WHEN the JWT_Token is missing, THE Client SHALL redirect to login before making API requests

### Requirement 9: Error Handling and Recovery

**User Story:** As a user, I want clear error messages and recovery options, so that I understand what went wrong and can fix it.

#### Acceptance Criteria

1. WHEN a network request fails, THE Client SHALL display a user-friendly error message
2. WHEN a request times out, THE Client SHALL display "Request timed out. Please try again."
3. WHEN the Server returns 500 error, THE Client SHALL display "Server error. Please try again later."
4. WHEN the Server returns 400 error, THE Client SHALL display the validation error details
5. WHEN an error occurs, THE Client SHALL provide a "Retry" button
6. WHEN the retry button is pressed, THE Client SHALL reattempt the failed operation
7. THE Client SHALL log all API errors to the console for debugging

### Requirement 10: Loading States and User Feedback

**User Story:** As a user, I want to see loading indicators and feedback, so that I know the app is working.

#### Acceptance Criteria

1. WHEN photos are loading for the first time, THE Client SHALL display a skeleton loader
2. WHEN photos are refetching in background, THE Client SHALL show a subtle loading indicator
3. WHEN uploading a photo, THE Client SHALL show a progress indicator on the photo thumbnail
4. WHEN a mutation succeeds, THE Client SHALL show a success message (optional, can be silent)
5. WHEN a mutation fails, THE Client SHALL show an error toast notification
6. THE Client SHALL use React_Query's isLoading state for initial loads
7. THE Client SHALL use React_Query's isFetching state for background refetches

### Requirement 11: Offline Behavior

**User Story:** As a user, I want the app to work with cached data when offline, so that I can still browse my photos without internet.

#### Acceptance Criteria

1. WHEN the device is offline, THE Client SHALL display cached photos from React_Query
2. WHEN the device is offline, THE Client SHALL disable upload and delete operations
3. WHEN the device is offline, THE Client SHALL show an "Offline" indicator in the UI
4. WHEN attempting to upload while offline, THE Client SHALL display "Cannot upload while offline"
5. WHEN network is restored, THE Client SHALL automatically refetch photos
6. THE Client SHALL use React_Query's staleTime of 5 minutes for cache freshness
7. THE Client SHALL use React_Query's cacheTime of 30 minutes for cache retention

### Requirement 12: Performance and Optimization

**User Story:** As a user, I want the app to be fast and responsive, so that I have a smooth experience.

#### Acceptance Criteria

1. WHEN photos are cached, THE Client SHALL display them within 100ms
2. WHEN applying optimistic updates, THE Client SHALL update the UI within 50ms
3. WHEN uploading photos, THE Client SHALL upload a maximum of 3 photos concurrently
4. THE Client SHALL use React_Query's automatic request deduplication
5. THE Client SHALL use React_Query's automatic retry with exponential backoff (3 attempts)
6. WHEN scrolling the photo grid, THE Client SHALL use FlashList for virtualization
7. THE Client SHALL prefetch photo details when hovering over thumbnails (web only)

## Technical Requirements

### API Endpoint Specifications

**Base URL:**
- Development: `http://localhost:5000`
- Production: `https://api.cloudgallery.app` (example)

**Authentication:**
- All endpoints require `Authorization: Bearer {jwt_token}` header
- Tokens stored in AsyncStorage under key `authToken`

**Photo Endpoints:**
- `GET /api/photos` - List all photos for authenticated user
  - Query params: `limit` (default 100), `offset` (default 0)
  - Response: `{ photos: Photo[], pagination: { limit, offset, total } }`
  
- `GET /api/photos/:id` - Get single photo
  - Response: `{ photo: Photo }`
  
- `POST /api/photos` - Create photo
  - Body: `{ uri, width, height, filename, isFavorite, tags?, notes? }`
  - Response: `{ photo: Photo }`
  
- `PUT /api/photos/:id` - Update photo
  - Body: Partial photo fields
  - Response: `{ photo: Photo }`
  
- `DELETE /api/photos/:id` - Delete photo
  - Response: `{ message: "Photo deleted successfully" }`

**Album Endpoints:**
- `GET /api/albums` - List all albums
- `POST /api/albums` - Create album
- `GET /api/albums/:id` - Get album with photos
- `PUT /api/albums/:id` - Update album
- `DELETE /api/albums/:id` - Delete album
- `POST /api/albums/:id/photos` - Add photo to album
- `DELETE /api/albums/:id/photos/:photoId` - Remove photo from album

### React Query Configuration

**Query Keys:**
- Photos: `['photos']`
- Single Photo: `['photos', photoId]`
- Albums: `['albums']`
- Single Album: `['albums', albumId]`

**Cache Configuration:**
- `staleTime`: 5 minutes (300000ms)
- `cacheTime`: 30 minutes (1800000ms)
- `refetchOnWindowFocus`: true
- `refetchOnReconnect`: true
- `retry`: 3 attempts with exponential backoff

### Data Models

**Photo Type:**
```typescript
interface Photo {
  id: string;           // UUID from server
  userId: string;       // Owner's user ID
  uri: string;          // Image URL/path
  width: number;        // Image width in pixels
  height: number;       // Image height in pixels
  filename: string;     // Display filename
  isFavorite: boolean;  // Favorite flag
  createdAt: number;    // Unix timestamp
  modifiedAt: number;   // Unix timestamp
  albumIds: string[];   // Array of album IDs
  location?: {          // Optional GPS data
    latitude: number;
    longitude: number;
    address?: string;
  };
  camera?: {            // Optional camera metadata
    make: string;
    model: string;
    iso?: number;
  };
  tags?: string[];      // User-added tags
  notes?: string;       // User notes
}
```

**Album Type:**
```typescript
interface Album {
  id: string;
  userId: string;
  title: string;
  description?: string;
  coverPhotoUri: string | null;
  photoIds: string[];
  createdAt: number;
  modifiedAt: number;
}
```

### Migration Strategy

**Phase 1: Add API Client (Non-Breaking)**
- Create `client/lib/query-client.ts` with `apiRequest` helper
- Add React Query configuration
- No changes to existing screens yet

**Phase 2: Migrate PhotosScreen**
- Replace AsyncStorage calls with `useQuery` and `useMutation`
- Keep AsyncStorage as fallback cache initially
- Test thoroughly before proceeding

**Phase 3: Migrate AlbumsScreen**
- Same pattern as PhotosScreen
- Ensure album-photo relationships work correctly

**Phase 4: Create Album API Routes**
- Implement `server/album-routes.ts`
- Register routes in `server/routes.ts`
- Test all album operations

**Phase 5: End-to-End Testing**
- Test complete flows on multiple devices
- Verify sync works correctly
- Test error scenarios and recovery

**Phase 6: Remove AsyncStorage Primary Storage**
- Convert AsyncStorage to cache-only layer
- Remove redundant storage code
- Update documentation

### Security Considerations

1. **Token Storage**: JWT tokens stored in AsyncStorage (secure on mobile)
2. **Token Expiry**: Handle 401 responses by clearing token and redirecting to login
3. **HTTPS**: All production API calls must use HTTPS
4. **Input Validation**: Server validates all inputs (client validation is UX only)
5. **Authorization**: Server verifies user owns resources before operations

### Performance Targets

- Initial photo load: < 2 seconds
- Cached photo display: < 100ms
- Optimistic update response: < 50ms
- Photo upload: < 5 seconds per photo (depends on network)
- Background refetch: < 1 second

### Browser/Platform Support

- iOS 13+
- Android 8+
- Modern web browsers (Chrome, Safari, Firefox, Edge)
- React Native 0.78+
- Expo SDK 54+

## Acceptance Testing Scenarios

### Scenario 1: First-Time User Flow
1. User logs in successfully
2. User sees empty state (no photos)
3. User uploads first photo
4. Photo appears immediately with loading indicator
5. Photo upload completes, loading indicator disappears
6. User refreshes, photo still appears

### Scenario 2: Multi-Device Sync
1. User uploads photo on Device A
2. User opens app on Device B
3. Photo appears on Device B after refresh
4. User favorites photo on Device B
5. User returns to Device A
6. Favorite status synced to Device A

### Scenario 3: Offline Behavior
1. User views photos while online
2. User goes offline (airplane mode)
3. Photos still visible from cache
4. User attempts to upload photo
5. Error message: "Cannot upload while offline"
6. User goes back online
7. Upload button works again

### Scenario 4: Error Recovery
1. User attempts to delete photo
2. Server returns 500 error
3. Photo reappears in UI
4. Error message displayed with retry button
5. User clicks retry
6. Deletion succeeds

### Scenario 5: Album Management
1. User creates new album "Vacation 2024"
2. Album appears in list immediately
3. User adds 3 photos to album
4. Photos appear in album view
5. User removes 1 photo from album
6. Photo removed from album but still in main library
7. User deletes album
8. Album removed, photos remain in library

## Dependencies

**External Libraries:**
- `@tanstack/react-query` ^5.90.7 (already installed)
- `@react-native-async-storage/async-storage` (already installed)
- `expo-image-picker` (already installed)

**Backend APIs:**
- Express server running on port 5000 (development)
- PostgreSQL database with photos, albums, album_photos tables
- JWT authentication middleware

**Environment Variables:**
- `API_BASE_URL` - Server base URL (development vs production)

## Success Metrics

1. **Functionality**: All 12 requirements pass acceptance criteria
2. **Performance**: 95% of operations complete within target times
3. **Reliability**: < 1% error rate on API calls (excluding network failures)
4. **User Experience**: Optimistic updates work for 100% of mutations
5. **Sync**: Multi-device sync works within 5 seconds of refetch
6. **Test Coverage**: 90%+ code coverage for API client and React Query hooks

## Future Enhancements (Out of Scope)

- Offline queue for mutations (upload/delete while offline)
- Presigned URLs for direct-to-storage uploads
- Real-time sync using WebSockets
- Conflict resolution for concurrent edits
- Advanced caching strategies (infinite scroll, prefetching)
- Image optimization and thumbnail generation
- Batch operations (delete multiple photos)
