// AI-META-BEGIN
// AI-META: Encrypted backup creation and restore helpers for database exports
// OWNERSHIP: server/security
// ENTRYPOINTS: admin/ops workflows, server/index.ts (future)
// DEPENDENCIES: fs, crypto, zlib, path, server/encrypted-storage, @shared/schema
// DANGER: Backup key loss = unrecoverable backups; large backups can impact disk usage
// CHANGE-SAFETY: Avoid changing backup format without migration tooling
// TESTS: server/backup-encryption.test.ts
// AI-META-END

// Backup encryption utilities for Cloud Gallery
// Provides encrypted database backup functionality

import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
  readdirSync,
} from "fs";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { gzip, gunzip } from "zlib";
import { promisify } from "util";
import { join } from "path";
import { db } from "./encrypted-storage";
import {
  users as usersTable,
  photos as photosTable,
  albums as albumsTable,
  albumPhotos as albumPhotosTable,
} from "../shared/schema";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Backup encryption configuration
 */
const BACKUP_CONFIG = {
  // Key derivation
  SALT:
    process.env.BACKUP_ENCRYPTION_SALT || "backup-salt-change-in-production",
  KEY_LENGTH: 32, // 256 bits for AES-256

  // Encryption
  ALGORITHM: "aes-256-gcm",
  IV_LENGTH: 16, // 128 bits for AES-GCM
  TAG_LENGTH: 16, // Authentication tag length

  // Backup settings
  BACKUP_DIR: process.env.BACKUP_DIR || "./backups",
  COMPRESSION_LEVEL: 4, // LZ4 compression level (0-16)
  MAX_BACKUP_SIZE: 100 * 1024 * 1024, // 100MB max backup size
} as const;

/**
 * Derive backup encryption key from master password and salt
 */
function deriveBackupEncryptionKey(): Buffer {
  const masterPassword =
    process.env.BACKUP_ENCRYPTION_KEY ||
    "default-backup-key-change-in-production";
  return scryptSync(
    masterPassword,
    BACKUP_CONFIG.SALT,
    BACKUP_CONFIG.KEY_LENGTH,
  );
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(): void {
  if (!existsSync(BACKUP_CONFIG.BACKUP_DIR)) {
    mkdirSync(BACKUP_CONFIG.BACKUP_DIR, { recursive: true });
  }
}

/**
 * Create an encrypted database backup
 *
 * @param backupName - Optional custom backup name
 * @returns Backup file path and metadata
 */
export async function createEncryptedBackup(backupName?: string): Promise<{
  filePath: string;
  fileName: string;
  size: number;
  encrypted: boolean;
  timestamp: string;
}> {
  try {
    ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseFileName = backupName || `backup-${timestamp}`;
    const fileName = baseFileName.endsWith(".enc")
      ? baseFileName
      : `${baseFileName}.enc`;
    const filePath = join(BACKUP_CONFIG.BACKUP_DIR, fileName);

    // Generate encryption key and IV
    const key = deriveBackupEncryptionKey();
    const iv = randomBytes(BACKUP_CONFIG.IV_LENGTH);

    // Create cipher
    const cipher = createCipheriv(BACKUP_CONFIG.ALGORITHM, key, iv);

    // Get database data (simplified - in production, use pg_dump)
    const dbData = await exportDatabaseData();
    const compressedData = await gzipAsync(
      Buffer.from(JSON.stringify(dbData, null, 2)),
    );

    // Create backup file with header
    const writeStream = createWriteStream(filePath);

    // Write backup header
    const header = {
      version: "1.0",
      algorithm: BACKUP_CONFIG.ALGORITHM,
      iv: iv.toString("hex"),
      timestamp: new Date().toISOString(),
      compressed: true,
      originalSize: compressedData.length,
    };

    writeStream.write(JSON.stringify(header) + "\n");

    // Pipe compressed data through cipher
    const dataStream = cipher.update(compressedData);
    writeStream.write(dataStream);

    const finalData = cipher.final();
    writeStream.write(finalData);

    // Write authentication tag
    const tag = cipher.getAuthTag();
    writeStream.write(tag);

    writeStream.end();

    // Wait for file to be written
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    const stats = statSync(filePath);

    return {
      filePath,
      fileName,
      size: stats.size,
      encrypted: true,
      timestamp: header.timestamp,
    };
  } catch (error) {
    console.error("Error creating encrypted backup:", error);
    throw new Error("Failed to create encrypted backup");
  }
}

/**
 * Restore database from encrypted backup
 *
 * @param backupPath - Path to encrypted backup file
 * @returns Restore metadata
 */
export async function restoreFromEncryptedBackup(backupPath: string): Promise<{
  recordsRestored: number;
  timestamp: string;
  success: boolean;
}> {
  try {
    // Read backup file
    const fileData = await readBackupFile(backupPath);

    // Parse header
    const headerEndIndex = fileData.indexOf("\n");
    if (headerEndIndex === -1) {
      throw new Error("Invalid backup file format");
    }

    const headerLine = fileData.slice(0, headerEndIndex).toString();
    const header = JSON.parse(headerLine);

    // Validate header
    if (
      header.version !== "1.0" ||
      header.algorithm !== BACKUP_CONFIG.ALGORITHM
    ) {
      throw new Error("Unsupported backup format");
    }

    // Extract encrypted data
    const encryptedData = fileData.slice(
      headerEndIndex + 1,
      -BACKUP_CONFIG.TAG_LENGTH,
    );
    const tag = fileData.slice(-BACKUP_CONFIG.TAG_LENGTH);

    // Decrypt data
    const key = deriveBackupEncryptionKey();
    const iv = Buffer.from(header.iv, "hex");

    const decipher = createDecipheriv(BACKUP_CONFIG.ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    // Decompress data
    const decompressedData = await gunzipAsync(decrypted);
    const dbData = JSON.parse(decompressedData.toString());

    // Restore data to database
    const recordsRestored = await importDatabaseData(dbData);

    return {
      recordsRestored,
      timestamp: header.timestamp,
      success: true,
    };
  } catch (error) {
    console.error("Error restoring from encrypted backup:", error);
    throw new Error("Failed to restore from encrypted backup");
  }
}

/**
 * Read backup file into buffer
 */
async function readBackupFile(filePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const readStream = createReadStream(filePath);

    readStream.on("data", (chunk) => chunks.push(chunk));
    readStream.on("end", () => resolve(Buffer.concat(chunks)));
    readStream.on("error", reject);
  });
}

