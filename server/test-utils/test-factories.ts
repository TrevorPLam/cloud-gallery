import { schema } from "./test-database";
import { eq } from "drizzle-orm";

/**
 * Test data factory for creating realistic test data
 * Follows sociable testing principles - uses real domain objects
 */

export interface TestDataOverrides {
  [key: string]: any;
}

/**
 * Creates a test user with optional overrides
 */
export function createTestUser(overrides: TestDataOverrides = {}) {
  const now = Date.now();

  return {
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    email: `test-${Math.random().toString(36).substr(2, 9)}@example.com`,
    username: `user_${Math.random().toString(36).substr(2, 9)}`,
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$mock_hash_for_testing",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a test photo with optional overrides
 */
export function createTestPhoto(
  userId: string,
  overrides: TestDataOverrides = {},
) {
  const now = Date.now();

  return {
    id: `photo-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    uri: `/test-photos/photo_${Math.random().toString(36).substr(2, 9)}.jpg`,
    filename: `photo_${Math.random().toString(36).substr(2, 9)}.jpg`,
    width: 1920,
    height: 1080,
    fileSize: 1024000,
    mimeType: "image/jpeg",
    isFavorite: false,
    createdAt: now,
    modifiedAt: now,
    ...overrides,
  };
}

/**
 * Creates a test album with optional overrides
 */
export function createTestAlbum(
  userId: string,
  overrides: TestDataOverrides = {},
) {
  const now = Date.now();

  return {
    id: `album-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    title: `Test Album ${Math.random().toString(36).substr(2, 9)}`,
    description: "A test album for sociable testing",
    coverPhotoUri: null,
    createdAt: now,
    modifiedAt: now,
    ...overrides,
  };
}

/**
 * Creates multiple test photos for a user
 */
export function createTestPhotos(
  userId: string,
  count: number,
  overrides: TestDataOverrides = {},
) {
  return Array.from({ length: count }, () =>
    createTestPhoto(userId, overrides),
  );
}

/**
 * Creates multiple test albums for a user
 */
export function createTestAlbums(
  userId: string,
  count: number,
  overrides: TestDataOverrides = {},
) {
  return Array.from({ length: count }, () =>
    createTestAlbum(userId, overrides),
  );
}

/**
 * Creates a complete test dataset with user, photos, and albums
 */
export function createTestDataset(
  photoCount = 10,
  albumCount = 3,
  overrides: TestDataOverrides = {},
) {
  const user = createTestUser(overrides.user);
  const photos = createTestPhotos(user.id, photoCount, overrides.photos);
  const albums = createTestAlbums(user.id, albumCount, overrides.albums);

  return {
    user,
    photos,
    albums,
  };
}

/**
 * Seeds test database with test data
 */
export async function seedTestData(db: any, testData: any) {
  const { user, photos, albums } = testData;

  // Insert user
  await db.insert(schema.users).values(user);

  // Insert photos
  if (photos.length > 0) {
    await db.insert(schema.photos).values(photos);
  }

  // Insert albums
  if (albums.length > 0) {
    await db.insert(schema.albums).values(albums);

    // Add some photos to albums
    for (const album of albums) {
      const photosToAdd = photos.slice(0, Math.min(3, photos.length));
      for (const photo of photosToAdd) {
        await db.insert(schema.albumPhotos).values({
          albumId: album.id,
          photoId: photo.id,
          addedAt: Date.now(),
        });
      }
    }
  }

  return testData;
}

/**
 * Boundary test data for edge cases
 */
export const boundaryTestData = {
  /**
   * Creates photos with extreme dimensions
   */
  extremePhotos: () => [
    createTestPhoto("user-1", { width: 1, height: 1 }),
    createTestPhoto("user-1", { width: 99999, height: 99999 }),
    createTestPhoto("user-1", { width: 0, height: 100 }),
    createTestPhoto("user-1", { width: 100, height: 0 }),
  ],

  /**
   * Creates albums with edge case titles
   */
  extremeAlbums: () => [
    createTestAlbum("user-1", { title: "" }),
    createTestAlbum("user-1", { title: "A".repeat(1000) }),
    createTestAlbum("user-1", { title: "📸🎨🎭" }), // Unicode
    createTestAlbum("user-1", { title: "Album with\nnewlines\tand\ttabs" }),
  ],

  /**
   * Creates users with edge case data
   */
  extremeUsers: () => [
    createTestUser({ email: "a@b.co" }), // Minimal email
    createTestUser({ email: "very.long.email.address@example.com" }), // Long email
    createTestUser({ username: "a" }), // Minimal username
    createTestUser({ username: "user_with_underscores_and_numbers_123" }),
  ],
};

/**
 * Performance test data
 */
export const performanceTestData = {
  /**
   * Creates a large dataset for performance testing
   */
  largeDataset: (photoCount = 1000, albumCount = 50) => {
    const user = createTestUser();
    const photos = createTestPhotos(user.id, photoCount);
    const albums = createTestAlbums(user.id, albumCount);

    return {
      user,
      photos,
      albums,
      totalPhotos: photoCount,
      totalAlbums: albumCount,
    };
  },
};

/**
 * Clears all test data from database
 */
export async function clearTestData(db: any) {
  // Delete in correct order due to foreign key constraints
  await db.delete(schema.albumPhotos);
  await db.delete(schema.albums);
  await db.delete(schema.photos);
  await db.delete(schema.users);
}
