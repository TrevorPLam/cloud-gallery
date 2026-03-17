// AI-META-BEGIN
// AI-META: Main photos screen with grid, date grouping, and upload FAB
// OWNERSHIP: client/screens (photo management)
// ENTRYPOINTS: Default tab in MainTabNavigator
// DEPENDENCIES: expo-image-picker, storage lib, PhotoGrid, FAB, haptics
// DANGER: Image picker multi-select; photo ID generation; haptics web incompatible
// CHANGE-SAFETY: Safe to modify UI; upload logic affects storage; test picker permissions
// TESTS: Test photo upload, verify date grouping, check empty state, validate haptics
// AI-META-END

import React, { useCallback } from "react";
import { StyleSheet, View, Platform, Pressable, Text } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Photo } from "@/types";
import { groupPhotosByDate } from "@/lib/storage";
import {
  apiRequest,
  AuthenticationError,
  ValidationError,
  NetworkError,
  ServerError,
} from "@/lib/query-client";
import { encryptAndUpload, encryptAndUploadVideo } from "@/lib/upload-encrypted";
import { PhotoGrid } from "@/components/PhotoGrid";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { MemoriesBanner } from "@/components/MemoriesBanner";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PhotosScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // ═══════════════════════════════════════════════════════════
  // ERROR MESSAGE FORMATTING
  // ═══════════════════════════════════════════════════════════

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof AuthenticationError) {
      return "Session expired. Please log in again.";
    }
    if (error instanceof NetworkError) {
      return "No internet connection. Showing cached data.";
    }
    if (error instanceof ServerError) {
      return "Server error. Please try again later.";
    }
    if (error instanceof ValidationError) {
      return `Validation error: ${error.validationDetails.map((d) => d.message).join(", ")}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred";
  };

  const getErrorTitle = (error: unknown): string => {
    if (error instanceof AuthenticationError) {
      return "Authentication Required";
    }
    if (error instanceof NetworkError) {
      return "Connection Error";
    }
    if (error instanceof ServerError) {
      return "Server Error";
    }
    if (error instanceof ValidationError) {
      return "Invalid Data";
    }
    return "Failed to load photos";
  };

  // ═══════════════════════════════════════════════════════════
  // FETCH PHOTOS (React Query)
  // ═══════════════════════════════════════════════════════════
  // useQuery automatically:
  //   • Fetches data when component mounts
  //   • Handles loading/error states
  //   • Caches results
  //   • Refetches when needed

  const {
    data: photos = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Photo[]>({
    queryKey: ["photos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/photos");
      const data = await res.json();
      return data.photos;
    },
    // Refetch when screen focused
    refetchOnWindowFocus: true,
  });

  // ═══════════════════════════════════════════════════════════
  // ADD PHOTO/VIDEO MUTATION (React Query)
  // ═══════════════════════════════════════════════════════════
  // useMutation for creating/updating/deleting data
  // Includes OPTIMISTIC UPDATE (show immediately, sync later)

  const addPhotoMutation = useMutation({
    // The actual API call - handle both photos and videos
    mutationFn: async (
      photo: Omit<Photo, "id" | "createdAt" | "modifiedAt">,
    ) => {
      // Prepare metadata for upload
      const metadata = {
        width: photo.width,
        height: photo.height,
        filename: photo.filename,
        isVideo: photo.isVideo || false,
        videoDuration: photo.videoDuration,
        tags: photo.tags || [],
        notes: photo.notes,
        isPrivate: photo.isPrivate || false,
      };

      // Use appropriate upload function based on file type
      const uploadResult = photo.isVideo 
        ? await encryptAndUploadVideo(photo.uri, metadata)
        : await encryptAndUpload(photo.uri, metadata);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Upload failed");
      }

      // Create the photo record with server response
      const photoData = {
        ...photo,
        ...metadata,
        videoThumbnailUri: uploadResult.file?.encryptionMetadata ? metadata.videoThumbnailUri : undefined,
      };

      // Send to server to create photo record
      const res = await apiRequest("POST", "/api/photos", photoData);
      return res.json();
    },

    // BEFORE sending to server (optimistic update)
    onMutate: async (newPhoto) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["photos"] });

      // Save current state (for rollback if error)
      const previousPhotos = queryClient.getQueryData(["photos"]);

      // Optimistically update UI (show photo immediately with temp ID)
      queryClient.setQueryData(["photos"], (old: Photo[] = []) => [
        {
          ...newPhoto,
          id: "temp-" + Date.now(), // Temporary ID until server responds
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        } as Photo,
        ...old,
      ]);

      // Return context for rollback
      return { previousPhotos };
    },

    // If API call FAILS
    onError: (err, newPhoto, context) => {
      // Rollback to previous state
      if (context?.previousPhotos) {
        queryClient.setQueryData(["photos"], context.previousPhotos);
      }

      // Log error for debugging
      console.error("Failed to upload photo:", err);

      // Show user-friendly error message
      let errorMessage = "Failed to upload photo";
      if (err instanceof ValidationError) {
        errorMessage = `Upload failed: ${err.validationDetails.map((d) => d.message).join(", ")}`;
      } else if (err instanceof NetworkError) {
        errorMessage =
          "Cannot upload while offline. Please check your connection.";
      } else if (err instanceof ServerError) {
        errorMessage = "Server error. Please try again later.";
      } else if (err instanceof Error) {
        errorMessage = `Upload failed: ${err.message}`;
      }

      // TODO: Show toast notification with errorMessage
      // For now, just log it
      console.warn(errorMessage);
    },

    // After API call completes (success OR failure)
    onSettled: () => {
      // Refetch from server to get accurate data
      // (Real IDs, server timestamps, etc.)
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
  });

  // ═══════════════════════════════════════════════════════════
  // UPLOAD PHOTO HANDLER
  // ═══════════════════════════════════════════════════════════

  const handleUpload = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // AI-NOTE: Image picker now supports both photos and videos; generates unique IDs using timestamp + random
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // Include both images and videos
      allowsMultipleSelection: true,
      quality: 1,
      exif: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      // Process each selected asset sequentially (photos and videos)
      for (const asset of result.assets) {
        // Determine if this is a video
        const isVideoAsset = asset.type === 'video' || asset.uri.endsWith('.mp4') || asset.uri.endsWith('.mov') || asset.uri.endsWith('.avi');
        
        const newPhoto = {
          uri: asset.uri,
          width: asset.width || 0,
          height: asset.height || 0,
          filename: asset.fileName || (isVideoAsset ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`),
          isFavorite: false,
          albumIds: [] as string[],
          // Add video-specific fields if this is a video
          isVideo: isVideoAsset,
          videoDuration: isVideoAsset ? (asset.duration || 0) : undefined,
        };

        // Send to server (with optimistic update)
        addPhotoMutation.mutate(newPhoto);
      }

      // Success haptic feedback
      if (Platform.OS !== "web" && result.assets.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const handlePhotoPress = (photo: Photo, index: number) => {
    navigation.navigate("PhotoDetail", {
      photoId: photo.id,
      initialIndex: index,
    });
  };

  const handleMemoryPress = (memory: any) => {
    navigation.navigate("MemoryDetailScreen", { memoryId: memory.id });
  };

  const visiblePhotos = photos.filter((p) => !p.isPrivate);
  const groupedData = groupPhotosByDate(visiblePhotos);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {isLoading ? (
        <View style={{ paddingTop: headerHeight + Spacing.xl }}>
          <SkeletonLoader type="photos" count={15} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <EmptyState
            image={require("../../assets/images/empty-photos.png")}
            title={getErrorTitle(error)}
            subtitle={getErrorMessage(error)}
          />
          <Pressable
            style={[styles.retryButton, { backgroundColor: theme.accent }]}
            onPress={() => refetch()}
          >
            <Feather
              name="refresh-cw"
              size={20}
              color={theme.buttonText}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={{ color: theme.buttonText, fontWeight: "600" }}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <MemoriesBanner onPress={handleMemoryPress} />
          <PhotoGrid
            photos={visiblePhotos}
            groupedData={groupedData}
            onPhotoPress={handlePhotoPress}
            showSectionHeaders={true}
            contentContainerStyle={{
              paddingTop: Spacing.md, // Reduced since banner is at top
              paddingBottom: tabBarHeight + Spacing.fabSize + Spacing["3xl"],
              paddingHorizontal: Spacing.lg,
            }}
            scrollIndicatorInsets={{ bottom: insets.bottom }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <EmptyState
                  image={require("../../assets/images/empty-photos.png")}
                  title="No photos yet"
                  subtitle="Tap the + button to upload your first photo"
                />
              </View>
            }
          />
        </>
      )}
      <FloatingActionButton onPress={handleUpload} icon="plus" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 400,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
