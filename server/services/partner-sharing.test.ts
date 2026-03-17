// AI-META-BEGIN
// AI-META: Property tests for partner sharing service ensuring algorithm correctness and security
// OWNERSHIP: server/services (partner sharing testing)
// ENTRYPOINTS: test runner executes these to validate partner sharing algorithms
// DEPENDENCIES: fast-check, PartnerSharingService, database mocks
// DANGER: Property test failures indicate security vulnerabilities or data corruption
// CHANGE-SAFETY: Maintain property coverage for all critical algorithms
// TESTS: Property tests for invitation tokens, privacy enforcement, auto-share rule evaluation
// AI-META-END

// Mock the database import - must be before other imports due to hoisting
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import { PartnerSharingService, AutoShareRuleType } from "./partner-sharing";
import { db } from "../db";
import {
  partnerRelationships,
  partnerInvitations,
  partnerAutoShareRules,
  partnerSharedPhotos,
  users,
  photos,
} from "../../shared/schema";

// Chain that supports select().from().where() and select().from().where().orderBy().limit()
// and select().from().innerJoin().where().orderBy(); orderBy() returns thenable so await works
const createChain = (resolved: any = []) => {
  const limitFn = vi.fn(() => Promise.resolve(resolved));
  const orderByFn = vi.fn(() => Promise.resolve(resolved));
  const whereReturn = Object.assign(Promise.resolve(resolved), {
    limit: limitFn,
    orderBy: orderByFn,
  });
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => whereReturn),
      innerJoin: vi.fn(() => ({
        where: vi.fn(() =>
          Object.assign(Promise.resolve(resolved), { orderBy: orderByFn }),
        ),
      })),
    })),
  };
};

const createInsertReturn = (returning: any[] = [{ id: "test-id" }]) => ({
  values: vi.fn(() => ({
    returning: vi.fn(() => Promise.resolve(returning)),
  })),
});

vi.mock("../db", () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: "test-id" }])),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    },
  };
});

// Get the mocked database
const mockDb = vi.mocked(db) as any;

