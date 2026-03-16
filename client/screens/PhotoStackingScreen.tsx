// AI-META-BEGIN
// AI-META: Photo stacking screen for reviewing and managing stacked photos
// OWNERSHIP: client/screens
// ENTRYPOINTS: navigated from gallery and settings screens
// DEPENDENCIES: react-native, react-navigation, photo-stacking service
// DANGER: Complex UI state management requires careful optimization
// CHANGE-SAFETY: Add new stacking actions by extending the screen components
// TESTS: client/screens/PhotoStackingScreen.test.tsx
// AI-META-END

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { FlashList } from "@shopify/flash-list";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Photo } from "@/types";
import { getPhotos } from "../lib/storage";
import { 
  getPhotoStackingService, 
  getStacks, 
  getStackSummary,
  updateStackPreferences,
  selectBestPhoto,
  type PhotoStack,
  type StackingStatistics,
} from "../lib/photo/photo-stacking";
import { getQualityRating } from "../lib/photo/quality-score";

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

type RootStackParamList = {
  PhotoStacking: undefined;
  PhotoViewer: { photoId: string; stackId?: string };
  Settings: undefined;
};

type PhotoStackingNavigationProp = StackNavigationProp<RootStackParamList, "PhotoStacking">;
type PhotoStackingRouteProp = RouteProp<RootStackParamList, "PhotoStacking">;

interface StackItemProps {
  stack: PhotoStack;
  photos: Photo[];
  onPress: (stack: PhotoStack, photos: Photo[]) => void;
  onBestPhotoSelect: (stackId: string, photoId: string) => void;
  onReviewToggle: (stackId: string, reviewed: boolean) => void;
}

