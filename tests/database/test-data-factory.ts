/**
 * Test Data Factory
 *
 * Provides type-safe, deterministic factories for generating realistic test
 * records that match the Drizzle schema types in shared/schema.ts.
 *
 * Principles:
 *  - Every factory returns a fresh object on each call (no shared mutable state).
 *  - An optional `overrides` parameter lets callers customise any field.
 *  - IDs use a counter prefix for determinism; callers may also pass explicit IDs.
 *  - All timestamps use `new Date()` so callers can mock `Date` if needed.
 */

import type {
  User,
  Photo,
  Album,
  AlbumPhoto,
  Face,
  Person,
  SharedAlbum,
  Memory,
  SmartAlbum,
  BackupQueue,
  UserDevice,
  StorageUsage,
} from "../../shared/schema";
import { populateStore, type InMemoryStore } from "./setup";

// ─────────────────────────────────────────────────────────
// COUNTER (deterministic IDs per test run)
// ─────────────────────────────────────────────────────────

let _seq = 0;

/** Reset the sequence counter – call in beforeEach for deterministic IDs. */
export function resetFactorySequence(): void {
  _seq = 0;
}

function nextId(prefix: string): string {
  return `${prefix}-${++_seq}`;
}

// ─────────────────────────────────────────────────────────
// USER FACTORY
// ─────────────────────────────────────────────────────────

export function makeUser(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? nextId("user");
  return {
    id,
    username: `user_${id}`,
    password: "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG",
    ...overrides,
  };
}

export function makeUsers(count: number, overrides: Partial<User> = {}): User[] {
  return Array.from({ length: count }, () => makeUser(overrides));
}

// ─────────────────────────────────────────────────────────
// PHOTO FACTORY
// ─────────────────────────────────────────────────────────

export function makePhoto(userId: string, overrides: Partial<Photo> = {}): Photo {
  const id = overrides.id ?? nextId("photo");
  const now = new Date();
  return {
    id,
    userId,
    uri: `/uploads/${id}.jpg`,
    width: 1920,
    height: 1080,
    filename: `${id}.jpg`,
    isFavorite: false,
    createdAt: now,
    modifiedAt: now,
    location: null,
    camera: null,
    exif: null,
    tags: null,
    notes: null,
    isPrivate: false,
    deletedAt: null,
    mlLabels: null,
    mlProcessedAt: null,
    mlVersion: null,
    ocrText: null,
    ocrLanguage: null,
    perceptualHash: null,
    duplicateGroupId: null,
    isVideo: false,
    videoDuration: null,
    videoThumbnailUri: null,
    backupStatus: null,
    backupCompletedAt: null,
    originalSize: null,
    compressedSize: null,
    ...overrides,
  };
}

export function makePhotos(
  userId: string,
  count: number,
  overrides: Partial<Photo> = {},
): Photo[] {
  return Array.from({ length: count }, () => makePhoto(userId, overrides));
}

// ─────────────────────────────────────────────────────────
// ALBUM FACTORY
// ─────────────────────────────────────────────────────────

export function makeAlbum(userId: string, overrides: Partial<Album> = {}): Album {
  const id = overrides.id ?? nextId("album");
  const now = new Date();
  return {
    id,
    userId,
    title: `Test Album ${id}`,
    description: null,
    coverPhotoUri: null,
    createdAt: now,
    modifiedAt: now,
    ...overrides,
  };
}

export function makeAlbums(
  userId: string,
  count: number,
  overrides: Partial<Album> = {},
): Album[] {
  return Array.from({ length: count }, () => makeAlbum(userId, overrides));
}

// ─────────────────────────────────────────────────────────
// ALBUM-PHOTO JUNCTION FACTORY
// ─────────────────────────────────────────────────────────

