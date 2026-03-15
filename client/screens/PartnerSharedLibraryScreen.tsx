// AI-META-BEGIN
// AI-META: Partner shared library screen with photo grid, save functionality, and activity tracking
// OWNERSHIP: client/screens (partner sharing library view)
// ENTRYPOINTS: Navigated from PartnerSharingScreen when user taps "View Library"
// DEPENDENCIES: React Query, PhotoGrid component, partner sharing API, theme system
// DANGER: Partner photo access bypass; unauthorized photo saving; data exposure
// CHANGE-SAFETY: Maintain permission checks; test photo access controls; validate API responses
// TESTS: Test photo loading, save functionality, pagination, error handling, accessibility
// AI-META-END

import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Alert,
  RefreshControl,
  Platform,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { Photo } from "@/types";
import { apiRequest } from "@/lib/query-client";
import { PhotoGrid } from "@/components/PhotoGrid";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type PartnerSharedLibraryRouteProp = RouteProp<
  RootStackParamList,
  "PartnerSharedLibrary"
>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SharedPhoto extends Photo {
  sharedBy: string;
  isSavedByPartner: boolean;
}

interface SharedPhotosResponse {
  photos: SharedPhoto[];
  hasMore: boolean;
  totalCount: number;
}

export default function PartnerSharedLibraryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PartnerSharedLibraryRouteProp>();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { partnershipId, partnerName } = route.params;
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // FETCH SHARED PHOTOS (React Query)
  // ═══════════════════════════════════════════════════════════

  const {
    data: sharedPhotosData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["partner-sharing", "shared-photos", partnershipId, page],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/partner-sharing/shared-photos/${partnershipId}?page=${page}&limit=50`
      );
      return response.data as SharedPhotosResponse;
    },
    enabled: !!partnershipId,
  });

  // ═══════════════════════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════════════════════

  const savePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const response = await apiRequest(
        `/api/partner-sharing/shared-photos/${photoId}/save`,
        {
          method: "PUT",
          body: JSON.stringify({ partnershipId }),
        }
      );
      return response.data;
    },
    onSuccess: (_, photoId) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Photo Saved", "Photo has been saved to your library.");
      // Update the local state to mark photo as saved
      queryClient.setQueryData(
        ["partner-sharing", "shared-photos", partnershipId, page],
        (oldData: SharedPhotosResponse | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            photos: oldData.photos.map((photo) =>
              photo.id === photoId
                ? { ...photo, isSavedByPartner: true }
                : photo
            ),
          };
        }
      );
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to save photo"
      );
    },
  });

  // ═══════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════

  const handlePhotoPress = (photo: SharedPhoto, index: number) => {
    // Navigate to photo detail with shared context
    navigation.navigate("PhotoDetail", {
      photoId: photo.id,
      sharedContext: {
        partnershipId,
        partnerName,
        isSharedPhoto: true,
      },
    });
  };

  const handlePhotoLongPress = (photo: SharedPhoto) => {
    if (photo.isSavedByPartner) {
      Alert.alert("Already Saved", "This photo is already in your library.");
      return;
    }

    Alert.alert(
      "Save Photo",
      `Save "${photo.filename}" to your library?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: () => savePhotoMutation.mutate(photo.id),
          style: "default",
        },
      ]
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleLoadMore = () => {
    if (sharedPhotosData?.hasMore && !isLoading) {
      setPage(page + 1);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════

  const renderPhotoItem = (photo: SharedPhoto, index: number) => (
    <View style={styles.photoItemContainer}>
      <PhotoGrid
        photos={[photo]}
        onPhotoPress={handlePhotoPress}
        onPhotoLongPress={handlePhotoLongPress}
        contentContainerStyle={styles.photoGrid}
      />
      {photo.isSavedByPartner && (
        <View style={[styles.savedIndicator, { backgroundColor: theme.success }]}>
          <Feather name="check" size={12} color="white" />
        </View>
      )}
      <View style={styles.photoInfo}>
        <ThemedText style={styles.sharedBy} numberOfLines={1}>
          Shared by {photo.sharedBy}
        </ThemedText>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <ThemedText style={styles.title}>{partnerName}'s Library</ThemedText>
      <ThemedText style={styles.subtitle}>
        {sharedPhotosData?.totalCount || 0} photos shared
      </ThemedText>
      
      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Feather name="info" size={16} color={theme.primary} />
          <ThemedText style={styles.infoText}>
            Long press on any photo to save it to your library
          </ThemedText>
        </View>
      </Card>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="image" size={48} color={theme.textSecondary} />
      <ThemedText style={styles.emptyTitle}>No Shared Photos</ThemedText>
      <ThemedText style={styles.emptySubtitle}>
        {partnerName} hasn't shared any photos yet
      </ThemedText>
    </View>
  );

  // ═══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight }]}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <ThemedText style={styles.errorTitle}>Error Loading Photos</ThemedText>
          <ThemedText style={styles.errorSubtitle}>
            Please check your connection and try again.
          </ThemedText>
          <Button
            onPress={handleRefresh}
            style={styles.retryButton}
          >
            <Feather name="refresh-cw" size={16} color="white" />
            <ThemedText>Retry</ThemedText>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <PhotoGrid
        photos={sharedPhotosData?.photos || []}
        onPhotoPress={handlePhotoPress}
        onPhotoLongPress={handlePhotoLongPress}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={renderEmptyState()}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: Spacing.lg,
  },
  infoCard: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  photoItemContainer: {
    marginBottom: Spacing.md,
  },
  photoGrid: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  savedIndicator: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
  },
  photoInfo: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  sharedBy: {
    fontSize: 12,
    opacity: 0.7,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  errorSubtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
