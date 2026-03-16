// AI-META-BEGIN
// AI-META: Network-aware sync strategy with WiFi preference and bandwidth adaptation
// OWNERSHIP: client/lib (network operations)
// ENTRYPOINTS: Imported by background-sync.ts for network condition checks
// DEPENDENCIES: @react-native-async-storage/async-storage, react-native NetInfo
// AI-META-END

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Network types and states
export enum NetworkType {
  NONE = 'none',
  CELLULAR = 'cellular',
  WIFI = 'wifi',
  ETHERNET = 'ethernet',
  BLUETOOTH = 'bluetooth',
  WIMAX = 'wimax',
  VPN = 'vpn',
  OTHER = 'other',
}

export enum NetworkQuality {
  POOR = 'poor',      // < 1 Mbps
  FAIR = 'fair',      // 1-5 Mbps
  GOOD = 'good',      // 5-20 Mbps
  EXCELLENT = 'excellent' // > 20 Mbps
}

// Sync preferences for network conditions
export interface NetworkSyncPreferences {
  allowOnCellular: boolean;
  allowOnWiFi: boolean;
  minimumCellularQuality: NetworkQuality;
  minimumWiFiQuality: NetworkQuality;
  maxCellularDataUsage: number; // MB per sync session
  prioritizeWiFi: boolean;
}

// Network state information
export interface NetworkState {
  isConnected: boolean;
  type: NetworkType;
  quality: NetworkQuality;
  isConnectionExpensive: boolean;
  effectiveType: string; // '2g', '3g', '4g', 'wifi', etc.
  downlinkSpeed?: number; // Mbps
  uplinkSpeed?: number; // Mbps
  rtt?: number; // Round trip time in ms
}

// Default network preferences
const DEFAULT_NETWORK_PREFERENCES: NetworkSyncPreferences = {
  allowOnCellular: true,
  allowOnWiFi: true,
  minimumCellularQuality: NetworkQuality.FAIR,
  minimumWiFiQuality: NetworkQuality.POOR,
  maxCellularDataUsage: 50, // 50MB per sync session
  prioritizeWiFi: true,
};

// Storage keys
const NETWORK_PREFERENCES_KEY = '@network_sync_preferences';
const NETWORK_STATS_KEY = '@network_stats';

// Network statistics
export interface NetworkStats {
  totalSyncsOnWiFi: number;
  totalSyncsOnCellular: number;
  totalDataUsed: number; // MB
  averageDownloadSpeed: number; // Mbps
  averageUploadSpeed: number; // Mbps
  lastNetworkTest: number | null;
}

/**
 * Get current network state using native APIs
 * Note: This is a simplified implementation. In production, you'd use @react-native-community/netinfo
 */
export async function getCurrentNetworkState(): Promise<NetworkState> {
  try {
    // For now, we'll use a basic implementation
    // In production, install and configure @react-native-community/netinfo
    let NetInfo;
    try {
      NetInfo = require('@react-native-community/netinfo').default;
    } catch (error) {
      console.warn('NetInfo not available, using fallback network detection');
      return getFallbackNetworkState();
    }
    
    const state = await NetInfo.fetch();
    
    let quality = NetworkQuality.POOR;
    let downlinkSpeed = 0;
    let uplinkSpeed = 0;
    let rtt = 0;

    // Estimate quality based on connection type and effective type
    if (state.details) {
      const { effectiveType, downlink } = state.details;
      
      if (downlink) {
        downlinkSpeed = downlink;
        // Estimate uplink as 1/3 of downlink (typical ratio)
        uplinkSpeed = downlink / 3;
      }

      // Estimate RTT based on effective type
      switch (effectiveType) {
        case '2g':
          rtt = 1200;
          quality = NetworkQuality.POOR;
          break;
        case '3g':
          rtt = 400;
          quality = NetworkQuality.FAIR;
          break;
        case '4g':
          rtt = 100;
          quality = NetworkQuality.GOOD;
          break;
        default:
          if (state.type === 'wifi') {
            rtt = 50;
            quality = NetworkQuality.EXCELLENT;
          }
          break;
      }
    }

    return {
      isConnected: state.isConnected ?? false,
      type: mapNetInfoType(state.type),
      quality,
      isConnectionExpensive: state.isConnectionExpensive ?? false,
      effectiveType: state.details?.effectiveType || 'unknown',
      downlinkSpeed,
      uplinkSpeed,
      rtt,
    };
  } catch (error) {
    console.warn('NetInfo not available, using fallback network detection');
    return getFallbackNetworkState();
  }
}

