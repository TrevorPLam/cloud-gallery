/**
 * Vitest configuration for performance testing
 */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    allowOnly: false,
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts", "./tests/performance/setup.ts"],
    server: {
      deps: {
        inline: ["react-native-reanimated"],
      },
    },
    include: ["tests/performance/**/*.test.ts"],
    clearMocks: true,
    exclude: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/server_dist/**",
      "**/static-build/**",
      "**/.expo/**",
      "**/.git/**",
      "**/research/**",
    ],
    // Transform React Native files to handle Flow types
    testTransformMode: 'ssr',
    // Performance-specific configuration
    benchmark: {
      include: ["tests/performance/**/*.test.ts"],
      exclude: ["**/node_modules/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  optimizeDeps: {
    exclude: ['react-native', 'expo-blur', '@expo/vector-icons'],
  },
  // Handle React Native Flow types
  esbuild: {
    target: 'esnext',
  },
});
