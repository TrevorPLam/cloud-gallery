#!/usr/bin/env node

/**
 * Flaky test detection script
 * Analyzes test metrics to identify potentially flaky tests using multiple detection methods
 */

const fs = require('fs');
const path = require('path');

// Flaky test detection thresholds
const THRESHOLDS = {
  // Time-based indicators
  slowTestThreshold: 5000, // 5 seconds
  verySlowTestThreshold: 30000, // 30 seconds
  zeroDurationThreshold: 0, // 0ms indicates potential timing issues
  
  // Failure-based indicators
  failureRateThreshold: 0.3, // 30% failure rate
  consecutiveFailureThreshold: 3, // 3 consecutive failures
  
  // Historical indicators
  historicalFlakinessThreshold: 0.2, // 20% historical flakiness rate
  minHistoricalDataPoints: 5, // Minimum data points for historical analysis
  
  // Pattern-based indicators
  retryRateThreshold: 0.1, // 10% retry rate
  varianceThreshold: 0.5, // 50% variance in execution time
};

// Main function to detect flaky tests
function detectFlakyTests(metricsPath, outputPath) {
  try {
    console.log(`🔍 Analyzing flaky tests from ${metricsPath}`);
    
    // Load test metrics
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    
    // Load historical data if available
    const historicalData = loadHistoricalData(metricsPath);
    
    // Initialize flaky test detection results
    const flakyTestResults = {
      timestamp: new Date().toISOString(),
      analysis: {
        totalTests: metrics.totalTests || 0,
        flakyTests: [],
        suspiciousTests: [],
        stableTests: [],
        detectionMethods: {
          timeBased: [],
          failureBased: [],
          historicalBased: [],
          patternBased: []
        },
        summary: {
          flakyCount: 0,
          suspiciousCount: 0,
          stableCount: 0,
          flakyRate: 0,
          overallStability: 0
        }
      },
      recommendations: [],
      riskAssessment: {}
    };
    
    // Analyze each test for flakiness indicators
    if (metrics.testSuites) {
      Object.entries(metrics.testSuites).forEach(([filePath, suiteMetrics]) => {
        // This is a simplified analysis - in practice, we'd need individual test data
        const suiteAnalysis = analyzeSuiteForFlakiness(filePath, suiteMetrics, historicalData);
        
        if (suiteAnalysis.flakyTests.length > 0) {
          flakyTestResults.analysis.flakyTests.push(...suiteAnalysis.flakyTests);
        }
        
        if (suiteAnalysis.suspiciousTests.length > 0) {
          flakyTestResults.analysis.suspiciousTests.push(...suiteAnalysis.suspiciousTests);
        }
        
        if (suiteAnalysis.stableTests.length > 0) {
          flakyTestResults.analysis.stableTests.push(...suiteAnalysis.stableTests);
        }
      });
    }
    
    // Analyze slowest tests for potential flakiness
    if (metrics.slowestTests && metrics.slowestTests.length > 0) {
      const slowTestAnalysis = analyzeSlowTests(metrics.slowestTests, historicalData);
      flakyTestResults.analysis.detectionMethods.timeBased.push(...slowTestAnalysis);
    }
    
    // Analyze failure patterns
    if (metrics.failedTests > 0) {
      const failureAnalysis = analyzeFailurePatterns(metrics, historicalData);
      flakyTestResults.analysis.detectionMethods.failureBased.push(...failureAnalysis);
    }
    
    // Historical analysis
    if (Object.keys(historicalData).length > 0) {
      const historicalAnalysis = analyzeHistoricalFlakiness(metrics, historicalData);
      flakyTestResults.analysis.detectionMethods.historicalBased.push(...historicalAnalysis);
    }
    
    // Pattern-based analysis
    const patternAnalysis = analyzeTestPatterns(metrics);
    flakyTestResults.analysis.detectionMethods.patternBased.push(...patternAnalysis);
    
    // Calculate summary statistics
    const summary = flakyTestResults.analysis.summary;
    summary.flakyCount = flakyTestResults.analysis.flakyTests.length;
    summary.suspiciousCount = flakyTestResults.analysis.suspiciousTests.length;
    summary.stableCount = flakyTestResults.analysis.stableTests.length;
    summary.flakyRate = metrics.totalTests > 0 ? summary.flakyCount / metrics.totalTests : 0;
    summary.overallStability = calculateOverallStability(flakyTestResults.analysis);
    
    // Generate recommendations
    flakyTestResults.recommendations = generateFlakyTestRecommendations(flakyTestResults);
    
    // Risk assessment
    flakyTestResults.riskAssessment = assessFlakyTestRisk(flakyTestResults.analysis);
    
    // Save results
    fs.writeFileSync(outputPath, JSON.stringify(flakyTestResults, null, 2));
    console.log(`✅ Flaky test analysis saved to ${outputPath}`);
    
    // Print summary
    console.log(`\n🔍 Flaky Test Analysis Summary:`);
    console.log(`   Total Tests: ${summary.totalTests}`);
    console.log(`   Flaky Tests: ${summary.flakyCount} (${(summary.flakyRate * 100).toFixed(1)}%)`);
    console.log(`   Suspicious Tests: ${summary.suspiciousCount}`);
    console.log(`   Stable Tests: ${summary.stableCount}`);
    console.log(`   Overall Stability: ${(summary.overallStability * 100).toFixed(1)}%`);
    
    if (summary.flakyCount > 0) {
      console.log(`\n⚠️ Flaky Tests Detected:`);
      flakyTestResults.analysis.flakyTests.slice(0, 5).forEach((test, index) => {
        console.log(`   ${index + 1}. ${test.name} (${test.reason})`);
      });
      if (summary.flakyCount > 5) {
        console.log(`   ... and ${summary.flakyCount - 5} more`);
      }
    }
    
    return flakyTestResults;
    
  } catch (error) {
    console.error('Error detecting flaky tests:', error);
    process.exit(1);
  }
}

