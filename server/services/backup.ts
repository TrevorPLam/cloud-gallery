// AI-META-BEGIN
// AI-META: Backup service with cloud storage abstraction, incremental backup logic, and automatic scheduling
// OWNERSHIP: server/services
// ENTRYPOINTS: imported by backup-routes.ts and background job processors
// DEPENDENCIES: drizzle-orm, bullmq, aws-sdk, ../shared/schema, ./backup-encryption, ./db
// DANGER: Backup failure = data loss; cloud storage credentials = exposure; incremental logic = data inconsistency
// CHANGE-SAFETY: Maintain cloud storage interface compatibility, backup job consistency, and incremental backup accuracy
// TESTS: Property tests for backup consistency, incremental efficiency, and cloud storage reliability
// AI-META-END

import { db } from "../db";
import { photos, users } from "../../shared/schema";
import {
  eq,
  and,
  isNull,
  isNotNull,
  desc,
  lt,
  gt,
  or,
  inArray,
} from "drizzle-orm";
import {
  createEncryptedBackup,
  restoreFromEncryptedBackup,
} from "../backup-encryption";
import { randomBytes } from "crypto";
import { Queue, Worker } from "bullmq";
import { createReadStream, createWriteStream, statSync, existsSync } from "fs";
import { join } from "path";

/**
 * Cloud storage provider interface
 */
export interface CloudStorageProvider {
  uploadFile(key: string, filePath: string, metadata?: any): Promise<string>;
  downloadFile(key: string, localPath: string): Promise<void>;
  deleteFile(key: string): Promise<void>;
  listFiles(
    prefix?: string,
  ): Promise<{ key: string; size: number; lastModified: Date }[]>;
  generatePresignedUrl(key: string, expiresIn?: number): Promise<string>;
}

/**
 * AWS S3 implementation of CloudStorageProvider
 */
export class S3StorageProvider implements CloudStorageProvider {
  private s3Client: any;
  private bucketName: string;

  constructor(bucketName: string, region: string = "us-east-1") {
    // Dynamic import to avoid bundling issues
    this.initializeS3(bucketName, region);
  }

  private async initializeS3(bucketName: string, region: string) {
    try {
      const { S3Client } = await import("@aws-sdk/client-s3");
      const { Upload } = await import("@aws-sdk/lib-storage");

      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
      this.bucketName = bucketName;
    } catch (error) {
      console.error("Failed to initialize AWS S3:", error);
      throw new Error("AWS S3 initialization failed");
    }
  }

