// Backup API integration tests for Cloud Gallery

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import backupRoutes from "./backup-routes";
import { createBackupService } from "../services/backup";
import { BackupStatus, BackupType } from "../services/backup";

// Mock the backup service
vi.mock("../services/backup", () => ({
  createBackupService: vi.fn().mockReturnValue({
    startFullBackup: vi.fn().mockResolvedValue("backup-123"),
    startIncrementalBackup: vi.fn().mockResolvedValue("backup-456"),
    getBackupStatus: vi.fn().mockResolvedValue({
      id: "backup-123",
      userId: "user-123",
      type: BackupType.FULL,
      status: BackupStatus.COMPLETED,
      size: 1024,
      fileCount: 10,
      cloudKey: "backups/user-123/backup.enc",
      createdAt: new Date(),
      completedAt: new Date(),
    }),
    listUserBackups: vi.fn().mockResolvedValue([
      {
        id: "backup-123",
        userId: "user-123",
        type: BackupType.FULL,
        status: BackupStatus.COMPLETED,
        size: 1024,
        fileCount: 10,
        cloudKey: "backups/user-123/backup.enc",
        createdAt: new Date(),
        completedAt: new Date(),
      },
    ]),
    deleteBackup: vi.fn().mockResolvedValue(true),
    scheduleAutomaticBackups: vi.fn().mockResolvedValue(),
    cancelScheduledBackup: vi.fn().mockResolvedValue(),
    getBackupStats: vi.fn().mockResolvedValue({
      totalBackups: 1,
      completedBackups: 1,
      failedBackups: 0,
      totalSize: 1024,
      lastBackup: new Date(),
    }),
  }),
}));

// Mock authentication middleware
vi.mock("../auth", () => ({
  authenticateToken: vi.fn().mockImplementation((req, res, next) => {
    req.user = { id: "user-123", username: "testuser" };
    next();
  }),
}));

