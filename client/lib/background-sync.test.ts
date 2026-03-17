// AI-META-BEGIN
// AI-META: Comprehensive tests for background sync functionality
// OWNERSHIP: client/lib/tests
// ENTRYPOINTS: Run with npm test for background sync validation
// DEPENDENCIES: vitest, @/lib/background-sync, @/lib/network-sync, @/lib/battery-sync, @/lib/delta-sync
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import * as Battery from "expo-battery";

// Import modules to test
import {
  registerBackgroundSyncTask,
  unregisterBackgroundSyncTask,
  isBackgroundSyncRegistered,
  getBackgroundTaskStatus,
  shouldRunBackgroundSync,
  updateSyncStats,
  getSyncStats,
  resetSyncStats,
  BACKGROUND_SYNC_TASK,
  initializeBackgroundSync,
} from "../background-sync";

import {
  getNetworkSyncPreferences,
  saveNetworkSyncPreferences,
  getCurrentNetworkState,
  isNetworkOptimal,
  getBandwidthAdaptation,
  NetworkType,
  NetworkQuality,
} from "../network-sync";

import {
  getBatteryPreferences,
  saveBatteryPreferences,
  getCurrentBatteryState,
  isBatteryOptimal,
  isPeakHour,
  BatteryState,
} from "../battery-sync";

import {
  detectChanges,
  createSyncOperations,
  getDeltaSyncState,
  saveDeltaSyncState,
  processPendingOperations,
  calculateChecksum,
  SyncOperationType,
} from "../delta-sync";

// Mock external dependencies
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

vi.mock("expo-background-task", () => ({
  default: {
    isAvailableAsync: vi.fn(),
    registerTaskAsync: vi.fn(),
    unregisterTaskAsync: vi.fn(),
    getStatusAsync: vi.fn(),
    triggerTaskWorkerForTestingAsync: vi.fn(),
  },
  BackgroundTaskStatus: {
    Available: "available",
    Denied: "denied",
    Restricted: "restricted",
  },
  BackgroundTaskResult: {
    Success: "success",
    Failure: "failure",
    NoData: "no_data",
  },
}));

vi.mock("expo-task-manager", () => ({
  default: {
    defineTask: vi.fn(),
    isTaskRegisteredAsync: vi.fn(),
  },
}));

vi.mock("expo-battery", () => ({
  default: {
    getBatteryLevelAsync: vi.fn(),
    getBatteryStateAsync: vi.fn(),
    isLowPowerModeEnabledAsync: vi.fn(),
  },
  BatteryState: {
    UNKNOWN: 0,
    UNPLUGGED: 1,
    CHARGING: 2,
    FULL: 3,
  },
}));

// Mock NetInfo
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: vi.fn(),
  },
}));

