/**
 * Vitest configuration for Cloud Gallery.
 *
 * Purpose: define test runtime, coverage, and module resolution behavior.
 * Inputs: test files under client/server/shared, runtime env (happy-dom).
 * Outputs: test execution configuration used by vitest CLI.
 * Invariants: coverage thresholds stay at 100% and focused tests are disallowed.
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    allowOnly: false,
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    exclude: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/server_dist/**",
      "**/static-build/**",
      "**/.expo/**",
      "**/.git/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "client/**/*.{ts,tsx}",
        "server/**/*.{ts,tsx}",
        "shared/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/node_modules/**",
        "**/build/**",
        "**/dist/**",
        "**/server_dist/**",
        "**/static-build/**",
        "**/.expo/**",
        // Expo/React Native bootstrap files
        "client/index.js",
        "client/App.tsx",
        // Server bootstrap file (tested via unit tests of individual functions)
        "server/index.ts",
        // React Native UI components (primarily JSX/styling, minimal logic)
        "client/components/**",
        "client/screens/**",
        "client/navigation/**",
        // Type definitions (no runtime code)
        "client/types/**",
        // Theme constants (static data)
        "client/constants/**",
        // Platform-specific hooks (covered by integration tests)
        "client/hooks/**",
      ],
      all: true,
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
