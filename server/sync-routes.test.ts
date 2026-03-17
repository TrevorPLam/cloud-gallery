// AI-META-BEGIN
// AI-META: Integration tests for sync API endpoints with standardized async patterns
// OWNERSHIP: server/api
// ENTRYPOINTS: run by test runner
// DEPENDENCIES: vitest, supertest, express, drizzle-orm, ../sync-routes, async-testing utilities
// DANGER: Test failures = API bugs; authentication test failures = security vulnerabilities
// CHANGE-SAFETY: Maintain comprehensive test coverage for all API endpoints and error scenarios
// TESTS: Integration tests validate API functionality, authentication, and error handling with proper async patterns
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import syncRoutes from "./sync-routes";
import { createSyncService } from "./services/sync";
import { authenticateToken } from "./auth";
import { createMockAuthMiddleware } from "./__mocks__/auth-middleware";
import { createMockDatabase } from "./__mocks__/database";
import { 
  waitForAsync, 
  createAsyncMock, 
  createMockAsyncService,
  withFakeTimers,
  expectAsyncRejection
} from "../tests/utils/async-testing";
import { createAsyncMockFactory, setupAsyncTestIsolation } from "../tests/utils/test-isolation";

// Setup async test isolation
setupAsyncTestIsolation();

// Create async mock factory for this test file
const mockFactory = createAsyncMockFactory();

// Mock dependencies using standardized patterns
vi.mock("./services/sync");
vi.mock("./auth", () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: "test-user-id", email: "test@example.com" };
    next();
  }),
}));

// Use mock auth middleware
const getMockAuth = () => createMockAuthMiddleware();

// Create test app factory
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/sync", syncRoutes);
  return app;
};

