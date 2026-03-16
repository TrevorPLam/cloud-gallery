#!/usr/bin/env node

/**
 * Metrics dashboard update script
 * Generates and updates the HTML metrics dashboard with latest data
 */

const fs = require('fs');
const path = require('path');

// Main function to update metrics dashboard
function updateMetricsDashboard(coverageDir, dashboardPath) {
  try {
    console.log(`🔄 Updating metrics dashboard with data from ${coverageDir}`);
    
    // Load latest metrics data
    const latestMetrics = loadLatestMetrics(coverageDir);
    const flakyTests = loadFlakyTests(coverageDir);
    const trendAnalysis = loadTrendAnalysis(coverageDir);
    
    // Generate dashboard HTML
    const dashboardHTML = generateDashboardHTML(latestMetrics, flakyTests, trendAnalysis);
    
    // Write dashboard file
    fs.writeFileSync(dashboardPath, dashboardHTML);
    console.log(`✅ Metrics dashboard updated: ${dashboardPath}`);
    
    return dashboardHTML;
    
  } catch (error) {
    console.error('Error updating metrics dashboard:', error);
    process.exit(1);
  }
}

// Load latest test metrics
function loadLatestMetrics(coverageDir) {
  const files = fs.readdirSync(coverageDir).filter(file => 
    file.startsWith('test-metrics-') && file.endsWith('.json')
  );
  
  if (files.length === 0) {
    return null;
  }
  
  // Find the most recent file
  const latestFile = files.sort().pop(); // Assuming filenames include timestamps
  const filePath = path.join(coverageDir, latestFile);
  
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn(`Warning: Could not load latest metrics from ${latestFile}:`, error.message);
    return null;
  }
}

// Load flaky test data
function loadFlakyTests(coverageDir) {
  const files = fs.readdirSync(coverageDir).filter(file => 
    file.startsWith('flaky-tests-') && file.endsWith('.json')
  );
  
  if (files.length === 0) {
    return null;
  }
  
  const latestFile = files.sort().pop();
  const filePath = path.join(coverageDir, latestFile);
  
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn(`Warning: Could not load flaky tests from ${latestFile}:`, error.message);
    return null;
  }
}

// Load trend analysis
function loadTrendAnalysis(coverageDir) {
  const files = fs.readdirSync(coverageDir).filter(file => 
    file.startsWith('trend-analysis-') && file.endsWith('.json')
  );
  
  if (files.length === 0) {
    return null;
  }
  
  const latestFile = files.sort().pop();
  const filePath = path.join(coverageDir, latestFile);
  
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn(`Warning: Could not load trend analysis from ${latestFile}:`, error.message);
    return null;
  }
}

