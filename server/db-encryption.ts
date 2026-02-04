// Database encryption utilities for Cloud Gallery
// Provides field-level encryption for sensitive data

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { SECURITY_CONFIG } from "./security";

/**
 * Database encryption configuration
 */
const DB_ENCRYPTION_CONFIG = {
  // Key derivation
  SALT: process.env.DB_ENCRYPTION_SALT || "default-salt-change-in-production",
  KEY_LENGTH: 32, // 256 bits for AES-256
  
  // Encryption
  ALGORITHM: "aes-256-gcm",
  IV_LENGTH: 16, // 128 bits for AES-GCM
  TAG_LENGTH: 16, // Authentication tag length
} as const;

/**
 * Derive encryption key from master password and salt
 */
function deriveEncryptionKey(): Buffer {
  const masterPassword = process.env.DB_ENCRYPTION_KEY || "default-key-change-in-production";
  return scryptSync(masterPassword, DB_ENCRYPTION_CONFIG.SALT, DB_ENCRYPTION_CONFIG.KEY_LENGTH);
}

/**
 * Encrypt sensitive data for database storage
 *
 * @param plaintext - Data to encrypt
 * @returns Encrypted data with IV and tag
 *
 * @example
 * const encrypted = encryptField("sensitive-data");
 * // Store in database as JSON string
 */
export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  try {
    const key = deriveEncryptionKey();
    const iv = randomBytes(DB_ENCRYPTION_CONFIG.IV_LENGTH);
    
    const cipher = createCipheriv(DB_ENCRYPTION_CONFIG.ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const tag = cipher.getAuthTag();
    
    // Combine IV, encrypted data, and tag
    const result = {
      iv: iv.toString("hex"),
      data: encrypted,
      tag: tag.toString("hex"),
    };
    
    return JSON.stringify(result);
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt field data");
  }
}

/**
 * Decrypt sensitive data from database storage
 *
 * @param encryptedData - Encrypted data JSON string
 * @returns Decrypted plaintext
 *
 * @example
 * const decrypted = decryptField(encryptedField);
 */
export function decryptField(encryptedData: string): string {
  if (!encryptedData) return encryptedData;
  
  try {
    // Check if data is encrypted (JSON format)
    let parsed;
    try {
      parsed = JSON.parse(encryptedData);
    } catch {
      // Not encrypted, return as-is
      return encryptedData;
    }
    
    if (!parsed.iv || !parsed.data || !parsed.tag) {
      // Not properly encrypted, return as-is
      return encryptedData;
    }
    
    const key = deriveEncryptionKey();
    const iv = Buffer.from(parsed.iv, "hex");
    const tag = Buffer.from(parsed.tag, "hex");
    
    const decipher = createDecipheriv(DB_ENCRYPTION_CONFIG.ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(parsed.data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt field data");
  }
}

/**
 * Check if a field value is encrypted
 *
 * @param value - Field value to check
 * @returns true if value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  
  try {
    const parsed = JSON.parse(value);
    return !!(parsed.iv && parsed.data && parsed.tag);
  } catch {
    return false;
  }
}

/**
 * Middleware function to encrypt sensitive fields before database operations
 */
export function encryptSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: (keyof T)[],
): T {
  const encrypted = { ...data };
  
  for (const field of sensitiveFields) {
    if (encrypted[field] && typeof encrypted[field] === "string") {
      encrypted[field] = encryptField(encrypted[field]);
    }
  }
  
  return encrypted;
}

/**
 * Middleware function to decrypt sensitive fields after database operations
 */
export function decryptSensitiveFields<T extends Record<string, any>>(
  data: T,
  sensitiveFields: (keyof T)[],
): T {
  const decrypted = { ...data };
  
  for (const field of sensitiveFields) {
    if (decrypted[field] && typeof decrypted[field] === "string") {
      try {
        decrypted[field] = decryptField(decrypted[field]);
      } catch (error) {
        // If decryption fails, keep original value
        console.warn(`Failed to decrypt field ${String(field)}:`, error);
      }
    }
  }
  
  return decrypted;
}

/**
 * Generate a secure database encryption key
 * This should be run once and the result stored securely
 */
export function generateDatabaseEncryptionKey(): string {
  return randomBytes(64).toString("hex");
}

/**
 * Validate encryption configuration
 */
export function validateEncryptionConfig(): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  if (!process.env.DB_ENCRYPTION_KEY) {
    warnings.push("DB_ENCRYPTION_KEY not set, using default (insecure for production)");
  }
  
  if (!process.env.DB_ENCRYPTION_SALT) {
    warnings.push("DB_ENCRYPTION_SALT not set, using default (insecure for production)");
  }
  
  if (process.env.DB_ENCRYPTION_KEY === "default-key-change-in-production") {
    warnings.push("Using default encryption key - please set a secure key for production");
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
  };
}
