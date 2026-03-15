// AI-META-BEGIN
// AI-META: Multi-device sync service with version vectors, conflict resolution, and delta sync
// OWNERSHIP: server/services
// ENTRYPOINTS: imported by sync-routes.ts and background job processors
// DEPENDENCIES: drizzle-orm, bullmq, ../shared/schema, ./db, ./security
// DANGER: Sync failure = data inconsistency; conflict resolution errors = data loss; device registration bypass = unauthorized access
// CHANGE-SAFETY: Maintain version vector compatibility, conflict resolution correctness, and device registration security
// TESTS: Property tests for sync consistency, conflict resolution correctness, and delta sync efficiency
// AI-META-END

import { db } from "../db";
import { photos, userDevices } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { Queue, Worker } from "bullmq";

/**
 * Version vector implementation for conflict detection
 * Tracks causal relationships between updates across devices
 */
export interface VersionVector {
  [deviceId: string]: number;
}

/**
 * Sync operation types
 */
export enum SyncOperation {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
}

/**
 * Conflict resolution strategies
 */
export enum ConflictStrategy {
  LAST_WRITE_WINS = "last_write_wins",
  MERGE = "merge",
  MANUAL = "manual",
  SERVER_WINS = "server_wins",
  CLIENT_WINS = "client_wins",
}

/**
 * Sync conflict types
 */
export enum ConflictType {
  CONCURRENT_UPDATE = "concurrent_update",
  DELETE_UPDATE = "delete_update",
  DUPLICATE_CREATE = "duplicate_create",
}

/**
 * Sync conflict information
 */
export interface SyncConflict {
  id: string;
  type: ConflictType;
  deviceId: string;
  photoId: string;
  localData: any;
  remoteData: any;
  strategy: ConflictStrategy;
  resolved: boolean;
  timestamp: Date;
}

/**
 * Device registration information
 */
export interface DeviceRegistration {
  id: string;
  userId: string;
  deviceId: string;
  deviceType: string;
  deviceName: string;
  isActive: boolean;
  lastSyncAt?: Date;
  appVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sync status information
 */
export interface SyncStatus {
  deviceId: string;
  userId: string;
  lastSyncAt?: Date;
  pendingOperations: number;
  conflicts: number;
  lastError?: string;
  syncInProgress: boolean;
}

/**
 * Sync operation for tracking changes
 */
export interface SyncOperationRecord {
  id: string;
  userId: string;
  deviceId: string;
  photoId: string;
  operation: SyncOperation;
  data: any;
  versionVector: VersionVector;
  timestamp: Date;
  processed: boolean;
}

/**
 * Sync service implementation
 */
export class SyncService {
  private syncQueue: Queue;
  private conflictQueue: Queue;

  constructor() {
    // Initialize sync queues
    this.syncQueue = new Queue("sync-operations", {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
    });

    this.conflictQueue = new Queue("conflict-resolution", {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
    });

    // Start background workers
    this.startSyncWorker();
    this.startConflictWorker();
  }

