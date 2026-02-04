// AI-META-BEGIN
// AI-META: Central theme hook providing color scheme and theme object
// OWNERSHIP: client/hooks (theming)
// ENTRYPOINTS: Used by nearly all components for styling
// DEPENDENCIES: useColorScheme, Colors constants
// DANGER: Fallback to "light" if colorScheme is null; theme structure must match Colors
// CHANGE-SAFETY: Safe to modify; changing fallback or theme structure affects entire app
// TESTS: Test light/dark mode switching, verify all color keys exist
// AI-META-END

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/useColorScheme";

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  // AI-NOTE: Fallback to light theme if colorScheme is null (edge case)
  const theme = Colors[colorScheme ?? "light"];

  return {
    theme,
    isDark,
  };
}
