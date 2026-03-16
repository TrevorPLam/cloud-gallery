// Platform-specific hardware-accelerated crypto integration.
// Leverages iOS CryptoKit and Android KeyStore for optimal performance and security.

import { Buffer } from "buffer";
import { Platform } from "react-native";
import { generateEncryptionKey, XCHACHA20_KEYBYTES } from "./encryption";

// Platform detection
const isIOS = Platform.OS === "ios";
const isAndroid = Platform.OS === "android";

// Hardware crypto capabilities interface
export interface HardwareCryptoCapabilities {
  secureEnclave: boolean; // iOS Secure Enclave available
  keyStore: boolean; // Android KeyStore available
  hardwareAcceleration: boolean; // Hardware crypto acceleration available
  biometricSupport: boolean; // Biometric authentication available
}

// Key access control levels
export enum KeyAccessLevel {
  WHEN_UNLOCKED = "whenUnlocked", // Key accessible when device is unlocked
  AFTER_FIRST_UNLOCK = "afterFirstUnlock", // Key accessible after first unlock
  ALWAYS = "always", // Key always accessible (less secure)
  BIOMETRY_CURRENT_SET = "biometryCurrentSet", // Require current biometrics
}

// Key creation options
export interface KeyCreationOptions {
  accessLevel: KeyAccessLevel;
  requireBiometry?: boolean;
  validUntil?: Date; // Key expiration
  useSecureEnclave?: boolean; // Force Secure Enclave (iOS only)
}

// Platform-specific key storage interface
export interface PlatformKeyManager {
  createKey: (keyId: string, options: KeyCreationOptions) => Promise<string>;
  getKey: (keyId: string) => Promise<string | null>;
  deleteKey: (keyId: string) => Promise<boolean>;
  keyExists: (keyId: string) => Promise<boolean>;
  encryptWithKey: (keyId: string, data: Uint8Array) => Promise<Uint8Array>;
  decryptWithKey: (
    keyId: string,
    encryptedData: Uint8Array,
  ) => Promise<Uint8Array>;
  signWithKey: (keyId: string, data: Uint8Array) => Promise<Uint8Array>;
  verifyWithKey: (
    keyId: string,
    data: Uint8Array,
    signature: Uint8Array,
  ) => Promise<boolean>;
}

/**
 * Detect hardware crypto capabilities on the current platform
 */
export async function detectHardwareCryptoCapabilities(): Promise<HardwareCryptoCapabilities> {
  const capabilities: HardwareCryptoCapabilities = {
    secureEnclave: false,
    keyStore: false,
    hardwareAcceleration: false,
    biometricSupport: false,
  };

  try {
    if (isIOS) {
      // Check for Secure Enclave support (iOS 9+ with A7+ chip)
      capabilities.secureEnclave = await checkSecureEnclaveSupport();
      capabilities.hardwareAcceleration = capabilities.secureEnclave;
      capabilities.biometricSupport = await checkBiometricSupportIOS();
    } else if (isAndroid) {
      // Check for KeyStore support (Android 4.3+)
      capabilities.keyStore = await checkKeyStoreSupport();
      capabilities.hardwareAcceleration = capabilities.keyStore;
      capabilities.biometricSupport = await checkBiometricSupportAndroid();
    }
  } catch (error) {
    console.warn("Hardware capability detection failed:", error);
  }

  return capabilities;
}

/**
 * Get platform-specific key manager implementation
 */
export function getPlatformKeyManager(): PlatformKeyManager {
  if (isIOS) {
    return new IOSKeyManager();
  } else if (isAndroid) {
    return new AndroidKeyManager();
  } else {
    throw new Error(`Unsupported platform: ${Platform.OS}`);
  }
}

/**
 * iOS Key Manager using CryptoKit and Secure Enclave
 */
class IOSKeyManager implements PlatformKeyManager {
  private deviceCrypto: any; // react-native-device-crypto instance

  constructor() {
    try {
      // Import react-native-device-crypto dynamically
      this.deviceCrypto = require("react-native-device-crypto");
    } catch (error) {
      console.error("Failed to load react-native-device-crypto:", error);
      throw new Error("iOS crypto support requires react-native-device-crypto");
    }
  }

  async createKey(keyId: string, options: KeyCreationOptions): Promise<string> {
    try {
      // Create symmetric key in Secure Enclave if available
      if (options.useSecureEnclave && (await this.isSecureEnclaveAvailable())) {
        const result = await this.deviceCrypto.getOrCreateSymmetricKey(keyId, {
          accessLevel: this.mapAccessLevel(options.accessLevel),
          requireBiometry: options.requireBiometry || false,
          useSecureEnclave: true,
        });

        return result.keyIdentifier || keyId;
      } else {
        // Fallback to regular key storage
        const key = generateEncryptionKey();
        await this.storeKeySecurely(keyId, key, options);
        return keyId;
      }
    } catch (error) {
      console.error("iOS key creation failed:", error);
      throw error;
    }
  }

