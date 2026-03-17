// AI-META-BEGIN
// AI-META: Delta sync algorithm with change detection and partial uploads
// OWNERSHIP: client/lib (sync optimization)
// ENTRYPOINTS: Imported by background-sync.ts for efficient sync operations
// DEPENDENCIES: @react-native-async-storage/async-storage, @/lib/storage, crypto
// AI-META-END

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Photo, Album } from "@/types";
import * as storage from "./storage";
import * as crypto from "crypto";

// Sync operation types
export enum SyncOperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
}

// Sync operation for tracking changes
export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  entityType: "photo" | "album";
  entityId: string;
  timestamp: number;
  data?: any; // For create/update operations
  previousData?: any; // For update operations
  checksum?: string; // For integrity verification
}

// Delta sync state
export interface DeltaSyncState {
  lastSyncTime: number | null;
  pendingOperations: SyncOperation[];
  failedOperations: SyncOperation[];
  syncInProgress: boolean;
  totalPhotosSynced: number;
  totalAlbumsSynced: number;
  totalBytesSynced: number;
}

// Sync result
export interface DeltaSyncResult {
  success: boolean;
  operationsProcessed: number;
  bytesTransferred: number;
  errors: string[];
  newLastSyncTime: number;
  hasMoreData: boolean;
}

// Change detection result
export interface ChangeDetectionResult {
  newPhotos: Photo[];
  updatedPhotos: Photo[];
  deletedPhotos: string[];
  newAlbums: Album[];
  updatedAlbums: Album[];
  deletedAlbums: string[];
  totalChanges: number;
}

// Storage keys
const DELTA_SYNC_STATE_KEY = "@delta_sync_state";
const CHECKSUMS_KEY = "@entity_checksums";

// Entity checksums for change detection
interface EntityChecksums {
  photos: Record<string, string>; // photoId -> checksum
  albums: Record<string, string>; // albumId -> checksum
  lastCalculated: number;
}

/**
 * Calculate checksum for an entity
 */
export function calculateChecksum(entity: Photo | Album): string {
  // Create a deterministic string representation
  const entityString = JSON.stringify({
    id: entity.id,
    modifiedAt: entity.modifiedAt,
    // Include only fields that affect sync
    ...(entity.id.startsWith("photo_")
      ? {
          uri: (entity as Photo).uri,
          width: (entity as Photo).width,
          height: (entity as Photo).height,
          isFavorite: (entity as Photo).isFavorite,
          albumIds: (entity as Photo).albumIds,
        }
      : {
          title: (entity as Album).title,
          coverPhotoUri: (entity as Album).coverPhotoUri,
          photoIds: (entity as Album).photoIds,
        }),
  });

  // Create hash using Node.js crypto
  return crypto.createHash("sha256").update(entityString).digest("hex");
}

/**
 * Get entity checksums from storage
 */
export async function getEntityChecksums(): Promise<EntityChecksums> {
  try {
    const stored = await AsyncStorage.getItem(CHECKSUMS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      photos: {},
      albums: {},
      lastCalculated: 0,
    };
  } catch (error) {
    console.error("Error loading checksums:", error);
    return {
      photos: {},
      albums: {},
      lastCalculated: 0,
    };
  }
}

/**
 * Save entity checksums to storage
 */
export async function saveEntityChecksums(
  checksums: EntityChecksums,
): Promise<void> {
  try {
    checksums.lastCalculated = Date.now();
    await AsyncStorage.setItem(CHECKSUMS_KEY, JSON.stringify(checksums));
  } catch (error) {
    console.error("Error saving checksums:", error);
  }
}

/**
 * Detect changes since last sync
 */
