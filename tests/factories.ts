// Test factories and utilities for Cloud Gallery
// Provides helper functions for generating test data

import type { Photo, Album } from "../client/types";

// Define UserProfile based on usage in storage tests
export interface UserProfile {
  username: string;
  displayName?: string;
  avatar?: string | null;
  preferences?: {
    theme?: string;
    autoBackup?: boolean;
    storageWarning?: boolean;
  };
  createdAt: number;
}

/**
 * Factory for creating test Photo objects
 */
export function createTestPhoto(overrides: Partial<Photo> = {}): Photo {
  const now = Date.now();
  return {
    id: `photo_${now}_${Math.random().toString(36).substr(2, 9)}`,
    uri: `file://test/photo_${now}.jpg`,
    width: 1920,
    height: 1080,
    createdAt: now,
    modifiedAt: now,
    filename: `photo_${now}.jpg`,
    isFavorite: false,
    albumIds: [],
    ...overrides,
  };
}

/**
 * Factory for creating test Album objects
 */
export function createTestAlbum(overrides: Partial<Album> = {}): Album {
  const now = Date.now();
  return {
    id: `album_${now}_${Math.random().toString(36).substr(2, 9)}`,
    title: `Test Album ${now}`,
    createdAt: now,
    modifiedAt: now,
    photoIds: [],
    coverPhotoUri: null,
    ...overrides,
  };
}

/**
 * Factory for creating test UserProfile objects
 */
export function createTestUserProfile(
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    username: `testuser_${Date.now()}`,
    displayName: "Test User",
    avatar: null,
    preferences: {
      theme: "light",
      autoBackup: true,
      storageWarning: true,
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Creates an array of test photos
 */
export function createTestPhotos(
  count: number,
  overrides: Partial<Photo> = {},
): Photo[] {
  return Array.from({ length: count }, (_, i) =>
    createTestPhoto({
      ...overrides,
      id: `photo_batch_${i}_${Date.now()}`,
      uri: `file://test/photo_batch_${i}.jpg`,
      filename: `photo_batch_${i}.jpg`,
    }),
  );
}

/**
 * Creates an array of test albums
 */
export function createTestAlbums(
  count: number,
  overrides: Partial<Album> = {},
): Album[] {
  return Array.from({ length: count }, (_, i) =>
    createTestAlbum({
      ...overrides,
      id: `album_batch_${i}_${Date.now()}`,
      title: `Test Album Batch ${i}`,
    }),
  );
}

/**
 * Creates test data with relationships (photos in albums)
 */
export function createTestData(
  photoCount: number = 10,
  albumCount: number = 3,
) {
  const photos = createTestPhotos(photoCount);
  const albums = createTestAlbums(albumCount);

  // Assign some photos to albums
  albums.forEach((album, albumIndex) => {
    const startIdx = albumIndex * Math.floor(photoCount / albumCount);
    const endIdx = Math.min(
      startIdx + Math.floor(photoCount / albumCount),
      photoCount,
    );
    album.photoIds = photos.slice(startIdx, endIdx).map((p) => p.id);

    // Set cover photo
    if (album.photoIds.length > 0) {
      album.coverPhotoUri =
        photos.find((p) => p.id === album.photoIds[0])?.uri || null;
    }
  });

  // Update photos with album references
  photos.forEach((photo, photoIndex) => {
    const albumIndex = Math.floor(
      photoIndex / Math.floor(photoCount / albumCount),
    );
    if (albumIndex < albums.length) {
      photo.albumIds = [albums[albumIndex].id];
    }
  });

  return { photos, albums };
}

/**
 * Boundary condition test data generators
 */
export const boundaryTestData = {
  /**
   * Creates photos with extreme dimensions
   */
  extremePhotos: () => [
    createTestPhoto({ width: 1, height: 1 }), // Minimum
    createTestPhoto({ width: 10000, height: 10000 }), // Maximum
    createTestPhoto({ width: 0, height: 1080 }), // Invalid (zero width)
    createTestPhoto({ width: 1920, height: 0 }), // Invalid (zero height)
  ],

  /**
   * Creates albums with edge case titles
   */
  extremeAlbums: () => [
    createTestAlbum({ title: "" }), // Empty title
    createTestAlbum({ title: "A".repeat(1000) }), // Very long title
    createTestAlbum({ title: "📸🎨🎭🎪🎨📸" }), // Unicode characters
    createTestAlbum({ title: "Album with\nnewlines\nand\ttabs" }), // Control characters
  ],

  /**
   * Creates user profiles with edge case data
   */
  extremeUsers: () => [
    createTestUserProfile({ username: "" }), // Empty username
    createTestUserProfile({ username: "a".repeat(100) }), // Long username
    createTestUserProfile({ displayName: undefined }), // No display name
    createTestUserProfile({ displayName: "" }), // Empty display name
  ],
};

/**
 * Performance test data generators
 */
export const performanceTestData = {
  /**
   * Creates large dataset for performance testing
   */
  largeDataset: (photoCount: number = 1000, albumCount: number = 50) =>
    createTestData(photoCount, albumCount),

  /**
   * Creates data for stress testing storage operations
   */
  stressTestData: (iterations: number = 100) =>
    Array.from({ length: iterations }, () => createTestData(10, 2)),
};
