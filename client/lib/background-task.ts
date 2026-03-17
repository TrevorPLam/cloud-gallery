// AI-META-BEGIN
// AI-META: Background task definition for Expo BackgroundTask integration
// OWNERSHIP: client/lib (background tasks)
// ENTRYPOINTS: Imported by App.tsx for task registration
// DEPENDENCIES: expo-task-manager, @/lib/background-sync, @/lib/delta-sync
// AI-META-END

import * as TaskManager from "expo-task-manager";
import {
  BACKGROUND_SYNC_TASK,
  updateSyncStats,
  shouldRunBackgroundSync,
} from "./background-sync";
import {
  detectChanges,
  createSyncOperations,
  processPendingOperations,
} from "./delta-sync";
import { updateNetworkStats, getCurrentNetworkState } from "./network-sync";
import { updateBatteryStats, getCurrentBatteryState } from "./battery-sync";

// Define SyncResult enum locally to avoid import issues
export enum SyncResult {
  SUCCESS = "success",
  FAILURE = "failure",
  NO_DATA = "no_data",
  NETWORK_ERROR = "network_error",
  BATTERY_LOW = "battery_low",
  USER_PAUSED = "user_paused",
}

/**
 * Background sync task definition
 * This task runs when the app is backgrounded and performs photo/album sync
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  console.log("Background sync task started");
  const startTime = Date.now();

  try {
    // Check if sync should run based on current conditions
    const shouldRun = await shouldRunBackgroundSync();
    if (!shouldRun.shouldRun) {
      console.log(`Background sync skipped: ${shouldRun.reason}`);
      return SyncResult.USER_PAUSED;
    }

    // Get current network and battery states for statistics
    const networkState = await getCurrentNetworkState();
    const batteryState = await getCurrentBatteryState();

    // Detect changes since last sync
    const changes = await detectChanges();
    console.log(`Detected ${changes.totalChanges} changes`);

    if (changes.totalChanges === 0) {
      console.log("No changes to sync");
      updateSyncStats(SyncResult.NO_DATA, Date.now() - startTime);
      return SyncResult.NO_DATA;
    }

    // Create sync operations from detected changes
    const operations = createSyncOperations(changes);
    console.log(`Created ${operations.length} sync operations`);

    // Process operations in batches
    const result = await processPendingOperations(
      20, // Process up to 20 operations per background task
      (processed, total) => {
        console.log(`Sync progress: ${processed}/${total}`);
      },
    );

    // Update statistics
    const duration = Date.now() - startTime;
    const dataUsed = estimateDataUsage(changes);

    updateSyncStats(
      result.success ? SyncResult.SUCCESS : SyncResult.FAILURE,
      duration,
      result.errors.join("; "),
    );

    updateNetworkStats(networkState, dataUsed);
    updateBatteryStats(batteryState);

    console.log(
      `Background sync completed in ${duration}ms, ${result.operationsProcessed} operations processed`,
    );

    return result.success ? SyncResult.SUCCESS : SyncResult.FAILURE;
  } catch (error) {
    console.error("Background sync task failed:", error);

    // Update failure statistics
    const duration = Date.now() - startTime;
    updateSyncStats(SyncResult.FAILURE, duration, String(error));

    return SyncResult.FAILURE;
  }
});

/**
 * Estimate data usage for sync operations
 */
function estimateDataUsage(changes: any): number {
  // Rough estimation in MB
  let dataUsage = 0;

  // Estimate photo data usage
  const photoCount = changes.newPhotos.length + changes.updatedPhotos.length;
  dataUsage += photoCount * 2; // Assume 2MB per photo on average

  // Estimate album metadata usage
  const albumCount = changes.newAlbums.length + changes.updatedAlbums.length;
  dataUsage += albumCount * 0.001; // 1KB per album

  return dataUsage;
}

/**
 * Export the task name for registration
 */
export { BACKGROUND_SYNC_TASK };