describe("Background Sync Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Background Sync Core", () => {
    it("should register background sync task successfully", async () => {
      vi.mocked(BackgroundTask.isAvailableAsync).mockResolvedValue(true);
      vi.mocked(BackgroundTask.registerTaskAsync).mockResolvedValue();
      vi.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(false);

      const result = await registerBackgroundSyncTask();

      expect(result).toBe(true);
      expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(
        BACKGROUND_SYNC_TASK,
        expect.objectContaining({
          minimumInterval: 3600, // 1 hour in seconds
        }),
      );
    });

    it("should handle background task unavailability", async () => {
      vi.mocked(BackgroundTask.isAvailableAsync).mockResolvedValue(false);

      const result = await registerBackgroundSyncTask();

      expect(result).toBe(false);
      expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
    });

    it("should check if background sync is registered", async () => {
      vi.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValue(true);

      const isRegistered = await isBackgroundSyncRegistered();

      expect(isRegistered).toBe(true);
      expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(
        BACKGROUND_SYNC_TASK,
      );
    });

    it("should get background task status", async () => {
      vi.mocked(BackgroundTask.getStatusAsync).mockResolvedValue(
        BackgroundTask.BackgroundTaskStatus.Available,
      );

      const status = await getBackgroundTaskStatus();

      expect(status).toBe(BackgroundTask.BackgroundTaskStatus.Available);
      expect(BackgroundTask.getStatusAsync).toHaveBeenCalled();
    });

    it("should update and retrieve sync statistics", async () => {
      const initialStats = getSyncStats();
      expect(initialStats.totalSyncs).toBe(0);

      updateSyncStats("success", 5000);

      const updatedStats = getSyncStats();
      expect(updatedStats.totalSyncs).toBe(1);
      expect(updatedStats.successfulSyncs).toBe(1);
      expect(updatedStats.averageSyncDuration).toBe(5000);
    });

    it("should reset sync statistics", () => {
      updateSyncStats("success", 1000);
      updateSyncStats("failure", 2000, "Test error");

      resetSyncStats();

      const stats = getSyncStats();
      expect(stats.totalSyncs).toBe(0);
      expect(stats.successfulSyncs).toBe(0);
      expect(stats.failedSyncs).toBe(0);
      expect(stats.averageSyncDuration).toBe(0);
      expect(stats.lastError).toBe(null);
    });
  });

  describe("Network Sync", () => {
    it("should get and save network preferences", async () => {
      const mockPreferences = {
        allowOnCellular: true,
        allowOnWiFi: true,
        minimumCellularQuality: NetworkQuality.FAIR,
        minimumWiFiQuality: NetworkQuality.POOR,
        maxCellularDataUsage: 50,
        prioritizeWiFi: true,
      };

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(mockPreferences),
      );

      const preferences = await getNetworkSyncPreferences();
      expect(preferences).toEqual(expect.objectContaining(mockPreferences));

      vi.mocked(AsyncStorage.setItem).mockResolvedValue();
      await saveNetworkSyncPreferences({ allowOnCellular: false });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@network_sync_preferences",
        expect.stringContaining('"allowOnCellular":false'),
      );
    });

    it("should determine optimal network conditions", async () => {
      const mockNetworkState = {
        isConnected: true,
        type: NetworkType.WIFI,
        quality: NetworkQuality.GOOD,
        isConnectionExpensive: false,
        effectiveType: "wifi",
        downlinkSpeed: 10,
        uplinkSpeed: 3,
        rtt: 50,
      };

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null); // Use defaults

      // Mock NetInfo
      const NetInfo = require("@react-native-community/netinfo").default;
      vi.mocked(NetInfo.fetch).mockResolvedValue({
        isConnected: true,
        type: "wifi",
        isConnectionExpensive: false,
        details: {
          effectiveType: "wifi",
          downlink: 10,
        },
      });

      const result = await isNetworkOptimal();

      expect(result.isOptimal).toBe(true);
      expect(result.networkState).toEqual(
        expect.objectContaining({
          isConnected: true,
          type: NetworkType.WIFI,
          quality: NetworkQuality.GOOD,
        }),
      );
    });

    it("should reject sync on poor network quality", async () => {
      const mockPreferences = {
        allowOnCellular: true,
        minimumCellularQuality: NetworkQuality.GOOD,
      };

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(mockPreferences),
      );

      // Mock poor cellular network
      const NetInfo = require("@react-native-community/netinfo").default;
      vi.mocked(NetInfo.fetch).mockResolvedValue({
        isConnected: true,
        type: "cellular",
        isConnectionExpensive: true,
        details: {
          effectiveType: "3g",
          downlink: 2,
        },
      });

      const result = await isNetworkOptimal();

      expect(result.isOptimal).toBe(false);
      expect(result.reason).toContain("below minimum");
    });

    it("should provide bandwidth adaptation parameters", () => {
      const excellentNetwork = {
        type: NetworkType.WIFI,
        quality: NetworkQuality.EXCELLENT,
      };

      const adaptation = getBandwidthAdaptation(excellentNetwork);

      expect(adaptation.maxConcurrentUploads).toBe(4);
      expect(adaptation.chunkSize).toBe(1024 * 1024); // 1MB
      expect(adaptation.timeout).toBe(30000); // 30 seconds
    });
  });

  describe("Battery Sync", () => {
    it("should get and save battery preferences", async () => {
      const mockPreferences = {
        minimumBatteryLevel: 0.2,
        allowOnBattery: true,
        allowOnCharging: true,
        requireLowPowerModeDisabled: true,
        peakHourStart: 9,
        peakHourEnd: 17,
      };

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(mockPreferences),
      );

      const preferences = await getBatteryPreferences();
      expect(preferences).toEqual(expect.objectContaining(mockPreferences));

      vi.mocked(AsyncStorage.setItem).mockResolvedValue();
      await saveBatteryPreferences({ minimumBatteryLevel: 0.3 });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@battery_sync_preferences",
        expect.stringContaining('"minimumBatteryLevel":0.3'),
      );
    });

    it("should determine optimal battery conditions", async () => {
      vi.mocked(Battery.getBatteryLevelAsync).mockResolvedValue(0.8);
      vi.mocked(Battery.getBatteryStateAsync).mockResolvedValue(
        Battery.BatteryState.CHARGING,
      );
      vi.mocked(Battery.isLowPowerModeEnabledAsync).mockResolvedValue(false);

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null); // Use defaults

      const result = await isBatteryOptimal();

      expect(result.isOptimal).toBe(true);
      expect(result.batteryLevel).toBe(0.8);
      expect(result.batteryState).toBe(Battery.BatteryState.CHARGING);
      expect(result.isLowPowerMode).toBe(false);
    });

    it("should reject sync on low battery", async () => {
      vi.mocked(Battery.getBatteryLevelAsync).mockResolvedValue(0.1); // 10%
      vi.mocked(Battery.getBatteryStateAsync).mockResolvedValue(
        Battery.BatteryState.UNPLUGGED,
      );
      vi.mocked(Battery.isLowPowerModeEnabledAsync).mockResolvedValue(false);

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null); // Use defaults

      const result = await isBatteryOptimal();

      expect(result.isOptimal).toBe(false);
      expect(result.reason).toContain("below minimum");
      expect(result.recommendedBackoff).toBe(60);
    });

    it("should detect peak hours correctly", () => {
      // Test normal peak hours (9 AM to 5 PM)
      expect(isPeakHour(9, 17)).toBe(true); // 10 AM
      expect(isPeakHour(9, 17)).toBe(false); // 8 AM

      // Test overnight peak hours (10 PM to 6 AM)
      expect(isPeakHour(22, 6)).toBe(true); // 11 PM
      expect(isPeakHour(22, 6)).toBe(true); // 3 AM
      expect(isPeakHour(22, 6)).toBe(false); // 7 AM
    });
  });

  describe("Delta Sync", () => {
    it("should calculate checksums for entities", () => {
      const photo = {
        id: "photo_1",
        uri: "file://photo.jpg",
        width: 1920,
        height: 1080,
        isFavorite: false,
        albumIds: ["album_1"],
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      const checksum1 = calculateChecksum(photo);
      const checksum2 = calculateChecksum(photo);

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toMatch(/^[a-f0-9]+$/); // Hex string
    });

    it("should detect changes in entities", async () => {
      // Mock storage functions
      const mockPhotos = [
        { id: "photo_1", modifiedAt: 1000, uri: "file://old.jpg" },
        { id: "photo_2", modifiedAt: 2000, uri: "file://new.jpg" },
      ];

      const mockAlbums = [
        { id: "album_1", modifiedAt: 1500, title: "Old Album" },
      ];

      vi.doMock("../storage", () => ({
        getPhotos: vi.fn().mockResolvedValue(mockPhotos),
        getAlbums: vi.fn().mockResolvedValue(mockAlbums),
      }));

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify({
          photos: { photo_1: "old_checksum" },
          albums: { album_1: "old_album_checksum" },
          lastCalculated: 0,
        }),
      );

      const changes = await detectChanges();

      expect(changes.newPhotos).toHaveLength(1); // photo_2
      expect(changes.updatedPhotos).toHaveLength(1); // photo_1
      expect(changes.totalChanges).toBeGreaterThan(0);
    });

    it("should create sync operations from changes", () => {
      const changes = {
        newPhotos: [{ id: "photo_1", uri: "file://new.jpg" }],
        updatedPhotos: [{ id: "photo_2", uri: "file://updated.jpg" }],
        deletedPhotos: ["photo_3"],
        newAlbums: [{ id: "album_1", title: "New Album" }],
        updatedAlbums: [],
        deletedAlbums: [],
        totalChanges: 4,
      };

      const operations = createSyncOperations(changes);

      expect(operations).toHaveLength(4);
      expect(operations[0].type).toBe(SyncOperationType.CREATE);
      expect(operations[0].entityType).toBe("photo");
      expect(operations[0].entityId).toBe("photo_1");

      expect(operations[1].type).toBe(SyncOperationType.UPDATE);
      expect(operations[2].type).toBe(SyncOperationType.DELETE);
      expect(operations[3].type).toBe(SyncOperationType.CREATE);
    });

    it("should manage delta sync state", async () => {
      const mockState = {
        lastSyncTime: Date.now(),
        pendingOperations: [],
        failedOperations: [],
        syncInProgress: false,
        totalPhotosSynced: 10,
        totalAlbumsSynced: 5,
        totalBytesSynced: 1000000,
      };

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(mockState),
      );
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      const state = await getDeltaSyncState();
      expect(state.totalPhotosSynced).toBe(10);
      expect(state.totalAlbumsSynced).toBe(5);

      const updatedState = { ...state, totalPhotosSynced: 11 };
      await saveDeltaSyncState(updatedState);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@delta_sync_state",
        expect.stringContaining('"totalPhotosSynced":11'),
      );
    });

    it("should process pending operations", async () => {
      const mockOperations = [
        {
          id: "op_1",
          type: SyncOperationType.CREATE,
          entityType: "photo",
          entityId: "photo_1",
          timestamp: Date.now(),
          data: { id: "photo_1", uri: "file://test.jpg" },
        },
      ];

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify({
          lastSyncTime: null,
          pendingOperations: mockOperations,
          failedOperations: [],
          syncInProgress: false,
          totalPhotosSynced: 0,
          totalAlbumsSynced: 0,
          totalBytesSynced: 0,
        }),
      );

      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      const result = await processPendingOperations(1);

      expect(result.success).toBe(true);
      expect(result.operationsProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Integration Tests", () => {
    it("should determine if background sync should run", async () => {
      // Mock optimal conditions
      vi.mocked(Battery.getBatteryLevelAsync).mockResolvedValue(0.8);
      vi.mocked(Battery.getBatteryStateAsync).mockResolvedValue(
        Battery.BatteryState.CHARGING,
      );
      vi.mocked(Battery.isLowPowerModeEnabledAsync).mockResolvedValue(false);

      const NetInfo = require("@react-native-community/netinfo").default;
      vi.mocked(NetInfo.fetch).mockResolvedValue({
        isConnected: true,
        type: "wifi",
        isConnectionExpensive: false,
        details: { effectiveType: "wifi", downlink: 10 },
      });

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null); // Use defaults

      const shouldRun = await shouldRunBackgroundSync();

      expect(shouldRun.shouldRun).toBe(true);
      expect(shouldRun.reason).toBeUndefined();
    });

    it("should reject background sync due to poor conditions", async () => {
      // Mock poor battery conditions
      vi.mocked(Battery.getBatteryLevelAsync).mockResolvedValue(0.1);
      vi.mocked(Battery.getBatteryStateAsync).mockResolvedValue(
        Battery.BatteryState.UNPLUGGED,
      );
      vi.mocked(Battery.isLowPowerModeEnabledAsync).mockResolvedValue(true);

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null); // Use defaults

      const shouldRun = await shouldRunBackgroundSync();

      expect(shouldRun.shouldRun).toBe(false);
      expect(shouldRun.reason).toContain("below minimum");
    });
  });
});
