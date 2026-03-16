/**
 * Test Database Infrastructure
 *
 * Provides an isolated, mock-based database environment for integration testing.
 * Each test suite gets its own isolated store so tests never share state.
 *
 * Design:
 *  - No real Postgres connection required – uses in-memory maps as the backing store.
 *  - Full Drizzle-shaped query API is stubbed so production service code runs
 *    without modification inside tests.
 *  - Cleanup helpers ensure per-test isolation.
 */

import { vi, beforeEach, afterEach } from "vitest";
import { createMockDb } from "../../server/test-utils/drizzle-mock";

// ─────────────────────────────────────────────────────────
// INTERNAL ID COUNTER
// ─────────────────────────────────────────────────────────

let _idSeq = 0;

/** Generate a deterministic test ID for internal store use. */
function nextStoreId(prefix: string): string {
  return `${prefix}-${++_idSeq}`;
}

// ─────────────────────────────────────────────────────────
// IN-MEMORY STORE TYPES
// ─────────────────────────────────────────────────────────

export interface InMemoryStore {
  users: Record<string, any>;
  photos: Record<string, any>;
  albums: Record<string, any>;
  albumPhotos: Record<string, any>;
  faces: Record<string, any>;
  people: Record<string, any>;
  sharedAlbums: Record<string, any>;
  memories: Record<string, any>;
  smartAlbums: Record<string, any>;
  backupQueue: Record<string, any>;
  userDevices: Record<string, any>;
  storageUsage: Record<string, any>;
}

// ─────────────────────────────────────────────────────────
// STORE FACTORY
// ─────────────────────────────────────────────────────────

/**
 * Creates a fresh empty in-memory store.
 * Call this once per test (or beforeEach) for isolation.
 */
export function createEmptyStore(): InMemoryStore {
  return {
    users: {},
    photos: {},
    albums: {},
    albumPhotos: {},
    faces: {},
    people: {},
    sharedAlbums: {},
    memories: {},
    smartAlbums: {},
    backupQueue: {},
    userDevices: {},
    storageUsage: {},
  };
}

// ─────────────────────────────────────────────────────────
// MOCK DB BUILDER
// ─────────────────────────────────────────────────────────

/**
 * Builds a mock db object backed by the given store.
 *
 * Supports the subset of Drizzle ORM used by the application:
 *   db.select().from(table).where(...)
 *   db.insert(table).values(data).returning()
 *   db.update(table).set(data).where(...)
 *   db.delete(table).where(...)
 *
 * The `table` argument is matched by its `._.name` (Drizzle internal) or by
 * a convention derived from the variable name.
 */
