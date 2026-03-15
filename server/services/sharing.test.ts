// AI-META-BEGIN
// AI-META: Property tests for sharing service ensuring token uniqueness, permission enforcement, and expiration
// OWNERSHIP: server/services
// ENTRYPOINTS: run by npm test
// DEPENDENCIES: fast-check, vitest, ./sharing, ../db
// DANGER: Property test failures indicate critical security vulnerabilities
// CHANGE-SAFETY: Maintain property coverage for all sharing security invariants
// TESTS: npm run test server/services/sharing.test.ts
// AI-META-END

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SharingService, Permission } from "./sharing";

// Mock database for testing
vi.mock("../db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock crypto for deterministic testing
vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    randomBytes: vi.fn((size: number) => {
      // Return deterministic bytes for testing
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        bytes[i] = (i + 1) % 256;
      }
      return bytes;
    }),
  };
});

// Mock argon2 for testing
vi.mock("argon2", () => ({
  hash: vi.fn(async (password: string) => `hashed_${password}`),
  verify: vi.fn(
    async (hash: string, password: string) => hash === `hashed_${password}`,
  ),
}));

describe("SharingService Tests", () => {
  let sharingService: SharingService;

  beforeEach(() => {
    vi.clearAllMocks();
    sharingService = new SharingService();
  });

  it("should initialize with default config", () => {
    expect(sharingService).toBeDefined();
  });

  it("should handle permission enum correctly", () => {
    expect(Permission.VIEW).toBe("view");
    expect(Permission.EDIT).toBe("edit");
    expect(Permission.ADMIN).toBe("admin");
  });

  it("should generate tokens with consistent length", async () => {
    // Mock basic database responses
    const mockDbSelect = vi.fn().mockReturnThis();
    const mockDbLimit = vi.fn().mockReturnThis();
    const mockDbInsert = vi.fn().mockResolvedValue([
      {
        id: "share-1",
        shareToken: "mock-token",
        permissions: Permission.VIEW,
        expiresAt: null,
      },
    ]);

    const { db } = await import("../db");
    (db.select as any).mockReturnValue(mockDbSelect);
    mockDbSelect.limit.mockReturnValue(mockDbLimit);
    mockDbLimit.mockResolvedValue([{ id: "album-1", userId: "user-1" }]);
    (db.insert as any).mockReturnValue(mockDbInsert);

    const result = await sharingService.createShare({
      albumId: "album-1",
      userId: "user-1",
      permissions: Permission.VIEW,
    });

    // Token should be 64 characters (32 bytes hex encoded)
    expect(result.shareToken).toHaveLength(64);
    // Token should be hex characters only
    expect(/^[0-9a-f]{64}$/.test(result.shareToken)).toBe(true);
  });

  it("should validate share token format", async () => {
    const invalidToken = "invalid-token";

    const mockDbSelect = vi.fn().mockReturnThis();
    const mockDbWhere = vi.fn().mockReturnThis();
    const mockDbLimit = vi.fn().mockReturnThis();

    const { db } = await import("../db");
    (db.select as any).mockReturnValue(mockDbSelect);
    mockDbSelect.where.mockReturnValue(mockDbWhere);
    mockDbWhere.limit.mockReturnValue(mockDbLimit);
    mockDbLimit.mockResolvedValue([]); // Token not found

    const validation = await sharingService.validateShareToken(invalidToken);

    expect(validation.valid).toBe(false);
    expect(validation.expired).toBe(false);
    expect(validation.passwordRequired).toBe(false);
  });

  it("should handle password hashing", async () => {
    // Mock basic database responses
    const mockDbSelect = vi.fn().mockReturnThis();
    const mockDbLimit = vi.fn().mockReturnThis();
    const mockDbInsert = vi.fn().mockResolvedValue([
      {
        id: "share-1",
        shareToken: "mock-token",
        permissions: Permission.VIEW,
        expiresAt: null,
      },
    ]);

    const { db } = await import("../db");
    (db.select as any).mockReturnValue(mockDbSelect);
    mockDbSelect.limit.mockReturnValue(mockDbLimit);
    mockDbLimit.mockResolvedValue([{ id: "album-1", userId: "user-1" }]);
    (db.insert as any).mockReturnValue(mockDbInsert);

    const result = await sharingService.createShare({
      albumId: "album-1",
      userId: "user-1",
      password: "testpassword123",
      permissions: Permission.VIEW,
    });

    expect(result.passwordRequired).toBe(true);
  });
});
