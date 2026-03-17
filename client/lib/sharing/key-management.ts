// Encrypted sharing key management for family libraries and partner sharing.
// Provides per-sharing encryption keys with hierarchical permissions and zero-knowledge architecture.

import { Buffer } from "buffer";
import { getSharingEncryptionKey, keyHierarchy } from "../key-hierarchy";
import { KeyType } from "../key-derivation";
import {
  encryptData,
  decryptData,
  encryptMessage,
  decryptMessage,
  generateEncryptionKey,
  isValidKey,
} from "../encryption";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Sharing key types for different encryption contexts
 */
export enum SharingKeyType {
  FAMILY_LIBRARY = "family_library",
  PARTNER_ALBUM = "partner_album",
  SHARED_ALBUM = "shared_album",
  COLLABORATIVE = "collaborative",
}

/**
 * Permission levels for sharing keys
 */
export enum SharingPermission {
  VIEW = "view",
  EDIT = "edit",
  ADMIN = "admin",
  OWNER = "owner",
}

/**
 * Sharing key metadata with permissions and expiration
 */
export interface SharingKeyMetadata {
  id: string;
  type: SharingKeyType;
  name: string;
  description?: string;
  permissions: SharingPermission;
  ownerId: string;
  createdAt: number;
  expiresAt?: number;
  lastRotated?: number;
  isActive: boolean;
  memberIds: string[];
  autoShareRules: AutoShareRule[];
}

/**
 * Auto-share rule configuration
 */
export interface AutoShareRule {
  id: string;
  name: string;
  isEnabled: boolean;
  criteria: ShareCriteria;
  permissions: SharingPermission;
  createdAt: number;
}

/**
 * Share criteria for auto-sharing rules
 */
export interface ShareCriteria {
  contentType?: "photos" | "videos" | "all";
  dateRange?: {
    start: number;
    end: number;
  };
  people?: string[]; // Person IDs
  albums?: string[]; // Album IDs
  tags?: string[];
  minRating?: number; // 1-5 stars
}

/**
 * Encrypted sharing key package for distribution
 */
export interface EncryptedKeyPackage {
  keyId: string;
  encryptedKey: string; // Base64 encrypted sharing key
  keyNonce: string; // Nonce used for encryption
  permissions: SharingPermission;
  expiresAt?: number;
  signature?: string; // Optional signature for verification
}

/**
 * Sharing key manager for encrypted family libraries
 */
export class SharingKeyManager {
  private keyCache = new Map<
    string,
    { key: string; metadata: SharingKeyMetadata }
  >();
  private readonly cacheTimeout = 10 * 60 * 1000; // 10 minutes

  /**
   * Create a new sharing key with hierarchical permissions
   */
  async createSharingKey(
    type: SharingKeyType,
    name: string,
    ownerId: string,
    options: {
      description?: string;
      permissions?: SharingPermission;
      expiresAt?: number;
      memberIds?: string[];
      autoShareRules?: AutoShareRule[];
    } = {},
  ): Promise<{ keyId: string; metadata: SharingKeyMetadata }> {
    const keyId = this.generateKeyId(type, ownerId);
    const sharingId = `${type}:${keyId}`;

    // Derive sharing key from master key hierarchy
    const sharingKey = await getSharingEncryptionKey(sharingId);

    const metadata: SharingKeyMetadata = {
      id: keyId,
      type,
      name,
      description: options.description,
      permissions: options.permissions || SharingPermission.VIEW,
      ownerId,
      createdAt: Date.now(),
      expiresAt: options.expiresAt,
      isActive: true,
      memberIds: options.memberIds || [],
      autoShareRules: options.autoShareRules || [],
    };

    // Cache the key and metadata
    this.keyCache.set(keyId, { key: sharingKey, metadata });

    // Persist metadata to secure storage
    await this.persistKeyMetadata(keyId, metadata);

    return { keyId, metadata };
  }