// Load historical test data
function loadHistoricalData(currentMetricsPath) {
  const historicalData = {};
  const coverageDir = path.dirname(currentMetricsPath);
  
  try {
    // Look for previous test metrics files
    const files = fs.readdirSync(coverageDir).filter(file => 
      file.startsWith('test-metrics-') && file.endsWith('.json')
    );
    
    files.forEach(file => {
      try {
        const filePath = path.join(coverageDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const timestamp = new Date(data.timestamp);
        
        if (!isNaN(timestamp.getTime())) {
          historicalData[file] = data;
        }
      } catch (error) {
        console.warn(`Warning: Could not load historical data from ${file}:`, error.message);
      }
    });
    
  } catch (error) {
    console.warn('Warning: Could not read historical data directory:', error.message);
  }
  
  return historicalData;
}

// Analyze a test suite for flakiness
function analyzeSuiteForFlakiness(filePath, suiteMetrics, historicalData) {
  const analysis = {
    flakyTests: [],
    suspiciousTests: [],
    stableTests: []
  };
  
  // Time-based analysis
  if (suiteMetrics.averageTestTime > THRESHOLDS.slowTestThreshold) {
    analysis.suspiciousTests.push({
      name: path.basename(filePath),
      filePath: filePath,
      reason: `Slow average execution time: ${suiteMetrics.averageTestTime.toFixed(2)}ms`,
      severity: 'medium',
      indicators: ['slow_execution']
    });
  }
  
  if (suiteMetrics.averageTestTime > THRESHOLDS.verySlowTestThreshold) {
    analysis.flakyTests.push({
      name: path.basename(filePath),
      filePath: filePath,
      reason: `Very slow average execution time: ${suiteMetrics.averageTestTime.toFixed(2)}ms`,
      severity: 'high',
      indicators: ['very_slow_execution']
    });
  }
  
  // Failure-based analysis
  if (suiteMetrics.totalTests > 0) {
    const failureRate = suiteMetrics.failedTests / suiteMetrics.totalTests;
    
    if (failureRate > THRESHOLDS.failureRateThreshold) {
      analysis.flakyTests.push({
        name: path.basename(filePath),
        filePath: filePath,
        reason: `High failure rate: ${(failureRate * 100).toFixed(1)}%`,
        severity: 'high',
        indicators: ['high_failure_rate'],
        failureRate: failureRate
      });
    } else if (failureRate > 0.1) {
      analysis.suspiciousTests.push({
        name: path.basename(filePath),
        filePath: filePath,
        reason: `Elevated failure rate: ${(failureRate * 100).toFixed(1)}%`,
        severity: 'low',
        indicators: ['elevated_failure_rate'],
        failureRate: failureRate
      });
    }
  }
  
  // Mark as stable if no issues found
  if (analysis.flakyTests.length === 0 && analysis.suspiciousTests.length === 0) {
    analysis.stableTests.push({
      name: path.basename(filePath),
      filePath: filePath,
      reason: 'No flakiness indicators detected',
      severity: 'stable'
    });
  }
  
  return analysis;
}

// Analyze slow tests for flakiness
function analyzeSlowTests(slowestTests, historicalData) {
  const analysis = [];
  
  slowestTests.forEach(test => {
    if (test.duration > THRESHOLDS.verySlowTestThreshold) {
      analysis.push({
        name: test.name,
        filePath: test.filePath,
        reason: `Very slow execution: ${test.duration}ms`,
        severity: 'high',
        indicators: ['very_slow_execution'],
        duration: test.duration
      });
    } else if (test.duration > THRESHOLDS.slowTestThreshold) {
      analysis.push({
        name: test.name,
        filePath: test.filePath,
        reason: `Slow execution: ${test.duration}ms`,
        severity: 'medium',
        indicators: ['slow_execution'],
        duration: test.duration
      });
    }
  });
  
  return analysis;
}

// Analyze failure patterns
function analyzeFailurePatterns(metrics, historicalData) {
  const analysis = [];
  
  // This is a simplified analysis - in practice, we'd look at specific test failure patterns
  if (metrics.failedTests > 0) {
    const failureRate = metrics.totalTests > 0 ? metrics.failedTests / metrics.totalTests : 0;
    
    if (failureRate > THRESHOLDS.failureRateThreshold) {
      analysis.push({
        name: 'General Test Suite',
        reason: `High overall failure rate: ${(failureRate * 100).toFixed(1)}%`,
        severity: 'high',
        indicators: ['high_failure_rate'],
        failureRate: failureRate
      });
    }
  }
  
  return analysis;
}

// Analyze historical flakiness
function analyzeHistoricalFlakiness(metrics, historicalData) {
  const analysis = [];
  
  // This would analyze historical patterns to identify consistently flaky tests
  // For now, return empty analysis as we need more historical data
  
  return analysis;
}

// Analyze test patterns for flakiness indicators
function analyzeTestPatterns(metrics) {
  const analysis = [];
  
  // Analyze execution time variance
  if (metrics.slowestTests.length > 0 && metrics.fastestTests.length > 0) {
    const slowest = metrics.slowestTests[0].duration;
    const fastest = metrics.fastestTests[0].duration;
    const variance = (slowest - fastest) / fastest;
    
    if (variance > THRESHOLDS.varianceThreshold) {
      analysis.push({
        name: 'Test Execution Variance',
        reason: `High execution time variance: ${(variance * 100).toFixed(1)}%`,
        severity: 'medium',
        indicators: ['high_variance'],
        variance: variance
      });
    }
  }
  
  return analysis;
}

// Calculate overall stability score
function calculateOverallStability(analysis) {
  const totalTests = analysis.summary.totalTests;
  
  if (totalTests === 0) return 1.0;
  
  // Weight different types of issues
  const flakyWeight = 0.8;
  const suspiciousWeight = 0.3;
  
  const flakyScore = analysis.summary.flakyCount * flakyWeight;
  const suspiciousScore = analysis.summary.suspiciousCount * suspiciousWeight;
  
  const totalIssues = flakyScore + suspiciousScore;
  const stabilityScore = Math.max(0, 1 - (totalIssues / totalTests));
  
  return stabilityScore;
}

// Generate recommendations for flaky tests
function generateFlakyTestRecommendations(results) {
  const recommendations = [];
  const summary = results.analysis.summary;
  
  if (summary.flakyCount > 0) {
    recommendations.push(`🔧 Fix ${summary.flakyCount} flaky tests to improve reliability`);
  }
  
  if (summary.suspiciousCount > 5) {
    recommendations.push('🔍 Investigate suspicious tests that may become flaky');
  }
  
  if (summary.overallStability < 0.8) {
    recommendations.push('⚠️ Overall test stability is below 80% - consider comprehensive test review');
  }
  
  // Specific recommendations based on detection methods
  results.analysis.detectionMethods.timeBased.forEach(test => {
    if (test.severity === 'high') {
      recommendations.push(`⏱️ Optimize "${test.name}" - very slow execution indicates potential issues`);
    }
  });
  
  results.analysis.detectionMethods.failureBased.forEach(test => {
    if (test.failureRate > 0.5) {
      recommendations.push(`🚨 Critical: "${test.name}" has ${((test.failureRate) * 100).toFixed(1)}% failure rate`);
    }
  });
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Test stability looks good - continue monitoring');
  }
  
  return recommendations;
}

