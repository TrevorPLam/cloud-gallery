#!/usr/bin/env node

/**
 * Trend analysis script
 * Analyzes historical test metrics to identify trends, patterns, and insights
 */

const fs = require("fs");
const path = require("path");

// Trend analysis configuration
const CONFIG = {
  // Minimum data points required for trend analysis
  minDataPoints: 3,

  // Trend significance thresholds
  trendThreshold: 0.1, // 10% change considered significant

  // Time windows for analysis
  windows: {
    short: 7, // 7 days
    medium: 30, // 30 days
    long: 90, // 90 days
  },

  // Metrics to track
  metrics: [
    "totalTests",
    "passedTests",
    "failedTests",
    "totalExecutionTime",
    "averageTestTime",
    "successRate",
    "failureRate",
    "stabilityScore",
  ],
};

// Main function to generate trend analysis
function generateTrendAnalysis(coverageDir, outputPath) {
  try {
    console.log(`📈 Generating trend analysis from ${coverageDir}`);

    // Load historical data
    const historicalData = loadHistoricalMetrics(coverageDir);

    if (Object.keys(historicalData).length < CONFIG.minDataPoints) {
      console.log(
        `⚠️ Insufficient data for trend analysis (need ${CONFIG.minDataPoints}, have ${Object.keys(historicalData).length})`,
      );

      // Generate minimal analysis
      const minimalAnalysis = {
        timestamp: new Date().toISOString(),
        status: "insufficient_data",
        dataPoints: Object.keys(historicalData).length,
        message: `Need at least ${CONFIG.minDataPoints} data points for meaningful trend analysis`,
      };

      fs.writeFileSync(outputPath, JSON.stringify(minimalAnalysis, null, 2));
      return minimalAnalysis;
    }

    // Initialize trend analysis
    const trendAnalysis = {
      timestamp: new Date().toISOString(),
      status: "complete",
      dataPoints: Object.keys(historicalData).length,
      dateRange: {
        start: null,
        end: null,
      },
      overall: {
        trends: {},
        insights: [],
        recommendations: [],
      },
      metrics: {},
      windows: {
        short: {},
        medium: {},
        long: {},
      },
      predictions: {},
      anomalies: [],
      qualityScore: 0,
    };

    // Sort data by timestamp
    const sortedData = sortDataByTimestamp(historicalData);

    // Set date range
    trendAnalysis.dateRange.start = sortedData[0].timestamp;
    trendAnalysis.dateRange.end = sortedData[sortedData.length - 1].timestamp;

    // Analyze each metric
    CONFIG.metrics.forEach((metric) => {
      const metricAnalysis = analyzeMetricTrend(sortedData, metric);
      trendAnalysis.metrics[metric] = metricAnalysis;
      trendAnalysis.overall.trends[metric] = metricAnalysis.trend;
    });

    // Analyze different time windows
    Object.entries(CONFIG.windows).forEach(([windowName, days]) => {
      const windowData = filterDataByTimeWindow(sortedData, days);
      if (windowData.length >= 2) {
        trendAnalysis.windows[windowName] = analyzeTimeWindow(windowData);
      }
    });

    // Generate insights
    trendAnalysis.overall.insights = generateInsights(trendAnalysis);

    // Generate recommendations
    trendAnalysis.overall.recommendations =
      generateRecommendations(trendAnalysis);

    // Detect anomalies
    trendAnalysis.anomalies = detectAnomalies(sortedData);

    // Generate simple predictions
    trendAnalysis.predictions = generatePredictions(sortedData);

    // Calculate overall quality score
    trendAnalysis.qualityScore = calculateQualityScore(trendAnalysis);

    // Save results
    fs.writeFileSync(outputPath, JSON.stringify(trendAnalysis, null, 2));
    console.log(`✅ Trend analysis saved to ${outputPath}`);

    // Print summary
    console.log(`\n📈 Trend Analysis Summary:`);
    console.log(`   Data Points: ${trendAnalysis.dataPoints}`);
    console.log(
      `   Date Range: ${new Date(trendAnalysis.dateRange.start).toLocaleDateString()} - ${new Date(trendAnalysis.dateRange.end).toLocaleDateString()}`,
    );
    console.log(
      `   Quality Score: ${(trendAnalysis.qualityScore * 100).toFixed(1)}%`,
    );
    console.log(`   Insights: ${trendAnalysis.overall.insights.length}`);
    console.log(`   Anomalies: ${trendAnalysis.anomalies.length}`);

    if (trendAnalysis.overall.insights.length > 0) {
      console.log(`\n💡 Key Insights:`);
      trendAnalysis.overall.insights.slice(0, 3).forEach((insight, index) => {
        console.log(`   ${index + 1}. ${insight}`);
      });
    }

    return trendAnalysis;
  } catch (error) {
    console.error("Error generating trend analysis:", error);
    process.exit(1);
  }
}