  /**
   * Get sharing key and metadata
   */
  async getSharingKey(
    keyId: string,
  ): Promise<{ key: string; metadata: SharingKeyMetadata } | null> {
    // Check cache first
    const cached = this.keyCache.get(keyId);
    if (cached) {
      // Validate expiration
      if (cached.metadata.expiresAt && Date.now() > cached.metadata.expiresAt) {
        this.keyCache.delete(keyId);
        return null;
      }
      return cached;
    }

    // Load from persistent storage
    const metadata = await this.loadKeyMetadata(keyId);
    if (!metadata || !metadata.isActive) {
      return null;
    }

    // Check expiration
    if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
      return null;
    }

    // Derive key from hierarchy
    const sharingId = `${metadata.type}:${keyId}`;
    const sharingKey = await getSharingEncryptionKey(sharingId);

    const result = { key: sharingKey, metadata };
    this.keyCache.set(keyId, result);

    return result;
  }

  /**
   * Create encrypted key package for sharing with family members
   */
  async createEncryptedKeyPackage(
    keyId: string,
    recipientUserId: string,
    permissions: SharingPermission,
  ): Promise<EncryptedKeyPackage> {
    const keyData = await this.getSharingKey(keyId);
    if (!keyData) {
      throw new Error("Sharing key not found or expired");
    }

    const { key, metadata } = keyData;

    // Verify permissions (only owner/admin can share)
    if (
      metadata.permissions !== SharingPermission.OWNER &&
      metadata.permissions !== SharingPermission.ADMIN
    ) {
      throw new Error("Insufficient permissions to share this key");
    }

    // Derive recipient's public key for encryption
    const recipientPublicKey =
      await this.getRecipientPublicKey(recipientUserId);
    if (!recipientPublicKey) {
      throw new Error("Recipient public key not found");
    }

    // Encrypt the sharing key for the recipient
    const encryptedKey = await this.encryptKeyForRecipient(
      key,
      recipientPublicKey,
    );

    return {
      keyId,
      encryptedKey,
      keyNonce: this.generateNonce(),
      permissions,
      expiresAt: metadata.expiresAt,
    };
  }

  /**
   * Import encrypted key package from family member
   */
  async importEncryptedKeyPackage(
    packageData: EncryptedKeyPackage,
    senderUserId: string,
  ): Promise<{ keyId: string; metadata: SharingKeyMetadata }> {
    // Verify sender is trusted
    const senderPublicKey = await this.getRecipientPublicKey(senderUserId);
    if (!senderPublicKey) {
      throw new Error("Sender public key not found");
    }

    // Decrypt the sharing key
    const sharingKey = await this.decryptKeyFromRecipient(
      packageData.encryptedKey,
      packageData.keyNonce,
      senderPublicKey,
    );

    // Load or create metadata
    let metadata = await this.loadKeyMetadata(packageData.keyId);
    if (!metadata) {
      // Create basic metadata for imported key
      metadata = {
        id: packageData.keyId,
        type: SharingKeyType.FAMILY_LIBRARY, // Default type
        name: `Imported Key ${packageData.keyId}`,
        permissions: packageData.permissions,
        ownerId: senderUserId, // Original owner
        createdAt: Date.now(),
        expiresAt: packageData.expiresAt,
        isActive: true,
        memberIds: [],
        autoShareRules: [],
      };
    }

    // Cache the decrypted key
    this.keyCache.set(packageData.keyId, { key: sharingKey, metadata });

    // Persist metadata
    await this.persistKeyMetadata(packageData.keyId, metadata);

    return { keyId: packageData.keyId, metadata };
  }

  /**
   * Rotate sharing key (re-derive from master key)
   */
  async rotateSharingKey(keyId: string): Promise<boolean> {
    const existing = await this.getSharingKey(keyId);
    if (!existing) {
      throw new Error("Sharing key not found");
    }

    const { metadata } = existing;

    // Verify permissions (only owner can rotate)
    if (metadata.permissions !== SharingPermission.OWNER) {
      throw new Error("Only owner can rotate sharing keys");
    }

    // Invalidate cache to force re-derivation
    keyHierarchy.invalidateKey(KeyType.SHARING, `${metadata.type}:${keyId}`);
    this.keyCache.delete(keyId);

    // Update metadata
    metadata.lastRotated = Date.now();
    await this.persistKeyMetadata(keyId, metadata);

    return true;
  }

  /**
   * Add member to sharing key
   */
  async addMember(
    keyId: string,
    memberId: string,
    permissions: SharingPermission,
  ): Promise<boolean> {
    const keyData = await this.getSharingKey(keyId);
    if (!keyData) {
      throw new Error("Sharing key not found");
    }

    const { metadata } = keyData;

    // Verify permissions
    if (
      metadata.permissions !== SharingPermission.OWNER &&
      metadata.permissions !== SharingPermission.ADMIN
    ) {
      throw new Error("Insufficient permissions to add members");
    }

    // Add member if not already present
    if (!metadata.memberIds.includes(memberId)) {
      metadata.memberIds.push(memberId);
      await this.persistKeyMetadata(keyId, metadata);
      this.keyCache.set(keyId, keyData); // Update cache
    }

    return true;
  }

  /**
   * Remove member from sharing key
   */
  async removeMember(keyId: string, memberId: string): Promise<boolean> {
    const keyData = await this.getSharingKey(keyId);
    if (!keyData) {
      throw new Error("Sharing key not found");
    }

    const { metadata } = keyData;

    // Verify permissions
    if (
      metadata.permissions !== SharingPermission.OWNER &&
      metadata.permissions !== SharingPermission.ADMIN
    ) {
      throw new Error("Insufficient permissions to remove members");
    }

    // Remove member
    const index = metadata.memberIds.indexOf(memberId);
    if (index > -1) {
      metadata.memberIds.splice(index, 1);
      await this.persistKeyMetadata(keyId, metadata);
      this.keyCache.set(keyId, keyData); // Update cache
    }

    return true;
  }

  /**
   * Add auto-share rule
   */
  async addAutoShareRule(
    keyId: string,
    rule: Omit<AutoShareRule, "id" | "createdAt">,
  ): Promise<string> {
    const keyData = await this.getSharingKey(keyId);
    if (!keyData) {
      throw new Error("Sharing key not found");
    }

    const { metadata } = keyData;

    // Verify permissions
    if (
      metadata.permissions !== SharingPermission.OWNER &&
      metadata.permissions !== SharingPermission.ADMIN
    ) {
      throw new Error("Insufficient permissions to add auto-share rules");
    }

    const newRule: AutoShareRule = {
      ...rule,
      id: this.generateRuleId(),
      createdAt: Date.now(),
    };

    metadata.autoShareRules.push(newRule);
    await this.persistKeyMetadata(keyId, metadata);
    this.keyCache.set(keyId, keyData); // Update cache

    return newRule.id;
  }

  /**
   * Get all sharing keys for user
   */
  async getUserSharingKeys(userId: string): Promise<SharingKeyMetadata[]> {
    const allKeyIds = await this.getAllKeyIds();
    const userKeys: SharingKeyMetadata[] = [];

    for (const keyId of allKeyIds) {
      const metadata = await this.loadKeyMetadata(keyId);
      if (
        metadata &&
        (metadata.ownerId === userId || metadata.memberIds.includes(userId))
      ) {
        userKeys.push(metadata);
      }
    }

    return userKeys.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Encrypt data using sharing key
   */
  async encryptWithSharingKey(
    keyId: string,
    data: Uint8Array,
    additionalData?: Uint8Array,
  ): Promise<Uint8Array> {
    const keyData = await this.getSharingKey(keyId);
    if (!keyData) {
      throw new Error("Sharing key not found");
    }

    return encryptData(data, keyData.key, additionalData);
  }

  /**
   * Decrypt data using sharing key
   */
  async decryptWithSharingKey(
    keyId: string,
    encryptedData: Uint8Array,
    additionalData?: Uint8Array,
  ): Promise<Uint8Array> {
    const keyData = await this.getSharingKey(keyId);
    if (!keyData) {
      throw new Error("Sharing key not found");
    }

    return decryptData(encryptedData, keyData.key, additionalData);
  }

  // Private helper methods

  private generateKeyId(type: SharingKeyType, ownerId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${type}_${ownerId}_${timestamp}_${random}`;
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateNonce(): string {
    return Buffer.from(Date.now().toString()).toString("hex");
  }

  private async persistKeyMetadata(
    keyId: string,
    metadata: SharingKeyMetadata,
  ): Promise<void> {
    const storageKey = `sharing_key_metadata_${keyId}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify(metadata));
  }

  private async loadKeyMetadata(
    keyId: string,
  ): Promise<SharingKeyMetadata | null> {
    const storageKey = `sharing_key_metadata_${keyId}`;
    const data = await AsyncStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  }

  private async getAllKeyIds(): Promise<string[]> {
    // This would need to be implemented based on the secure storage API
    // For now, return empty array - in real implementation would scan storage
    return [];
  }

  private async getRecipientPublicKey(userId: string): Promise<string | null> {
    // This would need to be implemented to fetch user's public key
    // Could be from server, keychain, or secure storage
    return null;
  }

  private async encryptKeyForRecipient(
    key: string,
    publicKey: string,
  ): Promise<string> {
    // This would implement asymmetric encryption using recipient's public key
    // For now, return simple base64 encoding as placeholder
    return Buffer.from(key).toString("base64");
  }

  private async decryptKeyFromRecipient(
    encryptedKey: string,
    nonce: string,
    senderPublicKey: string,
  ): Promise<string> {
    // This would implement asymmetric decryption using private key
    // For now, return simple base64 decoding as placeholder
    return Buffer.from(encryptedKey, "base64").toString();
  }
}

