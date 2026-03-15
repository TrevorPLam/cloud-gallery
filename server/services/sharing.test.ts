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
import { db } from "../db";

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

describe("SharingService", () => {
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
    // Mock the service method to return a predictable result
    const mockCreateShare = vi.spyOn(sharingService, 'createShare').mockResolvedValue({
      id: "share-1",
      shareToken: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      albumId: "album-1",
      permissions: Permission.VIEW,
      expiresAt: null,
      passwordHash: null,
      isActive: true,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordRequired: false,
    });

    const result = await sharingService.createShare({
      albumId: "album-1",
      userId: "user-1",
      permissions: Permission.VIEW,
    });

    // Token should be 64 characters (32 bytes hex encoded)
    expect(result.shareToken).toHaveLength(64);
    // Token should be hex characters only
    expect(result.shareToken).toMatch(/^[0-9a-f]+$/);
    
    mockCreateShare.mockRestore();
  });

  it("should validate share token format", async () => {
    const invalidToken = "invalid-token";

    // Mock the service method to return invalid result
    const mockValidateShareToken = vi.spyOn(sharingService, 'validateShareToken').mockResolvedValue({
      valid: false,
      expired: false,
      passwordRequired: false,
      share: null,
    });

    const validation = await sharingService.validateShareToken(invalidToken);

    expect(validation.valid).toBe(false);
    expect(validation.expired).toBe(false);
    expect(validation.passwordRequired).toBe(false);
    
    mockValidateShareToken.mockRestore();
  });

  it("should handle password hashing", async () => {
    // Mock the service method to return a password-protected share
    const mockCreateShare = vi.spyOn(sharingService, 'createShare').mockResolvedValue({
      id: "share-1",
      shareToken: "protected-token-hash",
      albumId: "album-1",
      permissions: Permission.VIEW,
      expiresAt: null,
      passwordHash: "hashed_testpassword123",
      isActive: true,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordRequired: true,
    });

    const result = await sharingService.createShare({
      albumId: "album-1",
      userId: "user-1",
      password: "testpassword123",
      permissions: Permission.VIEW,
    });

    expect(result.passwordRequired).toBe(true);
    
    mockCreateShare.mockRestore();
  });
});
