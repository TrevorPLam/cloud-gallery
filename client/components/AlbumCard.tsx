import React from "react";
import { StyleSheet, Pressable, View, Platform } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Album } from "@/types";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface AlbumCardProps {
  album: Album;
  onPress: (album: Album) => void;
  onLongPress?: (album: Album) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AlbumCard({ album, onPress, onLongPress }: AlbumCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handleLongPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onLongPress?.(album);
  };

  return (
    <AnimatedPressable
      onPress={() => onPress(album)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={handleLongPress}
      delayLongPress={300}
      style={[
        styles.container,
        { backgroundColor: theme.backgroundDefault },
        animatedStyle,
      ]}
      testID={`album-card-${album.id}`}
    >
      <View
        style={[styles.coverContainer, { backgroundColor: theme.backgroundTertiary }]}
      >
        {album.coverPhotoUri ? (
          <Image
            source={{ uri: album.coverPhotoUri }}
            style={styles.cover}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Feather name="image" size={32} color={theme.textSecondary} />
        )}
      </View>
      <View style={styles.info}>
        <ThemedText type="h4" numberOfLines={1} style={styles.title}>
          {album.title}
        </ThemedText>
        <ThemedText
          type="small"
          style={[styles.count, { color: theme.textSecondary }]}
        >
          {album.photoIds.length} {album.photoIds.length === 1 ? "photo" : "photos"}
        </ThemedText>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },
  coverContainer: {
    aspectRatio: 16 / 9,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  info: {
    padding: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  count: {
    opacity: 0.7,
  },
});
