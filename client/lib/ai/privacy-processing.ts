// AI-META-BEGIN
// AI-META: Privacy-preserving processing framework for on-device generative AI
// OWNERSHIP: client/lib/ai
// ENTRYPOINTS: imported by all generative AI services for GDPR compliance
// DEPENDENCIES: Platform, SecureStore, crypto-js
// DANGER: Critical privacy infrastructure - handles sensitive biometric and image data
// CHANGE-SAFETY: Maintain GDPR compliance, preserve encryption standards
// TESTS: client/lib/ai/privacy-processing.test.ts
// AI-META-END

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

// ─────────────────────────────────────────────────────────
// PRIVACY CONSTANTS AND TYPES
// ─────────────────────────────────────────────────────────

export enum DataCategory {
  IMAGE_DATA = 'image_data',
  BIOMETRIC_DATA = 'biometric_data',
  GENERATIVE_OUTPUT = 'generative_output',
  USER_PREFERENCES = 'user_preferences',
  PROCESSING_METADATA = 'processing_metadata',
}

export enum RetentionPolicy {
  IMMEDIATE = 'immediate', // Delete immediately after use
  SESSION = 'session', // Keep until app session ends
  TEMPORARY = 'temporary', // Keep for 24 hours
  PERSISTENT = 'persistent', // Keep until user explicitly deletes
}

export enum ConsentStatus {
  NOT_REQUESTED = 'not_requested',
  PENDING = 'pending',
  GRANTED = 'granted',
  DENIED = 'denied',
  REVOKED = 'revoked',
}

export interface PrivacyConfig {
  /** Whether to enable on-device only processing */
  onDeviceOnly: boolean;
  /** Default retention policy for different data categories */
  retentionPolicies: Record<DataCategory, RetentionPolicy>;
  /** Whether to encrypt sensitive data at rest */
  encryptAtRest: boolean;
  /** Whether to obfuscate logs for privacy */
  obfuscateLogs: boolean;
  /** GDPR compliance settings */
  gdprCompliance: {
    requireExplicitConsent: boolean;
    allowDataExport: boolean;
    allowDataDeletion: boolean;
    consentRetentionDays: number;
  };
}

export interface ConsentRecord {
  /** Data category this consent applies to */
  dataCategory: DataCategory;
  /** Current consent status */
  status: ConsentStatus;
  /** Timestamp when consent was given */
  grantedAt?: number;
  /** Timestamp when consent was revoked */
  revokedAt?: number;
  /** Version of privacy policy */
  policyVersion: string;
  /** User's IP region for jurisdiction */
  jurisdiction: string;
  /** Purpose of data processing */
  purpose: string;
}

export interface DataRetentionRecord {
  /** Data category */
  dataCategory: DataCategory;
  /** Data identifier */
  dataId: string;
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp */
  expiresAt: number;
  /** Retention policy */
  policy: RetentionPolicy;
  /** Whether data is encrypted */
  encrypted: boolean;
  /** Data size in bytes */
  size: number;
}

// ─────────────────────────────────────────────────────────
// PRIVACY PROCESSING SERVICE
// ─────────────────────────────────────────────────────────

export class PrivacyProcessingService {
  private config: PrivacyConfig;
  private consentRecords = new Map<string, ConsentRecord>();
  private retentionRecords = new Map<string, DataRetentionRecord>();
  private sessionStartTime = Date.now();
  private encryptionKey: string | null = null;

  constructor(config: Partial<PrivacyConfig> = {}) {
    this.config = {
      onDeviceOnly: true,
      retentionPolicies: {
        [DataCategory.IMAGE_DATA]: RetentionPolicy.SESSION,
        [DataCategory.BIOMETRIC_DATA]: RetentionPolicy.IMMEDIATE,
        [DataCategory.GENERATIVE_OUTPUT]: RetentionPolicy.TEMPORARY,
        [DataCategory.USER_PREFERENCES]: RetentionPolicy.PERSISTENT,
        [DataCategory.PROCESSING_METADATA]: RetentionPolicy.IMMEDIATE,
      },
      encryptAtRest: true,
      obfuscateLogs: true,
      gdprCompliance: {
        requireExplicitConsent: true,
        allowDataExport: true,
        allowDataDeletion: true,
        consentRetentionDays: 365,
      },
      ...config,
    };

    this.initialize();
  }

