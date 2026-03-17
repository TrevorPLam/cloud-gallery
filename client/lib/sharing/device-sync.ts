// Multi-device sync for encrypted family sharing.
// Provides delta sync, conflict resolution, and offline support for sharing state.

import { Buffer } from "buffer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sharingKeyManager } from "./key-management";
import { permissionManager, PermissionAction } from "./permissions";

/**
 * Sync operation types
 */
export enum SyncOperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  ROTATE_KEY = "rotate_key",
  ADD_MEMBER = "add_member",
  REMOVE_MEMBER = "remove_member",
  UPDATE_PERMISSIONS = "update_permissions",
  ADD_AUTO_SHARE_RULE = "add_auto_share_rule",
  REMOVE_AUTO_SHARE_RULE = "remove_auto_share_rule",
}

/**
 * Sync operation for sharing state changes
 */
export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  keyId: string;
  userId: string;
  deviceId: string;
  timestamp: number;
  data: any;
  version: number;
  applied: boolean;
  conflicts?: SyncConflict[];
}

/**
 * Sync conflict between operations
 */
export interface SyncConflict {
  operationId: string;
  conflictType: "version" | "permission" | "data" | "concurrent";
  description: string;
  resolution?: "merge" | "override" | "manual";
  resolvedAt?: number;
}

/**
 * Device sync state
 */
export interface DeviceSyncState {
  deviceId: string;
  lastSyncTimestamp: number;
  pendingOperations: SyncOperation[];
  conflictOperations: SyncOperation[];
  syncVersion: number;
  isOnline: boolean;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  conflictResolution: "latest" | "manual" | "merge";
  enableOfflineMode: boolean;
  syncInterval: number; // milliseconds
}

/**
 * Sharing sync manager for multi-device consistency
 */
export class SharingDeviceSync {
  private deviceId: string;
  private config: SyncConfig;
  private syncState: DeviceSyncState;
  private syncInterval?: NodeJS.Timeout;
  private isOnline: boolean = true;

  constructor(deviceId: string, config: Partial<SyncConfig> = {}) {
    this.deviceId = deviceId;
    this.config = {
      maxRetries: 3,
      retryDelay: 5000,
      batchSize: 50,
      conflictResolution: "latest",
      enableOfflineMode: true,
      syncInterval: 30000, // 30 seconds
      ...config,
    };

    this.syncState = {
      deviceId,
      lastSyncTimestamp: 0,
      pendingOperations: [],
      conflictOperations: [],
      syncVersion: 1,
      isOnline: true,
    };

    this.initializeSyncState();
    this.setupNetworkListeners();
  }