export async function detectChanges(): Promise<ChangeDetectionResult> {
  try {
    const currentPhotos = await storage.getPhotos();
    const currentAlbums = await storage.getAlbums();
    const checksums = await getEntityChecksums();

    const result: ChangeDetectionResult = {
      newPhotos: [],
      updatedPhotos: [],
      deletedPhotos: [],
      newAlbums: [],
      updatedAlbums: [],
      deletedAlbums: [],
      totalChanges: 0,
    };

    // Check for new and updated photos
    for (const photo of currentPhotos) {
      const existingChecksum = checksums.photos[photo.id];
      const currentChecksum = calculateChecksum(photo);

      if (!existingChecksum) {
        // New photo
        result.newPhotos.push(photo);
        checksums.photos[photo.id] = currentChecksum;
      } else if (existingChecksum !== currentChecksum) {
        // Updated photo
        result.updatedPhotos.push(photo);
        checksums.photos[photo.id] = currentChecksum;
      }
    }

    // Check for deleted photos
    for (const photoId of Object.keys(checksums.photos)) {
      if (!currentPhotos.find((p) => p.id === photoId)) {
        result.deletedPhotos.push(photoId);
        delete checksums.photos[photoId];
      }
    }

    // Check for new and updated albums
    for (const album of currentAlbums) {
      const existingChecksum = checksums.albums[album.id];
      const currentChecksum = calculateChecksum(album);

      if (!existingChecksum) {
        // New album
        result.newAlbums.push(album);
        checksums.albums[album.id] = currentChecksum;
      } else if (existingChecksum !== currentChecksum) {
        // Updated album
        result.updatedAlbums.push(album);
        checksums.albums[album.id] = currentChecksum;
      }
    }

    // Check for deleted albums
    for (const albumId of Object.keys(checksums.albums)) {
      if (!currentAlbums.find((a) => a.id === albumId)) {
        result.deletedAlbums.push(albumId);
        delete checksums.albums[albumId];
      }
    }

    // Calculate total changes
    result.totalChanges =
      result.newPhotos.length +
      result.updatedPhotos.length +
      result.deletedPhotos.length +
      result.newAlbums.length +
      result.updatedAlbums.length +
      result.deletedAlbums.length;

    // Save updated checksums
    await saveEntityChecksums(checksums);

    return result;
  } catch (error) {
    console.error("Error detecting changes:", error);
    return {
      newPhotos: [],
      updatedPhotos: [],
      deletedPhotos: [],
      newAlbums: [],
      updatedAlbums: [],
      deletedAlbums: [],
      totalChanges: 0,
    };
  }
}

/**
 * Create sync operations from change detection
 */
export function createSyncOperations(
  changes: ChangeDetectionResult,
): SyncOperation[] {
  const operations: SyncOperation[] = [];
  const timestamp = Date.now();

  // Photo operations
  for (const photo of changes.newPhotos) {
    operations.push({
      id: `sync_${timestamp}_${photo.id}_create`,
      type: SyncOperationType.CREATE,
      entityType: "photo",
      entityId: photo.id,
      timestamp,
      data: photo,
      checksum: calculateChecksum(photo),
    });
  }

  for (const photo of changes.updatedPhotos) {
    operations.push({
      id: `sync_${timestamp}_${photo.id}_update`,
      type: SyncOperationType.UPDATE,
      entityType: "photo",
      entityId: photo.id,
      timestamp,
      data: photo,
      checksum: calculateChecksum(photo),
    });
  }

  for (const photoId of changes.deletedPhotos) {
    operations.push({
      id: `sync_${timestamp}_${photoId}_delete`,
      type: SyncOperationType.DELETE,
      entityType: "photo",
      entityId: photoId,
      timestamp,
    });
  }

  // Album operations
  for (const album of changes.newAlbums) {
    operations.push({
      id: `sync_${timestamp}_${album.id}_create`,
      type: SyncOperationType.CREATE,
      entityType: "album",
      entityId: album.id,
      timestamp,
      data: album,
      checksum: calculateChecksum(album),
    });
  }

  for (const album of changes.updatedAlbums) {
    operations.push({
      id: `sync_${timestamp}_${album.id}_update`,
      type: SyncOperationType.UPDATE,
      entityType: "album",
      entityId: album.id,
      timestamp,
      data: album,
      checksum: calculateChecksum(album),
    });
  }

  for (const albumId of changes.deletedAlbums) {
    operations.push({
      id: `sync_${timestamp}_${albumId}_delete`,
      type: SyncOperationType.DELETE,
      entityType: "album",
      entityId: albumId,
      timestamp,
    });
  }

  return operations;
}

/**
 * Get delta sync state from storage
 */
