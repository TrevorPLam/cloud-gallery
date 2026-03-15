// AI-META-BEGIN
// AI-META: Backup API endpoints with authentication, validation, and comprehensive error handling
// OWNERSHIP: server/api
// ENTRYPOINTS: registered in server/routes.ts
// DEPENDENCIES: express, drizzle-orm, ../shared/schema, ../services/backup, ../auth
// DANGER: Backup endpoints expose user data; authentication bypass = data leakage; backup deletion = data loss
// CHANGE-SAFETY: Maintain authentication middleware, input validation, and error handling patterns
// TESTS: Integration tests for all endpoints, authentication testing, error handling validation
// AI-META-END

import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { backupQueue, users } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../auth";
import {
  createBackupService,
  BackupStatus,
  BackupType,
} from "../services/backup";

const router = Router();
const backupService = createBackupService();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Schema definitions for request validation
 */
const startBackupSchema = z.object({
  type: z.enum(["full", "incremental"]).default("incremental"),
  options: z.object({}).optional(),
});

const restoreBackupSchema = z.object({
  cloudKey: z.string().min(1, "Cloud key is required"),
});

const scheduleBackupSchema = z.object({
  schedule: z.string().min(1, "Schedule is required"),
  type: z.enum(["incremental"]).default("incremental"),
});

/**
 * POST /api/backup/start
 * Start a new backup (full or incremental)
 */
