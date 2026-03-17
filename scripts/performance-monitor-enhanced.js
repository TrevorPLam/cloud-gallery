#!/usr/bin/env node

// AI-META-BEGIN
// AI-META: Enhanced performance monitoring with memory profiling and budget enforcement
// OWNERSHIP: scripts/performance-monitor-enhanced
// ENTRYPOINTS: npm run test:performance-monitor-enhanced
// DEPENDENCIES: Node.js fs, path, child_process, v8, os
// DANGER: Memory profiling overhead; budget enforcement may fail builds; requires careful threshold configuration
// CHANGE-SAFETY: Memory profiling intervals affect accuracy vs overhead; budget thresholds require careful tuning
// TESTS: npm run test:performance-monitor-enhanced, verify memory profiling and budget enforcement
// AI-META-END

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const v8 = require('v8');
const os = require('os');

class EnhancedPerformanceMonitor {
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
      },
      // Enhanced metrics for advanced monitoring
      systemMetrics: {
        cpu: { usage: 0, cores: 0 },
        memory: { used: 0, total: 0, heapUsed: 0, heapTotal: 0 },
        network: { requests: 0, responseTime: 0, errors: 0 }
      },
      memoryProfiling: {
        snapshots: [],
        leaks: [],
        growthRate: 0,
        peakUsage: 0,
        baseline: null
      },
      performanceBudget: {
        violations: [],
        compliance: 100,
        regressions: 0,
        thresholds: {
          maxMemoryUsage: 512 * 1024 * 1024, // 512MB
          maxTestDuration: 30000, // 30 seconds per test
          minPerformanceScore: 80,
          maxMemoryGrowthRate: 16667 // 1MB/min
        }
      }
    };
    this.memorySnapshots = [];
    this.memoryInterval = null;
    this.startCPUTime = process.cpuUsage();
    this.startTime = Date.now();
  }

  async runTests() {
    console.log('🚀 Running enhanced performance-monitored tests...');
    
    try {
      // Start memory profiling
      this.startMemoryProfiling();
      
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
    } finally {
      // Stop memory profiling
      this.stopMemoryProfiling();
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

  // Enhanced memory profiling methods
  startMemoryProfiling() {
    console.log('🧠 Starting enhanced memory profiling...');
    
    // Capture baseline
    this.metrics.memoryProfiling.baseline = this.captureMemorySnapshot();
    this.memorySnapshots = [this.metrics.memoryProfiling.baseline];
    
    // Capture memory snapshot every 2 seconds during test execution
    this.memoryInterval = setInterval(() => {
      const snapshot = this.captureMemorySnapshot();
      this.memorySnapshots.push(snapshot);
      
      // Check for memory leaks in real-time
      if (this.detectMemoryLeak(snapshot)) {
        console.warn('⚠️ Potential memory leak detected during test execution');
      }
    }, 2000);
  }

  stopMemoryProfiling() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
    
    // Final memory analysis
    this.analyzeMemoryUsage();
    console.log('🧠 Enhanced memory profiling completed');
  }

  captureMemorySnapshot() {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    return {
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      heapSizeLimit: heapStats.heap_size_limit,
      mallocedMemory: heapStats.malloced_memory,
      peakMallocedMemory: heapStats.peak_malloced_memory,
      doesZapGarbageCollection: heapStats.does_zap_garbage_collection,
      numberOfNativeContexts: heapStats.number_of_native_contexts,
      numberOfDetachedContexts: heapStats.number_of_detached_contexts,
      heapSpaces: heapStats.heap_spaces,
      codeAndMetaDataSize: heapStats.code_and_metadata_size,
      mapSize: heapStats.map_size
    };
  }

  detectMemoryLeak(currentSnapshot) {
    if (!this.metrics.memoryProfiling.baseline || this.memorySnapshots.length < 3) return false;
    
    const recent = this.memorySnapshots.slice(-5);
    const growth = currentSnapshot.heapUsed - this.metrics.memoryProfiling.baseline.heapUsed;
    const timeDiff = currentSnapshot.timestamp - this.metrics.memoryProfiling.baseline.timestamp;
    const growthRate = (growth / timeDiff) * 1000; // bytes per second
    
    // Detect leak if growth > 500KB/min over the baseline
    return growthRate > 8333;
  }

  analyzeMemoryUsage() {
    if (this.memorySnapshots.length < 2) return;
    
    const first = this.memorySnapshots[0];
    const last = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    const totalGrowth = last.heapUsed - first.heapUsed;
    const timeDiff = last.timestamp - first.timestamp;
    const growthRate = (totalGrowth / timeDiff) * 1000;
    
    const peakUsage = Math.max(...this.memorySnapshots.map(s => s.heapUsed));
    
    this.metrics.memoryProfiling = {
      ...this.metrics.memoryProfiling,
      snapshots: this.memorySnapshots,
      leaks: this.identifyMemoryLeaks(),
      growthRate: Math.round(growthRate),
      peakUsage: peakUsage
    };
    
    // Update system metrics
    this.updateSystemMetrics();
  }

  identifyMemoryLeaks() {
    const leaks = [];
    
    // Analyze memory growth patterns
    for (let i = 1; i < this.memorySnapshots.length; i++) {
      const prev = this.memorySnapshots[i - 1];
      const curr = this.memorySnapshots[i];
      
      const growth = curr.heapUsed - prev.heapUsed;
      const timeDiff = curr.timestamp - prev.timestamp;
      const rate = (growth / timeDiff) * 1000;
      
      if (rate > 16667) { // > 1MB/min
        leaks.push({
          timestamp: curr.timestamp,
          rate: Math.round(rate / 1024), // KB/sec
          severity: rate > 50000 ? 'critical' : 'warning',
          growth: Math.round(growth / 1024) // KB
        });
      }
    }
    
    return leaks;
  }

  updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.startCPUTime);
    const elapsed = Date.now() - this.startTime;
    
    this.metrics.systemMetrics = {
      cpu: {
        usage: this.calculateCPUUsage(cpuUsage, elapsed),
        cores: os.cpus().length
      },
      memory: {
        used: memUsage.rss,
        total: os.totalmem(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      },
      network: {
        requests: this.metrics.systemMetrics?.network?.requests || 0,
        responseTime: this.metrics.systemMetrics?.network?.responseTime || 0,
        errors: this.metrics.systemMetrics?.network?.errors || 0
      }
    };
  }

  calculateCPUUsage(cpuUsage, elapsed) {
    const totalUsage = cpuUsage.user + cpuUsage.system;
    return Math.min(100, (totalUsage / elapsed) * 1000000);
  }

  enforcePerformanceBudgets() {
    const { thresholds } = this.metrics.performanceBudget;
    const violations = [];
    
    // Check memory usage
    if (this.metrics.systemMetrics.memory.heapUsed > thresholds.maxMemoryUsage) {
      violations.push({
        type: 'memory',
        threshold: thresholds.maxMemoryUsage / 1024 / 1024,
        actual: Math.round(this.metrics.systemMetrics.memory.heapUsed / 1024 / 1024),
        unit: 'MB',
        severity: 'warning'
      });
    }
    
    // Check test duration
    const avgDuration = this.metrics.summary.totalDuration / this.metrics.summary.totalTests;
    if (avgDuration > thresholds.maxTestDuration) {
      violations.push({
        type: 'duration',
        threshold: thresholds.maxTestDuration / 1000,
        actual: Math.round(avgDuration / 1000),
        unit: 's',
        severity: 'warning'
      });
    }
    
    // Check performance score
    if (this.metrics.summary.performanceScores.overall < thresholds.minPerformanceScore) {
      violations.push({
        type: 'performance',
        threshold: thresholds.minPerformanceScore,
        actual: this.metrics.summary.performanceScores.overall,
        unit: 'points',
        severity: 'critical'
      });
    }
    
    // Check memory growth rate
    if (this.metrics.memoryProfiling.growthRate > thresholds.maxMemoryGrowthRate) {
      violations.push({
        type: 'memory-growth',
        threshold: thresholds.maxMemoryGrowthRate / 1024,
        actual: Math.round(this.metrics.memoryProfiling.growthRate / 1024),
        unit: 'KB/s',
        severity: 'critical'
      });
    }
    
    this.metrics.performanceBudget = {
      ...this.metrics.performanceBudget,
      violations,
      compliance: Math.max(0, 100 - (violations.length * 25)),
      regressions: violations.filter(v => v.severity === 'critical').length
    };
    
    return violations;
  }

  generateReport() {
    const { summary } = this.metrics;
    const scores = this.calculatePerformanceScores();
    
    // Enforce performance budgets
    const budgetViolations = this.enforcePerformanceBudgets();
    
    const report = {
      ...this.metrics,
      recommendations: this.generateRecommendations(scores, budgetViolations),
      trends: this.analyzeTrends(),
      budgetAnalysis: {
        violations: budgetViolations,
        compliance: this.metrics.performanceBudget.compliance,
        criticalIssues: budgetViolations.filter(v => v.severity === 'critical')
      }
    };

    return report;
  }

  generateRecommendations(scores, budgetViolations) {
    const recommendations = [];

    if (scores.reliability < 90) {
      recommendations.push('🔧 Focus on fixing failing tests to improve reliability');
    }

    if (scores.speed < 70) {
      recommendations.push('⚡ Optimize slow tests for better performance');
    }

    if (this.metrics.summary.slowestTests.length > 0 && this.metrics.summary.slowestTests[0].duration > 5000) {
      recommendations.push('🐌 Consider refactoring tests taking longer than 5 seconds');
    }

    // Memory-specific recommendations
    if (this.metrics.memoryProfiling.growthRate > 16667) {
      recommendations.push('🧠 Memory growth rate is high - investigate potential memory leaks');
    }

    if (this.metrics.memoryProfiling.peakUsage > 512 * 1024 * 1024) {
      recommendations.push('💾 Peak memory usage exceeds 512MB - consider memory optimization');
    }

    // Budget violation recommendations
    budgetViolations.forEach(violation => {
      if (violation.severity === 'critical') {
        recommendations.push(`🚨 Critical: ${violation.type} exceeds budget (${violation.actual}${violation.unit} > ${violation.threshold}${violation.unit})`);
      }
    });

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
    const reportPath = path.join(reportsDir, 'enhanced-performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Save memory profiling data
    const memoryReportPath = path.join(reportsDir, 'memory-profiling-report.json');
    fs.writeFileSync(memoryReportPath, JSON.stringify({
      timestamp: report.timestamp,
      profiling: report.memoryProfiling,
      systemMetrics: report.systemMetrics,
      budgetViolations: report.budgetAnalysis
    }, null, 2));

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
      totalDuration: report.summary.totalDuration,
      memoryUsage: report.systemMetrics.memory.heapUsed,
      budgetCompliance: report.budgetAnalysis.compliance
    });

    // Keep only last 30 entries
    if (trends.length > 30) {
      trends = trends.slice(-30);
    }

    fs.writeFileSync(trendsPath, JSON.stringify(trends, null, 2));

    console.log('📊 Enhanced performance report saved to:', reportPath);
    console.log('🧠 Memory profiling report saved to:', memoryReportPath);
    console.log('📈 Trends data saved to:', trendsPath);

    return report;
  }

  printSummary(report) {
    const { summary, recommendations, trends, budgetAnalysis } = report;
    const scores = summary.performanceScores;

    console.log('\n📊 Enhanced Test Performance Summary');
    console.log('='.repeat(60));
    console.log(`📈 Overall Score: ${scores.overall}/100`);
    console.log(`🎯 Reliability: ${scores.reliability}% (${summary.passedTests}/${summary.totalTests} tests passed)`);
    console.log(`⚡ Speed Score: ${scores.speed}/100`);
    console.log(`⏱️ Total Duration: ${Math.round(summary.totalDuration)}ms`);
    console.log(`📊 Pass Rate: ${scores.passRate}%`);

    // System metrics
    console.log('\n💻 System Metrics:');
    console.log(`   CPU Usage: ${Math.round(report.systemMetrics.cpu.usage)}%`);
    console.log(`   Memory Used: ${Math.round(report.systemMetrics.memory.heapUsed / 1024 / 1024)}MB`);
    console.log(`   Memory Growth: ${Math.round(report.memoryProfiling.growthRate / 1024)}KB/s`);

    // Budget compliance
    console.log(`💰 Budget Compliance: ${budgetAnalysis.compliance}%`);
    if (budgetAnalysis.violations.length > 0) {
      console.log(`   Violations: ${budgetAnalysis.violations.length}`);
      budgetAnalysis.violations.forEach(violation => {
        const icon = violation.severity === 'critical' ? '🚨' : '⚠️';
        console.log(`   ${icon} ${violation.type}: ${violation.actual}${violation.unit} > ${violation.threshold}${violation.unit}`);
      });
    }

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

    // Memory profiling summary
    if (report.memoryProfiling.leaks.length > 0) {
      console.log('\n🧠 Memory Issues:');
      report.memoryProfiling.leaks.forEach((leak, index) => {
        const icon = leak.severity === 'critical' ? '🚨' : '⚠️';
        console.log(`  ${index + 1}. ${icon} Growth: ${leak.rate}KB/s (${leak.growth}KB)`);
      });
    }

    console.log('\n💡 Recommendations:');
    recommendations.forEach(rec => console.log(`  ${rec}`));

    console.log('\n' + '='.repeat(60));
  }
}

async function main() {
  const monitor = new EnhancedPerformanceMonitor();

  try {
    console.log('🚀 Starting enhanced performance monitoring...');
    
    // Run tests and collect metrics
    await monitor.runTests();
    
    // Generate and save report
    const report = await monitor.saveReport();
    
    // Print summary
    monitor.printSummary(report);
    
    // Fail build if critical budget violations
    if (report.budgetAnalysis.criticalIssues.length > 0) {
      console.error('\n❌ Critical performance budget violations detected!');
      process.exit(1);
    }
    
    console.log('\n✅ Enhanced performance monitoring completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Enhanced performance monitoring failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = EnhancedPerformanceMonitor;
