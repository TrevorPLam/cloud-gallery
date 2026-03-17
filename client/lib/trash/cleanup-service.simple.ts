// AI-META-BEGIN
// AI-META: Simplified cleanup service for testing without background dependencies
// OWNERSHIP: client/lib/trash
// ENTRYPOINTS: Used by TrashScreen and background tasks
// DEPENDENCIES: Storage, API client
// DANGER: Permanent deletion is irreversible
// CHANGE-SAFETY: Safe to add; verify retention period and cleanup logic
// TESTS: Cleanup accuracy, edge cases
// AI-META-END

import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";
import { Photo } from "@/types";

// Configuration constants
const TRASH_RETENTION_DAYS = 30;
const LAST_CLEANUP_KEY = "@trash_last_cleanup";
const CLEANUP_JITTER_MS = 60000; // 1 minute jitter to prevent server load spikes

export interface CleanupResult {
  success: boolean;
  deletedCount: number;
  error?: string;
  nextCleanupTime: Date;
}

export interface TrashItem extends Photo {
  daysUntilDeletion: number;
  willBeDeletedSoon: boolean; // Less than 3 days
}

/**
 * Calculate days until deletion for a trash item
 */
export function calculateDaysUntilDeletion(deletedAt: string | Date): number {
  const deletedDate = new Date(deletedAt);
  const now = new Date();
  const retentionPeriod = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000; // 30 days in ms
  const timeUntilDeletion =
    deletedDate.getTime() + retentionPeriod - now.getTime();
  return Math.max(0, Math.ceil(timeUntilDeletion / (24 * 60 * 60 * 1000)));
}

/**
 * Check if an item will be deleted soon (less than 3 days)
 */
export function willBeDeletedSoon(deletedAt: string | Date): boolean {
  return calculateDaysUntilDeletion(deletedAt) <= 3;
}

/**
 * Get trash items with deletion countdown information
 */
export async function getTrashItemsWithCountdown(): Promise<TrashItem[]> {
  try {
    const res = await apiRequest("GET", "/api/photos/user/trash");
    const data = await res.json();
    const photos: Photo[] = data.photos || [];

    return photos.map((photo) => ({
      ...photo,
      daysUntilDeletion: calculateDaysUntilDeletion(photo.deletedAt!),
      willBeDeletedSoon: willBeDeletedSoon(photo.deletedAt!),
    }));
  } catch (error) {
    console.error("Failed to fetch trash items:", error);
    throw error;
  }
}

/**
 * Perform automatic cleanup of expired trash items
 */
export async function performAutomaticCleanup(): Promise<CleanupResult> {
  try {
    // Add jitter to prevent server load spikes
    const jitter = Math.random() * CLEANUP_JITTER_MS;
    await new Promise((resolve) => setTimeout(resolve, jitter));

    // Call cleanup endpoint
    const res = await apiRequest("POST", "/api/photos/cleanup-expired");
    const result = await res.json();

    // Update last cleanup time
    await AsyncStorage.setItem(LAST_CLEANUP_KEY, new Date().toISOString());

    return {
      success: true,
      deletedCount: result.deletedCount || 0,
      nextCleanupTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    };
  } catch (error) {
    console.error("Automatic cleanup failed:", error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      nextCleanupTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // Retry in 4 hours
    };
  }
}

/**
 * Get the last cleanup timestamp
 */
export async function getLastCleanupTime(): Promise<Date | null> {
  try {
    const lastCleanup = await AsyncStorage.getItem(LAST_CLEANUP_KEY);
    return lastCleanup ? new Date(lastCleanup) : null;
  } catch (error) {
    console.error("Failed to get last cleanup time:", error);
    return null;
  }
}

/**
 * Check if cleanup is needed (hasn't run in last 24 hours)
 */
export async function isCleanupNeeded(): Promise<boolean> {
  const lastCleanup = await getLastCleanupTime();
  if (!lastCleanup) return true;

  const hoursSinceLastCleanup =
    (Date.now() - lastCleanup.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastCleanup >= 24;
}

/**
 * Get cleanup statistics
 */
export async function getCleanupStats(): Promise<{
  totalTrashItems: number;
  itemsToDeleteSoon: number;
  lastCleanup: Date | null;
  nextCleanup: Date;
}> {
  try {
    const trashItems = await getTrashItemsWithCountdown();
    const lastCleanup = await getLastCleanupTime();

    return {
      totalTrashItems: trashItems.length,
      itemsToDeleteSoon: trashItems.filter((item) => item.willBeDeletedSoon)
        .length,
      lastCleanup,
      nextCleanup: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  } catch (error) {
    console.error("Failed to get cleanup stats:", error);
    return {
      totalTrashItems: 0,
      itemsToDeleteSoon: 0,
      lastCleanup: null,
      nextCleanup: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }
}

/**
 * Format deletion time for display
 */
export function formatDeletionTime(deletedAt: string | Date): string {
  const days = calculateDaysUntilDeletion(deletedAt);

  if (days === 0) {
    return "Deletes today";
  } else if (days === 1) {
    return "Deletes tomorrow";
  } else if (days <= 7) {
    return `Deletes in ${days} days`;
  } else if (days <= 30) {
    const weeks = Math.ceil(days / 7);
    return `Deletes in ${weeks} week${weeks > 1 ? "s" : ""}`;
  } else {
    return "Deletes in 30 days";
  }
}

/**
 * Configure background cleanup (placeholder for testing)
 */
export async function configureBackgroundCleanup(): Promise<boolean> {
  try {
    console.log("Background cleanup configuration (placeholder)");
    return true;
  } catch (error) {
    console.error("Failed to configure background cleanup:", error);
    return false;
  }
}

/**
 * Stop background cleanup (placeholder for testing)
 */
export async function stopBackgroundCleanup(): Promise<void> {
  try {
    console.log("Background cleanup stopped (placeholder)");
  } catch (error) {
    console.error("Failed to stop background cleanup:", error);
  }
}

/**
 * Check if cleanup service is active (placeholder for testing)
 */
export async function isCleanupServiceActive(): Promise<boolean> {
  return true;
}
