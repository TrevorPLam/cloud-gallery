// AI-META-BEGIN
// AI-META: Sync settings screen UI with device management, sync status, and conflict resolution
// OWNERSHIP: client/screens
// ENTRYPOINTS: navigation from settings or main app
// DEPENDENCIES: react-native, @tanstack/react-query, expo-constants
// DANGER: Device deletion = sync disruption; sync errors = data inconsistency; UI errors = poor UX
// CHANGE-SAFETY: Maintain React Query patterns, error handling, and accessibility standards
// TESTS: Component tests for UI interactions, error handling, and accessibility
// AI-META-END

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  FlatList,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../constants/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { formatDistanceToNow } from "date-fns";

// Types
interface Device {
  id: string;
  userId: string;
  deviceId: string;
  deviceType: "phone" | "tablet" | "web" | "desktop";
  deviceName: string;
  isActive: boolean;
  lastSyncAt?: string;
  appVersion?: string;
  storageUsed?: number;
  createdAt: string;
  updatedAt: string;
}

interface SyncStatus {
  deviceId: string;
  userId: string;
  lastSyncAt?: string;
  pendingOperations: number;
  conflicts: number;
  lastError?: string;
  syncInProgress: boolean;
}

interface SyncStats {
  totalDevices: number;
  activeDevices: number;
  devicesWithSync: number;
  lastSync?: string;
  totalSyncOperations: number;
  averageSyncOpsPerDevice: number;
}

interface ConflictResolution {
  conflictId: string;
  strategy: "last_write_wins" | "merge" | "manual" | "server_wins" | "client_wins";
  resolution?: any;
}

