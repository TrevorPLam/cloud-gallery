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
import { users as usersTable } from "../shared/schema";

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
 * Export database data (simplified implementation)
 * In production, use pg_dump or similar tool
 */
async function exportDatabaseData(): any {
  try {
    // This is a simplified implementation
    // In production, you would use pg_dump or query all tables

    // For now, return mock data structure
    const users = await db.select().from(usersTable);

    return {
      version: "1.0",
      timestamp: new Date().toISOString(),
      tables: {
        users,
      },
    };
  } catch (error) {
    console.error("Error exporting database data:", error);
    throw error;
  }
}

/**
 * Import database data (simplified implementation)
 */
async function importDatabaseData(dbData: any): Promise<number> {
  try {
    // This is a simplified implementation
    // In production, you would properly handle foreign keys, transactions, etc.

    let recordsRestored = 0;

    if (dbData.tables?.users) {
      // Clear existing users (in production, handle this more carefully)
      await db.delete("users");

      // Insert users
      for (const user of dbData.tables.users) {
        await db.insert("users").values(user);
        recordsRestored++;
      }
    }

    return recordsRestored;
  } catch (error) {
    console.error("Error importing database data:", error);
    throw error;
  }
}

/**
 * List all encrypted backups
 */
export function listEncryptedBackups(): {
  fileName: string;
  filePath: string;
  size: number;
  timestamp: string;
}[] {
  try {
    ensureBackupDir();

    // This is a simplified implementation
    // In production, you would read the backup directory and parse headers

    return [];
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
