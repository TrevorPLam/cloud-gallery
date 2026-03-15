// AI-META-BEGIN
// AI-META: Storage management screen for viewing usage and managing storage
// OWNERSHIP: client/screens
// ENTRYPOINTS: navigated from RootStackNavigator Storage route
// DEPENDENCIES: react-query, react-navigation, @expo/vector-icons
// DANGER: Performance-critical for large photo libraries; virtualization required
// CHANGE-SAFETY: Maintain API response structure compatibility; optimize list rendering
// TESTS: StorageScreen.test.tsx for UI behavior, integration tests for API calls
// AI-META-END

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/theme";

// Types
interface StorageBreakdown {
  totalBytesUsed: number;
  totalItemCount: number;
  storageLimit: number | null;
  categories: Array<{
    category: string;
    bytesUsed: number;
    itemCount: number;
    percentage: number;
    calculatedAt: string;
  }>;
  largeFiles: Array<{
    id: string;
    filename: string;
    size: number | null;
    uri: string;
    isVideo: boolean;
  }>;
  compressionStats: {
    originalTotal: number;
    compressedTotal: number;
    compressionRatio: number;
    compressedCount: number;
  };
}

interface StorageStatus {
  totalUsed: number;
  totalLimit: number | null;
  usagePercentage: number;
  isNearLimit: boolean;
  warnings: string[];
  recommendations: string[];
}

const { width: screenWidth } = Dimensions.get("window");