export function createTestDb(store: InMemoryStore) {
  function resolveTableName(table: any): keyof InMemoryStore | null {
    const name: string | undefined = table?._.name ?? table?.[Symbol.for("drizzle:Name")];
    if (!name) return null;
    // Map Postgres table names to store keys
    const map: Record<string, keyof InMemoryStore> = {
      users: "users",
      photos: "photos",
      albums: "albums",
      album_photos: "albumPhotos",
      faces: "faces",
      people: "people",
      shared_albums: "sharedAlbums",
      memories: "memories",
      smart_albums: "smartAlbums",
      backup_queue: "backupQueue",
      user_devices: "userDevices",
      storage_usage: "storageUsage",
    };
    return map[name] ?? null;
  }

  function getCollection(table: any): Record<string, any> {
    const key = resolveTableName(table);
    if (key && key in store) {
      return store[key];
    }
    return {};
  }

  const db = {
    // ──── SELECT ────
    select: vi.fn(() => ({
      from: vi.fn((table: any) => {
        const rows = Object.values(getCollection(table));
        const result = Object.assign(Promise.resolve(rows), {
          where: vi.fn((_condition: any) => {
            // Return full row set (callers further filter in tests as needed)
            return Object.assign(Promise.resolve(rows), {
              limit: vi.fn((n: number) => Promise.resolve(rows.slice(0, n))),
              orderBy: vi.fn(() => Promise.resolve(rows)),
            });
          }),
          innerJoin: vi.fn((_joinTable: any) => ({
            where: vi.fn((_condition: any) =>
              Object.assign(Promise.resolve(rows), {
                orderBy: vi.fn(() => Promise.resolve(rows)),
                limit: vi.fn((n: number) => Promise.resolve(rows.slice(0, n))),
              }),
            ),
          })),
          orderBy: vi.fn(() => Promise.resolve(rows)),
          limit: vi.fn((n: number) => Promise.resolve(rows.slice(0, n))),
          groupBy: vi.fn(() => Promise.resolve(rows)),
        });
        return result;
      }),
    })),

    // ──── INSERT ────
    insert: vi.fn((table: any) => ({
      values: vi.fn((data: any | any[]) => {
        const key = resolveTableName(table);
        const items = Array.isArray(data) ? data : [data];
        const inserted: any[] = [];

        for (const item of items) {
          const id = item.id ?? nextStoreId("ins");
          const record = { ...item, id };
          if (key && key in store) {
            (store[key] as Record<string, any>)[id] = record;
          }
          inserted.push(record);
        }

        return {
          returning: vi.fn(() => Promise.resolve(inserted)),
        };
      }),
    })),

    // ──── UPDATE ────
    update: vi.fn((table: any) => ({
      set: vi.fn((data: any) => ({
        where: vi.fn((_condition: any) => {
          // For simplicity, update all rows in the table
          const key = resolveTableName(table);
          if (key && key in store) {
            for (const id of Object.keys((store[key] as Record<string, any>))) {
              (store[key] as Record<string, any>)[id] = {
                ...(store[key] as Record<string, any>)[id],
                ...data,
              };
            }
          }
          return Promise.resolve([]);
        }),
      })),
    })),

    // ──── DELETE ────
    delete: vi.fn((table: any) => ({
      where: vi.fn((_condition: any) => {
        const key = resolveTableName(table);
        if (key && key in store) {
          // For simplicity, clear all rows (tests that need selective deletes
          // should use populateStore to rebuild state after a targeted delete)
          for (const id of Object.keys((store[key] as Record<string, any>))) {
            delete (store[key] as Record<string, any>)[id];
          }
        }
        return Promise.resolve([]);
      }),
    })),

    // ──── TRANSACTION ────
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      return fn(db);
    }),
  };

  return db;
}

// ─────────────────────────────────────────────────────────
// VITEST LIFECYCLE HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Creates a test database with isolated state for use in a describe block.
 *
 * Usage:
 *   const { getDb, getStore, resetStore } = setupIsolatedTestDb();
 *
 *   it('should insert a user', async () => {
 *     const db = getDb();
 *     await db.insert(users).values({ username: 'alice', password: 'hash' });
 *     expect(getStore().users).toHaveProperty(expect.any(String));
 *   });
 */
export function setupIsolatedTestDb() {
  let store = createEmptyStore();
  let db = createTestDb(store);

  beforeEach(() => {
    store = createEmptyStore();
    db = createTestDb(store);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  return {
    getDb: () => db,
    getStore: () => store,
    resetStore: () => {
      store = createEmptyStore();
      db = createTestDb(store);
    },
  };
}

/**
 * Seeds all standard tables with the provided records.
 * Prefer populateStore() for direct store manipulation.
 * This function is kept for API compatibility.
 */
export async function seedDatabase(
  _db: ReturnType<typeof createTestDb>,
  _seed: Partial<InMemoryStore>,
): Promise<void> {
  // No-op: use populateStore() with getStore() instead for direct seed control
}

/**
 * Directly populates an InMemoryStore without going through the ORM mock.
 * Prefer this for test setup – the mock ORM is tested separately.
 */
export function populateStore(
  store: InMemoryStore,
  data: Partial<{
    users: any[];
    photos: any[];
    albums: any[];
    albumPhotos: any[];
    faces: any[];
    people: any[];
    sharedAlbums: any[];
    memories: any[];
    smartAlbums: any[];
    backupQueue: any[];
    userDevices: any[];
    storageUsage: any[];
  }>,
): void {
  for (const [key, rows] of Object.entries(data)) {
    if (!rows) continue;
    const collection = (store as any)[key] as Record<string, any>;
    for (const row of rows) {
      if (row && typeof row === "object") {
        const id = row.id ?? nextStoreId("seed");
        collection[id] = { ...row, id };
      }
    }
  }
}

/**
 * Clears a specific table within the store.
 */
export function clearTable(store: InMemoryStore, tableName: keyof InMemoryStore): void {
  store[tableName] = {} as any;
}

/**
 * Returns all rows in a store table as an array.
 */
export function getRows<T = any>(store: InMemoryStore, tableName: keyof InMemoryStore): T[] {
  return Object.values((store as any)[tableName]) as T[];
}
