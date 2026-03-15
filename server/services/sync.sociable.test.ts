// AI-META-BEGIN
// AI-META: Sociable tests for sync service with real implementations
// OWNERSHIP: server/services
// ENTRYPOINTS: run by test runner
// DEPENDENCIES: vitest, fast-check, drizzle-orm, ../sync, test-utils
// DANGER: Test failures = undetected sync bugs; property test failures = algorithmic errors
// CHANGE-SAFETY: Maintain property test coverage for all sync algorithms and conflict resolution strategies
// TESTS: Property tests validate sync consistency, conflict resolution correctness, and version vector operations
// SOCIALIZABLE: Uses real database and service implementations, mocks only external boundaries
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";
import { SyncService, ConflictType } from "./sync";
import { setupTestDatabase, cleanupTestDatabase, createTestUser, createTestPhotos } from "../test-utils/test-database";
import { clearTestData, seedTestData } from "../test-utils/test-factories";

// Mock only external boundaries (BullMQ queues)
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
  })),
  Worker: vi.fn(),
}));

describe("SyncService (Sociable Tests)", () => {
  let syncService: SyncService;
  let db: any;
  let testUser: any;
  let testPhotos: any[];

  beforeEach(async () => {
    // Set up real in-memory database
    db = await setupTestDatabase();
    
    // Create real SyncService with real database
    syncService = new SyncService(db);
    
    // Create test data
    testUser = createTestUser();
    testPhotos = createTestPhotos(testUser.id, 5);
    
    // Seed database with test data
    await seedTestData(db, { user: testUser, photos: testPhotos, albums: [] });
  });

  afterEach(() => {
    cleanupTestDatabase();
  });

  // Filter out all Object prototype properties to avoid conflicts
  const objectPrototypeProps = Object.getOwnPropertyNames(Object.prototype);
  const safeDeviceId = fc.string({ minLength: 2 }).filter((s) => !objectPrototypeProps.includes(s));
  const safeDict = fc.dictionary(fc.string({ minLength: 2 }).filter((s) => !objectPrototypeProps.includes(s)), fc.integer({ min: 0 }));

  describe("Version Vector Operations", () => {
    it("Property 1: Version vector monotonicity", () => {
      fc.assert(
        fc.property(
          safeDeviceId,
          safeDict,
          (deviceId: string, baseVector: Record<string, number>) => {
            const vector1 = syncService.generateVersionVector(
              deviceId,
              baseVector,
            );
            const vector2 = syncService.generateVersionVector(
              deviceId,
              vector1,
            );

            // The device's counter should always increase
            expect(vector2[deviceId]).toBeGreaterThan(vector1[deviceId]);
            expect(vector1[deviceId]).toBeGreaterThan(
              baseVector[deviceId] || 0,
            );

            // Other device counters should remain unchanged
            Object.keys(baseVector).forEach((key) => {
              if (key !== deviceId) {
                expect(vector1[key]).toBe(baseVector[key]);
                expect(vector2[key]).toBe(baseVector[key]);
              }
            });
          },
        ),
        { numRuns: 100 },
      );
    });

    it("Property 2: Version vector comparison consistency", () => {
      fc.assert(
        fc.property(
          safeDict,
          safeDict,
          (
            vector1: Record<string, number>,
            vector2: Record<string, number>,
          ) => {
            const comparison = syncService.compareVersionVectors(
              vector1,
              vector2,
            );
            const reverseComparison = syncService.compareVersionVectors(
              vector2,
              vector1,
            );

            // If vector1 is newer than vector2, then vector2 should not be newer than vector1
            if (comparison.vector1Newer) {
              expect(reverseComparison.vector2Newer).toBe(true);
              expect(reverseComparison.vector1Newer).toBe(false);
            }

            // If vector2 is newer than vector1, then vector1 should not be newer than vector2
            if (comparison.vector2Newer) {
              expect(reverseComparison.vector1Newer).toBe(true);
              expect(reverseComparison.vector2Newer).toBe(false);
            }

            // If they are concurrent, the reverse comparison should also be concurrent
            if (comparison.concurrent) {
              expect(reverseComparison.concurrent).toBe(true);
            }

            // Both shouldn't be newer simultaneously
            expect(comparison.vector1Newer && comparison.vector2Newer).toBe(
              false,
            );
            expect(
              reverseComparison.vector1Newer && reverseComparison.vector2Newer,
            ).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("Property 3: Version vector transitivity", () => {
      fc.assert(
        fc.property(
          safeDeviceId,
          safeDict,
          (deviceId: string, baseVector: Record<string, number>) => {
            const vector1 = syncService.generateVersionVector(
              deviceId,
              baseVector,
            );
            const vector2 = syncService.generateVersionVector(
              deviceId,
              vector1,
            );
            const vector3 = syncService.generateVersionVector(
              deviceId,
              vector2,
            );

            // If v3 > v2 and v2 > v1, then v3 > v1
            const comp12 = syncService.compareVersionVectors(vector1, vector2);
            const comp23 = syncService.compareVersionVectors(vector2, vector3);
            const comp13 = syncService.compareVersionVectors(vector1, vector3);

            if (comp12.vector2Newer && comp23.vector2Newer) {
              expect(comp13.vector2Newer).toBe(true);
            }

            // Counters should be strictly increasing
            expect(vector3[deviceId]).toBeGreaterThan(vector2[deviceId]);
            expect(vector2[deviceId]).toBeGreaterThan(vector1[deviceId]);
            expect(vector3[deviceId]).toBeGreaterThan(vector1[deviceId]);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe("Device Registration (Sociable)", () => {
    it("should register a new device successfully", async () => {
      const deviceId = "device-123";
      const deviceInfo = {
        type: "mobile",
        os: "iOS",
        version: "15.0",
      };

      const result = await syncService.registerDevice(testUser.id, deviceId, deviceInfo);

      expect(result).toBeDefined();
      expect(result.deviceId).toBe(deviceId);
      expect(result.userId).toBe(testUser.id);
      expect(result.isActive).toBe(true);
      
      // Verify device was actually saved to database
      const savedDevice = await db.query.devices.findFirst({
        where: (devices, { eq }) => eq(devices.id, deviceId),
      });
      expect(savedDevice).toBeDefined();
      expect(savedDevice?.userId).toBe(testUser.id);
    });

    it("should handle duplicate device registration gracefully", async () => {
      const deviceId = "device-duplicate";
      const deviceInfo = {
        type: "mobile",
        os: "iOS",
        version: "15.0",
      };

      // Register device first time
      await syncService.registerDevice(testUser.id, deviceId, deviceInfo);

      // Register same device again - should update existing
      const result = await syncService.registerDevice(testUser.id, deviceId, deviceInfo);

      expect(result).toBeDefined();
      expect(result.deviceId).toBe(deviceId);
      
      // Verify only one device exists
      const devices = await db.query.devices.findMany({
        where: (devices, { eq }) => eq(devices.id, deviceId),
      });
      expect(devices).toHaveLength(1);
    });
  });

  describe("Sync Status (Sociable)", () => {
    it("should return sync status for user", async () => {
      // Register a device first
      const deviceId = "device-status-test";
      await syncService.registerDevice(testUser.id, deviceId, {
        type: "mobile",
        os: "iOS",
        version: "15.0",
      });

      const status = await syncService.getSyncStatus(testUser.id);

      expect(status).toBeDefined();
      expect(status.userId).toBe(testUser.id);
      expect(status.devices).toHaveLength(1);
      expect(status.devices[0].deviceId).toBe(deviceId);
      expect(status.lastSyncTime).toBeDefined();
    });

    it("should return empty status for user with no devices", async () => {
      const status = await syncService.getSyncStatus(testUser.id);

      expect(status).toBeDefined();
      expect(status.userId).toBe(testUser.id);
      expect(status.devices).toHaveLength(0);
    });
  });

  describe("Conflict Resolution (Sociable)", () => {
    it("should detect conflicts correctly", async () => {
      const deviceId1 = "device-1";
      const deviceId2 = "device-2";

      // Create conflicting version vectors
      const vector1 = syncService.generateVersionVector(deviceId1, {});
      const vector2 = syncService.generateVersionVector(deviceId2, {});

      const comparison = syncService.compareVersionVectors(vector1, vector2);

      expect(comparison.concurrent).toBe(true);
      expect(comparison.vector1Newer).toBe(false);
      expect(comparison.vector2Newer).toBe(false);
    });

    it("should resolve last-write-wins conflicts", async () => {
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

      const conflict = syncService.resolveConflict(baseData, update1, update2);

      expect(conflict.resolved).toBe(true);
      expect(conflict.result.title).toBe("Updated Photo 2"); // Last write wins
      expect(conflict.conflictType).toBe(ConflictType.LAST_WRITE_WINS);
    });
  });

  describe("Delta Sync (Sociable)", () => {
    it("should perform delta sync correctly", async () => {
      // Register device
      const deviceId = "device-delta";
      await syncService.registerDevice(testUser.id, deviceId, {
        type: "mobile",
        os: "iOS",
        version: "15.0",
      });

      // Perform delta sync
      const syncResult = await syncService.performDeltaSync(testUser.id, deviceId, {
        lastSyncTime: Date.now() - 10000,
        clientVersionVector: {},
      });

      expect(syncResult).toBeDefined();
      expect(syncResult.success).toBe(true);
      expect(syncResult.updates).toBeDefined();
      expect(syncResult.newVersionVector).toBeDefined();
      
      // Verify sync state was updated
      const status = await syncService.getSyncStatus(testUser.id);
      expect(status.lastSyncTime).toBeGreaterThan(0);
    });
  });
});