  /**
   * Register a new device for sync
   */
  async registerDevice(
    userId: string,
    deviceId: string,
    deviceType: string,
    deviceName: string,
    appVersion?: string,
  ): Promise<DeviceRegistration> {
    try {
      // Check if device already exists
      const existingDevice = await db
        .select()
        .from(userDevices)
        .where(
          and(
            eq(userDevices.userId, userId),
            eq(userDevices.deviceId, deviceId),
          ),
        )
        .limit(1);

      if (existingDevice.length > 0) {
        // Update existing device
        const [updatedDevice] = await db
          .update(userDevices)
          .set({
            deviceType,
            deviceName,
            isActive: true,
            appVersion,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(userDevices.userId, userId),
              eq(userDevices.deviceId, deviceId),
            ),
          )
          .returning();

        return updatedDevice;
      } else {
        // Create new device
        const [newDevice] = await db
          .insert(userDevices)
          .values({
            userId,
            deviceId,
            deviceType,
            deviceName,
            isActive: true,
            appVersion,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        return newDevice;
      }
    } catch (error) {
      console.error("Device registration error:", error);
      throw new Error(
        `Failed to register device: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get sync status for a device
   */
  async getSyncStatus(userId: string, deviceId: string): Promise<SyncStatus> {
    try {
      // Get device information
      const device = await db
        .select()
        .from(userDevices)
        .where(
          and(
            eq(userDevices.userId, userId),
            eq(userDevices.deviceId, deviceId),
            eq(userDevices.isActive, true),
          ),
        )
        .limit(1);

      if (device.length === 0) {
        throw new Error("Device not found or inactive");
      }

      // Count pending operations (simplified - in production, use a sync operations table)
      const pendingOperations = 0; // Would query from sync_operations table
      const conflicts = 0; // Would query from conflicts table

      return {
        deviceId,
        userId,
        lastSyncAt: device[0].lastSyncAt,
        pendingOperations,
        conflicts,
        syncInProgress: false,
      };
    } catch (error) {
      console.error("Get sync status error:", error);
      throw new Error(
        `Failed to get sync status: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Trigger sync for a device
   */
  async triggerSync(userId: string, deviceId: string): Promise<string> {
    try {
      // Verify device exists and is active
      const device = await db
        .select()
        .from(userDevices)
        .where(
          and(
            eq(userDevices.userId, userId),
            eq(userDevices.deviceId, deviceId),
            eq(userDevices.isActive, true),
          ),
        )
        .limit(1);

      if (device.length === 0) {
        throw new Error("Device not found or inactive");
      }

      // Add sync job to queue
      const jobId = `sync-${userId}-${deviceId}-${Date.now()}`;
      await this.syncQueue.add(
        "process-sync",
        {
          userId,
          deviceId,
          timestamp: new Date(),
        },
        {
          jobId,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      return jobId;
    } catch (error) {
      console.error("Trigger sync error:", error);
      throw new Error(
        `Failed to trigger sync: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Perform delta sync - only sync changes since last sync
   */
  async performDeltaSync(
    userId: string,
    deviceId: string,
  ): Promise<{
    added: any[];
    updated: any[];
    deleted: string[];
    conflicts: SyncConflict[];
  }> {
    try {
      const device = await db
        .select()
        .from(userDevices)
        .where(
          and(
            eq(userDevices.userId, userId),
            eq(userDevices.deviceId, deviceId),
          ),
        )
        .limit(1);

      if (device.length === 0) {
        throw new Error("Device not found");
      }

      const lastSyncAt = device[0].lastSyncAt;

      // Get photos modified since last sync
      const baseQuery = db
        .select()
        .from(photos)
        .where(eq(photos.userId, userId));

      let modifiedPhotos;
      if (lastSyncAt) {
        modifiedPhotos = await baseQuery.queryBuilder
          .addWhere(gt(photos.modifiedAt, lastSyncAt))
          .orderBy(desc(photos.modifiedAt));
      } else {
        // First sync - get all photos
        modifiedPhotos = await baseQuery.orderBy(desc(photos.modifiedAt));
      }

      // Categorize changes
      const added: any[] = [];
      const updated: any[] = [];
      const deleted: string[] = [];
      const conflicts: SyncConflict[] = [];

      for (const photo of modifiedPhotos) {
        if (photo.deletedAt) {
          deleted.push(photo.id);
        } else if (lastSyncAt && photo.createdAt > lastSyncAt) {
          added.push(photo);
        } else {
          updated.push(photo);
        }
      }

      // Update last sync timestamp
      await db
        .update(userDevices)
        .set({
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userDevices.userId, userId),
            eq(userDevices.deviceId, deviceId),
          ),
        );

      return {
        added,
        updated,
        deleted,
        conflicts,
      };
    } catch (error) {
      console.error("Delta sync error:", error);
      throw new Error(
        `Failed to perform delta sync: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Detect conflicts between local and remote data
   */
  async detectConflicts(
    userId: string,
    deviceId: string,
    localData: any[],
    remoteData: any[],
  ): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    // Create maps for efficient lookup
    const localMap = new Map(localData.map((item) => [item.id, item]));
    const remoteMap = new Map(remoteData.map((item) => [item.id, item]));

    // Find conflicts
    for (const [id, localItem] of Array.from(localMap.entries())) {
      const remoteItem = remoteMap.get(id);

      if (remoteItem) {
        // Check for concurrent updates
        if (localItem.modifiedAt && remoteItem.modifiedAt) {
          const localTime = new Date(localItem.modifiedAt).getTime();
          const remoteTime = new Date(remoteItem.modifiedAt).getTime();
          const timeDiff = Math.abs(localTime - remoteTime);

          // If updates happened within a small window, consider it a conflict
          if (timeDiff < 5000 && localTime !== remoteTime) {
            conflicts.push({
              id: `conflict-${id}-${Date.now()}`,
              type: ConflictType.CONCURRENT_UPDATE,
              deviceId,
              photoId: id,
              localData: localItem,
              remoteData: remoteItem,
              strategy: ConflictStrategy.LAST_WRITE_WINS,
              resolved: false,
              timestamp: new Date(),
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve sync conflicts using specified strategy
   */
  async resolveConflict(
    conflict: SyncConflict,
    strategy: ConflictStrategy,
  ): Promise<any> {
    try {
      switch (strategy) {
        case ConflictStrategy.LAST_WRITE_WINS:
          return this.resolveLastWriteWins(conflict);

        case ConflictStrategy.SERVER_WINS:
          return conflict.remoteData;

        case ConflictStrategy.CLIENT_WINS:
          return conflict.localData;

        case ConflictStrategy.MERGE:
          return this.mergeConflictData(conflict);

        case ConflictStrategy.MANUAL:
          // Return conflict for manual resolution
          throw new Error("Manual conflict resolution required");

        default:
          throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
      }
    } catch (error) {
      console.error("Conflict resolution error:", error);
      throw new Error(
        `Failed to resolve conflict: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Resolve conflict using last write wins strategy
   */
  private resolveLastWriteWins(conflict: SyncConflict): any {
    const localTime = new Date(conflict.localData.modifiedAt).getTime();
    const remoteTime = new Date(conflict.remoteData.modifiedAt).getTime();

    return localTime > remoteTime ? conflict.localData : conflict.remoteData;
  }

  /**
   * Merge conflicting data intelligently
   */
  private mergeConflictData(conflict: SyncConflict): any {
    const local = conflict.localData;
    const remote = conflict.remoteData;

    // Merge strategy for photo metadata
    const merged = { ...remote };

    // Keep most recent values for each field
    const fieldsToMerge = ["isFavorite", "tags", "notes"];

    for (const field of fieldsToMerge) {
      if (local[field] !== undefined && local[field] !== remote[field]) {
        const localModified = new Date(local.modifiedAt).getTime();
        const remoteModified = new Date(remote.modifiedAt).getTime();

        if (localModified > remoteModified) {
          merged[field] = local[field];
        }
      }
    }

    // Merge arrays (like tags) by combining unique values
    if (local.tags && remote.tags) {
      const allTags = [...local.tags, ...remote.tags];
      const uniqueTags = Array.from(new Set(allTags));
      merged.tags = uniqueTags;
    }

    return merged;
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<DeviceRegistration[]> {
    try {
      return await db
        .select()
        .from(userDevices)
        .where(eq(userDevices.userId, userId))
        .orderBy(desc(userDevices.lastSyncAt));
    } catch (error) {
      console.error("Get user devices error:", error);
      throw new Error(
        `Failed to get user devices: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Remove a device from sync
   */
  async removeDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await db
        .delete(userDevices)
        .where(
          and(
            eq(userDevices.userId, userId),
            eq(userDevices.deviceId, deviceId),
          ),
        );
    } catch (error) {
      console.error("Remove device error:", error);
      throw new Error(
        `Failed to remove device: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Start background sync worker
   */
  private startSyncWorker(): void {
    new Worker(
      "sync-operations",
      async (job) => {
        const { userId, deviceId } = job.data;

        try {
          // Perform sync operation
          await this.performDeltaSync(userId, deviceId);
          console.log(`Sync completed for device ${deviceId}`);
        } catch (error) {
          console.error(`Sync failed for device ${deviceId}:`, error);
          throw error;
        }
      },
      {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
        },
      },
    );
  }

  /**
   * Start conflict resolution worker
   */
  private startConflictWorker(): void {
    new Worker(
      "conflict-resolution",
      async (job) => {
        const { conflict, strategy } = job.data;

        try {
          await this.resolveConflict(conflict, strategy);
          console.log(`Conflict resolved: ${conflict.id}`);
        } catch (error) {
          console.error(`Conflict resolution failed: ${conflict.id}:`, error);
          throw error;
        }
      },
      {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
        },
      },
    );
  }

  /**
   * Generate version vector for sync operations
   */
  generateVersionVector(
    deviceId: string,
    baseVector?: VersionVector,
  ): VersionVector {
    const vector = baseVector ? { ...baseVector } : {};
    vector[deviceId] = (vector[deviceId] || 0) + 1;
    return vector;
  }

  /**
   * Compare version vectors to determine causality
   */
  compareVersionVectors(
    vector1: VersionVector,
    vector2: VersionVector,
  ): {
    concurrent: boolean;
    vector1Newer: boolean;
    vector2Newer: boolean;
  } {
    const deviceKeys = [...Object.keys(vector1), ...Object.keys(vector2)];
    const devices = new Set(deviceKeys);
    let vector1Newer = false;
    let vector2Newer = false;
    let concurrent = false;

    for (const device of Array.from(devices)) {
      const v1 = vector1[device] || 0;
      const v2 = vector2[device] || 0;

      if (v1 > v2) {
        vector1Newer = true;
      } else if (v2 > v1) {
        vector2Newer = true;
      }

      if (vector1Newer && vector2Newer) {
        concurrent = true;
        break;
      }
    }

    return {
      concurrent,
      vector1Newer: vector1Newer && !vector2Newer,
      vector2Newer: vector2Newer && !vector1Newer,
    };
  }
}

/**
 * Factory function to create sync service
 */
export function createSyncService(): SyncService {
  return new SyncService();
}
