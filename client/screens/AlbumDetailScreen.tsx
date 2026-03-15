// AI-META-BEGIN
// AI-META: Album detail screen with photo grid and modal for adding photos
// OWNERSHIP: client/screens (album management)
// ENTRYPOINTS: Navigated from AlbumsScreen via AlbumCard press
// DEPENDENCIES: storage lib, PhotoGrid, modal, haptics, navigation
// DANGER: Photo removal via long press; modal state management; album not found handling
// CHANGE-SAFETY: Risky to change data flow; safe to modify UI; test photo add/remove thoroughly
// TESTS: Test adding/removing photos, verify modal interaction, check haptics, handle edge cases
// AI-META-END

import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Platform,
  Modal,
  FlatList,
  Dimensions,
  TextInput,
  Alert,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Photo, Album, ShareSettings } from "@/types";
import { apiRequest } from "@/lib/query-client";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// AI-NOTE: Photo grid sizing calculated at module load; shared across screens
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const GAP = Spacing.photoGap;
const PHOTO_SIZE =
  (SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1) - Spacing.lg * 2) / NUM_COLUMNS;

type AlbumDetailRouteProp = RouteProp<RootStackParamList, "AlbumDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AlbumDetailScreen() {
  const route = useRoute<AlbumDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { albumId, albumTitle } = route.params;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    permissions: "view",
    password: "",
    expiresAt: null,
  });

  // ═══════════════════════════════════════════════════════════
  // FETCH ALBUM DATA (React Query)
  // ═══════════════════════════════════════════════════════════

  const { data: album } = useQuery<Album>({
    queryKey: ["albums", albumId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/albums/${albumId}`);
      const data = await res.json();
      return data.album;
    },
  });

  const { data: allPhotos = [] } = useQuery<Photo[]>({
    queryKey: ["photos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/photos");
      const data = await res.json();
      return data.photos;
    },
  });

  // Filter photos that are in this album
  const albumPhotos = allPhotos.filter((p) => album?.photoIds?.includes(p.id));

  // ═══════════════════════════════════════════════════════════
  // ADD PHOTO TO ALBUM MUTATION (React Query)
  // ═══════════════════════════════════════════════════════════
  // Task 5.3: Add photos to album with optimistic update

  const addPhotosMutation = useMutation({
    mutationFn: async (photoIds: string[]) => {
      // Add each photo to the album
      await Promise.all(
        photoIds.map((photoId) =>
          apiRequest("POST", `/api/albums/${albumId}/photos`, { photoId }),
        ),
      );
    },

    // BEFORE sending to server (optimistic update)
    onMutate: async (photoIds) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["albums", albumId] });

      // Save current state for rollback
      const previousAlbum = queryClient.getQueryData(["albums", albumId]);

      // Optimistically update album to include new photos
      queryClient.setQueryData(
        ["albums", albumId],
        (old: Album | undefined) => {
          if (!old) return old;
          return {
            ...old,
            photoIds: [...old.photoIds, ...photoIds],
          };
        },
      );

      return { previousAlbum };
    },

    // If API call FAILS
    onError: (err, photoIds, context) => {
      // Rollback to previous state
      if (context?.previousAlbum) {
        queryClient.setQueryData(["albums", albumId], context.previousAlbum);
      }
      console.error("Failed to add photos to album:", err);
    },

    // After API call completes (success OR failure)
    onSettled: () => {
      // Refetch both albums and photos (dual cache invalidation)
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
  });

  // ═══════════════════════════════════════════════════════════
  // CREATE SHARE MUTATION
  // ═══════════════════════════════════════════════════════════

  const createShareMutation = useMutation({
    mutationFn: async (settings: ShareSettings) => {
      const res = await apiRequest("POST", "/api/sharing/create", {
        albumId,
        settings,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shared-albums"] });
      setShowShareModal(false);
      Alert.alert("Album Shared!", `Share link: ${data.share.shareToken}`, [
        { text: "OK" },
        {
          text: "Copy Link",
          onPress: () => copyToClipboard(data.share.shareToken),
        },
      ]);
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
  // REMOVE PHOTO FROM ALBUM MUTATION (React Query)
  // ═══════════════════════════════════════════════════════════
  // Task 5.3: Remove photo from album with optimistic update

  const removePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await apiRequest(
        "DELETE",
        `/api/albums/${albumId}/photos/${photoId}`,
      );
      return res.json();
    },

    // BEFORE sending to server (optimistic update)
    onMutate: async (photoId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["albums", albumId] });

      // Save current state for rollback
      const previousAlbum = queryClient.getQueryData(["albums", albumId]);

      // Optimistically remove photo from album
      queryClient.setQueryData(
        ["albums", albumId],
        (old: Album | undefined) => {
          if (!old) return old;
          return {
            ...old,
            photoIds: old.photoIds.filter((id) => id !== photoId),
          };
        },
      );

      return { previousAlbum };
    },

    // If API call FAILS
    onError: (err, photoId, context) => {
      // Rollback to previous state
      if (context?.previousAlbum) {
        queryClient.setQueryData(["albums", albumId], context.previousAlbum);
      }
      console.error("Failed to remove photo from album:", err);
    },

    // After API call completes (success OR failure)
    onSettled: () => {
      // Refetch both albums and photos (dual cache invalidation)
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
  });

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: albumTitle,
      headerRight: () => (
        <View style={styles.headerButtons}>
          <Pressable
            onPress={() => {
              setSelectedPhotoIds([]);
              setShowAddModal(true);
            }}
            hitSlop={8}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              marginRight: Spacing.md,
            })}
          >
            <Feather name="plus" size={24} color={theme.text} />
          </Pressable>
          <Pressable
            onPress={() => setShowShareModal(true)}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Feather name="share-2" size={24} color={theme.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, albumTitle, theme]);

  const handlePhotoPress = (photo: Photo) => {
    const index = allPhotos.findIndex((p) => p.id === photo.id);
    navigation.navigate("PhotoDetail", {
      photoId: photo.id,
      initialIndex: index,
    });
  };

  const handlePhotoLongPress = async (photo: Photo) => {
    // AI-NOTE: Heavy haptic signals destructive action; removes photo from album only
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    removePhotoMutation.mutate(photo.id);
  };

  const handleToggleSelect = (photoId: string) => {
    // AI-NOTE: Selection haptic is subtle; toggling updates local state for multi-select
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setSelectedPhotoIds((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId],
    );
  };

  const handleAddPhotos = async () => {
    if (selectedPhotoIds.length === 0) return;
    addPhotosMutation.mutate(selectedPhotoIds);
    setShowAddModal(false);
    setSelectedPhotoIds([]);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCreateShare = () => {
    createShareMutation.mutate(shareSettings);
  };

  const availablePhotos = allPhotos.filter(
    // AI-NOTE: Filter out photos already in album to prevent duplicates in add modal
    (p) => !album?.photoIds.includes(p.id),
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={albumPhotos}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handlePhotoPress(item)}
            onLongPress={() => handlePhotoLongPress(item)}
            delayLongPress={300}
            style={styles.photoItem}
          >
            <Image
              source={{ uri: item.uri }}
              style={styles.photo}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyState
              image={require("../../assets/images/empty-albums.png")}
              title="No photos in this album"
              subtitle="Tap + to add photos"
            />
          </View>
        }
      />

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: theme.border }]}
          >
            <Pressable onPress={() => setShowAddModal(false)}>
              <ThemedText type="body">Cancel</ThemedText>
            </Pressable>
            <ThemedText type="h4">Add Photos</ThemedText>
            <Pressable
              onPress={handleAddPhotos}
              disabled={selectedPhotoIds.length === 0}
            >
              <ThemedText
                type="body"
                style={{
                  color:
                    selectedPhotoIds.length > 0
                      ? Colors.light.accent
                      : theme.textSecondary,
                }}
              >
                Add ({selectedPhotoIds.length})
              </ThemedText>
            </Pressable>
          </View>

          <FlatList
            data={availablePhotos}
            keyExtractor={(item) => item.id}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={{
              padding: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
            }}
            renderItem={({ item }) => {
              const isSelected = selectedPhotoIds.includes(item.id);
              return (
                <Pressable
                  onPress={() => handleToggleSelect(item.id)}
                  style={styles.photoItem}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={[styles.photo, isSelected && styles.selectedPhoto]}
                    contentFit="cover"
                    transition={200}
                  />
                  {isSelected ? (
                    <View style={styles.checkmark}>
                      <Feather name="check" size={16} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  No more photos to add
                </ThemedText>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: theme.border }]}
          >
            <Pressable onPress={() => setShowShareModal(false)}>
              <ThemedText type="body">Cancel</ThemedText>
            </Pressable>
            <ThemedText type="h4">Share Album</ThemedText>
            <Pressable
              onPress={handleCreateShare}
              disabled={createShareMutation.isPending}
            >
              <ThemedText
                type="body"
                style={{
                  color: createShareMutation.isPending
                    ? theme.textSecondary
                    : Colors.light.accent,
                }}
              >
                {createShareMutation.isPending ? "Sharing..." : "Share"}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.shareContent}>
            <View style={styles.shareSection}>
              <ThemedText type="h4" style={styles.shareSectionTitle}>
                Permissions
              </ThemedText>
              <View style={styles.permissionOptions}>
                {[
                  {
                    value: "view",
                    label: "Can view",
                    description: "People can view photos",
                  },
                  {
                    value: "edit",
                    label: "Can edit",
                    description: "People can add/remove photos",
                  },
                  {
                    value: "admin",
                    label: "Can manage",
                    description: "People can manage sharing",
                  },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.permissionOption,
                      {
                        backgroundColor:
                          shareSettings.permissions === option.value
                            ? Colors.light.accent + "20"
                            : theme.backgroundCard,
                        borderColor:
                          shareSettings.permissions === option.value
                            ? Colors.light.accent
                            : theme.border,
                      },
                    ]}
                    onPress={() =>
                      setShareSettings((prev) => ({
                        ...prev,
                        permissions: option.value as any,
                      }))
                    }
                  >
                    <View style={styles.permissionOptionContent}>
                      <ThemedText
                        type="body"
                        style={styles.permissionOptionLabel}
                      >
                        {option.label}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{ color: theme.textSecondary }}
                      >
                        {option.description}
                      </ThemedText>
                    </View>
                    {shareSettings.permissions === option.value && (
                      <Feather
                        name="check"
                        size={20}
                        color={Colors.light.accent}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.shareSection}>
              <ThemedText type="h4" style={styles.shareSectionTitle}>
                Protection (Optional)
              </ThemedText>
              <View style={styles.protectionOptions}>
                <View
                  style={[styles.inputContainer, { borderColor: theme.border }]}
                >
                  <Feather name="lock" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.textInput, { color: theme.text }]}
                    placeholder="Password (optional)"
                    placeholderTextColor={theme.textSecondary}
                    value={shareSettings.password}
                    onChangeText={(text) =>
                      setShareSettings((prev) => ({ ...prev, password: text }))
                    }
                    secureTextEntry
                  />
                </View>
              </View>
            </View>

            <View style={styles.shareSection}>
              <ThemedText type="h4" style={styles.shareSectionTitle}>
                Expiration (Optional)
              </ThemedText>
              <Pressable
                style={[
                  styles.expirationOption,
                  {
                    backgroundColor: theme.backgroundCard,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => {
                  // TODO: Show date picker
                  Alert.alert(
                    "Coming Soon",
                    "Date picker for expiration will be added",
                  );
                }}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  {shareSettings.expiresAt
                    ? new Date(shareSettings.expiresAt).toLocaleDateString()
                    : "Never expires"}
                </ThemedText>
                <Feather
                  name="calendar"
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 400,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    marginRight: GAP,
    marginBottom: GAP,
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0",
  },
  selectedPhoto: {
    opacity: 0.7,
  },
  checkmark: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  shareContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  shareSection: {
    marginBottom: Spacing.xl,
  },
  shareSectionTitle: {
    marginBottom: Spacing.md,
  },
  permissionOptions: {
    gap: Spacing.sm,
  },
  permissionOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  permissionOptionContent: {
    flex: 1,
  },
  permissionOptionLabel: {
    marginBottom: Spacing.xs,
  },
  protectionOptions: {
    gap: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
  },
  expirationOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
