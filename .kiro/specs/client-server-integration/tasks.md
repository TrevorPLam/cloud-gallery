# Implementation Plan: Client-Server Integration

## Overview

This plan breaks down the client-server integration into discrete, testable tasks. Each task builds on previous work and includes specific requirements references. The implementation follows a phased approach: API client setup → photo integration → album integration → testing.

## Tasks

- [x] 1. Set up API client infrastructure
  - Create centralized API request module with authentication
  - Configure React Query client with caching strategy
  - Add JWT token management utilities
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 8.1, 8.5, 8.6_

- [x] 1.1 Write unit tests for API client
  - Test Authorization header inclusion
  - Test 401 handling and token clearing
  - Test error message formatting
  - Test base URL selection by environment
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 1.2 Write property test for authorization header
  - **Property 1: Authorization Header Inclusion**
  - **Validates: Requirements 1.2, 8.1, 8.6**

- [-] 2. Integrate PhotosScreen with server API
  - [x] 2.1 Replace AsyncStorage with useQuery for photo fetching
    - Remove useState and manual loading state
    - Add useQuery hook with ['photos'] key
    - Implement loading skeleton display
    - Add error handling with retry option
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [x] 2.2 Write property test for photo sorting
    - **Property 2: Photo Sorting Consistency**
    - **Validates: Requirements 2.3**
  
  - [x] 2.3 Implement photo upload with useMutation
    - Replace addPhoto() with useMutation
    - Add optimistic update logic (onMutate)
    - Add error rollback (onError)
    - Add cache invalidation (onSettled)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 2.4 Write property tests for upload
    - **Property 3: Upload Request Completeness**
    - **Property 4: Optimistic Update Replacement**
    - **Property 5: Sequential Upload Ordering**
    - **Property 6: Cache Invalidation After Upload**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.6, 3.7**
  
  - [x] 2.5 Implement photo metadata updates
    - Add mutation for favorite toggle
    - Add mutation for tags update
    - Add mutation for notes update
    - Implement optimistic updates for all metadata
    - Add error rollback and cache updates
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [x] 2.6 Write property tests for metadata updates
    - **Property 7: Metadata Update Propagation**
    - **Property 8: Optimistic Metadata Updates**
    - **Property 9: Cache Update After Metadata Success**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6**
  
  - [x] 2.7 Implement photo deletion
    - Add delete mutation with confirmation dialog
    - Implement optimistic deletion
    - Add error rollback
    - Invalidate photo and album caches
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 2.8 Write property tests for deletion
    - **Property 10: Deletion Request Propagation**
    - **Property 11: Optimistic Deletion**
    - **Property 12: Cache Cleanup After Deletion**
    - **Property 13: Album Cache Invalidation After Photo Deletion**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.6**

- [-] 3. Checkpoint - Verify PhotosScreen integration
  - Ensure all tests pass
  - Test upload → view → edit → delete flow manually
  - Verify optimistic updates work correctly
  - Check error handling and retry mechanisms
  - Ask user if questions arise



- [ ] 4. Create album API routes on server
  - [ ] 4.1 Create server/album-routes.ts file
    - Implement GET /api/albums (list all albums)
    - Implement POST /api/albums (create album)
    - Implement GET /api/albums/:id (get album with photos)
    - Implement PUT /api/albums/:id (update album)
    - Implement DELETE /api/albums/:id (delete album)
    - Implement POST /api/albums/:id/photos (add photo to album)
    - Implement DELETE /api/albums/:id/photos/:photoId (remove photo)
    - Add authentication middleware to all routes
    - Add user ownership validation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ] 4.2 Register album routes in server/routes.ts
    - Import album-routes module
    - Mount at /api/albums
    - _Requirements: 6.1_
  
  - [ ]* 4.3 Write unit tests for album routes
    - Test album creation
    - Test photo addition/removal
    - Test album deletion
    - Test authorization checks
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ] 5. Integrate AlbumsScreen with server API
  - [ ] 5.1 Replace AsyncStorage with useQuery for album fetching
    - Remove useState and manual loading
    - Add useQuery hook with ['albums'] key
    - Implement loading skeleton
    - Add error handling
    - _Requirements: 6.1_
  
  - [ ] 5.2 Implement album creation mutation
    - Add useMutation for POST /api/albums
    - Implement optimistic update
    - Add error rollback
    - Invalidate albums cache
    - _Requirements: 6.2_
  
  - [ ] 5.3 Implement add/remove photo from album
    - Add mutation for POST /api/albums/:id/photos
    - Add mutation for DELETE /api/albums/:id/photos/:photoId
    - Implement optimistic updates
    - Invalidate both albums and photos caches
    - _Requirements: 6.3, 6.4, 6.6_
  
  - [ ] 5.4 Implement album deletion
    - Add delete mutation with confirmation
    - Implement optimistic deletion
    - Invalidate caches
    - _Requirements: 6.5, 6.6_
  
  - [ ] 5.5 Implement album cover photo logic
    - Display first photo as cover
    - Update cover when photos added/removed
    - _Requirements: 6.7_
  
  - [ ]* 5.6 Write property tests for album operations
    - **Property 14: Album Operation Requests**
    - **Property 15: Dual Cache Invalidation for Albums**
    - **Property 16: Album Cover Photo Selection**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

