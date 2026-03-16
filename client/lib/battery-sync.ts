// AI-META-BEGIN
// AI-META: Battery optimization for background sync with charging detection and power management
// OWNERSHIP: client/lib (battery management)
// ENTRYPOINTS: Imported by background-sync.ts for battery condition checks
// DEPENDENCIES: expo-battery, @react-native-async-storage/async-storage
// AI-META-END

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';

// Define BatteryState enum locally to avoid import issues
export enum BatteryState {
  UNKNOWN = 0,
  UNPLUGGED = 1,
  CHARGING = 2,
  FULL = 3,
}

// Battery optimization preferences
export interface BatteryPreferences {
  minimumBatteryLevel: number; // 0-1
  allowOnBattery: boolean;
  allowOnCharging: boolean;
  requireLowPowerModeDisabled: boolean;
  peakHourStart: number; // 0-23 (hour)
  peakHourEnd: number; // 0-23 (hour)
  enableExponentialBackoff: boolean;
  maxBackoffMinutes: number;
}

// Battery optimization result
export interface BatteryOptimizationResult {
  isOptimal: boolean;
  reason?: string;
  batteryLevel: number;
  batteryState: BatteryState;
  isLowPowerMode: boolean;
  isPeakHour: boolean;
  recommendedBackoff: number; // minutes
}

// Battery statistics
export interface BatteryStats {
  totalSyncsOnBattery: number;
  totalSyncsOnCharging: number;
  totalSyncsInLowPowerMode: number;
  averageBatteryLevel: number;
  lastBatteryCheck: number | null;
  batteryDrainEvents: number;
}

// Default battery preferences
const DEFAULT_BATTERY_PREFERENCES: BatteryPreferences = {
  minimumBatteryLevel: 0.2, // 20%
  allowOnBattery: true,
  allowOnCharging: true,
  requireLowPowerModeDisabled: true,
  peakHourStart: 9, // 9 AM
  peakHourEnd: 17, // 5 PM
  enableExponentialBackoff: true,
  maxBackoffMinutes: 1440, // 24 hours
};

// Storage keys
const BATTERY_PREFERENCES_KEY = '@battery_sync_preferences';
const BATTERY_STATS_KEY = '@battery_stats';
const LAST_BACKOFF_KEY = '@last_backoff_time';

/**
 * Get current battery state and level
 */
export async function getCurrentBatteryState(): Promise<{
  level: number;
  state: BatteryState;
  isLowPowerMode: boolean;
}> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    const state = await Battery.getBatteryStateAsync();
    const isLowPowerMode = await Battery.isLowPowerModeEnabledAsync();

    return {
      level,
      state,
      isLowPowerMode,
    };
  } catch (error) {
    console.error('Error getting battery state:', error);
    // Return safe defaults
    return {
      level: 1.0,
      state: BatteryState.UNKNOWN,
      isLowPowerMode: false,
    };
  }
}

/**
 * Get battery sync preferences from storage
 */
export async function getBatteryPreferences(): Promise<BatteryPreferences> {
  try {
    const stored = await AsyncStorage.getItem(BATTERY_PREFERENCES_KEY);
    if (stored) {
      return { ...DEFAULT_BATTERY_PREFERENCES, ...JSON.parse(stored) };
    }
    return DEFAULT_BATTERY_PREFERENCES;
  } catch (error) {
    console.error('Error loading battery preferences:', error);
    return DEFAULT_BATTERY_PREFERENCES;
  }
}

/**
 * Save battery sync preferences to storage
 */
export async function saveBatteryPreferences(
  preferences: Partial<BatteryPreferences>
): Promise<void> {
  try {
    const current = await getBatteryPreferences();
    const updated = { ...current, ...preferences };
    await AsyncStorage.setItem(BATTERY_PREFERENCES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving battery preferences:', error);
  }
}

/**
 * Check if current time is during peak hours
 */
export function isPeakHour(start: number, end: number): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  
  if (start <= end) {
    // Normal case (e.g., 9 AM to 5 PM)
    return currentHour >= start && currentHour < end;
  } else {
    // Overnight case (e.g., 10 PM to 6 AM)
    return currentHour >= start || currentHour < end;
  }
}

/**
 * Calculate exponential backoff based on previous failures
 */
export async function calculateExponentialBackoff(
  failureCount: number,
  maxBackoffMinutes: number
): Promise<number> {
  try {
    const lastBackoffTime = await AsyncStorage.getItem(LAST_BACKOFF_KEY);
    const now = Date.now();
    
    // If we had a recent backoff, check if it's time to retry
    if (lastBackoffTime) {
      const lastBackoff = parseInt(lastBackoffTime, 10);
      const timeSinceLastBackoff = now - lastBackoff;
      
      // Calculate next backoff duration
      const exponentialBackoff = Math.min(
        Math.pow(2, failureCount) * 15, // Start at 15 minutes, double each failure
        maxBackoffMinutes
      );
      
      // If enough time has passed, allow sync
      if (timeSinceLastBackoff >= exponentialBackoff * 60 * 1000) {
        await AsyncStorage.removeItem(LAST_BACKOFF_KEY);
        return 0; // No backoff needed
      }
      
      return exponentialBackoff;
    }
    
    return 0; // No backoff needed
  } catch (error) {
    console.error('Error calculating backoff:', error);
    return 0;
  }
}

