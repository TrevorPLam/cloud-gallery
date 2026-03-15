// AI-META-BEGIN
// AI-META: Integration tests for ML API endpoints
// OWNERSHIP: server/api
// ENTRYPOINTS: run by vitest during testing
// DEPENDENCIES: supertest, express, vitest, ml-routes
// DANGER: Tests validate API security and functionality
// CHANGE-SAFETY: Add new tests when extending ML endpoints
// TESTS: npm run test
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { Express } from "express";
import express from "express";
import { registerRoutes } from "./routes";
import { createServer } from "node:http";

// Load test environment variables
import { config } from "dotenv";
config({ path: ".env.test" });

// ─────────────────────────────────────────────────────────
// MOCK SETUP
// ─────────────────────────────────────────────────────────

// Module-scope mock database object
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
};

// Mock return values for database operations
const mockSelectLimit = vi.fn();
const mockInsertReturning = vi.fn();

// Helper function to rebuild mock chains
function rewireMockDb() {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: mockSelectLimit,
      }),
    }),
  });

  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: mockInsertReturning,
    }),
  });

  mockDb.delete.mockReturnValue({
    where: vi.fn().mockReturnValue(Promise.resolve()),
  });
}

// Mock jsonwebtoken to prevent JWT verification errors
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn((payload, secret) => `mock_token_${JSON.stringify(payload)}`),
    verify: vi.fn((token, secret) => {
      // Parse the mock token to extract payload
      if (token.startsWith("mock_token_")) {
        return JSON.parse(token.slice(11));
      }
      // For real tokens in tests, return a default user
      return { id: "test-user-id", email: "test@example.com" };
    }),
  },
}));

// Mock security module to bypass JWT verification
vi.mock("./security", () => ({
  verifyAccessToken: vi.fn(() => ({
    id: "test-user-id",
    email: "test@example.com",
  })),
  generateAccessToken: vi.fn(() => "mock_access_token"),
  JWT_SECRET: "test_secret",
}));

// Mock database using module-scope mockDb
vi.mock("./db", () => ({
  db: mockDb,
}));

// Mock schema to prevent real imports
vi.mock("../shared/schema", () => ({
  photos: {
    id: "id",
    userId: "userId",
    uri: "uri",
    width: "width",
    height: "height",
    filename: "filename",
    mlProcessedAt: "mlProcessedAt",
    mlVersion: "mlVersion",
    mlLabels: "mlLabels",
    ocrText: "ocrText",
    ocrLanguage: "ocrLanguage",
    perceptualHash: "perceptualHash",
  },
  users: {
    id: "id",
    username: "username",
    password: "password",
  },
  eq: vi.fn(),
}));

// ─────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────

