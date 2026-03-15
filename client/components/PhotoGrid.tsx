// AI-META-BEGIN
// AI-META: High-performance photo grid using FlashList with grouped/ungrouped rendering modes
// OWNERSHIP: client/components (photo display)
// ENTRYPOINTS: Used by PhotosScreen, SearchScreen, AlbumDetailScreen
// DEPENDENCIES: @shopify/flash-list, expo-image, react-native-reanimated, expo-haptics
// DANGER: FlashList perf-sensitive; grouping logic affects layout; NUM_COLUMNS hardcoded
// CHANGE-SAFETY: Risky to change layout logic; safe to modify item styles; test perf with large datasets
// TESTS: Test with 100+ photos, verify section headers, check animations, validate haptics
// AI-META-END

import React from "react";
import {
  StyleSheet,
  Pressable,
  Dimensions,
  View,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Photo } from "@/types";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";

interface PhotoGridProps {
  photos: Photo[];
  onPhotoPress: (photo: Photo, index: number) => void;
  onPhotoLongPress?: (photo: Photo) => void;
  groupedData?: { title: string; data: Photo[] }[];
  showSectionHeaders?: boolean;
  contentContainerStyle?: any;
  ListHeaderComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement;
  scrollIndicatorInsets?: { bottom: number };
}

interface PhotoItemProps {
  photo: Photo;
  index: number;
  onPress: (photo: Photo, index: number) => void;
  onLongPress?: (photo: Photo) => void;
  style?: any;
}

function PhotoItem({
  photo,
  index,
  onPress,
  onLongPress,
  style,
}: PhotoItemProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handleLongPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onLongPress?.(photo);
  };

  const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

  return (
    <AnimatedPressable
      onPress={() => onPress(photo, index)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={handleLongPress}
      delayLongPress={300}
      style={[style, animatedStyle]}
      testID={`photo-item-${photo.id}`}
    >
      <Image
        source={{ uri: photo.uri }}
        style={styles.photo}
        contentFit="cover"
        transition={200}
      />
      {photo.isFavorite ? (
        <View style={styles.favoriteIcon}>
          <Feather name="heart" size={14} color={Colors.light.accent} />
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

import { useWindowDimensions } from "react-native";

// Constants
const GAP = Spacing.photoGap;

export function PhotoGrid({
  photos,
  onPhotoPress,
  onPhotoLongPress,
  groupedData,
  showSectionHeaders = true,
  contentContainerStyle,
  ListHeaderComponent,
  ListEmptyComponent,
  scrollIndicatorInsets,
}: PhotoGridProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();

  // Responsive column calculation
  // Mobile: 3, Large Mobile/Tablet Portrait: 4, Tablet Landscape: 6, Desktop: 8
  const numColumns = width > 1200 ? 8 : width > 900 ? 6 : width > 600 ? 4 : 3;

  const photoSize = (width - GAP * (numColumns - 1)) / numColumns;

  // Dynamic style for photo container
  const photoContainerStyle = {
    width: photoSize,
    height: photoSize,
    marginRight: GAP,
    marginBottom: GAP,
    position: "relative" as const,
  };

  // Memoize overrideItemLayout to avoid re-renders if dimensions don't change
  // But since dimensions change on rotate/resize, we need to recalculate.

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    if ("type" in item && item.type === "header") {
      return (
        <View style={[styles.sectionHeader, { width }]}>
          <ThemedText type="h4" style={{ color: theme.text }}>
            {item.title}
          </ThemedText>
        </View>
      );
    }
    const photo = item as Photo;
    const photoIndex = photos.findIndex((p) => p.id === photo.id);
    return (
      <PhotoItem
        photo={photo}
        index={photoIndex}
        onPress={onPhotoPress}
        onLongPress={onPhotoLongPress}
        style={photoContainerStyle}
      />
    );
  };

  if (groupedData && showSectionHeaders) {
    const flatData: (Photo | { type: "header"; title: string })[] = [];
    groupedData.forEach((group) => {
      flatData.push({ type: "header", title: group.title });
      group.data.forEach((photo) => flatData.push(photo));
    });

    return (
      <FlashList
        data={flatData}
        numColumns={numColumns}
        estimatedItemSize={photoSize}
        contentContainerStyle={contentContainerStyle}
        scrollIndicatorInsets={scrollIndicatorInsets}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        renderItem={renderItem}
        getItemType={(item) => {
          if ("type" in item && item.type === "header") return "header";
          return "photo";
        }}
        overrideItemLayout={(layout, item) => {
          if ("type" in item && item.type === "header") {
            layout.span = numColumns;
            layout.size = 48;
          } else {
            layout.size = photoSize + GAP;
          }
        }}
        // Refresh flashlist when columns change
        key={`grid-${numColumns}`}
      />
    );
  }

  return (
    <FlashList
      data={photos}
      numColumns={numColumns}
      estimatedItemSize={photoSize}
      contentContainerStyle={contentContainerStyle}
      scrollIndicatorInsets={scrollIndicatorInsets}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      renderItem={({ item, index }) => (
        <PhotoItem
          photo={item}
          index={index}
          onPress={onPhotoPress}
          onLongPress={onPhotoLongPress}
          style={photoContainerStyle}
        />
      )}
      key={`grid-${numColumns}`}
    />
  );
}

const styles = StyleSheet.create({
  photo: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0",
  },
  favoriteIcon: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    padding: 4,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    // marginLeft: -Spacing.lg, // Removed negative margin logic as it was confusing
  },
});