export async function getDeltaSyncState(): Promise<DeltaSyncState> {
  try {
    const stored = await AsyncStorage.getItem(DELTA_SYNC_STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      lastSyncTime: null,
      pendingOperations: [],
      failedOperations: [],
      syncInProgress: false,
      totalPhotosSynced: 0,
      totalAlbumsSynced: 0,
      totalBytesSynced: 0,
    };
  } catch (error) {
    console.error("Error loading delta sync state:", error);
    return {
      lastSyncTime: null,
      pendingOperations: [],
      failedOperations: [],
      syncInProgress: false,
      totalPhotosSynced: 0,
      totalAlbumsSynced: 0,
      totalBytesSynced: 0,
    };
  }
}

/**
 * Save delta sync state to storage
 */
export async function saveDeltaSyncState(state: DeltaSyncState): Promise<void> {
  try {
    await AsyncStorage.setItem(DELTA_SYNC_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Error saving delta sync state:", error);
  }
}

/**
 * Add operations to pending queue
 */
export async function addPendingOperations(
  operations: SyncOperation[],
): Promise<void> {
  try {
    const state = await getDeltaSyncState();
    state.pendingOperations.push(...operations);
    await saveDeltaSyncState(state);
  } catch (error) {
    console.error("Error adding pending operations:", error);
  }
}

/**
 * Process pending sync operations
 */
export async function processPendingOperations(
  batchSize: number = 10,
  onProgress?: (processed: number, total: number) => void,
): Promise<DeltaSyncResult> {
  const startTime = Date.now();
  const result: DeltaSyncResult = {
    success: false,
    operationsProcessed: 0,
    bytesTransferred: 0,
    errors: [],
    newLastSyncTime: startTime,
    hasMoreData: false,
  };

  try {
    const state = await getDeltaSyncState();

    if (state.syncInProgress) {
      result.errors.push("Sync already in progress");
      return result;
    }

    if (state.pendingOperations.length === 0) {
      result.success = true;
      return result;
    }

    // Mark sync as in progress
    state.syncInProgress = true;
    await saveDeltaSyncState(state);

    // Process operations in batches
    const operationsToProcess = state.pendingOperations.slice(0, batchSize);
    const remainingOperations = state.pendingOperations.slice(batchSize);

    for (let i = 0; i < operationsToProcess.length; i++) {
      const operation = operationsToProcess[i];

      try {
        await processSyncOperation(operation);
        result.operationsProcessed++;

        // Update statistics
        if (operation.entityType === "photo") {
          state.totalPhotosSynced++;
          // Estimate bytes transferred (rough calculation)
          if (operation.data && operation.data.uri) {
            result.bytesTransferred += estimatePhotoSize(operation.data);
          }
        } else if (operation.entityType === "album") {
          state.totalAlbumsSynced++;
          result.bytesTransferred += 1024; // 1KB for album metadata
        }

        // Report progress
        if (onProgress) {
          onProgress(i + 1, operationsToProcess.length);
        }
      } catch (error) {
        const errorMessage = `Failed to process ${operation.type} for ${operation.entityType} ${operation.entityId}: ${error}`;
        console.error(errorMessage);
        result.errors.push(errorMessage);

        // Add to failed operations
        state.failedOperations.push(operation);
      }
    }

    // Update state with remaining operations
    state.pendingOperations = remainingOperations;
    state.lastSyncTime = startTime;
    state.totalBytesSynced += result.bytesTransferred;
    state.syncInProgress = false;

    await saveDeltaSyncState(state);

    // Check if there are more operations to process
    result.hasMoreData = remainingOperations.length > 0;
    result.success =
      result.errors.length === 0 || result.operationsProcessed > 0;

    return result;
  } catch (error) {
    console.error("Error processing pending operations:", error);
    result.errors.push(`Processing error: ${error}`);

    // Reset sync in progress flag
    try {
      const state = await getDeltaSyncState();
      state.syncInProgress = false;
      await saveDeltaSyncState(state);
    } catch (resetError) {
      console.error("Error resetting sync in progress flag:", resetError);
    }

    return result;
  }
}

/**
 * Process a single sync operation
 */
async function processSyncOperation(operation: SyncOperation): Promise<void> {
  // This is where you'd implement the actual server communication
  // For now, we'll simulate the operation

  switch (operation.type) {
    case SyncOperationType.CREATE:
      await simulateServerCreate(operation);
      break;
    case SyncOperationType.UPDATE:
      await simulateServerUpdate(operation);
      break;
    case SyncOperationType.DELETE:
      await simulateServerDelete(operation);
      break;
    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

/**
 * Simulate server create operation
 */
async function simulateServerCreate(operation: SyncOperation): Promise<void> {
  // Simulate network delay
  await new Promise((resolve) =>
    setTimeout(resolve, 100 + Math.random() * 200),
  );

  // Simulate occasional failures (5% failure rate)
  if (Math.random() < 0.05) {
    throw new Error("Simulated server error during create");
  }

  console.log(`Created ${operation.entityType} ${operation.entityId}`);
}

/**
 * Simulate server update operation
 */
async function simulateServerUpdate(operation: SyncOperation): Promise<void> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 150));

  // Simulate occasional failures (3% failure rate)
  if (Math.random() < 0.03) {
    throw new Error("Simulated server error during update");
  }

  console.log(`Updated ${operation.entityType} ${operation.entityId}`);
}

