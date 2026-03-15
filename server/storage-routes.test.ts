// AI-META-BEGIN
// AI-META: Integration tests for storage management API endpoints
// OWNERSHIP: server/api
// ENTRYPOINTS: run by npm test for storage API validation
// DEPENDENCIES: vitest, supertest, express, ./storage-routes
// DANGER: Integration tests validate API security and data integrity
// CHANGE-SAFETY: Maintain test coverage for all storage API scenarios
// TESTS: Integration tests for all storage endpoints, error handling, authentication
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import storageRoutes from "./storage-routes";

// Module-scope mock storage service
const mockStorageService = {
  getStorageBreakdown: vi.fn(),
  isNearStorageLimit: vi.fn(),
  getStorageRecommendations: vi.fn(),
  getLargeFiles: vi.fn(),
  compressPhotos: vi.fn(),
  freeUpSpace: vi.fn(),
  updateStorageUsage: vi.fn(),
  getFilesForCleanup: vi.fn(),
  getCompressionCandidates: vi.fn(),
};

// Module-scope mock authenticateToken
const mockAuthenticateToken = vi.fn((req: any, res: any, next: any) => {
  req.user = { id: "test-user-id", email: "test@example.com" };
  next();
});

// Module-scope mock database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Helper function to rebuild mock chains
function rewireMockDb() {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue([]),
      }),
    }),
  });

  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
    }),
  });

  mockDb.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  });
}

// Mock storage service using module-scope mockStorageService
vi.mock("./services/storage-usage", () => ({
  storageUsageService: mockStorageService,
  StorageUsageService: vi.fn(),
  StorageCategory: {},
}));

// Mock database using module-scope mockDb
vi.mock("./db", () => ({
  db: mockDb,
}));

// Mock auth using module-scope mockAuthenticateToken
vi.mock("./auth", () => ({
  authenticateToken: mockAuthenticateToken,
}));

// Base mock breakdown for tests
const baseBreakdown = {
  totalBytesUsed: 1000000,
  totalItemCount: 50,
  storageLimit: 5000000,
  categories: [
    {
      category: "photos",
      bytesUsed: 800000,
      itemCount: 40,
      percentage: 80,
      calculatedAt: new Date(),
    },
    {
      category: "videos",
      bytesUsed: 200000,
      itemCount: 10,
      percentage: 20,
      calculatedAt: new Date(),
    },
  ],
  largeFiles: [],
  compressionStats: {
    originalTotal: 1000000,
    compressedTotal: 800000,
    compressionRatio: 1.25,
    compressedCount: 30,
  },
};

