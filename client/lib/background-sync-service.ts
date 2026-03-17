// AI-META-BEGIN
// AI-META: Background sync service for managing sync operations and user preferences
// OWNERSHIP: client/lib (sync management)
// ENTRYPOINTS: Imported by App.tsx for sync initialization and by screens for sync controls
// DEPENDENCIES: @/lib/background-sync, @/lib/network-sync, @/lib/battery-sync, @/lib/delta-sync
// AI-META-END

import { useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  initializeBackgroundSync,
  registerBackgroundSyncTask,
  unregisterBackgroundSyncTask,
  isBackgroundSyncRegistered,
  getBackgroundTaskStatus,
  getSyncStats,
  triggerBackgroundSyncForTesting,
  BACKGROUND_SYNC_TASK,
} from "./background-sync";
import {
  getNetworkSyncPreferences,
  saveNetworkSyncPreferences,
  getNetworkStats,
  resetNetworkStats,
} from "./network-sync";
import {
  getBatteryPreferences,
  saveBatteryPreferences,
  getBatteryStats,
  resetBatteryStats,
  getBatteryOptimizationRecommendations,
} from "./battery-sync";
import {
  getSyncStatistics,
  retryFailedOperations,
  clearSyncState,
} from "./delta-sync";

// Background sync service hooks and utilities

/**
 * Hook for managing background sync
 */
