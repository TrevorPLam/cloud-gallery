// AI-META-BEGIN
// AI-META: Main photos screen with grid, date grouping, and upload FAB
// OWNERSHIP: client/screens (photo management)
// ENTRYPOINTS: Default tab in MainTabNavigator
// DEPENDENCIES: expo-image-picker, storage lib, PhotoGrid, FAB, haptics
// DANGER: Image picker multi-select; photo ID generation; haptics web incompatible
// CHANGE-SAFETY: Safe to modify UI; upload logic affects storage; test picker permissions
// TESTS: Test photo upload, verify date grouping, check empty state, validate haptics
// AI-META-END

import React, { useState, useCallback } from "react";
import { StyleSheet, View, Platform, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Photo } from "@/types";
import { getPhotos, addPhoto, groupPhotosByDate } from "@/lib/storage";
import { PhotoGrid } from "@/components/PhotoGrid";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLoader } from "@/components/SkeletonLoader";
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

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPhotos = useCallback(async () => {
    const data = await getPhotos();
    setPhotos(data);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos])
  );

  const handleUpload = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // AI-NOTE: Image picker allows multi-select; generates unique IDs using timestamp + random
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
      exif: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      for (const asset of result.assets) {
        const newPhoto: Photo = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          uri: asset.uri,
          width: asset.width || 0,
          height: asset.height || 0,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          filename: asset.fileName || `photo_${Date.now()}.jpg`,
          isFavorite: false,
          albumIds: [],
        };
        await addPhoto(newPhoto);
      }
      loadPhotos();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const handlePhotoPress = (photo: Photo, index: number) => {
    navigation.navigate("PhotoDetail", { photoId: photo.id, initialIndex: index });
  };

  const groupedData = groupPhotosByDate(photos);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {isLoading ? (
        <View style={{ paddingTop: headerHeight + Spacing.xl }}>
          <SkeletonLoader type="photos" count={15} />
        </View>
      ) : (
        <PhotoGrid
          photos={photos}
          groupedData={groupedData}
          onPhotoPress={handlePhotoPress}
          showSectionHeaders={true}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.xl,
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
});
