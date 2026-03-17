// AI-META-BEGIN
// AI-META: Real-time photo preview component with CSS-based adjustment simulation
// OWNERSHIP: client/components
// ENTRYPOINTS: imported by EditPhotoScreen for real-time preview
// DEPENDENCIES: expo-image, react-native-reanimated
// DANGER: Performance-critical for real-time preview; CSS limitations
// CHANGE-SAFETY: Maintain interface compatibility; preserve preview accuracy
// TESTS: Unit tests for adjustment calculations, integration tests with EditPhotoScreen
// AI-META-END

import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { ImageAdjustments } from "@/lib/photo-editor";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface PhotoPreviewProps {
  uri: string;
  adjustments: ImageAdjustments;
  showBeforeAfter: boolean;
  originalUri: string;
  width: number;
  height: number;
}

export default function PhotoPreview({
  uri,
  adjustments,
  showBeforeAfter,
  originalUri,
  width,
  height,
}: PhotoPreviewProps) {
  const { theme } = useTheme();

  // Animated values for smooth transitions
  const brightnessValue = useSharedValue(adjustments.brightness);
  const contrastValue = useSharedValue(adjustments.contrast);
  const saturationValue = useSharedValue(adjustments.saturation);

  // Update animated values when adjustments change
  React.useEffect(() => {
    brightnessValue.value = withTiming(adjustments.brightness, { duration: 150 });
    contrastValue.value = withTiming(adjustments.contrast, { duration: 150 });
    saturationValue.value = withTiming(adjustments.saturation, { duration: 150 });
  }, [adjustments.brightness, adjustments.contrast, adjustments.saturation]);

  // Calculate CSS filter string based on adjustments
  const filterStyle = useMemo(() => {
    const filters = [];

    // Brightness: -1 to 1 -> CSS brightness: 0 to 2
    const brightness = 1 + adjustments.brightness;
    filters.push(`brightness(${brightness})`);

    // Contrast: -1 to 1 -> CSS contrast: 0 to 2
    const contrast = 1 + adjustments.contrast;
    filters.push(`contrast(${contrast})`);

    // Saturation: -1 to 1 -> CSS saturate: 0 to 2
    const saturation = 1 + adjustments.saturation;
    filters.push(`saturate(${saturation})`);

    // Exposure: -2 to 2 -> CSS brightness: 0 to 3 (broader range)
    const exposure = 1 + (adjustments.exposure * 0.5);
    filters.push(`brightness(${exposure})`);

    // Temperature: -1 to 1 -> CSS hue-rotate: -30deg to 30deg
    const temperature = adjustments.temperature * 30;
    if (Math.abs(temperature) > 0.1) {
      filters.push(`hue-rotate(${temperature}deg)`);
    }

    // Vibrance: -1 to 1 -> CSS saturate: 0.5 to 1.5 (subtle saturation)
    const vibrance = 1 + (adjustments.vibrance * 0.5);
    filters.push(`saturate(${vibrance})`);

    // Sharpness: -1 to 1 -> CSS contrast (as approximation)
    const sharpness = 1 + (adjustments.sharpness * 0.3);
    filters.push(`contrast(${sharpness})`);

    // Clarity: -1 to 1 -> CSS contrast + brightness
    const clarity = 1 + (adjustments.clarity * 0.2);
    filters.push(`contrast(${clarity})`);

    // Vignette: 0 to 1 -> CSS radial-gradient overlay
    const vignette = adjustments.vignette;
    if (vignette > 0.01) {
      // This will be handled via overlay View
    }

    return filters.join(' ');
  }, [adjustments]);

  // Animated style for smooth transitions
  const animatedStyle = useAnimatedStyle(() => {
    return {
      filter: filterStyle,
    };
  });

  // Vignette overlay style
  const vignetteStyle = useMemo(() => {
    if (adjustments.vignette <= 0.01) return null;

    const opacity = adjustments.vignette * 0.7; // Max 70% opacity
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'black',
      opacity,
      pointerEvents: 'none' as const,
    };
  }, [adjustments.vignette]);

  return (
    <View style={[styles.container, { width, height }]}>
      <Image
        source={{ uri: showBeforeAfter ? originalUri : uri }}
        style={[
          styles.image,
          {
            width,
            height,
          },
          !showBeforeAfter && animatedStyle,
        ]}
        contentFit="contain"
        cachePolicy="none"
      />
      
      {/* Vignette overlay */}
      {!showBeforeAfter && vignetteStyle && (
        <View style={vignetteStyle} />
      )}

      {/* Before/After label */}
      {showBeforeAfter && (
        <View style={[styles.beforeAfterLabel, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <View style={styles.labelText}>
            <Image
              source={{ uri: originalUri }}
              style={[styles.thumbnail, { width: 40, height: 40 }]}
              contentFit="cover"
            />
            <View style={styles.labelTextContent}>
              <Image
                source={{ uri: uri }}
                style={[styles.thumbnail, { width: 40, height: 40 }]}
                contentFit="cover"
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    backgroundColor: 'transparent',
  },
  beforeAfterLabel: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 4,
  },
  labelText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  labelTextContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});