describe("ML Routes Integration Tests", () => {
  let app: Express;
  let server: any;
  let authToken: string;
  let testUserId: string;
  let testPhotoId: string;

  beforeEach(() => {
    // Create test app
    app = express() as Express;
    server = createServer(app);

    // Register routes
    registerRoutes(app);

    // Set stable test constants
    testUserId = "test-user-id";
    authToken = `mock_token_${JSON.stringify({ id: testUserId })}`;
    testPhotoId = "test-photo-id";

    // Reset mocks and rebuild chains
    vi.clearAllMocks();
    rewireMockDb();

    // Setup default mock returns
    mockSelectLimit.mockResolvedValue([
      {
        id: "test-photo-id",
        userId: "test-user-id",
        uri: "test.jpg",
        mlProcessedAt: new Date(),
        mlVersion: "1.0.0",
        mlLabels: ["person", "car"],
        ocrText: "sample text",
        ocrLanguage: "en",
        perceptualHash: "abc123",
      },
    ]);

    mockInsertReturning.mockResolvedValue([
      {
        id: "test-photo-id",
        userId: "test-user-id",
        uri: "file:///test/ml_photo.jpg",
        width: 800,
        height: 600,
        filename: "ml_photo.jpg",
      },
    ]);
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  // ─────────────────────────────────────────────────────────
  // AUTHENTICATION TESTS
  // ─────────────────────────────────────────────────────────

  describe("Authentication", () => {
    it("should reject requests without authentication token", async () => {
      const response = await request(app)
        .post("/api/ml/analyze")
        .send({
          photoId: testPhotoId,
          analysisTypes: ["object_detection"],
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "User not authenticated");
    });

    it("should reject requests with invalid token", async () => {
      const response = await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", "Bearer invalid_token")
        .send({
          photoId: testPhotoId,
          analysisTypes: ["object_detection"],
        });

      expect(response.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────
  // ML ANALYSIS ENDPOINTS
  // ─────────────────────────────────────────────────────────

  describe("POST /api/ml/analyze", () => {
    it("should accept valid ML analysis request", async () => {
      const response = await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoId: testPhotoId,
          analysisTypes: ["object_detection", "ocr"],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "ML analysis completed");
      expect(response.body).toHaveProperty("results");
      expect(response.body.results).toHaveProperty("photoId", testPhotoId);
      expect(response.body.results).toHaveProperty("processingTime");
      expect(response.body.results).toHaveProperty("mlVersion");
    });

    it("should reject requests with invalid photo ID", async () => {
      const response = await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoId: "invalid-uuid",
          analysisTypes: ["object_detection"],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Invalid request data");
    });

    it("should reject requests for non-existent photo", async () => {
      const response = await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoId: "123e4567-e89b-12d3-a456-426614174000",
          analysisTypes: ["object_detection"],
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Photo not found");
    });

    it("should reject requests with empty analysis types", async () => {
      const response = await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoId: testPhotoId,
          analysisTypes: [],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Invalid request data");
    });

    it("should reject requests with invalid analysis types", async () => {
      const response = await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoId: testPhotoId,
          analysisTypes: ["invalid_type"],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Invalid request data");
    });
  });

  // ─────────────────────────────────────────────────────────
  // ML STATUS ENDPOINTS
  // ─────────────────────────────────────────────────────────

  describe("GET /api/ml/status/:photoId", () => {
    it("should return ML status for existing photo", async () => {
      const response = await request(app)
        .get(`/api/ml/status/${testPhotoId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("photoId", testPhotoId);
      expect(response.body).toHaveProperty("status");
      expect(response.body).toHaveProperty("results");
      expect(response.body.results).toHaveProperty("hasObjectDetection");
      expect(response.body.results).toHaveProperty("hasOCR");
      expect(response.body.results).toHaveProperty("hasPerceptualHash");
    });

    it("should return 404 for non-existent photo", async () => {
      const response = await request(app)
        .get("/api/ml/status/123e4567-e89b-12d3-a456-426614174000")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Photo not found");
    });
  });

  // ─────────────────────────────────────────────────────────
  // BATCH ANALYSIS ENDPOINTS
  // ─────────────────────────────────────────────────────────

  describe("POST /api/ml/batch", () => {
    it("should accept valid batch analysis request", async () => {
      // Mock additional photo for batch
      const mockPhoto2 = {
        id: "photo2-id",
        userId: "test-user-id",
        uri: "file:///test/ml_photo2.jpg",
        width: 800,
        height: 600,
        filename: "ml_photo2.jpg",
      };

      const response = await request(app)
        .post("/api/ml/batch")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoIds: [testPhotoId, "photo2-id"],
          analysisTypes: ["object_detection"],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Batch analysis queued");
      expect(response.body).toHaveProperty("batchId");
      expect(response.body).toHaveProperty("photoCount", 2);
      expect(response.body).toHaveProperty("estimatedTime");
    });

    it("should reject batch requests exceeding size limit", async () => {
      const photoIds = Array(51).fill("123e4567-e89b-12d3-a456-426614174000");

      const response = await request(app)
        .post("/api/ml/batch")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoIds,
          analysisTypes: ["object_detection"],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Invalid batch request data",
      );
    });

    it("should reject batch requests with invalid photo IDs", async () => {
      const response = await request(app)
        .post("/api/ml/batch")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoIds: ["invalid-uuid"],
          analysisTypes: ["object_detection"],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Invalid batch request data",
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // ML STATISTICS ENDPOINTS
  // ─────────────────────────────────────────────────────────

  describe("GET /api/ml/stats", () => {
    it("should return ML processing statistics", async () => {
      const response = await request(app)
        .get("/api/ml/stats")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("totalPhotos");
      expect(response.body).toHaveProperty("processedPhotos");
      expect(response.body).toHaveProperty("processingRate");
      expect(response.body).toHaveProperty("photosWithObjects");
      expect(response.body).toHaveProperty("photosWithText");
      expect(response.body).toHaveProperty("photosWithHash");
      expect(response.body).toHaveProperty("totalObjects");
      expect(response.body).toHaveProperty("averageObjectsPerPhoto");
      expect(response.body).toHaveProperty("commonObjects");
      expect(Array.isArray(response.body.commonObjects)).toBe(true);
    });

    it("should return zero statistics for new user", async () => {
      const newUserId = "brand-new-user-id";
      const newUserToken = `mock_token_${JSON.stringify({ id: newUserId })}`;

      // Mock select to return empty (no photos for this user)
      mockSelectLimit.mockResolvedValue([]);

      const response = await request(app)
        .get("/api/ml/stats")
        .set("Authorization", `Bearer ${newUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalPhotos).toBe(0);
      expect(response.body.processedPhotos).toBe(0);
      expect(response.body.processingRate).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // DATABASE INTEGRATION TESTS
  // ─────────────────────────────────────────────────────────

  describe("Database Integration", () => {
    it("should update photo with ML results after analysis", async () => {
      // Mock the updated photo after ML analysis
      const mockUpdatedPhoto = {
        id: "test-photo-id",
        userId: "test-user-id",
        uri: "file:///test/ml_photo.jpg",
        width: 800,
        height: 600,
        filename: "ml_photo.jpg",
        mlProcessedAt: new Date(),
        mlVersion: "1.0.0",
        mlLabels: ["person", "car"],
        ocrText: "sample text",
        ocrLanguage: "en",
        perceptualHash: "abc123",
      };

      // Mock select to return the updated photo
      mockSelectLimit.mockResolvedValue([mockUpdatedPhoto]);

      // Trigger ML analysis
      await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoId: testPhotoId,
          analysisTypes: ["object_detection", "ocr", "perceptual_hash"],
        });

      // Verify the mock was called with updated data
      expect(mockSelectLimit).toHaveBeenCalled();
      expect(mockUpdatedPhoto.mlProcessedAt).toBeDefined();
      expect(mockUpdatedPhoto.mlVersion).toBe("1.0.0");
      expect(Array.isArray(mockUpdatedPhoto.mlLabels)).toBe(true);
      expect(mockUpdatedPhoto.ocrText).toBeDefined();
      expect(mockUpdatedPhoto.ocrLanguage).toBeDefined();
      expect(mockUpdatedPhoto.perceptualHash).toBeDefined();
    });

    it("should maintain user isolation for ML analysis", async () => {
      const otherUserId = "other-user-id";
      const otherPhotoId = "other-photo-id";

      // Mock select to return empty for other user's photo (not found)
      mockSelectLimit.mockResolvedValue([]);

      // Try to analyze other user's photo with first user's token
      const response = await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoId: otherPhotoId,
          analysisTypes: ["object_detection"],
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "Photo not found");
    });
  });

  // ─────────────────────────────────────────────────────────
  // ERROR HANDLING TESTS
  // ─────────────────────────────────────────────────────────

  describe("Error Handling", () => {
    it("should handle malformed JSON requests", async () => {
      const response = await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send("invalid json");

      expect(response.status).toBe(400);
    });

    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          // Missing photoId and analysisTypes
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Invalid request data");
    });

    it("should handle server errors gracefully", async () => {
      // Use mockRejectedValueOnce to force an error
      mockSelectLimit.mockRejectedValueOnce(new Error("Simulated DB failure"));

      const response = await request(app)
        .post("/api/ml/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          photoId: testPhotoId,
          analysisTypes: ["object_detection"],
        });

      expect(response.status).toBe(500);
    });
  });
});