- [ ] 6. Checkpoint - Verify album integration
  - Ensure all tests pass
  - Test album creation and photo management
  - Verify cache invalidation works correctly
  - Check multi-device sync for albums
  - Ask user if questions arise

- [ ] 7. Implement comprehensive error handling
  - [ ] 7.1 Add authentication error handling
    - Detect 401 responses
    - Clear token and caches
    - Redirect to login
    - Show appropriate message
    - _Requirements: 8.2, 8.3, 8.4_
  
  - [ ] 7.2 Add network error handling
    - Implement retry logic with exponential backoff
    - Show cached data when offline
    - Display network error messages
    - Add retry buttons
    - _Requirements: 9.1, 9.2, 9.5, 9.6, 11.1, 11.2, 11.3, 11.4_
  
  - [ ] 7.3 Add server error handling
    - Handle 500+ errors with generic message
    - Log errors to console
    - Provide retry option
    - _Requirements: 9.1, 9.3, 9.5, 9.6_
  
  - [ ] 7.4 Add validation error handling
    - Parse 400 error details
    - Display specific field errors
    - Highlight invalid fields in UI
    - _Requirements: 9.4_
  
  - [ ]* 7.5 Write property tests for error handling
    - **Property 17: Error Message Display**
    - **Property 18: Validation Error Detail Extraction**
    - **Property 19: Retry Button Presence**
    - **Property 20: API Error Logging**
    - **Validates: Requirements 9.1, 9.4, 9.5, 9.7**

- [ ] 8. Implement loading states and user feedback
  - [ ] 8.1 Add loading indicators
    - Skeleton loader for initial loads
    - Subtle indicator for background refetches
    - Progress indicators for uploads
    - _Requirements: 10.1, 10.2, 10.3, 10.6, 10.7_
  
  - [ ] 8.2 Add success and error notifications
    - Success toasts for mutations (optional)
    - Error toasts for failures
    - _Requirements: 10.4, 10.5_
  
  - [ ]* 8.3 Write property tests for UI feedback
    - **Property 21: Upload Progress Indication**
    - **Property 22: Mutation Failure Toast**
    - **Validates: Requirements 10.3, 10.5**

- [ ] 9. Implement multi-device sync features
  - [ ] 9.1 Configure React Query for automatic sync
    - Set refetchOnWindowFocus: true
    - Set refetchOnReconnect: true
    - Configure staleTime and cacheTime
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 11.5, 11.6, 11.7_
  
  - [ ] 9.2 Add offline mode handling
    - Detect offline state
    - Show offline indicator
    - Disable mutations when offline
    - Display cached data
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ]* 9.3 Write integration tests for multi-device sync
    - Test photo upload sync across devices
    - Test photo deletion sync
    - Test metadata sync
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 10. Implement performance optimizations
  - [ ] 10.1 Add concurrent upload limiting
    - Limit to 3 concurrent uploads
    - Queue additional uploads
    - _Requirements: 12.3_
  
  - [ ] 10.2 Configure React Query performance features
    - Enable request deduplication
    - Configure retry with exponential backoff
    - _Requirements: 12.4, 12.5_
  
  - [ ] 10.3 Optimize photo grid rendering
    - Verify FlashList is used
    - Add prefetching for web (optional)
    - _Requirements: 12.6, 12.7_
  
  - [ ]* 10.4 Write property test for concurrent uploads
    - **Property 23: Concurrent Upload Limit**
    - **Validates: Requirements 12.3**
  
  - [ ]* 10.5 Write performance tests
    - Test cached photo display time (< 100ms)
    - Test optimistic update time (< 50ms)
    - _Requirements: 12.1, 12.2_

- [ ] 11. Final checkpoint - End-to-end testing
  - Run all unit tests and verify 90%+ coverage
  - Run all property tests (100+ iterations each)
  - Test complete photo lifecycle (upload → view → edit → delete)
  - Test album management flows
  - Test multi-device sync scenarios
  - Test error recovery scenarios
  - Test offline mode behavior
  - Verify performance targets met
  - Ask user if questions arise

- [ ] 12. Documentation and cleanup
  - Update README with API integration details
  - Document environment variables needed
  - Add inline code comments for complex logic
  - Remove unused AsyncStorage code (keep as cache layer)
  - Update type definitions if needed

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Integration tests verify multi-device sync and end-to-end flows
- Performance tests ensure the app meets timing constraints

## Dependencies

- `@tanstack/react-query` ^5.90.7 (already installed)
- `@react-native-async-storage/async-storage` (already installed)
- `expo-image-picker` (already installed)
- `fast-check` (for property-based testing) - install with: `npm install --save-dev fast-check`
- `@faker-js/faker` (for test data generation) - install with: `npm install --save-dev @faker-js/faker`

## Success Criteria

- All 12 requirements pass acceptance criteria
- 90%+ test coverage for API client and React Query hooks
- All property tests pass with 100+ iterations
- Multi-device sync works within 5 seconds of refetch
- Optimistic updates work for 100% of mutations
- Performance targets met (< 100ms cached display, < 50ms optimistic updates)
- No TypeScript errors or warnings
- All integration tests pass
