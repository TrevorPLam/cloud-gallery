// AI-META-BEGIN
// AI-META: Integration tests for sharing API endpoints ensuring security and functionality
// OWNERSHIP: server/api
// ENTRYPOINTS: run by npm test
// DEPENDENCIES: vitest, supertest, express, ./sharing-routes, ../db
// DANGER: Test failures indicate security vulnerabilities or broken sharing functionality
// CHANGE-SAFETY: Maintain test coverage for all sharing endpoints and error scenarios
// TESTS: npm run test server/sharing-routes.test.ts
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import sharingRoutes from "./sharing-routes";
import { sharingService, Permission } from "./services/sharing";

// Mock dependencies
vi.mock("./db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("./services/sharing", () => ({
  sharingService: {
    createShare: vi.fn(),
    accessSharedAlbum: vi.fn(),
    validateShareToken: vi.fn(),
    getUserSharedAlbums: vi.fn(),
    updateShare: vi.fn(),
    addCollaborator: vi.fn(),
    getCollaborators: vi.fn(),
    removeCollaborator: vi.fn(),
  },
  Permission: {
    VIEW: "view",
    EDIT: "edit",
    ADMIN: "admin",
  },
}));

vi.mock("./auth", () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: "test-user-id", email: "test@example.com" };
    next();
  }),
}));