// Generate dashboard HTML
function generateDashboardHTML(metrics, flakyTests, trendAnalysis) {
  const timestamp = new Date().toISOString();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Gallery - Test Metrics Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.15);
        }
        
        .card-header {
            display: flex;
            align-items: center;
            margin-bottom: 16px;
        }
        
        .card-icon {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-size: 20px;
        }
        
        .card-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #333;
        }
        
        .card-value {
            font-size: 2rem;
            font-weight: 700;
            margin: 8px 0;
        }
        
        .card-subtitle {
            font-size: 0.9rem;
            color: #666;
        }
        
        .status-good { background: linear-gradient(135deg, #10b981, #059669); color: white; }
        .status-warning { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
        .status-danger { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
        .status-info { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; }
        
        .section {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        
        .section-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 16px;
            border-bottom: 2px solid #f3f4f6;
            padding-bottom: 8px;
        }
        
        .flaky-test-list {
            list-style: none;
        }
        
        .flaky-test-item {
            padding: 12px;
            border-left: 4px solid #ef4444;
            background: #fef2f2;
            margin-bottom: 8px;
            border-radius: 0 8px 8px 0;
        }
        
        .flaky-test-name {
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
        }
        
        .flaky-test-reason {
            font-size: 0.9rem;
            color: #666;
        }
        
        .trend-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .trend-item:last-child {
            border-bottom: none;
        }
        
        .trend-label {
            font-weight: 500;
            color: #333;
        }
        
        .trend-value {
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9rem;
        }
        
        .trend-up { background: #dcfce7; color: #166534; }
        .trend-down { background: #fef2f2; color: #dc2626; }
        .trend-stable { background: #f3f4f6; color: #6b7280; }
        
        .insight-list {
            list-style: none;
        }
        
        .insight-item {
            padding: 12px;
            background: #f0f9ff;
            border-left: 4px solid #3b82f6;
            margin-bottom: 8px;
            border-radius: 0 8px 8px 0;
        }
        
        .last-updated {
            text-align: center;
            color: white;
            opacity: 0.8;
            font-size: 0.9rem;
            margin-top: 20px;
        }
        
        .no-data {
            text-align: center;
            padding: 40px;
            color: #666;
            font-style: italic;
        }
        
        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Cloud Gallery Test Metrics</h1>
            <p>Real-time monitoring and insights for test performance and quality</p>
        </div>
        
        ${metrics ? generateMetricsCards(metrics) : '<div class="section"><div class="no-data">No metrics data available</div></div>'}
        
        ${flakyTests ? generateFlakyTestsSection(flakyTests) : ''}
        
        ${trendAnalysis ? generateTrendsSection(trendAnalysis) : ''}
        
        <div class="last-updated">
            Last updated: ${new Date(timestamp).toLocaleString()}
        </div>
    </div>
    
    <script>
        // Auto-refresh every 5 minutes
        setTimeout(() => {
            window.location.reload();
        }, 5 * 60 * 1000);
        
        // Add interactive features
        document.addEventListener('DOMContentLoaded', function() {
            // Add click handlers for cards
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                card.addEventListener('click', function() {
                    this.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        this.style.transform = '';
                    }, 150);
                });
            });
        });
    </script>
</body>
</html>`;
}

// Generate metrics cards HTML
function generateMetricsCards(metrics) {
  const successRate = metrics.totalTests > 0 ? (metrics.passedTests / metrics.totalTests) * 100 : 0;
  const failureRate = metrics.totalTests > 0 ? (metrics.failedTests / metrics.totalTests) * 100 : 0;
  const avgTestTime = metrics.averageTestTime || 0;
  const stabilityScore = metrics.stabilityScore ? (metrics.stabilityScore * 100) : 0;
  
  return `
    <div class="dashboard">
        <div class="card">
            <div class="card-header">
                <div class="card-icon ${successRate >= 95 ? 'status-good' : successRate >= 80 ? 'status-warning' : 'status-danger'}">
                    ✅
                </div>
                <div class="card-title">Success Rate</div>
            </div>
            <div class="card-value">${successRate.toFixed(1)}%</div>
            <div class="card-subtitle">${metrics.passedTests} of ${metrics.totalTests} tests passed</div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <div class="card-icon ${failureRate <= 5 ? 'status-good' : failureRate <= 15 ? 'status-warning' : 'status-danger'}">
                    ❌
                </div>
                <div class="card-title">Failure Rate</div>
            </div>
            <div class="card-value">${failureRate.toFixed(1)}%</div>
            <div class="card-subtitle">${metrics.failedTests} failed tests</div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <div class="card-icon ${avgTestTime <= 100 ? 'status-good' : avgTestTime <= 500 ? 'status-warning' : 'status-danger'}">
                    ⏱️
                </div>
                <div class="card-title">Avg Test Time</div>
            </div>
            <div class="card-value">${avgTestTime.toFixed(0)}ms</div>
            <div class="card-subtitle">Total: ${(metrics.totalExecutionTime || 0).toFixed(2)}s</div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <div class="card-icon ${stabilityScore >= 90 ? 'status-good' : stabilityScore >= 70 ? 'status-warning' : 'status-danger'}">
                    🎯
                </div>
                <div class="card-title">Stability Score</div>
            </div>
            <div class="card-value">${stabilityScore.toFixed(1)}%</div>
            <div class="card-subtitle">Test reliability indicator</div>
        </div>
    </div>`;
}

// Generate flaky tests section HTML
function generateFlakyTestsSection(flakyTests) {
  const summary = flakyTests.analysis?.summary;
  if (!summary || summary.flakyCount === 0) {
    return `
        <div class="section">
            <h2 class="section-title">🔍 Flaky Tests</h2>
            <div class="no-data">No flaky tests detected - great job!</div>
        </div>`;
  }
  
  const flakyTestItems = flakyTests.analysis.flakyTests.slice(0, 10).map(test => `
        <li class="flaky-test-item">
            <div class="flaky-test-name">${test.name}</div>
            <div class="flaky-test-reason">${test.reason}</div>
        </li>
    `).join('');
  
  return `
        <div class="section">
            <h2 class="section-title">🔍 Flaky Tests</h2>
            <div class="dashboard">
                <div class="card">
                    <div class="card-header">
                        <div class="card-icon ${summary.flakyRate <= 0.05 ? 'status-good' : summary.flakyRate <= 0.15 ? 'status-warning' : 'status-danger'}">
                            ⚠️
                        </div>
                        <div class="card-title">Flaky Test Rate</div>
                    </div>
                    <div class="card-value">${(summary.flakyRate * 100).toFixed(1)}%</div>
                    <div class="card-subtitle">${summary.flakyCount} of ${summary.totalTests} tests</div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-icon ${summary.overallStability >= 0.8 ? 'status-good' : summary.overallStability >= 0.6 ? 'status-warning' : 'status-danger'}">
                            📊
                        </div>
                        <div class="card-title">Overall Stability</div>
                    </div>
                    <div class="card-value">${(summary.overallStability * 100).toFixed(1)}%</div>
                    <div class="card-subtitle">Test suite reliability</div>
                </div>
            </div>
            
            <h3 style="margin: 20px 0 12px 0; color: #333;">Detected Flaky Tests</h3>
            <ul class="flaky-test-list">
                ${flakyTestItems}
                ${summary.flakyCount > 10 ? `<li class="flaky-test-item"><div class="flaky-test-name">... and ${summary.flakyCount - 10} more</div></li>` : ''}
            </ul>
        </div>`;
}

// Generate trends section HTML
function generateTrendsSection(trendAnalysis) {
  if (trendAnalysis.status === 'insufficient_data') {
    return `
        <div class="section">
            <h2 class="section-title">📈 Trends & Insights</h2>
            <div class="no-data">Insufficient data for trend analysis (need more historical data)</div>
        </div>`;
  }
  
  const trendItems = Object.entries(trendAnalysis.metrics || {}).map(([metric, analysis]) => {
    const trendClass = analysis.trend === 'improving' ? 'trend-up' : 
                      analysis.trend === 'declining' ? 'trend-down' : 'trend-stable';
    const trendIcon = analysis.trend === 'improving' ? '↑' : 
                     analysis.trend === 'declining' ? '↓' : '→';
    
    return `
        <div class="trend-item">
            <span class="trend-label">${formatMetricName(metric)}</span>
            <span class="trend-value ${trendClass}">${trendIcon} ${analysis.changePercent?.toFixed(1) || 0}%</span>
        </div>
    `;
  }).join('');
  
  const insightItems = (trendAnalysis.overall?.insights || []).map(insight => `
        <li class="insight-item">${insight}</li>
    `).join('');
  
  return `
        <div class="section">
            <h2 class="section-title">📈 Trends & Insights</h2>
            
            <div class="dashboard">
                <div class="card">
                    <div class="card-header">
                        <div class="card-icon ${trendAnalysis.qualityScore >= 0.8 ? 'status-good' : trendAnalysis.qualityScore >= 0.6 ? 'status-warning' : 'status-danger'}">
                            📊
                        </div>
                        <div class="card-title">Quality Score</div>
                    </div>
                    <div class="card-value">${(trendAnalysis.qualityScore * 100).toFixed(1)}%</div>
                    <div class="card-subtitle">Overall test health</div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="card-icon status-info">
                            📅
                        </div>
                        <div class="card-title">Data Points</div>
                    </div>
                    <div class="card-value">${trendAnalysis.dataPoints}</div>
                    <div class="card-subtitle">Historical measurements</div>
                </div>
            </div>
            
            <h3 style="margin: 20px 0 12px 0; color: #333;">Metric Trends</h3>
            <div>
                ${trendItems}
            </div>
            
            ${insightItems ? `
                <h3 style="margin: 20px 0 12px 0; color: #333;">💡 Key Insights</h3>
                <ul class="insight-list">
                    ${insightItems}
                </ul>
            ` : ''}
        </div>`;
}

// Format metric name for display
function formatMetricName(metric) {
  const names = {
    totalTests: 'Total Tests',
    passedTests: 'Passed Tests',
    failedTests: 'Failed Tests',
    totalExecutionTime: 'Execution Time',
    averageTestTime: 'Avg Test Time',
    successRate: 'Success Rate',
    failureRate: 'Failure Rate',
    stabilityScore: 'Stability Score'
  };
  return names[metric] || metric;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Usage: node update-metrics-dashboard.js <coverage-dir> <dashboard-html>');
    process.exit(1);
  }
  
  const [coverageDir, dashboardPath] = args;
  updateMetricsDashboard(coverageDir, dashboardPath);
}

module.exports = { updateMetricsDashboard, generateDashboardHTML };
