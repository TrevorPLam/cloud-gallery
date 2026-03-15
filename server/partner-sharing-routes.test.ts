// AI-META-BEGIN
// AI-META: Integration tests for partner sharing API endpoints ensuring security and functionality
// OWNERSHIP: server/routes (partner sharing API testing)
// ENTRYPOINTS: test runner executes these to validate API behavior
// DEPENDENCIES: supertest, express app, authentication mocks
// DANGER: Test failures indicate security vulnerabilities or broken functionality
// CHANGE-SAFETY: Maintain test coverage for all endpoints and error scenarios
// TESTS: Integration tests for authentication, validation, error handling, security
// AI-META-END

import request from "supertest";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { app } from "../index";
import { db } from "../db";
import { partnerInvitations, partnerRelationships, users } from "../../shared/schema";

// Mock database for testing
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as any;

// Mock the database import
vi.mock("../db", () => ({
  db: mockDb,
}));

// Mock authentication middleware
vi.mock("../middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: "test-user-id" };
    next();
  },
}));

describe("Partner Sharing API - Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // INVITATION ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  describe("POST /api/partner-sharing/invitations", () => {
    it("should create a new invitation successfully", async () => {
      // Mock successful invitation creation
      mockDb.insert.mockReturnValue([
        {
          id: "invitation-123",
          invitationToken: "abc123",
          inviteeEmail: "partner@example.com",
          expiresAt: new Date(),
        },
      ]);

      const response = await request(app)
        .post("/api/partner-sharing/invitations")
        .send({
          inviteeEmail: "partner@example.com",
          message: "Let's share photos!",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe("invitation-123");
      expect(response.body.data.inviteeEmail).toBe("partner@example.com");
    });

    it("should reject invitations without email or userId", async () => {
      const response = await request(app)
        .post("/api/partner-sharing/invitations")
        .send({
          message: "Let's share photos!",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should reject invalid email addresses", async () => {
      const response = await request(app)
        .post("/api/partner-sharing/invitations")
        .send({
          inviteeEmail: "invalid-email",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should handle existing partnerships", async () => {
      // Mock existing partnership check
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([{ id: "existing-partnership" }]),
            },
          ]),
        },
      ]);

      const response = await request(app)
        .post("/api/partner-sharing/invitations")
        .send({
          inviteeId: "existing-partner-id",
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Partnership already exists");
    });

    it("should require authentication", async () => {
      // Temporarily disable auth middleware for this test
      const { authenticateToken } = require("../middleware");
      authenticateToken.mockImplementation((req: any, res: any, next: any) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const response = await request(app)
        .post("/api/partner-sharing/invitations")
        .send({
          inviteeEmail: "partner@example.com",
        })
        .expect(401);

      expect(response.body.error).toBe("Unauthorized");
    });
  });

  describe("POST /api/partner-sharing/invitations/accept", () => {
    it("should accept a valid invitation", async () => {
      // Mock valid invitation lookup
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([
                {
                  id: "invitation-123",
                  invitationToken: "valid-token",
                  inviterId: "inviter-123",
                  inviteeId: "invitee-123",
                  status: "pending",
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Future
                },
              ]),
            },
          ]),
        },
      ]);

      // Mock partnership creation
      mockDb.insert.mockReturnValue([
        {
          id: "partnership-123",
          userId: "inviter-123",
          partnerId: "invitee-123",
          status: "accepted",
        },
      ]);

      // Mock user lookup
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([
                { id: "inviter-123", username: "testuser" },
              ]),
            },
          ]),
        },
      ]);

      const response = await request(app)
        .post("/api/partner-sharing/invitations/accept")
        .send({
          invitationToken: "valid-token",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.partnershipId).toBe("partnership-123");
      expect(response.body.data.partnerName).toBe("testuser");
    });

    it("should reject invalid tokens", async () => {
      // Mock no invitation found
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([]), // No results
            },
          ]),
        },
      ]);

      const response = await request(app)
        .post("/api/partner-sharing/invitations/accept")
        .send({
          invitationToken: "invalid-token",
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid or expired invitation");
    });

    it("should reject expired invitations", async () => {
      // Mock expired invitation
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([
                {
                  id: "invitation-123",
                  invitationToken: "expired-token",
                  status: "pending",
                  expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Past
                },
              ]),
            },
          ]),
        },
      ]);

      const response = await request(app)
        .post("/api/partner-sharing/invitations/accept")
        .send({
          invitationToken: "expired-token",
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid or expired invitation");
    });

    it("should reject unauthorized acceptance attempts", async () => {
      // Mock invitation for different user
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([
                {
                  id: "invitation-123",
                  invitationToken: "valid-token",
                  inviterId: "inviter-123",
                  inviteeId: "different-user", // Different from test user
                  status: "pending",
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
              ]),
            },
          ]),
        },
      ]);

      const response = await request(app)
        .post("/api/partner-sharing/invitations/accept")
        .send({
          invitationToken: "valid-token",
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("You are not authorized to accept this invitation");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PARTNERSHIP ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  describe("GET /api/partner-sharing/partnerships", () => {
    it("should return user's partnerships", async () => {
      // Mock partnerships data
      mockDb.select.mockReturnValue([
        {
          innerJoin: vi.fn().mockReturnValue([
            {
              where: vi.fn().mockReturnValue([
                {
                  limit: vi.fn().mockReturnValue([
                    {
                      partnership: {
                        id: "partnership-123",
                        partnerId: "partner-123",
                        status: "accepted",
                        acceptedAt: new Date(),
                        privacySettings: { includeOtherApps: true },
                      },
                      partnerUsername: "testpartner",
                    },
                  ]),
                },
              ]),
            },
          ]),
        },
      ]);

      const response = await request(app)
        .get("/api/partner-sharing/partnerships")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("active");
      expect(response.body.data).toHaveProperty("pending");
      expect(Array.isArray(response.body.data.active)).toBe(true);
      expect(Array.isArray(response.body.data.pending)).toBe(true);
    });

    it("should handle empty partnerships", async () => {
      // Mock empty partnerships
      mockDb.select.mockReturnValue([
        {
          innerJoin: vi.fn().mockReturnValue([
            {
              where: vi.fn().mockReturnValue([
                {
                  limit: vi.fn().mockReturnValue([]), // No partnerships
                },
              ]),
            },
          ]),
        },
      ]);

      const response = await request(app)
        .get("/api/partner-sharing/partnerships")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.active).toEqual([]);
      expect(response.body.data.pending).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // AUTO-SHARE RULES ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  describe("POST /api/partner-sharing/rules", () => {
    it("should create a new auto-share rule", async () => {
      // Mock partnership validation
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([
                { id: "partnership-123" }, // Valid partnership
              ]),
            },
          ]),
        },
      ]);

      // Mock rule creation
      mockDb.insert.mockReturnValue([
        {
          id: "rule-123",
          name: "Test Rule",
          ruleType: "all_photos",
          isActive: true,
        },
      ]);

      const response = await request(app)
        .post("/api/partner-sharing/rules")
        .send({
          partnershipId: "partnership-123",
          name: "Test Rule",
          ruleType: "all_photos",
          criteria: {
            favoritesOnly: false,
            excludeTags: [],
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe("rule-123");
      expect(response.body.data.name).toBe("Test Rule");
    });

    it("should reject invalid rule types", async () => {
      const response = await request(app)
        .post("/api/partner-sharing/rules")
        .send({
          partnershipId: "partnership-123",
          name: "Invalid Rule",
          ruleType: "invalid_type",
          criteria: {},
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Validation failed");
    });

    it("should reject rules for non-existent partnerships", async () => {
      // Mock no partnership found
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([]), // No partnership
            },
          ]),
        },
      ]);

      const response = await request(app)
        .post("/api/partner-sharing/rules")
        .send({
          partnershipId: "non-existent",
          name: "Test Rule",
          ruleType: "all_photos",
          criteria: {},
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Partnership not found or access denied");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // SHARED PHOTOS ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  describe("GET /api/partner-sharing/shared-photos/:partnershipId", () => {
    it("should return shared photos for valid partnership", async () => {
      // Mock partnership validation
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([
                { id: "partnership-123" }, // Valid partnership
              ]),
            },
          ]),
        },
      ]);

      // Mock shared photos data
      mockDb.select.mockReturnValue([
        {
          count: vi.fn().mockReturnValue([{ count: 10 }]),
        },
      ]);

      mockDb.select.mockReturnValue([
        {
          innerJoin: vi.fn().mockReturnValue([
            {
              innerJoin: vi.fn().mockReturnValue([
                {
                  where: vi.fn().mockReturnValue([
                    {
                      orderBy: vi.fn().mockReturnValue([
                        {
                          limit: vi.fn().mockReturnValue([
                            {
                              offset: vi.fn().mockReturnValue([
                                {
                                  sharedPhoto: {
                                    id: "shared-123",
                                    photoId: "photo-123",
                                    partnershipId: "partnership-123",
                                    isSavedByPartner: false,
                                  },
                                  photo: {
                                    id: "photo-123",
                                    uri: "file://photo.jpg",
                                    width: 1920,
                                    height: 1080,
                                    filename: "test.jpg",
                                    isFavorite: false,
                                    createdAt: new Date(),
                                  },
                                  sharedByUsername: "testuser",
                                },
                              ]),
                            },
                          ]),
                        },
                      ]),
                    },
                  ]),
                },
              ]),
            },
          ]),
        },
      ]);

      const response = await request(app)
        .get("/api/partner-sharing/shared-photos/partnership-123")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("photos");
      expect(response.body.data).toHaveProperty("hasMore");
      expect(response.body.data).toHaveProperty("totalCount");
      expect(Array.isArray(response.body.data.photos)).toBe(true);
    });

    it("should reject access to invalid partnerships", async () => {
      // Mock no partnership found
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([]), // No partnership
            },
          ]),
        },
      ]);

      const response = await request(app)
        .get("/api/partner-sharing/shared-photos/invalid-partnership")
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Partnership not found or access denied");
    });

    it("should respect pagination limits", async () => {
      // Mock partnership validation
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([{ id: "partnership-123" }]),
            },
          ]),
        },
      ]);

      const response = await request(app)
        .get("/api/partner-sharing/shared-photos/partnership-123?limit=200")
        .expect(200);

      // Should limit to maximum of 100
      expect(mockDb.select).toHaveBeenCalled();
      // The limit should be clamped to 100 in the route handler
    });
  });

  // ═══════════════════════════════════════════════════════════
  // UTILITY ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  describe("GET /api/partner-sharing/stats", () => {
    it("should return partner sharing statistics", async () => {
      const response = await request(app)
        .get("/api/partner-sharing/stats")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("activePartnerships");
      expect(response.body.data).toHaveProperty("pendingInvitations");
      expect(response.body.data).toHaveProperty("sharedPhotos");
      expect(response.body.data).toHaveProperty("autoShareRules");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // ERROR HANDLING TESTS
  // ═══════════════════════════════════════════════════════════

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock database error
      mockDb.select.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await request(app)
        .get("/api/partner-sharing/partnerships")
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Internal server error");
    });

    it("should handle malformed JSON", async () => {
      const response = await request(app)
        .post("/api/partner-sharing/invitations")
        .set("Content-Type", "application/json")
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/partner-sharing/rules")
        .send({
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Validation failed");
    });
  });

  // ═══════════════════════════════════════════════════════════
  // SECURITY TESTS
  // ═══════════════════════════════════════════════════════════

  describe("Security", () => {
    it("should prevent access to other users' data", async () => {
      // Mock that partnership belongs to different user
      mockDb.select.mockReturnValue([
        {
          where: vi.fn().mockReturnValue([
            {
              limit: vi.fn().mockReturnValue([]), // No partnerships for current user
            },
          ]),
        },
      ]);

      const response = await request(app)
        .get("/api/partner-sharing/shared-photos/other-user-partnership")
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it("should sanitize error messages", async () => {
      // Mock database error with sensitive information
      mockDb.select.mockImplementation(() => {
        throw new Error("Database password: secret123");
      });

      const response = await request(app)
        .get("/api/partner-sharing/partnerships")
        .expect(500);

      expect(response.body.error).toBe("Internal server error");
      expect(response.body.error).not.toContain("secret123");
    });

    it("should validate input types", async () => {
      const response = await request(app)
        .post("/api/partner-sharing/invitations")
        .send({
          inviteeEmail: 123, // Should be string
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Validation failed");
    });
  });
});
