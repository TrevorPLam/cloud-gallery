// AI-META-BEGIN
// AI-META: Unit tests for album CRUD endpoints and photo management
// OWNERSHIP: server/api/tests
// ENTRYPOINTS: npm test
// DEPENDENCIES: vitest, supertest, express, ./album-routes
// DANGER: Missing coverage can hide authorization bypasses or data leaks
// CHANGE-SAFETY: Keep test coverage aligned with route implementations
// TESTS: server/album-routes.test.ts
// AI-META-END

/**
 * Album Routes Unit Tests
 * 
 * Tests all album CRUD operations and photo management:
 * - Album creation (POST /api/albums)
 * - Album listing (GET /api/albums)
 * - Album retrieval (GET /api/albums/:id)
 * - Album updates (PUT /api/albums/:id)
 * - Album deletion (DELETE /api/albums/:id)
 * - Photo addition (POST /api/albums/:id/photos)
 * - Photo removal (DELETE /api/albums/:id/photos/:photoId)
 * - Authorization checks (user ownership validation)
 * 
 * Validates Requirements: 6.2, 6.3, 6.4, 6.5
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import albumRoutes from "./album-routes";

// Mock database - will be populated in tests
const mockAlbums: any[] = [];
const mockAlbumPhotos: any[] = [];
const mockPhotos: any[] = [];

// Mock jsonwebtoken to prevent JWT verification errors
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn((payload, secret) => `mock_token_${JSON.stringify(payload)}`),
    verify: vi.fn((token, secret) => {
      // Parse the mock token to extract payload
      if (token.startsWith('mock_token_')) {
        return JSON.parse(token.slice(11));
      }
      // For specific test tokens, return corresponding users
      if (token === "valid-token") {
        return { id: "user123", email: "test@example.com" };
      } else if (token === "other-user-token") {
        return { id: "user456", email: "other@example.com" };
      }
      // Default user
      return { id: "user123", email: "test@example.com" };
    }),
  },
}));

// Mock security module to bypass JWT verification
vi.mock('./security', () => ({
  verifyAccessToken: vi.fn((token) => {
    if (token === "valid-token") {
      return { id: "user123", email: "test@example.com" };
    } else if (token === "other-user-token") {
      return { id: "user456", email: "other@example.com" };
    }
    return { id: "user123", email: "test@example.com" };
  }),
  generateAccessToken: vi.fn(() => 'mock_access_token'),
  JWT_SECRET: 'test_secret',
}));

// Mock database module with factory function to avoid hoisting issues
vi.mock("./db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue(Promise.resolve([])),
          limit: vi.fn().mockReturnValue(Promise.resolve([])),
          execute: vi.fn().mockReturnValue(Promise.resolve([])),
        }),
        execute: vi.fn().mockReturnValue(Promise.resolve([])),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue(Promise.resolve([{ id: 'test-id' }])),
        execute: vi.fn().mockReturnValue(Promise.resolve([{ id: 'test-id' }])),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockReturnValue(Promise.resolve([])),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Mock schema
vi.mock("../shared/schema", () => ({
  albums: {
    id: "id",
    userId: "userId",
    title: "title",
    description: "description",
    coverPhotoUri: "coverPhotoUri",
    createdAt: "createdAt",
    modifiedAt: "modifiedAt",
  },
  albumPhotos: {
    albumId: "albumId",
    photoId: "photoId",
    position: "position",
    addedAt: "addedAt",
  },
  photos: {
    id: "id",
    userId: "userId",
    uri: "uri",
  },
  insertAlbumSchema: {
    parse: vi.fn((data) => data),
    partial: vi.fn(() => ({
      parse: vi.fn((data) => data),
    })),
  },
}));

// Mock authentication middleware using the new pattern
vi.mock("./auth", () => ({
  authenticateToken: vi.fn((req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token === "valid-token") {
      req.user = { id: "user123", email: "test@example.com" };
      next();
    } else if (token === "other-user-token") {
      req.user = { id: "user456", email: "other@example.com" };
      next();
    } else if (token && token.startsWith('mock_token_')) {
      // Parse mock token
      try {
        const payload = JSON.parse(token.slice(11));
        req.user = payload;
        next();
      } catch {
        return res.status(401).json({
          error: "User not authenticated",
        });
      }
    } else {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }
  }),
}));

describe("Album Routes", () => {
  let app: express.Application;

  beforeEach(async () => {
    // Reset mock data
    mockAlbums.length = 0;
    mockAlbumPhotos.length = 0;
    mockPhotos.length = 0;

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use("/api/albums", albumRoutes);

    // Reset mocks and setup database behavior
    vi.clearAllMocks();
    
    // Import mocked db and configure it for this test run
    const { db } = await import('./db');
    
    // Configure select mock to return test data
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue(Promise.resolve([...mockAlbums])),
          limit: vi.fn().mockReturnValue(Promise.resolve([...mockAlbums])),
          execute: vi.fn().mockReturnValue(Promise.resolve([...mockAlbums])),
        }),
        execute: vi.fn().mockReturnValue(Promise.resolve([...mockAlbums])),
      }),
    });
    
    // Configure insert mock
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation((data) => {
          const newItem = { ...data, id: data.id || `new-${Date.now()}` };
          if (data.title) mockAlbums.push(newItem);
          return Promise.resolve([newItem]);
        }),
        execute: vi.fn().mockImplementation((data) => {
          const newItem = { ...data, id: data.id || `new-${Date.now()}` };
          if (data.title) mockAlbums.push(newItem);
          return Promise.resolve([{ id: newItem.id }]);
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  // GET /api/albums - List all albums
  // ═══════════════════════════════════════════════════════════

  describe("GET /api/albums", () => {
    it("should return all albums for authenticated user", async () => {
      // Setup mock data
      mockAlbums.push(
        {
          id: "album1",
          userId: "user123",
          title: "Vacation 2024",
          description: "Summer vacation photos",
          coverPhotoUri: "https://example.com/photo1.jpg",
          createdAt: new Date("2024-01-01"),
          modifiedAt: new Date("2024-01-01"),
        },
        {
          id: "album2",
          userId: "user123",
          title: "Family",
          description: null,
          coverPhotoUri: null,
          createdAt: new Date("2024-01-02"),
          modifiedAt: new Date("2024-01-02"),
        }
      );

      const response = await request(app)
        .get("/api/albums")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(response.body).toHaveProperty("albums");
      expect(response.body.albums).toHaveLength(2);
      expect(response.body.albums[0]).toMatchObject({
        id: "album1",
        title: "Vacation 2024",
      });
    });

    it("should return empty array when user has no albums", async () => {
      const response = await request(app)
        .get("/api/albums")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(response.body).toEqual({ albums: [] });
    });

    it("should reject request without authentication", async () => {
      const response = await request(app)
        .get("/api/albums")
        .expect(401);

      expect(response.body).toMatchObject({
        error: "User not authenticated",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // GET /api/albums/:id - Get album with photos
  // ═══════════════════════════════════════════════════════════

  describe("GET /api/albums/:id", () => {
    it("should return album with photo IDs", async () => {
      // Setup mock album
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "Vacation 2024",
        description: "Summer vacation",
        coverPhotoUri: "https://example.com/photo1.jpg",
        createdAt: new Date("2024-01-01"),
        modifiedAt: new Date("2024-01-01"),
      });

      // Setup mock album photos
      mockAlbumPhotos.push(
        { albumId: "album1", photoId: "photo1", position: 0 },
        { albumId: "album1", photoId: "photo2", position: 1 },
        { albumId: "album1", photoId: "photo3", position: 2 }
      );

      const response = await request(app)
        .get("/api/albums/album1")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(response.body).toHaveProperty("album");
      expect(response.body).toHaveProperty("photoIds");
      expect(response.body.album).toMatchObject({
        id: "album1",
        title: "Vacation 2024",
      });
      expect(response.body.photoIds).toEqual(["photo1", "photo2", "photo3"]);
    });

    it("should return 404 when album not found", async () => {
      const response = await request(app)
        .get("/api/albums/nonexistent")
        .set("Authorization", "Bearer valid-token")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should return 404 when album belongs to different user", async () => {
      // Setup album for different user
      mockAlbums.push({
        id: "album1",
        userId: "user456",
        title: "Other User's Album",
      });

      const response = await request(app)
        .get("/api/albums/album1")
        .set("Authorization", "Bearer valid-token")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should reject request without authentication", async () => {
      const response = await request(app)
        .get("/api/albums/album1")
        .expect(401);

      expect(response.body).toMatchObject({
        error: "User not authenticated",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // POST /api/albums - Create album
  // ═══════════════════════════════════════════════════════════

  describe("POST /api/albums", () => {
    it("should create album successfully", async () => {
      const newAlbum = {
        title: "New Album",
        description: "Test album description",
      };

      // Setup mock response
      mockAlbums.push({
        id: "album-new",
        userId: "user123",
        title: newAlbum.title,
        description: newAlbum.description,
        coverPhotoUri: null,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/albums")
        .set("Authorization", "Bearer valid-token")
        .send(newAlbum)
        .expect(201);

      expect(response.body).toHaveProperty("album");
      expect(response.body.album).toMatchObject({
        id: "album-new",
        title: "New Album",
        description: "Test album description",
        userId: "user123",
      });
    });

    it("should create album without description", async () => {
      const newAlbum = {
        title: "Minimal Album",
      };

      mockAlbums.push({
        id: "album-minimal",
        userId: "user123",
        title: newAlbum.title,
        description: null,
        coverPhotoUri: null,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/albums")
        .set("Authorization", "Bearer valid-token")
        .send(newAlbum)
        .expect(201);

      expect(response.body.album).toMatchObject({
        title: "Minimal Album",
      });
    });

    it("should reject album creation without title", async () => {
      const { insertAlbumSchema } = await import("../shared/schema");
      vi.mocked(insertAlbumSchema.parse).mockImplementationOnce(() => {
        throw {
          name: "ZodError",
          errors: [{ path: ["title"], message: "Title is required" }],
        };
      });

      const response = await request(app)
        .post("/api/albums")
        .set("Authorization", "Bearer valid-token")
        .send({ description: "No title" })
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Invalid album data",
      });
    });

    it("should reject request without authentication", async () => {
      const response = await request(app)
        .post("/api/albums")
        .send({ title: "Test Album" })
        .expect(401);

      expect(response.body).toMatchObject({
        error: "User not authenticated",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PUT /api/albums/:id - Update album
  // ═══════════════════════════════════════════════════════════

  describe("PUT /api/albums/:id", () => {
    it("should update album successfully", async () => {
      // Setup existing album
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "Old Title",
        description: "Old description",
        coverPhotoUri: null,
        createdAt: new Date("2024-01-01"),
        modifiedAt: new Date("2024-01-01"),
      });

      const updates = {
        title: "Updated Title",
        description: "Updated description",
      };

      // Update mock for response
      mockAlbums[0] = {
        ...mockAlbums[0],
        ...updates,
        modifiedAt: new Date(),
      };

      const response = await request(app)
        .put("/api/albums/album1")
        .set("Authorization", "Bearer valid-token")
        .send(updates)
        .expect(200);

      expect(response.body).toHaveProperty("album");
      expect(response.body.album).toMatchObject({
        id: "album1",
        title: "Updated Title",
        description: "Updated description",
      });
    });

    it("should update only title", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "Old Title",
        description: "Keep this",
        coverPhotoUri: null,
        createdAt: new Date("2024-01-01"),
        modifiedAt: new Date("2024-01-01"),
      });

      mockAlbums[0] = {
        ...mockAlbums[0],
        title: "New Title",
        modifiedAt: new Date(),
      };

      const response = await request(app)
        .put("/api/albums/album1")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "New Title" })
        .expect(200);

      expect(response.body.album).toMatchObject({
        title: "New Title",
        description: "Keep this",
      });
    });

    it("should return 404 when album not found", async () => {
      const response = await request(app)
        .put("/api/albums/nonexistent")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "Updated" })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should return 404 when album belongs to different user", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user456",
        title: "Other User's Album",
      });

      const response = await request(app)
        .put("/api/albums/album1")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "Hacked" })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should reject request without authentication", async () => {
      const response = await request(app)
        .put("/api/albums/album1")
        .send({ title: "Updated" })
        .expect(401);

      expect(response.body).toMatchObject({
        error: "User not authenticated",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // DELETE /api/albums/:id - Delete album
  // ═══════════════════════════════════════════════════════════

  describe("DELETE /api/albums/:id", () => {
    it("should delete album successfully", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "To Delete",
        description: "This will be deleted",
        coverPhotoUri: null,
        createdAt: new Date(),
        modifiedAt: new Date(),
      });

      const response = await request(app)
        .delete("/api/albums/album1")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(response.body).toMatchObject({
        message: "Album deleted successfully",
        albumId: "album1",
      });
    });

    it("should return 404 when album not found", async () => {
      const response = await request(app)
        .delete("/api/albums/nonexistent")
        .set("Authorization", "Bearer valid-token")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should return 404 when album belongs to different user", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user456",
        title: "Other User's Album",
      });

      const response = await request(app)
        .delete("/api/albums/album1")
        .set("Authorization", "Bearer valid-token")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should reject request without authentication", async () => {
      const response = await request(app)
        .delete("/api/albums/album1")
        .expect(401);

      expect(response.body).toMatchObject({
        error: "User not authenticated",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // POST /api/albums/:id/photos - Add photo to album
  // ═══════════════════════════════════════════════════════════

  describe("POST /api/albums/:id/photos", () => {
    it("should add photo to album successfully", async () => {
      // Setup album
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "Test Album",
      });

      // Setup photo
      mockPhotos.push({
        id: "photo1",
        userId: "user123",
        uri: "https://example.com/photo1.jpg",
      });

      // Setup existing album photos (for position calculation)
      mockAlbumPhotos.push(
        { albumId: "album1", photoId: "photo0", position: 0 }
      );

      const response = await request(app)
        .post("/api/albums/album1/photos")
        .set("Authorization", "Bearer valid-token")
        .send({ photoId: "photo1" })
        .expect(201);

      expect(response.body).toMatchObject({
        message: "Photo added to album",
        albumId: "album1",
        photoId: "photo1",
      });
    });

    it("should reject when photoId is missing", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "Test Album",
      });

      const response = await request(app)
        .post("/api/albums/album1/photos")
        .set("Authorization", "Bearer valid-token")
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: "photoId is required",
      });
    });

    it("should return 404 when album not found", async () => {
      const response = await request(app)
        .post("/api/albums/nonexistent/photos")
        .set("Authorization", "Bearer valid-token")
        .send({ photoId: "photo1" })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should return 404 when album belongs to different user", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user456",
        title: "Other User's Album",
      });

      const response = await request(app)
        .post("/api/albums/album1/photos")
        .set("Authorization", "Bearer valid-token")
        .send({ photoId: "photo1" })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should return 404 when photo not found", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "Test Album",
      });

      const response = await request(app)
        .post("/api/albums/album1/photos")
        .set("Authorization", "Bearer valid-token")
        .send({ photoId: "nonexistent" })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Photo not found",
      });
    });

    it("should return 404 when photo belongs to different user", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "Test Album",
      });

      mockPhotos.push({
        id: "photo1",
        userId: "user456",
        uri: "https://example.com/photo1.jpg",
      });

      const response = await request(app)
        .post("/api/albums/album1/photos")
        .set("Authorization", "Bearer valid-token")
        .send({ photoId: "photo1" })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Photo not found",
      });
    });

    it("should return 409 when photo already in album", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "Test Album",
      });

      mockPhotos.push({
        id: "photo1",
        userId: "user123",
        uri: "https://example.com/photo1.jpg",
      });

      // Photo already in album
      mockAlbumPhotos.push({
        albumId: "album1",
        photoId: "photo1",
        position: 0,
      });

      const response = await request(app)
        .post("/api/albums/album1/photos")
        .set("Authorization", "Bearer valid-token")
        .send({ photoId: "photo1" })
        .expect(409);

      expect(response.body).toMatchObject({
        error: "Photo already in album",
      });
    });

    it("should reject request without authentication", async () => {
      const response = await request(app)
        .post("/api/albums/album1/photos")
        .send({ photoId: "photo1" })
        .expect(401);

      expect(response.body).toMatchObject({
        error: "User not authenticated",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // DELETE /api/albums/:id/photos/:photoId - Remove photo from album
  // ═══════════════════════════════════════════════════════════

  describe("DELETE /api/albums/:id/photos/:photoId", () => {
    it("should remove photo from album successfully", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "Test Album",
      });

      mockAlbumPhotos.push({
        albumId: "album1",
        photoId: "photo1",
        position: 0,
      });

      const response = await request(app)
        .delete("/api/albums/album1/photos/photo1")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(response.body).toMatchObject({
        message: "Photo removed from album",
        albumId: "album1",
        photoId: "photo1",
      });
    });

    it("should return 404 when album not found", async () => {
      const response = await request(app)
        .delete("/api/albums/nonexistent/photos/photo1")
        .set("Authorization", "Bearer valid-token")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should return 404 when album belongs to different user", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user456",
        title: "Other User's Album",
      });

      const response = await request(app)
        .delete("/api/albums/album1/photos/photo1")
        .set("Authorization", "Bearer valid-token")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should return 404 when photo not in album", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "Test Album",
      });

      const response = await request(app)
        .delete("/api/albums/album1/photos/photo1")
        .set("Authorization", "Bearer valid-token")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Photo not in album",
      });
    });

    it("should reject request without authentication", async () => {
      const response = await request(app)
        .delete("/api/albums/album1/photos/photo1")
        .expect(401);

      expect(response.body).toMatchObject({
        error: "User not authenticated",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Authorization Tests - Cross-User Access Prevention
  // ═══════════════════════════════════════════════════════════

  describe("Authorization - Cross-User Access Prevention", () => {
    it("should prevent user from accessing another user's album", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user456",
        title: "Private Album",
      });

      const response = await request(app)
        .get("/api/albums/album1")
        .set("Authorization", "Bearer valid-token")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should prevent user from updating another user's album", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user456",
        title: "Private Album",
      });

      const response = await request(app)
        .put("/api/albums/album1")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "Hacked" })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should prevent user from deleting another user's album", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user456",
        title: "Private Album",
      });

      const response = await request(app)
        .delete("/api/albums/album1")
        .set("Authorization", "Bearer valid-token")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should prevent user from adding photos to another user's album", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user456",
        title: "Private Album",
      });

      const response = await request(app)
        .post("/api/albums/album1/photos")
        .set("Authorization", "Bearer valid-token")
        .send({ photoId: "photo1" })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should prevent user from removing photos from another user's album", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user456",
        title: "Private Album",
      });

      const response = await request(app)
        .delete("/api/albums/album1/photos/photo1")
        .set("Authorization", "Bearer valid-token")
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Album not found",
      });
    });

    it("should prevent user from adding another user's photo to their album", async () => {
      mockAlbums.push({
        id: "album1",
        userId: "user123",
        title: "My Album",
      });

      mockPhotos.push({
        id: "photo1",
        userId: "user456",
        uri: "https://example.com/photo1.jpg",
      });

      const response = await request(app)
        .post("/api/albums/album1/photos")
        .set("Authorization", "Bearer valid-token")
        .send({ photoId: "photo1" })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Photo not found",
      });
    });
  });
});
