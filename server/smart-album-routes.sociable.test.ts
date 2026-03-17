// Sociable tests for smart albums routes - eliminates interaction-only assertions
// Tests behavior and outcomes instead of implementation details

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  createTestUser,
  createTestPhotos,
  createTestAlbum,
} from "../test-utils/test-database";
import { seedTestData, clearTestData } from "../test-utils/test-factories";

// Mock only external boundaries
vi.mock("../auth", () => ({
  authenticateToken: vi.fn((req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token && token.startsWith("Bearer test-token-")) {
      const userId = token.split("-")[3];
      req.user = { id: userId, email: `user-${userId}@example.com` };
      next();
    } else {
      return res.status(401).json({
        error: "Access token required",
        message: "Please provide a valid access token",
      });
    }
  }),
}));

describe("Smart Albums Routes (Sociable Tests - No Interaction Assertions)", () => {
  let app: express.Application;
  let db: any;
  let testUser: any;
  let testPhotos: any[];
  let testAlbums: any[];

  beforeEach(async () => {
    // Set up real in-memory database
    db = await setupTestDatabase();

    // Create Express app
    app = express();
    app.use(express.json());

    // Import and use real smart albums routes
    const smartAlbumsRoutes = (await import("../smart-album-routes")).default;
    app.use("/api/smart-albums", smartAlbumsRoutes);

    // Create test data
    testUser = createTestUser();
    testPhotos = createTestPhotos(testUser.id, 20);
    testAlbums = createTestAlbums(testUser.id, 3);

    // Seed database with realistic test data
    await seedTestData(db, {
      user: testUser,
      photos: testPhotos,
      albums: testAlbums,
    });
  });

  afterEach(async () => {
    cleanupTestDatabase();
  });

  describe("GET /api/smart-albums/generate", () => {
    it("should generate smart albums based on existing photos", async () => {
      const token = `Bearer test-token-${testUser.id}`;

      const response = await request(app)
        .post("/api/smart-albums/generate")
        .set("Authorization", token)
        .expect(200);

      // Test behavior and outcome - not implementation
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("albums");
      expect(response.body.data).toHaveProperty("generatedAt");

      // Verify smart albums were created with expected structure
      const albums = response.body.data.albums;
      expect(albums).toBeInstanceOf(Array);
      expect(albums.length).toBeGreaterThan(0);

      // Check that albums have expected properties
      albums.forEach((album) => {
        expect(album).toHaveProperty("id");
        expect(album).toHaveProperty("title");
        expect(album).toHaveProperty("type", "smart");
        expect(album).toHaveProperty("photoCount");
        expect(album).toHaveProperty("createdAt");
        expect(album.userId).toBe(testUser.id);
      });

      // Verify specific smart album types were generated
      const albumTitles = albums.map((a: any) => a.title);
      expect(albumTitles).toContain("Recent Photos");
      expect(albumTitles).toContain("Favorites");

      // Verify database state - albums were actually saved
      const savedAlbums = await db.query.smartAlbums.findMany({
        where: (albums, { eq }) => eq(albums.userId, testUser.id),
      });
      expect(savedAlbums.length).toBe(albums.length);
    });

    it("should return different results for different users", async () => {
      // Create another user with different photos
      const otherUser = createTestUser();
      const otherPhotos = createTestPhotos(otherUser.id, 5);
      await seedTestData(db, {
        user: otherUser,
        photos: otherPhotos,
        albums: [],
      });

      const token1 = `Bearer test-token-${testUser.id}`;
      const token2 = `Bearer test-token-${otherUser.id}`;

      const response1 = await request(app)
        .post("/api/smart-albums/generate")
        .set("Authorization", token1)
        .expect(200);

      const response2 = await request(app)
        .post("/api/smart-albums/generate")
        .set("Authorization", token2)
        .expect(200);

      // Test behavior - users get different results
      expect(response1.body.data.albums).not.toEqual(
        response2.body.data.albums,
      );
      expect(response1.body.data.albums.length).toBeGreaterThan(
        response2.body.data.albums.length,
      );
    });
  });

  describe("PUT /api/smart-albums/:id/settings", () => {
    it("should update smart album settings", async () => {
      const token = `Bearer test-token-${testUser.id}`;

      // First generate some smart albums
      await request(app)
        .post("/api/smart-albums/generate")
        .set("Authorization", token)
        .expect(200);

      // Get the generated albums
      const albumsResponse = await request(app)
        .get("/api/smart-albums")
        .set("Authorization", token)
        .expect(200);

      const albumId = albumsResponse.body.data[0].id;
      const newSettings = { isPinned: true, isHidden: false };

      const response = await request(app)
        .put(`/api/smart-albums/${albumId}/settings`)
        .set("Authorization", token)
        .send(newSettings)
        .expect(200);

      // Test outcome - settings were updated
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toMatchObject(newSettings);
      expect(response.body.data.updatedAt).toBeDefined();

      // Verify database state was actually updated
      const updatedAlbum = await db.query.smartAlbums.findFirst({
        where: (albums, { eq }) => eq(albums.id, albumId),
      });
      expect(updatedAlbum?.isPinned).toBe(true);
      expect(updatedAlbum?.isHidden).toBe(false);
    });

    it("should reject settings update for non-existent album", async () => {
      const token = `Bearer test-token-${testUser.id}`;
      const fakeAlbumId = "non-existent-album-id";
      const settings = { isPinned: true };

      const response = await request(app)
        .put(`/api/smart-albums/${fakeAlbumId}/settings`)
        .set("Authorization", token)
        .send(settings)
        .expect(404);

      // Test error behavior
      expect(response.body).toHaveProperty("success", false);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("not found");
    });
  });

  describe("GET /api/smart-albums/:id/photos", () => {
    it("should get photos for a smart album", async () => {
      const token = `Bearer test-token-${testUser.id}`;

      // Generate smart albums first
      await request(app)
        .post("/api/smart-albums/generate")
        .set("Authorization", token)
        .expect(200);

      // Get albums to find one with photos
      const albumsResponse = await request(app)
        .get("/api/smart-albums")
        .set("Authorization", token)
        .expect(200);

      const albumWithPhotos = albumsResponse.body.data.find(
        (a: any) => a.photoCount > 0,
      );
      const albumId = albumWithPhotos.id;

      const response = await request(app)
        .get(`/api/smart-albums/${albumId}/photos`)
        .set("Authorization", token)
        .expect(200);

      // Test behavior - photos are returned with correct structure
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("photos");
      expect(response.body.data).toHaveProperty("pagination");

      const photos = response.body.data.photos;
      expect(photos).toBeInstanceOf(Array);
      expect(photos.length).toBeGreaterThan(0);
      expect(photos.length).toBeLessThanOrEqual(20); // Default limit

      // Verify photo structure
      photos.forEach((photo: any) => {
        expect(photo).toHaveProperty("id");
        expect(photo).toHaveProperty("uri");
        expect(photo).toHaveProperty("width");
        expect(photo).toHaveProperty("height");
        expect(photo).toHaveProperty("createdAt");
        expect(photo.userId).toBe(testUser.id);
      });

      // Test pagination behavior
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: expect.any(Number),
        hasMore: expect.any(Boolean),
      });
    });

    it("should respect pagination parameters", async () => {
      const token = `Bearer test-token-${testUser.id}`;

      // Generate smart albums
      await request(app)
        .post("/api/smart-albums/generate")
        .set("Authorization", token)
        .expect(200);

      const albumsResponse = await request(app)
        .get("/api/smart-albums")
        .set("Authorization", token)
        .expect(200);

      const albumWithPhotos = albumsResponse.body.data.find(
        (a: any) => a.photoCount > 5,
      );
      const albumId = albumWithPhotos.id;

      // Request first page with limit 5
      const response1 = await request(app)
        .get(`/api/smart-albums/${albumId}/photos?page=1&limit=5`)
        .set("Authorization", token)
        .expect(200);

      // Request second page
      const response2 = await request(app)
        .get(`/api/smart-albums/${albumId}/photos?page=2&limit=5`)
        .set("Authorization", token)
        .expect(200);

      // Test pagination behavior
      expect(response1.body.data.photos).toHaveLength(5);
      expect(response1.body.data.pagination.page).toBe(1);
      expect(response1.body.data.pagination.limit).toBe(5);

      // Photos should be different between pages
      const photoIds1 = response1.body.data.photos.map((p: any) => p.id);
      const photoIds2 = response2.body.data.photos.map((p: any) => p.id);
      const overlap = photoIds1.filter((id: string) => photoIds2.includes(id));
      expect(overlap.length).toBe(0);
    });
  });

  describe("POST /api/smart-albums/update-for-new-photos", () => {
    it("should update smart albums when new photos are added", async () => {
      const token = `Bearer test-token-${testUser.id}`;

      // Generate initial smart albums
      await request(app)
        .post("/api/smart-albums/generate")
        .set("Authorization", token)
        .expect(200);

      const initialAlbumsResponse = await request(app)
        .get("/api/smart-albums")
        .set("Authorization", token)
        .expect(200);

      const initialPhotoCount = initialAlbumsResponse.body.data.reduce(
        (sum: number, album: any) => sum + album.photoCount,
        0,
      );

      // Add new photos
      const newPhotos = createTestPhotos(testUser.id, 3);
      for (const photo of newPhotos) {
        await db.insert(schema.photos).values(photo);
      }

      // Trigger smart album update
      const photoIds = newPhotos.map((p) => p.id);
      const response = await request(app)
        .post("/api/smart-albums/update-for-new-photos")
        .set("Authorization", token)
        .send({ photoIds })
        .expect(200);

      // Test behavior - albums were updated
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("updatedAlbums");
      expect(response.body.data).toHaveProperty("message");

      // Verify photo counts increased
      const updatedAlbumsResponse = await request(app)
        .get("/api/smart-albums")
        .set("Authorization", token)
        .expect(200);

      const updatedPhotoCount = updatedAlbumsResponse.body.data.reduce(
        (sum: number, album: any) => sum + album.photoCount,
        0,
      );

      expect(updatedPhotoCount).toBeGreaterThan(initialPhotoCount);
    });
  });

  describe("Error Handling", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/smart-albums/generate")
        .expect(401);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("token required");
    });

    it("should reject invalid album settings", async () => {
      const token = `Bearer test-token-${testUser.id}`;
      const invalidSettings = { isPinned: "not-a-boolean" };

      const response = await request(app)
        .put("/api/smart-albums/invalid-id/settings")
        .set("Authorization", token)
        .send(invalidSettings)
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("validation");
    });

    it("should handle database errors gracefully", async () => {
      // Close database to simulate error
      cleanupTestDatabase();

      const token = `Bearer test-token-${testUser.id}`;
      const response = await request(app)
        .post("/api/smart-albums/generate")
        .set("Authorization", token)
        .expect(500);

      expect(response.body).toHaveProperty("error");
      expect(response.body).toHaveProperty("success", false);
    });
  });
});
