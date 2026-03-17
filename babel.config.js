// AI-META-BEGIN
// AI-META: Enhanced Babel configuration for performance optimization
// OWNERSHIP: build/config
// ENTRYPOINTS: used by Metro bundler and babel transpilation
// DEPENDENCIES: babel-preset-expo, module-resolver plugin, react-native-reanimated
// DANGER: plugin order matters (reanimated must be last); alias changes break all imports
// CHANGE-SAFETY: safe to add new aliases; do not reorder plugins; extensions list affects platform-specific file resolution
// TESTS: expo:dev, check:types after alias changes
// AI-META-END

// AI-NOTE: Enhanced configuration with performance optimizations and better module resolution
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // Enable modern JavaScript features for better performance
          jsxImportSource: "react",
          // Optimize for production builds
          lazy: false,
        },
      ],
    ],
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
      // Performance optimizations
      ["@babel/plugin-transform-runtime", {
        helpers: true,
        regenerator: true,
        useESModules: false,
      }],
      // Remove unused imports for smaller bundles
      ["babel-plugin-transform-remove-console", {
        exclude: ["error", "warn", "info"],
      }],
      // React Native Reanimated must be last
      "react-native-reanimated/plugin",
    ],
    env: {
      production: {
        plugins: [
          // Additional optimizations for production
          "babel-plugin-transform-react-remove-prop-types",
          "babel-plugin-transform-react-pure-class-to-function",
        ],
      },
    },
  };
};
