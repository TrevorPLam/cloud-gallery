#!/usr/bin/env node

// AI-META-BEGIN
// AI-META: Test performance monitoring and metrics collection script
// OWNERSHIP: scripts/performance-monitor
// ENTRYPOINTS: npm run test:performance-monitor
// DEPENDENCIES: Node.js fs, path, child_process
// DANGER: parses test output; modifies metrics files; requires vitest JSON reporter
// CHANGE-SAFETY: test command changes affect metrics collection; file paths must match vitest output
// TESTS: npm run test:performance-monitor, verify metrics files are created
// AI-META-END

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      timestamp: new Date().toISOString(),
      testResults: [],
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        totalDuration: 0,
        slowestTests: [],
        fastestTests: [],
        coverage: {},
        performanceScores: {}
      }
    };
  }

  async runTests() {
    console.log('🚀 Running performance-monitored tests...');
    
    try {
      // Run tests with JSON output for parsing
      const output = execSync(
        'npx vitest run --reporter=json --outputFile=/tmp/test-results.json',
        { 
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: 300000 // 5 minutes
        }
      );
      
      console.log('✅ Tests completed');
      return this.parseTestResults('/tmp/test-results.json');
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      throw error;
    }
  }

  parseTestResults(resultsPath) {
    try {
      if (fs.existsSync(resultsPath)) {
        const rawData = fs.readFileSync(resultsPath, 'utf8');
        const testResults = JSON.parse(rawData);
        return this.analyzeTestResults(testResults);
      } else {
        console.warn('⚠️ Test results file not found, using fallback parsing');
        return this.fallbackAnalysis();
      }
    } catch (error) {
      console.error('❌ Failed to parse test results:', error.message);
      return this.fallbackAnalysis();
    }
  }

  analyzeTestResults(results) {
    const testFiles = results.testResults || [];
    const allTests = [];

    testFiles.forEach(file => {
      file.tests?.forEach(test => {
        allTests.push({
          name: test.title || test.name,
          file: file.file,
          duration: test.duration || 0,
          status: test.result?.status || 'unknown',
          errors: test.result?.errors || []
        });
      });
    });

    // Sort by duration
    allTests.sort((a, b) => b.duration - a.duration);

    this.metrics.summary.totalTests = allTests.length;
    this.metrics.summary.passedTests = allTests.filter(t => t.status === 'passed').length;
    this.metrics.summary.failedTests = allTests.filter(t => t.status === 'failed').length;
    this.metrics.summary.totalDuration = allTests.reduce((sum, t) => sum + t.duration, 0);
    this.metrics.summary.slowestTests = allTests.slice(0, 10);
    this.metrics.summary.fastestTests = allTests.slice(-10).reverse();

    return allTests;
  }

  fallbackAnalysis() {
    console.log('📊 Running fallback performance analysis...');
    
    // Basic metrics without detailed test parsing
    return {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      totalDuration: 0,
      slowestTests: [],
      fastestTests: []
    };
  }

  calculatePerformanceScores() {
    const { summary } = this.metrics;
    
    // Performance score calculation (0-100)
    const passRate = summary.totalTests > 0 ? (summary.passedTests / summary.totalTests) * 100 : 0;
    const avgDuration = summary.totalTests > 0 ? summary.totalDuration / summary.totalTests : 0;
    
    // Score based on pass rate and speed (lower duration is better)
    const speedScore = Math.max(0, 100 - (avgDuration / 100)); // Penalize slow tests
    const reliabilityScore = passRate;
    
    this.metrics.summary.performanceScores = {
      overall: Math.round((speedScore + reliabilityScore) / 2),
      reliability: Math.round(reliabilityScore),
      speed: Math.round(speedScore),
      passRate: Math.round(passRate)
    };

    return this.metrics.summary.performanceScores;
  }

  generateReport() {
    const { summary } = this.metrics;
    const scores = this.calculatePerformanceScores();
    
    const report = {
      ...this.metrics,
      recommendations: this.generateRecommendations(scores),
      trends: this.analyzeTrends()
    };

    return report;
  }

  generateRecommendations(scores) {
    const recommendations = [];

    if (scores.reliability < 90) {
      recommendations.push('🔧 Focus on fixing failing tests to improve reliability');
    }

    if (scores.speed < 70) {
      recommendations.push('⚡ Optimize slow tests for better performance');
    }

    if (summary.slowestTests.length > 0 && summary.slowestTests[0].duration > 5000) {
      recommendations.push('🐌 Consider refactoring tests taking longer than 5 seconds');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Test performance is excellent!');
    }

    return recommendations;
  }

  analyzeTrends() {
    const trendsPath = path.join(__dirname, '../coverage/performance-trends.json');
    
    if (fs.existsSync(trendsPath)) {
      try {
        const historicalData = JSON.parse(fs.readFileSync(trendsPath, 'utf8'));
        const currentScore = this.metrics.summary.performanceScores.overall;
        
        if (historicalData.length > 0) {
          const lastScore = historicalData[historicalData.length - 1].overall;
          const trend = currentScore > lastScore ? 'improving' : 'declining';
          const change = currentScore - lastScore;
          
          return {
            trend,
            change: Math.round(change),
            lastScore,
            currentScore
          };
        }
      } catch (error) {
        console.warn('⚠️ Failed to analyze trends:', error.message);
      }
    }

    return { trend: 'baseline', change: 0, lastScore: 0, currentScore: this.metrics.summary.performanceScores.overall };
  }

  async saveReport() {
    const report = this.generateReport();
    const reportsDir = path.join(__dirname, '../coverage');
    
    // Ensure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Save detailed report
    const reportPath = path.join(reportsDir, 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Save trends data
    const trendsPath = path.join(reportsDir, 'performance-trends.json');
    let trends = [];
    
    if (fs.existsSync(trendsPath)) {
      trends = JSON.parse(fs.readFileSync(trendsPath, 'utf8'));
    }

    trends.push({
      timestamp: report.timestamp,
      overall: report.summary.performanceScores.overall,
      reliability: report.summary.performanceScores.reliability,
      speed: report.summary.performanceScores.speed,
      passRate: report.summary.performanceScores.passRate,
      totalTests: report.summary.totalTests,
      totalDuration: report.summary.totalDuration
    });

    // Keep only last 30 entries
    if (trends.length > 30) {
      trends = trends.slice(-30);
    }

    fs.writeFileSync(trendsPath, JSON.stringify(trends, null, 2));

    console.log('📊 Performance report saved to:', reportPath);
    console.log('📈 Trends data saved to:', trendsPath);

    return report;
  }

  printSummary(report) {
    const { summary, recommendations, trends } = report;
    const scores = summary.performanceScores;

    console.log('\n📊 Test Performance Summary');
    console.log('='.repeat(50));
    console.log(`📈 Overall Score: ${scores.overall}/100`);
    console.log(`🎯 Reliability: ${scores.reliability}% (${summary.passedTests}/${summary.totalTests} tests passed)`);
    console.log(`⚡ Speed Score: ${scores.speed}/100`);
    console.log(`⏱️ Total Duration: ${Math.round(summary.totalDuration)}ms`);
    console.log(`📊 Pass Rate: ${scores.passRate}%`);

    if (trends.trend !== 'baseline') {
      const trendIcon = trends.trend === 'improving' ? '📈' : '📉';
      console.log(`${trendIcon} Trend: ${trends.trend} (${trends.change > 0 ? '+' : ''}${trends.change} points)`);
    }

    if (summary.slowestTests.length > 0) {
      console.log('\n🐌 Slowest Tests:');
      summary.slowestTests.slice(0, 5).forEach((test, index) => {
        console.log(`  ${index + 1}. ${test.name} (${Math.round(test.duration)}ms)`);
      });
    }

    console.log('\n💡 Recommendations:');
    recommendations.forEach(rec => console.log(`  ${rec}`));

    console.log('\n' + '='.repeat(50));
  }
}

async function main() {
  const monitor = new PerformanceMonitor();

  try {
    console.log('🚀 Starting performance monitoring...');
    
    // Run tests and collect metrics
    await monitor.runTests();
    
    // Generate and save report
    const report = await monitor.saveReport();
    
    // Print summary
    monitor.printSummary(report);
    
    console.log('\n✅ Performance monitoring completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Performance monitoring failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceMonitor;