export const StorageScreen: React.FC = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<
    "old-photos" | "large-files" | "duplicates"
  >("old-photos");

  // Fetch storage usage data
  const {
    data: storageData,
    isLoading: isLoadingStorage,
    error: storageError,
    refetch: refetchStorage,
  } = useQuery({
    queryKey: ["storage", "usage"],
    queryFn: async () => {
      const response = await fetch("/api/storage/usage");
      if (!response.ok) throw new Error("Failed to fetch storage usage");
      const result = await response.json();
      return result.data as StorageBreakdown;
    },
  });

  // Fetch storage status
  const { data: statusData, isLoading: isLoadingStatus } = useQuery({
    queryKey: ["storage", "status"],
    queryFn: async () => {
      const response = await fetch("/api/storage/status");
      if (!response.ok) throw new Error("Failed to fetch storage status");
      const result = await response.json();
      return result.data as StorageStatus;
    },
  });

  // Free up space mutation
  const freeUpSpaceMutation = useMutation({
    mutationFn: async ({
      strategy,
      dryRun = false,
    }: {
      strategy: string;
      dryRun?: boolean;
    }) => {
      const response = await fetch("/api/storage/free-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, limit: 50, dryRun }),
      });
      if (!response.ok) throw new Error("Failed to free up space");
      return response.json();
    },
    onSuccess: (data, variables) => {
      const { filesDeleted, freedSpace, dryRun } = data.data;

      if (dryRun) {
        Alert.alert(
          "Storage Analysis",
          `Found ${filesDeleted} files that can be deleted to free up ${formatBytes(freedSpace)}`,
        );
      } else {
        Alert.alert(
          "Space Freed",
          `Successfully deleted ${filesDeleted} files and freed up ${formatBytes(freedSpace)}`,
        );
        queryClient.invalidateQueries({ queryKey: ["storage"] });
      }
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to free up space. Please try again.");
    },
  });

  // Compress photos mutation
  const compressPhotosMutation = useMutation({
    mutationFn: async ({ quality = 0.8 }: { quality?: number }) => {
      const response = await fetch("/api/storage/compress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quality }),
      });
      if (!response.ok) throw new Error("Failed to compress photos");
      return response.json();
    },
    onSuccess: (data) => {
      const { photosProcessed, totalSaved } = data.data;
      Alert.alert(
        "Compression Complete",
        `Processed ${photosProcessed} photos and saved ${formatBytes(totalSaved)}`,
      );
      queryClient.invalidateQueries({ queryKey: ["storage"] });
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to compress photos. Please try again.");
    },
  });

  // Update storage usage
  const updateStorageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/storage/update", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to update storage");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage"] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStorage(), updateStorageMutation.mutateAsync()]);
    setRefreshing(false);
  }, [refetchStorage, updateStorageMutation]);

  // Format bytes to human readable format
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  // Render storage gauge
  const renderStorageGauge = useCallback(() => {
    if (!storageData || !statusData) return null;

    const percentage = statusData.usagePercentage;
    const isNearLimit = statusData.isNearLimit;

    return (
      <Card style={styles.card}>
        <ThemedText style={styles.cardTitle}>Storage Usage</ThemedText>
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeInfo}>
            <ThemedText style={styles.gaugePercentage}>
              {percentage.toFixed(1)}%
            </ThemedText>
            <ThemedText style={styles.gaugeLabel}>Used</ThemedText>
            <ThemedText style={styles.gaugeDetails}>
              {formatBytes(storageData.totalBytesUsed)} /{" "}
              {formatBytes(statusData.totalLimit || 0)}
            </ThemedText>
          </View>
          <View
            style={[
              styles.gaugeBar,
              {
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: isNearLimit
                  ? Colors.light.error
                  : Colors.light.success,
              },
            ]}
          />
        </View>
      </Card>
    );
  }, [storageData, statusData, formatBytes]);

  // Render category breakdown
  const renderCategoryBreakdown = useCallback(() => {
    if (!storageData) return null;

    return (
      <Card style={styles.card}>
        <ThemedText style={styles.cardTitle}>Storage Breakdown</ThemedText>
        {storageData.categories.map((category) => (
          <View key={category.category} style={styles.categoryRow}>
            <View style={styles.categoryInfo}>
              <ThemedText style={styles.categoryName}>
                {category.category.charAt(0).toUpperCase() +
                  category.category.slice(1)}
              </ThemedText>
              <ThemedText style={styles.categoryDetails}>
                {category.itemCount} items • {formatBytes(category.bytesUsed)}
              </ThemedText>
            </View>
            <View style={styles.categoryStats}>
              <ThemedText style={styles.categoryPercentage}>
                {category.percentage.toFixed(1)}%
              </ThemedText>
              <View style={styles.categoryBar}>
                <View
                  style={[
                    styles.categoryBarFill,
                    {
                      width: `${category.percentage}%`,
                      backgroundColor: Colors.light.primary,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ))}
      </Card>
    );
  }, [storageData, formatBytes]);

  // Render compression stats
  const renderCompressionStats = useCallback(() => {
    if (!storageData) return null;

    const { compressionStats } = storageData;
    const savings =
      compressionStats.originalTotal - compressionStats.compressedTotal;

    return (
      <Card style={styles.card}>
        <ThemedText style={styles.cardTitle}>Compression Statistics</ThemedText>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {compressionStats.compressedCount}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Compressed Files</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {compressionStats.compressionRatio.toFixed(2)}x
            </ThemedText>
            <ThemedText style={styles.statLabel}>Compression Ratio</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {formatBytes(savings)}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Space Saved</ThemedText>
          </View>
        </View>
      </Card>
    );
  }, [storageData, formatBytes]);

  // Render management actions
  const renderManagementActions = useCallback(() => {
    return (
      <Card style={styles.card}>
        <ThemedText style={styles.cardTitle}>Storage Management</ThemedText>

        <View style={styles.strategySelector}>
          <ThemedText style={styles.strategyLabel}>
            Cleanup Strategy:
          </ThemedText>
          <View style={styles.strategyButtons}>
            {(["old-photos", "large-files", "duplicates"] as const).map(
              (strategy) => (
                <Button
                  key={strategy}
                  onPress={() => setSelectedStrategy(strategy)}
                  style={[
                    styles.strategyButton,
                    selectedStrategy === strategy &&
                      styles.strategyButtonSelected,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.strategyButtonText,
                      selectedStrategy === strategy &&
                        styles.strategyButtonTextSelected,
                    ]}
                  >
                    {strategy
                      .replace("-", " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </ThemedText>
                </Button>
              ),
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <Button
            onPress={() =>
              freeUpSpaceMutation.mutate({
                strategy: selectedStrategy,
                dryRun: true,
              })
            }
            style={styles.analyzeButton}
          >
            <ThemedText style={styles.buttonText}>Analyze</ThemedText>
          </Button>
          <Button
            onPress={() => {
              Alert.alert(
                "Confirm Cleanup",
                "This will permanently delete files. Continue?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () =>
                      freeUpSpaceMutation.mutate({
                        strategy: selectedStrategy,
                        dryRun: false,
                      }),
                  },
                ],
              );
            }}
            style={styles.cleanupButton}
          >
            <ThemedText style={styles.buttonText}>Free Up Space</ThemedText>
          </Button>
          <Button
            onPress={() => compressPhotosMutation.mutate({})}
            style={styles.compressButton}
          >
            <ThemedText style={styles.buttonText}>Compress Photos</ThemedText>
          </Button>
        </View>
      </Card>
    );
  }, [selectedStrategy, freeUpSpaceMutation, compressPhotosMutation]);

  // Render warnings and recommendations
  const renderAlerts = useCallback(() => {
    if (!statusData) return null;

    return (
      <>
        {statusData.warnings.length > 0 && (
          <Card style={[styles.card, styles.warningCard]}>
            <View style={styles.warningHeader}>
              <Feather
                name="alert-triangle"
                size={20}
                color={Colors.light.error}
              />
              <ThemedText style={styles.warningTitle}>Warnings</ThemedText>
            </View>
            {statusData.warnings.map((warning, index) => (
              <ThemedText key={index} style={styles.warningText}>
                • {warning}
              </ThemedText>
            ))}
          </Card>
        )}

        {statusData.recommendations.length > 0 && (
          <Card style={[styles.card, styles.recommendationCard]}>
            <View style={styles.recommendationHeader}>
              <Feather name="info" size={20} color={Colors.light.primary} />
              <ThemedText style={styles.recommendationTitle}>
                Recommendations
              </ThemedText>
            </View>
            {statusData.recommendations.map((recommendation, index) => (
              <ThemedText key={index} style={styles.recommendationText}>
                • {recommendation}
              </ThemedText>
            ))}
          </Card>
        )}
      </>
    );
  }, [statusData]);

  if (storageError) {
    return (
      <View style={styles.errorContainer}>
        <Feather name="alert-circle" size={48} color={Colors.light.error} />
        <ThemedText style={styles.errorText}>
          Failed to load storage information
        </ThemedText>
        <Button onPress={refetchStorage}>
          <ThemedText style={styles.buttonText}>Retry</ThemedText>
        </Button>
      </View>
    );
  }

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: theme.theme.backgroundDefault },
      ]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ThemedText style={styles.title}>Storage Management</ThemedText>

      {isLoadingStorage || isLoadingStatus ? (
        <ActivityIndicator size="large" color={Colors.light.primary} />
      ) : (
        <>
          {renderStorageGauge()}
          {renderCategoryBreakdown()}
          {renderCompressionStats()}
          {renderManagementActions()}
          {renderAlerts()}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  card: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  gaugeContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  gaugeInfo: {
    alignItems: "center",
  },
  gaugePercentage: {
    fontSize: 24,
    fontWeight: "bold",
  },
  gaugeLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  gaugeDetails: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: "center",
  },
  gaugeBar: {
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    maxWidth: "100%",
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "500",
  },
  categoryDetails: {
    fontSize: 14,
    opacity: 0.7,
  },
  categoryStats: {
    alignItems: "flex-end",
    flex: 1,
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: "500",
  },
  categoryBar: {
    width: "100%",
    height: 4,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
    marginTop: 4,
  },
  categoryBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: "center",
  },
  strategySelector: {
    marginBottom: 16,
  },
  strategyLabel: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
  },
  strategyButtons: {
    flexDirection: "row",
    gap: 8,
  },
  strategyButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "transparent",
  },
  strategyButtonSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  strategyButtonText: {
    fontSize: 12,
    color: "#333",
    textAlign: "center",
  },
  strategyButtonTextSelected: {
    color: "white",
    textAlign: "center",
  },
  actionButtons: {
    gap: 12,
  },
  analyzeButton: {
    backgroundColor: "#f0f0f0",
  },
  cleanupButton: {
    backgroundColor: Colors.light.error,
  },
  compressButton: {
    backgroundColor: Colors.light.success,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "500",
  },
  warningCard: {
    backgroundColor: "#FFF3F3",
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.error,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
    color: Colors.light.error,
  },
  warningText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  recommendationCard: {
    backgroundColor: "#F0F8FF",
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
    color: Colors.light.primary,
  },
  recommendationText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    marginVertical: 16,
    textAlign: "center",
  },
});

export default StorageScreen;