describe("Storage Routes Integration Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    rewireMockDb();

    // Set default mock returns
    mockStorageService.getStorageBreakdown.mockResolvedValue(baseBreakdown);
    mockStorageService.updateStorageUsage.mockResolvedValue(undefined);
    mockStorageService.isNearStorageLimit.mockResolvedValue(false);

    app = express();
    app.use(express.json());
    app.use("/api/storage", storageRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/storage/usage", () => {
    it("should return storage usage breakdown for authenticated user", async () => {
      const mockBreakdown = {
        totalBytesUsed: 1000000,
        totalItemCount: 50,
        storageLimit: 5000000,
        categories: [
          {
            category: "photos",
            bytesUsed: 800000,
            itemCount: 40,
            percentage: 80,
            calculatedAt: new Date(),
          },
          {
            category: "videos",
            bytesUsed: 200000,
            itemCount: 10,
            percentage: 20,
            calculatedAt: new Date(),
          },
        ],
        largeFiles: [],
        compressionStats: {
          originalTotal: 1000000,
          compressedTotal: 800000,
          compressionRatio: 1.25,
          compressedCount: 30,
        },
      };

      mockStorageService.getStorageBreakdown.mockResolvedValue(mockBreakdown);

      const response = await request(app).get("/api/storage/usage").expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockBreakdown,
      });

      expect(mockStorageService.getStorageBreakdown).toHaveBeenCalledWith(
        "test-user-id",
      );
    });

    it("should handle errors gracefully", async () => {
      mockStorageService.getStorageBreakdown.mockRejectedValue(
        new Error("Database error"),
      );

      const response = await request(app).get("/api/storage/usage").expect(500);

      expect(response.body).toEqual({
        error: "Internal server error",
        message: "Failed to retrieve storage usage information",
      });
    });
  });

  describe("POST /api/storage/update", () => {
    it("should update storage usage successfully", async () => {
      mockStorageService.updateStorageUsage.mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/storage/update")
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: "Storage usage updated successfully",
      });

      expect(mockStorageService.updateStorageUsage).toHaveBeenCalledWith(
        "test-user-id",
      );
    });

    it("should handle update errors", async () => {
      mockStorageService.updateStorageUsage.mockRejectedValue(
        new Error("Update failed"),
      );

      const response = await request(app)
        .post("/api/storage/update")
        .expect(500);

      expect(response.body).toEqual({
        error: "Internal server error",
        message: "Failed to update storage usage",
      });
    });
  });

  describe("POST /api/storage/free-up", () => {
    it("should free up space with old-photos strategy", async () => {
      mockStorageService.getFilesForCleanup.mockResolvedValue([
        "photo1",
        "photo2",
        "photo3",
      ]);

      // Mock database operations
      mockDb.select.mockReturnValue({
        execute: vi.fn().mockResolvedValue([{ originalSize: 1000000 }]),
      });
      mockDb.update.mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const response = await request(app)
        .post("/api/storage/free-up")
        .send({ strategy: "old-photos", limit: 10, dryRun: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.strategy).toBe("old-photos");
      expect(response.body.data.dryRun).toBe(false);
    });

    it("should handle dry run mode", async () => {
      mockStorageService.getFilesForCleanup.mockResolvedValue([
        "photo1",
        "photo2",
      ]);

      mockDb.select.mockReturnValue({
        execute: vi.fn().mockResolvedValue([{ originalSize: 500000 }]),
      });

      const response = await request(app)
        .post("/api/storage/free-up")
        .send({ strategy: "old-photos", dryRun: true })
        .expect(200);

      expect(response.body.data.dryRun).toBe(true);
      expect(response.body.data.filesDeleted).toBe(2);
    });

    it("should validate request body", async () => {
      const response = await request(app)
        .post("/api/storage/free-up")
        .send({ strategy: "invalid-strategy" })
        .expect(500); // Zod validation error
    });
  });

  describe("POST /api/storage/compress", () => {
    it("should compress photos successfully", async () => {
      mockDb.select.mockReturnValue({
        execute: vi.fn().mockResolvedValue([
          { id: "photo1", uri: "/path/photo1.jpg", originalSize: 1000000 },
          { id: "photo2", uri: "/path/photo2.jpg", originalSize: 2000000 },
        ]),
      });
      mockDb.update.mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const response = await request(app)
        .post("/api/storage/compress")
        .send({ quality: 0.8, threshold: 1000000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.photosProcessed).toBe(2);
      expect(response.body.data.totalSaved).toBeGreaterThan(0);
      expect(response.body.data.results).toHaveLength(2);
    });

    it("should compress specific photos when photoIds provided", async () => {
      mockDb.select.mockReturnValue({
        execute: vi
          .fn()
          .mockResolvedValue([
            { id: "photo1", uri: "/path/photo1.jpg", originalSize: 1000000 },
          ]),
      });
      mockDb.update.mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const response = await request(app)
        .post("/api/storage/compress")
        .send({ photoIds: ["photo1"], quality: 0.9 })
        .expect(200);

      expect(response.body.data.photosProcessed).toBe(1);
    });

    it("should handle compression errors per photo", async () => {
      mockDb.select.mockReturnValue({
        execute: vi
          .fn()
          .mockResolvedValue([
            { id: "photo1", uri: "/path/photo1.jpg", originalSize: 1000000 },
          ]),
      });
      mockDb.update.mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockRejectedValue(new Error("Compression failed")),
        }),
      });

      const response = await request(app)
        .post("/api/storage/compress")
        .send({ quality: 0.8 })
        .expect(200);

      expect(response.body.data.results[0]).toHaveProperty("error");
    });
  });

  describe("GET /api/storage/large-files", () => {
    it("should return large files with default threshold", async () => {
      const mockBreakdown = {
        largeFiles: [
          {
            id: "file1",
            filename: "video1.mp4",
            size: 15000000,
            uri: "/path/video1.mp4",
            isVideo: true,
          },
          {
            id: "file2",
            filename: "photo1.jpg",
            size: 12000000,
            uri: "/path/photo1.jpg",
            isVideo: false,
          },
        ],
      };

      mockStorageService.getStorageBreakdown.mockResolvedValue(mockBreakdown);

      const response = await request(app)
        .get("/api/storage/large-files")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.threshold).toBe(10 * 1024 * 1024); // 10MB default
      expect(response.body.data.largeFiles).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
    });

    it("should use custom threshold", async () => {
      const mockBreakdown = {
        largeFiles: [
          {
            id: "file1",
            filename: "video1.mp4",
            size: 25000000,
            uri: "/path/video1.mp4",
            isVideo: true,
          },
        ],
      };

      mockStorageService.getStorageBreakdown.mockResolvedValue(mockBreakdown);

      const response = await request(app)
        .get("/api/storage/large-files?threshold=20000000")
        .expect(200);

      expect(response.body.data.threshold).toBe(20000000);
    });
  });

  describe("GET /api/storage/status", () => {
    it("should return storage status with warnings and recommendations", async () => {
      const mockBreakdown = {
        totalBytesUsed: 4500000,
        totalItemCount: 100,
        storageLimit: 5000000,
        categories: [
          {
            category: "photos",
            bytesUsed: 3000000,
            itemCount: 80,
            percentage: 66.7,
            calculatedAt: new Date(),
          },
          {
            category: "videos",
            bytesUsed: 1500000,
            itemCount: 20,
            percentage: 33.3,
            calculatedAt: new Date(),
          },
        ],
        largeFiles: [
          {
            id: "file1",
            filename: "video1.mp4",
            size: 15000000,
            uri: "/path/video1.mp4",
            isVideo: true,
          },
        ],
        compressionStats: {
          originalTotal: 4500000,
          compressedTotal: 3500000,
          compressionRatio: 1.29,
          compressedCount: 60,
        },
      };

      mockStorageService.getStorageBreakdown.mockResolvedValue(mockBreakdown);
      mockStorageService.isNearStorageLimit.mockResolvedValue(true);

      const response = await request(app)
        .get("/api/storage/status")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalUsed).toBe(4500000);
      expect(response.body.data.totalLimit).toBe(5000000);
      expect(response.body.data.usagePercentage).toBe(90);
      expect(response.body.data.isNearLimit).toBe(true);
      expect(response.body.data.warnings).toContain(
        "Storage limit approaching",
      );
      expect(response.body.data.recommendations).toBeDefined();
    });

    it("should handle unlimited storage", async () => {
      const mockBreakdown = {
        totalBytesUsed: 1000000,
        totalItemCount: 50,
        storageLimit: null,
        categories: [],
        largeFiles: [],
        compressionStats: {
          originalTotal: 1000000,
          compressedTotal: 800000,
          compressionRatio: 1.25,
          compressedCount: 30,
        },
      };

      mockStorageService.getStorageBreakdown.mockResolvedValue(mockBreakdown);
      mockStorageService.isNearStorageLimit.mockResolvedValue(false);

      const response = await request(app)
        .get("/api/storage/status")
        .expect(200);

      expect(response.body.data.totalLimit).toBe(null);
      expect(response.body.data.usagePercentage).toBe(0);
      expect(response.body.data.isNearLimit).toBe(false);
    });
  });

  describe("Authentication", () => {
    it("should require authentication for all endpoints", async () => {
      // Override the mockAuthenticateToken to reject requests
      mockAuthenticateToken.mockImplementation(
        (req: any, res: any, next: any) => {
          res.status(401).json({ error: "User not authenticated" });
        },
      );

      // Test all endpoints require auth
      const endpoints = [
        { method: "get", path: "/api/storage/usage" },
        { method: "post", path: "/api/storage/update" },
        { method: "post", path: "/api/storage/free-up" },
        { method: "post", path: "/api/storage/compress" },
        { method: "get", path: "/api/storage/large-files" },
        { method: "get", path: "/api/storage/status" },
      ];

      for (const endpoint of endpoints) {
        if (endpoint.method === "get") {
          await request(app).get(endpoint.path).expect(401);
        } else if (endpoint.method === "post") {
          await request(app).post(endpoint.path).expect(401);
        }
      }

      // Restore the original mock behavior
      mockAuthenticateToken.mockImplementation(
        (req: any, res: any, next: any) => {
          req.user = { id: "test-user-id", email: "test@example.com" };
          next();
        },
      );
    });
  });
});
