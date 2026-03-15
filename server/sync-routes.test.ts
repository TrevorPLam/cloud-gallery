// AI-META-BEGIN
// AI-META: Integration tests for sync API endpoints with authentication and validation
// OWNERSHIP: server/api
// ENTRYPOINTS: run by test runner
// DEPENDENCIES: vitest, supertest, express, drizzle-orm, ../sync-routes
// DANGER: Test failures = API bugs; authentication test failures = security vulnerabilities
// CHANGE-SAFETY: Maintain comprehensive test coverage for all API endpoints and error scenarios
// TESTS: Integration tests validate API functionality, authentication, and error handling
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import syncRoutes from "./sync-routes";
import { authenticateToken } from "./auth";
import { createSyncService } from "./services/sync";
import { db } from "./db";

// Mock dependencies
vi.mock("./auth");
vi.mock("./services/sync");
vi.mock("./db");

// Mock authentication
const mockAuth = vi.mocked(authenticateToken);
const mockSyncService = vi.mocked(createSyncService);
const mockDb = vi.mocked(db);

// Create test app
const app = express();
app.use(express.json());
app.use("/api/sync", syncRoutes);

describe("Sync API Routes", () => {
  let mockSync: any;
  const mockUser = { id: "test-user-id", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup authentication mock
    mockAuth.mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });

    // Setup sync service mock
    mockSync = {
      registerDevice: vi.fn(),
      getSyncStatus: vi.fn(),
      triggerSync: vi.fn(),
      performDeltaSync: vi.fn(),
      detectConflicts: vi.fn(),
      resolveConflict: vi.fn(),
      getUserDevices: vi.fn(),
      removeDevice: vi.fn(),
    };
    mockSyncService.mockReturnValue(mockSync);

    // Setup database mock
    mockDb.select = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    });
    mockDb.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockDb.delete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/sync/register", () => {
    it("should register a new device successfully", async () => {
      const deviceData = {
        deviceId: "test-device-123",
        deviceType: "phone",
        deviceName: "iPhone 14",
        appVersion: "1.0.0",
      };

      const expectedDevice = {
        id: "device-id",
        userId: mockUser.id,
        ...deviceData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSync.registerDevice.mockResolvedValue(expectedDevice);

      const response = await request(app)
        .post("/api/sync/register")
        .set("Authorization", "Bearer valid-token")
        .send(deviceData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        device: expectedDevice,
        message: "Device registered successfully",
      });
      expect(mockSync.registerDevice).toHaveBeenCalledWith(
        mockUser.id,
        deviceData.deviceId,
        deviceData.deviceType,
        deviceData.deviceName,
        deviceData.appVersion,
      );
    });

    it("should return 400 for invalid request data", async () => {
      const invalidData = {
        deviceId: "", // Invalid: empty string
        deviceType: "invalid-type", // Invalid: not in enum
        deviceName: "", // Invalid: empty string
      };

      const response = await request(app)
        .post("/api/sync/register")
        .set("Authorization", "Bearer valid-token")
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid request data");
      expect(response.body.details).toBeDefined();
    });

    it("should return 500 when service fails", async () => {
      const deviceData = {
        deviceId: "test-device-123",
        deviceType: "phone",
        deviceName: "iPhone 14",
      };

      mockSync.registerDevice.mockRejectedValue(new Error("Service error"));

      const response = await request(app)
        .post("/api/sync/register")
        .set("Authorization", "Bearer valid-token")
        .send(deviceData);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Failed to register device");
    });
  });

  describe("GET /api/sync/status", () => {
    it("should return sync status for valid device", async () => {
      const deviceId = "test-device-123";
      const expectedStatus = {
        deviceId,
        userId: mockUser.id,
        lastSyncAt: new Date(),
        pendingOperations: 0,
        conflicts: 0,
        syncInProgress: false,
      };

      mockSync.getSyncStatus.mockResolvedValue(expectedStatus);

      const response = await request(app)
        .get("/api/sync/status")
        .set("Authorization", "Bearer valid-token")
        .set("x-device-id", deviceId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        status: expectedStatus,
      });
      expect(mockSync.getSyncStatus).toHaveBeenCalledWith(
        mockUser.id,
        deviceId,
      );
    });

    it("should return 400 when device ID header is missing", async () => {
      const response = await request(app)
        .get("/api/sync/status")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Device ID header is required");
    });

    it("should return 404 when device not found", async () => {
      const deviceId = "non-existent-device";
      mockSync.getSyncStatus.mockRejectedValue(
        new Error("Device not found or inactive"),
      );

      const response = await request(app)
        .get("/api/sync/status")
        .set("Authorization", "Bearer valid-token")
        .set("x-device-id", deviceId);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Device not found or inactive");
    });
  });

  describe("POST /api/sync/trigger", () => {
    it("should trigger sync successfully", async () => {
      const deviceId = "test-device-123";
      const jobId = "sync-job-123";

      mockSync.triggerSync.mockResolvedValue(jobId);

      const response = await request(app)
        .post("/api/sync/trigger")
        .set("Authorization", "Bearer valid-token")
        .set("x-device-id", deviceId)
        .send({ force: false });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        success: true,
        jobId,
        message: "Sync triggered successfully",
      });
      expect(mockSync.triggerSync).toHaveBeenCalledWith(mockUser.id, deviceId);
    });

    it("should return 400 when device ID header is missing", async () => {
      const response = await request(app)
        .post("/api/sync/trigger")
        .set("Authorization", "Bearer valid-token")
        .send({ force: false });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Device ID header is required");
    });

    it("should return 404 when device not found", async () => {
      const deviceId = "non-existent-device";
      mockSync.triggerSync.mockRejectedValue(
        new Error("Device not found or inactive"),
      );

      const response = await request(app)
        .post("/api/sync/trigger")
        .set("Authorization", "Bearer valid-token")
        .set("x-device-id", deviceId)
        .send({ force: false });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Device not found or inactive");
    });
  });

  describe("GET /api/sync/delta", () => {
    it("should perform delta sync successfully", async () => {
      const deviceId = "test-device-123";
      const deltaResult = {
        added: [{ id: "photo-1", uri: "file://photo1.jpg" }],
        updated: [{ id: "photo-2", uri: "file://photo2.jpg" }],
        deleted: ["photo-3"],
        conflicts: [],
      };

      mockSync.performDeltaSync.mockResolvedValue(deltaResult);

      const response = await request(app)
        .get("/api/sync/delta")
        .set("Authorization", "Bearer valid-token")
        .set("x-device-id", deviceId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: deltaResult,
      });
      expect(mockSync.performDeltaSync).toHaveBeenCalledWith(
        mockUser.id,
        deviceId,
      );
    });

    it("should return 400 when device ID header is missing", async () => {
      const response = await request(app)
        .get("/api/sync/delta")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Device ID header is required");
    });
  });

  describe("POST /api/sync/conflicts/detect", () => {
    it("should detect conflicts successfully", async () => {
      const deviceId = "test-device-123";
      const localData = [{ id: "photo-1", value: "local" }];
      const remoteData = [{ id: "photo-1", value: "remote" }];
      const conflicts = [
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
      ];

      mockSync.detectConflicts.mockResolvedValue(conflicts);

      const response = await request(app)
        .post("/api/sync/conflicts/detect")
        .set("Authorization", "Bearer valid-token")
        .set("x-device-id", deviceId)
        .send({ localData, remoteData });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        conflicts,
        count: conflicts.length,
      });
      expect(mockSync.detectConflicts).toHaveBeenCalledWith(
        mockUser.id,
        deviceId,
        localData,
        remoteData,
      );
    });

    it("should return 400 for invalid data format", async () => {
      const deviceId = "test-device-123";

      const response = await request(app)
        .post("/api/sync/conflicts/detect")
        .set("Authorization", "Bearer valid-token")
        .set("x-device-id", deviceId)
        .send({ localData: "not-array", remoteData: "not-array" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        "localData and remoteData must be arrays",
      );
    });
  });

  describe("POST /api/sync/conflicts/resolve", () => {
    it("should resolve conflict successfully", async () => {
      const conflictData = {
        conflictId: "conflict-1",
        strategy: "last_write_wins",
        resolution: { value: "resolved" },
      };

      const resolvedData = { id: "photo-1", value: "resolved" };
      mockSync.resolveConflict.mockResolvedValue(resolvedData);

      const response = await request(app)
        .post("/api/sync/conflicts/resolve")
        .set("Authorization", "Bearer valid-token")
        .set("x-device-id", "test-device-123")
        .send(conflictData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        resolved: resolvedData,
        message: "Conflict resolved successfully",
      });
    });

    it("should return 422 for manual resolution required", async () => {
      const conflictData = {
        conflictId: "conflict-1",
        strategy: "manual",
      };

      mockSync.resolveConflict.mockRejectedValue(
        new Error("Manual conflict resolution required"),
      );

      const response = await request(app)
        .post("/api/sync/conflicts/resolve")
        .set("Authorization", "Bearer valid-token")
        .set("x-device-id", "test-device-123")
        .send(conflictData);

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Manual conflict resolution required");
    });
  });

  describe("GET /api/sync/devices", () => {
    it("should get user devices successfully", async () => {
      const devices = [
        {
          id: "device-1",
          userId: mockUser.id,
          deviceId: "phone-123",
          deviceType: "phone",
          deviceName: "iPhone 14",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSync.getUserDevices.mockResolvedValue(devices);

      const response = await request(app)
        .get("/api/sync/devices")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        devices,
        count: devices.length,
      });
      expect(mockSync.getUserDevices).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe("PUT /api/sync/devices/:deviceId", () => {
    it("should update device successfully", async () => {
      const deviceId = "phone-123";
      const updateData = {
        deviceName: "iPhone 14 Pro",
        isActive: true,
        appVersion: "1.1.0",
      };

      const updatedDevice = {
        id: "device-1",
        userId: mockUser.id,
        deviceId,
        ...updateData,
        updatedAt: new Date(),
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedDevice]),
          }),
        }),
      });
      mockDb.update.mockReturnValue(mockUpdate as any);

      const response = await request(app)
        .put(`/api/sync/devices/${deviceId}`)
        .set("Authorization", "Bearer valid-token")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        device: updatedDevice,
        message: "Device updated successfully",
      });
    });

    it("should return 404 when device not found", async () => {
      const deviceId = "non-existent-device";
      const updateData = {
        deviceName: "Updated Name",
        isActive: true,
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockDb.update.mockReturnValue(mockUpdate as any);

      const response = await request(app)
        .put(`/api/sync/devices/${deviceId}`)
        .set("Authorization", "Bearer valid-token")
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Device not found");
    });
  });

  describe("DELETE /api/sync/devices/:deviceId", () => {
    it("should remove device successfully", async () => {
      const deviceId = "phone-123";

      // Mock device exists check
      mockDb.select.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "device-1" }]),
        }),
      } as any);

      mockSync.removeDevice.mockResolvedValue();

      const response = await request(app)
        .delete(`/api/sync/devices/${deviceId}`)
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: "Device removed successfully",
      });
      expect(mockSync.removeDevice).toHaveBeenCalledWith(mockUser.id, deviceId);
    });

    it("should return 404 when device not found", async () => {
      const deviceId = "non-existent-device";

      // Mock device not found
      mockDb.select.mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const response = await request(app)
        .delete(`/api/sync/devices/${deviceId}`)
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Device not found");
    });
  });

  describe("GET /api/sync/stats", () => {
    it("should return sync statistics successfully", async () => {
      const devices = [
        { isActive: true, lastSyncAt: new Date(), storageUsed: 1000 },
        { isActive: false, lastSyncAt: null, storageUsed: 500 },
        { isActive: true, lastSyncAt: new Date(), storageUsed: 1500 },
      ];

      mockSync.getUserDevices.mockResolvedValue(devices);

      const response = await request(app)
        .get("/api/sync/stats")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats.totalDevices).toBe(3);
      expect(response.body.stats.activeDevices).toBe(2);
      expect(response.body.stats.devicesWithSync).toBe(2);
      expect(response.body.stats.totalSyncOperations).toBe(3000);
    });
  });

  describe("POST /api/sync/reset", () => {
    it("should reset sync state successfully", async () => {
      const deviceId = "test-device-123";

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      mockDb.update.mockReturnValue(mockUpdate as any);

      const response = await request(app)
        .post("/api/sync/reset")
        .set("Authorization", "Bearer valid-token")
        .set("x-device-id", deviceId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: "Sync state reset successfully",
      });
    });

    it("should return 400 when device ID header is missing", async () => {
      const response = await request(app)
        .post("/api/sync/reset")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Device ID header is required");
    });
  });

  describe("Authentication", () => {
    it("should require authentication for all endpoints", async () => {
      // Test without authentication
      const response = await request(app).get("/api/sync/devices");

      expect(response.status).toBe(401);
    });

    it("should call authenticateToken middleware", async () => {
      await request(app)
        .get("/api/sync/devices")
        .set("Authorization", "Bearer valid-token");

      expect(mockAuth).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      mockSync.getUserDevices.mockRejectedValue(
        new Error("Service unavailable"),
      );

      const response = await request(app)
        .get("/api/sync/devices")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Failed to get devices");
    });

    it("should handle database errors gracefully", async () => {
      mockDb.select.mockRejectedValue(new Error("Database connection failed"));

      const response = await request(app)
        .get("/api/sync/devices")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