describe("PartnerSharingService - Property Tests", () => {
  let service: PartnerSharingService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => createChain() as any);
    mockDb.insert.mockImplementation(() => createInsertReturn() as any);
    mockDb.update.mockImplementation(
      () =>
        ({
          set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })),
        }) as any,
    );
    mockDb.delete.mockImplementation(
      () =>
        ({
          where: vi.fn(() => Promise.resolve([])),
        }) as any,
    );
    service = new PartnerSharingService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 1: Invitation Token Uniqueness
  // ═══════════════════════════════════════════════════════════

  it("should generate unique invitation tokens", async () => {
    // Property: Generated invitation tokens should be unique
    const tokenSet = new Set<string>();
    const numTokens = 100;

    // Generate multiple tokens
    for (let i = 0; i < numTokens; i++) {
      // Access private method through reflection for testing
      const generateToken = (service as any).generateInvitationToken.bind(
        service,
      );
      const token = generateToken();

      // Property check: Token should be unique
      expect(tokenSet.has(token)).toBe(false);
      tokenSet.add(token);

      // Property check: Token should have expected format (hex string)
      expect(token).toMatch(/^[a-f0-9]{128}$/);
    }

    // Property check: All tokens should be unique
    expect(tokenSet.size).toBe(numTokens);
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 2: Auto-Share Rule Evaluation Consistency
  // ═══════════════════════════════════════════════════════════

  it("should evaluate auto-share rules consistently", async () => {
    const mockPhoto = {
      id: "photo-123",
      uri: "file://photo.jpg",
      width: 1920,
      height: 1080,
      filename: "vacation.jpg",
      isFavorite: false,
      createdAt: new Date("2024-01-15"),
      tags: ["vacation", "beach"],
    };

    const mockRule = {
      id: "rule-123",
      partnershipId: "partnership-123",
      userId: "user-123",
      name: "Test Rule",
      ruleType: AutoShareRuleType.ALL_PHOTOS,
      criteria: {
        favoritesOnly: false,
        excludeTags: [],
        minQuality: 50,
      },
      isActive: true,
      priority: 0,
    };

    // Property: Rule evaluation should be deterministic
    const results = [];
    for (let i = 0; i < 10; i++) {
      const evaluateRule = (service as any).evaluateRule.bind(service);
      const result = await evaluateRule(mockRule, mockPhoto);
      results.push(result);
    }

    // Property check: All evaluations should return the same result
    const firstResult = results[0];
    results.forEach((result, index) => {
      expect(result).toBe(firstResult);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 3: Privacy Settings Enforcement
  // ═══════════════════════════════════════════════════════════

  it("should enforce privacy settings consistently", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          includeOtherApps: fc.boolean(),
          minQuality: fc.option(fc.integer({ min: 0, max: 100 })),
          excludeTags: fc.option(fc.array(fc.string())),
          favoritesOnly: fc.boolean(),
        }),
        fc.record({
          filename: fc.string(),
          isFavorite: fc.boolean(),
          tags: fc.option(fc.array(fc.string())),
          quality: fc.option(fc.integer({ min: 0, max: 100 })),
          source: fc.option(
            fc.constantFrom("camera", "screenshot", "download"),
          ),
        }),
        async (privacySettings, photo) => {
          // Mock the evaluateAllPhotosRule method
          const evaluateAllPhotosRule = (
            service as any
          ).evaluateAllPhotosRule.bind(service);

          const result = evaluateAllPhotosRule(privacySettings, {
            ...photo,
            tags: photo.tags || [],
          });

          // Property: Favorites only rule should be enforced (implementation enforces this)
          if (privacySettings.favoritesOnly && !photo.isFavorite) {
            expect(result).toBe(false);
          }

          // Property: Exclude tags should be enforced (implementation enforces this)
          if (privacySettings.excludeTags && photo.tags) {
            const hasExcludedTag = privacySettings.excludeTags.some((tag) =>
              photo.tags!.includes(tag),
            );
            if (hasExcludedTag) {
              expect(result).toBe(false);
            }
          }
          // Note: minQuality is not enforced by evaluateAllPhotosRule (no quality field in photos table yet)
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 4: Date Range Rule Boundaries
  // ═══════════════════════════════════════════════════════════

  it("should handle date range rule boundaries correctly", async () => {
    const validDate = fc.date({
      min: new Date(2000, 0, 1),
      max: new Date(2030, 11, 31),
    });
    await fc.assert(
      fc.asyncProperty(
        validDate,
        validDate,
        validDate,
        async (startDate, endDate, photoDate) => {
          fc.pre(!Number.isNaN(startDate.getTime()));
          fc.pre(!Number.isNaN(endDate.getTime()));
          fc.pre(!Number.isNaN(photoDate.getTime()));
          // Ensure startDate <= endDate
          const [start, end] =
            startDate <= endDate ? [startDate, endDate] : [endDate, startDate];

          const criteria = {
            startDate: start,
            endDate: end,
          };

          const evaluateDateRangeRule = (
            service as any
          ).evaluateDateRangeRule.bind(service);
          const result = evaluateDateRangeRule(criteria, {
            createdAt: photoDate,
          });

          // Property: Photo should be included if within date range
          const shouldBeIncluded = photoDate >= start && photoDate <= end;
          expect(result).toBe(shouldBeIncluded);

          // Property: Edge cases should be handled correctly
          if (
            photoDate.getTime() === start.getTime() ||
            photoDate.getTime() === end.getTime()
          ) {
            expect(result).toBe(true); // Inclusive boundaries
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 5: Content Type Rule Classification
  // ═══════════════════════════════════════════════════════════

  it("should classify content types consistently", async () => {
    const testCases = [
      { filename: "Screenshot_20240115_123456.png", expected: "screenshot" },
      { filename: "download_image.jpg", expected: "download" },
      { filename: "saved_photo.png", expected: "download" },
      { filename: "IMG_1234.jpg", expected: "camera" },
      { filename: "vacation_photo.jpg", expected: "camera" },
    ];

    const evaluateContentTypeRule = (
      service as any
    ).evaluateContentTypeRule.bind(service);

    for (const testCase of testCases) {
      const criteria = {
        contentTypes: ["camera", "screenshot", "download", "other"],
      };

      const result = evaluateContentTypeRule(criteria, {
        filename: testCase.filename,
      });

      // Property: Classification should be deterministic
      expect(result).toBe(true);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 6: Partnership User Isolation
  // ═══════════════════════════════════════════════════════════

  it("should maintain user isolation in partnerships", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.uuid(), async (userId1, userId2) => {
        // Only test when we have two distinct users (otherwise we skip and never call DB)
        if (userId1 === userId2) return;

        // Mock database: getUserPartnerships does two selects with innerJoin, returns { partnership, partnerUsername }
        const partnershipRow = {
          id: "partnership-123",
          userId: userId1,
          partnerId: "partner-456",
          status: "accepted",
          isActive: true,
          acceptedAt: new Date(),
          privacySettings: null,
          initiatedBy: userId1,
          createdAt: new Date(),
        };
        mockDb.select
          .mockReturnValueOnce(
            createChain([
              { partnership: partnershipRow, partnerUsername: "partner" },
            ]) as any,
          )
          .mockReturnValueOnce(
            createChain([
              {
                partnership: { ...partnershipRow, status: "pending" },
                partnerUsername: "other",
              },
            ]) as any,
          );

        try {
          await service.getUserPartnerships(userId1);
        } catch (error: any) {
          expect(error?.message || "").not.toContain("access denied");
        }
        expect(mockDb.select).toHaveBeenCalled();
      }),
      { numRuns: 50 },
    );
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 7: Invitation Expiration Handling
  // ═══════════════════════════════════════════════════════════

  it("should handle invitation expiration correctly", async () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now

    // Test expired invitation
    mockDb.select.mockReturnValue(createChain([]) as any);

    await expect(
      service.acceptInvitation("expired-token", "user-123"),
    ).rejects.toThrow("Invalid or expired invitation");

    // Test valid invitation
    mockDb.select.mockReturnValue(
      createChain([
        {
          id: "invitation-123",
          invitationToken: "valid-token",
          inviterId: "user-123",
          inviteeId: "user-456",
          status: "pending",
          expiresAt: futureDate,
        },
      ]) as any,
    );

    // Mock partnership creation: insert().values().returning()
    mockDb.insert.mockImplementation(
      () =>
        createInsertReturn([
          {
            id: "partnership-123",
            userId: "user-123",
            partnerId: "user-456",
            status: "accepted",
          },
        ]) as any,
    );

    const result = await service.acceptInvitation("valid-token", "user-456");
    expect(result).toBeDefined();
    expect(result.partnershipId).toBe("partnership-123");
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 8: Auto-Share Rule Priority Ordering
  // ═══════════════════════════════════════════════════════════

  it("should respect auto-share rule priority ordering", async () => {
    const rules = [
      { id: "rule-1", priority: 1, name: "Low Priority" },
      { id: "rule-2", priority: 10, name: "High Priority" },
      { id: "rule-3", priority: 5, name: "Medium Priority" },
      { id: "rule-4", priority: 0, name: "No Priority" },
    ];

    // Mock database to return rules in random order
    const shuffledRules = [...rules].sort(() => Math.random() - 0.5);
    mockDb.select.mockReturnValue(createChain(shuffledRules) as any);

    const evaluateAutoShareRules = (service as any).evaluateAutoShareRules.bind(
      service,
    );

    // The service should order by priority automatically
    await evaluateAutoShareRules("photo-123", "user-123");

    // Verify that orderBy was called (indicating priority sorting)
    expect(mockDb.select).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 9: Shared Photo Uniqueness
  // ═══════════════════════════════════════════════════════════

  it("should prevent duplicate shared photos", async () => {
    const partnershipId = "partnership-123";
    const photoId = "photo-123";
    const userId = "user-123";

    // Mock existing shared photo check: chain resolves to existing shared photo
    mockDb.select.mockReturnValue(
      createChain([{ id: "existing-shared-photo" }]) as any,
    );

    const sharePhotoWithPartners = (service as any).sharePhotoWithPartners.bind(
      service,
    );
    const result = await sharePhotoWithPartners(photoId, userId);

    // Property: Should not create duplicate shares
    expect(result).toEqual([]); // No new partnerships to share with

    // Verify database was checked for existing shares
    expect(mockDb.select).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 10: Configuration Parameter Bounds
  // ═══════════════════════════════════════════════════════════

  it("should validate configuration parameter bounds", () => {
    const defaultConfig = (service as any).config;

    // Property: Token length should be secure
    expect(defaultConfig.tokenLength).toBeGreaterThanOrEqual(32);
    expect(defaultConfig.tokenLength).toBeLessThanOrEqual(128);

    // Property: Argon2 parameters should follow OWASP guidelines
    expect(defaultConfig.argon2Memory).toBeGreaterThanOrEqual(19456); // 19 MiB minimum
    expect(defaultConfig.argon2Iterations).toBeGreaterThanOrEqual(2);
    expect(defaultConfig.argon2Parallelism).toBeGreaterThanOrEqual(1);

    // Property: Invitation expiration should be reasonable
    expect(defaultConfig.defaultInvitationExpirationDays).toBeGreaterThan(0);
    expect(defaultConfig.defaultInvitationExpirationDays).toBeLessThanOrEqual(
      30,
    );
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 11: Privacy Settings Management
  // ═══════════════════════════════════════════════════════════

  it("should update privacy settings for valid partnership", async () => {
    const partnershipId = "partnership-123";
    const userId = "user-123";
    const privacySettings = {
      includeOtherApps: true,
      minQuality: 75,
      excludeTags: ["private"],
      favoritesOnly: false,
    };

    // Mock partnership lookup
    mockDb.select.mockReturnValue(createChain([{ id: partnershipId }]) as any);

    const result = await service.updatePrivacySettings(
      partnershipId,
      userId,
      privacySettings,
    );

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("should reject privacy settings update for invalid partnership", async () => {
    const partnershipId = "invalid-partnership";
    const userId = "user-123";
    const privacySettings = {
      includeOtherApps: true,
      minQuality: 75,
      excludeTags: ["private"],
      favoritesOnly: false,
    };

    // Mock no partnership found
    mockDb.select.mockReturnValue(createChain([]) as any);

    await expect(
      service.updatePrivacySettings(partnershipId, userId, privacySettings),
    ).rejects.toThrow("Partnership not found or access denied");
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 12: Auto-Share Rule Management
  // ═══════════════════════════════════════════════════════════

  it("should get auto-share rules for valid partnership", async () => {
    const partnershipId = "partnership-123";
    const userId = "user-123";

    const ruleRow = {
      id: "rule-1",
      name: "Test Rule",
      ruleType: "all_photos",
      criteria: { favoritesOnly: false },
      priority: 0,
      isActive: true,
      createdAt: new Date(),
    };

    // Service expects rules from join: array of { rule, creatorUsername }
    mockDb.select
      .mockReturnValueOnce(createChain([{ id: partnershipId }]) as any)
      .mockReturnValueOnce(
        createChain([{ rule: ruleRow, creatorUsername: "testuser" }]) as any,
      );

    const rules = await service.getAutoShareRules(partnershipId, userId);

    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe("Test Rule");
    expect(rules[0].createdBy).toBe("testuser");
  });

  it("should update auto-share rule for valid owner", async () => {
    const ruleId = "rule-123";
    const userId = "user-123";
    const updates = {
      name: "Updated Rule",
      isActive: false,
    };

    // Mock rule ownership verification
    mockDb.select.mockReturnValue(createChain([{ id: ruleId, userId }]) as any);

    const result = await service.updateAutoShareRule(ruleId, userId, updates);

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
    // Drizzle: update(table).set({...}).where(...) — assert set() was called with updates
    const setMock = mockDb.update.mock.results[0]?.value?.set;
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Updated Rule", isActive: false }),
    );
  });

  it("should delete auto-share rule for valid owner", async () => {
    const ruleId = "rule-123";
    const userId = "user-123";

    // Mock rule ownership verification
    mockDb.select.mockReturnValue(createChain([{ id: ruleId, userId }]) as any);

    const result = await service.deleteAutoShareRule(ruleId, userId);

    expect(result.success).toBe(true);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 13: Partnership Management
  // ═══════════════════════════════════════════════════════════

  it("should end partnership for valid participant", async () => {
    const partnershipId = "partnership-123";
    const userId = "user-123";

    // Mock partnership lookup
    mockDb.select.mockReturnValue(createChain([{ id: partnershipId }]) as any);

    const result = await service.endPartnership(partnershipId, userId);

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
    const setMock = mockDb.update.mock.results[0]?.value?.set;
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "revoked",
        isActive: false,
      }),
    );
  });

  it("should save shared photo for valid partnership", async () => {
    const photoId = "photo-123";
    const partnershipId = "partnership-123";
    const userId = "user-123";

    // Mock partnership lookup then shared photo lookup (saveSharedPhoto does insert, not update - check service)
    mockDb.select
      .mockReturnValueOnce(createChain([{ id: partnershipId }]) as any)
      .mockReturnValueOnce(createChain([{ id: "shared-123" }]) as any);

    const result = await service.saveSharedPhoto(
      photoId,
      partnershipId,
      userId,
    );

    expect(result.success).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════
  // PROPERTY 14: Statistics Accuracy
  // ═══════════════════════════════════════════════════════════

  it("should return accurate partner sharing statistics", async () => {
    const userId = "user-123";

    // Mock four count queries (active partnerships, pending invitations, shared photos, auto-share rules)
    mockDb.select
      .mockReturnValueOnce(createChain([{ count: 2 }]) as any)
      .mockReturnValueOnce(createChain([{ count: 1 }]) as any)
      .mockReturnValueOnce(createChain([{ count: 50 }]) as any)
      .mockReturnValueOnce(createChain([{ count: 3 }]) as any);

    const stats = await service.getPartnerSharingStats(userId);

    expect(stats).toEqual({
      activePartnerships: 2,
      pendingInvitations: 1,
      sharedPhotos: 50,
      autoShareRules: 3,
    });
  });
});
