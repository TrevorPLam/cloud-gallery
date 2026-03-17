// AI-META-BEGIN
// AI-META: TV module exports for Cloud Gallery TV integration
// OWNERSHIP: client/tv
// DEPENDENCIES: All TV modules
// DANGER: This is the main TV export file; ensure all exports are properly typed
// CHANGE-SAFETY: Safe to add new exports; maintain backward compatibility
// TESTS: Test all TV functionality through these exports
// AI-META-END

// Core TV services
export { tvStreamingService, createStreamConfig } from "./streaming-service";
export {
  tvVoiceSearchService,
  isVoiceCommandSupported,
  getVoiceCommandHelp,
} from "./voice-search";

// TV screens
export { TVGalleryScreen } from "./TVGalleryScreen";

// TV utilities and navigation
export {
  useTVNavigation,
  useTVFocusGuide,
  useTVGridNavigation,
  tvAccessibility,
  tvDesign,
  TV_CONSTANTS,
} from "./navigation-utils";

// Type exports
export type {
  StreamQuality,
  StreamConfig,
  StreamingState,
} from "./streaming-service";

export type {
  VoiceCommand,
  VoiceSearchResult,
  VoiceSearchState,
} from "./voice-search";

export type { FocusNode, NavigationGrid } from "./navigation-utils";

// TV-specific constants and utilities
export const TV_FEATURES = {
  STREAMING: true,
  VOICE_SEARCH: true,
  FOCUS_NAVIGATION: true,
  ADAPTIVE_BITRATE: true,
  VOICE_COMMANDS: [
    "search photos",
    "navigate to albums",
    "play video",
    "show recent",
    "show favorites",
    "open settings",
  ],
} as const;

// TV platform detection
export const isTVPlatform = (): boolean => {
  // In a real implementation, this would detect TV platforms
  // For now, we'll use environment variable or platform detection
  return (
    // @ts-ignore - EXPO_TV might be set during build
    (typeof EXPO_TV !== "undefined" && EXPO_TV === "1") ||
    // Platform-specific detection
    require("react-native").Platform.isTV ||
    false
  );
};

// TV configuration helper
export const configureTVApp = () => {
  if (!isTVPlatform()) {
    console.warn("TV configuration applied on non-TV platform");
    return;
  }

  // Configure TV-specific settings
  console.log("Configuring TV app...");

  // Initialize TV services
  // This would be called from app initialization
};

// Default export
export default {
  // Services
  streaming: { tvStreamingService, createStreamConfig },
  voice: { tvVoiceSearchService, isVoiceCommandSupported, getVoiceCommandHelp },

  // Screens
  screens: { TVGalleryScreen },

  // Utilities
  navigation: {
    useTVNavigation,
    useTVFocusGuide,
    useTVGridNavigation,
    tvAccessibility,
    tvDesign,
    TV_CONSTANTS,
  },

  // Features
  features: TV_FEATURES,

  // Platform detection
  isTVPlatform,

  // Configuration
  configure: configureTVApp,
};
