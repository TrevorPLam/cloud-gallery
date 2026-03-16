// Hierarchical key management system for zero-knowledge encryption.
// Manages master, file, sharing, and device keys with proper key separation.

import { Buffer } from "buffer";
import { 
  deriveSpecializedKey, 
  KeyType, 
  DerivedKey, 
  retrieveMasterKey,
  isValidKey,
  generateDerivationSalt,
} from "./key-derivation";
import type { BiometricAuthResult } from "./biometric-auth";
import { generateEncryptionKey } from "./encryption";

/**
 * Key hierarchy manager interface
 */
export interface KeyHierarchyManager {
  getMasterKey(): Promise<string | null>;
  getFileKey(fileId: string): Promise<string>;
  getSharingKey(sharingId: string): Promise<string>;
  getDeviceKey(deviceId: string): Promise<string>;
  rotateMasterKey(newPassword: string): Promise<boolean>;
  clearAllKeys(): Promise<boolean>;
}

/**
 * Key metadata for tracking and rotation
 */
export interface KeyMetadata {
  id: string;
  type: KeyType;
  parentId?: string;
  createdAt: number;
  lastUsed?: number;
  usageCount: number;
}

/**
 * Key cache entry with expiration
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * In-memory key cache with expiration
 */
class KeyCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, timestamp: Date.now(), expiresAt });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Hierarchical key management implementation
 */
export class KeyHierarchy implements KeyHierarchyManager {
  private keyCache = new KeyCache();
  private keyMetadata = new Map<string, KeyMetadata>();
  private masterKeyPromise: Promise<string | null> | null = null;

  /**
   * Get or derive the master key with optional biometric authentication
   * @param requireBiometrics - Whether to require biometric authentication
   * @returns Master key or null if unavailable
   */
  async getMasterKey(requireBiometrics: boolean = false): Promise<string | null> {
    // Check cache first
    const cached = this.keyCache.get<string>("master_key");
    if (cached && !requireBiometrics) {
      return cached;
    }

    // Prevent multiple concurrent master key retrievals
    if (!this.masterKeyPromise) {
      this.masterKeyPromise = this.retrieveMasterKeyInternal(requireBiometrics);
    }

    try {
      const masterKey = await this.masterKeyPromise;
      
      if (masterKey) {
        // Cache the master key with shorter TTL for security
        this.keyCache.set("master_key", masterKey, 2 * 60 * 1000); // 2 minutes
        
        // Update metadata
        this.updateKeyMetadata("master", KeyType.MASTER, undefined);
      }

      return masterKey;
    } finally {
      this.masterKeyPromise = null;
    }
  }

  /**
   * Internal method to retrieve master key with proper error handling
   */
  private async retrieveMasterKeyInternal(requireBiometrics: boolean): Promise<string | null> {
    try {
      return await retrieveMasterKey(requireBiometrics);
    } catch (error) {
      console.error("Failed to retrieve master key:", error);
      
      // If biometrics failed and wasn't required, try without biometrics
      if (requireBiometrics) {
        console.log("Retrying master key retrieval without biometrics...");
        return await retrieveMasterKey(false);
      }
      
      return null;
    }
  }

  /**
   * Get or derive a file-specific encryption key
   * @param fileId - Unique file identifier
   * @returns File encryption key
   */
  async getFileKey(fileId: string): Promise<string> {
    const cacheKey = `file_key:${fileId}`;
    const cached = this.keyCache.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    const masterKey = await this.getMasterKey();
    if (!masterKey) {
      throw new Error("Master key required for file key derivation");
    }

    const derivedKey = await deriveSpecializedKey(masterKey, KeyType.FILE, fileId);
    
    // Cache the file key for longer duration (files are accessed frequently)
    this.keyCache.set(cacheKey, derivedKey.key, 10 * 60 * 1000); // 10 minutes
    
    // Update metadata
    this.updateKeyMetadata(cacheKey, KeyType.FILE, "master");

    return derivedKey.key;
  }