export function makeAlbumPhoto(
  albumId: string,
  photoId: string,
  overrides: Partial<AlbumPhoto> = {},
): AlbumPhoto {
  return {
    albumId,
    photoId,
    addedAt: new Date(),
    position: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// FACE FACTORY
// ─────────────────────────────────────────────────────────

export function makeFace(photoId: string, overrides: Partial<Face> = {}): Face {
  const id = overrides.id ?? nextId("face");
  const now = new Date();
  return {
    id,
    photoId,
    embedding: null,
    boundingBox: { x: 100, y: 100, width: 200, height: 200 },
    confidence: 0.95,
    personId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// PERSON FACTORY
// ─────────────────────────────────────────────────────────

export function makePerson(userId: string, overrides: Partial<Person> = {}): Person {
  const id = overrides.id ?? nextId("person");
  const now = new Date();
  return {
    id,
    userId,
    name: `Person ${id}`,
    isPinned: false,
    isHidden: false,
    clusterQuality: 0.9,
    faceCount: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// SHARED ALBUM FACTORY
// ─────────────────────────────────────────────────────────

export function makeSharedAlbum(
  albumId: string,
  overrides: Partial<SharedAlbum> = {},
): SharedAlbum {
  const id = overrides.id ?? nextId("shared-album");
  const now = new Date();
  return {
    id,
    albumId,
    shareToken: `share-token-${id}`,
    passwordHash: null,
    permissions: "view",
    expiresAt: null,
    viewCount: 0,
    isActive: true,
    allowDownload: true,
    showMetadata: false,
    customTitle: null,
    customDescription: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// MEMORY FACTORY
// ─────────────────────────────────────────────────────────

export function makeMemory(userId: string, overrides: Partial<Memory> = {}): Memory {
  const id = overrides.id ?? nextId("memory");
  const now = new Date();
  return {
    id,
    userId,
    title: `Memory ${id}`,
    description: null,
    memoryType: "on_this_day",
    coverPhotoId: null,
    photoCount: 0,
    score: null,
    startDate: now,
    endDate: now,
    isFavorite: false,
    isHidden: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// SMART ALBUM FACTORY
// ─────────────────────────────────────────────────────────

export function makeSmartAlbum(userId: string, overrides: Partial<SmartAlbum> = {}): SmartAlbum {
  const id = overrides.id ?? nextId("smart-album");
  const now = new Date();
  return {
    id,
    userId,
    title: `Smart Album ${id}`,
    description: null,
    albumType: "location",
    criteria: {},
    coverPhotoId: null,
    photoCount: 0,
    isPinned: false,
    isHidden: false,
    lastUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// BACKUP QUEUE FACTORY
// ─────────────────────────────────────────────────────────

export function makeBackupQueueItem(
  photoId: string,
  overrides: Partial<BackupQueue> = {},
): BackupQueue {
  const id = overrides.id ?? nextId("backup");
  const now = new Date();
  return {
    id,
    photoId,
    status: "pending",
    priority: 0,
    retryCount: 0,
    maxRetries: 3,
    errorMessage: null,
    scheduledAt: now,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// USER DEVICE FACTORY
// ─────────────────────────────────────────────────────────

export function makeUserDevice(userId: string, overrides: Partial<UserDevice> = {}): UserDevice {
  const id = overrides.id ?? nextId("device");
  const now = new Date();
  return {
    id,
    userId,
    deviceId: `device-id-${id}`,
    deviceName: `Test Device ${id}`,
    deviceType: "mobile",
    lastSyncAt: now,
    isActive: true,
    storageUsed: 0,
    appVersion: "1.0.0",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// STORAGE USAGE FACTORY
// ─────────────────────────────────────────────────────────

export function makeStorageUsage(userId: string, overrides: Partial<StorageUsage> = {}): StorageUsage {
  const id = overrides.id ?? nextId("storage");
  const now = new Date();
  return {
    id,
    userId,
    category: "photos",
    bytesUsed: 0,
    itemCount: 0,
    calculatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// COMPOSITE DATASET FACTORY
// ─────────────────────────────────────────────────────────

export interface TestDataset {
  user: User;
  photos: Photo[];
  albums: Album[];
  albumPhotos: AlbumPhoto[];
}

/**
 * Creates a complete, self-consistent test dataset.
 *
 * @param photoCount   Number of photos to create (default 5)
 * @param albumCount   Number of albums to create (default 2)
 * @param photosPerAlbum How many photos to link to each album (default 3)
 */
export function makeDataset(
  photoCount = 5,
  albumCount = 2,
  photosPerAlbum = 3,
): TestDataset {
  const user = makeUser();
  const photos = makePhotos(user.id, photoCount);
  const albums = makeAlbums(user.id, albumCount);
  const albumPhotos: AlbumPhoto[] = [];

  for (const album of albums) {
    const linked = photos.slice(0, Math.min(photosPerAlbum, photos.length));
    for (const photo of linked) {
      albumPhotos.push(makeAlbumPhoto(album.id, photo.id));
    }
  }

  return { user, photos, albums, albumPhotos };
}

// ─────────────────────────────────────────────────────────
// STORE SEED HELPER
// ─────────────────────────────────────────────────────────

/**
 * Seeds a TestDataset into an InMemoryStore.
 * Convenience wrapper around populateStore().
 */
export function seedDataset(store: InMemoryStore, dataset: TestDataset): void {
  populateStore(store, {
    users: [dataset.user],
    photos: dataset.photos,
    albums: dataset.albums,
    albumPhotos: dataset.albumPhotos,
  });
}

// ─────────────────────────────────────────────────────────
// BOUNDARY / EDGE-CASE DATA
// ─────────────────────────────────────────────────────────

/** Edge-case photo records useful for boundary testing. */
export const edgeCasePhotos = {
  minDimensions: (userId: string) => makePhoto(userId, { width: 1, height: 1 }),
  maxDimensions: (userId: string) => makePhoto(userId, { width: 99999, height: 99999 }),
  favorite: (userId: string) => makePhoto(userId, { isFavorite: true }),
  private: (userId: string) => makePhoto(userId, { isPrivate: true }),
  softDeleted: (userId: string) => makePhoto(userId, { deletedAt: new Date() }),
  withTags: (userId: string) => makePhoto(userId, { tags: ["beach", "vacation", "2024"] }),
  withLocation: (userId: string) =>
    makePhoto(userId, {
      location: { latitude: 37.7749, longitude: -122.4194, city: "San Francisco" },
    }),
  video: (userId: string) => makePhoto(userId, { isVideo: true, videoDuration: 120 }),
  mlProcessed: (userId: string) =>
    makePhoto(userId, {
      mlLabels: ["beach", "ocean"],
      mlProcessedAt: new Date(),
      mlVersion: "v1.0",
    }),
};

/** Edge-case album records for boundary testing. */
export const edgeCaseAlbums = {
  emptyTitle: (userId: string) => makeAlbum(userId, { title: "" }),
  longTitle: (userId: string) => makeAlbum(userId, { title: "A".repeat(255) }),
  unicodeTitle: (userId: string) => makeAlbum(userId, { title: "📸 Summer 2024 🌊" }),
  withDescription: (userId: string) =>
    makeAlbum(userId, { description: "A carefully curated album of memories." }),
};
