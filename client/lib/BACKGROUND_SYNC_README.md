# Background Sync Implementation

This document describes the comprehensive background sync system implemented for the Cloud Gallery photo management application.

## Overview

The background sync system provides reliable, efficient, and battery-conscious synchronization of photos and albums between the device and server. It uses modern Expo BackgroundTask APIs with intelligent network and battery optimization.

## Architecture

### Core Components

1. **Background Sync Manager** (`background-sync.ts`)
   - Main orchestration of background tasks
   - Task registration and management
   - Sync statistics tracking

2. **Network-Aware Sync** (`network-sync.ts`)
   - Network state detection and monitoring
   - Bandwidth adaptation algorithms
   - WiFi/cellular preference management

3. **Battery Optimization** (`battery-sync.ts`)
   - Battery level and charging state monitoring
   - Exponential backoff for failures
   - Peak hour throttling

4. **Delta Sync Algorithm** (`delta-sync.ts`)
   - Change detection using checksums
   - Partial upload support
   - Operation queuing and retry logic

5. **Background Task Definition** (`background-task.ts`)
   - Expo BackgroundTask integration
   - Task execution logic
   - Error handling and recovery

6. **Service Layer** (`background-sync-service.ts`)
   - React hooks for UI integration
   - Preference management
   - Statistics and monitoring

## Features

### ✅ Implemented Features

- **Modern Background Tasks**: Uses `expo-background-task` (not deprecated `expo-background-fetch`)
- **Network Awareness**: WiFi preference, cellular limits, quality detection
- **Battery Optimization**: Charging detection, low power mode, exponential backoff
- **Delta Sync**: Efficient change detection, partial uploads, bandwidth adaptation
- **Resume Support**: Interrupted sync can be resumed
- **Statistics Tracking**: Comprehensive sync metrics and monitoring
- **User Preferences**: Configurable sync behavior
- **Error Recovery**: Robust retry mechanisms and failure handling
- **Zero-Knowledge**: Maintains encryption during sync

### 🔧 Configuration Options

#### Network Preferences
```typescript
interface NetworkSyncPreferences {
  allowOnCellular: boolean;
  allowOnWiFi: boolean;
  minimumCellularQuality: NetworkQuality;
  minimumWiFiQuality: NetworkQuality;
  maxCellularDataUsage: number; // MB per sync session
  prioritizeWiFi: boolean;
}
```

#### Battery Preferences
```typescript
interface BatteryPreferences {
  minimumBatteryLevel: number; // 0-1
  allowOnBattery: boolean;
  allowOnCharging: boolean;
  requireLowPowerModeDisabled: boolean;
  peakHourStart: number; // 0-23 (hour)
  peakHourEnd: number; // 0-23 (hour)
  enableExponentialBackoff: boolean;
  maxBackoffMinutes: number;
}
```

#### Background Sync Configuration
```typescript
interface BackgroundSyncConfig {
  minimumInterval: number; // minutes
  requiresNetworkConnectivity: boolean;
  requiresCharging: boolean;
  requiresBatteryNotLow: boolean;
  stopOnTerminate: boolean; // Android only
  startOnBoot: boolean; // Android only
}
```

## Usage

### Basic Setup

The background sync system is automatically initialized when the app starts via `App.tsx`:

```typescript
import { initializeAppBackgroundSync } from "@/lib/background-sync-service";

useEffect(() => {
  initializeAppBackgroundSync().catch(error => {
    console.error('Failed to initialize background sync:', error);
  });
}, []);
```

### Using React Hooks

#### Background Sync Management
```typescript
import { useBackgroundSync } from '@/lib/background-sync-service';

function SyncSettings() {
  const {
    isRegistered,
    isAvailable,
    syncStats,
    enableBackgroundSync,
    disableBackgroundSync,
    triggerTestSync,
  } = useBackgroundSync();

  return (
    <View>
      <Text>Background Sync: {isRegistered ? 'Enabled' : 'Disabled'}</Text>
      <Button 
        title={isRegistered ? 'Disable' : 'Enable'}
        onPress={() => isRegistered ? disableBackgroundSync() : enableBackgroundSync()}
      />
      <Button title="Test Sync" onPress={triggerTestSync} />
    </View>
  );
}
```

#### Network Preferences
```typescript
import { useNetworkSyncPreferences } from '@/lib/background-sync-service';

function NetworkSettings() {
  const { preferences, updatePreferences } = useNetworkSyncPreferences();

  return (
    <View>
      <Switch
        value={preferences?.allowOnCellular}
        onValueChange={(value) => updatePreferences({ allowOnCellular: value })}
      />
      <Text>Allow sync on cellular</Text>
    </View>
  );
}
```

#### Battery Preferences
```typescript
import { useBatterySyncPreferences } from '@/lib/background-sync-service';

function BatterySettings() {
  const { preferences, recommendations, updatePreferences } = useBatterySyncPreferences();

  return (
    <View>
      <Text>Current battery level: {recommendations?.currentLevel}%</Text>
      {recommendations?.recommendations.map(rec => (
        <Text key={rec}>{rec}</Text>
      ))}
    </View>
  );
}
```

### Direct Service Usage

```typescript
import { backgroundSyncService } from '@/lib/background-sync-service';

// Enable background sync
await backgroundSyncService.enable({
  minimumInterval: 30, // 30 minutes
});

// Get sync statistics
const stats = await backgroundSyncService.getStatistics();

// Update network preferences
await backgroundSyncService.updateNetworkPreferences({
  allowOnCellular: false,
  maxCellularDataUsage: 25,
});
```

## Testing

### Running Tests

```bash
# Run all background sync tests
npm test client/lib/background-sync.test.ts

# Run tests with coverage
npm run test:coverage client/lib/background-sync.test.ts
```

