/**
 * Vitest configuration with performance monitoring
 *
 * Purpose: define test runtime, coverage, and module resolution behavior with performance tracking.
 * Inputs: test files under client/server/shared, runtime env (happy-dom).
 * Outputs: test execution configuration used by vitest CLI with performance metrics.
 * Invariants: coverage thresholds stay at 100% and focused tests are disallowed.
 */
import { defineConfig } from "vitest";
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
        external: ["react-native", "expo", "@expo"],
      },
    },
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/server_dist/**",
      "**/static-build/**",
      "**/.expo/**",
      "**/.git/**",
      "**/research/**",
      // Exclude performance tests - they run separately with benchmark config
      "tests/performance/**",
      "**/performance/**",
      "**/*.bench.{ts,js}",
    ],
    // Performance monitoring settings
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 10000, // 10 seconds for hooks
    isolate: true, // Isolate tests for accurate performance measurement
    pool: 'threads', // Use thread pool for better performance
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    // Performance reporting
    reporters: ['default', 'json'],
    outputFile: {
      json: './coverage/test-results.json',
    },
    // Benchmark configuration
    benchmark: {
      include: ['**/*.bench.{ts,js}'],
      exclude: ['**/node_modules/**'],
    },
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
        "**/.git/**",
        "**/research/**",
        "client/constants/**",
        // Platform-specific hooks (covered by integration tests)
        "client/hooks/**",
      ],
      all: true,
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
      // Redirect react-native to mock to avoid Flow syntax errors
      "react-native": path.resolve(__dirname, "./__mocks__/react-native.ts"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"test"',
  },
  optimizeDeps: {
    exclude: ["react-native", "expo-blur", "@expo/vector-icons", "react-native-fast-tflite"],
  },
  // Handle React Native Flow types with performance optimizations
  esbuild: {
    target: "es2022",
    // Performance optimizations
    minify: false, // Don't minify in test for better debugging
    sourcemap: true, // Enable sourcemaps for better error tracking
    // Tree shaking for test files
    treeShaking: true,
  },
});