  /**
   * Get or derive a sharing-specific encryption key
   * @param sharingId - Unique sharing identifier (album ID, share token, etc.)
   * @returns Sharing encryption key
   */
  async getSharingKey(sharingId: string): Promise<string> {
    const cacheKey = `sharing_key:${sharingId}`;
    const cached = this.keyCache.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    const masterKey = await this.getMasterKey();
    if (!masterKey) {
      throw new Error("Master key required for sharing key derivation");
    }

    const derivedKey = await deriveSpecializedKey(masterKey, KeyType.SHARING, sharingId);
    
    // Cache sharing keys with medium duration
    this.keyCache.set(cacheKey, derivedKey.key, 7 * 60 * 1000); // 7 minutes
    
    // Update metadata
    this.updateKeyMetadata(cacheKey, KeyType.SHARING, "master");

    return derivedKey.key;
  }

  /**
   * Get or derive a device-specific encryption key
   * @param deviceId - Unique device identifier
   * @returns Device encryption key
   */
  async getDeviceKey(deviceId: string): Promise<string> {
    const cacheKey = `device_key:${deviceId}`;
    const cached = this.keyCache.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    const masterKey = await this.getMasterKey();
    if (!masterKey) {
      throw new Error("Master key required for device key derivation");
    }

    const derivedKey = await deriveSpecializedKey(masterKey, KeyType.DEVICE, deviceId);
    
    // Cache device keys for longer duration (device keys change rarely)
    this.keyCache.set(cacheKey, derivedKey.key, 30 * 60 * 1000); // 30 minutes
    
    // Update metadata
    this.updateKeyMetadata(cacheKey, KeyType.DEVICE, "master");

    return derivedKey.key;
  }

  /**
   * Rotate the master key and re-derive all dependent keys
   * @param newPassword - New password for master key derivation
   * @returns Success status
   */
  async rotateMasterKey(newPassword: string): Promise<boolean> {
    try {
      // Clear current master key from cache
      this.keyCache.clear();
      
      // Import the key derivation functions
      const { createAndStoreMasterKey } = await import("./key-derivation");
      
      // Create new master key
      const newMasterKey = await createAndStoreMasterKey(newPassword);
      if (!newMasterKey) {
        throw new Error("Failed to create new master key");
      }

      // Clear all derived keys from cache (they'll be re-derived on next use)
      this.clearCache();
      
      // Update rotation metadata
      const masterMetadata = this.keyMetadata.get("master");
      if (masterMetadata) {
        masterMetadata.lastUsed = Date.now();
        masterMetadata.usageCount++;
      }

      return true;
    } catch (error) {
      console.error("Master key rotation failed:", error);
      return false;
    }
  }

  /**
   * Clear all cached keys and metadata
   * @returns Success status
   */
  async clearAllKeys(): Promise<boolean> {
    try {
      this.keyCache.clear();
      this.keyMetadata.clear();
      
      const { clearAllKeys } = await import("./key-derivation");
      return await clearAllKeys();
    } catch (error) {
      console.error("Failed to clear all keys:", error);
      return false;
    }
  }

  /**
   * Clear in-memory cache only (doesn't affect stored keys)
   */
  clearCache(): void {
    this.keyCache.clear();
  }

  /**
   * Get metadata for a specific key
   * @param keyId - Key identifier
   * @returns Key metadata or null if not found
   */
  getKeyMetadata(keyId: string): KeyMetadata | null {
    return this.keyMetadata.get(keyId) || null;
  }

  /**
   * Get all key metadata
   * @returns Array of all key metadata
   */
  getAllKeyMetadata(): KeyMetadata[] {
    return Array.from(this.keyMetadata.values());
  }

  /**
   * Force re-derivation of a specific key type
   * @param keyType - Type of key to invalidate
   * @param identifier - Optional identifier for specific key
   */
  invalidateKey(keyType: KeyType, identifier?: string): void {
    let cacheKey: string;
    
    switch (keyType) {
      case KeyType.MASTER:
        cacheKey = "master_key";
        break;
      case KeyType.FILE:
        cacheKey = `file_key:${identifier}`;
        break;
      case KeyType.SHARING:
        cacheKey = `sharing_key:${identifier}`;
        break;
      case KeyType.DEVICE:
        cacheKey = `device_key:${identifier}`;
        break;
      default:
        throw new Error(`Unknown key type: ${keyType}`);
    }

    this.keyCache.cache.delete(cacheKey);
  }