  async getKey(keyId: string): Promise<string | null> {
    try {
      // Try to get key from Secure Enclave first
      const keyInfo = await this.deviceCrypto.isKeyExists(keyId);
      if (keyInfo.exists) {
        // For Secure Enclave keys, we return the key identifier
        return keyId;
      }

      // Fallback to secure storage
      return await this.getStoredKey(keyId);
    } catch (error) {
      console.error("iOS key retrieval failed:", error);
      return null;
    }
  }

  async deleteKey(keyId: string): Promise<boolean> {
    try {
      // Try to delete from Secure Enclave
      await this.deviceCrypto.deleteKey(keyId);

      // Also try to delete from secure storage
      await this.deleteStoredKey(keyId);

      return true;
    } catch (error) {
      console.error("iOS key deletion failed:", error);
      return false;
    }
  }

  async keyExists(keyId: string): Promise<boolean> {
    try {
      const keyInfo = await this.deviceCrypto.isKeyExists(keyId);
      return keyInfo.exists || (await this.storedKeyExists(keyId));
    } catch (error) {
      console.error("iOS key existence check failed:", error);
      return false;
    }
  }

  async encryptWithKey(keyId: string, data: Uint8Array): Promise<Uint8Array> {
    try {
      // Try hardware-accelerated encryption first
      const result = await this.deviceCrypto.encrypt(
        keyId,
        Buffer.from(data).toString("base64"),
      );
      return Buffer.from(result, "base64");
    } catch (error) {
      // Fallback to software encryption
      const key = await this.getKey(keyId);
      if (!key) throw new Error("Key not found");

      // Use our XChaCha20-Poly1305 implementation
      const { encryptData } = require("./encryption");
      return encryptData(data, key);
    }
  }

  async decryptWithKey(
    keyId: string,
    encryptedData: Uint8Array,
  ): Promise<Uint8Array> {
    try {
      // Try hardware-accelerated decryption first
      const result = await this.deviceCrypto.decrypt(
        keyId,
        Buffer.from(encryptedData).toString("base64"),
      );
      return Buffer.from(result, "base64");
    } catch (error) {
      // Fallback to software decryption
      const key = await this.getKey(keyId);
      if (!key) throw new Error("Key not found");

      // Use our XChaCha20-Poly1305 implementation
      const { decryptData } = require("./encryption");
      return decryptData(encryptedData, key);
    }
  }

  async signWithKey(keyId: string, data: Uint8Array): Promise<Uint8Array> {
    try {
      const result = await this.deviceCrypto.sign(
        keyId,
        Buffer.from(data).toString("base64"),
      );
      return Buffer.from(result, "base64");
    } catch (error) {
      console.error("iOS signing failed:", error);
      throw error;
    }
  }

  async verifyWithKey(
    keyId: string,
    data: Uint8Array,
    signature: Uint8Array,
  ): Promise<boolean> {
    try {
      return await this.deviceCrypto.verify(
        keyId,
        Buffer.from(data).toString("base64"),
        Buffer.from(signature).toString("base64"),
      );
    } catch (error) {
      console.error("iOS verification failed:", error);
      return false;
    }
  }

  private async isSecureEnclaveAvailable(): Promise<boolean> {
    try {
      const capabilities = await this.deviceCrypto.deviceSecurityLevel();
      return capabilities.secureEnclave;
    } catch {
      return false;
    }
  }

  private mapAccessLevel(level: KeyAccessLevel): string {
    switch (level) {
      case KeyAccessLevel.WHEN_UNLOCKED:
        return "whenUnlocked";
      case KeyAccessLevel.AFTER_FIRST_UNLOCK:
        return "afterFirstUnlock";
      case KeyAccessLevel.ALWAYS:
        return "always";
      case KeyAccessLevel.BIOMETRY_CURRENT_SET:
        return "biometryCurrentSet";
      default:
        return "whenUnlocked";
    }
  }

  private async storeKeySecurely(
    keyId: string,
    key: string,
    options: KeyCreationOptions,
  ): Promise<void> {
    // Use expo-secure-store for fallback key storage
    const SecureStore = require("expo-secure-store");

    const keyData = {
      key,
      accessLevel: options.accessLevel,
      requireBiometry: options.requireBiometry || false,
      validUntil: options.validUntil?.getTime(),
    };

    await SecureStore.setItemAsync(keyId, JSON.stringify(keyData), {
      keychainAccessible: this.mapKeychainAccessible(options.accessLevel),
    });
  }