describe("Sync API Routes", () => {
  let app: express.Application;
  let mockAuth: any;
  const mockUser = { id: "test-user-id", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create fresh app for each test
    app = createTestApp();
    
    // Setup mock auth
    const auth = getMockAuth();
    mockAuth = auth.mockAuth;

    // Setup sync service mock using standardized async patterns
    const mockSync = createMockAsyncService({
      registerDevice: async (userId: string, deviceId: string, deviceType: string, deviceName: string, appVersion: string) => ({
        id: "device-id",
        userId,
        deviceId,
        deviceType,
        deviceName,
        appVersion,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getSyncStatus: async (userId: string, deviceId: string) => ({
        deviceId,
        userId,
        lastSyncAt: new Date(),
        pendingOperations: 0,
        conflicts: 0,
        syncInProgress: false,
      }),
      triggerSync: async (userId: string, deviceId: string) => "sync-job-123",
      performDeltaSync: async (userId: string, deviceId: string) => ({
        added: [{ id: "photo-1", uri: "file://photo1.jpg" }],
        updated: [{ id: "photo-2", uri: "file://photo2.jpg" }],
        deleted: ["photo-3"],
        conflicts: [],
      }),
      detectConflicts: async (userId: string, deviceId: string, localData: any[], remoteData: any[]) => [
        {
          id: "conflict-1",
          type: "concurrent_update",
          deviceId,
          photoId: "photo-1",
          localData: localData[0],
          remoteData: remoteData[0],
          strategy: "last_write_wins",
          resolved: false,
          timestamp: new Date(),
        },
      ],
      resolveConflict: async (conflictId: string, strategy: string, resolution: any) => ({
        id: "photo-1",
        value: "resolved",
      }),
      getUserDevices: async (userId: string) => [
        {
          id: "device-1",
          userId,
          deviceId: "phone-123",
          deviceType: "phone",
          deviceName: "iPhone 14",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      removeDevice: async (userId: string, deviceId: string) => undefined,
    });
    
    vi.mocked(createSyncService).mockReturnValue(mockSync);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockFactory.clearAll();
  });

  describe("POST /api/sync/register", () => {
    it("should register a new device successfully", async () => {
      const deviceData = {
        deviceId: "test-device-123",
        deviceType: "phone",
        deviceName: "iPhone 14",
        appVersion: "1.0.0",
      };

      await withFakeTimers(async () => {
        const response = await request(app)
          .post("/api/sync/register")
          .set("Authorization", "Bearer valid-token")
          .send(deviceData);

        await waitForAsync(async () => {
          expect(response.status).toBe(201);
          expect(response.body).toEqual({
            success: true,
            device: {
              id: "device-id",
              userId: mockUser.id,
              ...deviceData,
              isActive: true,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
            },
            message: "Device registered successfully",
          });
        });
      });
    });

    it("should return 400 for invalid request data", async () => {
      const invalidData = {
        deviceId: "", // Invalid: empty string
        deviceType: "invalid-type", // Invalid: not in enum
        deviceName: "", // Invalid: empty string
      };

      await withFakeTimers(async () => {
        const response = await request(app)
          .post("/api/sync/register")
          .set("Authorization", "Bearer valid-token")
          .send(invalidData);

        await waitForAsync(async () => {
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBe("Invalid request data");
          expect(response.body.details).toBeDefined();
        });
      });
    });

    it("should return 500 when service fails", async () => {
      const deviceData = {
        deviceId: "test-device-123",
        deviceType: "phone",
        deviceName: "iPhone 14",
      };

      // Mock service failure
      const mockSync = createMockAsyncService({
        registerDevice: async () => {
          throw new Error("Service error");
        },
      });
      vi.mocked(createSyncService).mockReturnValue(mockSync);

      await withFakeTimers(async () => {
        const response = await request(app)
          .post("/api/sync/register")
          .set("Authorization", "Bearer valid-token")
          .send(deviceData);

        await waitForAsync(async () => {
          expect(response.status).toBe(500);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBe("Failed to register device");
        });
      });
    });
  });

  describe("GET /api/sync/status", () => {
    it("should return sync status for valid device", async () => {
      const deviceId = "test-device-123";

      await withFakeTimers(async () => {
        const response = await request(app)
          .get("/api/sync/status")
          .set("Authorization", "Bearer valid-token")
          .set("x-device-id", deviceId);

        await waitForAsync(async () => {
          expect(response.status).toBe(200);
          expect(response.body).toEqual({
            success: true,
            status: {
              deviceId,
              userId: mockUser.id,
              lastSyncAt: expect.any(String),
              pendingOperations: 0,
              conflicts: 0,
              syncInProgress: false,
            },
          });
        });
      });
    });

    it("should return 400 when device ID header is missing", async () => {
      await withFakeTimers(async () => {
        const response = await request(app)
          .get("/api/sync/status")
          .set("Authorization", "Bearer valid-token");

        await waitForAsync(async () => {
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBe("Device ID header is required");
        });
      });
    });

    it("should return 404 when device not found", async () => {
      const deviceId = "non-existent-device";
      
      // Mock service to throw error for non-existent device
      const mockSync = createMockAsyncService({
        getSyncStatus: async () => {
          throw new Error("Device not found or inactive");
        },
      });
      vi.mocked(createSyncService).mockReturnValue(mockSync);

      await withFakeTimers(async () => {
        const response = await request(app)
          .get("/api/sync/status")
          .set("Authorization", "Bearer valid-token")
          .set("x-device-id", deviceId);

        await waitForAsync(async () => {
          expect(response.status).toBe(404);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBe("Device not found or inactive");
        });
      });
    });
  });

  describe("POST /api/sync/trigger", () => {
    it("should trigger sync successfully", async () => {
      const deviceId = "test-device-123";

      await withFakeTimers(async () => {
        const response = await request(app)
          .post("/api/sync/trigger")
          .set("Authorization", "Bearer valid-token")
          .set("x-device-id", deviceId)
          .send({ force: false });

        await waitForAsync(async () => {
          expect(response.status).toBe(202);
          expect(response.body).toEqual({
            success: true,
            jobId: "sync-job-123",
            message: "Sync triggered successfully",
          });
        });
      });
    });

    it("should return 400 when device ID header is missing", async () => {
      await withFakeTimers(async () => {
        const response = await request(app)
          .post("/api/sync/trigger")
          .set("Authorization", "Bearer valid-token")
          .send({ force: false });

        await waitForAsync(async () => {
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBe("Device ID header is required");
        });
      });
    });

    it("should return 404 when device not found", async () => {
      const deviceId = "non-existent-device";
      
      // Mock service to throw error for non-existent device
      const mockSync = createMockAsyncService({
        triggerSync: async () => {
          throw new Error("Device not found or inactive");
        },
      });
      vi.mocked(createSyncService).mockReturnValue(mockSync);

      await withFakeTimers(async () => {
        const response = await request(app)
          .post("/api/sync/trigger")
          .set("Authorization", "Bearer valid-token")
          .set("x-device-id", deviceId)
          .send({ force: false });

        await waitForAsync(async () => {
          expect(response.status).toBe(404);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBe("Device not found or inactive");
        });
      });
    });
  });

  describe("GET /api/sync/delta", () => {
    it("should perform delta sync successfully", async () => {
      const deviceId = "test-device-123";

      await withFakeTimers(async () => {
        const response = await request(app)
          .get("/api/sync/delta")
          .set("Authorization", "Bearer valid-token")
          .set("x-device-id", deviceId);

        await waitForAsync(async () => {
          expect(response.status).toBe(200);
          expect(response.body).toEqual({
            success: true,
            data: {
              added: [{ id: "photo-1", uri: "file://photo1.jpg" }],
              updated: [{ id: "photo-2", uri: "file://photo2.jpg" }],
              deleted: ["photo-3"],
              conflicts: [],
            },
          });
        });
      });
    });

    it("should return 400 when device ID header is missing", async () => {
      await withFakeTimers(async () => {
        const response = await request(app)
          .get("/api/sync/delta")
          .set("Authorization", "Bearer valid-token");

        await waitForAsync(async () => {
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBe("Device ID header is required");
        });
      });
    });
  });

  describe("Authentication", () => {
    it("should require authentication for all endpoints", async () => {
      await withFakeTimers(async () => {
        const response = await request(app).get("/api/sync/devices");

        await waitForAsync(async () => {
          expect(response.status).toBe(401);
        });
      });
    });

    it("should call authenticateToken middleware", async () => {
      await withFakeTimers(async () => {
        await request(app)
          .get("/api/sync/devices")
          .set("Authorization", "Bearer valid-token");

        await waitForAsync(async () => {
          expect(vi.mocked(authenticateToken)).toHaveBeenCalled();
        });
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      // Mock service failure
      const mockSync = createMockAsyncService({
        getUserDevices: async () => {
          throw new Error("Service unavailable");
        },
      });
      vi.mocked(createSyncService).mockReturnValue(mockSync);

      await withFakeTimers(async () => {
        const response = await request(app)
          .get("/api/sync/devices")
          .set("Authorization", "Bearer valid-token");

        await waitForAsync(async () => {
          expect(response.status).toBe(500);
          expect(response.body.success).toBe(false);
          expect(response.body.error).toBe("Failed to get devices");
        });
      });
    });
  });
});
