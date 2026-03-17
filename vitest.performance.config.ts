/**
 * Vitest performance configuration
 *
 * Purpose: define benchmark test runtime and module resolution behavior.
 * Inputs: performance test files under tests/performance, runtime env (node).
 * Outputs: benchmark execution configuration used by vitest CLI.
 * Invariants: optimized for performance testing with minimal overhead.
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/performance/**/*.test.ts"],
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
    "process.env.NODE_ENV": '"test"',
  },
  optimizeDeps: {
    exclude: ["react-native", "expo-blur", "@expo/vector-icons"],
  },
  // Handle React Native Flow types
  esbuild: {
    target: "esnext",
  },
});