  private async getStoredKey(keyId: string): Promise<string | null> {
    const SecureStore = require("expo-secure-store");

    try {
      const keyData = await SecureStore.getItemAsync(keyId);
      if (!keyData) return null;

      const parsed = JSON.parse(keyData);

      // Check if key has expired
      if (parsed.validUntil && Date.now() > parsed.validUntil) {
        await this.deleteStoredKey(keyId);
        return null;
      }

      return parsed.key;
    } catch {
      return null;
    }
  }

  private async deleteStoredKey(keyId: string): Promise<void> {
    const SecureStore = require("expo-secure-store");
    await SecureStore.deleteItemAsync(keyId);
  }

  private async storedKeyExists(keyId: string): Promise<boolean> {
    const SecureStore = require("expo-secure-store");
    const keyData = await SecureStore.getItemAsync(keyId);
    return keyData !== null;
  }

  private mapKeychainAccessible(level: KeyAccessLevel): any {
    const SecureStore = require("expo-secure-store");

    switch (level) {
      case KeyAccessLevel.WHEN_UNLOCKED:
        return SecureStore.WHEN_UNLOCKED;
      case KeyAccessLevel.AFTER_FIRST_UNLOCK:
        return SecureStore.AFTER_FIRST_UNLOCK;
      case KeyAccessLevel.ALWAYS:
        return SecureStore.ALWAYS;
      default:
        return SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
    }
  }
}

/**
 * Android Key Manager using Android KeyStore
 */
class AndroidKeyManager implements PlatformKeyManager {
  private deviceCrypto: any; // react-native-device-crypto instance

  constructor() {
    try {
      // Import react-native-device-crypto dynamically
      this.deviceCrypto = require("react-native-device-crypto");
    } catch (error) {
      console.error("Failed to load react-native-device-crypto:", error);
      throw new Error(
        "Android crypto support requires react-native-device-crypto",
      );
    }
  }

  async createKey(keyId: string, options: KeyCreationOptions): Promise<string> {
    try {
      const result = await this.deviceCrypto.getOrCreateSymmetricKey(keyId, {
        accessLevel: this.mapAccessLevel(options.accessLevel),
        requireBiometry: options.requireBiometry || false,
      });

      return result.keyIdentifier || keyId;
    } catch (error) {
      console.error("Android key creation failed:", error);
      throw error;
    }
  }

  async getKey(keyId: string): Promise<string | null> {
    try {
      const keyInfo = await this.deviceCrypto.isKeyExists(keyId);
      return keyInfo.exists ? keyId : null;
    } catch (error) {
      console.error("Android key retrieval failed:", error);
      return null;
    }
  }

  async deleteKey(keyId: string): Promise<boolean> {
    try {
      await this.deviceCrypto.deleteKey(keyId);
      return true;
    } catch (error) {
      console.error("Android key deletion failed:", error);
      return false;
    }
  }

  async keyExists(keyId: string): Promise<boolean> {
    try {
      const keyInfo = await this.deviceCrypto.isKeyExists(keyId);
      return keyInfo.exists;
    } catch (error) {
      console.error("Android key existence check failed:", error);
      return false;
    }
  }

  async encryptWithKey(keyId: string, data: Uint8Array): Promise<Uint8Array> {
    try {
      const result = await this.deviceCrypto.encrypt(
        keyId,
        Buffer.from(data).toString("base64"),
      );
      return Buffer.from(result, "base64");
    } catch (error) {
      console.error("Android encryption failed:", error);
      throw error;
    }
  }

  async decryptWithKey(
    keyId: string,
    encryptedData: Uint8Array,
  ): Promise<Uint8Array> {
    try {
      const result = await this.deviceCrypto.decrypt(
        keyId,
        Buffer.from(encryptedData).toString("base64"),
      );
      return Buffer.from(result, "base64");
    } catch (error) {
      console.error("Android decryption failed:", error);
      throw error;
    }
  }

  async signWithKey(keyId: string, data: Uint8Array): Promise<Uint8Array> {
    try {
      const result = await this.deviceCrypto.sign(
        keyId,
        Buffer.from(data).toString("base64"),
      );
      return Buffer.from(result, "base64");
    } catch (error) {
      console.error("Android signing failed:", error);
      throw error;
    }
  }

