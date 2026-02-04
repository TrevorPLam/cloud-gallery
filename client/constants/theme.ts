// AI-META-BEGIN
// AI-META: Design system constants for colors, spacing, typography, and shadows
// OWNERSHIP: client/constants (design tokens)
// ENTRYPOINTS: Imported by components and hooks for consistent styling
// DEPENDENCIES: react-native Platform
// DANGER: Changes affect entire UI; test both light and dark themes; platform fonts differ
// CHANGE-SAFETY: Safe to add values; changing existing values requires visual regression testing
// TESTS: Visual verification across platforms and themes; check font availability
// AI-META-END

import { Platform } from "react-native";

// AI-NOTE: Complete light and dark theme objects ensure all color keys exist in both modes
export const Colors = {
  light: {
    text: "#1A202C",
    textSecondary: "#718096",
    buttonText: "#FFFFFF",
    tabIconDefault: "#718096",
    tabIconSelected: "#2D3748",
    link: "#2D3748",
    accent: "#D4AF37",
    backgroundRoot: "#FAFBFC",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#F7FAFC",
    backgroundTertiary: "#EDF2F7",
    border: "#E2E8F0",
    success: "#48BB78",
    error: "#F56565",
    overlay: "rgba(0,0,0,0.5)",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#A0AEC0",
    buttonText: "#FFFFFF",
    tabIconDefault: "#718096",
    tabIconSelected: "#D4AF37",
    link: "#D4AF37",
    accent: "#D4AF37",
    backgroundRoot: "#1A202C",
    backgroundDefault: "#2D3748",
    backgroundSecondary: "#2A3441",
    backgroundTertiary: "#3D4A5C",
    border: "#4A5568",
    success: "#48BB78",
    error: "#FC8181",
    overlay: "rgba(0,0,0,0.7)",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
  photoGap: 2,
  fabSize: 56,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  hero: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  // AI-NOTE: Web font stacks provide cross-platform compatibility with system fonts
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  fab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
};