  /**
   * Check if a key exists in cache
   * @param keyType - Type of key to check
   * @param identifier - Optional identifier for specific key
   * @returns True if key exists in cache
   */
  hasKey(keyType: KeyType, identifier?: string): boolean {
    let cacheKey: string;
    
    switch (keyType) {
      case KeyType.MASTER:
        cacheKey = "master_key";
        break;
      case KeyType.FILE:
        cacheKey = `file_key:${identifier}`;
        break;
      case KeyType.SHARING:
        cacheKey = `sharing_key:${identifier}`;
        break;
      case KeyType.DEVICE:
        cacheKey = `device_key:${identifier}`;
        break;
      default:
        return false;
    }

    return this.keyCache.get(cacheKey) !== null;
  }

  /**
   * Get cache statistics for monitoring
   * @returns Cache statistics
   */
  getCacheStats(): {
    size: number;
    masterKeyCached: boolean;
    fileKeysCount: number;
    sharingKeysCount: number;
    deviceKeysCount: number;
  } {
    const stats = {
      size: this.keyCache.size(),
      masterKeyCached: this.keyCache.get("master_key") !== null,
      fileKeysCount: 0,
      sharingKeysCount: 0,
      deviceKeysCount: 0,
    };

    // Count different key types in cache
    for (const key of this.keyCache.cache.keys()) {
      if (key.startsWith("file_key:")) stats.fileKeysCount++;
      else if (key.startsWith("sharing_key:")) stats.sharingKeysCount++;
      else if (key.startsWith("device_key:")) stats.deviceKeysCount++;
    }

    return stats;
  }

  /**
   * Update key metadata
   */
  private updateKeyMetadata(id: string, type: KeyType, parentId?: string): void {
    const existing = this.keyMetadata.get(id);
    const now = Date.now();

    if (existing) {
      existing.lastUsed = now;
      existing.usageCount++;
    } else {
      this.keyMetadata.set(id, {
        id,
        type,
        parentId,
        createdAt: now,
        usageCount: 1,
      });
    }
  }
}

// Global key hierarchy instance
export const keyHierarchy = new KeyHierarchy();

/**
 * Convenience functions for common operations
 */

/**
 * Get file encryption key with automatic master key handling
 * @param fileId - File identifier
 * @param requireBiometrics - Whether to require biometric authentication
 * @returns File encryption key
 */
export async function getFileEncryptionKey(
  fileId: string,
  requireBiometrics: boolean = false,
): Promise<string> {
  return await keyHierarchy.getFileKey(fileId);
}

/**
 * Get sharing encryption key with automatic master key handling
 * @param sharingId - Sharing identifier
 * @param requireBiometrics - Whether to require biometric authentication
 * @returns Sharing encryption key
 */
export async function getSharingEncryptionKey(
  sharingId: string,
  requireBiometrics: boolean = false,
): Promise<string> {
  return await keyHierarchy.getSharingKey(sharingId);
}

/**
 * Get device encryption key with automatic master key handling
 * @param deviceId - Device identifier
 * @param requireBiometrics - Whether to require biometric authentication
 * @returns Device encryption key
 */
export async function getDeviceEncryptionKey(
  deviceId: string,
  requireBiometrics: boolean = false,
): Promise<string> {
  return await keyHierarchy.getDeviceKey(deviceId);
}

/**
 * Setup key hierarchy with biometric authentication
 * @param requireBiometrics - Whether to enable biometric protection
 * @returns Setup success status
 */
export async function setupKeyHierarchy(requireBiometrics: boolean = false): Promise<boolean> {
  try {
    // Test master key retrieval
    const masterKey = await keyHierarchy.getMasterKey(requireBiometrics);
    return masterKey !== null;
  } catch (error) {
    console.error("Key hierarchy setup failed:", error);
    return false;
  }
}
