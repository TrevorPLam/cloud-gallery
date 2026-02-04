// AI-META-BEGIN
// AI-META: Babel configuration for Expo with module resolution aliases
// OWNERSHIP: build/config
// ENTRYPOINTS: used by Metro bundler and babel transpilation
// DEPENDENCIES: babel-preset-expo, module-resolver plugin, react-native-reanimated
// DANGER: plugin order matters (reanimated must be last); alias changes break all imports
// CHANGE-SAFETY: safe to add new aliases; do not reorder plugins; extensions list affects platform-specific file resolution
// TESTS: expo:dev, check:types after alias changes
// AI-META-END

// AI-NOTE: module-resolver aliases (@, @shared) enable absolute imports; reanimated plugin must be last for worklet transformation
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./client",
            "@shared": "./shared",
          },
          extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
