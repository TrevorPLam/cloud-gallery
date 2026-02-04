// AI-META-BEGIN
// AI-META: Album detail screen with photo grid and modal for adding photos
// OWNERSHIP: client/screens (album management)
// ENTRYPOINTS: Navigated from AlbumsScreen via AlbumCard press
// DEPENDENCIES: storage lib, PhotoGrid, modal, haptics, navigation
// DANGER: Photo removal via long press; modal state management; album not found handling
// CHANGE-SAFETY: Risky to change data flow; safe to modify UI; test photo add/remove thoroughly
// TESTS: Test adding/removing photos, verify modal interaction, check haptics, handle edge cases
// AI-META-END

import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Platform,
  Modal,
  FlatList,
  Dimensions,
} from "react-native";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
  RouteProp,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Photo, Album } from "@/types";
import {
  getPhotos,
  getAlbums,
  addPhotosToAlbum,
  removePhotoFromAlbum,
} from "@/lib/storage";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";
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

  const { albumId, albumTitle } = route.params;
  const [album, setAlbum] = useState<Album | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const [albums, photos] = await Promise.all([getAlbums(), getPhotos()]);
    const currentAlbum = albums.find((a) => a.id === albumId);
    setAlbum(currentAlbum || null);
    setAllPhotos(photos);

    if (currentAlbum) {
      const photosInAlbum = photos.filter((p) =>
        currentAlbum.photoIds.includes(p.id),
      );
      setAlbumPhotos(photosInAlbum);
    }
  }, [albumId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: albumTitle,
      headerRight: () => (
        <Pressable
          onPress={() => {
            setSelectedPhotoIds([]);
            setShowAddModal(true);
          }}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Feather name="plus" size={24} color={theme.text} />
        </Pressable>
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
    await removePhotoFromAlbum(albumId, photo.id);
    loadData();
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
    await addPhotosToAlbum(albumId, selectedPhotoIds);
    setShowAddModal(false);
    setSelectedPhotoIds([]);
    loadData();
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
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
});