export function useBackgroundSync() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [syncStats, setSyncStats] = useState(getSyncStats());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeSync();
  }, []);

  const initializeSync = async () => {
    try {
      setIsLoading(true);

      // Initialize background sync
      await initializeBackgroundSync();

      // Check registration status
      const registered = await isBackgroundSyncRegistered();
      setIsRegistered(registered);

      // Check availability
      const { isAvailable } = await import("expo-background-task");
      setIsAvailable(isAvailable);

      // Update stats
      setSyncStats(getSyncStats());
    } catch (error) {
      console.error("Error initializing background sync:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const enableBackgroundSync = async (config?: any) => {
    try {
      const success = await registerBackgroundSyncTask(config);
      if (success) {
        setIsRegistered(true);
      }
      return success;
    } catch (error) {
      console.error("Error enabling background sync:", error);
      return false;
    }
  };

  const disableBackgroundSync = async () => {
    try {
      await unregisterBackgroundSyncTask();
      setIsRegistered(false);
    } catch (error) {
      console.error("Error disabling background sync:", error);
    }
  };

  const refreshStats = () => {
    setSyncStats(getSyncStats());
  };

  const triggerTestSync = async () => {
    try {
      await triggerBackgroundSyncForTesting();
      // Refresh stats after a delay
      setTimeout(refreshStats, 2000);
    } catch (error) {
      console.error("Error triggering test sync:", error);
    }
  };

  return {
    isRegistered,
    isAvailable,
    syncStats,
    isLoading,
    enableBackgroundSync,
    disableBackgroundSync,
    refreshStats,
    triggerTestSync,
  };
}

/**
 * Hook for managing network sync preferences
 */
export function useNetworkSyncPreferences() {
  const [preferences, setPreferences] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const [prefs, networkStats] = await Promise.all([
        getNetworkSyncPreferences(),
        getNetworkStats(),
      ]);
      setPreferences(prefs);
      setStats(networkStats);
    } catch (error) {
      console.error("Error loading network preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (newPreferences: any) => {
    try {
      await saveNetworkSyncPreferences(newPreferences);
      setPreferences({ ...preferences, ...newPreferences });
    } catch (error) {
      console.error("Error updating network preferences:", error);
    }
  };

  const resetStats = async () => {
    try {
      await resetNetworkStats();
      setStats(null);
    } catch (error) {
      console.error("Error resetting network stats:", error);
    }
  };

  return {
    preferences,
    stats,
    isLoading,
    updatePreferences,
    resetStats,
    refresh: loadPreferences,
  };
}

/**
 * Hook for managing battery sync preferences
 */
export function useBatterySyncPreferences() {
  const [preferences, setPreferences] = useState(null);
  const [stats, setStats] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const [prefs, batteryStats, recs] = await Promise.all([
        getBatteryPreferences(),
        getBatteryStats(),
        getBatteryOptimizationRecommendations(),
      ]);
      setPreferences(prefs);
      setStats(batteryStats);
      setRecommendations(recs);
    } catch (error) {
      console.error("Error loading battery preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (newPreferences: any) => {
    try {
      await saveBatteryPreferences(newPreferences);
      setPreferences({ ...preferences, ...newPreferences });
    } catch (error) {
      console.error("Error updating battery preferences:", error);
    }
  };

  const resetStats = async () => {
    try {
      await resetBatteryStats();
      setStats(null);
    } catch (error) {
      console.error("Error resetting battery stats:", error);
    }
  };

  return {
    preferences,
    stats,
    recommendations,
    isLoading,
    updatePreferences,
    resetStats,
    refresh: loadPreferences,
  };
}

/**
 * Hook for managing sync operations
 */
export function useSyncOperations() {
  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setIsLoading(true);
      const stats = await getSyncStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error("Error loading sync statistics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const retryFailed = async () => {
    try {
      const result = await retryFailedOperations();
      await loadStatistics(); // Refresh statistics
      return result;
    } catch (error) {
      console.error("Error retrying failed operations:", error);
      return null;
    }
  };

  const clearAll = async () => {
    try {
      await clearSyncState();
      await loadStatistics(); // Refresh statistics
    } catch (error) {
      console.error("Error clearing sync state:", error);
    }
  };

  return {
    statistics,
    isLoading,
    retryFailed,
    clearAll,
    refresh: loadStatistics,
  };
}

/**
 * Background sync service class for advanced usage
 */
export class BackgroundSyncService {
  private static instance: BackgroundSyncService;

  static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  async initialize(): Promise<void> {
    await initializeBackgroundSync();
  }

  async enable(config?: any): Promise<boolean> {
    return await registerBackgroundSyncTask(config);
  }

  async disable(): Promise<void> {
    await unregisterBackgroundSyncTask();
  }

  async isEnabled(): Promise<boolean> {
    return await isBackgroundSyncRegistered();
  }

  async getStatus(): Promise<any> {
    return await getBackgroundTaskStatus();
  }

  async getStatistics(): Promise<any> {
    return getSyncStats();
  }

  async triggerTest(): Promise<void> {
    await triggerBackgroundSyncForTesting();
  }

  async getNetworkPreferences(): Promise<any> {
    return await getNetworkSyncPreferences();
  }

  async updateNetworkPreferences(preferences: any): Promise<void> {
    await saveNetworkSyncPreferences(preferences);
  }

  async getBatteryPreferences(): Promise<any> {
    return await getBatteryPreferences();
  }

  async updateBatteryPreferences(preferences: any): Promise<void> {
    await saveBatteryPreferences(preferences);
  }

  async getSyncStatistics(): Promise<any> {
    return await getSyncStatistics();
  }

  async retryFailedOperations(): Promise<any> {
    return await retryFailedOperations();
  }

  async clearSyncState(): Promise<void> {
    await clearSyncState();
  }
}

/**
 * Initialize background sync when app starts
 */
export async function initializeAppBackgroundSync(): Promise<void> {
  try {
    console.log("Initializing app background sync...");

    // Initialize the background sync system
    await initializeBackgroundSync();

    // Check if background tasks are available on this platform
    if (Platform.OS === "ios" || Platform.OS === "android") {
      const { isAvailable } = await import("expo-background-task");

      if (!isAvailable) {
        console.warn("Background tasks are not available on this device");
        return;
      }

      // Check if already registered
      const isRegistered = await isBackgroundSyncRegistered();
      if (isRegistered) {
        console.log("Background sync already registered");
      } else {
        console.log("Background sync not registered - user needs to enable it");
      }
    } else {
      console.log("Background sync not supported on this platform");
    }

    console.log("App background sync initialization completed");
  } catch (error) {
    console.error("Error initializing app background sync:", error);
  }
}

/**
 * Export singleton instance
 */
export const backgroundSyncService = BackgroundSyncService.getInstance();
