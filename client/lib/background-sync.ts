// AI-META-BEGIN
// AI-META: Background sync manager with Expo BackgroundTask integration
// OWNERSHIP: client/lib (background operations)
// ENTRYPOINTS: Imported by App.tsx for background task registration
// DEPENDENCIES: expo-background-task, expo-battery, @/lib/storage, @/lib/network-sync
// AI-META-END

import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

// Import BackgroundTaskResult for proper typing
declare module 'expo-background-task' {
  export enum BackgroundTaskResult {
    Success = 'success',
    Failure = 'failure',
    NoData = 'no_data',
  }
}

// Task name for background sync
export const BACKGROUND_SYNC_TASK = 'background-sync';

// Background sync configuration
export interface BackgroundSyncConfig {
  minimumInterval: number; // minutes
  requiresNetworkConnectivity: boolean;
  requiresCharging: boolean;
  requiresBatteryNotLow: boolean;
  stopOnTerminate: boolean;
  startOnBoot: boolean;
}

// Default configuration optimized for photo backup
const DEFAULT_CONFIG: BackgroundSyncConfig = {
  minimumInterval: 60, // 1 hour minimum
  requiresNetworkConnectivity: true,
  requiresCharging: false, // Allow on battery but with optimization
  requiresBatteryNotLow: true,
  stopOnTerminate: false, // Android only
  startOnBoot: true, // Android only
};

// Background sync result types
export enum SyncResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
  NO_DATA = 'no_data',
  NETWORK_ERROR = 'network_error',
  BATTERY_LOW = 'battery_low',
  USER_PAUSED = 'user_paused',
}

// Sync statistics for monitoring
export interface SyncStats {
  lastSyncTime: number | null;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageSyncDuration: number;
  lastError: string | null;
}

// Global sync statistics (persisted in storage)
let syncStats: SyncStats = {
  lastSyncTime: null,
  totalSyncs: 0,
  successfulSyncs: 0,
  failedSyncs: 0,
  averageSyncDuration: 0,
  lastError: null,
};

/**
 * Register the background sync task with the system
 */
export async function registerBackgroundSyncTask(
  config: Partial<BackgroundSyncConfig> = {}
): Promise<boolean> {
  try {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Check if background tasks are available
    const isAvailable = await BackgroundTask.isAvailableAsync();
    if (!isAvailable) {
      console.warn('Background tasks are not available on this device');
      return false;
    }

    // Register the task
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: finalConfig.minimumInterval * 60, // Convert minutes to seconds
    });

    console.log('Background sync task registered successfully');
    return true;
  } catch (error) {
    console.error('Failed to register background sync task:', error);
    return false;
  }
}

/**
 * Unregister the background sync task
 */
export async function unregisterBackgroundSyncTask(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    console.log('Background sync task unregistered');
  } catch (error) {
    console.error('Failed to unregister background sync task:', error);
  }
}

/**
 * Check if the background sync task is registered
 */
export async function isBackgroundSyncRegistered(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  } catch (error) {
    console.error('Error checking background sync registration:', error);
    return false;
  }
}

/**
 * Get the current status of background tasks
 */
export async function getBackgroundTaskStatus(): Promise<BackgroundTask.BackgroundTaskStatus> {
  try {
    return await BackgroundTask.getStatusAsync();
  } catch (error) {
    console.error('Error getting background task status:', error);
    return BackgroundTask.BackgroundTaskStatus.Denied;
  }
}

/**
 * Update sync statistics
 */
export function updateSyncStats(result: SyncResult, duration: number, error?: string): void {
  syncStats.totalSyncs++;
  syncStats.lastSyncTime = Date.now();
  
  if (result === SyncResult.SUCCESS) {
    syncStats.successfulSyncs++;
  } else {
    syncStats.failedSyncs++;
    syncStats.lastError = error || null;
  }

  // Update average duration
  const totalDuration = syncStats.averageSyncDuration * (syncStats.totalSyncs - 1) + duration;
  syncStats.averageSyncDuration = totalDuration / syncStats.totalSyncs;
}

/**
 * Get current sync statistics
 */
export function getSyncStats(): SyncStats {
  return { ...syncStats };
}

/**
 * Reset sync statistics
 */
export function resetSyncStats(): void {
  syncStats = {
    lastSyncTime: null,
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    averageSyncDuration: 0,
    lastError: null,
  };
}

/**
 * Check if background sync should run based on device conditions
 */
export async function shouldRunBackgroundSync(): Promise<{
  shouldRun: boolean;
  reason?: string;
}> {
  try {
    // Import dynamically to avoid circular dependencies
    const { isBatteryOptimal } = await import('./battery-sync');
    const { isNetworkOptimal } = await import('./network-sync');

    // Check battery conditions
    const batteryOk = await isBatteryOptimal();
    if (!batteryOk.isOptimal) {
      return {
        shouldRun: false,
        reason: batteryOk.reason,
      };
    }

    // Check network conditions
    const networkOk = await isNetworkOptimal();
    if (!networkOk.isOptimal) {
      return {
        shouldRun: false,
        reason: networkOk.reason,
      };
    }

    return { shouldRun: true };
  } catch (error) {
    console.error('Error checking background sync conditions:', error);
    return {
      shouldRun: false,
      reason: 'Error checking conditions',
    };
  }
}

/**
 * Trigger background sync manually for testing
 */
export async function triggerBackgroundSyncForTesting(): Promise<void> {
  try {
    if (__DEV__) {
      await BackgroundTask.triggerTaskWorkerForTestingAsync(BACKGROUND_SYNC_TASK);
      console.log('Background sync triggered for testing');
    }
  } catch (error) {
    console.error('Failed to trigger background sync for testing:', error);
  }
}

/**
 * Initialize background sync system
 */
export async function initializeBackgroundSync(): Promise<void> {
  try {
    // Check if already registered
    const isRegistered = await isBackgroundSyncRegistered();
    if (isRegistered) {
      console.log('Background sync already registered');
      return;
    }

    // Register the task
    const success = await registerBackgroundSyncTask();
    if (success) {
      console.log('Background sync initialized successfully');
    } else {
      console.warn('Failed to initialize background sync');
    }
  } catch (error) {
    console.error('Error initializing background sync:', error);
  }
}

// Export types for use in other modules
export type { BackgroundSyncConfig };
