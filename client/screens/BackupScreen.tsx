// AI-META-BEGIN
// AI-META: Backup screen UI with status display, manual backup triggers, and backup history
// OWNERSHIP: client/screens
// ENTRYPOINTS: navigation from settings or main app
// DEPENDENCIES: react-native, @tanstack/react-query, expo-clipboard
// DANGER: Backup deletion = data loss; backup restore = data overwrite; UI errors = poor UX
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
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../constants/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { formatDistanceToNow } from "date-fns";

// Types
interface BackupMetadata {
  id: string;
  userId: string;
  type: "full" | "incremental";
  status: "pending" | "in_progress" | "completed" | "failed";
  size: number;
  fileCount: number;
  cloudKey: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface BackupStats {
  totalBackups: number;
  completedBackups: number;
  failedBackups: number;
  totalSize: number;
  lastBackup?: string;
}

interface BackupConfig {
  autoBackupEnabled: boolean;
  retentionDays: number;
  maxBackupSize: number;
  supportedTypes: string[];
  lastBackup?: string;
  totalBackups: number;
}

// API functions (these would be implemented in a proper API client)
const api = {
  async startBackup(type: "full" | "incremental" = "incremental"): Promise<{ backupId: string }> {
    // In a real implementation, this would make an API call
    const response = await fetch("/api/backup/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getToken()}`,
      },
      body: JSON.stringify({ type }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to start backup");
    }
    
    return response.json();
  },

  async getBackupStatus(backupId: string): Promise<BackupMetadata> {
    const response = await fetch(`/api/backup/status/${backupId}`, {
      headers: {
        "Authorization": `Bearer ${await getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to get backup status");
    }
    
    const data = await response.json();
    return data.backup;
  },

  async listBackups(): Promise<BackupMetadata[]> {
    const response = await fetch("/api/backup/list", {
      headers: {
        "Authorization": `Bearer ${await getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to list backups");
    }
    
    const data = await response.json();
    return data.backups;
  },

  async deleteBackup(backupId: string): Promise<void> {
    const response = await fetch(`/api/backup/${backupId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${await getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to delete backup");
    }
  },

  async getBackupStats(): Promise<BackupStats> {
    const response = await fetch("/api/backup/stats", {
      headers: {
        "Authorization": `Bearer ${await getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to get backup stats");
    }
    
    const data = await response.json();
    return data.stats;
  },

  async getBackupConfig(): Promise<BackupConfig> {
    const response = await fetch("/api/backup/config", {
      headers: {
        "Authorization": `Bearer ${await getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to get backup config");
    }
    
    const data = await response.json();
    return data.config;
  },

  async scheduleBackup(schedule: string): Promise<void> {
    const response = await fetch("/api/backup/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getToken()}`,
      },
      body: JSON.stringify({ schedule }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to schedule backup");
    }
  },

  async cancelScheduledBackup(): Promise<void> {
    const response = await fetch("/api/backup/schedule", {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${await getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to cancel scheduled backup");
    }
  },
};

// Mock token function - in real implementation this would get the auth token
async function getToken(): Promise<string> {
  return "mock-token";
}

export const BackupScreen: React.FC = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedule, setSchedule] = useState("0 2 * * *"); // Daily at 2 AM
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);

  // Queries
  const {
    data: backups = [],
    isLoading: backupsLoading,
    refetch: refetchBackups,
  } = useQuery({
    queryKey: ["backups"],
    queryFn: api.listBackups,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["backup-stats"],
    queryFn: api.getBackupStats,
    refetchInterval: 30000,
  });

  const {
    data: config,
    isLoading: configLoading,
  } = useQuery({
    queryKey: ["backup-config"],
    queryFn: api.getBackupConfig,
  });

  // Mutations
  const startBackupMutation = useMutation({
    mutationFn: api.startBackup,
    onSuccess: (data) => {
      Alert.alert("Success", `Backup started with ID: ${data.backupId}`);
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      queryClient.invalidateQueries({ queryKey: ["backup-stats"] });
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to start backup");
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: api.deleteBackup,
    onSuccess: () => {
      Alert.alert("Success", "Backup deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      queryClient.invalidateQueries({ queryKey: ["backup-stats"] });
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to delete backup");
    },
  });

  const scheduleBackupMutation = useMutation({
    mutationFn: api.scheduleBackup,
    onSuccess: () => {
      Alert.alert("Success", "Backup scheduled successfully");
      setShowScheduleModal(false);
      setAutoBackupEnabled(true);
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to schedule backup");
    },
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: api.cancelScheduledBackup,
    onSuccess: () => {
      Alert.alert("Success", "Backup schedule cancelled");
      setAutoBackupEnabled(false);
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to cancel backup schedule");
    },
  });

  // Effects
  useEffect(() => {
    if (config) {
      setAutoBackupEnabled(config.autoBackupEnabled);
    }
  }, [config]);

  // Handlers
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchBackups(),
      refetchStats(),
    ]);
    setRefreshing(false);
  };

  const handleStartBackup = (type: "full" | "incremental") => {
    Alert.alert(
      "Start Backup",
      `Are you sure you want to start a ${type} backup?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          style: "default",
          onPress: () => startBackupMutation.mutate(type),
        },
      ]
    );
  };

  const handleDeleteBackup = (backupId: string) => {
    Alert.alert(
      "Delete Backup",
      "Are you sure you want to delete this backup? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteBackupMutation.mutate(backupId),
        },
      ]
    );
  };

  const handleScheduleBackup = () => {
    scheduleBackupMutation.mutate(schedule);
  };

  const handleToggleAutoBackup = (enabled: boolean) => {
    if (enabled) {
      setShowScheduleModal(true);
    } else {
      cancelScheduleMutation.mutate();
    }
  };

  // Helper functions
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "completed":
        return theme.colors.success;
      case "failed":
        return theme.colors.error;
      case "in_progress":
        return theme.colors.warning;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case "completed":
        return "checkmark-circle";
      case "failed":
        return "close-circle";
      case "in_progress":
        return "time";
      default:
        return "ellipsis-circle";
    }
  };

  // Render functions
  const renderBackupItem = (backup: BackupMetadata) => (
    <Card key={backup.id} style={styles.backupItem}>
      <View style={styles.backupHeader}>
        <View style={styles.backupInfo}>
          <Text style={[styles.backupType, { color: theme.colors.primary }]}>
            {backup.type.toUpperCase()}
          </Text>
          <Text style={[styles.backupDate, { color: theme.colors.textSecondary }]}>
            {formatDistanceToNow(new Date(backup.createdAt), { addSuffix: true })}
          </Text>
        </View>
        <View style={styles.backupStatus}>
          <Ionicons
            name={getStatusIcon(backup.status)}
            size={20}
            color={getStatusColor(backup.status)}
          />
          <Text style={[styles.statusText, { color: getStatusColor(backup.status) }]}>
            {backup.status.replace("_", " ")}
          </Text>
        </View>
      </View>
      
      <View style={styles.backupDetails}>
        <Text style={[styles.backupDetail, { color: theme.colors.textSecondary }]}>
          Size: {formatFileSize(backup.size)}
        </Text>
        <Text style={[styles.backupDetail, { color: theme.colors.textSecondary }]}>
          Files: {backup.fileCount}
        </Text>
      </View>

      {backup.errorMessage && (
        <Text style={[styles.errorMessage, { color: theme.colors.error }]}>
          {backup.errorMessage}
        </Text>
      )}

      {backup.status === "completed" && (
        <TouchableOpacity
          style={[styles.deleteButton, { borderColor: theme.colors.error }]}
          onPress={() => handleDeleteBackup(backup.id)}
        >
          <Ionicons name="trash" size={16} color={theme.colors.error} />
          <Text style={[styles.deleteButtonText, { color: theme.colors.error }]}>
            Delete
          </Text>
        </TouchableOpacity>
      )}
    </Card>
  );

  const renderStatsCard = () => (
    <Card style={styles.statsCard}>
      <Text style={[styles.statsTitle, { color: theme.colors.text }]}>
        Backup Statistics
      </Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {stats?.totalBackups || 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Total Backups
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>
            {stats?.completedBackups || 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Completed
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.error }]}>
            {stats?.failedBackups || 0}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Failed
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {formatFileSize(stats?.totalSize || 0)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Total Size
          </Text>
        </View>
      </View>

      {stats?.lastBackup && (
        <Text style={[styles.lastBackup, { color: theme.colors.textSecondary }]}>
          Last backup: {formatDistanceToNow(new Date(stats.lastBackup), { addSuffix: true })}
        </Text>
      )}
    </Card>
  );

  const renderActionsCard = () => (
    <Card style={styles.actionsCard}>
      <Text style={[styles.actionsTitle, { color: theme.colors.text }]}>
        Backup Actions
      </Text>
      
      <View style={styles.actionButtons}>
        <Button
          title="Start Incremental Backup"
          onPress={() => handleStartBackup("incremental")}
          loading={startBackupMutation.isPending}
          style={styles.actionButton}
        />
        
        <Button
          title="Start Full Backup"
          onPress={() => handleStartBackup("full")}
          loading={startBackupMutation.isPending}
          variant="outline"
          style={styles.actionButton}
        />
      </View>

      <View style={styles.autoBackupSection}>
        <View style={styles.autoBackupHeader}>
          <Text style={[styles.autoBackupTitle, { color: theme.colors.text }]}>
            Automatic Backup
          </Text>
          <Switch
            value={autoBackupEnabled}
            onValueChange={handleToggleAutoBackup}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          />
        </View>
        
        <Text style={[styles.autoBackupDescription, { color: theme.colors.textSecondary }]}>
          Automatically back up your photos on a schedule
        </Text>
      </View>
    </Card>
  );

  if (backupsLoading || statsLoading || configLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Loading backup information...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {renderStatsCard()}
        {renderActionsCard()}
        
        <Card style={styles.backupsCard}>
          <Text style={[styles.backupsTitle, { color: theme.colors.text }]}>
            Backup History
          </Text>
          
          {backups.length === 0 ? (
            <Text style={[styles.noBackupsText, { color: theme.colors.textSecondary }]}>
              No backups yet. Start your first backup above.
            </Text>
          ) : (
            backups.map(renderBackupItem)
          )}
        </Card>
      </ScrollView>

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Schedule Automatic Backup
            </Text>
            
            <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
              Enter a cron expression for when to run automatic backups.
              Default: Daily at 2 AM
            </Text>
            
            <TextInput
              style={[styles.scheduleInput, { 
                borderColor: theme.colors.border,
                color: theme.colors.text,
                backgroundColor: theme.colors.background,
              }]}
              value={schedule}
              onChangeText={setSchedule}
              placeholder="0 2 * * *"
            />
            
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowScheduleModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Schedule"
                onPress={handleScheduleBackup}
                loading={scheduleBackupMutation.isPending}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    marginBottom: 16,
    padding: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
    width: "45%",
    marginBottom: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "600",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  lastBackup: {
    fontSize: 14,
    fontStyle: "italic",
  },
  actionsCard: {
    marginBottom: 16,
    padding: 16,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  actionButtons: {
    marginBottom: 16,
  },
  actionButton: {
    marginBottom: 8,
  },
  autoBackupSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  autoBackupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  autoBackupTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  autoBackupDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  backupsCard: {
    padding: 16,
  },
  backupsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  noBackupsText: {
    fontSize: 16,
    textAlign: "center",
    fontStyle: "italic",
  },
  backupItem: {
    marginBottom: 12,
    padding: 16,
  },
  backupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  backupInfo: {
    flex: 1,
  },
  backupType: {
    fontSize: 16,
    fontWeight: "600",
  },
  backupDate: {
    fontSize: 14,
    marginTop: 2,
  },
  backupStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
    marginLeft: 4,
  },
  backupDetails: {
    flexDirection: "row",
    marginBottom: 8,
  },
  backupDetail: {
    fontSize: 14,
    marginRight: 16,
  },
  errorMessage: {
    fontSize: 14,
    marginBottom: 8,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  deleteButtonText: {
    fontSize: 14,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  scheduleInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});

export default BackupScreen;
