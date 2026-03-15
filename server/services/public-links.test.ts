// AI-META-BEGIN
// AI-META: Property tests for public links service validating token uniqueness, access control, and rate limiting
// OWNERSHIP: server/services
// ENTRYPOINTS: run with npm test server/services/public-links.test.ts
// DEPENDENCIES: vitest, fast-check, drizzle-orm, ./public-links, ./db
// DANGER: Test database isolation failure = cross-test contamination; mock failure = false positives
// CHANGE-SAFETY: Maintain test isolation, property boundaries, and edge case coverage
// TESTS: npm run test server/services/public-links.test.ts
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import { PublicLinksService } from "./public-links";
import { db } from "../db";
import { users, albums, albumPhotos } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { createSelectChain } from "../test-utils/drizzle-mock";

// Share result for createShare mock (unique per call)
const createMockShareResult = () => ({
  id: `share-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  shareToken: randomBytes(32).toString("hex"),
  expiresAt: null as Date | null,
  passwordRequired: false,
});

vi.mock("./sharing", () => ({
  sharingService: {
    createShare: vi.fn(),
    accessSharedAlbum: vi.fn(),
    validateShareToken: vi.fn(),
    updateShare: vi.fn(),
    getUserSharedAlbums: vi.fn(),
  },
  Permission: { VIEW: "view" },
}));

vi.mock("../db", () => {
  const userRow = { id: "user-1", username: "test-user" };
  const albumRow = {
    id: "album-1",
    userId: "user-1",
    title: "Test Album",
    description: "Test album for public links",
  };
  let insertCall = 0;
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            insertCall += 1;
            return Promise.resolve(insertCall === 1 ? [userRow] : [albumRow]);
          }),
        }),
      })),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    },
  };
});

import { sharingService } from "./sharing";

describe("PublicLinksService Property Tests", () => {
  let service: PublicLinksService;
  let testUser: any;
  let testAlbum: any;

  beforeEach(async () => {
    vi.mocked(db.select).mockReturnValue(createSelectChain([]) as any);
    // Create test user and album for testing (mock insert returns user then album)
    testUser = await db
      .insert(users)
      .values({
        username: `test-user-${Date.now()}`,
        password: "hashed-password",
      })
      .returning()
      .then((result) => result[0]);

    testAlbum = await db
      .insert(albums)
      .values({
        userId: testUser.id,
        title: "Test Album",
        description: "Test album for public links",
      })
      .returning()
      .then((result) => result[0]);

    // Album lookup and createShare are used by createPublicLink
    vi.mocked(db.select).mockReturnValue(
      createSelectChain([testAlbum]) as any,
    );
    vi.mocked(sharingService.createShare).mockImplementation((opts: any) =>
      Promise.resolve({
        ...createMockShareResult(),
        passwordRequired: !!opts?.password,
      }),
    );
    vi.mocked(sharingService.accessSharedAlbum).mockResolvedValue({
      share: { id: "s1", albumId: testAlbum.id, viewCount: 0 },
      album: { id: testAlbum.id, title: "Test Album", createdAt: new Date() },
      photos: [],
    });
    vi.mocked(sharingService.validateShareToken).mockResolvedValue({
      valid: true,
      expired: false,
      passwordRequired: false,
    });
    vi.mocked(sharingService.updateShare).mockResolvedValue({} as any);
    service = new PublicLinksService();
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(albumPhotos).where(eq(albumPhotos.albumId, testAlbum.id));
    await db.delete(albums).where(eq(albums.id, testAlbum.id));
    await db.delete(users).where(eq(users.id, testUser.id));

    // Clear rate limit tracker
    (service as any).cleanupRateLimit();
  });

  describe("Token Generation Properties", () => {
    it("Property 1: Token uniqueness - Generated tokens should be unique", async () => {
      const tokenSet = new Set<string>();
      const tokenCount = 100;

      // Generate multiple tokens
      for (let i = 0; i < tokenCount; i++) {
        const token = (service as any).generatePublicToken();
        expect(token).toMatch(/^[a-f0-9]{64}$/); // 64 hex chars
        expect(tokenSet.has(token)).toBe(false);
        tokenSet.add(token);
      }

      expect(tokenSet.size).toBe(tokenCount);
    });

    it("Property 2: Token entropy - Tokens should have sufficient entropy", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (count) => {
          const tokens = Array.from({ length: count }, () =>
            (service as any).generatePublicToken(),
          );

          // All tokens should be different
          const uniqueTokens = new Set(tokens);
          expect(uniqueTokens.size).toBe(count);

          // All tokens should be valid hex
          tokens.forEach((token) => {
            expect(token).toMatch(/^[a-f0-9]{64}$/);
          });
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("Rate Limiting Properties", () => {
    it("Property 1: Rate limit enforcement - Should block excessive requests", () => {
      const testIp = "192.168.1.100";
      const config = { rateLimitPerMinute: 5 };
      const limitedService = new PublicLinksService(config);

      // First 5 requests should pass
      for (let i = 0; i < 5; i++) {
        expect((limitedService as any).checkRateLimit(testIp)).toBe(true);
      }

      // 6th request should fail
      expect((limitedService as any).checkRateLimit(testIp)).toBe(false);

      // Different IP should still work
      expect((limitedService as any).checkRateLimit("192.168.1.101")).toBe(
        true,
      );
    });

    it("Property 2: Rate limit reset - Should allow requests after time window", () => {
      const testIp = "192.168.1.100";
      const config = { rateLimitPerMinute: 2 };
      const limitedService = new PublicLinksService(config);

      // Use up the rate limit
      expect((limitedService as any).checkRateLimit(testIp)).toBe(true);
      expect((limitedService as any).checkRateLimit(testIp)).toBe(true);
      expect((limitedService as any).checkRateLimit(testIp)).toBe(false);

      // Manually reset the tracker (simulating time passing)
      const tracker = (limitedService as any).rateLimitTracker;
      tracker.set(testIp, { count: 0, resetTime: Date.now() - 1000 });

      // Should work again
      expect((limitedService as any).checkRateLimit(testIp)).toBe(true);
    });

    it("Property 3: Rate limit isolation - Different IPs should have independent limits", () => {
      const config = { rateLimitPerMinute: 3 };
      const limitedService = new PublicLinksService(config);

      const ips = ["192.168.1.100", "192.168.1.101", "192.168.1.102"];

      // Each IP should be able to make the full number of requests
      ips.forEach((ip) => {
        for (let i = 0; i < 3; i++) {
          expect((limitedService as any).checkRateLimit(ip)).toBe(true);
        }
        expect((limitedService as any).checkRateLimit(ip)).toBe(false);
      });
    });
  });

  describe("Public Link Creation Properties", () => {
    it("Property 1: Creation idempotence - Same options should create different links", async () => {
      const options = {
        albumId: testAlbum.id,
        userId: testUser.id,
        allowDownload: true,
        showMetadata: false,
      };

      const link1 = await service.createPublicLink(options);
      const link2 = await service.createPublicLink(options);

      // Should create different links with different tokens
      expect(link1.id).not.toBe(link2.id);
      expect(link1.publicToken).not.toBe(link2.publicToken);
      expect(link1.url).not.toBe(link2.url);

      // But same settings
      expect(link1.allowDownload).toBe(link2.allowDownload);
      expect(link1.showMetadata).toBe(link2.showMetadata);
    });

    it("Property 2: Default values - Should apply sensible defaults", async () => {
      const link = await service.createPublicLink({
        albumId: testAlbum.id,
        userId: testUser.id,
      });

      expect(link.allowDownload).toBe(true);
      expect(link.showMetadata).toBe(false);
      expect(link.url).toBe(`/public/${link.publicToken}`);
      expect(link.passwordRequired).toBe(false);
    });

    it("Property 3: Password protection - Should handle passwords correctly", async () => {
      const linkWithPassword = await service.createPublicLink({
        albumId: testAlbum.id,
        userId: testUser.id,
        password: "test-password-123",
      });

      const linkWithoutPassword = await service.createPublicLink({
        albumId: testAlbum.id,
        userId: testUser.id,
      });

      expect(linkWithPassword.passwordRequired).toBe(true);
      expect(linkWithoutPassword.passwordRequired).toBe(false);
    });
  });

  describe("Public Link Access Properties", () => {
    let publicLink: any;

    beforeEach(async () => {
      publicLink = await service.createPublicLink({
        albumId: testAlbum.id,
        userId: testUser.id,
      });
    });

    it("Property 1: View count increment - Each access should increment view count", async () => {
      vi.mocked(sharingService).accessSharedAlbum
        .mockResolvedValueOnce({
          share: { id: publicLink.id, albumId: testAlbum.id, viewCount: 1 },
          album: { id: testAlbum.id, title: "Test Album", createdAt: new Date() },
          photos: [],
        })
        .mockResolvedValueOnce({
          share: { id: publicLink.id, albumId: testAlbum.id, viewCount: 2 },
          album: { id: testAlbum.id, title: "Test Album", createdAt: new Date() },
          photos: [],
        });

      const access1 = await service.accessPublicLink(
        publicLink.publicToken,
        undefined,
        1,
        "127.0.0.1",
      );
      expect(access1.share.viewCount).toBe(1);

      const access2 = await service.accessPublicLink(
        publicLink.publicToken,
        undefined,
        1,
        "127.0.0.2",
      );
      expect(access2.share.viewCount).toBe(2);
    });

    it("Property 2: Pagination bounds - Should handle page numbers correctly", async () => {
      // Mock sharing service with many photos
      const mockPhotos = Array.from({ length: 150 }, (_, i) => ({
        id: `photo-${i}`,
        uri: `uri-${i}`,
        width: 1920,
        height: 1080,
        filename: `photo-${i}.jpg`,
        isFavorite: false,
        createdAt: new Date(),
      }));

      const mockShareAccess = {
        share: { id: publicLink.id, albumId: testAlbum.id, viewCount: 0 },
        album: { id: testAlbum.id, title: "Test Album", createdAt: new Date() },
        photos: mockPhotos,
      };

      vi.mocked(sharingService).accessSharedAlbum.mockResolvedValue(mockShareAccess);

      // Test page 1
      const page1 = await service.accessPublicLink(
        publicLink.publicToken,
        undefined,
        1,
        "127.0.0.1",
      );
      expect(page1.photos).toHaveLength(50);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.hasNext).toBe(true);
      expect(page1.pagination.hasPrev).toBe(false);

      // Test page 2
      const page2 = await service.accessPublicLink(
        publicLink.publicToken,
        undefined,
        2,
        "127.0.0.1",
      );
      expect(page2.photos).toHaveLength(50);
      expect(page2.pagination.page).toBe(2);
      expect(page2.pagination.hasNext).toBe(true);
      expect(page2.pagination.hasPrev).toBe(true);

      // Test page 3 (last page)
      const page3 = await service.accessPublicLink(
        publicLink.publicToken,
        undefined,
        3,
        "127.0.0.1",
      );
      expect(page3.photos).toHaveLength(50);
      expect(page3.pagination.page).toBe(3);
      expect(page3.pagination.hasNext).toBe(false);
      expect(page3.pagination.hasPrev).toBe(true);

      // Test invalid page (should default to 1)
      const pageInvalid = await service.accessPublicLink(
        publicLink.publicToken,
        undefined,
        0,
        "127.0.0.1",
      );
      expect(pageInvalid.pagination.page).toBe(1);
    });

    it("Property 3: Rate limiting during access - Should block excessive access", async () => {
      const config = { rateLimitPerMinute: 2 };
      const limitedService = new PublicLinksService(config);
      const testIp = "192.168.1.100";

      // Mock sharing service
      const mockShareAccess = {
        share: { id: publicLink.id, albumId: testAlbum.id, viewCount: 0 },
        album: { id: testAlbum.id, title: "Test Album", createdAt: new Date() },
        photos: [],
      };

      vi.mocked(sharingService).accessSharedAlbum.mockResolvedValue(mockShareAccess);

      // First two requests should work
      await limitedService.accessPublicLink(
        publicLink.publicToken,
        undefined,
        1,
        testIp,
      );
      await limitedService.accessPublicLink(
        publicLink.publicToken,
        undefined,
        1,
        testIp,
      );

      // Third request should fail
      await expect(
        limitedService.accessPublicLink(
          publicLink.publicToken,
          undefined,
          1,
          testIp,
        ),
      ).rejects.toThrow("Rate limit exceeded");
    });
  });

  describe("Public Link Validation Properties", () => {
    let publicLink: any;

    beforeEach(async () => {
      publicLink = await service.createPublicLink({
        albumId: testAlbum.id,
        userId: testUser.id,
      });
    });

    it("Property 1: Validation correctness - Should correctly identify valid/invalid tokens", async () => {
      vi.mocked(sharingService).validateShareToken.mockResolvedValue({
        valid: true,
        expired: false,
        passwordRequired: false,
      });
      // validatePublicLink does db.select({ album, customTitle }).from(sharedAlbums).innerJoin(albums).where().limit(1)
      vi.mocked(db.select).mockReturnValue(
        createSelectChain([{ album: testAlbum, customTitle: null }]) as any,
      );

      const validResult = await service.validatePublicLink(
        publicLink.publicToken,
      );
      expect(validResult.valid).toBe(true);
      expect(validResult.expired).toBe(false);
      expect(validResult.passwordRequired).toBe(false);

      vi.mocked(sharingService).validateShareToken.mockResolvedValue({
        valid: false,
        expired: false,
        passwordRequired: false,
      });

      const invalidResult = await service.validatePublicLink("invalid-token");
      expect(invalidResult.valid).toBe(false);
    });

    it("Property 2: Expiration handling - Should handle expired links correctly", async () => {
      // Mock expired token
      vi.mocked(sharingService).validateShareToken.mockResolvedValue({
        valid: false,
        expired: true,
        passwordRequired: false,
      });

      const expiredResult = await service.validatePublicLink(
        publicLink.publicToken,
      );
      expect(expiredResult.valid).toBe(false);
      expect(expiredResult.expired).toBe(true);
    });

    it("Property 3: Password requirement detection - Should identify password-protected links", async () => {
      vi.mocked(sharingService).validateShareToken.mockResolvedValue({
        valid: true,
        expired: false,
        passwordRequired: true,
      });
      vi.mocked(db.select).mockReturnValue(
        createSelectChain([{ album: testAlbum, customTitle: null }]) as any,
      );

      const passwordResult = await service.validatePublicLink(
        publicLink.publicToken,
      );
      expect(passwordResult.valid).toBe(true);
      expect(passwordResult.expired).toBe(false);
      expect(passwordResult.passwordRequired).toBe(true);
    });
  });

  describe("Public Link Update Properties", () => {
    let publicLink: any;

    beforeEach(async () => {
      publicLink = await service.createPublicLink({
        albumId: testAlbum.id,
        userId: testUser.id,
      });
    });

    it("Property 1: Update persistence - Changes should be applied correctly", async () => {
      vi.mocked(sharingService).updateShare.mockResolvedValue({
        id: publicLink.id,
        expiresAt: null,
        isActive: true,
      });
      // updatePublicLink does db.select().from(sharedAlbums).where().limit(1) for updated share
      vi.mocked(db.select).mockReturnValue(
        createSelectChain([
          {
            id: publicLink.id,
            allowDownload: false,
            showMetadata: true,
            customTitle: "Custom Album Title",
            customDescription: "Custom description",
            expiresAt: null,
            isActive: true,
          },
        ]) as any,
      );

      const updates = {
        allowDownload: false,
        showMetadata: true,
        customTitle: "Custom Album Title",
        customDescription: "Custom description",
      };

      const result = await service.updatePublicLink(
        publicLink.id,
        testUser.id,
        updates,
      );

      expect(result.allowDownload).toBe(false);
      expect(result.showMetadata).toBe(true);
      expect(result.customTitle).toBe("Custom Album Title");
      expect(result.customDescription).toBe("Custom description");
    });

    it("Property 2: Partial updates - Should update only specified fields", async () => {
      vi.mocked(sharingService).updateShare.mockResolvedValue({
        id: publicLink.id,
        expiresAt: null,
        isActive: true,
      });
      vi.mocked(db.select).mockReturnValue(
        createSelectChain([
          {
            id: publicLink.id,
            allowDownload: false,
            showMetadata: false,
            customTitle: null,
            customDescription: null,
            expiresAt: null,
            isActive: true,
          },
        ]) as any,
      );

      const updates = {
        allowDownload: false,
      };

      const result = await service.updatePublicLink(
        publicLink.id,
        testUser.id,
        updates,
      );

      expect(result.allowDownload).toBe(false);
      expect(result.showMetadata).toBeDefined();
    });

    it("Property 3: Authorization - Should reject updates from unauthorized users", async () => {
      // Mock sharing service to throw authorization error
      vi.mocked(sharingService).updateShare.mockRejectedValue(
        new Error("Share not found or access denied"),
      );

      const otherUserId = "other-user-id";

      await expect(
        service.updatePublicLink(publicLink.id, otherUserId, {
          allowDownload: false,
        }),
      ).rejects.toThrow("Share not found or access denied");
    });
  });

  describe("Statistics Properties", () => {
    it("Property 1: Statistics accuracy - Should calculate correct statistics", async () => {
      // getPublicLinkStats uses db.select from sharedAlbums innerJoin albums; expects { shared_albums }
      const now = new Date();
      const expired = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      vi.mocked(db.select).mockReturnValue(
        createSelectChain([
          {
            shared_albums: {
              isActive: true,
              expiresAt: null,
              viewCount: 10,
              passwordHash: null,
            },
          },
          {
            shared_albums: {
              isActive: true,
              expiresAt: expired,
              viewCount: 5,
              passwordHash: "hashed",
            },
          },
        ]) as any,
      );

      const stats = await service.getPublicLinkStats(testUser.id);

      expect(stats.totalPublicLinks).toBe(2);
      expect(stats.activePublicLinks).toBe(1);
      expect(stats.expiredPublicLinks).toBe(1);
      expect(stats.totalViews).toBe(15);
      expect(stats.protectedLinks).toBe(1);
    });

    it("Property 2: Empty statistics - Should handle users with no public links", async () => {
      // getPublicLinkStats uses db.select().from(sharedAlbums).innerJoin(albums).where() -> return []
      vi.mocked(db.select).mockReturnValue(createSelectChain([]) as any);

      const stats = await service.getPublicLinkStats(testUser.id);

      expect(stats.totalPublicLinks).toBe(0);
      expect(stats.activePublicLinks).toBe(0);
      expect(stats.expiredPublicLinks).toBe(0);
      expect(stats.totalViews).toBe(0);
      expect(stats.protectedLinks).toBe(0);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("Property 1: Invalid album ID - Should reject non-existent albums", async () => {
      vi.mocked(db.select).mockReturnValue(createSelectChain([]) as any);
      await expect(
        service.createPublicLink({
          albumId: "non-existent-album-id",
          userId: testUser.id,
        }),
      ).rejects.toThrow("Album not found or access denied");
    });

    it("Property 2: Invalid user ID - Should reject unauthorized users", async () => {
      vi.mocked(db.select).mockReturnValue(createSelectChain([]) as any);
      await expect(
        service.createPublicLink({
          albumId: testAlbum.id,
          userId: "non-existent-user-id",
        }),
      ).rejects.toThrow("Album not found or access denied");
    });

    it("Property 3: Malformed tokens - Should handle invalid token formats", async () => {
      // Mock sharing service to return invalid for malformed tokens
      vi.mocked(sharingService).validateShareToken.mockResolvedValue({
        valid: false,
        expired: false,
        passwordRequired: false,
      });

      const malformedTokens = [
        "",
        "short",
        "invalid-chars-@#$",
        "not-hex-length",
      ];

      for (const token of malformedTokens) {
        const result = await service.validatePublicLink(token);
        expect(result.valid).toBe(false);
      }
    });

    it("Property 4: Extreme pagination - Should handle very large page numbers", async () => {
      // Mock sharing service with few photos
      const mockShareAccess = {
        share: { id: "test-id", albumId: testAlbum.id, viewCount: 0 },
        album: { id: testAlbum.id, title: "Test Album", createdAt: new Date() },
        photos: Array.from({ length: 5 }, (_, i) => ({
          id: `photo-${i}`,
          uri: `uri-${i}`,
          width: 1920,
          height: 1080,
          filename: `photo-${i}.jpg`,
          isFavorite: false,
          createdAt: new Date(),
        })),
      };

      vi.mocked(sharingService).accessSharedAlbum.mockResolvedValue(mockShareAccess);

      const publicLink = await service.createPublicLink({
        albumId: testAlbum.id,
        userId: testUser.id,
      });

      // Test very large page number
      const result = await service.accessPublicLink(
        publicLink.publicToken,
        undefined,
        999,
        "127.0.0.1",
      );

      expect(result.pagination.page).toBe(999);
      // Page 999 with 5 photos yields empty slice (offset 998*50 > 5)
      expect(result.photos).toHaveLength(0);
    });
  });

  describe("Security Properties", () => {
    it("Property 1: Token randomness - Tokens should be cryptographically random", () => {
      fc.assert(
        fc.property(fc.integer({ min: 10, max: 100 }), (count) => {
          const tokens = Array.from({ length: count }, () =>
            (service as any).generatePublicToken(),
          );

          // Check for patterns that would indicate poor randomness
          const tokenSet = new Set(tokens);
          expect(tokenSet.size).toBe(count); // All unique

          // No obvious patterns (all tokens should be different)
          for (let i = 1; i < tokens.length; i++) {
            const hammingDistance = tokens[i]
              .split("")
              .filter((char, idx) => char !== tokens[0][idx]).length;

            // Should have significant differences (not just last few chars)
            expect(hammingDistance).toBeGreaterThan(10);
          }
        }),
        { numRuns: 50 },
      );
    });

    it("Property 2: Rate limit memory management - Should clean up old entries", () => {
      const config = { rateLimitPerMinute: 5 };
      const limitedService = new PublicLinksService(config);
      const testIp = "192.168.1.100";

      // Add some rate limit entries
      (limitedService as any).checkRateLimit(testIp);

      // Verify tracker has the entry
      expect((limitedService as any).rateLimitTracker.has(testIp)).toBe(true);

      // Manually set expiration time in the past
      const tracker = (limitedService as any).rateLimitTracker.get(testIp);
      tracker.resetTime = Date.now() - 1000;

      // Cleanup should remove expired entries
      (limitedService as any).cleanupRateLimit();

      expect((limitedService as any).rateLimitTracker.has(testIp)).toBe(false);
    });
  });
});