// API functions
const api = {
  async getDevices(): Promise<Device[]> {
    const response = await fetch("/api/sync/devices", {
      headers: {
        "Authorization": `Bearer ${await getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to get devices");
    }
    
    const data = await response.json();
    return data.devices;
  },

  async getSyncStatus(): Promise<SyncStatus> {
    const deviceId = await getDeviceId();
    const response = await fetch("/api/sync/status", {
      headers: {
        "Authorization": `Bearer ${await getToken()}`,
        "x-device-id": deviceId,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to get sync status");
    }
    
    const data = await response.json();
    return data.status;
  },

  async getSyncStats(): Promise<SyncStats> {
    const response = await fetch("/api/sync/stats", {
      headers: {
        "Authorization": `Bearer ${await getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to get sync stats");
    }
    
    const data = await response.json();
    return data.stats;
  },

  async triggerSync(force: boolean = false): Promise<{ jobId: string }> {
    const deviceId = await getDeviceId();
    const response = await fetch("/api/sync/trigger", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getToken()}`,
        "x-device-id": deviceId,
      },
      body: JSON.stringify({ force }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to trigger sync");
    }
    
    return response.json();
  },

  async updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device> {
    const response = await fetch(`/api/sync/devices/${deviceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getToken()}`,
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error("Failed to update device");
    }
    
    const data = await response.json();
    return data.device;
  },

  async removeDevice(deviceId: string): Promise<void> {
    const response = await fetch(`/api/sync/devices/${deviceId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${await getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to remove device");
    }
  },

  async resolveConflict(conflict: ConflictResolution): Promise<any> {
    const response = await fetch("/api/sync/conflicts/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getToken()}`,
        "x-device-id": await getDeviceId(),
      },
      body: JSON.stringify(conflict),
    });
    
    if (!response.ok) {
      throw new Error("Failed to resolve conflict");
    }
    
    const data = await response.json();
    return data.resolved;
  },
};

// Helper functions
async function getToken(): Promise<string> {
  // In a real implementation, this would get the JWT token from secure storage
  return "mock-jwt-token";
}

async function getDeviceId(): Promise<string> {
  // In a real implementation, this would get the unique device ID
  return "mock-device-id";
}

function getDeviceIcon(deviceType: string): keyof typeof Ionicons.glyphMap {
  switch (deviceType) {
    case "phone":
      return "phone-portrait";
    case "tablet":
      return "tablet-portrait";
    case "web":
      return "globe";
    case "desktop":
      return "desktop";
    default:
      return "help-circle";
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export const SyncSettingsScreen: React.FC = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncOnWifiOnly, setSyncOnWifiOnly] = useState(false);
  const [conflictStrategy, setConflictStrategy] = useState("last_write_wins");

  // Queries
  const {
    data: devices = [],
    isLoading: devicesLoading,
    error: devicesError,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: ["sync-devices"],
    queryFn: api.getDevices,
  });

  const {
    data: syncStatus,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["sync-status"],
    queryFn: api.getSyncStatus,
  });

  const {
    data: syncStats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ["sync-stats"],
    queryFn: api.getSyncStats,
  });

  // Mutations
  const triggerSyncMutation = useMutation({
    mutationFn: api.triggerSync,
    onSuccess: () => {
      Alert.alert("Success", "Sync triggered successfully");
      refetchStatus();
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to trigger sync");
    },
  });

  const updateDeviceMutation = useMutation({
    mutationFn: ({ deviceId, updates }: { deviceId: string; updates: Partial<Device> }) =>
      api.updateDevice(deviceId, updates),
    onSuccess: () => {
      Alert.alert("Success", "Device updated successfully");
      setEditModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["sync-devices"] });
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to update device");
    },
  });

  const removeDeviceMutation = useMutation({
    mutationFn: api.removeDevice,
    onSuccess: () => {
      Alert.alert("Success", "Device removed successfully");
      queryClient.invalidateQueries({ queryKey: ["sync-devices"] });
      queryClient.invalidateQueries({ queryKey: ["sync-stats"] });
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to remove device");
    },
  });

  const resolveConflictMutation = useMutation({
    mutationFn: api.resolveConflict,
    onSuccess: () => {
      Alert.alert("Success", "Conflict resolved successfully");
      refetchStatus();
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to resolve conflict");
    },
  });

  // Handlers
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchDevices(),
        refetchStatus(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTriggerSync = () => {
    triggerSyncMutation.mutate(false);
  };

  const handleEditDevice = (device: Device) => {
    setSelectedDevice(device);
    setDeviceName(device.deviceName);
    setEditModalVisible(true);
  };

  const handleSaveDevice = () => {
    if (!selectedDevice) return;
    
    updateDeviceMutation.mutate({
      deviceId: selectedDevice.deviceId,
      updates: {
        deviceName,
        isActive: selectedDevice.isActive,
      },
    });
  };

  const handleRemoveDevice = (device: Device) => {
    Alert.alert(
      "Remove Device",
      `Are you sure you want to remove "${device.deviceName}"? This will stop sync for this device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeDeviceMutation.mutate(device.deviceId),
        },
      ]
    );
  };

  const handleResolveConflicts = () => {
    if (syncStatus && syncStatus.conflicts > 0) {
      resolveConflictMutation.mutate({
        conflictId: "mock-conflict-id",
        strategy: conflictStrategy as any,
      });
    }
  };

  // Render device item
  const renderDeviceItem = ({ item }: { item: Device }) => (
    <Card style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <View style={styles.deviceInfo}>
          <Ionicons
            name={getDeviceIcon(item.deviceType)}
            size={24}
            color={theme.colors.primary}
            style={styles.deviceIcon}
          />
          <View style={styles.deviceDetails}>
            <Text style={[styles.deviceName, { color: theme.colors.text }]}>
              {item.deviceName}
            </Text>
            <Text style={[styles.deviceType, { color: theme.colors.textSecondary }]}>
              {item.deviceType.charAt(0).toUpperCase() + item.deviceType.slice(1)} • {item.appVersion || "Unknown version"}
            </Text>
          </View>
        </View>
        <View style={styles.deviceStatus}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: item.isActive ? theme.colors.success : theme.colors.textSecondary }
          ]} />
          <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
            {item.isActive ? "Active" : "Inactive"}
          </Text>
        </View>
      </View>
      
      <View style={styles.deviceStats}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Last Sync
          </Text>
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {item.lastSyncAt
              ? formatDistanceToNow(new Date(item.lastSyncAt), { addSuffix: true })
              : "Never"}
          </Text>
        </View>
        {item.storageUsed && (
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Storage Used
            </Text>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {formatBytes(item.storageUsed)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.deviceActions}>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: theme.colors.border }]}
          onPress={() => handleEditDevice(item)}
        >
          <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
          <Text style={[styles.actionText, { color: theme.colors.primary }]}>
            Edit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton, { borderColor: theme.colors.error }]}
          onPress={() => handleRemoveDevice(item)}
        >
          <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
          <Text style={[styles.actionText, { color: theme.colors.error }]}>
            Remove
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Sync Status Card */}
      <Card style={styles.statusCard}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Sync Status
        </Text>
        
        {syncStatus ? (
          <View style={styles.statusContent}>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>
                Last Sync:
              </Text>
              <Text style={[styles.statusValue, { color: theme.colors.text }]}>
                {syncStatus.lastSyncAt
                  ? formatDistanceToNow(new Date(syncStatus.lastSyncAt), { addSuffix: true })
                  : "Never"}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>
                Pending Operations:
              </Text>
              <Text style={[styles.statusValue, { color: theme.colors.text }]}>
                {syncStatus.pendingOperations}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]}>
                Conflicts:
              </Text>
              <Text style={[styles.statusValue, { color: syncStatus.conflicts > 0 ? theme.colors.error : theme.colors.text }]}>
                {syncStatus.conflicts}
              </Text>
            </View>

            {syncStatus.syncInProgress && (
              <View style={styles.syncProgress}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.syncProgressText, { color: theme.colors.primary }]}>
                  Sync in progress...
                </Text>
              </View>
            )}
          </View>
        ) : (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}

        <View style={styles.statusActions}>
          <Button
            title="Trigger Sync"
            onPress={handleTriggerSync}
            loading={triggerSyncMutation.isPending}
            disabled={syncStatus?.syncInProgress}
          />
          
          {syncStatus && syncStatus.conflicts > 0 && (
            <Button
              title={`Resolve ${syncStatus.conflicts} Conflicts`}
              onPress={handleResolveConflicts}
              variant="outline"
              loading={resolveConflictMutation.isPending}
            />
          )}
        </View>
      </Card>

      {/* Sync Settings */}
      <Card style={styles.settingsCard}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Sync Settings
        </Text>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Auto-sync
          </Text>
          <Switch
            value={autoSyncEnabled}
            onValueChange={setAutoSyncEnabled}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Sync on Wi-Fi only
          </Text>
          <Switch
            value={syncOnWifiOnly}
            onValueChange={setSyncOnWifiOnly}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>
        
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
            Conflict Resolution
          </Text>
          <TouchableOpacity
            style={[styles.settingSelector, { borderColor: theme.colors.border }]}
            onPress={() => {
              // In a real app, show picker for conflict resolution strategies
              Alert.alert("Conflict Resolution", "Choose how to resolve sync conflicts");
            }}
          >
            <Text style={[styles.settingValue, { color: theme.colors.text }]}>
              {conflictStrategy.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </Card>

      {/* Sync Statistics */}
      {syncStats && (
        <Card style={styles.statsCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Sync Statistics
          </Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
                {syncStats.totalDevices}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Total Devices
              </Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: theme.colors.success }]}>
                {syncStats.activeDevices}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Active Devices
              </Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: theme.colors.warning }]}>
                {syncStats.totalSyncOperations}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Total Sync Ops
              </Text>
            </View>
            
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: theme.colors.info }]}>
                {syncStats.averageSyncOpsPerDevice}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Avg Ops/Device
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Devices List */}
      <Card style={styles.devicesCard}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Connected Devices
        </Text>
        
        {devicesLoading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : devices.length > 0 ? (
          <FlatList
            data={devices}
            renderItem={renderDeviceItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            No devices connected
          </Text>
        )}
      </Card>

      {/* Edit Device Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Edit Device
            </Text>
            
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>
                Device Name
              </Text>
              <TextInput
                style={[styles.formInput, { 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                }]}
                value={deviceName}
                onChangeText={setDeviceName}
                placeholder="Enter device name"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setEditModalVisible(false)}
                variant="outline"
              />
              <Button
                title="Save"
                onPress={handleSaveDevice}
                loading={updateDeviceMutation.isPending}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    padding: 16,
    marginBottom: 16,
  },
  settingsCard: {
    padding: 16,
    marginBottom: 16,
  },
  statsCard: {
    padding: 16,
    marginBottom: 16,
  },
  devicesCard: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  statusContent: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  syncProgress: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  syncProgressText: {
    marginLeft: 8,
    fontSize: 14,
  },
  statusActions: {
    flexDirection: "row",
    gap: 12,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
  },
  settingSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  settingValue: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statBox: {
    width: "48%",
    alignItems: "center",
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "600",
  },
  deviceCard: {
    padding: 16,
  },
  deviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  deviceInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  deviceIcon: {
    marginRight: 12,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  deviceType: {
    fontSize: 12,
  },
  deviceStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
  },
  deviceStats: {
    flexDirection: "row",
    marginBottom: 12,
  },
  statItem: {
    marginRight: 24,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  deviceActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    gap: 6,
  },
  removeButton: {
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    fontStyle: "italic",
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 24,
    textAlign: "center",
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
});
