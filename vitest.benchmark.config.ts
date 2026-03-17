/**
 * Vitest configuration for benchmark tests
 * 
 * Purpose: Separate configuration for performance benchmarks to avoid conflicts with regular tests
 * Inputs: Performance test files under tests/performance/
 * Outputs: Benchmark execution configuration
 * Invariants: Benchmark tests run separately from unit tests
 */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Benchmark-specific configuration
    benchmark: {
      include: [
        '**/*.bench.{ts,js}',
        '**/performance/**/*.test.{ts,js}',
        'tests/performance/**/*.test.{ts,js}'
      ],
      exclude: [
        '**/node_modules/**',
        '**/build/**',
        '**/dist/**',
        '**/server_dist/**',
        '**/static-build/**',
        '**/.expo/**',
        '**/.git/**'
      ],
      // Benchmark output options
      outputFile: './coverage/benchmark-results.json',
      reporter: ['default', 'json'],
    },
    
    // General test configuration for benchmarks
    allowOnly: false,
    globals: true,
    environment: "node", // Use node environment for performance tests
    setupFiles: ["./tests/performance/setup.ts"],
    
    // Isolate benchmarks for accurate measurements
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Run benchmarks single-threaded for consistency
        maxThreads: 1,
        minThreads: 1,
      },
    },
    
    // Longer timeouts for benchmarks
    testTimeout: 60000, // 60 seconds
    hookTimeout: 30000, // 30 seconds
    
    // Include only performance-related files
    include: [
      '**/*.bench.{ts,js}',
      '**/performance/**/*.test.{ts,js}',
      'tests/performance/**/*.test.{ts,js}'
    ],
    
    exclude: [
      "**/node_modules/**",
      "**/build/**",
      "**/dist/**",
      "**/server_dist/**",
      "**/static-build/**",
      "**/.expo/**",
      "**/.git/**",
      "**/research/**",
      // Exclude regular test files
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
    ],
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
  
  // Optimize for performance testing
  optimizeDeps: {
    exclude: ["react-native", "expo-blur", "@expo/vector-icons"],
  },
  
  esbuild: {
    target: "esnext",
    minify: false, // Don't minify for better performance measurement
    sourcemap: false, // Disable sourcemaps for benchmarks
    treeShaking: true,
  },
});
