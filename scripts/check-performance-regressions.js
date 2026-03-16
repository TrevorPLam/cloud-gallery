#!/usr/bin/env node

/**
 * Performance regression detection script
 * Analyzes performance test results and detects regressions
 */

const fs = require('fs');
const path = require('path');

// Performance regression thresholds
const THRESHOLDS = {
  timeRegressionThreshold: 0.15, // 15% increase
  memoryRegressionThreshold: 0.20, // 20% increase
  throughputRegressionThreshold: 0.10, // 10% decrease
  minSamples: 5,
  confidenceLevel: 0.95,
  maxVariance: 0.05, // 5%
};

// Load baseline performance data (if exists)
function loadBaseline() {
  const baselinePath = path.join(process.cwd(), 'performance-baseline.json');
  if (fs.existsSync(baselinePath)) {
    try {
      return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    } catch (error) {
      console.warn('Warning: Could not load baseline performance data:', error.message);
      return null;
    }
  }
  return null;
}

// Save current performance results as baseline
function saveBaseline(results) {
  const baselinePath = path.join(process.cwd(), 'performance-baseline.json');
  try {
    fs.writeFileSync(baselinePath, JSON.stringify(results, null, 2));
    console.log('✅ Performance baseline updated');
  } catch (error) {
    console.error('Error: Could not save performance baseline:', error.message);
  }
}

// Analyze performance results for regressions
function analyzeRegressions(current, baseline) {
  const regressions = [];
  const improvements = [];
  
  if (!baseline) {
    console.log('ℹ️ No baseline found - establishing new baseline');
    return { regressions: [], improvements: [], totalTests: Object.keys(current).length };
  }
  
  for (const [testName, currentResult] of Object.entries(current)) {
    const baselineResult = baseline[testName];
    
    if (!baselineResult) {
      console.log(`ℹ️ New test detected: ${testName}`);
      continue;
    }
    
    // Analyze time performance
    if (currentResult.duration && baselineResult.duration) {
      const timeIncrease = (currentResult.duration - baselineResult.duration) / baselineResult.duration;
      
      if (timeIncrease > THRESHOLDS.timeRegressionThreshold) {
        regressions.push({
          type: 'time',
          test: testName,
          current: currentResult.duration,
          baseline: baselineResult.duration,
          increase: timeIncrease * 100,
          threshold: THRESHOLDS.timeRegressionThreshold * 100,
        });
      } else if (timeIncrease < -THRESHOLDS.timeRegressionThreshold) {
        improvements.push({
          type: 'time',
          test: testName,
          current: currentResult.duration,
          baseline: baselineResult.duration,
          improvement: Math.abs(timeIncrease) * 100,
        });
      }
    }
    
    // Analyze memory usage
    if (currentResult.memoryDelta && baselineResult.memoryDelta) {
      const memoryIncrease = (currentResult.memoryDelta - baselineResult.memoryDelta) / baselineResult.memoryDelta;
      
      if (memoryIncrease > THRESHOLDS.memoryRegressionThreshold) {
        regressions.push({
          type: 'memory',
          test: testName,
          current: currentResult.memoryDelta,
          baseline: baselineResult.memoryDelta,
          increase: memoryIncrease * 100,
          threshold: THRESHOLDS.memoryRegressionThreshold * 100,
        });
      }
    }
    
    // Analyze throughput
    if (currentResult.throughput && baselineResult.throughput) {
      const throughputDecrease = (baselineResult.throughput - currentResult.throughput) / baselineResult.throughput;
      
      if (throughputDecrease > THRESHOLDS.throughputRegressionThreshold) {
        regressions.push({
          type: 'throughput',
          test: testName,
          current: currentResult.throughput,
          baseline: baselineResult.throughput,
          decrease: throughputDecrease * 100,
          threshold: THRESHOLDS.throughputRegressionThreshold * 100,
        });
      } else if (throughputDecrease < -THRESHOLDS.throughputRegressionThreshold) {
        improvements.push({
          type: 'throughput',
          test: testName,
          current: currentResult.throughput,
          baseline: baselineResult.throughput,
          improvement: Math.abs(throughputDecrease) * 100,
        });
      }
    }
  }
  
  return { regressions, improvements, totalTests: Object.keys(current).length };
}

// Generate performance report
function generateReport(regressions, improvements, totalTests) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests,
      regressions: regressions.length,
      improvements: improvements.length,
      status: regressions.length > 0 ? 'FAILED' : 'PASSED',
    },
    regressions,
    improvements,
  };
  
  return report;
}

// Main execution
function main() {
  try {
    // Load current performance results
    const resultsPath = path.join(process.cwd(), 'coverage', 'performance-results.json');
    
    if (!fs.existsSync(resultsPath)) {
      console.log('⚠️ No performance results found - skipping regression analysis');
      process.exit(0);
    }
    
    const currentResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    console.log(`📊 Analyzing ${Object.keys(currentResults).length} performance tests`);
    
    // Load baseline
    const baseline = loadBaseline();
    
    // Analyze for regressions
    const { regressions, improvements, totalTests } = analyzeRegressions(currentResults, baseline);
    
    // Generate report
    const report = generateReport(regressions, improvements, totalTests);
    
    // Save report
    const reportPath = path.join(process.cwd(), 'coverage', 'performance-regression-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Output results
    console.log(`\n📈 Performance Regression Analysis:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Regressions: ${regressions.length}`);
    console.log(`   Improvements: ${improvements.length}`);
    console.log(`   Status: ${report.summary.status}`);
    
    if (regressions.length > 0) {
      console.log(`\n⚠️ Performance Regressions Detected:`);
      regressions.forEach((regression, index) => {
        console.log(`   ${index + 1}. ${regression.test}`);
        console.log(`      Type: ${regression.type}`);
        
        if (regression.type === 'time') {
          console.log(`      Time: ${regression.current.toFixed(2)}ms vs ${regression.baseline.toFixed(2)}ms (+${regression.increase.toFixed(1)}%)`);
        } else if (regression.type === 'memory') {
          console.log(`      Memory: ${(regression.current / 1024 / 1024).toFixed(2)}MB vs ${(regression.baseline / 1024 / 1024).toFixed(2)}MB (+${regression.increase.toFixed(1)}%)`);
        } else if (regression.type === 'throughput') {
          console.log(`      Throughput: ${regression.current.toFixed(2)} ops/sec vs ${regression.baseline.toFixed(2)} ops/sec (-${regression.decrease.toFixed(1)}%)`);
        }
        
        console.log(`      Threshold: ${regression.threshold.toFixed(1)}%`);
      });
    }
    
    if (improvements.length > 0) {
      console.log(`\n✅ Performance Improvements:`);
      improvements.forEach((improvement, index) => {
        console.log(`   ${index + 1}. ${improvement.test} (${improvement.type}): +${improvement.improvement.toFixed(1)}%`);
      });
    }
    
    // Update baseline if this is main branch or no regressions
    const isMainBranch = process.env.GITHUB_REF?.includes('main') || process.env.GITHUB_REF?.includes('master');
    
    if (isMainBranch && regressions.length === 0) {
      console.log(`\n🔄 Updating performance baseline (main branch with no regressions)`);
      saveBaseline(currentResults);
    } else if (regressions.length > 0) {
      console.log(`\n❌ Performance regressions detected - baseline not updated`);
      process.exit(1); // Fail the build
    } else {
      console.log(`\n✅ No performance regressions detected`);
    }
    
  } catch (error) {
    console.error('Error during performance regression analysis:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, analyzeRegressions, generateReport };