describe("Sharing API Integration Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/api/sharing", sharingRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validAlbumId = "550e8400-e29b-41d4-a716-446655440000";
  const validUserId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  describe("POST /api/sharing/create", () => {
    it("should create a shared album successfully", async () => {
      const mockShareResult = {
        id: "share-123",
        shareToken:
          "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        permissions: Permission.VIEW,
        expiresAt: null,
        passwordRequired: false,
      };

      vi.mocked(sharingService.createShare).mockResolvedValue(mockShareResult);

      await request(app)
        .post("/api/sharing/create")
        .send({
          albumId: validAlbumId,
          permissions: "view",
        })
        .expect(201);

      expect(sharingService.createShare).toHaveBeenCalledWith({
        albumId: validAlbumId,
        userId: "test-user-id",
        permissions: Permission.VIEW,
        expiresAt: null,
        password: undefined,
      });
    });

    it("should create a shared album with password", async () => {
      const mockShareResult = {
        id: "share-123",
        shareToken:
          "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        permissions: Permission.EDIT,
        expiresAt: new Date("2024-12-31T23:59:59.000Z"),
        passwordRequired: true,
      };

      vi.mocked(sharingService.createShare).mockResolvedValue(mockShareResult);

      await request(app)
        .post("/api/sharing/create")
        .send({
          albumId: validAlbumId,
          password: "securepassword123",
          permissions: "edit",
          expiresAt: "2024-12-31T23:59:59.000Z",
        })
        .expect(201);

      expect(sharingService.createShare).toHaveBeenCalledWith({
        albumId: validAlbumId,
        userId: "test-user-id",
        permissions: Permission.EDIT,
        expiresAt: new Date("2024-12-31T23:59:59.000Z"),
        password: "securepassword123",
      });
    });

    it("should reject invalid request data", async () => {
      const res = await request(app)
        .post("/api/sharing/create")
        .send({
          albumId: "invalid-uuid",
          password: "123", // Too short
          permissions: "invalid",
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(sharingService.createShare).not.toHaveBeenCalled();
    });

    it("should handle album not found error", async () => {
      vi.mocked(sharingService.createShare).mockRejectedValue(
        new Error("Album not found or access denied"),
      );
      await request(app)
        .post("/api/sharing/create")
        .send({ albumId: validAlbumId, permissions: "view" })
        .expect(404);
    });
  });

  describe("POST /api/sharing/access/:token", () => {
    it("should access shared album without password", async () => {
      const mockAccessResult = {
        share: {
          id: "share-123",
          albumId: "album-123",
          permissions: Permission.VIEW,
          expiresAt: null,
          viewCount: 5,
        },
        album: {
          id: "album-123",
          title: "Test Album",
          description: "A test album",
          coverPhotoUri: null,
          createdAt: new Date(),
        },
        photos: [],
      };

      vi.mocked(sharingService.accessSharedAlbum).mockResolvedValue(
        mockAccessResult,
      );

      const response = await request(app)
        .post(
          "/api/sharing/access/abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        )
        .send({})
        .expect(200);

      expect(response.body.message).toBe("Shared album accessed successfully");
      expect(response.body.data).toMatchObject({
        share: mockAccessResult.share,
        album: {
          id: mockAccessResult.album.id,
          title: mockAccessResult.album.title,
          description: mockAccessResult.album.description,
          coverPhotoUri: null,
        },
        photos: [],
      });

      expect(sharingService.accessSharedAlbum).toHaveBeenCalledWith(
        "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        undefined,
      );
    });

    it("should access shared album with password", async () => {
      const mockAccessResult = {
        share: {
          id: "share-123",
          albumId: "album-123",
          permissions: Permission.VIEW,
          expiresAt: null,
          viewCount: 1,
        },
        album: {
          id: "album-123",
          title: "Test Album",
          description: "A test album",
          coverPhotoUri: null,
          createdAt: new Date(),
        },
        photos: [],
      };

      vi.mocked(sharingService.accessSharedAlbum).mockResolvedValue(
        mockAccessResult,
      );

      const response = await request(app)
        .post("/api/sharing/access/token123")
        .send({
          password: "correctpassword",
        })
        .expect(200);

      expect(sharingService.accessSharedAlbum).toHaveBeenCalledWith(
        "token123",
        "correctpassword",
      );
    });

    it("should handle invalid share token", async () => {
      vi.mocked(sharingService.accessSharedAlbum).mockRejectedValue(
        new Error("Invalid or expired share token"),
      );

      await request(app)
        .post("/api/sharing/access/invalid-token")
        .send({})
        .expect(404);
    });

    it("should handle password required", async () => {
      vi.mocked(sharingService.accessSharedAlbum).mockRejectedValue(
        new Error("Password required"),
      );

      await request(app)
        .post("/api/sharing/access/protected-token")
        .send({})
        .expect(401);
    });

    it("should handle invalid password", async () => {
      vi.mocked(sharingService.accessSharedAlbum).mockRejectedValue(
        new Error("Invalid password"),
      );

      await request(app)
        .post("/api/sharing/access/protected-token")
        .send({
          password: "wrongpassword",
        })
        .expect(401);
    });
  });

  describe("GET /api/sharing/validate/:token", () => {
    it("should validate share token successfully", async () => {
      vi.mocked(sharingService.validateShareToken).mockResolvedValue({
        valid: true,
        expired: false,
        passwordRequired: false,
      });

      const response = await request(app)
        .get("/api/sharing/validate/token123")
        .expect(200);

      expect(response.body).toEqual({
        valid: true,
        expired: false,
        passwordRequired: false,
      });

      expect(sharingService.validateShareToken).toHaveBeenCalledWith(
        "token123",
      );
    });

    it("should validate expired token", async () => {
      vi.mocked(sharingService.validateShareToken).mockResolvedValue({
        valid: false,
        expired: true,
        passwordRequired: false,
      });

      const response = await request(app)
        .get("/api/sharing/validate/expired-token")
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.expired).toBe(true);
    });

    it("should validate token requiring password", async () => {
      vi.mocked(sharingService.validateShareToken).mockResolvedValue({
        valid: true,
        expired: false,
        passwordRequired: true,
      });

      const response = await request(app)
        .get("/api/sharing/validate/protected-token")
        .expect(200);

      expect(response.body.passwordRequired).toBe(true);
    });
  });

  describe("GET /api/sharing/my-shares", () => {
    it("should get user's shared albums", async () => {
      const mockUserShares = {
        owned: [
          {
            id: "share-1",
            albumId: "album-1",
            albumTitle: "My Album",
            shareToken: "token123",
            permissions: Permission.VIEW,
            expiresAt: null,
            viewCount: 10,
            isActive: true,
            createdAt: new Date(),
          },
        ],
        collaborated: [
          {
            id: "collab-1",
            sharedAlbumId: "share-2",
            albumId: "album-2",
            albumTitle: "Shared Album",
            permissions: Permission.EDIT,
            invitedBy: "user-2",
            acceptedAt: new Date(),
            createdAt: new Date(),
          },
        ],
      };

      vi.mocked(sharingService.getUserSharedAlbums).mockResolvedValue(
        mockUserShares,
      );

      const response = await request(app)
        .get("/api/sharing/my-shares")
        .expect(200);

      expect(response.body).toMatchObject({
        owned: [
          {
            id: "share-1",
            albumId: "album-1",
            albumTitle: "My Album",
            shareToken: "token123",
            permissions: "view",
            viewCount: 10,
            isActive: true,
          },
        ],
        collaborated: [
          {
            id: "collab-1",
            sharedAlbumId: "share-2",
            albumId: "album-2",
            albumTitle: "Shared Album",
            permissions: "edit",
            invitedBy: "user-2",
          },
        ],
      });
      expect(sharingService.getUserSharedAlbums).toHaveBeenCalledWith(
        "test-user-id",
      );
    });
  });

  describe("PUT /api/sharing/:shareId", () => {
    it("should update shared album settings", async () => {
      const mockUpdatedShare = {
        id: "share-123",
        permissions: Permission.EDIT,
        expiresAt: new Date("2024-12-31T23:59:59.000Z"),
        isActive: true,
      };

      vi.mocked(sharingService.updateShare).mockResolvedValue(mockUpdatedShare);

      const response = await request(app)
        .put("/api/sharing/share-123")
        .send({
          permissions: "edit",
          expiresAt: "2024-12-31T23:59:59.000Z",
          isActive: true,
        })
        .expect(200);

      expect(response.body.message).toBe("Shared album updated successfully");
      expect(response.body.share).toMatchObject({
        id: mockUpdatedShare.id,
        permissions: mockUpdatedShare.permissions,
        isActive: mockUpdatedShare.isActive,
      });

      expect(sharingService.updateShare).toHaveBeenCalledWith(
        "share-123",
        "test-user-id",
        {
          permissions: Permission.EDIT,
          expiresAt: new Date("2024-12-31T23:59:59.000Z"),
          isActive: true,
        },
      );
    });

    it("should handle share not found", async () => {
      vi.mocked(sharingService.updateShare).mockRejectedValue(
        new Error("Share not found or access denied"),
      );

      const response = await request(app)
        .put("/api/sharing/nonexistent")
        .send({
          permissions: "edit",
        })
        .expect(404);

      expect(response.body.error).toBe("Share not found or access denied");
    });
  });

  describe("POST /api/sharing/:shareId/collaborators", () => {
    it("should add collaborator successfully", async () => {
      const mockCollaborator = {
        id: "collab-123",
        userId: validUserId,
        permissions: Permission.VIEW,
        acceptedAt: new Date(),
      };

      vi.mocked(sharingService.addCollaborator).mockResolvedValue(
        mockCollaborator,
      );

      const response = await request(app)
        .post("/api/sharing/share-123/collaborators")
        .send({
          userId: validUserId,
          permissions: "view",
        })
        .expect(201);

      expect(response.body.message).toBe("Collaborator added successfully");
      expect(response.body.collaborator).toMatchObject({
        id: mockCollaborator.id,
        permissions: mockCollaborator.permissions,
      });

      expect(sharingService.addCollaborator).toHaveBeenCalledWith({
        sharedAlbumId: "share-123",
        userId: validUserId,
        permissions: Permission.VIEW,
        invitedBy: "test-user-id",
      });
    });

    it("should handle insufficient permissions", async () => {
      vi.mocked(sharingService.addCollaborator).mockRejectedValue(
        new Error("Insufficient permissions to add collaborators"),
      );

      const response = await request(app)
        .post("/api/sharing/share-123/collaborators")
        .send({
          userId: validUserId,
          permissions: "view",
        })
        .expect(403);

      expect(response.body.error).toBe(
        "Insufficient permissions to add collaborators",
      );
    });

    it("should handle duplicate collaborator", async () => {
      vi.mocked(sharingService.addCollaborator).mockRejectedValue(
        new Error("User is already a collaborator"),
      );

      const response = await request(app)
        .post("/api/sharing/share-123/collaborators")
        .send({
          userId: validUserId,
          permissions: "view",
        })
        .expect(409);

      expect(response.body.error).toBe("User is already a collaborator");
    });
  });

  describe("GET /api/sharing/:shareId/collaborators", () => {
    it("should get collaborators successfully", async () => {
      const mockCollaborators = [
        {
          id: "collab-1",
          userId: "user-456",
          username: "testuser",
          permissions: Permission.VIEW,
          invitedBy: "test-user-id",
          acceptedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      vi.mocked(sharingService.getCollaborators).mockResolvedValue(
        mockCollaborators,
      );

      const response = await request(app)
        .get("/api/sharing/share-123/collaborators")
        .expect(200);

      expect(response.body).toEqual({ collaborators: mockCollaborators });
      expect(sharingService.getCollaborators).toHaveBeenCalledWith(
        "share-123",
        "test-user-id",
      );
    });

    it("should handle access denied", async () => {
      vi.mocked(sharingService.getCollaborators).mockRejectedValue(
        new Error("Access denied"),
      );

      const response = await request(app)
        .get("/api/sharing/share-123/collaborators")
        .expect(403);

      expect(response.body.error).toBe("Access denied");
    });
  });

  describe("DELETE /api/sharing/:shareId/collaborators/:userId", () => {
    it("should remove collaborator successfully", async () => {
      vi.mocked(sharingService.removeCollaborator).mockResolvedValue(undefined);

      const response = await request(app)
        .delete("/api/sharing/share-123/collaborators/user-456")
        .expect(200);

      expect(response.body).toEqual({
        message: "Collaborator removed successfully",
        shareId: "share-123",
        userId: "user-456",
      });

      expect(sharingService.removeCollaborator).toHaveBeenCalledWith(
        "share-123",
        "user-456",
        "test-user-id",
      );
    });

    it("should handle insufficient permissions", async () => {
      vi.mocked(sharingService.removeCollaborator).mockRejectedValue(
        new Error("Insufficient permissions to remove collaborators"),
      );

      const response = await request(app)
        .delete("/api/sharing/share-123/collaborators/user-456")
        .expect(403);

      expect(response.body.error).toBe(
        "Insufficient permissions to remove collaborators",
      );
    });

    it("should handle trying to remove album owner", async () => {
      vi.mocked(sharingService.removeCollaborator).mockRejectedValue(
        new Error("Cannot remove album owner"),
      );

      const response = await request(app)
        .delete("/api/sharing/share-123/collaborators/owner-user")
        .expect(400);

      expect(response.body.error).toBe("Cannot remove album owner");
    });
  });

  describe("GET /api/sharing/stats", () => {
    it("should get sharing statistics", async () => {
      const mockUserShares = {
        owned: [
          {
            id: "share-1",
            albumId: "album-1",
            albumTitle: "Album 1",
            shareToken: "token1",
            permissions: Permission.VIEW,
            expiresAt: null,
            viewCount: 10,
            isActive: true,
            createdAt: new Date(),
          },
          {
            id: "share-2",
            albumId: "album-2",
            albumTitle: "Album 2",
            shareToken: "token2",
            permissions: Permission.EDIT,
            expiresAt: new Date("2023-01-01"), // Expired
            viewCount: 5,
            isActive: false,
            createdAt: new Date(),
          },
        ],
        collaborated: [
          {
            id: "collab-1",
            sharedAlbumId: "share-3",
            albumId: "album-3",
            albumTitle: "Shared Album",
            permissions: Permission.EDIT,
            invitedBy: "user-2",
            acceptedAt: new Date(),
            createdAt: new Date(),
          },
        ],
      };

      vi.mocked(sharingService.getUserSharedAlbums).mockResolvedValue(
        mockUserShares,
      );

      const response = await request(app).get("/api/sharing/stats").expect(200);

      expect(response.body).toEqual({
        totalShares: 2,
        activeShares: 1,
        expiredShares: 1,
        totalCollaborations: 1,
        totalViews: 15,
        sharesWithPassword: 2, // Both shares have tokens (indicating password protection)
      });
    });
  });

  describe("Authentication", () => {
    it("should require authentication for all endpoints", async () => {
      // Test with unauthenticated request
      const unauthenticatedApp = express();
      unauthenticatedApp.use(express.json());

      // Override auth middleware to reject requests
      unauthenticatedApp.use("/api/sharing", (req, res, next) => {
        res.status(401).json({ error: "User not authenticated" });
      });
      unauthenticatedApp.use("/api/sharing", sharingRoutes);

      const endpoints = [
        { method: "post", path: "/api/sharing/create" },
        { method: "get", path: "/api/sharing/my-shares" },
        { method: "put", path: "/api/sharing/share-123" },
        { method: "get", path: "/api/sharing/stats" },
      ];

      for (const endpoint of endpoints) {
        if (endpoint.method === "post") {
          await request(unauthenticatedApp)
            .post(endpoint.path)
            .send({})
            .expect(401);
        } else if (endpoint.method === "put") {
          await request(unauthenticatedApp)
            .put(endpoint.path)
            .send({})
            .expect(401);
        } else {
          await request(unauthenticatedApp).get(endpoint.path).expect(401);
        }
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      vi.mocked(sharingService.createShare).mockRejectedValue(
        new Error("Unexpected database error"),
      );

      await request(app)
        .post("/api/sharing/create")
        .send({
          albumId: validAlbumId,
          permissions: "view",
        })
        .expect(500);
    });

    it("should handle malformed JSON", async () => {
      await request(app)
        .post("/api/sharing/create")
        .set("Content-Type", "application/json")
        .send('{"invalid": json}')
        .expect(400);
    });
  });
});
