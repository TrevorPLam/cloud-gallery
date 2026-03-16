#!/usr/bin/env node

/**
 * Test Trend Analyser
 *
 * Purpose: Load historical test-metrics artefacts stored in `.metrics-history/`
 *          and compare the most recent run against earlier runs to detect
 *          regressions and report trends.
 *
 * Inputs:  .metrics-history/*.json   (one file per historical run)
 *          coverage/test-metrics.json (current run metrics from collect-test-metrics.js)
 * Outputs: coverage/test-trends.json  (trend report written to coverage/)
 *          stdout summary
 *
 * Usage (CI):
 *   # 1. Restore previous history artefact (optional – first run creates it)
 *   # 2. node scripts/analyze-test-trends.js
 *   # 3. Upload coverage/test-trends.json and .metrics-history/ as artefact
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const COVERAGE_DIR = path.join(ROOT, 'coverage');
const HISTORY_DIR = path.join(ROOT, '.metrics-history');
const CURRENT_METRICS = path.join(COVERAGE_DIR, 'test-metrics.json');
const TREND_REPORT = path.join(COVERAGE_DIR, 'test-trends.json');

// Maximum number of historical snapshots to retain
const MAX_HISTORY = 30;

// Duration spike threshold: flag as anomaly when run takes this many seconds
// longer than the previous run
const DURATION_SPIKE_THRESHOLD_SECONDS = 30;

// ─── helpers ──────────────────────────────────────────────────────────────────

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`⚠️  Could not read ${filePath}:`, err.message);
    }
    return fallback;
  }
}

// ─── history management ───────────────────────────────────────────────────────

/**
 * Load all historical metric snapshots, sorted oldest-first.
 */
function loadHistory() {
  if (!fs.existsSync(HISTORY_DIR)) return [];

  const files = fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort(); // ISO timestamp filenames sort correctly

  return files
    .map((f) => readJson(path.join(HISTORY_DIR, f)))
    .filter(Boolean);
}

/**
 * Persist current metrics snapshot into the history directory, then prune
 * entries beyond MAX_HISTORY.
 */
function appendToHistory(metrics) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });

  const ts = metrics.timestamp ?? new Date().toISOString();
  const safeTs = ts.replace(/[:.]/g, '-');
  const file = path.join(HISTORY_DIR, `${safeTs}.json`);

  fs.writeFileSync(file, JSON.stringify(metrics, null, 2));

  // Prune oldest entries
  const all = fs.readdirSync(HISTORY_DIR).filter((f) => f.endsWith('.json')).sort();
  if (all.length > MAX_HISTORY) {
    all.slice(0, all.length - MAX_HISTORY).forEach((f) =>
      fs.unlinkSync(path.join(HISTORY_DIR, f)),
    );
  }
}

// ─── trend calculations ───────────────────────────────────────────────────────

function coverageTrend(history, current) {
  if (!current.coverage) return null;

  const snapshots = history
    .filter((h) => h.coverage)
    .map((h) => ({
      timestamp: h.timestamp,
      lines: h.coverage.lines,
      functions: h.coverage.functions,
      branches: h.coverage.branches,
    }));

  const previous = snapshots.at(-1) ?? null;

  const delta = previous
    ? {
        lines: parseFloat((current.coverage.lines - previous.lines).toFixed(2)),
        functions: parseFloat((current.coverage.functions - previous.functions).toFixed(2)),
        branches: parseFloat((current.coverage.branches - previous.branches).toFixed(2)),
      }
    : null;

  return { current: current.coverage, previous, delta, history: snapshots.slice(-10) };
}

function testResultsTrend(history, current) {
  if (!current.tests) return null;

  const snapshots = history
    .filter((h) => h.tests)
    .map((h) => ({
      timestamp: h.timestamp,
      total: h.tests.total,
      passed: h.tests.passed,
      failed: h.tests.failed,
      passRate: h.tests.passRate,
      durationSeconds: h.tests.durationSeconds,
      flakySuiteCount: h.tests.flakySuiteCount,
    }));

  const previous = snapshots.at(-1) ?? null;

  const delta = previous
    ? {
        passRate: parseFloat((current.tests.passRate - previous.passRate).toFixed(2)),
        durationSeconds:
          current.tests.durationSeconds != null && previous.durationSeconds != null
            ? parseFloat((current.tests.durationSeconds - previous.durationSeconds).toFixed(2))
            : null,
        flakySuiteCount: current.tests.flakySuiteCount - previous.flakySuiteCount,
      }
    : null;

  return { current: current.tests, previous, delta, history: snapshots.slice(-10) };
}

