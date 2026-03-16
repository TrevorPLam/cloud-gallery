#!/usr/bin/env node

/**
 * Test metrics extraction script
 * Extracts detailed test execution metrics from Vitest JSON output
 */

const fs = require('fs');
const path = require('path');

// Main function to extract metrics from test results
function extractTestMetrics(inputPath, outputPath) {
  try {
    console.log(`📊 Extracting test metrics from ${inputPath}`);
    
    // Read test results
    const testResults = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    
    // Initialize metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      pendingTests: 0,
      todoTests: 0,
      totalExecutionTime: 0,
      averageTestTime: 0,
      slowestTests: [],
      fastestTests: [],
      testSuites: {},
      coverage: {},
      performance: {},
      flakyIndicators: {},
      retryData: {},
      memoryUsage: process.memoryUsage(),
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        cpuCount: require('os').cpus().length,
        totalMemory: require('os').totalmem(),
        freeMemory: require('os').freemem()
      }
    };
    
    // Extract test metrics from Vitest results
    if (testResults.testResults) {
      const testFiles = testResults.testResults;
      const allTests = [];
      
      testFiles.forEach((testFile, fileIndex) => => {
        const filePath = testFile.name || `test-file-${fileIndex}`;
        const suiteMetrics = {
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          executionTime: 0,
          averageTestTime: 0
        };
        
        if (testFile.assertionResults) {
          testFile.assertionResults.forEach(test => {
            const testMetric = {
              name: test.title,
              fullName: test.fullName || test.title,
              filePath: filePath,
              status: test.status,
              duration: test.duration || 0,
              failureMessages: test.failureMessages || [],
              ancestorTitles: test.ancestorTitles || [],
              location: test.location
            };
            
            allTests.push(testMetric);
            
            // Update suite metrics
            suiteMetrics.totalTests++;
            suiteMetrics.executionTime += testMetric.duration;
            
            if (test.status === 'passed') {
              suiteMetrics.passedTests++;
              metrics.passedTests++;
            } else if (test.status === 'failed') {
              suiteMetrics.failedTests++;
              metrics.failedTests++;
            } else if (test.status === 'pending' || test.status === 'skipped') {
              suiteMetrics.skippedTests++;
              metrics.skippedTests++;
            }
          });
        }
        
        // Calculate suite average time
        if (suiteMetrics.totalTests > 0) {
          suiteMetrics.averageTestTime = suiteMetrics.executionTime / suiteMetrics.totalTests;
        }
        
        metrics.testSuites[filePath] = suiteMetrics;
      });
      
      // Calculate overall metrics
      metrics.totalTests = allTests.length;
      metrics.totalExecutionTime = allTests.reduce((sum, test) => sum + test.duration, 0);
      
      if (metrics.totalTests > 0) {
        metrics.averageTestTime = metrics.totalExecutionTime / metrics.totalTests;
        
        // Find slowest and fastest tests
        metrics.slowestTests = allTests
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
          .map(test => ({
            name: test.name,
            duration: test.duration,
            filePath: test.filePath
          }));
        
        metrics.fastestTests = allTests
          .filter(test => test.duration > 0) // Exclude tests with 0 duration
          .sort((a, b) => a.duration - b.duration)
          .slice(0, 10)
          .map(test => ({
            name: test.name,
            duration: test.duration,
            filePath: test.filePath
          }));
      }
      
      // Analyze flaky test indicators
      metrics.flakyIndicators = analyzeFlakyIndicators(allTests);
      
      // Extract retry data if available
      metrics.retryData = extractRetryData(testResults);
    }
    
    // Extract coverage data if available
    if (testResults.coverageMap) {
      metrics.coverage = extractCoverageMetrics(testResults.coverageMap);
    }
    
    // Load performance results if available
    const perfResultsPath = path.join(path.dirname(inputPath), 'performance-results.json');
    if (fs.existsSync(perfResultsPath)) {
      try {
        metrics.performance = JSON.parse(fs.readFileSync(perfResultsPath, 'utf8'));
      } catch (error) {
        console.warn('Warning: Could not load performance results:', error.message);
      }
    }
    
    // Calculate additional metrics
    metrics.successRate = metrics.totalTests > 0 ? (metrics.passedTests / metrics.totalTests) : 0;
    metrics.failureRate = metrics.totalTests > 0 ? (metrics.failedTests / metrics.totalTests) : 0;
    metrics.stabilityScore = calculateStabilityScore(metrics);
    
    // Write metrics to output file
    fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2));
    console.log(`✅ Test metrics saved to ${outputPath}`);
    
    // Print summary
    console.log(`\n📈 Test Metrics Summary:`);
    console.log(`   Total Tests: ${metrics.totalTests}`);
    console.log(`   Passed: ${metrics.passedTests} (${(metrics.successRate * 100).toFixed(1)}%)`);
    console.log(`   Failed: ${metrics.failedTests} (${(metrics.failureRate * 100).toFixed(1)}%)`);
    console.log(`   Execution Time: ${metrics.totalExecutionTime.toFixed(2)}s`);
    console.log(`   Average Test Time: ${metrics.averageTestTime.toFixed(2)}ms`);
    console.log(`   Stability Score: ${(metrics.stabilityScore * 100).toFixed(1)}%`);
    
    return metrics;
    
  } catch (error) {
    console.error('Error extracting test metrics:', error);
    process.exit(1);
  }
}