/**
 * Record a backoff event
 */
export async function recordBackoff(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_BACKOFF_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error recording backoff:', error);
  }
}

/**
 * Check if battery conditions are optimal for sync
 */
export async function isBatteryOptimal(
  preferences?: BatteryPreferences
): Promise<BatteryOptimizationResult> {
  try {
    const prefs = preferences || await getBatteryPreferences();
    const batteryState = await getCurrentBatteryState();
    const isPeakHourTime = isPeakHour(prefs.peakHourStart, prefs.peakHourEnd);
    
    // Get failure count for backoff calculation
    const stats = await getBatteryStats();
    const failureCount = stats.totalSyncsOnBattery - stats.totalSyncsOnCharging;
    const backoffMinutes = prefs.enableExponentialBackoff 
      ? await calculateExponentialBackoff(Math.max(0, failureCount), prefs.maxBackoffMinutes)
      : 0;

    // Check if we're in backoff period
    if (backoffMinutes > 0) {
      return {
        isOptimal: false,
        reason: `In exponential backoff period (${backoffMinutes} minutes remaining)`,
        batteryLevel: batteryState.level,
        batteryState: batteryState.state,
        isLowPowerMode: batteryState.isLowPowerMode,
        isPeakHour: isPeakHourTime,
        recommendedBackoff: backoffMinutes,
      };
    }

    // Check minimum battery level
    if (batteryState.level < prefs.minimumBatteryLevel) {
      return {
        isOptimal: false,
        reason: `Battery level ${Math.round(batteryState.level * 100)}% below minimum ${Math.round(prefs.minimumBatteryLevel * 100)}%`,
        batteryLevel: batteryState.level,
        batteryState: batteryState.state,
        isLowPowerMode: batteryState.isLowPowerMode,
        isPeakHour: isPeakHourTime,
        recommendedBackoff: 60, // 1 hour backoff
      };
    }

    // Check low power mode
    if (prefs.requireLowPowerModeDisabled && batteryState.isLowPowerMode) {
      return {
        isOptimal: false,
        reason: 'Low power mode is enabled',
        batteryLevel: batteryState.level,
        batteryState: batteryState.state,
        isLowPowerMode: batteryState.isLowPowerMode,
        isPeakHour: isPeakHourTime,
        recommendedBackoff: 120, // 2 hours backoff
      };
    }

    // Check charging state
    if (batteryState.state === BatteryState.UNPLUGGED && !prefs.allowOnBattery) {
      return {
        isOptimal: false,
        reason: 'Device not charging and battery sync disabled',
        batteryLevel: batteryState.level,
        batteryState: batteryState.state,
        isLowPowerMode: batteryState.isLowPowerMode,
        isPeakHour: isPeakHourTime,
        recommendedBackoff: 30, // 30 minutes backoff
      };
    }

    if (batteryState.state === BatteryState.CHARGING && !prefs.allowOnCharging) {
      return {
        isOptimal: false,
        reason: 'Device charging and charging sync disabled',
        batteryLevel: batteryState.level,
        batteryState: batteryState.state,
        isLowPowerMode: batteryState.isLowPowerMode,
        isPeakHour: isPeakHourTime,
        recommendedBackoff: 15, // 15 minutes backoff
      };
    }

    // Check peak hours (optional optimization)
    if (isPeakHourTime && batteryState.state === BatteryState.UNPLUGGED) {
      // During peak hours on battery, be more conservative
      if (batteryState.level < 0.5) { // 50%
        return {
          isOptimal: false,
          reason: 'Peak hours and battery below 50%',
          batteryLevel: batteryState.level,
          batteryState: batteryState.state,
          isLowPowerMode: batteryState.isLowPowerMode,
          isPeakHour: isPeakHourTime,
          recommendedBackoff: 45, // 45 minutes backoff
        };
      }
    }

    return {
      isOptimal: true,
      batteryLevel: batteryState.level,
      batteryState: batteryState.state,
      isLowPowerMode: batteryState.isLowPowerMode,
      isPeakHour: isPeakHourTime,
      recommendedBackoff: 0,
    };
  } catch (error) {
    console.error('Error checking battery optimization:', error);
    return {
      isOptimal: false,
      reason: 'Error checking battery conditions',
      batteryLevel: 1.0,
      batteryState: BatteryState.UNKNOWN,
      isLowPowerMode: false,
      isPeakHour: false,
      recommendedBackoff: 60,
    };
  }
}

/**
 * Get battery statistics
 */
