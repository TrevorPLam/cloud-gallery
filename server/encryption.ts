// Encryption utilities for sensitive data at rest
// Implements AES-256-GCM for authenticated encryption

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

/**
 * Encryption configuration
 */
export const ENCRYPTION_CONFIG = {
  // AES-256-GCM
  ALGORITHM: "aes-256-gcm",
  KEY_LENGTH: 32, // 256 bits
  IV_LENGTH: 12, // 96 bits for GCM
  AUTH_TAG_LENGTH: 16, // 128 bits
  // Key derivation
  SCRYPT_N: 32768, // CPU/memory cost
  SCRYPT_R: 8, // Block size
  SCRYPT_P: 1, // Parallelization
} as const;

/**
 * Derive encryption key from password using scrypt
 *
 * @param password - Password or master key
 * @param salt - Salt for key derivation
 * @returns Promise resolving to derived key
 */
export async function deriveKey(
  password: string,
  salt: Buffer,
): Promise<Buffer> {
  return await scryptAsync(password, salt, ENCRYPTION_CONFIG.KEY_LENGTH);
}

/**
 * Encrypt sensitive data using AES-256-GCM
 *
 * @param plaintext - Data to encrypt
 * @param key - 32-byte encryption key
 * @returns Object containing encrypted data, IV, and auth tag
 */
export function encrypt(
  plaintext: string,
  key: Buffer,
): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const iv = randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_CONFIG.ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encryptedData - Object containing encrypted data, IV, and auth tag
 * @param key - 32-byte decryption key
 * @returns Decrypted plaintext string
 */
export function decrypt(
  encryptedData: { encrypted: string; iv: string; authTag: string },
  key: Buffer,
): string {
  const iv = Buffer.from(encryptedData.iv, "hex");
  const authTag = Buffer.from(encryptedData.authTag, "hex");

  const decipher = createDecipheriv(ENCRYPTION_CONFIG.ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypt sensitive photo metadata
 *
 * @param metadata - Photo metadata to encrypt
 * @param masterKey - Master encryption key
 * @returns Encrypted metadata package
 */
export async function encryptPhotoMetadata(
  metadata: Record<string, unknown>,
  masterKey: string,
): Promise<{
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}> {
  // Generate salt for key derivation
  const salt = randomBytes(16);

  // Derive key from master key and salt
  const key = await deriveKey(masterKey, salt);

  // Stringify and encrypt metadata
  const plaintext = JSON.stringify(metadata);
  const encrypted = encrypt(plaintext, key);

  return {
    ...encrypted,
    salt: salt.toString("hex"),
  };
}

/**
 * Decrypt sensitive photo metadata
 *
 * @param encryptedPackage - Encrypted metadata package
 * @param masterKey - Master encryption key
 * @returns Decrypted metadata object
 */
export async function decryptPhotoMetadata(
  encryptedPackage: {
    encrypted: string;
    iv: string;
    authTag: string;
    salt: string;
  },
  masterKey: string,
): Promise<Record<string, unknown>> {
  // Derive key from master key and salt
  const salt = Buffer.from(encryptedPackage.salt, "hex");
  const key = await deriveKey(masterKey, salt);

  // Decrypt metadata
  const plaintext = decrypt(encryptedPackage, key);

  try {
    return JSON.parse(plaintext);
  } catch (error) {
    throw new Error("Failed to parse decrypted metadata");
  }
}

/**
 * Generate a secure master key
 *
 * @returns 64-character hex string (32 bytes)
 */
export function generateMasterKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Check if data is encrypted (has encryption package structure)
 *
 * @param data - Data to check
 * @returns True if data appears to be encrypted
 */
export function isEncrypted(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "encrypted" in data &&
    "iv" in data &&
    "authTag" in data &&
    "salt" in data
  );
}