// Analyze indicators of potential flaky tests
function analyzeFlakyIndicators(tests) {
  const indicators = {
    slowTests: tests.filter(test => test.duration > 5000).length, // > 5 seconds
    verySlowTests: tests.filter(test => test.duration > 30000).length, // > 30 seconds
    zeroDurationTests: tests.filter(test => test.duration === 0).length,
    testsWithFailures: tests.filter(test => test.status === 'failed').length,
    testsWithLongNames: tests.filter(test => test.name.length > 100).length,
    testsInDeepPaths: tests.filter(test => test.filePath.split('/').length > 8).length
  };
  
  // Calculate flaky risk score
  const riskFactors = [
    indicators.slowTests * 0.1,
    indicators.verySlowTests * 0.3,
    indicators.zeroDurationTests * 0.2,
    indicators.testsWithFailures * 0.4,
    indicators.testsWithLongNames * 0.1,
    indicators.testsInDeepPaths * 0.1
  ];
  
  indicators.flakyRiskScore = Math.min(riskFactors.reduce((sum, factor) => sum + factor, 0), 1);
  indicators.recommendations = generateFlakyRecommendations(indicators);
  
  return indicators;
}

// Extract retry data from test results
function extractRetryData(testResults) {
  // This would be populated if tests were run with retry logic
  // For now, return placeholder data
  return {
    totalRetries: 0,
    retriedTests: [],
    retryRate: 0,
    maxRetriesPerTest: 0
  };
}

// Extract coverage metrics
function extractCoverageMetrics(coverageMap) {
  const coverage = {
    totalLines: 0,
    coveredLines: 0,
    totalFunctions: 0,
    coveredFunctions: 0,
    totalBranches: 0,
    coveredBranches: 0,
    lineCoverage: 0,
    functionCoverage: 0,
    branchCoverage: 0,
    overallCoverage: 0
  };
  
  // This would be implemented based on the coverage map structure
  // For now, return placeholder data
  return coverage;
}

// Calculate test stability score
function calculateStabilityScore(metrics) {
  let score = 1.0;
  
  // Deduct points for failures
  score -= metrics.failureRate * 0.5;
  
  // Deduct points for flaky indicators
  score -= metrics.flakyIndicators.flakyRiskScore * 0.3;
  
  // Deduct points for very slow tests
  if (metrics.flakyIndicators.verySlowTests > 0) {
    score -= Math.min(metrics.flakyIndicators.verySlowTests * 0.05, 0.2);
  }
  
  return Math.max(score, 0);
}

// Generate recommendations for flaky tests
function generateFlakyRecommendations(indicators) {
  const recommendations = [];
  
  if (indicators.slowTests > 5) {
    recommendations.push('Consider optimizing slow tests (>5s) for better performance');
  }
  
  if (indicators.verySlowTests > 0) {
    recommendations.push('Very slow tests (>30s) detected - consider breaking down or mocking');
  }
  
  if (indicators.zeroDurationTests > indicators.totalTests * 0.1) {
    recommendations.push('Many tests with 0ms duration - check test timing accuracy');
  }
  
  if (indicators.testsWithLongNames > 5) {
    recommendations.push('Consider shortening very long test names for better readability');
  }
  
  if (indicators.testsInDeepPaths > 10) {
    recommendations.push('Many tests in deep directory paths - consider reorganizing test structure');
  }
  
  return recommendations;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Usage: node extract-test-metrics.js <input-json> <output-json>');
    process.exit(1);
  }
  
  const [inputPath, outputPath] = args;
  extractTestMetrics(inputPath, outputPath);
}

module.exports = { extractTestMetrics, analyzeFlakyIndicators, calculateStabilityScore };
