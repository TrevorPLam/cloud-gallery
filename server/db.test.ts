/**
 * Database Module Integration Tests (server/db.ts)
 *
 * Tests the database connection module in isolation:
 *  - isDbConfigured flag under different environment conditions
 *  - testConnection() success and failure paths
 *  - The disabledDb proxy throws descriptive errors
 *  - Client export is null when database is disabled
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Import db module in a fresh module scope with custom environment.
 * Vitest caches modules; vi.resetModules() clears the cache before each call.
 */
async function importDbModule(env: Record<string, string | undefined>) {
  vi.resetModules();

  // Patch environment before importing so the module reads the desired values.
  // We must explicitly delete undefined-valued keys rather than assigning
  // undefined (which would stringify to "undefined" in process.env).
  const originalEnv: Record<string, string | undefined> = {};
  const keysToRestore: string[] = [];

  for (const [key, value] of Object.entries(env)) {
    originalEnv[key] = process.env[key];
    keysToRestore.push(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    const mod = await import("./db");
    return mod;
  } finally {
    // Restore original environment
    for (const key of keysToRestore) {
      const original = originalEnv[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────
// isDbConfigured
// ─────────────────────────────────────────────────────────

describe("isDbConfigured", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("is false when DATABASE_URL is not set", async () => {
    const { isDbConfigured } = await importDbModule({
      DATABASE_URL: undefined,
      DISABLE_DB: undefined,
    });
    expect(isDbConfigured).toBe(false);
  });

  it("is false when DISABLE_DB=true even with DATABASE_URL", async () => {
    const { isDbConfigured } = await importDbModule({
      DATABASE_URL: "postgres://localhost:5432/test",
      DISABLE_DB: "true",
    });
    expect(isDbConfigured).toBe(false);
  });

  it("is false when DISABLE_DB=1 even with DATABASE_URL", async () => {
    const { isDbConfigured } = await importDbModule({
      DATABASE_URL: "postgres://localhost:5432/test",
      DISABLE_DB: "1",
    });
    expect(isDbConfigured).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// DISABLED DB PROXY
// ─────────────────────────────────────────────────────────

describe("disabled db proxy", () => {
  it("throws a descriptive error when db is accessed without DATABASE_URL", async () => {
    const { db } = await importDbModule({
      DATABASE_URL: undefined,
      DISABLE_DB: undefined,
    });

    expect(() => (db as any).select).toThrow(
      "Database is disabled because DATABASE_URL is not set",
    );
  });

  it("throws when accessing any property on the disabled proxy", async () => {
    const { db } = await importDbModule({
      DATABASE_URL: undefined,
    });

    expect(() => (db as any).insert).toThrow();
    expect(() => (db as any).update).toThrow();
    expect(() => (db as any).delete).toThrow();
    expect(() => (db as any).query).toThrow();
  });
});

// ─────────────────────────────────────────────────────────
// client EXPORT
// ─────────────────────────────────────────────────────────

describe("client export", () => {
  it("is null when database is disabled", async () => {
    const { client } = await importDbModule({
      DATABASE_URL: undefined,
    });
    expect(client).toBeNull();
  });

  it("is null when DISABLE_DB=1", async () => {
    const { client } = await importDbModule({
      DATABASE_URL: "postgres://localhost:5432/test",
      DISABLE_DB: "1",
    });
    expect(client).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────
// testConnection()
// ─────────────────────────────────────────────────────────

describe("testConnection()", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns false and warns when DATABASE_URL is not set", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { testConnection } = await importDbModule({ DATABASE_URL: undefined });
    const result = await testConnection();
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("DATABASE_URL"),
    );
    warnSpy.mockRestore();
  });

  it("returns false and warns when DISABLE_DB=1", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { testConnection } = await importDbModule({
      DATABASE_URL: "postgres://localhost:5432/test",
      DISABLE_DB: "1",
    });
    const result = await testConnection();
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("disabled"),
    );
    warnSpy.mockRestore();
  });
});