describe("Backup API", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/backup", backupRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/backup/start", () => {
    it("should start a full backup", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.startFullBackup).mockResolvedValue("backup-123");

      const response = await request(app)
        .post("/api/backup/start")
        .send({
          type: "full",
          options: {},
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.backupId).toBe("backup-123");
      expect(response.body.type).toBe("full");
      expect(response.body.message).toBe("full backup started successfully");
    });

    it("should start an incremental backup by default", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.startIncrementalBackup).mockResolvedValue("backup-456");

      const response = await request(app)
        .post("/api/backup/start")
        .send({})
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.backupId).toBe("backup-456");
      expect(response.body.type).toBe("incremental");
    });

    it("should validate backup type", async () => {
      const response = await request(app)
        .post("/api/backup/start")
        .send({
          type: "invalid",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid request data");
    });

    it("should handle service errors gracefully", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.startFullBackup).mockRejectedValue(new Error("Service error"));

      const response = await request(app)
        .post("/api/backup/start")
        .send({
          type: "full",
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Failed to start backup");
    });
  });

  describe("GET /api/backup/status/:backupId", () => {
    it("should return backup status for valid backup ID", async () => {
      const response = await request(app)
        .get("/api/backup/status/backup-123")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.backup.id).toBe("backup-123");
      expect(response.body.backup.userId).toBe("user-123");
      expect(response.body.backup.status).toBe(BackupStatus.COMPLETED);
    });

    it("should return 404 for non-existent backup", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.getBackupStatus).mockResolvedValue(null);

      const response = await request(app)
        .get("/api/backup/status/non-existent")
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Backup not found");
    });

    it("should validate backup ID format", async () => {
      const response = await request(app)
        .get("/api/backup/status/invalid-id")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid backup ID format");
    });

    it("should prevent access to other users backups", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.getBackupStatus).mockResolvedValue({
        id: "backup-456",
        userId: "other-user",
        type: BackupType.FULL,
        status: BackupStatus.COMPLETED,
        size: 1024,
        fileCount: 10,
        cloudKey: "backups/other-user/backup.enc",
        createdAt: new Date(),
        completedAt: new Date(),
      });

      const response = await request(app)
        .get("/api/backup/status/backup-456")
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Access denied");
    });
  });

  describe("GET /api/backup/list", () => {
    it("should return user backups list", async () => {
      const response = await request(app)
        .get("/api/backup/list")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.backups).toHaveLength(1);
      expect(response.body.backups[0].id).toBe("backup-123");
      expect(response.body.pagination.total).toBe(1);
    });

    it("should apply type filter", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.listUserBackups).mockResolvedValue([
        {
          id: "backup-123",
          userId: "user-123",
          type: BackupType.FULL,
          status: BackupStatus.COMPLETED,
          size: 1024,
          fileCount: 10,
          cloudKey: "backups/user-123/backup.enc",
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ]);

      const response = await request(app)
        .get("/api/backup/list?type=full")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.backups).toHaveLength(1);
    });

    it("should apply pagination", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.listUserBackups).mockResolvedValue([
        ...Array(100).fill(null).map((_, i) => ({
          id: `backup-${i}`,
          userId: "user-123",
          type: BackupType.INCREMENTAL,
          status: BackupStatus.COMPLETED,
          size: 1024,
          fileCount: 10,
          cloudKey: `backups/user-123/backup-${i}.enc`,
          createdAt: new Date(),
          completedAt: new Date(),
        })),
      ]);

      const response = await request(app)
        .get("/api/backup/list?limit=10&offset=0")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.backups).toHaveLength(10);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(0);
      expect(response.body.pagination.hasMore).toBe(true);
    });

    it("should limit maximum page size", async () => {
      const response = await request(app)
        .get("/api/backup/list?limit=200")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.limit).toBe(100); // Should be capped at 100
    });
  });

  describe("POST /api/backup/restore", () => {
    it("should start restore process", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.startIncrementalBackup).mockResolvedValue("restore-job-123");
      vi.mocked(backupService.listUserBackups).mockResolvedValue([
        {
          id: "backup-123",
          userId: "user-123",
          type: BackupType.FULL,
          status: BackupStatus.COMPLETED,
          size: 1024,
          fileCount: 10,
          cloudKey: "backups/user-123/backup.enc",
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ]);

      const response = await request(app)
        .post("/api/backup/restore")
        .send({
          cloudKey: "backups/user-123/backup.enc",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.restoreJob).toBe("restore-job-123");
      expect(response.body.message).toBe("Restore process started");
    });

    it("should validate cloud key", async () => {
      const response = await request(app)
        .post("/api/backup/restore")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid request data");
    });

    it("should prevent restore of non-owned backup", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.listUserBackups).mockResolvedValue([]);

      const response = await request(app)
        .post("/api/backup/restore")
        .send({
          cloudKey: "backups/other-user/backup.enc",
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Backup not found or access denied");
    });
  });

  describe("DELETE /api/backup/:backupId", () => {
    it("should delete backup successfully", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.deleteBackup).mockResolvedValue(true);
      vi.mocked(backupService.getBackupStatus).mockResolvedValue({
        id: "backup-123",
        userId: "user-123",
        type: BackupType.FULL,
        status: BackupStatus.COMPLETED,
        size: 1024,
        fileCount: 10,
        cloudKey: "backups/user-123/backup.enc",
        createdAt: new Date(),
        completedAt: new Date(),
      });

      const response = await request(app)
        .delete("/api/backup/backup-123")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Backup deleted successfully");
    });

    it("should prevent deletion of in-progress backup", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.getBackupStatus).mockResolvedValue({
        id: "backup-123",
        userId: "user-123",
        type: BackupType.FULL,
        status: BackupStatus.IN_PROGRESS,
        size: 0,
        fileCount: 0,
        cloudKey: "",
        createdAt: new Date(),
      });

      const response = await request(app)
        .delete("/api/backup/backup-123")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Cannot delete backup in progress");
    });

    it("should validate backup ID format", async () => {
      const response = await request(app)
        .delete("/api/backup/invalid-id")
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid backup ID format");
    });
  });

  describe("POST /api/backup/schedule", () => {
    it("should schedule automatic backup", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.scheduleAutomaticBackups).mockResolvedValue();

      const response = await request(app)
        .post("/api/backup/schedule")
        .send({
          schedule: "0 2 * * *",
          type: "incremental",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.schedule).toBe("0 2 * * *");
      expect(response.body.type).toBe("incremental");
      expect(response.body.message).toBe("Automatic backup scheduled successfully");
    });

    it("should validate cron expression", async () => {
      const response = await request(app)
        .post("/api/backup/schedule")
        .send({
          schedule: "invalid-cron",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid cron expression format");
    });

    it("should validate request body", async () => {
      const response = await request(app)
        .post("/api/backup/schedule")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid request data");
    });
  });

  describe("DELETE /api/backup/schedule", () => {
    it("should cancel scheduled backup", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.cancelScheduledBackup).mockResolvedValue();

      const response = await request(app)
        .delete("/api/backup/schedule")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Automatic backup schedule cancelled");
    });
  });

  describe("GET /api/backup/stats", () => {
    it("should return backup statistics", async () => {
      const response = await request(app)
        .get("/api/backup/stats")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats.totalBackups).toBe(1);
      expect(response.body.stats.completedBackups).toBe(1);
      expect(response.body.stats.failedBackups).toBe(0);
      expect(response.body.stats.totalSize).toBe(1024);
      expect(response.body.stats.lastBackup).toBeInstanceOf(Date);
    });
  });

  describe("GET /api/backup/config", () => {
    it("should return backup configuration", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.listUserBackups).mockResolvedValue([
        {
          id: "backup-123",
          userId: "user-123",
          type: BackupType.FULL,
          status: BackupStatus.COMPLETED,
          size: 1024,
          fileCount: 10,
          cloudKey: "backups/user-123/backup.enc",
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ]);

      const response = await request(app)
        .get("/api/backup/config")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config.autoBackupEnabled).toBe(true);
      expect(response.body.config.retentionDays).toBe(30);
      expect(response.body.config.maxBackupSize).toBe(100 * 1024 * 1024);
      expect(response.body.config.supportedTypes).toEqual(["full", "incremental"]);
      expect(response.body.config.totalBackups).toBe(1);
    });
  });

  describe("POST /api/backup/verify", () => {
    it("should verify backup integrity", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.getBackupStatus).mockResolvedValue({
        id: "backup-123",
        userId: "user-123",
        type: BackupType.FULL,
        status: BackupStatus.COMPLETED,
        size: 1024,
        fileCount: 10,
        cloudKey: "backups/user-123/backup.enc",
        createdAt: new Date(),
        completedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/backup/verify")
        .send({
          backupId: "backup-123",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.verification.valid).toBe(true);
      expect(response.body.verification.size).toBe(1024);
      expect(response.body.verification.fileCount).toBe(10);
      expect(response.body.verification.cloudKey).toBe("backups/user-123/backup.enc");
      expect(response.body.verification.verifiedAt).toBeInstanceOf(Date);
    });

    it("should require backup ID", async () => {
      const response = await request(app)
        .post("/api/backup/verify")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Backup ID is required");
    });

    it("should prevent verification of non-owned backup", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.getBackupStatus).mockResolvedValue({
        id: "backup-456",
        userId: "other-user",
        type: BackupType.FULL,
        status: BackupStatus.COMPLETED,
        size: 1024,
        fileCount: 10,
        cloudKey: "backups/other-user/backup.enc",
        createdAt: new Date(),
        completedAt: new Date(),
      });

      const response = await request(app)
        .post("/api/backup/verify")
        .send({
          backupId: "backup-456",
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Access denied");
    });
  });

  describe("Authentication", () => {
    it("should require authentication for all endpoints", async () => {
      // Temporarily remove authentication middleware
      vi.mocked(require("../auth").authenticateToken).mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, error: "Unauthorized" });
      });

      const endpoints = [
        { method: "post", path: "/api/backup/start" },
        { method: "get", path: "/api/backup/status/backup-123" },
        { method: "get", path: "/api/backup/list" },
        { method: "post", path: "/api/backup/restore" },
        { method: "delete", path: "/api/backup/backup-123" },
        { method: "post", path: "/api/backup/schedule" },
        { method: "delete", path: "/api/backup/schedule" },
        { method: "get", path: "/api/backup/stats" },
        { method: "get", path: "/api/backup/config" },
        { method: "post", path: "/api/backup/verify" },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      const backupService = createBackupService();
      vi.mocked(backupService.listUserBackups).mockRejectedValue(new Error("Database error"));

      const response = await request(app)
        .get("/api/backup/list")
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Failed to list backups");
    });

    it("should handle malformed JSON", async () => {
      const response = await request(app)
        .post("/api/backup/start")
        .set("Content-Type", "application/json")
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
