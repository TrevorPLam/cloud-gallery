// AI-META-BEGIN
// AI-META: Duplicate detection screen for comparing and resolving duplicate photos
// OWNERSHIP: client/screens
// ENTRYPOINTS: navigated from RootStackNavigator Duplicates route
// DEPENDENCIES: react-query, react-navigation, @expo/vector-icons, react-native-fast-image
// DANGER: Performance-critical for large photo libraries; virtualization required
// CHANGE-SAFETY: Maintain API response structure compatibility; optimize list rendering
// TESTS: DuplicatesScreen.test.tsx for UI behavior, integration tests for API calls
// AI-META-END

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/theme";

// Types
type RootStackParamList = {
  Duplicates: undefined;
  PhotoDetail: { photoId: string; initialIndex: number };
};

type DuplicatesRouteProp = RouteProp<RootStackParamList, "Duplicates">;

// API Types (matching server response)
interface PhotoQualityMetrics {
  resolution: number;
  fileSize: number;
  sharpness: number;
  overall: number;
}

interface DuplicatePhoto {
  id: string;
  uri: string;
  filename: string;
  width: number;
  height: number;
  fileSize: number;
  createdAt: string;
  perceptualHash?: string;
  qualityMetrics: PhotoQualityMetrics;
  isBest: boolean;
}

interface DuplicateGroup {
  groupId: string;
  photos: DuplicatePhoto[];
  groupType: "exact" | "similar" | "burst";
  averageSimilarity: number;
}

interface DuplicateResponse {
  duplicateGroups: DuplicateGroup[];
  count: number;
  config: {
    hammingThreshold: number;
    burstTimeWindow: number;
    minBurstSize: number;
  };
}

interface ResolutionRequest {
  resolutions: {
    groupId: string;
    keepPhotoIds: string[];
    deletePhotoIds: string[];
  }[];
}

// Constants
const SCREEN_HEIGHT = Dimensions.get("window").height;
const ITEM_HEIGHT = 200; // Height for each duplicate group
const SEPARATOR_HEIGHT = 16;
const INITIAL_NUM =
  Math.ceil(SCREEN_HEIGHT / (ITEM_HEIGHT + SEPARATOR_HEIGHT)) + 2;

// API Functions
const fetchDuplicates = async (): Promise<DuplicateResponse> => {
  const response = await fetch("/api/photos/duplicates");
  if (!response.ok) {
    throw new Error("Failed to fetch duplicates");
  }
  return response.json();
};

const resolveDuplicates = async (
  resolutions: ResolutionRequest,
): Promise<{ resolved: number; total: number }> => {
  const response = await fetch("/api/photos/duplicates/resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resolutions),
  });

  if (!response.ok) {
    throw new Error("Failed to resolve duplicates");
  }

  return response.json();
};

// Memoized Photo Item Component
interface PhotoItemProps {
  photo: DuplicatePhoto;
  isSelected: boolean;
  onToggle: (photoId: string) => void;
  onPress: (photo: DuplicatePhoto) => void;
}

const PhotoItem = React.memo<PhotoItemProps>(
  ({ photo, isSelected, onToggle, onPress }) => {
    const { theme } = useTheme();

    const handlePress = useCallback(() => {
      onPress(photo);
    }, [photo, onPress]);

    const handleToggle = useCallback(() => {
      onToggle(photo.id);
    }, [photo.id, onToggle]);

    return (
      <Pressable style={styles.photoContainer} onPress={handlePress}>
        <Image
          source={{ uri: photo.uri }}
          style={styles.photoImage}
          resizeMode="cover"
        />

        {/* Best Photo Badge */}
        {photo.isBest && (
          <View style={[styles.bestBadge, { backgroundColor: theme.accent }]}>
            <Feather name="star" size={12} color="white" />
            <ThemedText style={styles.bestBadgeText}>Best</ThemedText>
          </View>
        )}

        {/* Selection Checkbox */}
        <Pressable
          style={[styles.checkbox, isSelected && styles.checkboxSelected]}
          onPress={handleToggle}
        >
          {isSelected && <Feather name="check" size={16} color="white" />}
        </Pressable>

        {/* Photo Info */}
        <View style={styles.photoInfo}>
          <ThemedText style={[styles.photoFilename]} numberOfLines={1}>
            {photo.filename}
          </ThemedText>
          <ThemedText style={[styles.photoDetails]}>
            {photo.width}×{photo.height} •{" "}
            {(photo.fileSize / (1024 * 1024)).toFixed(1)}MB
          </ThemedText>
          <ThemedText style={[styles.qualityScore]}>
            Quality: {Math.round(photo.qualityMetrics.overall)}%
          </ThemedText>
        </View>
      </Pressable>
    );
  },
);

PhotoItem.displayName = "PhotoItem";

