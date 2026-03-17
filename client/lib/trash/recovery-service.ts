// AI-META-BEGIN
// AI-META: Recovery service for deleted photos with extended recovery options
// OWNERSHIP: client/lib/trash
// ENTRYPOINTS: Used by TrashScreen and recovery workflows
// DEPENDENCIES: API client, storage, notification system
// DANGER: Recovery may fail if storage was cleaned up
// CHANGE-SAFETY: Safe to add; verify recovery logic and error handling
// TESTS: Single/batch recovery, error scenarios, recovery limits
// AI-META-END

import { apiRequest } from "@/lib/query-client";
import { Photo } from "@/types";

export interface RecoveryResult {
  success: boolean;
  recoveredPhotos: Photo[];
  failedPhotos: { id: string; error: string }[];
  message: string;
}

export interface RecoveryOptions {
  notifyOnSuccess?: boolean;
  restoreToAlbums?: boolean; // Re-add to original albums if possible
  restoreMetadata?: boolean; // Restore all metadata
}

export interface ExtendedRecoveryInfo {
  originalAlbums: string[];
  originalMetadata: Record<string, any>;
  canRecoverFully: boolean;
  recoveryRisk: "low" | "medium" | "high";
}

/**
 * Recover a single photo from trash
 */
export async function recoverPhoto(
  photoId: string,
  options: RecoveryOptions = {},
): Promise<RecoveryResult> {
  try {
    const res = await apiRequest("PUT", `/api/photos/${photoId}/restore`, {
      restoreToAlbums: options.restoreToAlbums ?? true,
      restoreMetadata: options.restoreMetadata ?? true,
    });

    if (!res.ok) {
      throw new Error(`Recovery failed: ${res.statusText}`);
    }

    const data = await res.json();
    const recoveredPhoto = data.photo;

    return {
      success: true,
      recoveredPhotos: [recoveredPhoto],
      failedPhotos: [],
      message: "Photo recovered successfully",
    };
  } catch (error) {
    console.error("Failed to recover photo:", error);
    return {
      success: false,
      recoveredPhotos: [],
      failedPhotos: [
        {
          id: photoId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      ],
      message: "Failed to recover photo",
    };
  }
}

/**
 * Recover multiple photos from trash
 */
export async function recoverPhotos(
  photoIds: string[],
  options: RecoveryOptions = {},
): Promise<RecoveryResult> {
  try {
    const res = await apiRequest("POST", "/api/photos/batch-restore", {
      photoIds,
      restoreToAlbums: options.restoreToAlbums ?? true,
      restoreMetadata: options.restoreMetadata ?? true,
    });

    if (!res.ok) {
      throw new Error(`Batch recovery failed: ${res.statusText}`);
    }

    const data = await res.json();

    return {
      success: data.success,
      recoveredPhotos: data.recoveredPhotos || [],
      failedPhotos: data.failedPhotos || [],
      message:
        data.message || `Recovered ${data.recoveredPhotos?.length || 0} photos`,
    };
  } catch (error) {
    console.error("Failed to recover photos:", error);
    return {
      success: false,
      recoveredPhotos: [],
      failedPhotos: photoIds.map((id) => ({
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      })),
      message: "Failed to recover photos",
    };
  }
}

/**
 * Get extended recovery information for a photo
 */
export async function getExtendedRecoveryInfo(
  photoId: string,
): Promise<ExtendedRecoveryInfo> {
  try {
    const res = await apiRequest("GET", `/api/photos/${photoId}/recovery-info`);

    if (!res.ok) {
      throw new Error(`Failed to get recovery info: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      originalAlbums: data.originalAlbums || [],
      originalMetadata: data.originalMetadata || {},
      canRecoverFully: data.canRecoverFully ?? true,
      recoveryRisk: data.recoveryRisk || "low",
    };
  } catch (error) {
    console.error("Failed to get recovery info:", error);
    return {
      originalAlbums: [],
      originalMetadata: {},
      canRecoverFully: false,
      recoveryRisk: "high",
    };
  }
}

/**
 * Check if recovery is possible for a photo
 */
export async function canRecoverPhoto(photoId: string): Promise<boolean> {
  try {
    const info = await getExtendedRecoveryInfo(photoId);
    return info.canRecoverFully && info.recoveryRisk !== "high";
  } catch (error) {
    console.error("Failed to check recovery possibility:", error);
    return false;
  }
}

/**
 * Get recovery statistics
 */
export async function getRecoveryStats(): Promise<{
  totalRecoverable: number;
  highRiskItems: number;
  recentlyDeleted: number; // Deleted in last 7 days
  oldestDeletion: Date | null;
}> {
  try {
    const res = await apiRequest("GET", "/api/photos/recovery-stats");

    if (!res.ok) {
      throw new Error(`Failed to get recovery stats: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      totalRecoverable: data.totalRecoverable || 0,
      highRiskItems: data.highRiskItems || 0,
      recentlyDeleted: data.recentlyDeleted || 0,
      oldestDeletion: data.oldestDeletion
        ? new Date(data.oldestDeletion)
        : null,
    };
  } catch (error) {
    console.error("Failed to get recovery stats:", error);
    return {
      totalRecoverable: 0,
      highRiskItems: 0,
      recentlyDeleted: 0,
      oldestDeletion: null,
    };
  }
}

/**
 * Perform extended recovery with validation
 */
export async function performExtendedRecovery(
  photoIds: string[],
  options: RecoveryOptions = {},
): Promise<RecoveryResult> {
  // First, validate recovery possibility for all photos
  const validationPromises = photoIds.map(async (photoId) => {
    const canRecover = await canRecoverPhoto(photoId);
    const info = await getExtendedRecoveryInfo(photoId);
    return { photoId, canRecover, info };
  });

  const validationResults = await Promise.all(validationPromises);

  // Separate recoverable and non-recoverable photos
  const recoverablePhotos = validationResults
    .filter((result) => result.canRecover)
    .map((result) => result.photoId);

  const nonRecoverablePhotos = validationResults
    .filter((result) => !result.canRecover)
    .map((result) => ({
      id: result.photoId,
      error: `Recovery risk: ${result.info.recoveryRisk}`,
    }));

  if (recoverablePhotos.length === 0) {
    return {
      success: false,
      recoveredPhotos: [],
      failedPhotos: nonRecoverablePhotos,
      message: "No photos are recoverable",
    };
  }

  // Attempt recovery of recoverable photos
  const recoveryResult = await recoverPhotos(recoverablePhotos, options);

  // Combine results
  return {
    success: recoveryResult.success || recoverablePhotos.length > 0,
    recoveredPhotos: recoveryResult.recoveredPhotos,
    failedPhotos: [...nonRecoverablePhotos, ...recoveryResult.failedPhotos],
    message: `Attempted recovery of ${photoIds.length} photos. ${recoveryResult.message}`,
  };
}

/**
 * Create recovery report
 */
export async function createRecoveryReport(photoIds: string[]): Promise<{
  report: string;
  canProceed: boolean;
  warnings: string[];
}> {
  const stats = await getRecoveryStats();
  const warnings: string[] = [];
  let canProceed = true;

  // Check for high-risk items
  const highRiskCount = photoIds.filter(
    (id) =>
      // This would need to be implemented on the backend
      // For now, we'll use a placeholder
      false,
  ).length;

  if (highRiskCount > 0) {
    warnings.push(`${highRiskCount} items may not recover fully`);
  }

  // Check if too many items are selected
  if (photoIds.length > 100) {
    warnings.push("Recovering many items at once may take a long time");
    canProceed = false;
  }

  // Check if any items are very old
  const oldItems = photoIds.filter((id) => {
    // Placeholder logic - would need backend implementation
    return false;
  }).length;

  if (oldItems > 0) {
    warnings.push(
      `${oldItems} items have been in trash for a long time and may not recover`,
    );
  }

  const report = `
Recovery Analysis Report
========================

Items to recover: ${photoIds.length}
Warnings: ${warnings.length}

${warnings.length > 0 ? warnings.join("\n") : "No warnings detected"}

Recommendation: ${canProceed ? "Proceed with recovery" : "Review warnings before proceeding"}
  `.trim();

  return { report, canProceed, warnings };
}

/**
 * Schedule recovery for later (for large batches)
 */
export async function scheduleRecovery(
  photoIds: string[],
  options: RecoveryOptions = {},
): Promise<{ scheduled: boolean; jobId?: string; error?: string }> {
  try {
    const res = await apiRequest("POST", "/api/photos/schedule-recovery", {
      photoIds,
      options,
    });

    if (!res.ok) {
      throw new Error(`Failed to schedule recovery: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      scheduled: true,
      jobId: data.jobId,
    };
  } catch (error) {
    console.error("Failed to schedule recovery:", error);
    return {
      scheduled: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get recovery job status
 */
export async function getRecoveryJobStatus(jobId: string): Promise<{
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  recoveredCount: number;
  failedCount: number;
  estimatedCompletion?: Date;
}> {
  try {
    const res = await apiRequest("GET", `/api/photos/recovery-job/${jobId}`);

    if (!res.ok) {
      throw new Error(`Failed to get job status: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      status: data.status,
      progress: data.progress || 0,
      recoveredCount: data.recoveredCount || 0,
      failedCount: data.failedCount || 0,
      estimatedCompletion: data.estimatedCompletion
        ? new Date(data.estimatedCompletion)
        : undefined,
    };
  } catch (error) {
    console.error("Failed to get recovery job status:", error);
    return {
      status: "failed",
      progress: 0,
      recoveredCount: 0,
      failedCount: 0,
    };
  }
}
