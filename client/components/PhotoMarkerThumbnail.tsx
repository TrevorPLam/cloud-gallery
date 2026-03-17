// AI-META-BEGIN
// AI-META: Thumbnail component for photo markers on map view
// OWNERSHIP: client/components
// ENTRYPOINTS: Used by MapScreen for rendering photo markers
// DEPENDENCIES: expo-image, theme system, accessibility
// DANGER: Image loading performance; ensure proper caching
// CHANGE-SAFETY: Safe to modify styling; maintain accessibility props
// TESTS: Verify image loading, accessibility labels, touch interactions
// AI-META-END

import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface PhotoMarkerThumbnailProps {
  uri: string;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export default function PhotoMarkerThumbnail({
  uri,
  size = 40,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: PhotoMarkerThumbnailProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: theme.backgroundDefault,
          backgroundColor: theme.backgroundSecondary,
        },
      ]}
      onTouchEnd={onPress}
      accessible={!!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || "Photo location marker"}
      accessibilityHint={accessibilityHint || "Tap to preview photo"}
      testID="photo-marker-thumbnail"
    >
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: size - 4,
            height: size - 4,
            borderRadius: (size - 4) / 2,
          },
        ]}
        contentFit="cover"
        placeholder={styles.placeholder}
        transition={200}
        cachePolicy="memory-disk"
        testID="photo-marker-image"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    backgroundColor: "#f0f0f0",
  },
  placeholder: {
    backgroundColor: "#e0e0e0",
  },
});
