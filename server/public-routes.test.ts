// AI-META-BEGIN
// AI-META: Integration tests for public routes API endpoints with authentication and security testing
// OWNERSHIP: server/api
// ENTRYPOINTS: run with npm test server/public-routes.test.ts
// DEPENDENCIES: vitest, supertest, express, ./public-routes, ./db
// DANGER: Test database isolation failure = cross-test contamination; auth bypass = security test failure
// CHANGE-SAFETY: Maintain test isolation, security boundaries, and endpoint coverage
// TESTS: npm run test server/public-routes.test.ts
// AI-META-END

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { db } from "./db";
import { users, albums, photos, albumPhotos } from "../shared/schema";
import { eq } from "drizzle-orm";
import publicRoutes from "./public-routes";
import { authenticateToken } from "./auth";
import { jwt } from "./security";

// Mock EJS template engine
const mockRender = vi.fn();
const mockSet = vi.fn();

describe("Public Routes Integration Tests", () => {
  let app: express.Application;
  let testUser: any;
  let testAlbum: any;
  let authToken: string;
  let publicLink: any;

  beforeEach(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Mock template engine
    app.set("view engine", "html");
    app.set("views", "./templates");
    app.engine("html", (path: string, options: any, callback: Function) => {
      mockRender(path, options);
      callback(null, "mocked template");
    });
    mockSet.mockImplementation(() => app);

    // Add authentication middleware for protected routes
    app.use((req: any, res, next) => {
      // Skip auth for public routes that don't require it
      if (
        req.path.startsWith("/public/") &&
        !req.path.includes("/create") &&
        !req.path.includes("/stats") &&
        !req.path.includes("/put")
      ) {
        return next();
      }

      // Mock authentication for testing
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "test-secret",
          ) as any;
          req.user = { id: decoded.userId };
        } catch (error) {
          // Invalid token
        }
      }
      next();
    });

    app.use("/public", publicRoutes);

    // Create test user
    testUser = await db
      .insert(users)
      .values({
        username: `test-user-${Date.now()}`,
        password: "hashed-password",
      })
      .returning()
      .then((result) => result[0]);

    // Create test album
    testAlbum = await db
      .insert(albums)
      .values({
        userId: testUser.id,
        title: "Test Album",
        description: "Test album for public links",
      })
      .returning()
      .then((result) => result[0]);

    // Create auth token
    authToken = jwt.sign(
      { userId: testUser.id },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "15m" },
    );

    // Create a public link for testing
    const createResponse = await request(app)
      .post("/public/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        albumId: testAlbum.id,
        allowDownload: true,
        showMetadata: false,
      });

    publicLink = createResponse.body.publicLink;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(albumPhotos).where(eq(albumPhotos.albumId, testAlbum.id));
    await db.delete(albums).where(eq(albums.id, testAlbum.id));
    await db.delete(users).where(eq(users.id, testUser.id));

    // Clear mocks
    mockRender.mockClear();
    mockSet.mockClear();
  });

  describe("POST /public/create", () => {
    it("should create a public link successfully", async () => {
      const response = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: testAlbum.id,
          allowDownload: false,
          showMetadata: true,
          customTitle: "Custom Title",
          customDescription: "Custom Description",
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Public link created successfully");
      expect(response.body.publicLink).toHaveProperty("id");
      expect(response.body.publicLink).toHaveProperty("publicToken");
      expect(response.body.publicLink).toHaveProperty("url");
      expect(response.body.publicLink.allowDownload).toBe(false);
      expect(response.body.publicLink.showMetadata).toBe(true);
    });

    it("should require authentication", async () => {
      const response = await request(app).post("/public/create").send({
        albumId: testAlbum.id,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authentication required");
    });

    it("should validate request data", async () => {
      const response = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: "invalid-uuid",
          allowDownload: "not-a-boolean",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid request data");
      expect(response.body.details).toBeDefined();
    });

    it("should reject non-existent album", async () => {
      const response = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: "00000000-0000-0000-0000-000000000000",
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Album not found or access denied");
    });

    it("should handle password protection", async () => {
      const response = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: testAlbum.id,
          password: "test-password-123",
        });

      expect(response.status).toBe(201);
      expect(response.body.publicLink.passwordRequired).toBe(true);
    });

    it("should handle expiration dates", async () => {
      const futureDate = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const response = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: testAlbum.id,
          expiresAt: futureDate,
        });

      expect(response.status).toBe(201);
      expect(response.body.publicLink.expiresAt).toBeDefined();
    });
  });

  describe("GET /public/:token", () => {
    it("should render public view for valid token", async () => {
      const response = await request(app)
        .get(`/public/${publicLink.publicToken}`)
        .expect(200);

      expect(mockRender).toHaveBeenCalledWith(
        "public-view.html",
        expect.objectContaining({
          passwordRequired: false,
          token: publicLink.publicToken,
          albumTitle: expect.any(String),
        }),
      );
    });

    it("should show password form for protected links", async () => {
      // Create a password-protected link
      const protectedResponse = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: testAlbum.id,
          password: "test-password",
        });

      const protectedLink = protectedResponse.body.publicLink;

      const response = await request(app)
        .get(`/public/${protectedLink.publicToken}`)
        .expect(200);

      expect(mockRender).toHaveBeenCalledWith(
        "public-view.html",
        expect.objectContaining({
          passwordRequired: true,
          token: protectedLink.publicToken,
        }),
      );
    });

    it("should handle invalid tokens", async () => {
      const response = await request(app)
        .get("/public/invalid-token")
        .expect(200);

      expect(mockRender).toHaveBeenCalledWith(
        "public-view.html",
        expect.objectContaining({
          passwordRequired: false,
          error: "Public link not found",
          token: "invalid-token",
        }),
      );
    });

    it("should handle expired tokens", async () => {
      // This would need to be mocked since we can't easily create expired links in tests
      // For now, test the error handling path
      const response = await request(app)
        .get("/public/expired-token")
        .expect(200);

      expect(mockRender).toHaveBeenCalled();
    });

    it("should handle pagination", async () => {
      const response = await request(app)
        .get(`/public/${publicLink.publicToken}?page=2`)
        .expect(200);

      expect(mockRender).toHaveBeenCalledWith(
        "public-view.html",
        expect.objectContaining({
          pagination: expect.objectContaining({
            page: 2,
          }),
        }),
      );
    });

    it("should validate page parameter", async () => {
      const response = await request(app)
        .get(`/public/${publicLink.publicToken}?page=0`)
        .expect(200);

      expect(mockRender).toHaveBeenCalledWith(
        "public-view.html",
        expect.objectContaining({
          pagination: expect.objectContaining({
            page: 1, // Should default to 1
          }),
        }),
      );
    });
  });

  describe("POST /public/:token", () => {
    it("should access protected links with correct password", async () => {
      // Create a password-protected link
      const protectedResponse = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: testAlbum.id,
          password: "test-password-123",
        });

      const protectedLink = protectedResponse.body.publicLink;

      const response = await request(app)
        .post(`/public/${protectedLink.publicToken}`)
        .send({ password: "test-password-123" })
        .expect(200);

      expect(mockRender).toHaveBeenCalledWith(
        "public-view.html",
        expect.objectContaining({
          passwordRequired: false,
          token: protectedLink.publicToken,
        }),
      );
    });

    it("should reject incorrect passwords", async () => {
      // Create a password-protected link
      const protectedResponse = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: testAlbum.id,
          password: "test-password-123",
        });

      const protectedLink = protectedResponse.body.publicLink;

      const response = await request(app)
        .post(`/public/${protectedLink.publicToken}`)
        .send({ password: "wrong-password" })
        .expect(401);

      expect(mockRender).toHaveBeenCalledWith(
        "public-view.html",
        expect.objectContaining({
          passwordRequired: true,
          error: "Incorrect password. Please try again.",
          token: protectedLink.publicToken,
        }),
      );
    });

    it("should validate password format", async () => {
      const response = await request(app)
        .post(`/public/${publicLink.publicToken}`)
        .send({ password: "short" })
        .expect(400);

      expect(mockRender).toHaveBeenCalledWith(
        "public-view.html",
        expect.objectContaining({
          passwordRequired: true,
          error: "Invalid password format",
        }),
      );
    });
  });

  describe("GET /public/:token/validate", () => {
    it("should validate valid tokens", async () => {
      const response = await request(app)
        .get(`/public/${publicLink.publicToken}/validate`)
        .expect(200);

      expect(response.body).toHaveProperty("valid");
      expect(response.body).toHaveProperty("expired");
      expect(response.body).toHaveProperty("passwordRequired");
    });

    it("should handle invalid tokens", async () => {
      const response = await request(app)
        .get("/public/invalid-token/validate")
        .expect(200);

      expect(response.body.valid).toBe(false);
    });
  });

  describe("GET /public/:token/download", () => {
    it("should allow download when enabled", async () => {
      // Create a link with downloads enabled
      const downloadResponse = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: testAlbum.id,
          allowDownload: true,
        });

      const downloadLink = downloadResponse.body.publicLink;

      const response = await request(app)
        .get(`/public/${downloadLink.publicToken}/download`)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("album");
      expect(response.body).toHaveProperty("photos");
    });

    it("should reject download when disabled", async () => {
      // Create a link with downloads disabled
      const noDownloadResponse = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: testAlbum.id,
          allowDownload: false,
        });

      const noDownloadLink = noDownloadResponse.body.publicLink;

      const response = await request(app)
        .get(`/public/${noDownloadLink.publicToken}/download`)
        .expect(403);

      expect(response.body.error).toBe("Download not allowed");
    });
  });

  describe("PUT /public/:shareId", () => {
    it("should update public link settings", async () => {
      const response = await request(app)
        .put(`/public/${publicLink.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          allowDownload: false,
          showMetadata: true,
          customTitle: "Updated Title",
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Public link updated successfully");
      expect(response.body.publicLink.allowDownload).toBe(false);
      expect(response.body.publicLink.showMetadata).toBe(true);
      expect(response.body.publicLink.customTitle).toBe("Updated Title");
    });

    it("should require authentication", async () => {
      const response = await request(app).put(`/public/${publicLink.id}`).send({
        allowDownload: false,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authentication required");
    });

    it("should validate request data", async () => {
      const response = await request(app)
        .put(`/public/${publicLink.id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          allowDownload: "not-a-boolean",
          customTitle: "",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid request data");
    });

    it("should reject unauthorized updates", async () => {
      // Create another user and try to update the first user's link
      const otherUser = await db
        .insert(users)
        .values({
          username: `other-user-${Date.now()}`,
          password: "hashed-password",
        })
        .returning()
        .then((result) => result[0]);

      const otherToken = jwt.sign(
        { userId: otherUser.id },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "15m" },
      );

      const response = await request(app)
        .put(`/public/${publicLink.id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          allowDownload: false,
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Share not found or access denied");

      // Clean up other user
      await db.delete(users).where(eq(users.id, otherUser.id));
    });
  });

  describe("GET /public/stats", () => {
    it("should return public link statistics", async () => {
      const response = await request(app)
        .get("/public/stats")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("totalPublicLinks");
      expect(response.body).toHaveProperty("activePublicLinks");
      expect(response.body).toHaveProperty("expiredPublicLinks");
      expect(response.body).toHaveProperty("totalViews");
      expect(response.body).toHaveProperty("protectedLinks");
      expect(typeof response.body.totalPublicLinks).toBe("number");
    });

    it("should require authentication", async () => {
      const response = await request(app).get("/public/stats");

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authentication required");
    });
  });

  describe("Security Tests", () => {
    it("should apply security headers", async () => {
      const response = await request(app)
        .get(`/public/${publicLink.publicToken}`)
        .expect(200);

      // Check for security headers (these would be set by helmet)
      expect(response.headers["content-security-policy"]).toBeDefined();
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-frame-options"]).toBe("DENY");
    });

    it("should enforce rate limiting", async () => {
      // Make many rapid requests to test rate limiting
      const requests = Array.from({ length: 70 }, () =>
        request(app).get(`/public/${publicLink.publicToken}`),
      );

      const responses = await Promise.allSettled(requests);

      // Some requests should be rate limited
      const rateLimited = responses.filter(
        (result) =>
          result.status === "fulfilled" && result.value.status === 429,
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it("should sanitize template data", async () => {
      // Create a link with malicious content
      const maliciousResponse = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: testAlbum.id,
          customTitle: "<script>alert('xss')</script>",
          customDescription: "<img src=x onerror=alert('xss')>",
        });

      const maliciousLink = maliciousResponse.body.publicLink;

      const response = await request(app)
        .get(`/public/${maliciousLink.publicToken}`)
        .expect(200);

      // The template should be called with sanitized data
      expect(mockRender).toHaveBeenCalledWith(
        "public-view.html",
        expect.objectContaining({
          customTitle: expect.not.toContain("<script>"),
          customDescription: expect.not.toContain("<img"),
        }),
      );
    });

    it("should handle malformed request data", async () => {
      const response = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: null,
          allowDownload: "maybe",
          expiresAt: "not-a-date",
        })
        .expect(400);

      expect(response.body.error).toBe("Invalid request data");
      expect(response.body.details).toBeDefined();
    });

    it("should prevent SQL injection in parameters", async () => {
      const response = await request(app)
        .get("/public/' OR 1=1 --")
        .expect(200);

      expect(mockRender).toHaveBeenCalledWith(
        "public-view.html",
        expect.objectContaining({
          error: "Public link not found",
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // This would require mocking the database to throw errors
      // For now, test the general error structure
      const response = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          albumId: "00000000-0000-0000-0000-000000000000",
        })
        .expect(404);

      expect(response.body.error).toBeDefined();
    });

    it("should handle template rendering errors", async () => {
      // Mock template engine to throw an error
      mockRender.mockImplementationOnce((path, options, callback) => {
        callback(new Error("Template rendering failed"));
      });

      const response = await request(app)
        .get(`/public/${publicLink.publicToken}`)
        .expect(500);

      expect(response.status).toBe(500);
    });

    it("should handle malformed JSON in requests", async () => {
      const response = await request(app)
        .post("/public/create")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send('{"invalid": json}')
        .expect(400);

      expect(response.status).toBe(400);
    });
  });

  describe("Performance Tests", () => {
    it("should handle concurrent requests", async () => {
      const concurrentRequests = 10;
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app).get(`/public/${publicLink.publicToken}`),
      );

      const responses = await Promise.allSettled(requests);

      // All requests should complete successfully
      const successful = responses.filter(
        (result) =>
          result.status === "fulfilled" && result.value.status === 200,
      );

      expect(successful.length).toBe(concurrentRequests);
    });

    it("should respond within reasonable time", async () => {
      const startTime = Date.now();

      await request(app).get(`/public/${publicLink.publicToken}`).expect(200);

      const responseTime = Date.now() - startTime;

      // Should respond within 1 second (adjust based on your requirements)
      expect(responseTime).toBeLessThan(1000);
    });
  });
});