/**
 * Export database data for backup (users, photos, albums, album_photos).
 * Order respects foreign keys for restore.
 */
async function exportDatabaseData(): Promise<{
  version: string;
  timestamp: string;
  tables: {
    users: unknown[];
    photos: unknown[];
    albums: unknown[];
    albumPhotos: unknown[];
  };
}> {
  const [users, photos, albums, albumPhotos] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(photosTable),
    db.select().from(albumsTable),
    db.select().from(albumPhotosTable),
  ]);
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    tables: {
      users: users as unknown[],
      photos: photos as unknown[],
      albums: albums as unknown[],
      albumPhotos: albumPhotos as unknown[],
    },
  };
}

/**
 * Import database data from backup inside a transaction.
 * Restore order: clear child tables first, then parent; insert users, albums, photos, albumPhotos.
 */
async function importDatabaseData(dbData: {
  tables?: {
    users?: unknown[];
    photos?: unknown[];
    albums?: unknown[];
    albumPhotos?: unknown[];
  };
}): Promise<number> {
  const tables = dbData.tables ?? {};
  let recordsRestored = 0;

  await db.transaction(async (tx) => {
    // Clear in reverse FK order
    await tx.delete(albumPhotosTable);
    await tx.delete(photosTable);
    await tx.delete(albumsTable);
    await tx.delete(usersTable);

    if (tables.users?.length) {
      for (const row of tables.users as Record<string, unknown>[]) {
        await tx.insert(usersTable).values({
          id: row.id as string,
          username: row.username as string,
          password: row.password as string,
        });
        recordsRestored++;
      }
    }
    if (tables.albums?.length) {
      for (const row of tables.albums as Record<string, unknown>[]) {
        await tx.insert(albumsTable).values({
          id: row.id as string,
          userId: row.userId as string,
          title: row.title as string,
          description: (row.description as string) ?? null,
          coverPhotoUri: (row.coverPhotoUri as string) ?? null,
          createdAt: row.createdAt
            ? new Date(row.createdAt as string)
            : new Date(),
          modifiedAt: row.modifiedAt
            ? new Date(row.modifiedAt as string)
            : new Date(),
        });
        recordsRestored++;
      }
    }
    if (tables.photos?.length) {
      for (const row of tables.photos as Record<string, unknown>[]) {
        const toDate = (v: unknown) => (v ? new Date(v as string) : null);
        await tx.insert(photosTable).values({
          id: row.id as string,
          userId: row.userId as string,
          uri: row.uri as string,
          width: row.width as number,
          height: row.height as number,
          filename: row.filename as string,
          isFavorite: Boolean(row.isFavorite),
          isPrivate: Boolean(row.isPrivate),
          location: row.location ?? null,
          camera: row.camera ?? null,
          exif: row.exif ?? null,
          tags: (row.tags as string[]) ?? null,
          notes: (row.notes as string) ?? null,
          mlLabels: (row.mlLabels as string[]) ?? null,
          mlProcessedAt: toDate(row.mlProcessedAt),
          mlVersion: (row.mlVersion as string) ?? null,
          ocrText: (row.ocrText as string) ?? null,
          ocrLanguage: (row.ocrLanguage as string) ?? null,
          perceptualHash: (row.perceptualHash as string) ?? null,
          duplicateGroupId: (row.duplicateGroupId as string) ?? null,
          isVideo: Boolean(row.isVideo),
          videoDuration: (row.videoDuration as number) ?? null,
          videoThumbnailUri: (row.videoThumbnailUri as string) ?? null,
          backupStatus: (row.backupStatus as string) ?? null,
          backupCompletedAt: toDate(row.backupCompletedAt),
          originalSize: (row.originalSize as number) ?? null,
          compressedSize: (row.compressedSize as number) ?? null,
          createdAt: toDate(row.createdAt) ?? new Date(),
          modifiedAt: toDate(row.modifiedAt) ?? new Date(),
          deletedAt: toDate(row.deletedAt),
        } as typeof photosTable.$inferInsert);
        recordsRestored++;
      }
    }
    if (tables.albumPhotos?.length) {
      for (const row of tables.albumPhotos as Record<string, unknown>[]) {
        await tx.insert(albumPhotosTable).values({
          albumId: row.albumId as string,
          photoId: row.photoId as string,
          addedAt: row.addedAt ? new Date(row.addedAt as string) : new Date(),
          position: (row.position as number) ?? 0,
        });
        recordsRestored++;
      }
    }
  });

  return recordsRestored;
}

