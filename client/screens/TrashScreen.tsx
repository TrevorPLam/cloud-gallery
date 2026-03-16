// AI-META-BEGIN
// AI-META: Enhanced screen for viewing and managing deleted photos with countdown timers and bulk operations
// OWNERSHIP: client/screens
// ENTRYPOINTS: Navigated from ProfileScreen
// DEPENDENCIES: PhotoDetailScreen (for viewing), storage/api, trash services
// DANGER: Permanent delete is irreversible
// CHANGE-SAFETY: Enhanced UI with new features - verify restore and bulk operations
// TESTS: Countdown timers, bulk selection, recovery, permanent delete, empty state
// AI-META-END

import React, { useCallback, useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  RefreshControl,
  Pressable,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { Photo } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Feather } from "@expo/vector-icons";
import {
  getTrashItemsWithCountdown,
  formatDeletionTime,
  getCleanupStats,
  configureBackgroundCleanup,
} from "@/lib/trash/cleanup-service.simple";
import {
  recoverPhoto,
  recoverPhotos,
  createRecoveryReport,
} from "@/lib/trash/recovery-service";
import { performSecureDeletion } from "@/lib/trash/secure-deletion";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const IMAGE_SIZE = SCREEN_WIDTH / COLUMN_COUNT;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TrashScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  // State for bulk operations
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  // Enhanced trash query with countdown information
  const {
    data: trashItems = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["trash-photos-enhanced"],
    queryFn: getTrashItemsWithCountdown,
  });

  // Cleanup statistics
  const { data: cleanupStats } = useQuery({
    queryKey: ["cleanup-stats"],
    queryFn: getCleanupStats,
  });

  // Configure background cleanup on mount
  useEffect(() => {
    configureBackgroundCleanup().catch(console.error);
  }, []);

  // Recovery mutations
  const recoverPhotoMutation = useMutation({
    mutationFn: (photoId: string) => recoverPhoto(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash-photos-enhanced"] });
      Alert.alert("Success", "Photo recovered successfully");
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to recover photo");
    },
  });

  const bulkRecoverMutation = useMutation({
    mutationFn: (photoIds: string[]) => recoverPhotos(photoIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["trash-photos-enhanced"] });
      setSelectedPhotos([]);
      setSelectionMode(false);
      Alert.alert(
        "Recovery Complete",
        `Recovered ${result.recoveredPhotos.length} photos${result.failedPhotos.length > 0 ? `\nFailed: ${result.failedPhotos.length}` : ""}`
      );
    },
    onError: () => {
      Alert.alert("Error", "Failed to recover photos");
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (photoId: string) => performSecureDeletion(photoId, "current-user"), // Would need actual user ID
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash-photos-enhanced"] });
      Alert.alert("Deleted", "Photo permanently deleted");
    },
    onError: () => {
      Alert.alert("Error", "Failed to delete photo");
    },
  });

  const bulkPermanentDeleteMutation = useMutation({
    mutationFn: (photoIds: string[]) => Promise.all(
      photoIds.map(id => performSecureDeletion(id, "current-user"))
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash-photos-enhanced"] });
      setSelectedPhotos([]);
      setSelectionMode(false);
      Alert.alert("Deleted", "Selected photos permanently deleted");
    },
    onError: () => {
      Alert.alert("Error", "Failed to delete photos");
    },
  });

  // Toggle photo selection
  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotos(prev => 
      prev.includes(photoId) 
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
  }, []);

  // Handle bulk recovery
  const handleBulkRecover = useCallback(async () => {
    if (selectedPhotos.length === 0) return;

    // Create recovery report for large selections
    if (selectedPhotos.length > 10) {
      const report = await createRecoveryReport(selectedPhotos);
      if (!report.canProceed && report.warnings.length > 0) {
        Alert.alert(
          "Recovery Warning",
          report.warnings.join("\n"),
          [{ text: "Cancel", style: "cancel" }, { text: "Proceed Anyway", onPress: () => bulkRecoverMutation.mutate(selectedPhotos) }]
        );
        return;
      }
    }

    bulkRecoverMutation.mutate(selectedPhotos);
  }, [selectedPhotos, bulkRecoverMutation]);

  // Handle bulk permanent delete
  const handleBulkPermanentDelete = useCallback(() => {
    if (selectedPhotos.length === 0) return;

    Alert.alert(
      "Permanent Delete",
      `This will permanently delete ${selectedPhotos.length} photo(s). This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => bulkPermanentDeleteMutation.mutate(selectedPhotos)
        }
      ]
    );
  }, [selectedPhotos, bulkPermanentDeleteMutation]);

  // Handle single photo recovery
  const handleRecoverPhoto = useCallback((photoId: string) => {
    Alert.alert(
      "Recover Photo",
      "Restore this photo to your gallery?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Recover", onPress: () => recoverPhotoMutation.mutate(photoId) }
      ]
    );
  }, [recoverPhotoMutation]);

  // Handle single photo permanent delete
  const handlePermanentDeletePhoto = useCallback((photoId: string) => {
    Alert.alert(
      "Permanent Delete",
      "This will permanently delete this photo. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => permanentDeleteMutation.mutate(photoId)
        }
      ]
    );
  }, [permanentDeleteMutation]);

  const renderItem = useCallback(
    ({ item, index }: { item: Photo; index: number }) => {
      const isSelected = selectedPhotos.includes(item.id);
      const trashItem = trashItems.find(t => t.id === item.id);
      
      return (
        <Pressable
          onPress={() => {
            if (selectionMode) {
              togglePhotoSelection(item.id);
            } else {
              navigation.navigate("PhotoDetail", {
                photoId: item.id,
                initialIndex: index,
                // @ts-ignore - 'context' param needs to be added to RootStackParamList
                context: "trash",
              });
            }
          }}
          onLongPress={() => {
            setSelectionMode(true);
            togglePhotoSelection(item.id);
          }}
          style={{
            width: IMAGE_SIZE,
            height: IMAGE_SIZE,
            padding: 1,
            position: 'relative',
          }}
        >
          <Image
            source={{ uri: item.uri }}
            style={{ 
              flex: 1, 
              backgroundColor: theme.backgroundDefault,
              opacity: isSelected ? 0.6 : 1,
            }}
            contentFit="cover"
            transition={200}
          />
          
          {/* Countdown timer overlay */}
          {trashItem && (
            <View style={[
              styles.countdownOverlay,
              { backgroundColor: trashItem.willBeDeletedSoon ? 'rgba(255,0,0,0.8)' : 'rgba(0,0,0,0.6)' }
            ]}>
              <ThemedText style={styles.countdownText}>
                {trashItem.daysUntilDeletion === 0 ? 'Today' : `${trashItem.daysUntilDeletion}d`}
              </ThemedText>
            </View>
          )}

          {/* Selection indicator */}
          {isSelected && (
            <View style={[styles.selectionIndicator, { backgroundColor: theme.primary }]}>
              <Feather name="check" size={16} color="white" />
            </View>
          )}
        </Pressable>
      );
    },
    [navigation, theme, selectedPhotos, selectionMode, togglePhotoSelection, trashItems]
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="trash-2" size={48} color={theme.textSecondary} />
      <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
        Trash is empty
      </ThemedText>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Feather name="arrow-left" size={24} color={theme.text} />
      </Pressable>
      
      <View style={styles.titleContainer}>
        <ThemedText type="h4">Trash</ThemedText>
        {cleanupStats && (
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {cleanupStats.totalTrashItems} items
            {cleanupStats.itemsToDeleteSoon > 0 && (
              <ThemedText style={{ color: '#ff6b6b' }}>
                {' • '}{cleanupStats.itemsToDeleteSoon} expiring soon
              </ThemedText>
            )}
          </ThemedText>
        )}
      </View>

      <View style={styles.headerActions}>
        <Pressable onPress={() => setShowStatsModal(true)} style={styles.iconButton}>
          <Feather name="info" size={20} color={theme.textSecondary} />
        </Pressable>
        
        <Pressable 
          onPress={() => setSelectionMode(!selectionMode)}
          style={[styles.iconButton, selectionMode && { backgroundColor: theme.primary }]}
        >
          <Feather name="check-square" size={20} color={selectionMode ? 'white' : theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  const renderBulkActions = () => {
    if (!selectionMode || selectedPhotos.length === 0) return null;

    return (
      <View style={[styles.bulkActionsBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <ThemedText style={styles.bulkActionText}>
          {selectedPhotos.length} selected
        </ThemedText>
        
        <View style={styles.bulkActionButtons}>
          <Pressable
            onPress={handleBulkRecover}
            style={[styles.bulkActionButton, { backgroundColor: theme.success }]}
            disabled={bulkRecoverMutation.isPending}
          >
            <Feather name="rotate-ccw" size={16} color="white" />
            <ThemedText style={styles.bulkActionButtonText}>Recover</ThemedText>
          </Pressable>

          <Pressable
            onPress={handleBulkPermanentDelete}
            style={[styles.bulkActionButton, { backgroundColor: '#ff6b6b' }]}
            disabled={bulkPermanentDeleteMutation.isPending}
          >
            <Feather name="trash-2" size={16} color="white" />
            <ThemedText style={styles.bulkActionButtonText}>Delete</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderStatsModal = () => (
    <Modal
      visible={showStatsModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowStatsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.statsModal, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h4">Trash Statistics</ThemedText>
            <Pressable onPress={() => setShowStatsModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          {cleanupStats && (
            <ScrollView style={styles.statsContent}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Total Items</ThemedText>
                <ThemedText style={styles.statValue}>{cleanupStats.totalTrashItems}</ThemedText>
              </View>

              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Expiring Soon</ThemedText>
                <ThemedText style={[styles.statValue, { color: '#ff6b6b' }]}>
                  {cleanupStats.itemsToDeleteSoon}
                </ThemedText>
              </View>

              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Last Cleanup</ThemedText>
                <ThemedText style={styles.statValue}>
                  {cleanupStats.lastCleanup 
                    ? new Date(cleanupStats.lastCleanup).toLocaleDateString()
                    : 'Never'
                  }
                </ThemedText>
              </View>

              <View style={styles.statItem}>
                <ThemedText style={styles.statLabel}>Next Cleanup</ThemedText>
                <ThemedText style={styles.statValue}>
                  {new Date(cleanupStats.nextCleanup).toLocaleDateString()}
                </ThemedText>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <ThemedView style={styles.container}>
      {renderHeader()}
      
      <FlatList
        data={trashItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (selectionMode ? 80 : 0),
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={!isLoading ? renderEmpty : null}
      />

      {renderBulkActions()}
      {renderStatsModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  countdownOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  countdownText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkActionsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    minHeight: 80,
  },
  bulkActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bulkActionButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    gap: Spacing.xs,
  },
  bulkActionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  statsContent: {
    flex: 1,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  statLabel: {
    fontSize: 16,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});