  async uploadFile(
    key: string,
    filePath: string,
    metadata?: any,
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    try {
      const { Upload } = await import("@aws-sdk/lib-storage");

      const fileStats = statSync(filePath);
      const fileStream = createReadStream(filePath);

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: fileStream,
          ContentType: "application/octet-stream",
          Metadata: metadata || {},
        },
      });

      upload.on("httpUploadProgress", (progress) => {
        console.log(`Upload progress: ${progress.loaded}/${progress.total}`);
      });

      const result = await upload.done();
      return result.Location || `s3://${this.bucketName}/${key}`;
    } catch (error) {
      console.error("S3 upload failed:", error);
      throw new Error(`Failed to upload file to S3: ${error}`);
    }
  }

  async downloadFile(key: string, localPath: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    try {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const { createWriteStream } = await import("fs");
      const { pipeline } = await import("stream/promises");

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const writeStream = createWriteStream(localPath);

      await pipeline(response.Body as any, writeStream);
    } catch (error) {
      console.error("S3 download failed:", error);
      throw new Error(`Failed to download file from S3: ${error}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    try {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error("S3 delete failed:", error);
      throw new Error(`Failed to delete file from S3: ${error}`);
    }
  }

  async listFiles(
    prefix?: string,
  ): Promise<{ key: string; size: number; lastModified: Date }[]> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    try {
      const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);

      return (response.Contents || []).map((obj) => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
      }));
    } catch (error) {
      console.error("S3 list failed:", error);
      throw new Error(`Failed to list files from S3: ${error}`);
    }
  }

  async generatePresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error("S3 client not initialized");
    }

    try {
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error("S3 presigned URL generation failed:", error);
      throw new Error(`Failed to generate presigned URL: ${error}`);
    }
  }
}

/**
 * Configuration for backup service
 */
export interface BackupConfig {
  /** Cloud storage provider */
  storageProvider: CloudStorageProvider;
  /** Backup retention in days */
  retentionDays: number;
  /** Maximum backup size in bytes */
  maxBackupSize: number;
  /** Backup schedule (cron expression) */
  schedule?: string;
  /** Enable automatic backups */
  autoBackup: boolean;
  /** Backup compression level */
  compressionLevel: number;
}

/**
 * Backup status enum
 */
export enum BackupStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
}

/**
 * Backup type enum
 */
export enum BackupType {
  FULL = "full",
  INCREMENTAL = "incremental",
  MANUAL = "manual",
}

/**
 * Backup metadata interface
 */
export interface BackupMetadata {
  id: string;
  type: BackupType;
  status: BackupStatus;
  size: number;
  fileCount: number;
  cloudKey: string;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  // Store user info in metadata since schema doesn't have userId
  userId?: string;
}

/**
 * Main backup service
 */
export class BackupService {
  private config: BackupConfig;
  private backupQueue: Queue | null = null;
  private worker: Worker | null = null;
  private backupStore: Map<string, BackupMetadata> = new Map(); // In-memory storage for demo

  constructor(config: BackupConfig) {
    this.config = config;

    // Initialize BullMQ queue only if Redis is enabled
    if (!process.env.DISABLE_REDIS) {
      this.backupQueue = new Queue("backup", {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
        },
      });

      // Initialize worker
      this.initializeWorker();
    } else {
      console.log(
        "Redis is disabled. Backup queue and worker will not be initialized.",
      );
    }
  }

  private initializeWorker(): void {
    if (!this.backupQueue) return;

    this.worker = new Worker(
      "backup",
      async (job) => {
        const { type, userId, options } = job.data;

        switch (type) {
          case "full":
            return await this.performFullBackup(userId, options);
          case "incremental":
            return await this.performIncrementalBackup(userId, options);
          case "restore":
            return await this.performRestore(userId, options);
          default:
            throw new Error(`Unknown backup type: ${type}`);
        }
      },
      {
        connection: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379"),
        },
        concurrency: 2,
      },
    );

    this.worker.on("completed", (job) => {
      console.log(`Backup job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(`Backup job ${job.id} failed:`, err);
    });
  }

  /**
   * Start a full backup for a user
   */
  async startFullBackup(userId: string, options?: any): Promise<string> {
    const backupId = randomBytes(16).toString("hex");

    // Create backup metadata
    const backupMetadata: BackupMetadata = {
      id: backupId,
      type: BackupType.FULL,
      status: BackupStatus.PENDING,
      size: 0,
      fileCount: 0,
      cloudKey: "",
      createdAt: new Date(),
      userId,
    };

    this.backupStore.set(backupId, backupMetadata);

    // Add job to queue
    if (this.backupQueue) {
      await this.backupQueue.add(
        "full",
        {
          userId,
          backupId,
          type: BackupType.FULL,
          options: options || {},
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          priority: 1,
        },
      );
    } else {
      console.log("Redis is disabled. Backup job queued but not processed.");
    }

    return backupId;
  }

  /**
   * Start an incremental backup for a user
   */
  async startIncrementalBackup(userId: string, options?: any): Promise<string> {
    const backupId = randomBytes(16).toString("hex");

    // Create backup metadata
    const backupMetadata: BackupMetadata = {
      id: backupId,
      type: BackupType.INCREMENTAL,
      status: BackupStatus.PENDING,
      size: 0,
      fileCount: 0,
      cloudKey: "",
      createdAt: new Date(),
      userId,
    };

    this.backupStore.set(backupId, backupMetadata);

    // Add job to queue
    if (this.backupQueue) {
      await this.backupQueue.add(
        "incremental",
        {
          userId,
          backupId,
          type: BackupType.INCREMENTAL,
          options: options || {},
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          priority: 2,
        },
      );
    } else {
      console.log(
        "Redis is disabled. Incremental backup job queued but not processed.",
      );
    }

    return backupId;
  }

  /**
   * Get backup status
   */
  async getBackupStatus(backupId: string): Promise<BackupMetadata | null> {
    // Check in-memory store first
    const backup = this.backupStore.get(backupId);
    if (backup) {
      return backup;
    }

    // Check BullMQ jobs
    if (this.backupQueue) {
      const jobs = await this.backupQueue.getJobs([
        "waiting",
        "active",
        "completed",
        "failed",
      ]);
      const job = jobs.find((j) => j.data.backupId === backupId);

      if (!job) {
        return null;
      }

      const jobData = job.data;
      return {
        id: backupId,
        type: jobData.type,
        status: this.mapJobStatusToBackupStatus(job),
        size: 0,
        fileCount: 0,
        cloudKey: "",
        createdAt: new Date(job.timestamp || Date.now()),
        completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        errorMessage: job.failedReason,
        userId: jobData.userId,
      };
    }

    return null;
  }

  /**
   * List all backups for a user
   */
  async listUserBackups(userId: string): Promise<BackupMetadata[]> {
    // Get from in-memory store
    const storedBackups = Array.from(this.backupStore.values()).filter(
      (b) => b.userId === userId,
    );

    // Get from BullMQ jobs
    if (this.backupQueue) {
      const jobs = await this.backupQueue.getJobs([
        "waiting",
        "active",
        "completed",
        "failed",
      ]);
      const queueBackups = jobs
        .filter((j) => j.data.userId === userId)
        .map((job) => {
          const jobData = job.data;
          return {
            id: jobData.backupId,
            type: jobData.type,
            status: this.mapJobStatusToBackupStatus(job),
            size: 0,
            fileCount: 0,
            cloudKey: "",
            createdAt: new Date(job.timestamp || Date.now()),
            completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
            errorMessage: job.failedReason,
            userId: jobData.userId,
          };
        });

      // Merge and remove duplicates
      const allBackups = [...storedBackups];
      for (const queueBackup of queueBackups) {
        if (!allBackups.find((b) => b.id === queueBackup.id)) {
          allBackups.push(queueBackup);
        }
      }

      return allBackups.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    }

    // Return only stored backups if Redis is disabled
    return storedBackups.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  /**
   * Map BullMQ job status to backup status
   */
  private mapJobStatusToBackupStatus(job: any): BackupStatus {
    if (job.failedReason) return BackupStatus.FAILED;
    if (job.finishedOn) return BackupStatus.COMPLETED;
    if (job.processedOn) return BackupStatus.IN_PROGRESS;
    return BackupStatus.PENDING;
  }

  /**
   * Perform full backup
   */
  private async performFullBackup(userId: string, options: any): Promise<any> {
    try {
      const backupId = options.backupId;

      // Update status to in_progress
      const backup = this.backupStore.get(backupId);
      if (backup) {
        backup.status = BackupStatus.IN_PROGRESS;
        this.backupStore.set(backupId, backup);
      }

      // Get all photos for user
      const userPhotos = await db
        .select()
        .from(photos)
        .where(eq(photos.userId, userId));

      // Create encrypted backup
      const backupFile = await createEncryptedBackup(
        `backup-${userId}-${Date.now()}`,
      );

      // Upload to cloud storage
      const cloudKey = `backups/${userId}/${backupFile.fileName}`;
      await this.config.storageProvider.uploadFile(
        cloudKey,
        backupFile.filePath,
        {
          userId,
          type: BackupType.FULL,
          photoCount: userPhotos.length,
        },
      );

      // Update backup metadata
      if (backup) {
        backup.status = BackupStatus.COMPLETED;
        backup.size = backupFile.size;
        backup.fileCount = userPhotos.length;
        backup.cloudKey = cloudKey;
        backup.completedAt = new Date();
        this.backupStore.set(backupId, backup);
      }

      // Update photos backup status
      await db
        .update(photos)
        .set({
          backupStatus: BackupStatus.COMPLETED,
          backupCompletedAt: new Date(),
        })
        .where(eq(photos.userId, userId));

      return {
        success: true,
        backupId,
        cloudKey,
        size: backupFile.size,
        fileCount: userPhotos.length,
      };
    } catch (error) {
      console.error("Full backup failed:", error);

      // Update backup metadata with error
      const backup = this.backupStore.get(options.backupId);
      if (backup) {
        backup.status = BackupStatus.FAILED;
        backup.errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.backupStore.set(options.backupId, backup);
      }

      throw error;
    }
  }

  /**
   * Perform incremental backup
   */
  private async performIncrementalBackup(
    userId: string,
    options: any,
  ): Promise<any> {
    try {
      const backupId = options.backupId;

      // Update status to in_progress
      const backup = this.backupStore.get(backupId);
      if (backup) {
        backup.status = BackupStatus.IN_PROGRESS;
        this.backupStore.set(backupId, backup);
      }

      // Get photos that need backup (new or modified since last backup)
      const photosToBackup = await db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.userId, userId),
            or(
              isNull(photos.backupStatus),
              lt(photos.backupCompletedAt!, photos.modifiedAt),
              eq(photos.backupStatus, BackupStatus.FAILED),
            ),
          ),
        );

      if (photosToBackup.length === 0) {
        // No photos need backup
        if (backup) {
          backup.status = BackupStatus.COMPLETED;
          backup.completedAt = new Date();
          this.backupStore.set(backupId, backup);
        }

        return {
          success: true,
          backupId,
          message: "No photos need backup",
          fileCount: 0,
        };
      }

      // Create encrypted backup for incremental photos
      const backupFile = await createEncryptedBackup(
        `incremental-${userId}-${Date.now()}`,
      );

      // Upload to cloud storage
      const cloudKey = `backups/${userId}/incremental/${backupFile.fileName}`;
      await this.config.storageProvider.uploadFile(
        cloudKey,
        backupFile.filePath,
        {
          userId,
          type: BackupType.INCREMENTAL,
          photoCount: photosToBackup.length,
        },
      );

      // Update backup metadata
      if (backup) {
        backup.status = BackupStatus.COMPLETED;
        backup.size = backupFile.size;
        backup.fileCount = photosToBackup.length;
        backup.cloudKey = cloudKey;
        backup.completedAt = new Date();
        this.backupStore.set(backupId, backup);
      }

      // Update photos backup status
      await db
        .update(photos)
        .set({
          backupStatus: BackupStatus.COMPLETED,
          backupCompletedAt: new Date(),
        })
        .where(
          and(
            eq(photos.userId, userId),
            inArray(
              photos.id,
              photosToBackup.map((p) => p.id),
            ),
          ),
        );

      return {
        success: true,
        backupId,
        cloudKey,
        size: backupFile.size,
        fileCount: photosToBackup.length,
      };
    } catch (error) {
      console.error("Incremental backup failed:", error);

      // Update backup metadata with error
      const backup = this.backupStore.get(options.backupId);
      if (backup) {
        backup.status = BackupStatus.FAILED;
        backup.errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        this.backupStore.set(options.backupId, backup);
      }

      throw error;
    }
  }

  /**
   * Perform restore from backup
   */
  private async performRestore(userId: string, options: any): Promise<any> {
    try {
      const { cloudKey } = options;

      // Download backup from cloud storage
      const localPath = join(
        process.env.BACKUP_DIR || "./backups",
        `restore-${userId}-${Date.now()}.enc`,
      );
      await this.config.storageProvider.downloadFile(cloudKey, localPath);

      // Restore from encrypted backup
      const restoreResult = await restoreFromEncryptedBackup(localPath);

      return {
        success: true,
        recordsRestored: restoreResult.recordsRestored,
        timestamp: restoreResult.timestamp,
      };
    } catch (error) {
      console.error("Restore failed:", error);
      throw error;
    }
  }

  /**
   * Schedule automatic backups
   */
  async scheduleAutomaticBackups(
    userId: string,
    schedule: string,
  ): Promise<void> {
    // Add recurring job to queue
    if (this.backupQueue) {
      await this.backupQueue.add(
        "incremental",
        {
          userId,
          type: BackupType.INCREMENTAL,
          options: { scheduled: true },
        },
        {
          repeat: { cron: schedule },
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      );
    } else {
      console.log("Redis is disabled. Scheduled backup not created.");
    }
  }

  /**
   * Cancel scheduled backup
   */
  async cancelScheduledBackup(userId: string): Promise<void> {
    if (this.backupQueue) {
      const repeatableJobs = await this.backupQueue.getRepeatableJobs();

      for (const job of repeatableJobs) {
        if (job.name === "incremental" && job.opts?.data?.userId === userId) {
          await this.backupQueue.removeRepeatableByKey(job.key);
        }
      }
    } else {
      console.log("Redis is disabled. No scheduled backups to cancel.");
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string, userId: string): Promise<boolean> {
    try {
      // Get backup record
      const backup = this.backupStore.get(backupId);

      if (!backup || backup.userId !== userId) {
        throw new Error("Backup not found or access denied");
      }

      // Delete from cloud storage
      if (backup.cloudKey) {
        await this.config.storageProvider.deleteFile(backup.cloudKey);
      }

      // Delete from store
      this.backupStore.delete(backupId);

      return true;
    } catch (error) {
      console.error("Delete backup failed:", error);
      return false;
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(userId: string): Promise<{
    totalBackups: number;
    completedBackups: number;
    failedBackups: number;
    totalSize: number;
    lastBackup?: Date;
  }> {
    const backups = await this.listUserBackups(userId);

    const completedBackups = backups.filter(
      (b) => b.status === BackupStatus.COMPLETED,
    );
    const failedBackups = backups.filter(
      (b) => b.status === BackupStatus.FAILED,
    );
    const totalSize = completedBackups.reduce((sum, b) => sum + b.size, 0);
    const lastBackup =
      completedBackups.length > 0 ? completedBackups[0].createdAt : undefined;

    return {
      totalBackups: backups.length,
      completedBackups: completedBackups.length,
      failedBackups: failedBackups.length,
      totalSize,
      lastBackup,
    };
  }

  /**
   * Close the backup service (cleanup)
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.backupQueue) {
      await this.backupQueue.close();
    }
  }
}

/**
 * Create default backup service instance
 */
export function createBackupService(): BackupService {
  const storageProvider = new S3StorageProvider(
    process.env.AWS_S3_BUCKET || "cloud-gallery-backups",
    process.env.AWS_REGION || "us-east-1",
  );

  return new BackupService({
    storageProvider,
    retentionDays: 30,
    maxBackupSize: 100 * 1024 * 1024, // 100MB
    schedule: "0 2 * * *", // Daily at 2 AM
    autoBackup: true,
    compressionLevel: 6,
  });
}