// Load historical test metrics
function loadHistoricalMetrics(coverageDir) {
  const historicalData = {};

  try {
    const files = fs
      .readdirSync(coverageDir)
      .filter(
        (file) => file.startsWith("test-metrics-") && file.endsWith(".json"),
      );

    files.forEach((file) => {
      try {
        const filePath = path.join(coverageDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

        if (data.timestamp && data.totalTests !== undefined) {
          historicalData[file] = data;
        }
      } catch (error) {
        console.warn(
          `Warning: Could not load metrics from ${file}:`,
          error.message,
        );
      }
    });
  } catch (error) {
    console.warn("Warning: Could not read coverage directory:", error.message);
  }

  return historicalData;
}

// Sort data by timestamp
function sortDataByTimestamp(data) {
  return Object.values(data)
    .filter((item) => item.timestamp)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
}

// Analyze trend for a specific metric
function analyzeMetricTrend(sortedData, metric) {
  const values = sortedData.map((item) => item[metric] || 0);
  const timestamps = sortedData.map((item) =>
    new Date(item.timestamp).getTime(),
  );

  if (values.length < 2) {
    return {
      trend: "insufficient_data",
      direction: "unknown",
      change: 0,
      changePercent: 0,
      volatility: 0,
      confidence: 0,
    };
  }

  // Calculate trend using linear regression
  const regression = calculateLinearRegression(timestamps, values);

  // Determine trend direction
  let direction = "stable";
  let trend = "stable";

  if (Math.abs(regression.slope) > CONFIG.trendThreshold) {
    direction = regression.slope > 0 ? "increasing" : "decreasing";
    trend = regression.slope > 0 ? "improving" : "declining";
  }

  // Calculate change
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const change = lastValue - firstValue;
  const changePercent = firstValue !== 0 ? (change / firstValue) * 100 : 0;

  // Calculate volatility (standard deviation)
  const volatility = calculateStandardDeviation(values);

  // Calculate confidence based on R-squared
  const confidence = regression.rSquared || 0;

  return {
    trend: trend,
    direction: direction,
    change: change,
    changePercent: changePercent,
    volatility: volatility,
    confidence: confidence,
    regression: regression,
    values: values,
    timestamps: timestamps,
  };
}

// Calculate linear regression
function calculateLinearRegression(x, y) {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);
  const sumYY = y.reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
  const ssResidual = y.reduce((sum, val, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(val - predicted, 2);
  }, 0);

  const rSquared = 1 - ssResidual / ssTotal;

  return { slope, intercept, rSquared };
}

