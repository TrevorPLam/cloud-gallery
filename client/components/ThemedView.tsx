// AI-META-BEGIN
// AI-META: Theme-aware View wrapper with light/dark background color overrides
// OWNERSHIP: client/components (UI primitives)
// ENTRYPOINTS: Used throughout app for container backgrounds
// DEPENDENCIES: theme system
// DANGER: Color fallback must match theme structure
// CHANGE-SAFETY: Safe to modify; changing logic affects all themed backgrounds
// TESTS: Verify light/dark mode transitions, test color override behavior
// AI-META-END

import { View, type ViewProps } from "react-native";

import { useTheme } from "@/hooks/useTheme";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const { theme, isDark } = useTheme();

  // AI-NOTE: Ternary chain prioritizes explicit overrides then falls back to theme root
  const backgroundColor =
    isDark && darkColor
      ? darkColor
      : !isDark && lightColor
        ? lightColor
        : theme.backgroundRoot;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
