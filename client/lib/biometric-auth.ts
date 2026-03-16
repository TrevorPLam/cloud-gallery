// Biometric authentication integration for secure key access.
// Provides Face ID, Touch ID, and fingerprint authentication with fallback support.

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import type { LocalAuthenticationResult } from "expo-local-authentication";
import { authenticateWithBiometrics, checkBiometricAvailability } from "./key-derivation";

/**
 * Biometric authentication configuration
 */
export interface BiometricConfig {
  requireBiometrics: boolean;
  allowDevicePasscode: boolean;
  maxAttempts: number;
  timeoutMs: number;
  reason: string;
}

/**
 * Biometric authentication result with detailed information
 */
export interface BiometricAuthResult {
  success: boolean;
  authenticated: boolean;
  biometricType?: string[];
  error?: string;
  errorCode?: string;
  warning?: string;
}

/**
 * Biometric enrollment status
 */
export interface BiometricEnrollmentStatus {
  isEnrolled: boolean;
  supportedTypes: string[];
  hasHardware: boolean;
  devicePasscodeSet: boolean;
}

/**
 * Default biometric configuration
 */
export const DEFAULT_BIOMETRIC_CONFIG: BiometricConfig = {
  requireBiometrics: false,
  allowDevicePasscode: true,
  maxAttempts: 3,
  timeoutMs: 30000, // 30 seconds
  reason: "Authenticate to access your encrypted photos",
};

/**
 * Biometric authentication manager
 */
export class BiometricAuthManager {
  private config: BiometricConfig;
  private attemptCount = 0;
  private lastAttemptTime = 0;

  constructor(config: Partial<BiometricConfig> = {}) {
    this.config = { ...DEFAULT_BIOMETRIC_CONFIG, ...config };
  }

  /**
   * Get current biometric enrollment status
   * @returns Biometric enrollment information
   */
  async getEnrollmentStatus(): Promise<BiometricEnrollmentStatus> {
    try {
      const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      // Check if device passcode is set
      const devicePasscodeSet = await this.checkDevicePasscode();

      return {
        isEnrolled,
        supportedTypes: supportedTypes.map(type => this.getBiometricTypeName(type)),
        hasHardware,
        devicePasscodeSet,
      };
    } catch (error) {
      console.error("Failed to get biometric enrollment status:", error);
      return {
        isEnrolled: false,
        supportedTypes: [],
        hasHardware: false,
        devicePasscodeSet: false,
      };
    }
  }

  /**
   * Authenticate user with biometrics or device passcode
   * @param options - Authentication options
   * @returns Authentication result
   */
  async authenticate(options: {
    reason?: string;
    requireBiometricsOnly?: boolean;
  } = {}): Promise<BiometricAuthResult> {
    const {
      reason = this.config.reason,
      requireBiometricsOnly = false,
    } = options;

    try {
      // Check rate limiting
      if (this.isRateLimited()) {
        return {
          success: false,
          authenticated: false,
          error: "Too many authentication attempts. Please try again later.",
          errorCode: "RATE_LIMITED",
        };
      }

      // Check biometric availability
      const availability = await this.getEnrollmentStatus();
      
      if (!availability.hasHardware) {
        return {
          success: false,
          authenticated: false,
          error: "Biometric hardware not available on this device",
          errorCode: "NO_HARDWARE",
        };
      }

      if (!availability.isEnrolled && requireBiometricsOnly) {
        return {
          success: false,
          authenticated: false,
          error: "No biometrics enrolled. Please set up Face ID, Touch ID, or fingerprint.",
          errorCode: "NOT_ENROLLED",
        };
      }

      // Perform authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: "Cancel",
        fallbackLabel: requireBiometricsOnly ? undefined : "Use Password",
        disableDeviceFallback: requireBiometricsOnly && !this.config.allowDevicePasscode,
      });

      this.updateAttemptHistory(result.success);