// Memoized Duplicate Group Component
interface DuplicateGroupItemProps {
  group: DuplicateGroup;
  selectedPhotos: Set<string>;
  onPhotoToggle: (photoId: string) => void;
  onPhotoPress: (photo: DuplicatePhoto) => void;
}

const DuplicateGroupItem = React.memo<DuplicateGroupItemProps>(
  ({ group, selectedPhotos, onPhotoToggle, onPhotoPress }) => {
    const { theme } = useTheme();

    const getGroupTypeIcon = useCallback(() => {
      switch (group.groupType) {
        case "exact":
          return "copy";
        case "burst":
          return "zap";
        default:
          return "image";
      }
    }, [group.groupType]);

    const getGroupTypeColor = useCallback(() => {
      switch (group.groupType) {
        case "exact":
          return "#FF6B6B";
        case "burst":
          return "#4ECDC4";
        default:
          return "#45B7D1";
      }
    }, [group.groupType]);

    return (
      <Card style={styles.groupContainer}>
        <View style={styles.groupHeader}>
          <View style={styles.groupTitle}>
            <Feather
              name={getGroupTypeIcon()}
              size={16}
              color={getGroupTypeColor()}
            />
            <ThemedText style={[styles.groupTitleText]}>
              {group.groupType === "exact"
                ? "Exact Duplicates"
                : group.groupType === "burst"
                  ? "Burst Sequence"
                  : "Similar Photos"}
            </ThemedText>
          </View>

          <View style={styles.groupStats}>
            <ThemedText style={[styles.groupCount]}>
              {group.photos.length} photos
            </ThemedText>
            <ThemedText style={[styles.similarityScore]}>
              {Math.round(group.averageSimilarity * 100)}% similar
            </ThemedText>
          </View>
        </View>

        <FlatList
          data={group.photos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(photo) => photo.id}
          renderItem={({ item }) => (
            <PhotoItem
              photo={item}
              isSelected={selectedPhotos.has(item.id)}
              onToggle={onPhotoToggle}
              onPress={onPhotoPress}
            />
          )}
          contentContainerStyle={styles.photosList}
        />
      </Card>
    );
  },
);

DuplicateGroupItem.displayName = "DuplicateGroupItem";