### Test Coverage

The test suite covers:
- Background task registration and management
- Network condition detection and optimization
- Battery monitoring and optimization
- Delta sync algorithms and change detection
- Integration scenarios and error handling
- Statistics tracking and preference management

## Performance Considerations

### Battery Optimization
- **Exponential Backoff**: Failed syncs trigger increasing delays (15min → 30min → 1hr → 2hr...)
- **Peak Hour Throttling**: Reduced sync activity during 9 AM - 5 PM when on battery
- **Battery Level Thresholds**: Minimum 20% battery required by default
- **Low Power Mode Detection**: Automatically pauses sync when low power mode is enabled

### Network Optimization
- **Bandwidth Adaptation**: Upload chunk sizes and concurrency based on connection quality
- **WiFi Preference**: Prioritizes WiFi connections when available
- **Data Usage Limits**: Configurable cellular data limits (default: 50MB per session)
- **Resume Support**: Interrupted uploads can be resumed on stable connections

### Sync Efficiency
- **Delta Sync**: Only syncs changed entities using checksum comparison
- **Batch Processing**: Processes operations in configurable batch sizes (default: 10)
- **Compression**: Photo data is efficiently compressed for transfer
- **Concurrent Operations**: Multiple uploads based on network capabilities

## Security & Privacy

### Zero-Knowledge Architecture
- **Client-Side Encryption**: All data remains encrypted during sync
- **No Plaintext Transfer**: Server never sees unencrypted content
- **Metadata Protection**: Even metadata is encrypted when stored server-side

### Data Integrity
- **Checksum Verification**: All entities verified with SHA-256 checksums
- **Operation Logging**: All sync operations tracked for audit trails
- **Conflict Resolution**: Intelligent handling of concurrent modifications

## Platform-Specific Notes

### iOS
- **Background Task Limits**: iOS imposes strict limits on background execution time
- **Background App Refresh**: User must enable Background App Refresh in Settings
- **Battery Optimization**: iOS handles battery optimization automatically

### Android
- **Doze Mode**: Android's Doze mode can affect background task execution
- **Battery Optimization**: Users may need to disable battery optimization for the app
- **Start on Boot**: Background sync can resume after device reboot

## Troubleshooting

### Common Issues

1. **Background Sync Not Running**
   - Check if background tasks are available on the device
   - Verify app has necessary permissions
   - Ensure Background App Refresh is enabled (iOS)

2. **High Battery Usage**
   - Check sync preferences - reduce minimum interval
   - Enable WiFi-only mode
   - Adjust peak hour settings

3. **High Data Usage**
   - Reduce cellular data limits
   - Enable WiFi-only mode
   - Check for large photo uploads

4. **Sync Failures**
   - Check network connectivity
   - Verify server availability
   - Review sync statistics for error patterns

### Debug Tools

```typescript
// Enable debug logging
import { backgroundSyncService } from '@/lib/background-sync-service';

// Get detailed statistics
const stats = await backgroundSyncService.getStatistics();
console.log('Sync stats:', stats);

// Trigger test sync
await backgroundSyncService.triggerTest();

// Check network conditions
const networkPrefs = await backgroundSyncService.getNetworkPreferences();
console.log('Network prefs:', networkPrefs);
```

## Future Enhancements

### Planned Features
- **Adaptive Sync**: Machine learning for optimal sync timing
- **Smart Retry**: Context-aware retry strategies
- **Compression**: Advanced photo compression algorithms
- **Batch Upload**: Multi-photo upload optimization
- **Real-time Sync**: WebSocket-based immediate sync when possible

### Performance Improvements
- **Background Processing**: Use of native background processing
- **Incremental Sync**: More granular change detection
- **Predictive Upload**: Pre-upload likely-to-be-shared photos
- **Network Prediction**: Anticipate network conditions

## API Reference

### Background Sync Service

```typescript
class BackgroundSyncService {
  async initialize(): Promise<void>
  async enable(config?: BackgroundSyncConfig): Promise<boolean>
  async disable(): Promise<void>
  async isEnabled(): Promise<boolean>
  async getStatus(): Promise<BackgroundTaskStatus>
  async getStatistics(): Promise<SyncStats>
  async triggerTest(): Promise<void>
  async getNetworkPreferences(): Promise<NetworkSyncPreferences>
  async updateNetworkPreferences(preferences: Partial<NetworkSyncPreferences>): Promise<void>
  async getBatteryPreferences(): Promise<BatteryPreferences>
  async updateBatteryPreferences(preferences: Partial<BatteryPreferences>): Promise<void>
  async getSyncStatistics(): Promise<SyncStatistics>
  async retryFailedOperations(): Promise<DeltaSyncResult>
  async clearSyncState(): Promise<void>
}
```

### React Hooks

```typescript
function useBackgroundSync(): BackgroundSyncHook
function useNetworkSyncPreferences(): NetworkPreferencesHook
function useBatterySyncPreferences(): BatteryPreferencesHook
function useSyncOperations(): SyncOperationsHook
```

## Dependencies

### Required Packages
- `expo-background-task`: Modern background task API
- `expo-battery`: Battery state monitoring
- `expo-task-manager`: Task management and registration
- `@react-native-community/netinfo`: Network state detection
- `@react-native-async-storage/async-storage`: Local storage

### Optional (for enhanced functionality)
- `@react-native-async-storage/async-storage`: Already included
- `crypto-js`: For checksum calculation (already included)

## License

This background sync implementation is part of the Cloud Gallery project and follows the same licensing terms.

---

**Last Updated**: March 2026  
**Version**: 1.0.0  
**Compatibility**: Expo SDK 54, React Native 0.81.5