/**
 * Fallback network detection when NetInfo is not available
 */
function getFallbackNetworkState(): NetworkState {
  // This is a basic fallback - in production, always use NetInfo
  return {
    isConnected: true, // Assume connected for fallback
    type: NetworkType.WIFI, // Assume WiFi for fallback
    quality: NetworkQuality.GOOD,
    isConnectionExpensive: false,
    effectiveType: 'wifi',
    downlinkSpeed: 10,
    uplinkSpeed: 3,
    rtt: 50,
  };
}

/**
 * Map NetInfo type to our NetworkType enum
 */
function mapNetInfoType(netInfoType: string): NetworkType {
  switch (netInfoType) {
    case 'none':
      return NetworkType.NONE;
    case 'cellular':
      return NetworkType.CELLULAR;
    case 'wifi':
      return NetworkType.WIFI;
    case 'ethernet':
      return NetworkType.ETHERNET;
    case 'bluetooth':
      return NetworkType.BLUETOOTH;
    default:
      return NetworkType.OTHER;
  }
}

/**
 * Get network sync preferences from storage
 */
export async function getNetworkSyncPreferences(): Promise<NetworkSyncPreferences> {
  try {
    const stored = await AsyncStorage.getItem(NETWORK_PREFERENCES_KEY);
    if (stored) {
      return { ...DEFAULT_NETWORK_PREFERENCES, ...JSON.parse(stored) };
    }
    return DEFAULT_NETWORK_PREFERENCES;
  } catch (error) {
    console.error('Error loading network preferences:', error);
    return DEFAULT_NETWORK_PREFERENCES;
  }
}

/**
 * Save network sync preferences to storage
 */
export async function saveNetworkSyncPreferences(
  preferences: Partial<NetworkSyncPreferences>
): Promise<void> {
  try {
    const current = await getNetworkSyncPreferences();
    const updated = { ...current, ...preferences };
    await AsyncStorage.setItem(NETWORK_PREFERENCES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving network preferences:', error);
  }
}

/**
 * Check if network conditions are optimal for sync
 */
export async function isNetworkOptimal(
  preferences?: NetworkSyncPreferences
): Promise<{
  isOptimal: boolean;
  reason?: string;
  networkState: NetworkState;
}> {
  try {
    const prefs = preferences || await getNetworkSyncPreferences();
    const networkState = await getCurrentNetworkState();

    // Check if connected
    if (!networkState.isConnected) {
      return {
        isOptimal: false,
        reason: 'No network connection',
        networkState,
      };
    }

    // Check if connection type is allowed
    if (networkState.type === NetworkType.CELLULAR && !prefs.allowOnCellular) {
      return {
        isOptimal: false,
        reason: 'Cellular sync disabled in preferences',
        networkState,
      };
    }

    if (networkState.type === NetworkType.WIFI && !prefs.allowOnWiFi) {
      return {
        isOptimal: false,
        reason: 'WiFi sync disabled in preferences',
        networkState,
      };
    }

    // Check minimum quality requirements
    if (networkState.type === NetworkType.CELLULAR) {
      if (!isQualitySufficient(networkState.quality, prefs.minimumCellularQuality)) {
        return {
          isOptimal: false,
          reason: `Cellular quality ${networkState.quality} below minimum ${prefs.minimumCellularQuality}`,
          networkState,
        };
      }
    }

    if (networkState.type === NetworkType.WIFI) {
      if (!isQualitySufficient(networkState.quality, prefs.minimumWiFiQuality)) {
        return {
          isOptimal: false,
          reason: `WiFi quality ${networkState.quality} below minimum ${prefs.minimumWiFiQuality}`,
          networkState,
        };
      }
    }

    // Check data usage limits for cellular
    if (networkState.type === NetworkType.CELLULAR && networkState.isConnectionExpensive) {
      const stats = await getNetworkStats();
      if (stats.totalDataUsed >= prefs.maxCellularDataUsage) {
        return {
          isOptimal: false,
          reason: `Cellular data limit (${prefs.maxCellularDataUsage}MB) reached`,
          networkState,
        };
      }
    }

    return { isOptimal: true, networkState };
  } catch (error) {
    console.error('Error checking network optimization:', error);
    return {
      isOptimal: false,
      reason: 'Error checking network conditions',
      networkState: getFallbackNetworkState(),
    };
  }
}

/**
 * Check if network quality meets minimum requirements
 */
function isQualitySufficient(
  current: NetworkQuality,
  minimum: NetworkQuality
): boolean {
  const qualityLevels = {
    [NetworkQuality.POOR]: 1,
    [NetworkQuality.FAIR]: 2,
    [NetworkQuality.GOOD]: 3,
    [NetworkQuality.EXCELLENT]: 4,
  };

  return qualityLevels[current] >= qualityLevels[minimum];
}

/**
 * Get network statistics
 */
export async function getNetworkStats(): Promise<NetworkStats> {
  try {
    const stored = await AsyncStorage.getItem(NETWORK_STATS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      totalSyncsOnWiFi: 0,
      totalSyncsOnCellular: 0,
      totalDataUsed: 0,
      averageDownloadSpeed: 0,
      averageUploadSpeed: 0,
      lastNetworkTest: null,
    };
  } catch (error) {
    console.error('Error loading network stats:', error);
    return {
      totalSyncsOnWiFi: 0,
      totalSyncsOnCellular: 0,
      totalDataUsed: 0,
      averageDownloadSpeed: 0,
      averageUploadSpeed: 0,
      lastNetworkTest: null,
    };
  }
}

/**
 * Update network statistics after sync
 */
export async function updateNetworkStats(
  networkState: NetworkState,
  dataUsed: number // MB
): Promise<void> {
  try {
    const stats = await getNetworkStats();
    
    // Update sync counts
    if (networkState.type === NetworkType.WIFI) {
      stats.totalSyncsOnWiFi++;
    } else if (networkState.type === NetworkType.CELLULAR) {
      stats.totalSyncsOnCellular++;
    }

    // Update data usage
    stats.totalDataUsed += dataUsed;

    // Update speed averages
    if (networkState.downlinkSpeed && networkState.uplinkSpeed) {
      const totalSyncs = stats.totalSyncsOnWiFi + stats.totalSyncsOnCellular;
      stats.averageDownloadSpeed = 
        (stats.averageDownloadSpeed * (totalSyncs - 1) + networkState.downlinkSpeed) / totalSyncs;
      stats.averageUploadSpeed = 
        (stats.averageUploadSpeed * (totalSyncs - 1) + networkState.uplinkSpeed) / totalSyncs;
    }

    stats.lastNetworkTest = Date.now();

    await AsyncStorage.setItem(NETWORK_STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Error updating network stats:', error);
  }
}

/**
 * Reset network statistics
 */
export async function resetNetworkStats(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NETWORK_STATS_KEY);
  } catch (error) {
    console.error('Error resetting network stats:', error);
  }
}