  async verifyWithKey(
    keyId: string,
    data: Uint8Array,
    signature: Uint8Array,
  ): Promise<boolean> {
    try {
      return await this.deviceCrypto.verify(
        keyId,
        Buffer.from(data).toString("base64"),
        Buffer.from(signature).toString("base64"),
      );
    } catch (error) {
      console.error("Android verification failed:", error);
      return false;
    }
  }

  private mapAccessLevel(level: KeyAccessLevel): string {
    switch (level) {
      case KeyAccessLevel.WHEN_UNLOCKED:
        return "whenUnlocked";
      case KeyAccessLevel.AFTER_FIRST_UNLOCK:
        return "afterFirstUnlock";
      case KeyAccessLevel.ALWAYS:
        return "always";
      case KeyAccessLevel.BIOMETRY_CURRENT_SET:
        return "biometryCurrentSet";
      default:
        return "whenUnlocked";
    }
  }
}

/**
 * Platform capability check functions
 */
async function checkSecureEnclaveSupport(): Promise<boolean> {
  try {
    const deviceCrypto = require("react-native-device-crypto");
    const capabilities = await deviceCrypto.deviceSecurityLevel();
    return capabilities.secureEnclave;
  } catch {
    return false;
  }
}

async function checkKeyStoreSupport(): Promise<boolean> {
  try {
    const deviceCrypto = require("react-native-device-crypto");
    const capabilities = await deviceCrypto.deviceSecurityLevel();
    return capabilities.keyStore;
  } catch {
    return false;
  }
}

async function checkBiometricSupportIOS(): Promise<boolean> {
  try {
    const deviceCrypto = require("react-native-device-crypto");
    const biometryType = await deviceCrypto.getBiometryType();
    return biometryType !== "none";
  } catch {
    return false;
  }
}

async function checkBiometricSupportAndroid(): Promise<boolean> {
  try {
    const deviceCrypto = require("react-native-device-crypto");
    const biometryType = await deviceCrypto.getBiometryType();
    return biometryType !== "none";
  } catch {
    return false;
  }
}

/**
 * Hardware-accelerated crypto operations wrapper
 */
export class HardwareCrypto {
  private keyManager: PlatformKeyManager;
  private capabilities: HardwareCryptoCapabilities;

  constructor() {
    this.keyManager = getPlatformKeyManager();
  }

  async initialize(): Promise<void> {
    this.capabilities = await detectHardwareCryptoCapabilities();
  }

  getCapabilities(): HardwareCryptoCapabilities {
    return this.capabilities;
  }

  /**
   * Create a hardware-backed encryption key
   */
  async createKey(
    keyId: string,
    options: KeyCreationOptions = { accessLevel: KeyAccessLevel.WHEN_UNLOCKED },
  ): Promise<string> {
    return await this.keyManager.createKey(keyId, options);
  }

  /**
   * Get a hardware-backed key
   */
  async getKey(keyId: string): Promise<string | null> {
    return await this.keyManager.getKey(keyId);
  }

  /**
   * Delete a hardware-backed key
   */
  async deleteKey(keyId: string): Promise<boolean> {
    return await this.keyManager.deleteKey(keyId);
  }

  /**
   * Check if a key exists
   */
  async keyExists(keyId: string): Promise<boolean> {
    return await this.keyManager.keyExists(keyId);
  }

  /**
   * Encrypt data using hardware acceleration
   */
  async encrypt(keyId: string, data: Uint8Array): Promise<Uint8Array> {
    return await this.keyManager.encryptWithKey(keyId, data);
  }

  /**
   * Decrypt data using hardware acceleration
   */
  async decrypt(keyId: string, encryptedData: Uint8Array): Promise<Uint8Array> {
    return await this.keyManager.decryptWithKey(keyId, encryptedData);
  }

  /**
   * Sign data using hardware key
   */
  async sign(keyId: string, data: Uint8Array): Promise<Uint8Array> {
    return await this.keyManager.signWithKey(keyId, data);
  }

  /**
   * Verify signature using hardware key
   */
  async verify(
    keyId: string,
    data: Uint8Array,
    signature: Uint8Array,
  ): Promise<boolean> {
    return await this.keyManager.verifyWithKey(keyId, data, signature);
  }

  /**
   * Check if hardware acceleration is available
   */
  isHardwareAccelerationAvailable(): boolean {
    return this.capabilities.hardwareAcceleration;
  }

  /**
   * Check if biometric authentication is available
   */
  isBiometricAvailable(): boolean {
    return this.capabilities.biometricSupport;
  }
}

// Singleton instance
export const hardwareCrypto = new HardwareCrypto();
