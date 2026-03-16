/**
 * Database Infrastructure Integration Tests
 *
 * Tests the in-memory test database infrastructure defined in setup.ts and
 * the test data factory defined in test-data-factory.ts.
 *
 * These tests serve as both validation of the testing infrastructure itself
 * and as living documentation of how to use it in application tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createEmptyStore,
  createTestDb,
  setupIsolatedTestDb,
  populateStore,
  clearTable,
  getRows,
  seedDatabase,
  type InMemoryStore,
} from "./setup";
import {
  makeUser,
  makeUsers,
  makePhoto,
  makePhotos,
  makeAlbum,
  makeAlbums,
  makeAlbumPhoto,
  makeFace,
  makePerson,
  makeSharedAlbum,
  makeMemory,
  makeSmartAlbum,
  makeBackupQueueItem,
  makeUserDevice,
  makeStorageUsage,
  makeDataset,
  seedDataset,
  resetFactorySequence,
  edgeCasePhotos,
  edgeCaseAlbums,
} from "./test-data-factory";

// ─────────────────────────────────────────────────────────
// STORE CREATION
// ─────────────────────────────────────────────────────────

describe("createEmptyStore()", () => {
  it("creates a store with all expected collections", () => {
    const store = createEmptyStore();
    expect(store.users).toBeDefined();
    expect(store.photos).toBeDefined();
    expect(store.albums).toBeDefined();
    expect(store.albumPhotos).toBeDefined();
    expect(store.faces).toBeDefined();
    expect(store.people).toBeDefined();
    expect(store.sharedAlbums).toBeDefined();
    expect(store.memories).toBeDefined();
    expect(store.smartAlbums).toBeDefined();
    expect(store.backupQueue).toBeDefined();
    expect(store.userDevices).toBeDefined();
    expect(store.storageUsage).toBeDefined();
  });

  it("creates all collections as empty objects", () => {
    const store = createEmptyStore();
    for (const collection of Object.values(store)) {
      expect(Object.keys(collection)).toHaveLength(0);
    }
  });

  it("returns independent instances on each call", () => {
    const store1 = createEmptyStore();
    const store2 = createEmptyStore();
    store1.users["u1"] = { id: "u1", username: "alice", password: "hash" };
    expect(store2.users["u1"]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────
// POPULATE STORE
// ─────────────────────────────────────────────────────────

describe("populateStore()", () => {
  it("inserts records keyed by id", () => {
    const store = createEmptyStore();
    const user = makeUser({ id: "u-1" });
    populateStore(store, { users: [user] });
    expect(store.users["u-1"]).toEqual(user);
  });

  it("auto-assigns ids for records without one", () => {
    const store = createEmptyStore();
    populateStore(store, { users: [{ username: "alice", password: "hash" }] });
    const rows = getRows(store, "users");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBeDefined();
  });

  it("inserts into multiple collections in one call", () => {
    const store = createEmptyStore();
    const user = makeUser();
    const photo = makePhoto(user.id);
    populateStore(store, { users: [user], photos: [photo] });
    expect(Object.keys(store.users)).toHaveLength(1);
    expect(Object.keys(store.photos)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────
// GET ROWS
// ─────────────────────────────────────────────────────────

describe("getRows()", () => {
  it("returns an empty array for an empty collection", () => {
    const store = createEmptyStore();
    expect(getRows(store, "photos")).toEqual([]);
  });

  it("returns all inserted rows", () => {
    const store = createEmptyStore();
    const user = makeUser();
    populateStore(store, { users: [makeUser(), makeUser(), makeUser()] });
    expect(getRows(store, "users")).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────
// CLEAR TABLE
// ─────────────────────────────────────────────────────────

describe("clearTable()", () => {
  it("removes all rows from the specified table", () => {
    const store = createEmptyStore();
    populateStore(store, { users: [makeUser(), makeUser()] });
    expect(getRows(store, "users")).toHaveLength(2);

    clearTable(store, "users");
    expect(getRows(store, "users")).toHaveLength(0);
  });

  it("does not affect other tables", () => {
    const store = createEmptyStore();
    const user = makeUser();
    const photo = makePhoto(user.id);
    populateStore(store, { users: [user], photos: [photo] });

    clearTable(store, "users");
    expect(getRows(store, "photos")).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────
// SEED DATABASE (no-op, exists for API compatibility)
// ─────────────────────────────────────────────────────────

describe("seedDatabase()", () => {
  it("is a no-op and does not throw", async () => {
    const store = createEmptyStore();
    const db = createTestDb(store);
    await expect(seedDatabase(db, {})).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────
// MOCK DB – SELECT
// ─────────────────────────────────────────────────────────

describe("createTestDb() – select operations", () => {
  it("select.from returns all rows in a table", async () => {
    const store = createEmptyStore();
    const user = makeUser({ id: "u-1" });
    populateStore(store, { users: [user] });

    const db = createTestDb(store);
    // We need a Drizzle table reference to identify the collection.
    // Use a plain object that mimics what Drizzle passes (_.name property).
    const fakeUsersTable = { _: { name: "users" } };
    const rows = await (db.select() as any).from(fakeUsersTable);
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe(user.username);
  });

  it("select.from with .limit returns bounded result set", async () => {
    const store = createEmptyStore();
    populateStore(store, { users: makeUsers(10) });
    const db = createTestDb(store);

    const fakeUsersTable = { _: { name: "users" } };
    const rows = await (db.select() as any).from(fakeUsersTable).limit(3);
    expect(rows).toHaveLength(3);
  });

  it("select.from returns empty array for unknown table name", async () => {
    const store = createEmptyStore();
    const db = createTestDb(store);
    const unknownTable = { _: { name: "nonexistent_table" } };
    const rows = await (db.select() as any).from(unknownTable);
    expect(rows).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// MOCK DB – INSERT
// ─────────────────────────────────────────────────────────

describe("createTestDb() – insert operations", () => {
  it("insert.values stores record in the backing store", async () => {
    const store = createEmptyStore();
    const db = createTestDb(store);
    const fakeUsersTable = { _: { name: "users" } };

    const user = { id: "u-new", username: "charlie", password: "hash" };
    const [inserted] = await (db.insert(fakeUsersTable) as any)
      .values(user)
      .returning();

    expect(inserted.id).toBe("u-new");
    expect(store.users["u-new"]).toBeDefined();
    expect(store.users["u-new"].username).toBe("charlie");
  });

  it("insert auto-assigns an id when none is provided", async () => {
    const store = createEmptyStore();
    const db = createTestDb(store);
    const fakeUsersTable = { _: { name: "users" } };

    const [inserted] = await (db.insert(fakeUsersTable) as any)
      .values({ username: "dave", password: "hash" })
      .returning();

    expect(inserted.id).toBeDefined();
    expect(typeof inserted.id).toBe("string");
  });

  it("insert.values accepts an array and inserts all records", async () => {
    const store = createEmptyStore();
    const db = createTestDb(store);
    const fakeUsersTable = { _: { name: "users" } };
    const users = makeUsers(3);

    const inserted = await (db.insert(fakeUsersTable) as any)
      .values(users)
      .returning();

    expect(inserted).toHaveLength(3);
    expect(getRows(store, "users")).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────
// MOCK DB – DELETE
// ─────────────────────────────────────────────────────────

describe("createTestDb() – delete operations", () => {
  it("delete.where clears all rows in the table", async () => {
    const store = createEmptyStore();
    populateStore(store, { users: makeUsers(3) });
    const db = createTestDb(store);
    const fakeUsersTable = { _: { name: "users" } };

    await (db.delete(fakeUsersTable) as any).where(null);

    expect(getRows(store, "users")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
// SETUP ISOLATED TEST DB LIFECYCLE
// ─────────────────────────────────────────────────────────

describe("setupIsolatedTestDb()", () => {
  const { getDb, getStore, resetStore } = setupIsolatedTestDb();

  it("provides a fresh empty store before each test", () => {
    expect(getRows(getStore(), "users")).toHaveLength(0);
  });

  it("resets store between tests – this test populates the store", () => {
    populateStore(getStore(), { users: [makeUser()] });
    expect(getRows(getStore(), "users")).toHaveLength(1);
  });

  it("resets store between tests – store should be empty again", () => {
    // The previous test inserted a user; this test should see a clean store
    expect(getRows(getStore(), "users")).toHaveLength(0);
  });

  it("resetStore() manually resets the store mid-test", () => {
    populateStore(getStore(), { users: [makeUser()] });
    expect(getRows(getStore(), "users")).toHaveLength(1);

    resetStore();
    expect(getRows(getStore(), "users")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
// DATA ISOLATION BETWEEN TEST DATABASES
// ─────────────────────────────────────────────────────────

describe("Test data isolation", () => {
  it("two independent stores do not share data", () => {
    const store1 = createEmptyStore();
    const store2 = createEmptyStore();

    populateStore(store1, { users: [makeUser({ id: "u-isolation-1" })] });

    expect(store1.users["u-isolation-1"]).toBeDefined();
    expect(store2.users["u-isolation-1"]).toBeUndefined();
  });

  it("two independent db instances do not share data", async () => {
    const store1 = createEmptyStore();
    const store2 = createEmptyStore();
    const db1 = createTestDb(store1);
    const db2 = createTestDb(store2);

    const fakeTable = { _: { name: "users" } };
    await (db1.insert(fakeTable) as any)
      .values({ id: "u-db1", username: "user1", password: "hash" })
      .returning();

    const rows2 = await (db2.select() as any).from(fakeTable);
    expect(rows2).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
// FACTORY TESTS – USER
// ─────────────────────────────────────────────────────────

describe("makeUser()", () => {
  beforeEach(() => resetFactorySequence());

  it("creates a user with required fields", () => {
    const user = makeUser();
    expect(user.id).toBeDefined();
    expect(user.username).toBeDefined();
    expect(user.password).toBeDefined();
  });

  it("applies overrides", () => {
    const user = makeUser({ username: "custom-name" });
    expect(user.username).toBe("custom-name");
  });

  it("overrides do not affect other fields", () => {
    const user = makeUser({ username: "alice" });
    expect(user.id).toBeDefined();
    expect(user.password).toBeDefined();
  });

  it("each call produces a different id", () => {
    const u1 = makeUser();
    const u2 = makeUser();
    expect(u1.id).not.toBe(u2.id);
  });
});

describe("makeUsers()", () => {
  beforeEach(() => resetFactorySequence());

  it("creates the requested number of users", () => {
    expect(makeUsers(5)).toHaveLength(5);
  });

  it("all created users have unique ids", () => {
    const users = makeUsers(10);
    const ids = new Set(users.map((u) => u.id));
    expect(ids.size).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────
// FACTORY TESTS – PHOTO
// ─────────────────────────────────────────────────────────

describe("makePhoto()", () => {
  beforeEach(() => resetFactorySequence());

  it("creates a photo with required fields", () => {
    const photo = makePhoto("u-1");
    expect(photo.id).toBeDefined();
    expect(photo.userId).toBe("u-1");
    expect(photo.uri).toBeDefined();
    expect(photo.width).toBeGreaterThan(0);
    expect(photo.height).toBeGreaterThan(0);
    expect(photo.filename).toBeDefined();
    expect(photo.isFavorite).toBe(false);
    expect(photo.createdAt).toBeInstanceOf(Date);
  });

  it("applies overrides", () => {
    const photo = makePhoto("u-1", { isFavorite: true, width: 800 });
    expect(photo.isFavorite).toBe(true);
    expect(photo.width).toBe(800);
  });
});

describe("makePhotos()", () => {
  it("creates the requested number of photos for a user", () => {
    expect(makePhotos("u-1", 7)).toHaveLength(7);
  });
});

// ─────────────────────────────────────────────────────────
// FACTORY TESTS – ALBUM
// ─────────────────────────────────────────────────────────

describe("makeAlbum()", () => {
  it("creates an album with required fields", () => {
    const album = makeAlbum("u-1");
    expect(album.id).toBeDefined();
    expect(album.userId).toBe("u-1");
    expect(album.title).toBeDefined();
    expect(album.createdAt).toBeInstanceOf(Date);
  });
});

describe("makeAlbumPhoto()", () => {
  it("creates a junction record with correct ids", () => {
    const ap = makeAlbumPhoto("album-1", "photo-1");
    expect(ap.albumId).toBe("album-1");
    expect(ap.photoId).toBe("photo-1");
    expect(ap.addedAt).toBeInstanceOf(Date);
    expect(ap.position).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// FACTORY TESTS – FACES & PEOPLE
// ─────────────────────────────────────────────────────────

describe("makeFace()", () => {
  it("creates a face record with required fields", () => {
    const face = makeFace("photo-1");
    expect(face.id).toBeDefined();
    expect(face.photoId).toBe("photo-1");
    expect(face.confidence).toBeGreaterThan(0);
    expect(face.boundingBox).toBeDefined();
    expect(face.personId).toBeNull();
  });
});

describe("makePerson()", () => {
  it("creates a person with required fields", () => {
    const person = makePerson("u-1");
    expect(person.id).toBeDefined();
    expect(person.userId).toBe("u-1");
    expect(person.isPinned).toBe(false);
    expect(person.isHidden).toBe(false);
    expect(person.faceCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────
// FACTORY TESTS – OPERATIONAL RECORDS
// ─────────────────────────────────────────────────────────

describe("makeBackupQueueItem()", () => {
  it("creates a backup queue item with pending status", () => {
    const item = makeBackupQueueItem("photo-1");
    expect(item.photoId).toBe("photo-1");
    expect(item.status).toBe("pending");
    expect(item.retryCount).toBe(0);
    expect(item.maxRetries).toBe(3);
    expect(item.startedAt).toBeNull();
    expect(item.completedAt).toBeNull();
  });
});

describe("makeUserDevice()", () => {
  it("creates an active device by default", () => {
    const device = makeUserDevice("u-1");
    expect(device.userId).toBe("u-1");
    expect(device.isActive).toBe(true);
    expect(device.storageUsed).toBe(0);
  });
});

describe("makeStorageUsage()", () => {
  it("creates a storage usage record with zero counts", () => {
    const usage = makeStorageUsage("u-1");
    expect(usage.userId).toBe("u-1");
    expect(usage.bytesUsed).toBe(0);
    expect(usage.itemCount).toBe(0);
  });
});

describe("makeSharedAlbum()", () => {
  it("creates an active share with view permissions by default", () => {
    const sa = makeSharedAlbum("album-1");
    expect(sa.albumId).toBe("album-1");
    expect(sa.permissions).toBe("view");
    expect(sa.isActive).toBe(true);
    expect(sa.viewCount).toBe(0);
    expect(sa.shareToken).toBeDefined();
  });
});

describe("makeMemory()", () => {
  it("creates a memory with on_this_day type by default", () => {
    const memory = makeMemory("u-1");
    expect(memory.userId).toBe("u-1");
    expect(memory.memoryType).toBe("on_this_day");
    expect(memory.isFavorite).toBe(false);
    expect(memory.isHidden).toBe(false);
  });
});

describe("makeSmartAlbum()", () => {
  it("creates a smart album with location type by default", () => {
    const sa = makeSmartAlbum("u-1");
    expect(sa.userId).toBe("u-1");
    expect(sa.albumType).toBe("location");
    expect(sa.isPinned).toBe(false);
    expect(sa.isHidden).toBe(false);
    expect(sa.photoCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// COMPOSITE DATASET
// ─────────────────────────────────────────────────────────

describe("makeDataset()", () => {
  beforeEach(() => resetFactorySequence());

  it("creates a self-consistent dataset with user, photos, and albums", () => {
    const ds = makeDataset(5, 2, 3);
    expect(ds.user).toBeDefined();
    expect(ds.photos).toHaveLength(5);
    expect(ds.albums).toHaveLength(2);
    expect(ds.albumPhotos.length).toBeGreaterThan(0);
  });

  it("all photos belong to the dataset user", () => {
    const ds = makeDataset(4, 2);
    for (const photo of ds.photos) {
      expect(photo.userId).toBe(ds.user.id);
    }
  });

  it("all albums belong to the dataset user", () => {
    const ds = makeDataset(4, 2);
    for (const album of ds.albums) {
      expect(album.userId).toBe(ds.user.id);
    }
  });

  it("album-photo junction records reference valid albums and photos", () => {
    const ds = makeDataset(5, 2, 3);
    const albumIds = new Set(ds.albums.map((a) => a.id));
    const photoIds = new Set(ds.photos.map((p) => p.id));
    for (const ap of ds.albumPhotos) {
      expect(albumIds).toContain(ap.albumId);
      expect(photoIds).toContain(ap.photoId);
    }
  });
});

describe("seedDataset()", () => {
  it("populates an in-memory store with the dataset", () => {
    const store = createEmptyStore();
    const ds = makeDataset(3, 2);
    seedDataset(store, ds);

    expect(getRows(store, "users")).toHaveLength(1);
    expect(getRows(store, "photos")).toHaveLength(3);
    expect(getRows(store, "albums")).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────
// EDGE CASE PHOTOS
// ─────────────────────────────────────────────────────────

describe("edgeCasePhotos", () => {
  it("minDimensions creates a 1x1 photo", () => {
    const photo = edgeCasePhotos.minDimensions("u-1");
    expect(photo.width).toBe(1);
    expect(photo.height).toBe(1);
  });

  it("maxDimensions creates a large photo", () => {
    const photo = edgeCasePhotos.maxDimensions("u-1");
    expect(photo.width).toBe(99999);
    expect(photo.height).toBe(99999);
  });

  it("favorite creates a favorited photo", () => {
    const photo = edgeCasePhotos.favorite("u-1");
    expect(photo.isFavorite).toBe(true);
  });

  it("softDeleted creates a photo with deletedAt set", () => {
    const photo = edgeCasePhotos.softDeleted("u-1");
    expect(photo.deletedAt).toBeInstanceOf(Date);
  });

  it("withTags creates a photo with tags array", () => {
    const photo = edgeCasePhotos.withTags("u-1");
    expect(photo.tags).toContain("beach");
  });

  it("withLocation creates a photo with GPS data", () => {
    const photo = edgeCasePhotos.withLocation("u-1");
    expect(photo.location).toMatchObject({ latitude: expect.any(Number) });
  });

  it("video creates an isVideo=true photo with duration", () => {
    const photo = edgeCasePhotos.video("u-1");
    expect(photo.isVideo).toBe(true);
    expect(photo.videoDuration).toBeGreaterThan(0);
  });

  it("mlProcessed creates a photo with ML metadata", () => {
    const photo = edgeCasePhotos.mlProcessed("u-1");
    expect(photo.mlLabels).not.toBeNull();
    expect(photo.mlVersion).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────
// EDGE CASE ALBUMS
// ─────────────────────────────────────────────────────────

describe("edgeCaseAlbums", () => {
  it("emptyTitle creates an album with empty title", () => {
    const album = edgeCaseAlbums.emptyTitle("u-1");
    expect(album.title).toBe("");
  });

  it("longTitle creates an album with a very long title", () => {
    const album = edgeCaseAlbums.longTitle("u-1");
    expect(album.title.length).toBe(255);
  });

  it("unicodeTitle handles emoji characters", () => {
    const album = edgeCaseAlbums.unicodeTitle("u-1");
    expect(album.title).toContain("📸");
  });
});

// ─────────────────────────────────────────────────────────
// SEQUENCE RESET
// ─────────────────────────────────────────────────────────

describe("resetFactorySequence()", () => {
  it("resets id sequence so ids are deterministic after reset", () => {
    resetFactorySequence();
    const first = makeUser();
    resetFactorySequence();
    const second = makeUser();
    expect(first.id).toBe(second.id);
  });
});