// Assess overall risk
function assessFlakyTestRisk(analysis) {
  const risk = {
    level: 'low',
    score: 0,
    factors: [],
    mitigation: []
  };
  
  // Calculate risk score
  risk.score = (analysis.summary.flakyCount * 0.4) + 
               (analysis.summary.suspiciousCount * 0.2) +
               ((1 - analysis.summary.overallStability) * 0.4);
  
  // Determine risk level
  if (risk.score > 0.7) {
    risk.level = 'high';
  } else if (risk.score > 0.3) {
    risk.level = 'medium';
  }
  
  // Identify risk factors
  if (analysis.summary.flakyCount > 5) {
    risk.factors.push('High number of flaky tests');
  }
  
  if (analysis.summary.overallStability < 0.8) {
    risk.factors.push('Low overall test stability');
  }
  
  if (analysis.summary.flakyRate > 0.1) {
    risk.factors.push('High flaky test rate');
  }
  
  // Mitigation strategies
  risk.mitigation = [
    'Implement test retry logic for known flaky tests',
    'Add test isolation to prevent cross-test interference',
    'Use test containers for deterministic environments',
    'Monitor test execution times and optimize slow tests',
    'Review and fix tests with high failure rates'
  ];
  
  return risk;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Usage: node detect-flaky-tests.js <metrics-json> <output-json>');
    process.exit(1);
  }
  
  const [metricsPath, outputPath] = args;
  detectFlakyTests(metricsPath, outputPath);
}

module.exports = { detectFlakyTests, analyzeSuiteForFlakiness, assessFlakyTestRisk };
