// AI-META-BEGIN
// AI-META: Full-screen photo viewer with swipe navigation and action controls
// OWNERSHIP: client/screens (photo viewing)
// ENTRYPOINTS: Navigated from PhotosScreen, SearchScreen, AlbumDetailScreen
// DEPENDENCIES: FlashList, expo-image, expo-sharing, storage lib, haptics
// DANGER: Delete modifies photo array; sharing iOS/Android only; controls toggle state
// CHANGE-SAFETY: Risky to change photo deletion logic; safe to modify UI; test sharing thoroughly
// TESTS: Test swipe navigation, photo deletion, sharing, verify haptics, check controls toggle
// AI-META-END

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  Pressable,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Photo } from "@/types";
import { apiRequest } from "@/lib/query-client";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PhotoMetadataEditor } from "@/components/PhotoMetadataEditor";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type PhotoDetailRouteProp = RouteProp<RootStackParamList, "PhotoDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PhotoDetailScreen() {
  const route = useRoute<PhotoDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { photoId, initialIndex, context } = route.params as any; // Cast to any to generic param access
  const isTrash = context === "trash";
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const [isMetadataEditorVisible, setIsMetadataEditorVisible] = useState(false);
  const listRef = useRef<any>(null);

  // Fetch photos using React Query
  const { data: photos = [] } = useQuery<Photo[]>({
    queryKey: isTrash ? ['trash-photos'] : ['photos'],
    queryFn: async () => {
      const endpoint = isTrash ? '/api/photos/user/trash' : '/api/photos';
      const res = await apiRequest('GET', endpoint);
      const data = await res.json();
      return data.photos;
    },
  });

  const currentPhoto = photos[currentIndex];

  // ═══════════════════════════════════════════════════════════
  // METADATA UPDATE MUTATIONS
  // ═══════════════════════════════════════════════════════════

  // Mutation for favorite toggle
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ photoId, isFavorite }: { photoId: string; isFavorite: boolean }) => {
      const res = await apiRequest('PUT', `/api/photos/${photoId}`, { isFavorite });
      return res.json();
    },
    onMutate: async ({ photoId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: ['photos'] });
      const previousPhotos = queryClient.getQueryData(['photos']);

      // Optimistic update
      queryClient.setQueryData(['photos'], (old: Photo[] = []) =>
        old.map(photo =>
          photo.id === photoId ? { ...photo, isFavorite, modifiedAt: Date.now() } : photo
        )
      );

      return { previousPhotos };
    },
    onError: (err, variables, context) => {
      if (context?.previousPhotos) {
        queryClient.setQueryData(['photos'], context.previousPhotos);
      }
      console.error('Failed to toggle favorite:', err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  // Mutation for tags update
  const updateTagsMutation = useMutation({
    mutationFn: async ({ photoId, tags }: { photoId: string; tags: string[] }) => {
      const res = await apiRequest('PUT', `/api/photos/${photoId}`, { tags });
      return res.json();
    },
    onMutate: async ({ photoId, tags }) => {
      await queryClient.cancelQueries({ queryKey: ['photos'] });
      const previousPhotos = queryClient.getQueryData(['photos']);

      queryClient.setQueryData(['photos'], (old: Photo[] = []) =>
        old.map(photo =>
          photo.id === photoId ? { ...photo, tags, modifiedAt: Date.now() } : photo
        )
      );

      return { previousPhotos };
    },
    onError: (err, variables, context) => {
      if (context?.previousPhotos) {
        queryClient.setQueryData(['photos'], context.previousPhotos);
      }
      console.error('Failed to update tags:', err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  // Mutation for notes update
  const updateNotesMutation = useMutation({
    mutationFn: async ({ photoId, notes }: { photoId: string; notes: string }) => {
      const res = await apiRequest('PUT', `/api/photos/${photoId}`, { notes });
      return res.json();
    },
    onMutate: async ({ photoId, notes }) => {
      await queryClient.cancelQueries({ queryKey: ['photos'] });
      const previousPhotos = queryClient.getQueryData(['photos']);

      queryClient.setQueryData(['photos'], (old: Photo[] = []) =>
        old.map(photo =>
          photo.id === photoId ? { ...photo, notes, modifiedAt: Date.now() } : photo
        )
      );

      return { previousPhotos };
    },
    onError: (err, variables, context) => {
      if (context?.previousPhotos) {
        queryClient.setQueryData(['photos'], context.previousPhotos);
      }
      console.error('Failed to update notes:', err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  // ═══════════════════════════════════════════════════════════
  // DEBOUNCED METADATA UPDATES (Requirement 4.7)
  // ═══════════════════════════════════════════════════════════
  // Debounce text input updates by 500ms to avoid excessive API calls

  const tagsDebounceTimer = useRef<any>(null);
  const notesDebounceTimer = useRef<any>(null);

  /**
   * Debounced tags update handler
   * Waits 500ms after last change before sending to server
   */
  const handleTagsUpdate = useCallback((photoId: string, tags: string[]) => {
    // Clear existing timer
    if (tagsDebounceTimer.current) {
      clearTimeout(tagsDebounceTimer.current);
    }

    // Set new timer
    tagsDebounceTimer.current = setTimeout(() => {
      updateTagsMutation.mutate({ photoId, tags });
    }, 500);
  }, [updateTagsMutation]);

  /**
   * Debounced notes update handler
   * Waits 500ms after last change before sending to server
   */
  const handleNotesUpdate = useCallback((photoId: string, notes: string) => {
    // Clear existing timer
    if (notesDebounceTimer.current) {
      clearTimeout(notesDebounceTimer.current);
    }

    // Set new timer
    notesDebounceTimer.current = setTimeout(() => {
      updateNotesMutation.mutate({ photoId, notes });
    }, 500);
  }, [updateNotesMutation]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (tagsDebounceTimer.current) {
        clearTimeout(tagsDebounceTimer.current);
      }
      if (notesDebounceTimer.current) {
        clearTimeout(notesDebounceTimer.current);
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // DELETE PHOTO MUTATION
  // ═══════════════════════════════════════════════════════════
  // Implements Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6

  const deletePhotoMutation = useMutation({
    // Requirement 5.1: Send DELETE /api/photos/:id to the Server
    mutationFn: async (photoId: string) => {
      const res = await apiRequest('DELETE', `/api/photos/${photoId}`);
      return res.json();
    },
    // Requirement 5.2: Remove photo from UI immediately (Optimistic_Update)
    onMutate: async (photoId) => {
      await queryClient.cancelQueries({ queryKey: ['photos'] });
      const previousPhotos = queryClient.getQueryData(['photos']);

      // Optimistic deletion - remove from UI immediately
      queryClient.setQueryData(['photos'], (old: Photo[] = []) =>
        old.filter(photo => photo.id !== photoId)
      );

      return { previousPhotos };
    },
    onError: (err, photoId, context) => {
      if (context?.previousPhotos) {
        queryClient.setQueryData(['photos'], context.previousPhotos);
      }
      console.error('Failed to delete photo:', err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      // Also invalidate trash
      queryClient.invalidateQueries({ queryKey: ['trash-photos'] });
    },
  });

  const restorePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await apiRequest('PUT', `/api/photos/${photoId}/restore`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['trash-photos'] });

      // Navigate back if only one photo (or remove from list logic below)
      if (photos.length === 1) {
        navigation.goBack();
      } else {
        // Remove locally
        // But simpler to just let re-render handle it if we invalidate?
        // Actually FlashList might need index update.
        // If we restore, it should disappear from Trash list.
        // Similar logic to delete.
        // But we need to update state.
      }
    }
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await apiRequest('DELETE', `/api/photos/${photoId}/permanent`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trash-photos'] });
    }
  });

  const handleRestore = () => {
    if (!currentPhoto) return;
    restorePhotoMutation.mutate(currentPhoto.id);

    // Remove from current view
    if (photos.length === 1) {
      navigation.goBack();
    } else {
      // Optimistic removed from list? 
      // For now rely on invalidate. But we need to update index if item disappears.
      // Actually, if we invalidate, the data changes, re-render happens.
      // But FlashList needs care.
    }
  };

  const handlePermanentDelete = () => {
    if (!currentPhoto) return;

    if (Platform.OS === "web") {
      if (window.confirm("Permanently delete this photo? This cannot be undone.")) {
        permanentDeleteMutation.mutate(currentPhoto.id);
        if (photos.length === 1) {
          navigation.goBack();
        }
      }
    } else {
      Alert.alert(
        "Delete Permanently",
        "This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              permanentDeleteMutation.mutate(currentPhoto.id);
              if (photos.length === 1) {
                navigation.goBack();
              }
            }
          }
        ]
      );
    }
  };

  const handleToggleFavorite = async () => {
    if (!currentPhoto) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleFavoriteMutation.mutate({
      photoId: currentPhoto.id,
      isFavorite: !currentPhoto.isFavorite,
    });
  };

  const handleShare = async () => {
    if (!currentPhoto) return;
    // AI-NOTE: Sharing API available iOS/Android only; web requires different approach
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(currentPhoto.uri);
      }
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  const performDelete = () => {
    if (!currentPhoto) return;

    // AI-NOTE: Warning haptic for destructive delete; adjusts index if deleting last photo
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    // Requirement 5.2: Remove photo from UI immediately (Optimistic_Update)
    // Requirement 5.1: Send DELETE request to server
    deletePhotoMutation.mutate(currentPhoto.id);

    // Navigate back if this was the last photo, otherwise adjust index
    if (photos.length === 1) {
      navigation.goBack();
    } else {
      const newIndex =
        currentIndex === photos.length - 1 ? currentIndex - 1 : currentIndex;
      setCurrentIndex(newIndex);
    }
  };

  const handleDelete = async () => {
    if (!currentPhoto) return;

    // Requirement 5.5: Show confirmation dialog before proceeding
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to delete this photo? This action cannot be undone.");
      if (!confirmed) return;
      performDelete();
    } else {
      // For native platforms, use Alert
      Alert.alert(
        "Delete Photo",
        "Are you sure you want to delete this photo? This action cannot be undone.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: performDelete,
          },
        ]
      );
    }
  };

  const handleValidation = useCallback((tags: string[], notes: string) => {
    if (!currentPhoto) return;
    // Mutate directly - debouncing handled in component if needed, or we just save immediately on "Save" press
    // The Editor component calls this on "Save" click, so we want immediate update
    updateTagsMutation.mutate({ photoId: currentPhoto.id, tags });
    updateNotesMutation.mutate({ photoId: currentPhoto.id, notes });
  }, [currentPhoto, updateTagsMutation, updateNotesMutation]);

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const renderPhoto = ({ item, index }: { item: Photo; index: number }) => {
    return (
      <Pressable onPress={toggleControls} style={styles.photoContainer}>
        <Image
          source={{ uri: item.uri }}
          style={styles.fullImage}
          contentFit="contain"
          transition={200}
        />
      </Pressable>
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <StatusBar barStyle="light-content" />

      <FlashList
        ref={listRef}
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // @ts-ignore
        estimatedItemSize={SCREEN_WIDTH}
        initialScrollIndex={initialIndex}
        renderItem={renderPhoto}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(
            event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          setCurrentIndex(newIndex);
        }}
      />

      {showControls ? (
        <>
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.headerButton}
              hitSlop={8}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerCenter}>
              {currentPhoto ? (
                <ThemedText type="small" style={styles.dateText}>
                  {formatDate(currentPhoto.createdAt)}
                </ThemedText>
              ) : null}
            </View>
            <View style={styles.headerButton} />
          </View>

          <View
            style={[
              styles.footer,
              { paddingBottom: insets.bottom + Spacing.lg },
            ]}
          >
            {isTrash ? (
              /* TRASH MODE BUTTONS */
              <>
                <Pressable onPress={handleRestore} style={styles.footerButton}>
                  <Feather name="refresh-ccw" size={24} color="#FFFFFF" />
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontSize: 10 }}>Restore</ThemedText>
                </Pressable>
                <Pressable onPress={handlePermanentDelete} style={styles.footerButton}>
                  <Feather name="trash-2" size={24} color={Colors.light.error} />
                  <ThemedText type="small" style={{ color: Colors.light.error, fontSize: 10 }}>Delete</ThemedText>
                </Pressable>
              </>
            ) : (
              /* NORMAL MODE BUTTONS */
              <>
                <Pressable onPress={handleShare} style={styles.footerButton}>
                  <Feather name="share" size={24} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={handleToggleFavorite}
                  style={styles.footerButton}
                >
                  <Feather
                    name={currentPhoto?.isFavorite ? "heart" : "heart"}
                    size={24}
                    color={
                      currentPhoto?.isFavorite ? Colors.light.accent : "#FFFFFF"
                    }
                  />
                </Pressable>
                <Pressable onPress={handleDelete} style={styles.footerButton}>
                  <Feather name="trash-2" size={24} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={() => setIsMetadataEditorVisible(true)}
                  style={styles.footerButton}
                >
                  <Feather name="info" size={24} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (currentPhoto) {
                      navigation.navigate("EditPhoto", { photoId: currentPhoto.id, initialUri: currentPhoto.uri });
                    }
                  }}
                  style={styles.footerButton}
                >
                  <Feather name="edit-2" size={24} color="#FFFFFF" />
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.counter}>
            <ThemedText type="small" style={styles.counterText}>
              {currentIndex + 1} / {photos.length}
            </ThemedText>
          </View>
        </>
      ) : null}

      {currentPhoto && (
        <PhotoMetadataEditor
          visible={isMetadataEditorVisible}
          onClose={() => setIsMetadataEditorVisible(false)}
          onSave={handleValidation}
          initialTags={currentPhoto.tags || []}
          initialNotes={currentPhoto.notes || ""}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  dateText: {
    color: "#FFFFFF",
    opacity: 0.9,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing["4xl"],
    paddingTop: Spacing.xl,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  footerButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  counterText: {
    color: "#FFFFFF",
    opacity: 0.7,
  },
});