// Calculate standard deviation
function calculateStandardDeviation(values) {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

// Filter data by time window
function filterDataByTimeWindow(sortedData, days) {
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  return sortedData.filter(
    (item) => new Date(item.timestamp).getTime() >= cutoffTime,
  );
}

// Analyze time window
function analyzeTimeWindow(windowData) {
  const analysis = {
    dataPoints: windowData.length,
    metrics: {},
    summary: "",
  };

  CONFIG.metrics.forEach((metric) => {
    const values = windowData.map((item) => item[metric] || 0);
    if (values.length > 0) {
      analysis.metrics[metric] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        latest: values[values.length - 1],
      };
    }
  });

  // Generate summary
  const avgSuccessRate = analysis.metrics.successRate?.avg || 0;
  const avgStability = analysis.metrics.stabilityScore?.avg || 0;
  const avgExecTime = analysis.metrics.averageTestTime?.avg || 0;

  analysis.summary = `Success rate: ${(avgSuccessRate * 100).toFixed(1)}%, Stability: ${(avgStability * 100).toFixed(1)}%, Avg exec time: ${avgExecTime.toFixed(2)}ms`;

  return analysis;
}

// Generate insights from trend analysis
function generateInsights(trendAnalysis) {
  const insights = [];
  const metrics = trendAnalysis.metrics;

  // Success rate insights
  if (metrics.successRate?.trend === "declining") {
    insights.push(
      `Success rate is declining by ${Math.abs(metrics.successRate.changePercent).toFixed(1)}%`,
    );
  } else if (metrics.successRate?.trend === "improving") {
    insights.push(
      `Success rate is improving by ${metrics.successRate.changePercent.toFixed(1)}%`,
    );
  }

  // Execution time insights
  if (metrics.averageTestTime?.trend === "increasing") {
    insights.push(
      `Average test execution time is increasing by ${metrics.averageTestTime.changePercent.toFixed(1)}%`,
    );
  } else if (metrics.averageTestTime?.trend === "declining") {
    insights.push(
      `Test execution time is improving (decreasing) by ${Math.abs(metrics.averageTestTime.changePercent).toFixed(1)}%`,
    );
  }

  // Stability insights
  if (metrics.stabilityScore?.trend === "declining") {
    insights.push(
      `Test stability is declining by ${Math.abs(metrics.stabilityScore.changePercent).toFixed(1)}%`,
    );
  } else if (metrics.stabilityScore?.trend === "improving") {
    insights.push(
      `Test stability is improving by ${metrics.stabilityScore.changePercent.toFixed(1)}%`,
    );
  }

  // Test count insights
  if (metrics.totalTests?.trend === "increasing") {
    insights.push(
      `Test coverage is growing with ${metrics.totalTests.change} new tests`,
    );
  } else if (metrics.totalTests?.trend === "declining") {
    insights.push(
      `Test count is decreasing by ${Math.abs(metrics.totalTests.change)} tests`,
    );
  }

  // Volatility insights
  if (metrics.successRate?.volatility > 0.1) {
    insights.push(
      "Success rate shows high volatility - investigate test stability",
    );
  }

  if (metrics.averageTestTime?.volatility > 100) {
    insights.push(
      "Test execution times are highly variable - check for performance issues",
    );
  }

  return insights;
}

// Generate recommendations
function generateRecommendations(trendAnalysis) {
  const recommendations = [];
  const metrics = trendAnalysis.metrics;

  // Success rate recommendations
  if (
    metrics.successRate?.trend === "declining" &&
    metrics.successRate?.changePercent < -5
  ) {
    recommendations.push(
      "🔧 Address declining success rate - review recent code changes",
    );
  }

  // Performance recommendations
  if (
    metrics.averageTestTime?.trend === "increasing" &&
    metrics.averageTestTime?.changePercent > 10
  ) {
    recommendations.push(
      "⚡ Optimize slow tests - execution time is trending upward",
    );
  }

  // Stability recommendations
  if (metrics.stabilityScore?.trend === "declining") {
    recommendations.push(
      "🔍 Investigate test stability issues - implement better isolation",
    );
  }

  // Coverage recommendations
  if (metrics.totalTests?.trend === "stable") {
    recommendations.push("📝 Consider adding new tests to improve coverage");
  }

  // Volatility recommendations
  if (metrics.successRate?.volatility > 0.15) {
    recommendations.push(
      "🎯 Reduce test volatility - implement consistent test environments",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "✅ Test metrics look stable - continue current practices",
    );
  }

  return recommendations;
}