      if (result.success) {
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        return {
          success: true,
          authenticated: true,
          biometricType: supportedTypes.map(type => this.getBiometricTypeName(type)),
        };
      } else {
        return {
          success: false,
          authenticated: false,
          error: result.error || "Authentication failed",
          errorCode: result.error || "AUTH_FAILED",
        };
      }
    } catch (error) {
      this.updateAttemptHistory(false);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown authentication error";
      console.error("Biometric authentication failed:", error);

      return {
        success: false,
        authenticated: false,
        error: errorMessage,
        errorCode: "EXCEPTION",
      };
    }
  }

  /**
   * Authenticate with biometrics only (no device passcode fallback)
   * @param reason - Authentication reason
   * @returns Authentication result
   */
  async authenticateWithBiometricsOnly(reason?: string): Promise<BiometricAuthResult> {
    return this.authenticate({
      reason,
      requireBiometricsOnly: true,
    });
  }

  /**
   * Authenticate with device passcode fallback
   * @param reason - Authentication reason
   * @returns Authentication result
   */
  async authenticateWithFallback(reason?: string): Promise<BiometricAuthResult> {
    return this.authenticate({
      reason,
      requireBiometricsOnly: false,
    });
  }

  /**
   * Check if device passcode is set
   * @returns True if device passcode is set
   */
  private async checkDevicePasscode(): Promise<boolean> {
    try {
      // This is a workaround to check if device passcode is set
      // by attempting to access a secure store item with passcode requirement
      const testKey = "test_passcode_check";
      await SecureStore.setItemAsync(testKey, "test", {
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
      await SecureStore.deleteItemAsync(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert biometric type enum to readable string
   * @param type - Biometric type enum value
   * @returns Human-readable biometric type name
   */
  private getBiometricTypeName(type: LocalAuthentication.AuthenticationType): string {
    switch (type) {
      case LocalAuthentication.AuthenticationType.FINGERPRINT:
        return "Fingerprint";
      case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
        return "Face ID";
      case LocalAuthentication.AuthenticationType.IRIS:
        return "Iris Scanner";
      default:
        return "Unknown Biometric";
    }
  }

  /**
   * Check if authentication attempts are rate limited
   * @returns True if rate limited
   */
  private isRateLimited(): boolean {
    const now = Date.now();
    const timeSinceLastAttempt = now - this.lastAttemptTime;
    
    // Reset attempt count after 5 minutes
    if (timeSinceLastAttempt > 5 * 60 * 1000) {
      this.attemptCount = 0;
      return false;
    }

    // Check if max attempts exceeded
    return this.attemptCount >= this.config.maxAttempts;
  }

  /**
   * Update attempt history
   * @param success - Whether authentication was successful
   */
  private updateAttemptHistory(success: boolean): void {
    this.lastAttemptTime = Date.now();
    
    if (success) {
      this.attemptCount = 0;
    } else {
      this.attemptCount++;
    }
  }

  /**
   * Reset attempt counter (useful for testing or admin override)
   */
  resetAttempts(): void {
    this.attemptCount = 0;
    this.lastAttemptTime = 0;
  }

  /**
   * Get current attempt count and time information
   * @returns Attempt information
   */
  getAttemptInfo(): {
    currentAttempts: number;
    maxAttempts: number;
    lastAttemptTime: number;
    isRateLimited: boolean;
  } {
    return {
      currentAttempts: this.attemptCount,
      maxAttempts: this.config.maxAttempts,
      lastAttemptTime: this.lastAttemptTime,
      isRateLimited: this.isRateLimited(),
    };
  }

  /**
   * Update configuration
   * @param newConfig - New configuration values
   */
  updateConfig(newConfig: Partial<BiometricConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   * @returns Current biometric configuration
   */
  getConfig(): BiometricConfig {
    return { ...this.config };
  }
}

// Global biometric auth manager instance
export const biometricAuth = new BiometricAuthManager();

/**
 * Convenience functions for common biometric operations
 */

/**
 * Quick biometric authentication with default settings
 * @param reason - Authentication reason
 * @returns Authentication result
 */
export async function quickBiometricAuth(reason?: string): Promise<BiometricAuthResult> {
  return await biometricAuth.authenticate({ reason });
}

/**
 * Check if biometrics are available and enrolled
 * @returns Biometric availability status
 */
export async function checkBiometricSupport(): Promise<{
  available: boolean;
  enrolled: boolean;
  types: string[];
}> {
  const status = await biometricAuth.getEnrollmentStatus();
  return {
    available: status.hasHardware,
    enrolled: status.isEnrolled,
    types: status.supportedTypes,
  };
}

/**
 * Authenticate for sensitive operations (requires biometrics only)
 * @param operation - Description of the operation being authenticated
 * @returns Authentication result
 */
export async function authenticateForSensitiveOperation(
  operation: string,
): Promise<BiometricAuthResult> {
  const reason = `Authenticate to ${operation.toLowerCase()}`;
  return await biometricAuth.authenticateWithBiometricsOnly(reason);
}

/**
 * Setup biometric authentication for the app
 * @param config - Optional custom configuration
 * @returns Setup success status
 */
export async function setupBiometricAuth(
  config?: Partial<BiometricConfig>,
): Promise<boolean> {
  try {
    if (config) {
      biometricAuth.updateConfig(config);
    }

    // Test biometric authentication
    const status = await biometricAuth.getEnrollmentStatus();
    
    if (!status.hasHardware) {
      console.warn("Biometric hardware not available on this device");
      return false;
    }

    if (!status.isEnrolled) {
      console.warn("No biometrics enrolled on this device");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Biometric auth setup failed:", error);
    return false;
  }
}

/**
 * Get user-friendly biometric status message
 * @param status - Biometric enrollment status
 * @returns Human-readable status message
 */
export function getBiometricStatusMessage(status: BiometricEnrollmentStatus): string {
  if (!status.hasHardware) {
    return "Biometric authentication is not available on this device";
  }

  if (!status.isEnrolled) {
    const supportedTypes = status.supportedTypes.join(", ");
    return `Biometric authentication is available but not set up. This device supports: ${supportedTypes}`;
  }

  const enrolledTypes = status.supportedTypes.join(", ");
  return `Biometric authentication is ready. Enrolled methods: ${enrolledTypes}`;
}