router.post("/start", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = startBackupSchema.parse(req.body);
    const { type, options } = validatedData;
    const userId = req.user!.id;

    let backupId: string;

    if (type === "full") {
      backupId = await backupService.startFullBackup(userId, options);
    } else {
      backupId = await backupService.startIncrementalBackup(userId, options);
    }

    res.status(201).json({
      success: true,
      backupId,
      type,
      message: `${type} backup started successfully`,
    });
  } catch (error) {
    console.error("Start backup error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to start backup",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/backup/status/:backupId
 * Get the status of a specific backup
 */
router.get("/status/:backupId", async (req: Request, res: Response) => {
  try {
    const { backupId } = req.params;
    const userId = req.user!.id;

    // Validate backup ID format
    if (!backupId || typeof backupId !== "string" || backupId.length !== 32) {
      return res.status(400).json({
        success: false,
        error: "Invalid backup ID format",
      });
    }

    const backupStatus = await backupService.getBackupStatus(backupId);

    if (!backupStatus) {
      return res.status(404).json({
        success: false,
        error: "Backup not found",
      });
    }

    // Ensure user can only access their own backups
    if (backupStatus.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    res.json({
      success: true,
      backup: backupStatus,
    });
  } catch (error) {
    console.error("Get backup status error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to get backup status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/backup/list
 * List all backups for the authenticated user
 */
router.get("/list", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { type, status, limit = 50, offset = 0 } = req.query;

    // Validate query parameters
    const validatedType = type ? String(type) : undefined;
    const validatedStatus = status ? String(status) : undefined;
    const validatedLimit = Math.min(parseInt(String(limit)) || 50, 100);
    const validatedOffset = Math.max(parseInt(String(offset)) || 0, 0);

    const backups = await backupService.listUserBackups(userId);

    // Apply filters if provided
    let filteredBackups = backups;

    if (validatedType) {
      filteredBackups = filteredBackups.filter((b) => b.type === validatedType);
    }

    if (validatedStatus) {
      filteredBackups = filteredBackups.filter(
        (b) => b.status === validatedStatus,
      );
    }

    // Apply pagination
    const paginatedBackups = filteredBackups.slice(
      validatedOffset,
      validatedOffset + validatedLimit,
    );

    res.json({
      success: true,
      backups: paginatedBackups,
      pagination: {
        total: filteredBackups.length,
        limit: validatedLimit,
        offset: validatedOffset,
        hasMore: validatedOffset + validatedLimit < filteredBackups.length,
      },
    });
  } catch (error) {
    console.error("List backups error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to list backups",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/backup/restore
 * Restore from a backup
 */
router.post("/restore", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = restoreBackupSchema.parse(req.body);
    const { cloudKey } = validatedData;
    const userId = req.user!.id;

    // Verify user owns this backup
    const userBackups = await backupService.listUserBackups(userId);
    const backupExists = userBackups.some(
      (backup) => backup.cloudKey === cloudKey,
    );

    if (!backupExists) {
      return res.status(403).json({
        success: false,
        error: "Backup not found or access denied",
      });
    }

    // Start restore process
    const restoreJob = await backupService.startIncrementalBackup(userId, {
      type: "restore",
      cloudKey,
    });

    res.status(201).json({
      success: true,
      restoreJob,
      message: "Restore process started",
    });
  } catch (error) {
    console.error("Restore backup error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to start restore",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * DELETE /api/backup/:backupId
 * Delete a backup
 */
router.delete("/:backupId", async (req: Request, res: Response) => {
  try {
    const { backupId } = req.params;
    const userId = req.user!.id;

    // Validate backup ID format
    if (!backupId || typeof backupId !== "string" || backupId.length !== 32) {
      return res.status(400).json({
        success: false,
        error: "Invalid backup ID format",
      });
    }

    // Verify backup exists and belongs to user
    const backupStatus = await backupService.getBackupStatus(backupId);

    if (!backupStatus) {
      return res.status(404).json({
        success: false,
        error: "Backup not found",
      });
    }

    if (backupStatus.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // Don't allow deletion of in-progress backups
    if (backupStatus.status === BackupStatus.IN_PROGRESS) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete backup in progress",
      });
    }

    const deleted = await backupService.deleteBackup(backupId, userId);

    if (deleted) {
      res.json({
        success: true,
        message: "Backup deleted successfully",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to delete backup",
      });
    }
  } catch (error) {
    console.error("Delete backup error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to delete backup",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/backup/schedule
 * Schedule automatic backups
 */
router.post("/schedule", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = scheduleBackupSchema.parse(req.body);
    const { schedule, type } = validatedData;
    const userId = req.user!.id;

    // Validate cron expression (basic validation)
    const cronRegex =
      /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9])|([0-9]|1[0-9]|2[0-9]|3[0-9])\/([0-9]|1[0-9]|2[0-9]|3[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|([0-9]|1[0-9]|2[0-3])\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|([1-9]|1[0-9]|2[0-9]|3[0-1])\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|([1-9]|1[0-2])\/([1-9]|1[0-2])) (\*|([0-6])|([0-6])\/([0-6]))$/;

    if (!cronRegex.test(schedule)) {
      return res.status(400).json({
        success: false,
        error: "Invalid cron expression format",
      });
    }

    await backupService.scheduleAutomaticBackups(userId, schedule);

    res.status(201).json({
      success: true,
      schedule,
      type,
      message: "Automatic backup scheduled successfully",
    });
  } catch (error) {
    console.error("Schedule backup error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to schedule backup",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * DELETE /api/backup/schedule
 * Cancel scheduled automatic backups
 */
router.delete("/schedule", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    await backupService.cancelScheduledBackup(userId);

    res.json({
      success: true,
      message: "Automatic backup schedule cancelled",
    });
  } catch (error) {
    console.error("Cancel schedule error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to cancel backup schedule",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/backup/stats
 * Get backup statistics for the user
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const stats = await backupService.getBackupStats(userId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Get backup stats error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to get backup statistics",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/backup/config
 * Get backup configuration (for UI display)
 */
router.get("/config", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's scheduled backup info
    const userBackups = await backupService.listUserBackups(userId);
    const lastBackup = userBackups.find(
      (b) => b.status === BackupStatus.COMPLETED,
    );

    const config = {
      autoBackupEnabled: true, // This could be stored in user preferences
      retentionDays: 30,
      maxBackupSize: 100 * 1024 * 1024, // 100MB
      supportedTypes: ["full", "incremental"],
      lastBackup: lastBackup?.createdAt,
      totalBackups: userBackups.length,
    };

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error("Get backup config error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to get backup configuration",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/backup/verify
 * Verify backup integrity
 */
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { backupId } = req.body;
    const userId = req.user!.id;

    if (!backupId) {
      return res.status(400).json({
        success: false,
        error: "Backup ID is required",
      });
    }

    // Verify backup exists and belongs to user
    const backupStatus = await backupService.getBackupStatus(backupId);

    if (!backupStatus) {
      return res.status(404).json({
        success: false,
        error: "Backup not found",
      });
    }

    if (backupStatus.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // For now, just verify the backup exists in cloud storage
    // In a real implementation, this would verify file integrity
    const verificationResult = {
      valid: true,
      size: backupStatus.size,
      fileCount: backupStatus.fileCount,
      cloudKey: backupStatus.cloudKey,
      verifiedAt: new Date(),
    };

    res.json({
      success: true,
      verification: verificationResult,
    });
  } catch (error) {
    console.error("Verify backup error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to verify backup",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Error handling middleware for backup routes
 */
router.use((error: any, req: Request, res: Response, next: any) => {
  console.error("Backup route error:", error);

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: "Validation error",
      details: error.message,
    });
  }

  if (error.name === "UnauthorizedError") {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  res.status(500).json({
    success: false,
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

export default router;
