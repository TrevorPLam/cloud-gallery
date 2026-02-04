// AI-META-BEGIN
// AI-META: Navigation screen options hook with platform-specific header styling
// OWNERSHIP: client/hooks (navigation config)
// ENTRYPOINTS: Used by all stack navigators for consistent header appearance
// DEPENDENCIES: @react-navigation/native-stack, expo-glass-effect, theme system
// DANGER: Platform checks control transparency/blur; liquid glass affects gestures
// CHANGE-SAFETY: Safe to modify styles; transparent/blur settings platform-dependent
// TESTS: Test on iOS (blur), Android (solid), web; verify liquid glass gesture interaction
// AI-META-END

import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { isLiquidGlassAvailable } from "expo-glass-effect";

import { useTheme } from "@/hooks/useTheme";

interface UseScreenOptionsParams {
  transparent?: boolean;
}

export function useScreenOptions({
  transparent = true,
}: UseScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { theme, isDark } = useTheme();

  return {
    headerTitleAlign: "center",
    headerTransparent: transparent,
    headerBlurEffect: isDark ? "dark" : "light",
    headerTintColor: theme.text,
    // AI-NOTE: iOS uses transparent header with blur; Android/web need solid background
    headerStyle: {
      backgroundColor: Platform.select({
        ios: undefined,
        android: theme.backgroundRoot,
        web: theme.backgroundRoot,
      }),
    },
    gestureEnabled: true,
    gestureDirection: "horizontal",
    // AI-NOTE: Liquid glass effect conflicts with full screen gestures on iOS
    fullScreenGestureEnabled: isLiquidGlassAvailable() ? false : true,
    contentStyle: {
      backgroundColor: theme.backgroundRoot,
    },
  };
}
