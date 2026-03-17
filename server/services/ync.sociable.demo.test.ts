// Sociable testing demonstration - simplified version that works with existing infrastructure
// Shows the principles of behavior-focused testing without complex setup

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SyncService, ConflictType } from "./sync";

// Mock only external boundaries (BullMQ queues) - keep this as true boundary
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
  })),
  Worker: vi.fn(),
}));

describe("SyncService (Sociable Testing Demonstration)", () => {
  let syncService: SyncService;

  beforeEach(() => {
    // Use real SyncService - no internal mocking
    syncService = new SyncService();
  });

  describe("Version Vector Operations (Behavior Testing)", () => {
    it("should maintain monotonicity in version vectors", () => {
      const deviceId = "device-123";
      const baseVector = { "device-456": 5, "device-789": 3 };

      // Test behavior - not implementation
      const vector1 = syncService.generateVersionVector(deviceId, baseVector);
      const vector2 = syncService.generateVersionVector(deviceId, vector1);

      // Verify outcomes - the actual behavior we care about
      expect(vector2[deviceId]).toBeGreaterThan(vector1[deviceId]);
      expect(vector1[deviceId]).toBeGreaterThan(baseVector[deviceId] || 0);

      // Other device counters should remain unchanged (business rule)
      Object.keys(baseVector).forEach((key) => {
        if (key !== deviceId) {
          expect(vector1[key]).toBe(baseVector[key]);
          expect(vector2[key]).toBe(baseVector[key]);
        }
      });
    });

    it("should correctly identify concurrent versions", () => {
      const vector1 = { "device-1": 5, "device-2": 3 };
      const vector2 = { "device-1": 4, "device-2": 7 };

      // Test behavior outcome
      const comparison = syncService.compareVersionVectors(vector1, vector2);

      // Verify business logic - concurrent detection
      expect(comparison.concurrent).toBe(true);
      expect(comparison.vector1Newer).toBe(false);
      expect(comparison.vector2Newer).toBe(false);
    });

    it("should resolve last-write-wins conflicts correctly", () => {
      const baseData = {
        title: "Test Photo",
        description: "Original description",
      };

      const update1 = {
        title: "Updated Photo 1",
        timestamp: Date.now() - 1000,
      };

      const update2 = {
        title: "Updated Photo 2",
        timestamp: Date.now(),
      };

      // Test behavior - not implementation details
      const conflict = syncService.resolveConflict(baseData, update1, update2);

      // Verify business outcome
      expect(conflict.resolved).toBe(true);
      expect(conflict.result.title).toBe("Updated Photo 2"); // Last write wins
      expect(conflict.conflictType).toBe(ConflictType.LAST_WRITE_WINS);
      expect(conflict.result.description).toBe(baseData.description); // Preserved
    });
  });

  describe("Device Registration (State Testing)", () => {
    it("should create device with correct properties", async () => {
      const deviceId = "device-123";
      const deviceInfo = {
        type: "mobile",
        os: "iOS",
        version: "15.0",
      };

      // Test behavior outcome - not internal state
      const result = await syncService.registerDevice(
        "user-123",
        deviceId,
        deviceInfo,
      );

      // Verify actual business results
      expect(result).toBeDefined();
      expect(result.deviceId).toBe(deviceId);
      expect(result.userId).toBe("user-123");
      expect(result.isActive).toBe(true);
      expect(result.type).toBe(deviceInfo.type);
      expect(result.os).toBe(deviceInfo.os);
      expect(result.version).toBe(deviceInfo.version);
      expect(result.registeredAt).toBeDefined();
    });

    it("should handle device registration errors gracefully", async () => {
      const deviceId = ""; // Invalid device ID
      const deviceInfo = { type: "mobile", os: "iOS", version: "15.0" };

      // Test error handling behavior
      await expect(
        syncService.registerDevice("user-123", deviceId, deviceInfo),
      ).rejects.toThrow("Device ID is required");
    });
  });

  describe("Conflict Detection (Business Logic Testing)", () => {
    it("should detect conflicts from different devices", () => {
      const deviceId1 = "device-1";
      const deviceId2 = "device-2";

      // Create conflicting version vectors
      const vector1 = syncService.generateVersionVector(deviceId1, {});
      const vector2 = syncService.generateVersionVector(deviceId2, {});

      // Test business logic outcome
      const comparison = syncService.compareVersionVectors(vector1, vector2);

      // Verify conflict detection behavior
      expect(comparison.concurrent).toBe(true);
      expect(comparison.vector1Newer).toBe(false);
      expect(comparison.vector2Newer).toBe(false);
    });

    it("should identify clear version ordering", () => {
      const deviceId = "device-1";

      // Create sequential version vectors
      const vector1 = syncService.generateVersionVector(deviceId, {});
      const vector2 = syncService.generateVersionVector(deviceId, vector1);

      // Test version comparison behavior
      const comparison = syncService.compareVersionVectors(vector1, vector2);

      // Verify version ordering business rule
      expect(comparison.vector2Newer).toBe(true);
      expect(comparison.vector1Newer).toBe(false);
      expect(comparison.concurrent).toBe(false);
    });
  });

  describe("Sync State Management (Outcome Testing)", () => {
    it("should track sync progress correctly", async () => {
      const userId = "user-123";
      const deviceId = "device-123";

      // Register device first
      await syncService.registerDevice(userId, deviceId, {
        type: "mobile",
        os: "iOS",
        version: "15.0",
      });

      // Test sync status behavior
      const status = await syncService.getSyncStatus(userId);

      // Verify business outcome
      expect(status).toBeDefined();
      expect(status.userId).toBe(userId);
      expect(status.devices).toHaveLength(1);
      expect(status.devices[0].deviceId).toBe(deviceId);
      expect(status.devices[0].isActive).toBe(true);
      expect(status.lastSyncTime).toBeDefined();
    });

    it("should handle delta sync correctly", async () => {
      const userId = "user-123";
      const deviceId = "device-123";

      // Register device
      await syncService.registerDevice(userId, deviceId, {
        type: "mobile",
        os: "iOS",
        version: "15.0",
      });

      // Test delta sync behavior
      const syncResult = await syncService.performDeltaSync(userId, deviceId, {
        lastSyncTime: Date.now() - 10000,
        clientVersionVector: {},
      });

      // Verify business outcome
      expect(syncResult).toBeDefined();
      expect(syncResult.success).toBe(true);
      expect(syncResult.updates).toBeDefined();
      expect(syncResult.newVersionVector).toBeDefined();
      expect(syncResult.newVersionVector[deviceId]).toBeGreaterThan(0);
    });
  });
});

// Comparison with old approach (commented for reference)
/*
describe("SyncService (Old Solitary Approach)", () => {
  // ❌ OLD: Mocking internal dependencies
  vi.mock("../db", () => ({
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    },
  }));

  it("should register device", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "device-123" }]),
      }),
    });
    
    db.insert = mockInsert;
    
    await syncService.registerDevice("user-123", "device-123", {});
    
    // ❌ OLD: Testing implementation details
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsert.values).toHaveBeenCalled();
  });
});
*/
