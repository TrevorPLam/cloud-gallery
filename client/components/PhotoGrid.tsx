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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const GAP = Spacing.photoGap;
const PHOTO_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

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
}

function PhotoItem({ photo, index, onPress, onLongPress }: PhotoItemProps) {
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
      style={[styles.photoContainer, animatedStyle]}
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

  if (groupedData && showSectionHeaders) {
    const flatData: (Photo | { type: "header"; title: string })[] = [];
    groupedData.forEach((group) => {
      flatData.push({ type: "header", title: group.title });
      group.data.forEach((photo) => flatData.push(photo));
    });

    return (
      <FlashList
        data={flatData}
        numColumns={NUM_COLUMNS}
        estimatedItemSize={PHOTO_SIZE}
        contentContainerStyle={contentContainerStyle}
        scrollIndicatorInsets={scrollIndicatorInsets}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        renderItem={({ item, index }) => {
          if ("type" in item && item.type === "header") {
            return (
              <View style={styles.sectionHeader}>
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
            />
          );
        }}
        getItemType={(item) => {
          if ("type" in item && item.type === "header") return "header";
          return "photo";
        }}
        overrideItemLayout={(layout, item) => {
          if ("type" in item && item.type === "header") {
            layout.span = NUM_COLUMNS;
            layout.size = 48;
          } else {
            layout.size = PHOTO_SIZE + GAP;
          }
        }}
      />
    );
  }

  return (
    <FlashList
      data={photos}
      numColumns={NUM_COLUMNS}
      estimatedItemSize={PHOTO_SIZE}
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
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  photoContainer: {
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
  favoriteIcon: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    padding: 4,
  },
  sectionHeader: {
    width: SCREEN_WIDTH,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginLeft: -Spacing.lg,
  },
});