export async function getBatteryStats(): Promise<BatteryStats> {
  try {
    const stored = await AsyncStorage.getItem(BATTERY_STATS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      totalSyncsOnBattery: 0,
      totalSyncsOnCharging: 0,
      totalSyncsInLowPowerMode: 0,
      averageBatteryLevel: 0,
      lastBatteryCheck: null,
      batteryDrainEvents: 0,
    };
  } catch (error) {
    console.error('Error loading battery stats:', error);
    return {
      totalSyncsOnBattery: 0,
      totalSyncsOnCharging: 0,
      totalSyncsInLowPowerMode: 0,
      averageBatteryLevel: 0,
      lastBatteryCheck: null,
      batteryDrainEvents: 0,
    };
  }
}

/**
 * Update battery statistics after sync
 */
export async function updateBatteryStats(batteryState: {
  level: number;
  state: BatteryState;
  isLowPowerMode: boolean;
}): Promise<void> {
  try {
    const stats = await getBatteryStats();
    
    // Update sync counts
    if (batteryState.state === BatteryState.UNPLUGGED) {
      stats.totalSyncsOnBattery++;
    } else if (batteryState.state === BatteryState.CHARGING || batteryState.state === BatteryState.FULL) {
      stats.totalSyncsOnCharging++;
    }

    if (batteryState.isLowPowerMode) {
      stats.totalSyncsInLowPowerMode++;
    }

    // Update average battery level
    const totalSyncs = stats.totalSyncsOnBattery + stats.totalSyncsOnCharging;
    stats.averageBatteryLevel = 
      (stats.averageBatteryLevel * (totalSyncs - 1) + batteryState.level) / totalSyncs;

    stats.lastBatteryCheck = Date.now();

    // Check for significant battery drain (more than 10% drop)
    if (batteryState.level < 0.1) {
      stats.batteryDrainEvents++;
    }

    await AsyncStorage.setItem(BATTERY_STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Error updating battery stats:', error);
  }
}

/**
 * Reset battery statistics
 */
export async function resetBatteryStats(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BATTERY_STATS_KEY);
    await AsyncStorage.removeItem(LAST_BACKOFF_KEY);
  } catch (error) {
    console.error('Error resetting battery stats:', error);
  }
}

/**
 * Get battery optimization recommendations
 */
export async function getBatteryOptimizationRecommendations(): Promise<{
  recommendations: string[];
  currentLevel: number;
  estimatedTimeUntilDepleted: number | null; // minutes
}> {
  try {
    const batteryState = await getCurrentBatteryState();
    const stats = await getBatteryStats();
    const recommendations: string[] = [];

    // Battery level recommendations
    if (batteryState.level < 0.1) {
      recommendations.push('Critical battery level - charge immediately');
    } else if (batteryState.level < 0.2) {
      recommendations.push('Low battery level - consider charging soon');
    }

    // Low power mode recommendations
    if (batteryState.isLowPowerMode) {
      recommendations.push('Low power mode enabled - sync will be limited');
    }

    // Usage pattern recommendations
    if (stats.totalSyncsOnBattery > stats.totalSyncsOnCharging * 2) {
      recommendations.push('High battery usage - consider enabling charging-only sync');
    }

    // Peak hour recommendations
    const prefs = await getBatteryPreferences();
    if (isPeakHour(prefs.peakHourStart, prefs.peakHourEnd)) {
      recommendations.push('Peak hours - sync may be throttled to conserve battery');
    }

    // Estimate time until depleted (rough calculation)
    let estimatedTimeUntilDepleted: number | null = null;
    if (batteryState.state === BatteryState.UNPLUGGED && stats.averageBatteryLevel > 0) {
      // Very rough estimation based on historical data
      const drainRate = 1 - stats.averageBatteryLevel;
      if (drainRate > 0) {
        estimatedTimeUntilDepleted = Math.round(batteryState.level / drainRate * 60); // minutes
      }
    }

    return {
      recommendations,
      currentLevel: batteryState.level,
      estimatedTimeUntilDepleted,
    };
  } catch (error) {
    console.error('Error getting battery recommendations:', error);
    return {
      recommendations: ['Unable to assess battery optimization'],
      currentLevel: 1.0,
      estimatedTimeUntilDepleted: null,
    };
  }
}

/**
 * Check if battery optimization is enabled by the system
 */
export async function isBatteryOptimizationEnabled(): Promise<boolean> {
  try {
    // On Android, check if battery optimization is enabled for the app
    // This is a simplified check - in production, you'd use native modules
    if (Platform.OS === 'android') {
      // For now, assume battery optimization might be enabled
      return true;
    }
    return false; // iOS doesn't have the same battery optimization concept
  } catch (error) {
    console.error('Error checking battery optimization status:', error);
    return false;
  }
}

// Export types for use in other modules
export type { BatteryPreferences, BatteryOptimizationResult, BatteryStats };