/**
 * List all encrypted backup files in the backup directory.
 */
export function listEncryptedBackups(): {
  fileName: string;
  filePath: string;
  size: number;
  timestamp: string;
}[] {
  try {
    ensureBackupDir();
    const files = readdirSync(BACKUP_CONFIG.BACKUP_DIR);
    const results: {
      fileName: string;
      filePath: string;
      size: number;
      timestamp: string;
    }[] = [];
    for (const fileName of files) {
      if (!fileName.endsWith(".enc")) continue;
      const filePath = join(BACKUP_CONFIG.BACKUP_DIR, fileName);
      const stat = statSync(filePath);
      results.push({
        fileName,
        filePath,
        size: stat.size,
        timestamp: stat.mtime.toISOString(),
      });
    }
    return results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  } catch (error) {
    console.error("Error listing backups:", error);
    return [];
  }
}

/**
 * Delete encrypted backup
 */
export async function deleteEncryptedBackup(
  fileName: string,
): Promise<boolean> {
  try {
    const filePath = join(BACKUP_CONFIG.BACKUP_DIR, fileName);

    if (existsSync(filePath)) {
      // Use fs.unlink to delete file
      const { unlinkSync } = await import("fs");
      unlinkSync(filePath);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error deleting backup:", error);
    return false;
  }
}

/**
 * Generate secure backup encryption key
 */
export function generateBackupEncryptionKey(): string {
  return randomBytes(64).toString("hex");
}

/**
 * Validate backup encryption configuration
 */
export function validateBackupConfig(): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!process.env.BACKUP_ENCRYPTION_KEY) {
    warnings.push(
      "BACKUP_ENCRYPTION_KEY not set, using default (insecure for production)",
    );
  }

  if (!process.env.BACKUP_ENCRYPTION_SALT) {
    warnings.push(
      "BACKUP_ENCRYPTION_SALT not set, using default (insecure for production)",
    );
  }

  if (
    process.env.BACKUP_ENCRYPTION_KEY ===
    "default-backup-key-change-in-production"
  ) {
    warnings.push(
      "Using default backup encryption key - please set a secure key for production",
    );
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}