// Global sharing key manager instance
export const sharingKeyManager = new SharingKeyManager();

// Convenience functions

/**
 * Create family library sharing key
 */
export async function createFamilyLibraryKey(
  name: string,
  ownerId: string,
  memberIds?: string[],
): Promise<{ keyId: string; metadata: SharingKeyMetadata }> {
  return await sharingKeyManager.createSharingKey(
    SharingKeyType.FAMILY_LIBRARY,
    name,
    ownerId,
    {
      description: "Family photo library with encrypted sharing",
      permissions: SharingPermission.OWNER,
      memberIds,
    },
  );
}

/**
 * Get sharing key for encryption/decryption
 */
export async function getSharingKeyForEncryption(
  keyId: string,
): Promise<string> {
  const keyData = await sharingKeyManager.getSharingKey(keyId);
  if (!keyData) {
    throw new Error("Sharing key not found");
  }
  return keyData.key;
}

/**
 * Check if user has permission for sharing key
 */
export async function hasSharingPermission(
  keyId: string,
  userId: string,
  requiredPermission: SharingPermission,
): Promise<boolean> {
  const keyData = await sharingKeyManager.getSharingKey(keyId);
  if (!keyData) {
    return false;
  }

  const { metadata } = keyData;

  // Owner has all permissions
  if (metadata.ownerId === userId) {
    return true;
  }

  // Check if user is a member
  if (!metadata.memberIds.includes(userId)) {
    return false;
  }

  // Check permission hierarchy
  const permissionHierarchy = {
    [SharingPermission.VIEW]: 1,
    [SharingPermission.EDIT]: 2,
    [SharingPermission.ADMIN]: 3,
    [SharingPermission.OWNER]: 4,
  };

  const userLevel = permissionHierarchy[metadata.permissions] || 0;
  const requiredLevel = permissionHierarchy[requiredPermission] || 0;

  return userLevel >= requiredLevel;
}
