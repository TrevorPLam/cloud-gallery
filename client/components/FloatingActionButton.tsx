// AI-META-BEGIN
// AI-META: Floating action button with haptics and tab bar positioning
// OWNERSHIP: client/components (navigation UI)
// ENTRYPOINTS: Rendered on PhotosScreen for upload action
// DEPENDENCIES: react-native-reanimated, expo-haptics, bottom-tabs, safe-area-context
// DANGER: Position calculation depends on tab bar height; haptics web incompatible
// CHANGE-SAFETY: Safe to modify styles; positioning logic affects all screen sizes
// TESTS: Check positioning on iOS/Android/web, verify haptics, test different tab bar configs
// AI-META-END

import React from "react";
import { StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Colors, Spacing, Shadows, BorderRadius } from "@/constants/theme";

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FloatingActionButton({
  onPress,
  icon = "plus",
}: FloatingActionButtonProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    // AI-NOTE: Haptic feedback enhances native feel but unavailable on web
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.fab,
        {
          bottom: tabBarHeight + Spacing.lg,
          right: Spacing.lg,
        },
        animatedStyle,
      ]}
      testID="fab-upload"
      accessibilityRole="button"
      accessibilityLabel={icon === "plus" ? "Upload photos" : `Add ${icon}`}
      accessibilityHint="Opens photo upload interface"
    >
      <Feather name={icon} size={24} color="#FFFFFF" />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    width: Spacing.fabSize,
    height: Spacing.fabSize,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.accent,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.fab,
  },
});
