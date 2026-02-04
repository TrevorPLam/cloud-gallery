// AI-META-BEGIN
// AI-META: Re-export of React Native's useColorScheme hook for native platforms
// OWNERSHIP: client/hooks (platform detection)
// ENTRYPOINTS: Imported by useTheme hook
// DEPENDENCIES: react-native
// DANGER: Web has separate implementation; import must resolve to correct platform file
// CHANGE-SAFETY: Safe - simple re-export; platform-specific file selection critical
// TESTS: Verify correct platform file loads on iOS/Android vs web
// AI-META-END

export { useColorScheme } from "react-native";
