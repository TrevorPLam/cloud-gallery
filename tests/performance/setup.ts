/**
 * Performance test setup
 * Captures performance test results and saves them for regression analysis
 */

import { defineConfig } from "vitest/config";

// Performance results collector
class PerformanceResultsCollector {
  private results: Map<string, any> = new Map();
  private testSuites: string[] = [];

  addResult(testName: string, result: any) {
    this.results.set(testName, {
      ...result,
      timestamp: Date.now(),
    });
  }

  addTestSuite(suiteName: string) {
    this.testSuites.push(suiteName);
  }

  getResults() {
    return Object.fromEntries(this.results);
  }

  getTestSuites() {
    return this.testSuites;
  }

  saveResults() {
    const fs = require("fs");
    const path = require("path");

    const results = {
      timestamp: new Date().toISOString(),
      testSuites: this.testSuites,
      results: this.getResults(),
      summary: this.generateSummary(),
    };

    const resultsPath = path.join(
      process.cwd(),
      "coverage",
      "performance-results.json",
    );

    // Ensure coverage directory exists
    const coverageDir = path.dirname(resultsPath);
    if (!fs.existsSync(coverageDir)) {
      fs.mkdirSync(coverageDir, { recursive: true });
    }

    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`📊 Performance results saved to: ${resultsPath}`);

    return results;
  }

  private generateSummary() {
    const results = this.getResults();
    const testCount = Object.keys(results).length;

    let totalTime = 0;
    let totalMemory = 0;
    let regressions = 0;

    for (const result of Object.values(results)) {
      if (result.duration) totalTime += result.duration;
      if (result.memoryDelta) totalMemory += result.memoryDelta;
      // Note: Actual regression detection happens in the separate script
    }

    return {
      testCount,
      totalTime: totalTime / testCount,
      totalMemory: totalMemory / testCount,
      regressions, // Will be calculated by regression detection script
    };
  }
}

// Global performance collector
global.performanceCollector = new PerformanceResultsCollector();

// Custom Vitest reporter for performance tests
const performanceReporter = {
  onTestEnd: (test: any) => {
    if (test.location?.file?.includes("performance") && test.result?.duration) {
      const testName = `${test.location.file}:${test.name}`;

      global.performanceCollector.addResult(testName, {
        duration: test.result.duration,
        status: test.result.state,
        passed: test.result.state === "pass",
      });
    }
  },

  onSuiteEnd: (suite: any) => {
    if (suite.file?.includes("performance")) {
      global.performanceCollector.addTestSuite(suite.file);
    }
  },

  onFinished: () => {
    if (global.performanceCollector.getTestSuites().length > 0) {
      global.performanceCollector.saveResults();
    }
  },
};

export { PerformanceResultsCollector, performanceReporter };