/**
 * Estimate bandwidth adaptation parameters based on network conditions
 */
export function getBandwidthAdaptation(networkState: NetworkState): {
  maxConcurrentUploads: number;
  chunkSize: number; // bytes
  timeout: number; // ms
  retryAttempts: number;
} {
  switch (networkState.quality) {
    case NetworkQuality.EXCELLENT:
      return {
        maxConcurrentUploads: 4,
        chunkSize: 1024 * 1024, // 1MB
        timeout: 30000, // 30 seconds
        retryAttempts: 3,
      };
    
    case NetworkQuality.GOOD:
      return {
        maxConcurrentUploads: 3,
        chunkSize: 512 * 1024, // 512KB
        timeout: 45000, // 45 seconds
        retryAttempts: 5,
      };
    
    case NetworkQuality.FAIR:
      return {
        maxConcurrentUploads: 2,
        chunkSize: 256 * 1024, // 256KB
        timeout: 60000, // 60 seconds
        retryAttempts: 7,
      };
    
    case NetworkQuality.POOR:
      return {
        maxConcurrentUploads: 1,
        chunkSize: 128 * 1024, // 128KB
        timeout: 90000, // 90 seconds
        retryAttempts: 10,
      };
    
    default:
      return {
        maxConcurrentUploads: 1,
        chunkSize: 64 * 1024, // 64KB
        timeout: 120000, // 2 minutes
        retryAttempts: 15,
      };
  }
}

/**
 * Check if network is suitable for resume support
 */
export function supportsResume(networkState: NetworkState): boolean {
  // Resume is supported on stable connections (WiFi and good cellular)
  return networkState.type === NetworkType.WIFI || 
         (networkState.type === NetworkType.CELLULAR && 
          networkState.quality >= NetworkQuality.GOOD);
}

// Export types for use in other modules
export type { NetworkSyncPreferences, NetworkState, NetworkStats };
