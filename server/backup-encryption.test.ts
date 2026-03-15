// Backup encryption tests for Cloud Gallery

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createEncryptedBackup,
  restoreFromEncryptedBackup,
  generateBackupEncryptionKey,
  validateBackupConfig,
} from "./backup-encryption";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";

// Mock the encrypted-storage module to avoid database dependency
vi.mock("./encrypted-storage", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(Promise.resolve([])),
      }),
    }),
  },
  users: {
    id: "id",
    username: "username",
    email: "email",
    password: "password",
    createdAt: "createdAt",
  },
}));

describe("Backup Encryption", () => {
  const testBackupDir = "./test-backups";

  beforeEach(() => {
    // Set test environment variables
    process.env.BACKUP_ENCRYPTION_KEY = "test-backup-key-32-chars-long";
    process.env.BACKUP_ENCRYPTION_SALT = "test-backup-salt-16-chars";
    process.env.BACKUP_DIR = testBackupDir;
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.BACKUP_ENCRYPTION_KEY;
    delete process.env.BACKUP_ENCRYPTION_SALT;
    delete process.env.BACKUP_DIR;

    // Clean up test backup files
    if (existsSync(testBackupDir)) {
      const { readdirSync } = require("fs");
      const files = readdirSync(testBackupDir);
      for (const file of files) {
        unlinkSync(join(testBackupDir, file));
      }
      const { rmdirSync } = require("fs");
      rmdirSync(testBackupDir);
    }
  });

  describe("generateBackupEncryptionKey", () => {
    it("should generate a secure random key", () => {
      const key = generateBackupEncryptionKey();

      expect(key).toMatch(/^[a-f0-9]{128}$/); // 64 bytes = 128 hex chars
      expect(key.length).toBe(128);
    });

    it("should generate different keys each time", () => {
      const key1 = generateBackupEncryptionKey();
      const key2 = generateBackupEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe("validateBackupConfig", () => {
    it("should validate proper configuration", () => {
      process.env.BACKUP_ENCRYPTION_KEY = "proper-secure-key-32-chars-long";
      process.env.BACKUP_ENCRYPTION_SALT = "proper-salt-16-chars";

      const validation = validateBackupConfig();

      expect(validation.isValid).toBe(true);
      expect(validation.warnings).toHaveLength(0);
    });

    it("should warn about missing encryption key", () => {
      delete process.env.BACKUP_ENCRYPTION_KEY;
      process.env.BACKUP_ENCRYPTION_SALT = "proper-salt-16-chars";

      const validation = validateBackupConfig();

      expect(validation.isValid).toBe(false);
      expect(
        validation.warnings.some((w) =>
          w.includes("BACKUP_ENCRYPTION_KEY not set"),
        ),
      ).toBe(true);
    });

    it("should warn about missing salt", () => {
      process.env.BACKUP_ENCRYPTION_KEY = "proper-secure-key-32-chars-long";
      delete process.env.BACKUP_ENCRYPTION_SALT;

      const validation = validateBackupConfig();

      expect(validation.isValid).toBe(false);
      expect(
        validation.warnings.some((w) =>
          w.includes("BACKUP_ENCRYPTION_SALT not set"),
        ),
      ).toBe(true);
    });

    it("should warn about default values", () => {
      process.env.BACKUP_ENCRYPTION_KEY =
        "default-backup-key-change-in-production";
      process.env.BACKUP_ENCRYPTION_SALT = "default-salt-change-in-production";

      const validation = validateBackupConfig();

      expect(validation.isValid).toBe(false);
      expect(
        validation.warnings.some((w) =>
          w.includes("default backup encryption key"),
        ),
      ).toBe(true);
    });
  });

  describe("Backup Creation", () => {
    it("should create an encrypted backup file", async () => {
      const backup = await createEncryptedBackup("test-backup");

      expect(backup.fileName).toBe("test-backup.enc");
      expect(backup.encrypted).toBe(true);
      expect(backup.size).toBeGreaterThan(0);
      expect(backup.timestamp).toBeDefined();
      expect(existsSync(backup.filePath)).toBe(true);
    });

    it("should create backup with auto-generated name", async () => {
      const backup = await createEncryptedBackup();

      expect(backup.fileName).toMatch(
        /^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.enc$/,
      );
      expect(backup.encrypted).toBe(true);
      expect(existsSync(backup.filePath)).toBe(true);
    });

    it("should create backup with proper structure", async () => {
      const backup = await createEncryptedBackup("structure-test");

      // Read and verify backup structure
      const { readFileSync } = require("fs");
      const fileContent = readFileSync(backup.filePath);

      // Should contain JSON header
      const content = fileContent.toString();
      const headerEndIndex = content.indexOf("\n");
      expect(headerEndIndex).toBeGreaterThan(0);

      const headerLine = content.slice(0, headerEndIndex);
      const header = JSON.parse(headerLine);

      expect(header.version).toBe("1.0");
      expect(header.algorithm).toBe("aes-256-gcm");
      expect(header.iv).toMatch(/^[a-f0-9]{32}$/);
      expect(header.compressed).toBe(true);
      expect(header.originalSize).toBeGreaterThan(0);
    });
  });

  describe("Backup Security", () => {
    it("should use AES-256-GCM encryption", async () => {
      const backup = await createEncryptedBackup("security-test");

      // Read backup and verify encryption
      const { readFileSync } = require("fs");
      const fileContent = readFileSync(backup.filePath);

      const content = fileContent.toString();
      const headerEndIndex = content.indexOf("\n");
      const headerLine = content.slice(0, headerEndIndex);
      const header = JSON.parse(headerLine);

      expect(header.algorithm).toBe("aes-256-gcm");
      expect(header.iv).toHaveLength(32); // 16 bytes in hex
    });

    it("should fail to restore with wrong key", async () => {
      // Create backup with one key
      const backup = await createEncryptedBackup("wrong-key-test");

      // Try to restore with different key
      process.env.BACKUP_ENCRYPTION_KEY = "different-backup-key-32-chars";

      await expect(restoreFromEncryptedBackup(backup.filePath)).rejects.toThrow(
        "Failed to restore from encrypted backup",
      );
    });
  });

  describe("Backup Compression", () => {
    it("should compress backup data", async () => {
      const backup = await createEncryptedBackup("compression-test");

      // Read backup and verify compression flag
      const { readFileSync } = require("fs");
      const fileContent = readFileSync(backup.filePath);

      const content = fileContent.toString();
      const headerEndIndex = content.indexOf("\n");
      const headerLine = content.slice(0, headerEndIndex);
      const header = JSON.parse(headerLine);

      expect(header.compressed).toBe(true);
      expect(header.originalSize).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid backup file during restore", async () => {
      // Create invalid backup file
      const { writeFileSync, mkdirSync } = require("fs");
      const invalidBackupPath = join(testBackupDir, "invalid.enc");

      // Ensure directory exists
      if (!existsSync(testBackupDir)) {
        mkdirSync(testBackupDir, { recursive: true });
      }

      writeFileSync(invalidBackupPath, "invalid backup content");

      await expect(
        restoreFromEncryptedBackup(invalidBackupPath),
      ).rejects.toThrow("Failed to restore from encrypted backup");
    });

    it("should handle missing backup file during restore", async () => {
      const missingPath = join(testBackupDir, "missing.enc");

      await expect(restoreFromEncryptedBackup(missingPath)).rejects.toThrow();
    });
  });

  describe("Backup Metadata", () => {
    it("should include correct timestamp in backup", async () => {
      const beforeCreate = new Date();
      const backup = await createEncryptedBackup("timestamp-test");
      const afterCreate = new Date();

      // Read backup header
      const { readFileSync } = require("fs");
      const fileContent = readFileSync(backup.filePath);
      const content = fileContent.toString();
      const headerEndIndex = content.indexOf("\n");
      const headerLine = content.slice(0, headerEndIndex);
      const header = JSON.parse(headerLine);

      const backupTimestamp = new Date(header.timestamp);
      expect(backupTimestamp.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(backupTimestamp.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime(),
      );
    });

    it("should return correct backup metadata", async () => {
      const customName = "metadata-test";
      const backup = await createEncryptedBackup(customName);

      expect(backup.fileName).toBe(`${customName}.enc`);
      expect(backup.encrypted).toBe(true);
      expect(backup.size).toBeGreaterThan(0);
      expect(backup.filePath).toContain(customName);
      expect(backup.timestamp).toBeDefined();
    });
  });
});