  /**
   * Start automatic sync
   */
  startSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.isOnline) {
        await this.performSync();
      }
    }, this.config.syncInterval);

    // Initial sync
    this.performSync();
  }

  /**
   * Stop automatic sync
   */
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  /**
   * Queue sync operation
   */
  async queueOperation(
    type: SyncOperationType,
    keyId: string,
    userId: string,
    data: any,
  ): Promise<string> {
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type,
      keyId,
      userId,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      data,
      version: this.syncState.syncVersion,
      applied: false,
    };

    // Add to pending operations
    this.syncState.pendingOperations.push(operation);
    await this.persistSyncState();

    // Try to sync immediately if online
    if (this.isOnline) {
      await this.performSync();
    }

    return operation.id;
  }

  /**
   * Force immediate sync
   */
  async forceSync(): Promise<{
    success: boolean;
    synced: number;
    conflicts: number;
    errors: string[];
  }> {
    if (!this.isOnline) {
      return {
        success: false,
        synced: 0,
        conflicts: 0,
        errors: ["Device is offline"],
      };
    }

    return await this.performSync();
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isOnline: boolean;
    lastSync: number;
    pendingOperations: number;
    conflictOperations: number;
    syncVersion: number;
  } {
    return {
      isOnline: this.isOnline,
      lastSync: this.syncState.lastSyncTimestamp,
      pendingOperations: this.syncState.pendingOperations.length,
      conflictOperations: this.syncState.conflictOperations.length,
      syncVersion: this.syncState.syncVersion,
    };
  }

  /**
   * Resolve sync conflict
   */
  async resolveConflict(
    operationId: string,
    resolution: "merge" | "override" | "manual",
    resolvedData?: any,
  ): Promise<boolean> {
    const conflictOp = this.syncState.conflictOperations.find(
      (op) => op.id === operationId,
    );
    if (!conflictOp) {
      return false;
    }

    // Apply resolution
    switch (resolution) {
      case "override":
        await this.applyOperation(conflictOp);
        break;
      case "merge":
        if (resolvedData) {
          conflictOp.data = resolvedData;
          await this.applyOperation(conflictOp);
        }
        break;
      case "manual":
        // Mark as manually resolved, don't apply
        conflictOp.applied = true;
        break;
    }

    // Remove from conflicts
    this.syncState.conflictOperations =
      this.syncState.conflictOperations.filter((op) => op.id !== operationId);

    await this.persistSyncState();
    return true;
  }

  // Private methods

  private async performSync(): Promise<{
    success: boolean;
    synced: number;
    conflicts: number;
    errors: string[];
  }> {
    const result = {
      success: true,
      synced: 0,
      conflicts: 0,
      errors: [] as string[],
    };

    try {
      // Get operations to sync
      const operationsToSync = this.syncState.pendingOperations.slice(
        0,
        this.config.batchSize,
      );

      if (operationsToSync.length === 0) {
        return result;
      }

      // Sync each operation
      for (const operation of operationsToSync) {
        try {
          const syncResult = await this.syncOperation(operation);

          if (syncResult.success) {
            operation.applied = true;
            result.synced++;
          } else if (syncResult.conflict) {
            this.syncState.conflictOperations.push(operation);
            result.conflicts++;
          } else {
            result.errors.push(syncResult.error || "Unknown sync error");
          }
        } catch (error) {
          result.errors.push(
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      }

      // Remove applied operations from pending
      this.syncState.pendingOperations =
        this.syncState.pendingOperations.filter((op) => !op.applied);

      // Update sync timestamp
      this.syncState.lastSyncTimestamp = Date.now();
      this.syncState.syncVersion++;

      await this.persistSyncState();

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(
        error instanceof Error ? error.message : "Sync failed",
      );
      return result;
    }
  }

  private async syncOperation(operation: SyncOperation): Promise<{
    success: boolean;
    conflict?: boolean;
    error?: string;
  }> {
    try {
      // Check for conflicts
      const conflicts = await this.detectConflicts(operation);
      if (conflicts.length > 0) {
        operation.conflicts = conflicts;
        return { success: false, conflict: true };
      }

      // Apply operation based on type
      await this.applyOperation(operation);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async detectConflicts(
    operation: SyncOperation,
  ): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    // Check version conflicts
    const currentVersion = await this.getCurrentVersion(operation.keyId);
    if (currentVersion > operation.version) {
      conflicts.push({
        operationId: operation.id,
        conflictType: "version",
        description: "Remote version is newer than local",
      });
    }

    // Check permission conflicts
    if (operation.type === SyncOperationType.UPDATE_PERMISSIONS) {
      const hasPermission = await this.checkPermissionConflict(operation);
      if (!hasPermission) {
        conflicts.push({
          operationId: operation.id,
          conflictType: "permission",
          description: "Insufficient permissions for operation",
        });
      }
    }

    // Check concurrent modifications
    const recentOps = await this.getRecentOperations(
      operation.keyId,
      operation.timestamp,
    );
    if (recentOps.length > 0) {
      conflicts.push({
        operationId: operation.id,
        conflictType: "concurrent",
        description: "Concurrent modifications detected",
      });
    }

    return conflicts;
  }

  private async applyOperation(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case SyncOperationType.CREATE:
        await this.applyCreateOperation(operation);
        break;
      case SyncOperationType.UPDATE:
        await this.applyUpdateOperation(operation);
        break;
      case SyncOperationType.DELETE:
        await this.applyDeleteOperation(operation);
        break;
      case SyncOperationType.ROTATE_KEY:
        await this.applyKeyRotation(operation);
        break;
      case SyncOperationType.ADD_MEMBER:
        await this.applyAddMember(operation);
        break;
      case SyncOperationType.REMOVE_MEMBER:
        await this.applyRemoveMember(operation);
        break;
      case SyncOperationType.UPDATE_PERMISSIONS:
        await this.applyUpdatePermissions(operation);
        break;
      case SyncOperationType.ADD_AUTO_SHARE_RULE:
        await this.applyAddAutoShareRule(operation);
        break;
      case SyncOperationType.REMOVE_AUTO_SHARE_RULE:
        await this.applyRemoveAutoShareRule(operation);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private async applyCreateOperation(operation: SyncOperation): Promise<void> {
    // Create sharing key on this device
    const { name, type, ownerId, permissions, memberIds } = operation.data;
    await sharingKeyManager.createSharingKey(type, name, ownerId, {
      permissions,
      memberIds,
    });
  }

  private async applyUpdateOperation(operation: SyncOperation): Promise<void> {
    // Update sharing key metadata
    const { keyId, updates } = operation.data;
    const keyData = await sharingKeyManager.getSharingKey(keyId);
    if (keyData) {
      Object.assign(keyData.metadata, updates);
      // Persist updated metadata
    }
  }

  private async applyDeleteOperation(operation: SyncOperation): Promise<void> {
    // Mark sharing key as inactive
    const { keyId } = operation.data;
    const keyData = await sharingKeyManager.getSharingKey(keyId);
    if (keyData) {
      keyData.metadata.isActive = false;
      // Persist updated metadata
    }
  }

  private async applyKeyRotation(operation: SyncOperation): Promise<void> {
    const { keyId } = operation.data;
    await sharingKeyManager.rotateSharingKey(keyId);
  }

  private async applyAddMember(operation: SyncOperation): Promise<void> {
    const { keyId, memberId, permissions } = operation.data;
    await sharingKeyManager.addMember(keyId, memberId, permissions);
  }

  private async applyRemoveMember(operation: SyncOperation): Promise<void> {
    const { keyId, memberId } = operation.data;
    await sharingKeyManager.removeMember(keyId, memberId);
  }

  private async applyUpdatePermissions(
    operation: SyncOperation,
  ): Promise<void> {
    const { keyId, userId, newRole } = operation.data;
    await permissionManager.updateUserRole(
      keyId,
      userId,
      newRole,
      operation.userId,
    );
  }

  private async applyAddAutoShareRule(operation: SyncOperation): Promise<void> {
    // This would call the family sharing service
    // For now, just log the operation
    console.log("Add auto-share rule:", operation.data);
  }

  private async applyRemoveAutoShareRule(
    operation: SyncOperation,
  ): Promise<void> {
    // This would call the family sharing service
    // For now, just log the operation
    console.log("Remove auto-share rule:", operation.data);
  }

  private async getCurrentVersion(keyId: string): Promise<number> {
    // Get current version from server or local cache
    // For now, return sync state version
    return this.syncState.syncVersion;
  }

  private async checkPermissionConflict(
    operation: SyncOperation,
  ): Promise<boolean> {
    // Check if user has permissions for this operation
    const keyData = await sharingKeyManager.getSharingKey(operation.keyId);
    if (!keyData) {
      return false;
    }

    // Check based on operation type
    switch (operation.type) {
      case SyncOperationType.UPDATE_PERMISSIONS:
        return await permissionManager
          .evaluatePermission({
            userId: operation.userId,
            keyId: operation.keyId,
            action: PermissionAction.EDIT_PERMISSIONS,
            targetUserId: operation.data.userId,
          })
          .then((result) => result.allowed);
      default:
        return true;
    }
  }

  private async getRecentOperations(
    keyId: string,
    since: number,
  ): Promise<SyncOperation[]> {
    // Get operations from other devices since the given timestamp
    return this.syncState.pendingOperations.filter(
      (op) =>
        op.keyId === keyId &&
        op.deviceId !== this.deviceId &&
        op.timestamp > since,
    );
  }

  private generateOperationId(): string {
    return `op_${this.deviceId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private async initializeSyncState(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(
        `sharing_sync_state_${this.deviceId}`,
      );
      if (stored) {
        this.syncState = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to initialize sync state:", error);
    }
  }

  private async persistSyncState(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `sharing_sync_state_${this.deviceId}`,
        JSON.stringify(this.syncState),
      );
    } catch (error) {
      console.error("Failed to persist sync state:", error);
    }
  }

  private setupNetworkListeners(): void {
    // In a real implementation, this would listen to network state changes
    // For React Native, would use NetInfo or similar
    if (typeof window !== "undefined" && "navigator" in window) {
      window.addEventListener("online", () => {
        this.isOnline = true;
        this.syncState.isOnline = true;
        this.performSync();
      });

      window.addEventListener("offline", () => {
        this.isOnline = false;
        this.syncState.isOnline = false;
      });
    }
  }
}

// Global sync manager instance
let globalSyncManager: SharingDeviceSync | null = null;

/**
 * Initialize device sync manager
 */
export async function initializeDeviceSync(
  deviceId: string,
  config?: Partial<SyncConfig>,
): Promise<SharingDeviceSync> {
  if (globalSyncManager) {
    globalSyncManager.stopSync();
  }

  globalSyncManager = new SharingDeviceSync(deviceId, config);
  globalSyncManager.startSync();

  return globalSyncManager;
}

/**
 * Get current sync manager
 */
export function getSyncManager(): SharingDeviceSync | null {
  return globalSyncManager;
}

/**
 * Queue sharing operation for sync
 */
export async function queueSharingOperation(
  type: SyncOperationType,
  keyId: string,
  userId: string,
  data: any,
): Promise<string> {
  if (!globalSyncManager) {
    throw new Error("Sync manager not initialized");
  }

  return await globalSyncManager.queueOperation(type, keyId, userId, data);
}

/**
 * Force immediate sync
 */
export async function forceSharingSync(): Promise<{
  success: boolean;
  synced: number;
  conflicts: number;
  errors: string[];
}> {
  if (!globalSyncManager) {
    throw new Error("Sync manager not initialized");
  }

  return await globalSyncManager.forceSync();
}

/**
 * Get sync status
 */
export function getSharingSyncStatus(): {
  isOnline: boolean;
  lastSync: number;
  pendingOperations: number;
  conflictOperations: number;
  syncVersion: number;
} {
  if (!globalSyncManager) {
    return {
      isOnline: false,
      lastSync: 0,
      pendingOperations: 0,
      conflictOperations: 0,
      syncVersion: 0,
    };
  }

  return globalSyncManager.getSyncStatus();
}