/**
 * Simulate server delete operation
 */
async function simulateServerDelete(operation: SyncOperation): Promise<void> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 100));

  // Simulate occasional failures (2% failure rate)
  if (Math.random() < 0.02) {
    throw new Error("Simulated server error during delete");
  }

  console.log(`Deleted ${operation.entityType} ${operation.entityId}`);
}

/**
 * Estimate photo size for bandwidth calculation
 */
function estimatePhotoSize(photo: Photo): number {
  // Rough estimation based on dimensions
  const megapixels = (photo.width * photo.height) / 1000000;

  // Assume JPEG compression with varying quality
  let bytesPerPixel;
  if (megapixels < 1) {
    bytesPerPixel = 0.5; // High compression for small photos
  } else if (megapixels < 5) {
    bytesPerPixel = 1.0; // Medium compression
  } else if (megapixels < 12) {
    bytesPerPixel = 2.0; // Lower compression for medium photos
  } else {
    bytesPerPixel = 4.0; // Low compression for large photos
  }

  return Math.round(photo.width * photo.height * bytesPerPixel);
}

/**
 * Retry failed operations
 */
export async function retryFailedOperations(
  maxRetries: number = 3,
): Promise<DeltaSyncResult> {
  try {
    const state = await getDeltaSyncState();
    const failedOperations = [...state.failedOperations];

    // Clear failed operations
    state.failedOperations = [];
    await saveDeltaSyncState(state);

    // Add failed operations back to pending queue
    await addPendingOperations(failedOperations);

    // Process them
    return await processPendingOperations(failedOperations.length);
  } catch (error) {
    console.error("Error retrying failed operations:", error);
    return {
      success: false,
      operationsProcessed: 0,
      bytesTransferred: 0,
      errors: [`Retry error: ${error}`],
      newLastSyncTime: Date.now(),
      hasMoreData: false,
    };
  }
}

/**
 * Clear all sync state (for testing or reset)
 */
export async function clearSyncState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DELTA_SYNC_STATE_KEY);
    await AsyncStorage.removeItem(CHECKSUMS_KEY);
  } catch (error) {
    console.error("Error clearing sync state:", error);
  }
}

/**
 * Get sync statistics
 */
export async function getSyncStatistics(): Promise<{
  pendingOperations: number;
  failedOperations: number;
  lastSyncTime: number | null;
  totalPhotosSynced: number;
  totalAlbumsSynced: number;
  totalBytesSynced: number;
}> {
  try {
    const state = await getDeltaSyncState();
    return {
      pendingOperations: state.pendingOperations.length,
      failedOperations: state.failedOperations.length,
      lastSyncTime: state.lastSyncTime,
      totalPhotosSynced: state.totalPhotosSynced,
      totalAlbumsSynced: state.totalAlbumsSynced,
      totalBytesSynced: state.totalBytesSynced,
    };
  } catch (error) {
    console.error("Error getting sync statistics:", error);
    return {
      pendingOperations: 0,
      failedOperations: 0,
      lastSyncTime: null,
      totalPhotosSynced: 0,
      totalAlbumsSynced: 0,
      totalBytesSynced: 0,
    };
  }
}

// Export types for use in other modules
export type {
  SyncOperation,
  DeltaSyncState,
  DeltaSyncResult,
  ChangeDetectionResult,
};