// Detect anomalies in the data
function detectAnomalies(sortedData) {
  const anomalies = [];

  if (sortedData.length < 3) return anomalies;

  // Look for significant drops in success rate
  const successRates = sortedData.map((item) => item.successRate || 0);
  const avgSuccessRate =
    successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length;

  sortedData.forEach((item, index) => {
    const successRate = item.successRate || 0;
    if (successRate < avgSuccessRate - 0.2) {
      // 20% below average
      anomalies.push({
        type: "low_success_rate",
        timestamp: item.timestamp,
        value: successRate,
        expected: avgSuccessRate,
        severity: successRate < 0.7 ? "high" : "medium",
      });
    }
  });

  // Look for unusual execution times
  const execTimes = sortedData.map((item) => item.averageTestTime || 0);
  const avgExecTime =
    execTimes.reduce((sum, time) => sum + time, 0) / execTimes.length;

  sortedData.forEach((item, index) => {
    const execTime = item.averageTestTime || 0;
    if (execTime > avgExecTime * 2) {
      // 2x above average
      anomalies.push({
        type: "high_execution_time",
        timestamp: item.timestamp,
        value: execTime,
        expected: avgExecTime,
        severity: execTime > avgExecTime * 3 ? "high" : "medium",
      });
    }
  });

  return anomalies;
}

// Generate simple predictions
function generatePredictions(sortedData) {
  const predictions = {};

  if (sortedData.length < 3) return predictions;

  CONFIG.metrics.forEach((metric) => {
    const values = sortedData.map((item) => item[metric] || 0);
    const timestamps = sortedData.map((item) =>
      new Date(item.timestamp).getTime(),
    );

    const regression = calculateLinearRegression(timestamps, values);

    // Predict next value (7 days from now)
    const nextTimestamp = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const predictedValue =
      regression.slope * nextTimestamp + regression.intercept;

    predictions[metric] = {
      nextWeek: predictedValue,
      confidence: regression.rSquared,
      trend:
        regression.slope > 0
          ? "increasing"
          : regression.slope < 0
            ? "decreasing"
            : "stable",
    };
  });

  return predictions;
}

// Calculate overall quality score
function calculateQualityScore(trendAnalysis) {
  let score = 0.5; // Start with neutral score

  // Success rate impact
  const successRate = trendAnalysis.metrics.successRate;
  if (successRate) {
    if (successRate.trend === "improving") score += 0.2;
    else if (successRate.trend === "declining") score -= 0.2;

    score += (successRate.confidence || 0) * 0.1;
  }

  // Stability impact
  const stability = trendAnalysis.metrics.stabilityScore;
  if (stability) {
    if (stability.trend === "improving") score += 0.15;
    else if (stability.trend === "declining") score -= 0.15;
  }

  // Performance impact
  const performance = trendAnalysis.metrics.averageTestTime;
  if (performance) {
    if (performance.trend === "declining")
      score += 0.1; // Lower execution time is good
    else if (performance.trend === "increasing") score -= 0.1;
  }

  // Anomaly penalty
  const anomalyPenalty = Math.min(trendAnalysis.anomalies.length * 0.05, 0.2);
  score -= anomalyPenalty;

  return Math.max(0, Math.min(1, score));
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error(
      "Usage: node generate-trend-analysis.js <coverage-dir> <output-json>",
    );
    process.exit(1);
  }

  const [coverageDir, outputPath] = args;
  generateTrendAnalysis(coverageDir, outputPath);
}

module.exports = {
  generateTrendAnalysis,
  analyzeMetricTrend,
  calculateQualityScore,
};