/**
 * Returns an array of detected trend anomalies (things that got worse).
 */
function detectAnomalies(coverageT, testsT) {
  const issues = [];

  if (coverageT?.delta) {
    const { lines, functions, branches } = coverageT.delta;
    if (lines < 0) issues.push(`Coverage (lines) dropped by ${Math.abs(lines)}%`);
    if (functions < 0) issues.push(`Coverage (functions) dropped by ${Math.abs(functions)}%`);
    if (branches < 0) issues.push(`Coverage (branches) dropped by ${Math.abs(branches)}%`);
  }

  if (testsT?.delta) {
    const { passRate, flakySuiteCount, durationSeconds } = testsT.delta;
    if (passRate < 0) issues.push(`Pass rate dropped by ${Math.abs(passRate)}%`);
    if (flakySuiteCount > 0) issues.push(`Flaky suite count increased by ${flakySuiteCount}`);
    if (durationSeconds != null && durationSeconds > DURATION_SPIKE_THRESHOLD_SECONDS) {
      issues.push(`Test duration increased by ${durationSeconds}s`);
    }
  }

  return issues;
}

// ─── main ──────────────────────────────────────────────────────────────────────

function main() {
  const current = readJson(CURRENT_METRICS);
  if (!current) {
    console.error('❌ No current metrics found at', CURRENT_METRICS);
    console.error('   Run scripts/collect-test-metrics.js first.');
    process.exit(1);
  }

  const history = loadHistory();
  console.log(`📊 Loaded ${history.length} historical snapshot(s)`);

  const coverageT = coverageTrend(history, current);
  const testsT = testResultsTrend(history, current);
  const anomalies = detectAnomalies(coverageT, testsT);

  const report = {
    timestamp: new Date().toISOString(),
    runId: current.ci?.runId ?? null,
    sha: current.ci?.sha ?? null,
    branch: current.ci?.branch ?? null,
    snapshotsAnalysed: history.length + 1, // +1 for current
    anomalies,
    hasAnomalies: anomalies.length > 0,
    coverage: coverageT,
    tests: testsT,
  };

  fs.mkdirSync(COVERAGE_DIR, { recursive: true });
  fs.writeFileSync(TREND_REPORT, JSON.stringify(report, null, 2));
  console.log('✅ Trend report written:', TREND_REPORT);

  // ── stdout summary ──
  console.log('\n📈 Test Trend Summary');
  console.log('─'.repeat(50));

  if (testsT) {
    const { current: cur, delta } = testsT;
    const passIcon = cur.failed === 0 ? '✅' : '❌';
    console.log(`${passIcon} Pass rate : ${cur.passRate}% (${cur.passed}/${cur.total})`);
    if (delta) {
      const sign = delta.passRate >= 0 ? '+' : '';
      console.log(`   Δ pass rate : ${sign}${delta.passRate}%`);
    }
    if (cur.durationSeconds != null) {
      console.log(`⏱  Duration  : ${cur.durationSeconds}s`);
      if (delta?.durationSeconds != null) {
        const sign = delta.durationSeconds >= 0 ? '+' : '';
        console.log(`   Δ duration : ${sign}${delta.durationSeconds}s`);
      }
    }
    if (cur.flakySuiteCount > 0) {
      console.log(`⚠️  Flaky suites: ${cur.flakySuiteCount}`);
    }
  }

  if (coverageT) {
    const c = coverageT.current;
    console.log(
      `\n📋 Coverage  lines=${c.lines}%  functions=${c.functions}%  branches=${c.branches}%`,
    );
    if (coverageT.delta) {
      const d = coverageT.delta;
      const sign = (v) => (v >= 0 ? '+' : '');
      console.log(
        `   Δ lines=${sign(d.lines)}${d.lines}%  functions=${sign(d.functions)}${d.functions}%  branches=${sign(d.branches)}${d.branches}%`,
      );
    }
  }

  if (anomalies.length > 0) {
    console.log('\n⚠️  Anomalies detected:');
    anomalies.forEach((a) => console.log(`   • ${a}`));
  } else {
    console.log('\n✅ No trend anomalies detected');
  }

  // Persist current run to history AFTER analysis so delta reflects "previous → current"
  appendToHistory(current);
  console.log('💾 Snapshot saved to history');

  return report;
}

if (require.main === module) {
  main();
}

module.exports = { main, loadHistory, coverageTrend, testResultsTrend, detectAnomalies };
