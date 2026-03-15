// AI-META-BEGIN
// AI-META: Shared albums screen with "Shared with me" and "Shared by me" sections
// OWNERSHIP: client/screens (shared album management)
// ENTRYPOINTS: Accessed via navigation from main app or AlbumsTab
// DEPENDENCIES: React Query, sharing API, components, theme system
// DANGER: Share token exposure; permission bypass; collaborator management
// CHANGE-SAFETY: Safe to modify UI; maintain permission checks; test sharing flows
// TESTS: Test share creation, collaborator management, activity feed, navigation
// AI-META-END

import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { 
  SharedAlbum, 
  CollaboratedAlbum, 
  ShareSettings,
  Album 
} from "@/types";
import { apiRequest } from "@/lib/query-client";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SharedAlbumsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // ═══════════════════════════════════════════════════════════
  // FETCH SHARED ALBUMS (React Query)
  // ═══════════════════════════════════════════════════════════

  const {
    data: sharedAlbums = { owned: [], collaborated: [] },
    isLoading,
    error,
    refetch,
  } = useQuery<{
    owned: SharedAlbum[];
    collaborated: CollaboratedAlbum[];
  }>({
    queryKey: ["shared-albums"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sharing/my-shares");
      const data = await res.json();
      return data;
    },
    refetchOnWindowFocus: true,
  });

  // ═══════════════════════════════════════════════════════════
  // CREATE SHARE MUTATION
  // ═══════════════════════════════════════════════════════════

  const createShareMutation = useMutation({
    mutationFn: async (data: { albumId: string; settings: ShareSettings }) => {
      const res = await apiRequest("POST", "/api/sharing/create", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-albums"] });
      setShowShareModal(false);
      setSelectedAlbum(null);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error) => {
      console.error("Failed to create share:", error);
      Alert.alert("Error", "Failed to create shared album");
    },
  });

  // ═══════════════════════════════════════════════════════════
  // UPDATE SHARE MUTATION
  // ═══════════════════════════════════════════════════════════

  const updateShareMutation = useMutation({
    mutationFn: async ({
      shareId,
      settings,
    }: {
      shareId: string;
      settings: Partial<ShareSettings>;
    }) => {
      const res = await apiRequest("PUT", `/api/sharing/${shareId}`, settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-albums"] });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error) => {
      console.error("Failed to update share:", error);
      Alert.alert("Error", "Failed to update share settings");
    },
  });

  // ═══════════════════════════════════════════════════════════
  // REMOVE COLLABORATOR MUTATION
  // ═══════════════════════════════════════════════════════════

  const removeCollaboratorMutation = useMutation({
    mutationFn: async ({
      shareId,
      userId,
    }: {
      shareId: string;
      userId: string;
    }) => {
      const res = await apiRequest(
        "DELETE",
        `/api/sharing/${shareId}/collaborators/${userId}`,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-albums"] });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error) => {
      console.error("Failed to remove collaborator:", error);
      Alert.alert("Error", "Failed to remove collaborator");
    },
  });

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Shared Albums",
      headerStyle: { backgroundColor: theme.backgroundRoot },
      headerTintColor: theme.text,
    });
  }, [navigation, theme]);

  const handleCreateShare = (settings: ShareSettings) => {
    if (!selectedAlbum) return;

    createShareMutation.mutate({
      albumId: selectedAlbum.id,
      settings,
    });
  };

  const handleUpdateShare = (
    shareId: string,
    settings: Partial<ShareSettings>,
  ) => {
    updateShareMutation.mutate({ shareId, settings });
  };

  const handleRemoveCollaborator = (shareId: string, userId: string) => {
    Alert.alert(
      "Remove Collaborator",
      "Are you sure you want to remove this collaborator?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeCollaboratorMutation.mutate({ shareId, userId }),
        },
      ],
    );
  };

  const renderSharedAlbumItem = (
    item: SharedAlbum | CollaboratedAlbum,
    section: "owned" | "collaborated",
  ) => (
    <Pressable
      style={[
        styles.albumItem,
        { backgroundColor: theme.backgroundCard, borderColor: theme.border },
      ]}
      onPress={() => {
        // Navigate to album detail with sharing info
        navigation.navigate("AlbumDetail", {
          albumId: item.albumId,
          albumTitle: item.albumTitle,
        });
      }}
    >
      <View style={styles.albumInfo}>
        <ThemedText type="h4" style={styles.albumTitle}>
          {item.albumTitle}
        </ThemedText>

        <View style={styles.albumMeta}>
          <View style={styles.permissionBadge}>
            <ThemedText
              type="caption"
              style={[
                styles.permissionText,
                {
                  color:
                    item.permissions === "admin"
                      ? Colors.light.accent
                      : theme.textSecondary,
                },
              ]}
            >
              {item.permissions.toUpperCase()}
            </ThemedText>
          </View>

          {section === "owned" && (
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {(item as SharedAlbum).viewCount} views
            </ThemedText>
          )}

          {section === "collaborated" && (
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Invited by {(item as CollaboratedAlbum).invitedBy}
            </ThemedText>
          )}
        </View>

        {(item as SharedAlbum).expiresAt && (
          <ThemedText type="caption" style={{ color: theme.textTertiary }}>
            Expires{" "}
            {new Date((item as SharedAlbum).expiresAt).toLocaleDateString()}
          </ThemedText>
        )}
      </View>

      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );

  const renderSection = (
    title: string,
    data: (SharedAlbum | CollaboratedAlbum)[],
    section: "owned" | "collaborated",
  ) => (
    <View style={styles.section}>
      <ThemedText
        type="h3"
        style={[styles.sectionTitle, { color: theme.text }]}
      >
        {title}
      </ThemedText>

      {data.length === 0 ? (
        <EmptyState
          image={require("../../assets/images/empty-albums.png")}
          title={section === "owned" ? "No shared albums" : "No collaborations"}
          subtitle={
            section === "owned"
              ? "Share an album to see it here"
              : "Accept invitations to see them here"
          }
        />
      ) : (
        data.map((item) => (
          <View key={item.id} style={styles.albumItemContainer}>
            {renderSharedAlbumItem(item, section)}
          </View>
        ))
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <ThemedText type="body">Loading shared albums...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <EmptyState
          image={require("../../assets/images/empty-albums.png")}
          title="Error loading shared albums"
          subtitle="Please check your connection and try again"
        />
        <Button onPress={() => refetch()} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
      >
        {renderSection("Shared by me", sharedAlbums.owned, "owned")}
        {renderSection(
          "Shared with me",
          sharedAlbums.collaborated,
          "collaborated",
        )}

        {sharedAlbums.owned.length === 0 &&
          sharedAlbums.collaborated.length === 0 && (
            <EmptyState
              image={require("../../assets/images/empty-albums.png")}
              title="No shared albums"
              subtitle="Start sharing albums with others to collaborate"
            />
          )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  albumItemContainer: {
    marginBottom: Spacing.sm,
  },
  albumItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  albumInfo: {
    flex: 1,
  },
  albumTitle: {
    marginBottom: Spacing.xs,
  },
  albumMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  permissionBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  permissionText: {
    fontSize: 10,
    fontWeight: "600",
  },
  retryButton: {
    marginTop: Spacing.lg,
  },
});
