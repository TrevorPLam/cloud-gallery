// AI-META-BEGIN
// AI-META: Albums list screen with create modal and long-press delete
// OWNERSHIP: client/screens (album management)
// ENTRYPOINTS: Accessed via AlbumsTab in MainTabNavigator
// DEPENDENCIES: storage lib, AlbumCard, modal, navigation, haptics
// DANGER: Delete via long press with no confirmation; modal input validation
// CHANGE-SAFETY: Safe to modify UI; delete flow is destructive; test create/delete thoroughly
// TESTS: Test album creation, deletion, navigation, verify haptics, check empty state
// AI-META-END

import React, { useState } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  TextInput,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Album, Photo } from "@/types";
import { apiRequest } from "@/lib/query-client";
import { AlbumCard } from "@/components/AlbumCard";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AlbumsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");

  // ═══════════════════════════════════════════════════════════
  // FETCH ALBUMS (React Query)
  // ═══════════════════════════════════════════════════════════
  // useQuery automatically:
  //   • Fetches data when component mounts
  //   • Handles loading/error states
  //   • Caches results
  //   • Refetches when needed
  
  const { 
    data: albums = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery<Album[]>({
    queryKey: ['albums'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/albums');
      const data = await res.json();
      return data.albums;
    },
    // Refetch when screen focused
    refetchOnWindowFocus: true,
  });

  // Fetch photos to compute cover URIs
  const { data: photos = [] } = useQuery<Photo[]>({
    queryKey: ['photos'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/photos');
      const data = await res.json();
      return data.photos;
    },
  });

  // Task 5.5: Enrich albums with cover photo URIs
  // For each album, set coverPhotoUri to the first photo's URI
  const enrichedAlbums = albums.map(album => {
    if (!album.coverPhotoUri && album.photoIds && album.photoIds.length > 0) {
      const firstPhoto = photos.find(p => p.id === album.photoIds[0]);
      return {
        ...album,
        coverPhotoUri: firstPhoto?.uri || null,
      };
    }
    return album;
  });

  // ═══════════════════════════════════════════════════════════
  // CREATE ALBUM MUTATION (React Query)
  // ═══════════════════════════════════════════════════════════
  // Task 5.2: Album creation with optimistic update
  
  const createAlbumMutation = useMutation({
    mutationFn: async (albumData: { title: string; description?: string }) => {
      const res = await apiRequest('POST', '/api/albums', albumData);
      return res.json();
    },
    
    // BEFORE sending to server (optimistic update)
    onMutate: async (newAlbum) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['albums'] });
      
      // Save current state for rollback
      const previousAlbums = queryClient.getQueryData(['albums']);
      
      // Optimistically update UI (show album immediately with temp ID)
      queryClient.setQueryData(['albums'], (old: Album[] = []) => [
        {
          id: 'temp-' + Date.now(),
          title: newAlbum.title,
          description: newAlbum.description,
          coverPhotoUri: null,
          photoIds: [],
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        } as Album,
        ...old,
      ]);
      
      return { previousAlbums };
    },
    
    // If API call FAILS
    onError: (err, newAlbum, context) => {
      // Rollback to previous state
      if (context?.previousAlbums) {
        queryClient.setQueryData(['albums'], context.previousAlbums);
      }
      console.error('Failed to create album:', err);
    },
    
    // After API call completes (success OR failure)
    onSettled: () => {
      // Refetch from server to get accurate data
      queryClient.invalidateQueries({ queryKey: ['albums'] });
    },
  });

  const handleCreateAlbum = async () => {
    if (!newAlbumTitle.trim()) return;

    // Use mutation to create album
    createAlbumMutation.mutate({ title: newAlbumTitle.trim() });
    
    setNewAlbumTitle("");
    setShowCreateModal(false);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleAlbumPress = (album: Album) => {
    navigation.navigate("AlbumDetail", {
      albumId: album.id,
      albumTitle: album.title,
    });
  };

  // ═══════════════════════════════════════════════════════════
  // DELETE ALBUM MUTATION (React Query)
  // ═══════════════════════════════════════════════════════════
  // Task 5.4: Album deletion with optimistic update
  
  const deleteAlbumMutation = useMutation({
    mutationFn: async (albumId: string) => {
      const res = await apiRequest('DELETE', `/api/albums/${albumId}`);
      return res.json();
    },
    
    // BEFORE sending to server (optimistic update)
    onMutate: async (albumId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['albums'] });
      
      // Save current state for rollback
      const previousAlbums = queryClient.getQueryData(['albums']);
      
      // Optimistically remove album from UI
      queryClient.setQueryData(['albums'], (old: Album[] = []) =>
        old.filter(album => album.id !== albumId)
      );
      
      return { previousAlbums };
    },
    
    // If API call FAILS
    onError: (err, albumId, context) => {
      // Rollback to previous state
      if (context?.previousAlbums) {
        queryClient.setQueryData(['albums'], context.previousAlbums);
      }
      console.error('Failed to delete album:', err);
    },
    
    // After API call completes (success OR failure)
    onSettled: () => {
      // Refetch both albums and photos (photos may have albumIds updated)
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  const handleAlbumLongPress = async (album: Album) => {
    // AI-NOTE: Heavy haptic for destructive delete; no confirmation dialog for speed
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    
    // Use mutation to delete album
    deleteAlbumMutation.mutate(album.id);
  };

  const openCreateModal = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowCreateModal(true);
  };

  React.useLayoutEffect(() => {
    // AI-NOTE: Dynamically sets parent navigator header right button for create action
    navigation.getParent()?.setOptions({
      headerRight: () => (
        <Pressable
          onPress={openCreateModal}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Feather name="plus" size={24} color={theme.text} />
        </Pressable>
      ),
    });
  }, [navigation, theme]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {isLoading ? (
        <View style={{ paddingTop: headerHeight + Spacing.xl }}>
          <SkeletonLoader type="albums" count={4} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <EmptyState
            image={require("../../assets/images/empty-albums.png")}
            title="Failed to load albums"
            subtitle={error instanceof Error ? error.message : "An error occurred"}
          />
          <Pressable 
            style={[styles.retryButton, { backgroundColor: theme.accent }]}
            onPress={() => refetch()}
          >
            <Feather name="refresh-cw" size={20} color={theme.buttonText} />
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={enrichedAlbums}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AlbumCard
              album={item}
              onPress={handleAlbumPress}
              onLongPress={handleAlbumLongPress}
            />
          )}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
            flexGrow: 1,
          }}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptyState
                image={require("../../assets/images/empty-albums.png")}
                title="No albums yet"
                subtitle="Tap + to create your first album"
              />
            </View>
          }
        />
      )}

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}
          onPress={() => setShowCreateModal(false)}
        >
          <Pressable
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
            onPress={() => {}}
          >
            <ThemedText type="h3" style={styles.modalTitle}>
              New Album
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundRoot,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Album name"
              placeholderTextColor={theme.textSecondary}
              value={newAlbumTitle}
              onChangeText={setNewAlbumTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateAlbum}
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowCreateModal(false)}
                style={[styles.cancelButton, { borderColor: theme.border }]}
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Button
                onPress={handleCreateAlbum}
                style={styles.createButton}
                disabled={!newAlbumTitle.trim()}
              >
                Create
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
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
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    ...Shadows.large,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    flex: 1,
  },
});