interface PhotoItemProps {
  photo: Photo;
  isSelected: boolean;
  quality: number;
  onSelect: (photoId: string) => void;
  onPress: (photo: Photo) => void;
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────

export const PhotoStackingScreen: React.FC = () => {
  const navigation = useNavigation<PhotoStackingNavigationProp>();
  const route = useRoute<PhotoStackingRouteProp>();

  const [stacks, setStacks] = useState<PhotoStack[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<StackingStatistics | null>(null);
  const [showStatistics, setShowStatistics] = useState(false);
  const [processingStacks, setProcessingStacks] = useState<Set<string>>(new Set());

  const stackingService = useMemo(() => getPhotoStackingService(), []);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [stacksData, photosData, statsData] = await Promise.all([
        getStacks(),
        getPhotos(),
        stackingService.getStackingStatistics(),
      ]);

      setStacks(stacksData);
      setAllPhotos(photosData);
      setStatistics(statsData);
    } catch (error) {
      console.error("Failed to load stacking data:", error);
      Alert.alert("Error", "Failed to load photo stacks. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [stackingService]);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Run stacking analysis
  const runStackingAnalysis = useCallback(async () => {
    Alert.alert(
      "Analyze Photos",
      "This will analyze all your photos to find duplicates, bursts, and similar photos. This may take several minutes for large photo libraries.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Analyze",
          style: "default",
          onPress: async () => {
            try {
              setLoading(true);
              const result = await stackingService.analyzeAndStackPhotos();
              
              Alert.alert(
                "Analysis Complete",
                `Found ${result.stacksCreated} stacks containing ${result.photosInStacks} photos.\nProcessing time: ${(result.processingTime / 1000).toFixed(1)}s`,
                [{ text: "OK", onPress: () => loadData() }]
              );
            } catch (error) {
              console.error("Stacking analysis failed:", error);
              Alert.alert("Error", "Failed to analyze photos. Please try again.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [stackingService, loadData]);

  // Handle stack press
  const handleStackPress = useCallback((stack: PhotoStack, photos: Photo[]) => {
    setSelectedStackId(stack.id);
    // In a real implementation, would navigate to stack detail view
    // For now, show a simple modal
  }, []);

  // Handle best photo selection
  const handleBestPhotoSelect = useCallback(async (stackId: string, photoId: string) => {
    try {
      setProcessingStacks(prev => new Set(prev).add(stackId));
      await selectBestPhoto(stackId, photoId);
      await loadData(); // Refresh data
    } catch (error) {
      console.error("Failed to select best photo:", error);
      Alert.alert("Error", "Failed to update photo selection.");
    } finally {
      setProcessingStacks(prev => {
        const newSet = new Set(prev);
        newSet.delete(stackId);
        return newSet;
      });
    }
  }, [loadData]);

  // Handle review toggle
  const handleReviewToggle = useCallback(async (stackId: string, reviewed: boolean) => {
    try {
      await updateStackPreferences(stackId, { reviewed });
      await loadData(); // Refresh data
    } catch (error) {
      console.error("Failed to update review status:", error);
      Alert.alert("Error", "Failed to update review status.");
    }
  }, [loadData]);

  // Get photos for stack
  const getPhotosForStack = useCallback((stack: PhotoStack): Photo[] => {
    return allPhotos.filter(photo => stack.photoIds.includes(photo.id));
  }, [allPhotos]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Render stack item
  const renderStackItem = useCallback(({ item: { stack: PhotoStack; photos: Photo[] } }) => (
    <StackItem
      stack={item.stack}
      photos={item.photos}
      onPress={handleStackPress}
      onBestPhotoSelect={handleBestPhotoSelect}
      onReviewToggle={handleReviewToggle}
    />
  ), [handleStackPress, handleBestPhotoSelect, handleReviewToggle]);

  // Prepare data for FlashList
  const stackData = useMemo(() => 
    stacks.map(stack => ({
      stack,
      photos: getPhotosForStack(stack),
      key: stack.id,
    }))
  , [stacks, getPhotosForStack]);

  if (loading && stacks.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading photo stacks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Photo Stacking</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowStatistics(true)}
          >
            <Ionicons name="bar-chart" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={runStackingAnalysis}
          >
            <Ionicons name="refresh" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Statistics */}
      {statistics && (
        <View style={styles.statisticsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{statistics.totalStacks}</Text>
            <Text style={styles.statLabel}>Stacks</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {((statistics.userEngagement.reviewedStacks / Math.max(statistics.totalStacks, 1)) * 100).toFixed(0)}%
            </Text>
            <Text style={styles.statLabel}>Reviewed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {(statistics.storageSavings / (1024 * 1024 * 1024)).toFixed(1)}GB
            </Text>
            <Text style={styles.statLabel}>Potential Savings</Text>
          </View>
        </View>
      )}

      {/* Stacks List */}
      {stacks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images" size={64} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>No Photo Stacks Found</Text>
          <Text style={styles.emptySubtitle}>
            Run analysis to find duplicates, bursts, and similar photos
          </Text>
          <TouchableOpacity style={styles.analyzeButton} onPress={runStackingAnalysis}>
            <Text style={styles.analyzeButtonText}>Analyze Photos</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlashList
          data={stackData}
          renderItem={renderStackItem}
          keyExtractor={item => item.key}
          estimatedItemSize={120}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Statistics Modal */}
      <Modal
        visible={showStatistics}
        animationType="slide"
        presentationStyle="page"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowStatistics(false)}>
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Stacking Statistics</Text>
            <View style={styles.modalSpacer} />
          </View>
          
          {statistics && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.statSection}>
                <Text style={styles.statSectionTitle}>Overview</Text>
                <View style={styles.statGrid}>
                  <View style={styles.statGridItem}>
                    <Text style={styles.statGridNumber}>{statistics.totalStacks}</Text>
                    <Text style={styles.statGridLabel}>Total Stacks</Text>
                  </View>
                  <View style={styles.statGridItem}>
                    <Text style={styles.statGridNumber}>{statistics.avgStackSize.toFixed(1)}</Text>
                    <Text style={styles.statGridLabel}>Avg Size</Text>
                  </View>
                </View>
              </View>

              <View style={styles.statSection}>
                <Text style={styles.statSectionTitle}>Stack Types</Text>
                <View style={styles.statGrid}>
                  <View style={styles.statGridItem}>
                    <Text style={styles.statGridNumber}>{statistics.stackTypes.duplicate}</Text>
                    <Text style={styles.statGridLabel}>Duplicates</Text>
                  </View>
                  <View style={styles.statGridItem}>
                    <Text style={styles.statGridNumber}>{statistics.stackTypes.burst}</Text>
                    <Text style={styles.statGridLabel}>Bursts</Text>
                  </View>
                  <View style={styles.statGridItem}>
                    <Text style={styles.statGridNumber}>{statistics.stackTypes.similar}</Text>
                    <Text style={styles.statGridLabel}>Similar</Text>
                  </View>
                  <View style={styles.statGridItem}>
                    <Text style={styles.statGridNumber}>{statistics.stackTypes.mixed}</Text>
                    <Text style={styles.statGridLabel}>Mixed</Text>
                  </View>
                </View>
              </View>

              <View style={styles.statSection}>
                <Text style={styles.statSectionTitle}>User Engagement</Text>
                <View style={styles.statGrid}>
                  <View style={styles.statGridItem}>
                    <Text style={styles.statGridNumber}>{statistics.userEngagement.reviewedStacks}</Text>
                    <Text style={styles.statGridLabel}>Reviewed</Text>
                  </View>
                  <View style={styles.statGridItem}>
                    <Text style={styles.statGridNumber}>{statistics.userEngagement.customSelections}</Text>
                    <Text style={styles.statGridLabel}>Custom Picks</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────
// STACK ITEM COMPONENT
// ─────────────────────────────────────────────────────────

const StackItem: React.FC<StackItemProps> = ({
  stack,
  photos,
  onPress,
  onBestPhotoSelect,
  onReviewToggle,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const bestPhoto = photos.find(p => p.id === stack.bestPhotoId);
  const bestQuality = stack.analysis.qualityScores[stack.bestPhotoId] || 0;
  const isProcessing = false; // Would track processing state

  const handlePhotoSelect = useCallback((photoId: string) => {
    setSelectedPhotoId(photoId);
  }, []);

  const handleConfirmSelection = useCallback(() => {
    if (selectedPhotoId && selectedPhotoId !== stack.bestPhotoId) {
      onBestPhotoSelect(stack.id, selectedPhotoId);
    }
    setSelectedPhotoId(null);
  }, [selectedPhotoId, stack.bestPhotoId, stack.id, onBestPhotoSelect]);

  const getTypeColor = useCallback(() => {
    switch (stack.type) {
      case "duplicate": return "#FF3B30";
      case "burst": return "#34C759";
      case "similar": return "#FF9500";
      case "mixed": return "#007AFF";
      default: return "#8E8E93";
    }
  }, [stack.type]);

  const getTypeIcon = useCallback(() => {
    switch (stack.type) {
      case "duplicate": return "copy";
      case "burst": return "camera";
      case "similar": return "images";
      case "mixed": return "layers";
      default: return "help";
    }
  }, [stack.type]);

  return (
    <View style={styles.stackItem}>
      <TouchableOpacity onPress={() => onPress(stack, photos)} style={styles.stackHeader}>
        <View style={styles.stackInfo}>
          <View style={styles.stackTitleRow}>
            <Ionicons name={getTypeIcon()} size={20} color={getTypeColor()} />
            <Text style={styles.stackTitle}>
              {stack.type.charAt(0).toUpperCase() + stack.type.slice(1)} Group
            </Text>
            <View style={[styles.typeBadge, { backgroundColor: getTypeColor() }]}>
              <Text style={styles.typeBadgeText}>{photos.length}</Text>
            </View>
          </View>
          
          <Text style={styles.stackSubtitle}>
            Best: {getQualityRating(bestQuality)} • Confidence: {(stack.confidence * 100).toFixed(0)}%
          </Text>
        </View>
        
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.stackDetails}>
          {/* Photo thumbnails */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photoThumbnails}>
              {photos.map((photo) => (
                <PhotoItem
                  key={photo.id}
                  photo={photo}
                  isSelected={selectedPhotoId === photo.id}
                  quality={stack.analysis.qualityScores[photo.id] || 0}
                  onSelect={handlePhotoSelect}
                  onPress={() => { /* Navigate to photo viewer */ }}
                />
              ))}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.stackActions}>
            <TouchableOpacity
              style={[styles.actionButton, selectedPhotoId && styles.actionButtonPrimary]}
              onPress={handleConfirmSelection}
              disabled={!selectedPhotoId || selectedPhotoId === stack.bestPhotoId}
            >
              <Text style={[
                styles.actionButtonText,
                selectedPhotoId && styles.actionButtonTextPrimary
              ]}>
                {selectedPhotoId ? "Set as Best" : "Select Best"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onReviewToggle(stack.id, !stack.userPreferences.reviewed)}
            >
              <Text style={styles.actionButtonText}>
                {stack.userPreferences.reviewed ? "Reviewed" : "Mark Reviewed"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.expandButton}
        onPress={() => setExpanded(!expanded)}
      >
        <Ionicons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={16} 
          color="#C7C7CC" 
        />
      </TouchableOpacity>
    </View>
  );
};

// ─────────────────────────────────────────────────────────
// PHOTO ITEM COMPONENT
// ─────────────────────────────────────────────────────────

const PhotoItem: React.FC<PhotoItemProps> = ({
  photo,
  isSelected,
  quality,
  onSelect,
  onPress,
}) => {
  const handlePress = useCallback(() => {
    if (isSelected) {
      onPress(photo);
    } else {
      onSelect(photo.id);
    }
  }, [isSelected, onSelect, onPress, photo]);

  return (
    <TouchableOpacity
      style={[
        styles.photoItem,
        isSelected && styles.photoItemSelected
      ]}
      onPress={handlePress}
    >
      {/* Photo thumbnail would go here */}
      <View style={styles.photoThumbnail}>
        <Ionicons name="image" size={24} color="#C7C7CC" />
      </View>
      
      {isSelected && (
        <View style={styles.photoSelectionOverlay}>
          <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
        </View>
      )}
      
      <View style={styles.photoQuality}>
        <Text style={styles.photoQualityText}>
          {getQualityRating(quality)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#8E8E93",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
  },
  headerActions: {
    flexDirection: "row",
    gap: 16,
  },
  headerButton: {
    padding: 8,
  },
  statisticsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
  },
  statLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#000000",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  analyzeButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  analyzeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  stackItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  stackInfo: {
    flex: 1,
  },
  stackTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  stackTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  stackSubtitle: {
    fontSize: 14,
    color: "#8E8E93",
  },
  expandButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  stackDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  photoThumbnails: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  photoItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#F2F2F7",
    position: "relative",
  },
  photoItemSelected: {
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  photoThumbnail: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  photoSelectionOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
  },
  photoQuality: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoQualityText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  stackActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    alignItems: "center",
  },
  actionButtonPrimary: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  actionButtonTextPrimary: {
    color: "#FFFFFF",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
  },
  modalSpacer: {
    width: 24,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  statSection: {
    marginBottom: 24,
  },
  statSectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statGridItem: {
    width: (width - 48) / 2,
    backgroundColor: "#F2F2F7",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  statGridNumber: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000000",
  },
  statGridLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
    textAlign: "center",
  },
});