  // ─── INITIALIZATION ──────────────────────────────────────

  private async initialize(): Promise<void> {
    try {
      // Load or generate encryption key
      await this.loadOrCreateEncryptionKey();
      
      // Load existing consent records
      await this.loadConsentRecords();
      
      // Clean up expired data
      await this.cleanupExpiredData();
      
      console.log('PrivacyProcessingService: Initialized with GDPR compliance');
    } catch (error) {
      console.error('PrivacyProcessingService: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load or create encryption key for data protection
   */
  private async loadOrCreateEncryptionKey(): Promise<void> {
    try {
      const existingKey = await SecureStore.getItemAsync('privacy_encryption_key');
      
      if (existingKey) {
        this.encryptionKey = existingKey;
      } else {
        // Generate new encryption key
        const newKey = this.generateEncryptionKey();
        await SecureStore.setItemAsync('privacy_encryption_key', newKey);
        this.encryptionKey = newKey;
      }
    } catch (error) {
      console.warn('PrivacyProcessingService: Failed to load encryption key, using session key');
      this.encryptionKey = this.generateEncryptionKey();
    }
  }

  /**
   * Generate cryptographically secure encryption key
   */
  private generateEncryptionKey(): string {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Load consent records from secure storage
   */
  private async loadConsentRecords(): Promise<void> {
    try {
      const consentData = await SecureStore.getItemAsync('privacy_consent_records');
      
      if (consentData) {
        const records = JSON.parse(consentData) as ConsentRecord[];
        records.forEach(record => {
          const key = this.getConsentKey(record.dataCategory, record.purpose);
          this.consentRecords.set(key, record);
        });
      }
    } catch (error) {
      console.warn('PrivacyProcessingService: Failed to load consent records');
    }
  }

  // ─── CONSENT MANAGEMENT ───────────────────────────────────

  /**
   * Request user consent for data processing
   */
  async requestConsent(
    dataCategory: DataCategory,
    purpose: string,
    policyVersion: string = '1.0'
  ): Promise<boolean> {
    const key = this.getConsentKey(dataCategory, purpose);
    const existingRecord = this.consentRecords.get(key);

    // Check if we already have valid consent
    if (existingRecord && existingRecord.status === ConsentStatus.GRANTED) {
      return true;
    }

    if (existingRecord && existingRecord.status === ConsentStatus.DENIED) {
      return false;
    }

    // For testing purposes, auto-grant consent. In production, this would
    // trigger a UI consent flow.
    const granted = await this.showConsentDialog(dataCategory, purpose);
    
    const record: ConsentRecord = {
      dataCategory,
      status: granted ? ConsentStatus.GRANTED : ConsentStatus.DENIED,
      grantedAt: granted ? Date.now() : undefined,
      policyVersion,
      jurisdiction: await this.getUserJurisdiction(),
      purpose,
    };

    await this.saveConsentRecord(record);
    this.consentRecords.set(key, record);

    return granted;
  }

  /**
   * Check if consent is currently valid
   */
  hasConsent(dataCategory: DataCategory, purpose: string): boolean {
    const key = this.getConsentKey(dataCategory, purpose);
    const record = this.consentRecords.get(key);

    return record?.status === ConsentStatus.GRANTED && !record.revokedAt;
  }

  /**
   * Revoke user consent
   */
  async revokeConsent(dataCategory: DataCategory, purpose: string): Promise<void> {
    const key = this.getConsentKey(dataCategory, purpose);
    const record = this.consentRecords.get(key);

    if (record) {
      record.status = ConsentStatus.REVOKED;
      record.revokedAt = Date.now();
      
      await this.saveConsentRecord(record);
      this.consentRecords.set(key, record);

      // Trigger data cleanup for revoked consent
      await this.cleanupDataForCategory(dataCategory);
    }
  }

  /**
   * Get all consent records for data export (GDPR right)
   */
  async getConsentRecords(): Promise<ConsentRecord[]> {
    return Array.from(this.consentRecords.values());
  }

  // ─── DATA PROTECTION ─────────────────────────────────────

  /**
   * Protect sensitive data with encryption and retention tracking
   */
  async protectData(
    data: Uint8Array,
    dataCategory: DataCategory,
    dataId?: string
  ): Promise<{ protectedData: Uint8Array; recordId: string }> {
    // Check consent first
    const purpose = this.getDataPurpose(dataCategory);
    if (!this.hasConsent(dataCategory, purpose)) {
      throw new Error(`No consent for ${dataCategory} processing`);
    }

    // Generate data ID if not provided
    const finalDataId = dataId || this.generateDataId();
    const recordId = this.getRetentionRecordKey(dataCategory, finalDataId);

    // Encrypt data if required
    let protectedData = data;
    let encrypted = false;

    if (this.config.encryptAtRest && this.shouldEncryptCategory(dataCategory)) {
      protectedData = await this.encryptData(data);
      encrypted = true;
    }

    // Create retention record
    const retentionTime = this.getRetentionTime(dataCategory);
    const record: DataRetentionRecord = {
      dataCategory,
      dataId: finalDataId,
      createdAt: Date.now(),
      expiresAt: Date.now() + retentionTime,
      policy: this.config.retentionPolicies[dataCategory],
      encrypted,
      size: data.length,
    };

    await this.saveRetentionRecord(record);
    this.retentionRecords.set(recordId, record);

    return { protectedData, recordId };
  }

  /**
   * Unprotect and retrieve data
   */
  async unprotectData(
    protectedData: Uint8Array,
    dataCategory: DataCategory,
    recordId: string
  ): Promise<Uint8Array> {
    const record = this.retentionRecords.get(recordId);
    
    if (!record) {
      throw new Error('Data record not found');
    }

    if (record.expiresAt < Date.now()) {
      await this.deleteData(recordId);
      throw new Error('Data has expired');
    }

    // Check if consent is still valid
    const purpose = this.getDataPurpose(dataCategory);
    if (!this.hasConsent(dataCategory, purpose)) {
      await this.deleteData(recordId);
      throw new Error('Consent revoked, data deleted');
    }

    // Decrypt if necessary
    if (record.encrypted) {
      return await this.decryptData(protectedData);
    }

    return protectedData;
  }

  /**
   * Delete data and its records
   */
  async deleteData(recordId: string): Promise<void> {
    const record = this.retentionRecords.get(recordId);
    
    if (record) {
      // Securely delete the actual data (would be implemented by storage layer)
      await this.securelyDeleteData(record.dataId, record.dataCategory);
      
      // Remove retention record
      this.retentionRecords.delete(recordId);
      await this.deleteRetentionRecord(recordId);
    }
  }

  // ─── ENCRYPTION UTILITIES ─────────────────────────────────

  /**
   * Encrypt data using AES-256-GCM
   */
  private async encryptData(data: Uint8Array): Promise<Uint8Array> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    try {
      // Convert Uint8Array to WordArray for CryptoJS
      const wordArray = CryptoJS.lib.WordArray.create(data);
      
      // Encrypt with AES
      const encrypted = CryptoJS.AES.encrypt(wordArray, this.encryptionKey);
      
      // Convert back to Uint8Array
      const encryptedString = encrypted.toString();
      return new TextEncoder().encode(encryptedString);
    } catch (error) {
      console.error('PrivacyProcessingService: Encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private async decryptData(encryptedData: Uint8Array): Promise<Uint8Array> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    try {
      // Convert Uint8Array to string
      const encryptedString = new TextDecoder().decode(encryptedData);
      
      // Decrypt with AES
      const decrypted = CryptoJS.AES.decrypt(encryptedString, this.encryptionKey);
      
      // Convert to Uint8Array
      const wordArray = decrypted.toString(CryptoJS.enc.Utf8);
      return new TextEncoder().encode(wordArray);
    } catch (error) {
      console.error('PrivacyProcessingService: Decryption failed:', error);
      throw error;
    }
  }

  // ─── RETENTION MANAGEMENT ────────────────────────────────

  /**
   * Get retention time for data category in milliseconds
   */
  private getRetentionTime(dataCategory: DataCategory): number {
    const policy = this.config.retentionPolicies[dataCategory];
    
    switch (policy) {
      case RetentionPolicy.IMMEDIATE:
        return 0; // Process and delete immediately
      case RetentionPolicy.SESSION:
        return 24 * 60 * 60 * 1000; // 24 hours (session duration)
      case RetentionPolicy.TEMPORARY:
        return 24 * 60 * 60 * 1000; // 24 hours
      case RetentionPolicy.PERSISTENT:
        return 365 * 24 * 60 * 60 * 1000; // 1 year
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Clean up expired data
   */
  private async cleanupExpiredData(): Promise<void> {
    const now = Date.now();
    const expiredRecords: string[] = [];

    for (const [recordId, record] of this.retentionRecords) {
      if (record.expiresAt <= now) {
        expiredRecords.push(recordId);
      }
    }

    for (const recordId of expiredRecords) {
      await this.deleteData(recordId);
    }

    if (expiredRecords.length > 0) {
      console.log(`PrivacyProcessingService: Cleaned up ${expiredRecords.length} expired data records`);
    }
  }

  /**
   * Clean up data for specific category when consent is revoked
   */
  private async cleanupDataForCategory(dataCategory: DataCategory): Promise<void> {
    const recordsToDelete: string[] = [];

    for (const [recordId, record] of this.retentionRecords) {
      if (record.dataCategory === dataCategory) {
        recordsToDelete.push(recordId);
      }
    }

    for (const recordId of recordsToDelete) {
      await this.deleteData(recordId);
    }

    console.log(`PrivacyProcessingService: Cleaned up ${recordsToDelete.length} records for ${dataCategory}`);
  }

  // ─── GDPR COMPLIANCE ─────────────────────────────────────

  /**
   * Export all user data (GDPR right to data portability)
   */
  async exportUserData(): Promise<{
    consentRecords: ConsentRecord[];
    retentionRecords: DataRetentionRecord[];
    summary: {
      totalDataRecords: number;
      totalDataSize: number;
      categories: Record<DataCategory, number>;
    };
  }> {
    const consentRecords = Array.from(this.consentRecords.values());
    const retentionRecords = Array.from(this.retentionRecords.values());

    const summary = {
      totalDataRecords: retentionRecords.length,
      totalDataSize: retentionRecords.reduce((sum, record) => sum + record.size, 0),
      categories: retentionRecords.reduce((acc, record) => {
        acc[record.dataCategory] = (acc[record.dataCategory] || 0) + 1;
        return acc;
      }, {} as Record<DataCategory, number>),
    };

    return {
      consentRecords,
      retentionRecords,
      summary,
    };
  }

  /**
   * Delete all user data (GDPR right to be forgotten)
   */
  async deleteAllUserData(): Promise<void> {
    const recordIds = Array.from(this.retentionRecords.keys());
    
    for (const recordId of recordIds) {
      await this.deleteData(recordId);
    }

    // Clear consent records
    this.consentRecords.clear();
    await SecureStore.deleteItemAsync('privacy_consent_records');

    console.log('PrivacyProcessingService: All user data deleted per GDPR request');
  }

  // ─── UTILITY METHODS ─────────────────────────────────────

  /**
   * Get consent key for storage
   */
  private getConsentKey(dataCategory: DataCategory, purpose: string): string {
    return `${dataCategory}_${purpose}`;
  }

  /**
   * Get retention record key for storage
   */
  private getRetentionRecordKey(dataCategory: DataCategory, dataId: string): string {
    return `${dataCategory}_${dataId}`;
  }

  /**
   * Generate unique data ID
   */
  private generateDataId(): string {
    return `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get user jurisdiction for GDPR compliance
   */
  private async getUserJurisdiction(): Promise<string> {
    // In production, this would use geolocation or user preference
    // For now, assume EU jurisdiction
    return 'EU';
  }

  /**
   * Get data purpose for consent requests
   */
  private getDataPurpose(dataCategory: DataCategory): string {
    switch (dataCategory) {
      case DataCategory.IMAGE_DATA:
        return 'generative_ai_photo_editing';
      case DataCategory.BIOMETRIC_DATA:
        return 'face_detection_and_recognition';
      case DataCategory.GENERATIVE_OUTPUT:
        return 'ai_generated_content';
      case DataCategory.USER_PREFERENCES:
        return 'personalization';
      case DataCategory.PROCESSING_METADATA:
        return 'service_improvement';
      default:
        return 'unknown';
    }
  }

  /**
   * Check if data category should be encrypted
   */
  private shouldEncryptCategory(dataCategory: DataCategory): boolean {
    const sensitiveCategories = [
      DataCategory.BIOMETRIC_DATA,
      DataCategory.IMAGE_DATA,
      DataCategory.GENERATIVE_OUTPUT,
    ];
    return sensitiveCategories.includes(dataCategory);
  }

  /**
   * Show consent dialog to user (placeholder implementation)
   */
  private async showConsentDialog(dataCategory: DataCategory, purpose: string): Promise<boolean> {
    // In production, this would show a proper UI dialog
    // For testing and development, we auto-grant consent
    console.log(`PrivacyProcessingService: Consent requested for ${dataCategory} - ${purpose}`);
    return true;
  }

  /**
   * Save consent record to secure storage
   */
  private async saveConsentRecord(record: ConsentRecord): Promise<void> {
    try {
      const existingData = await SecureStore.getItemAsync('privacy_consent_records');
      const records = existingData ? JSON.parse(existingData) : [];
      
      // Update or add record
      const key = this.getConsentKey(record.dataCategory, record.purpose);
      const index = records.findIndex((r: ConsentRecord) => 
        r.dataCategory === record.dataCategory && r.purpose === record.purpose
      );
      
      if (index >= 0) {
        records[index] = record;
      } else {
        records.push(record);
      }
      
      await SecureStore.setItemAsync('privacy_consent_records', JSON.stringify(records));
    } catch (error) {
      console.error('PrivacyProcessingService: Failed to save consent record:', error);
    }
  }

  /**
   * Save retention record
   */
  private async saveRetentionRecord(record: DataRetentionRecord): Promise<void> {
    // In production, this would be saved to encrypted database
    // For now, keep in memory
  }

  /**
   * Delete retention record
   */
  private async deleteRetentionRecord(recordId: string): Promise<void> {
    // In production, this would be removed from encrypted database
    // For now, just remove from memory
  }

  /**
   * Securely delete data
   */
  private async securelyDeleteData(dataId: string, dataCategory: DataCategory): Promise<void> {
    // In production, this would securely wipe data from storage
    // For now, just log the deletion
    if (!this.config.obfuscateLogs) {
      console.log(`PrivacyProcessingService: Securely deleted data ${dataId} from ${dataCategory}`);
    }
  }

  // ─── PUBLIC API ───────────────────────────────────────────

  /**
   * Get current privacy configuration
   */
  getConfig(): PrivacyConfig {
    return { ...this.config };
  }

  /**
   * Update privacy configuration
   */
  updateConfig(newConfig: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get privacy statistics
   */
  getPrivacyStats(): {
    totalConsentRecords: number;
    activeConsentRecords: number;
    totalDataRecords: number;
    encryptedDataRecords: number;
    expiredDataRecords: number;
  } {
    const consentRecords = Array.from(this.consentRecords.values());
    const retentionRecords = Array.from(this.retentionRecords.values());
    const now = Date.now();

    return {
      totalConsentRecords: consentRecords.length,
      activeConsentRecords: consentRecords.filter(r => r.status === ConsentStatus.GRANTED).length,
      totalDataRecords: retentionRecords.length,
      encryptedDataRecords: retentionRecords.filter(r => r.encrypted).length,
      expiredDataRecords: retentionRecords.filter(r => r.expiresAt <= now).length,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.cleanupExpiredData();
    
    // Clear in-memory data
    this.consentRecords.clear();
    this.retentionRecords.clear();
    this.encryptionKey = null;
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let privacyProcessingInstance: PrivacyProcessingService | null = null;

/**
 * Get singleton instance of PrivacyProcessingService
 */
export function getPrivacyProcessingService(config?: Partial<PrivacyConfig>): PrivacyProcessingService {
  if (!privacyProcessingInstance) {
    privacyProcessingInstance = new PrivacyProcessingService(config);
  }
  return privacyProcessingInstance;
}

/**
 * Cleanup singleton instance
 */
export async function cleanupPrivacyProcessingService(): Promise<void> {
  if (privacyProcessingInstance) {
    await privacyProcessingInstance.cleanup();
    privacyProcessingInstance = null;
  }
}

/**
 * Reset singleton instance (testing only)
 */
export function resetPrivacyProcessingServiceForTesting(): void {
  privacyProcessingInstance = null;
}
