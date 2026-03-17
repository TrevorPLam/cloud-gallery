// AI-META-BEGIN
// AI-META: Enhanced Metro configuration for performance optimization
// OWNERSHIP: build/config
// ENTRYPOINTS: used by Expo Metro bundler for development and production builds
// DEPENDENCIES: expo/metro-config, node fs, path
// DANGER: resolver changes affect all imports; transformer config affects build output
// CHANGE-SAFETY: safe to add asset extensions; transformer changes require full rebuild
// TESTS: expo:dev, expo:static:build after config changes
// AI-META-END

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// AI-NOTE: Performance optimizations for faster builds and better caching
config.transformer.minifierConfig = {
  keep_fnames: false,
  mangle: {
    toplevel: false,
  },
  output: {
    ascii_only: true,
    comments: false,
  },
};

// AI-NOTE: Enhanced resolver configuration for better module resolution
config.resolver.assetExts.push(
  // ML model files
  "tflite",
  "onnx",
  "pb",
  // Additional asset types
  "glb",
  "gltf",
  "hdr",
  "exr"
);

// AI-NOTE: Source extensions for better TypeScript/JavaScript support
config.resolver.sourceExts.push("jsx", "js", "ts", "tsx", "json");

// AI-NOTE: Watch settings for development performance
config.watchFiles = true;
config.maxWorkers = 4; // Optimize for multi-core builds

// AI-NOTE: Enhanced caching for faster incremental builds
config.resetCache = false;
config.cacheStores = [
  new (require("metro-cache").FileStore)({
    root: path.join(__dirname, ".metro-cache"),
  }),
];

// AI-NOTE: Module resolution aliases for absolute imports
config.resolver.alias = {
  "@": path.resolve(__dirname, "client"),
  "@shared": path.resolve(__dirname, "shared"),
};

// AI-NOTE: Platform-specific optimizations
config.platforms = ["ios", "android", "native"];

module.exports = config;
