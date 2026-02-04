// AI-META-BEGIN
// AI-META: Loading skeleton with pulsing animation for photos and albums
// OWNERSHIP: client/components (loading states)
// ENTRYPOINTS: Rendered by PhotosScreen and AlbumsScreen during initial load
// DEPENDENCIES: react-native-reanimated, theme system
// DANGER: Animation must loop infinitely; sizing must match actual content
// CHANGE-SAFETY: Safe to modify animation params; sizing changes must match PhotoGrid
// TESTS: Verify animations run smoothly, check sizing matches real content
// AI-META-END

import React, { useEffect } from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

// AI-NOTE: Skeleton sizing must match PhotoGrid for seamless transition when data loads
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const GAP = Spacing.photoGap;
const PHOTO_SIZE =
  (SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1) - Spacing.lg * 2) / NUM_COLUMNS;

interface SkeletonLoaderProps {
  type: "photos" | "albums";
  count?: number;
}

function SkeletonItem({ delay, size }: { delay: number; size: number }) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          backgroundColor: theme.backgroundTertiary,
          marginRight: GAP,
          marginBottom: GAP,
        },
        animatedStyle,
      ]}
    />
  );
}

function AlbumSkeletonItem({ delay }: { delay: number }) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.albumSkeleton,
        { backgroundColor: theme.backgroundTertiary },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.albumCoverSkeleton,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      />
      <View style={styles.albumInfoSkeleton}>
        <View
          style={[
            styles.albumTitleSkeleton,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        />
        <View
          style={[
            styles.albumCountSkeleton,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        />
      </View>
    </Animated.View>
  );
}

export function SkeletonLoader({ type, count = 12 }: SkeletonLoaderProps) {
  if (type === "albums") {
    return (
      <View style={styles.albumsContainer}>
        {Array.from({ length: count }).map((_, index) => (
          <AlbumSkeletonItem key={index} delay={index * 100} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.photosContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonItem key={index} delay={index * 50} size={PHOTO_SIZE} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  photosContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.lg,
  },
  albumsContainer: {
    paddingHorizontal: Spacing.lg,
  },
  albumSkeleton: {
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  albumCoverSkeleton: {
    aspectRatio: 16 / 9,
    width: "100%",
  },
  albumInfoSkeleton: {
    padding: Spacing.lg,
  },
  albumTitleSkeleton: {
    height: 20,
    width: "60%",
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
  },
  albumCountSkeleton: {
    height: 14,
    width: "30%",
    borderRadius: BorderRadius.xs,
  },
});