// Main Screen Component
export default function DuplicatesScreen() {
  const navigation = useNavigation();
  const route = useRoute<DuplicatesRouteProp>();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Query for duplicate groups
  const {
    data: duplicatesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["duplicates"],
    queryFn: fetchDuplicates,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation for resolving duplicates
  const resolveMutation = useMutation({
    mutationFn: resolveDuplicates,
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["duplicates"] });

      // Snapshot the previous value
      const previousDuplicates = queryClient.getQueryData(["duplicates"]);

      return { previousDuplicates };
    },
    onError: (error, variables, context) => {
      console.error("Failed to resolve duplicates:", error);
      Alert.alert("Error", "Failed to resolve duplicates. Please try again.");
    },
    onSuccess: (data, variables) => {
      Alert.alert(
        "Success",
        `Resolved ${data.resolved} of ${data.total} duplicate groups`,
      );
      setSelectedPhotos(new Set());
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["duplicates"] });
    },
  });

  // Handle photo selection
  const handlePhotoToggle = useCallback((photoId: string) => {
    setSelectedPhotos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  }, []);

  // Handle photo press (navigate to detail)
  const handlePhotoPress = useCallback(
    (photo: DuplicatePhoto) => {
      // Find index in the current group for proper navigation
      const group = duplicatesData?.duplicateGroups.find((g) =>
        g.photos.some((p) => p.id === photo.id),
      );

      if (group) {
        const index = group.photos.findIndex((p) => p.id === photo.id);
        navigation.navigate("PhotoDetail", {
          photoId: photo.id,
          initialIndex: index,
        });
      }
    },
    [navigation, duplicatesData],
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Handle resolve action
  const handleResolve = useCallback(() => {
    if (!duplicatesData || selectedPhotos.size === 0) {
      Alert.alert("No Selection", "Please select photos to resolve.");
      return;
    }

    Alert.alert(
      "Resolve Duplicates",
      `Are you sure you want to resolve the selected duplicates? This will delete unselected photos in each group.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resolve",
          style: "destructive",
          onPress: () => {
            // Group selected photos by their group
            const resolutions: ResolutionRequest["resolutions"] = [];

            duplicatesData.duplicateGroups.forEach((group) => {
              const groupSelectedPhotos = group.photos.filter((p) =>
                selectedPhotos.has(p.id),
              );
              const groupUnselectedPhotos = group.photos.filter(
                (p) => !selectedPhotos.has(p.id),
              );

              if (
                groupSelectedPhotos.length > 0 &&
                groupUnselectedPhotos.length > 0
              ) {
                resolutions.push({
                  groupId: group.groupId,
                  keepPhotoIds: groupSelectedPhotos.map((p) => p.id),
                  deletePhotoIds: groupUnselectedPhotos.map((p) => p.id),
                });
              }
            });

            if (resolutions.length > 0) {
              resolveMutation.mutate({ resolutions });
            } else {
              Alert.alert(
                "Invalid Selection",
                "Please select at least one photo to keep in each group.",
              );
            }
          },
        },
      ],
    );
  }, [duplicatesData, selectedPhotos, resolveMutation]);

  // Optimized FlatList configuration
  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    [],
  );

  const keyExtractor = useCallback(
    (group: DuplicateGroup) => group.groupId,
    [],
  );

  const renderGroup = useCallback(
    ({ item }: { item: DuplicateGroup }) => (
      <DuplicateGroupItem
        group={item}
        selectedPhotos={selectedPhotos}
        onPhotoToggle={handlePhotoToggle}
        onPhotoPress={handlePhotoPress}
      />
    ),
    [selectedPhotos, handlePhotoToggle, handlePhotoPress],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <View style={[styles.emptyContainer]}>
        <Feather name="check-circle" size={64} color={theme.textSecondary} />
        <ThemedText style={[styles.emptyTitle]}>No Duplicates Found</ThemedText>
        <ThemedText style={[styles.emptySubtitle]}>
          Your photo library looks clean! No duplicate photos were detected.
        </ThemedText>
      </View>
    ),
    [theme],
  );

  const renderHeader = useMemo(
    () => (
      <View style={[styles.header]}>
        <ThemedText style={[styles.title]}>Duplicate Photos</ThemedText>
        {duplicatesData && (
          <View style={styles.headerStats}>
            <ThemedText style={[styles.headerStat]}>
              {duplicatesData.duplicateGroups.length} groups
            </ThemedText>
            <ThemedText style={[styles.headerStat]}>
              {duplicatesData.duplicateGroups.reduce(
                (sum, group) => sum + group.photos.length,
                0,
              )}{" "}
              photos
            </ThemedText>
          </View>
        )}
      </View>
    ),
    [theme, duplicatesData],
  );

  const renderFooter = useMemo(() => {
    if (!duplicatesData || duplicatesData.duplicateGroups.length === 0) {
      return null;
    }

    return (
      <View style={[styles.footer]}>
        <ThemedText style={[styles.selectedCount]}>
          {selectedPhotos.size} photos selected
        </ThemedText>
        <Button
          onPress={handleResolve}
          disabled={selectedPhotos.size === 0 || resolveMutation.isPending}
        >
          <ThemedText>
            Resolve {selectedPhotos.size > 0 ? `(${selectedPhotos.size})` : ""}
          </ThemedText>
        </Button>
      </View>
    );
  }, [
    theme,
    duplicatesData,
    selectedPhotos,
    handleResolve,
    resolveMutation.isPending,
  ]);

  if (error) {
    return (
      <View style={[styles.container]}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={64} color={Colors.light.error} />
          <ThemedText style={[styles.errorTitle]}>
            Error Loading Duplicates
          </ThemedText>
          <ThemedText style={[styles.errorSubtitle]}>
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </ThemedText>
          <Button onPress={() => refetch()}>
            <ThemedText>Retry</ThemedText>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container]}>
      <FlatList
        data={duplicatesData?.duplicateGroups || []}
        renderItem={renderGroup}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={isLoading ? null : ListEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.textSecondary}
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={true}
        removeClippedSubviews={Platform.OS === "android"}
        maxToRenderPerBatch={Platform.OS === "android" ? 3 : 5}
        updateCellsBatchingPeriod={Platform.OS === "android" ? 100 : 50}
        initialNumToRender={INITIAL_NUM}
        windowSize={Platform.OS === "android" ? 11 : 21}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  headerStats: {
    flexDirection: "row",
    gap: 16,
  },
  headerStat: {
    fontSize: 14,
  },
  groupContainer: {
    marginBottom: 16,
    padding: 16,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  groupTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupTitleText: {
    fontSize: 16,
    fontWeight: "600",
  },
  groupStats: {
    alignItems: "flex-end",
  },
  groupCount: {
    fontSize: 12,
    marginBottom: 2,
  },
  similarityScore: {
    fontSize: 12,
  },
  photosList: {
    gap: 12,
  },
  photoContainer: {
    width: 120,
    position: "relative",
  },
  photoImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  bestBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  bestBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  checkbox: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: Colors.light.accent,
  },
  photoInfo: {
    marginTop: 8,
  },
  photoFilename: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  photoDetails: {
    fontSize: 10,
    marginBottom: 2,
  },
  qualityScore: {
    fontSize: 10,
  },
  footer: {
    padding: 16,
    paddingTop: 0,
  },
  selectedCount: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
});
