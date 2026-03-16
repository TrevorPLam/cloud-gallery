#!/usr/bin/env node

/**
 * Test Metrics Collector
 *
 * Purpose: Collect and normalize test execution metrics from vitest JSON output,
 *          coverage data, and CI environment to produce a unified metrics record.
 * Inputs:  coverage/coverage-summary.json, test-results.json (vitest --reporter=json)
 * Outputs: coverage/test-metrics.json with structured metrics payload
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const COVERAGE_DIR = path.join(ROOT, 'coverage');
const METRICS_FILE = path.join(COVERAGE_DIR, 'test-metrics.json');

// ─── helpers ──────────────────────────────────────────────────────────────────

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // Only warn for unexpected errors; missing files are handled by the caller
      console.warn(`⚠️  Could not read ${filePath}:`, err.message);
    }
    return fallback;
  }
}

function pct(covered, total) {
  if (!total) return 100;
  return parseFloat(((covered / total) * 100).toFixed(2));
}

// ─── coverage ─────────────────────────────────────────────────────────────────

function collectCoverageMetrics() {
  // vitest --coverage emits coverage/coverage-summary.json
  const summaryPath = path.join(COVERAGE_DIR, 'coverage-summary.json');
  const summary = readJson(summaryPath);

  if (!summary || !summary.total) {
    console.warn('⚠️  No coverage summary found – coverage metrics will be empty');
    return null;
  }

  const { lines, statements, functions, branches } = summary.total;
  return {
    lines: lines.pct,
    statements: statements.pct,
    functions: functions.pct,
    branches: branches.pct,
    linesCovered: lines.covered,
    linesTotal: lines.total,
  };
}

// ─── test results ─────────────────────────────────────────────────────────────

function collectTestResults() {
  // vitest run --reporter=json writes test-results.json to the project root
  const resultsPath = path.join(ROOT, 'test-results.json');
  const raw = readJson(resultsPath);

  if (!raw) {
    console.warn('⚠️  No test-results.json found – test result metrics will be empty');
    return null;
  }

  const numTotalTests = raw.numTotalTests ?? 0;
  const numPassedTests = raw.numPassedTests ?? 0;
  const numFailedTests = raw.numFailedTests ?? 0;
  const numPendingTests = raw.numPendingTests ?? 0;

  // Execution duration in seconds
  // vitest stores absolute Unix timestamps in milliseconds; subtract to get wall-clock
  // duration. Falls back to null when either field is absent (e.g., partial run output).
  const durationMs =
    typeof raw.startTime === 'number' && typeof raw.endTime === 'number'
      ? raw.endTime - raw.startTime
      : null;

  // Detect potentially flaky suites: suites where at least one test was retried
  const flakySuites = [];
  for (const suite of raw.testResults ?? []) {
    const hasRetries = (suite.testResults ?? []).some(
      (t) => (t.invocations ?? 1) > 1,
    );
    if (hasRetries) {
      flakySuites.push(suite.testFilePath ?? suite.name ?? 'unknown');
    }
  }

  return {
    total: numTotalTests,
    passed: numPassedTests,
    failed: numFailedTests,
    pending: numPendingTests,
    passRate: pct(numPassedTests, numTotalTests),
    durationMs,
    durationSeconds: durationMs != null ? parseFloat((durationMs / 1000).toFixed(2)) : null,
    flakySuites,
    flakySuiteCount: flakySuites.length,
  };
}

// ─── performance ──────────────────────────────────────────────────────────────

function collectPerformanceMetrics() {
  const perfPath = path.join(COVERAGE_DIR, 'performance-results.json');
  const perf = readJson(perfPath);
  if (!perf) return null;

  const regressions = typeof perf.regressions === 'number' ? perf.regressions : 0;
  return {
    regressions,
    score: perf.score ?? null,
    status: regressions > 0 ? 'FAILED' : 'PASSED',
  };
}

// ─── CI environment ────────────────────────────────────────────────────────────

function collectCiContext() {
  return {
    runId: process.env.GITHUB_RUN_ID ?? null,
    runNumber: process.env.GITHUB_RUN_NUMBER ?? null,
    sha: process.env.GITHUB_SHA ?? null,
    ref: process.env.GITHUB_REF ?? null,
    branch:
      (process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME) ?? null,
    actor: process.env.GITHUB_ACTOR ?? null,
    repository: process.env.GITHUB_REPOSITORY ?? null,
    nodeVersion: process.version,
  };
}

// ─── main ──────────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(COVERAGE_DIR, { recursive: true });

  const metrics = {
    timestamp: new Date().toISOString(),
    ci: collectCiContext(),
    coverage: collectCoverageMetrics(),
    tests: collectTestResults(),
    performance: collectPerformanceMetrics(),
  };

  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  console.log('✅ Test metrics collected:', METRICS_FILE);

  // Print summary to stdout for CI logs
  const { coverage, tests } = metrics;

  if (tests) {
    const status = tests.failed === 0 ? '✅' : '❌';
    console.log(`\n${status} Tests: ${tests.passed}/${tests.total} passed (${tests.passRate}%)`);
    if (tests.durationSeconds != null) {
      console.log(`⏱  Duration: ${tests.durationSeconds}s`);
    }
    if (tests.flakySuiteCount > 0) {
      console.log(`⚠️  Flaky suites detected: ${tests.flakySuiteCount}`);
      tests.flakySuites.forEach((s) => console.log(`   - ${s}`));
    }
  }

  if (coverage) {
    const allHundred =
      coverage.lines === 100 &&
      coverage.functions === 100 &&
      coverage.branches === 100;
    const icon = allHundred ? '✅' : '⚠️';
    console.log(
      `\n${icon} Coverage  lines=${coverage.lines}%  functions=${coverage.functions}%  branches=${coverage.branches}%`,
    );
  }

  return metrics;
}

if (require.main === module) {
  main();
}

module.exports = { main, collectCoverageMetrics, collectTestResults, collectPerformanceMetrics };
