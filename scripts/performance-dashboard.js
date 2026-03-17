#!/usr/bin/env node

// AI-META-BEGIN
// AI-META: Real-time performance dashboard with WebSocket streaming and memory leak detection
// OWNERSHIP: scripts/performance-dashboard
// ENTRYPOINTS: npm run performance:dashboard
// DEPENDENCIES: Node.js ws, fs, path, child_process, performance monitoring APIs
// DANGER: WebSocket server management; memory profiling overhead; real-time data processing
// CHANGE-SAFETY: WebSocket protocol changes affect client connections; memory profiling requires careful resource management
// TESTS: npm run performance:dashboard, verify WebSocket connections and memory profiling
// AI-META-END

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');
const { performance } = require('perf_hooks');

class PerformanceDashboard {
  constructor() {
    this.clients = new Set();
    this.metrics = {
      timestamp: Date.now(),
      cpu: { usage: 0, cores: 0 },
      memory: { used: 0, total: 0, heapUsed: 0, heapTotal: 0 },
      network: { requests: 0, responseTime: 0, errors: 0 },
      tests: { total: 0, passed: 0, failed: 0, duration: 0 },
      cache: { hitRate: 0, size: 0, evictions: 0 },
      performance: { score: 0, trend: 'stable', regressions: 0 }
    };
    this.memorySnapshots = [];
    this.performanceHistory = [];
    this.alerts = [];
    this.thresholds = {
      cpu: 80, // 80% CPU usage threshold
      memory: 85, // 85% memory usage threshold
      responseTime: 2000, // 2 second response time threshold
      errorRate: 5, // 5% error rate threshold
      performanceScore: 70 // Minimum performance score
    };
  }

  startServer(port = 3001) {
    const server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    const wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws) => {
      this.handleWebSocketConnection(ws);
    });

    server.listen(port, () => {
      console.log(`🚀 Performance Dashboard running on http://localhost:${port}`);
      console.log(`📡 WebSocket server listening on ws://localhost:${port}`);
    });

    // Start monitoring
    this.startMonitoring();
    this.startMemoryLeakDetection();
    this.startPerformanceBudgetEnforcement();

    return { server, wss };
  }

  handleWebSocketConnection(ws) {
    console.log('🔗 New client connected to performance dashboard');
    this.clients.add(ws);

    // Send current metrics immediately
    ws.send(JSON.stringify({
      type: 'initial_metrics',
      data: this.metrics
    }));

    // Send recent performance history
    ws.send(JSON.stringify({
      type: 'performance_history',
      data: this.performanceHistory.slice(-50) // Last 50 data points
    }));

    // Send active alerts
    ws.send(JSON.stringify({
      type: 'alerts',
      data: this.alerts.filter(alert => alert.active)
    }));

    ws.on('close', () => {
      console.log('🔌 Client disconnected from performance dashboard');
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      this.clients.delete(ws);
    });
  }

  handleHttpRequest(req, res) {
    const url = req.url;
    
    if (url === '/') {
      this.serveDashboardHTML(res);
    } else if (url === '/api/metrics') {
      this.serveMetricsJSON(res);
    } else if (url === '/api/alerts') {
      this.serveAlertsJSON(res);
    } else if (url.startsWith('/api/memory-snapshot')) {
      this.serveMemorySnapshot(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  serveDashboardHTML(res) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Cloud Gallery Performance Dashboard</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2563eb; }
        .metric-label { color: #6b7280; font-size: 14px; }
        .alert { background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 4px; margin: 5px 0; }
        .alert.warning { background: #fffbeb; border-color: #fed7aa; }
        .alert.success { background: #f0fdf4; border-color: #bbf7d0; }
        .status-indicator { width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 8px; }
        .status-good { background: #10b981; }
        .status-warning { background: #f59e0b; }
        .status-critical { background: #ef4444; }
        .chart { height: 200px; background: #f9fafb; border-radius: 4px; margin: 10px 0; display: flex; align-items: center; justify-content: center; color: #6b7280; }
    </style>
</head>
<body>
    <h1>🚀 Cloud Gallery Performance Dashboard</h1>
    <div class="dashboard">
        <div class="card">
            <h2>💻 System Resources</h2>
            <div class="metric">
                <span class="metric-label">CPU Usage</span>
                <span class="metric-value" id="cpu-usage">0%</span>
            </div>
            <div class="metric">
                <span class="metric-label">Memory Usage</span>
                <span class="metric-value" id="memory-usage">0%</span>
            </div>
            <div class="metric">
                <span class="metric-label">Heap Used</span>
                <span class="metric-value" id="heap-used">0MB</span>
            </div>
        </div>
        
        <div class="card">
            <h2>🧪 Test Performance</h2>
            <div class="metric">
                <span class="metric-label">Performance Score</span>
                <span class="metric-value" id="performance-score">0</span>
            </div>
            <div class="metric">
                <span class="metric-label">Tests Passed</span>
                <span class="metric-value" id="tests-passed">0/0</span>
            </div>
            <div class="metric">
                <span class="metric-label">Avg Duration</span>
                <span class="metric-value" id="avg-duration">0ms</span>
            </div>
        </div>
        
        <div class="card">
            <h2>🌐 Network Performance</h2>
            <div class="metric">
                <span class="metric-label">Response Time</span>
                <span class="metric-value" id="response-time">0ms</span>
            </div>
            <div class="metric">
                <span class="metric-label">Error Rate</span>
                <span class="metric-value" id="error-rate">0%</span>
            </div>
            <div class="metric">
                <span class="metric-label">Requests/min</span>
                <span class="metric-value" id="requests-per-minute">0</span>
            </div>
        </div>
        
        <div class="card">
            <h2>💾 Cache Performance</h2>
            <div class="metric">
                <span class="metric-label">Hit Rate</span>
                <span class="metric-value" id="cache-hit-rate">0%</span>
            </div>
            <div class="metric">
                <span class="metric-label">Cache Size</span>
                <span class="metric-value" id="cache-size">0MB</span>
            </div>
            <div class="metric">
                <span class="metric-label">Evictions</span>
                <span class="metric-value" id="cache-evictions">0</span>
            </div>
        </div>
    </div>
    
    <div class="card" style="margin-top: 20px;">
        <h2>🚨 Active Alerts</h2>
        <div id="alerts-container">
            <p style="color: #6b7280;">No active alerts</p>
        </div>
    </div>
    
    <div class="card" style="margin-top: 20px;">
        <h2>📊 Performance Trend</h2>
        <div class="chart">Performance chart will be displayed here</div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:3001');
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
        };
        
        function handleWebSocketMessage(message) {
            switch (message.type) {
                case 'metrics_update':
                    updateMetrics(message.data);
                    break;
                case 'alert':
                    addAlert(message.data);
                    break;
                case 'memory_snapshot':
                    updateMemoryInfo(message.data);
                    break;
            }
        }
        
        function updateMetrics(metrics) {
            document.getElementById('cpu-usage').textContent = Math.round(metrics.cpu.usage) + '%';
            document.getElementById('memory-usage').textContent = Math.round(metrics.memory.usage) + '%';
            document.getElementById('heap-used').textContent = Math.round(metrics.memory.heapUsed / 1024 / 1024) + 'MB';
            document.getElementById('performance-score').textContent = metrics.performance.score;
            document.getElementById('tests-passed').textContent = \`\${metrics.tests.passed}/\${metrics.tests.total}\`;
            document.getElementById('avg-duration').textContent = Math.round(metrics.tests.duration) + 'ms';
            document.getElementById('response-time').textContent = Math.round(metrics.network.responseTime) + 'ms';
            document.getElementById('error-rate').textContent = Math.round(metrics.network.errors / metrics.network.requests * 100) + '%';
            document.getElementById('requests-per-minute').textContent = metrics.network.requests;
            document.getElementById('cache-hit-rate').textContent = Math.round(metrics.cache.hitRate) + '%';
            document.getElementById('cache-size').textContent = Math.round(metrics.cache.size / 1024 / 1024) + 'MB';
            document.getElementById('cache-evictions').textContent = metrics.cache.evictions;
        }
        
        function addAlert(alert) {
            const container = document.getElementById('alerts-container');
            const alertDiv = document.createElement('div');
            alertDiv.className = \`alert \${alert.severity}\`;
            alertDiv.innerHTML = \`
                <span class="status-indicator status-\${alert.severity}"></span>
                <strong>\${alert.title}</strong>: \${alert.message}
                <small style="display: block; color: #6b7280; margin-top: 5px;">\${new Date(alert.timestamp).toLocaleString()}</small>
            \`;
            container.appendChild(alertDiv);
            
            // Keep only last 10 alerts visible
            while (container.children.length > 10) {
                container.removeChild(container.firstChild);
            }
        }
        
        function updateMemoryInfo(snapshot) {
            // Update memory-specific information
            console.log('Memory snapshot received:', snapshot);
        }
        
        // Auto-refresh metrics every 5 seconds
        setInterval(() => {
            fetch('/api/metrics')
                .then(response => response.json())
                .then(data => updateMetrics(data))
                .catch(error => console.error('Error fetching metrics:', error));
        }, 5000);
    </script>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  serveMetricsJSON(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.metrics, null, 2));
  }

  serveAlertsJSON(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.alerts.filter(alert => alert.active), null, 2));
  }

  serveMemorySnapshot(res) {
    const snapshot = this.captureMemorySnapshot();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(snapshot, null, 2));
  }

  startMonitoring() {
    console.log('📊 Starting performance monitoring...');
    
    // Update system metrics every second
    setInterval(() => {
      this.updateSystemMetrics();
      this.broadcastMetrics();
    }, 1000);

    // Update test metrics every 5 seconds
    setInterval(() => {
      this.updateTestMetrics();
    }, 5000);

    // Update network metrics every 2 seconds
    setInterval(() => {
      this.updateNetworkMetrics();
    }, 2000);
  }

  updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.cpu.usage = this.calculateCPUUsage(cpuUsage);
    this.metrics.cpu.cores = require('os').cpus().length;
    this.metrics.memory.used = memUsage.rss;
    this.metrics.memory.total = require('os').totalmem();
    this.metrics.memory.heapUsed = memUsage.heapUsed;
    this.metrics.memory.heapTotal = memUsage.heapTotal;
    this.metrics.memory.usage = (memUsage.rss / require('os').totalmem()) * 100;
    
    // Check for threshold violations
    this.checkThresholds();
  }

  updateTestMetrics() {
    // Read latest performance report
    const reportPath = path.join(__dirname, '../coverage/performance-report.json');
    
    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        this.metrics.tests.total = report.summary.totalTests;
        this.metrics.tests.passed = report.summary.passedTests;
        this.metrics.tests.failed = report.summary.failedTests;
        this.metrics.tests.duration = report.summary.totalDuration / report.summary.totalTests;
        this.metrics.performance.score = report.summary.performanceScores.overall;
      } catch (error) {
        console.warn('⚠️ Failed to read performance report:', error.message);
      }
    }
  }

  updateNetworkMetrics() {
    // Simulate network metrics (in a real implementation, these would come from actual network monitoring)
    this.metrics.network.requests = Math.floor(Math.random() * 100) + 50;
    this.metrics.network.responseTime = Math.random() * 500 + 100;
    this.metrics.network.errors = Math.floor(Math.random() * 5);
  }

  calculateCPUUsage(cpuUsage) {
    // Simplified CPU usage calculation
    const totalDiff = cpuUsage.user + cpuUsage.system;
    return Math.min(100, (totalDiff / 1000000) * 100); // Convert to percentage
  }

  checkThresholds() {
    const alerts = [];
    
    // CPU threshold check
    if (this.metrics.cpu.usage > this.thresholds.cpu) {
      alerts.push({
        id: `cpu-${Date.now()}`,
        type: 'cpu',
        severity: this.metrics.cpu.usage > 95 ? 'critical' : 'warning',
        title: 'High CPU Usage',
        message: `CPU usage is ${Math.round(this.metrics.cpu.usage)}%`,
        timestamp: new Date().toISOString(),
        active: true
      });
    }
    
    // Memory threshold check
    if (this.metrics.memory.usage > this.thresholds.memory) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'memory',
        severity: this.metrics.memory.usage > 95 ? 'critical' : 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is ${Math.round(this.metrics.memory.usage)}%`,
        timestamp: new Date().toISOString(),
        active: true
      });
    }
    
    // Performance score check
    if (this.metrics.performance.score < this.thresholds.performanceScore) {
      alerts.push({
        id: `performance-${Date.now()}`,
        type: 'performance',
        severity: 'warning',
        title: 'Low Performance Score',
        message: `Performance score is ${this.metrics.performance.score}`,
        timestamp: new Date().toISOString(),
        active: true
      });
    }
    
    // Broadcast new alerts
    alerts.forEach(alert => {
      this.alerts.push(alert);
      this.broadcastAlert(alert);
    });
    
    // Clean up old alerts (keep only last 50)
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  startMemoryLeakDetection() {
    console.log('🔍 Starting memory leak detection...');
    
    // Capture memory snapshot every 30 seconds
    setInterval(() => {
      const snapshot = this.captureMemorySnapshot();
      this.memorySnapshots.push(snapshot);
      
      // Keep only last 100 snapshots
      if (this.memorySnapshots.length > 100) {
        this.memorySnapshots.shift();
      }
      
      // Analyze for memory leaks
      this.analyzeMemoryLeaks();
    }, 30000);
  }

  captureMemorySnapshot() {
    const memUsage = process.memoryUsage();
    const heapStats = require('v8').getHeapStatistics();
    
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
      numberOfDetachedContexts: heapStats.number_of_detached_contexts
    };
  }

  analyzeMemoryLeaks() {
    if (this.memorySnapshots.length < 3) return;
    
    const recent = this.memorySnapshots.slice(-10);
    const oldest = recent[0];
    const latest = recent[recent.length - 1];
    
    // Calculate memory growth rate
    const memoryGrowth = latest.heapUsed - oldest.heapUsed;
    const timeDiff = latest.timestamp - oldest.timestamp;
    const growthRate = (memoryGrowth / timeDiff) * 1000; // bytes per second
    
    // Detect potential memory leak (growth > 1MB/min over 5 minutes)
    if (growthRate > 16667) { // 1MB/min in bytes/sec
      this.alerts.push({
        id: `memory-leak-${Date.now()}`,
        type: 'memory-leak',
        severity: 'critical',
        title: 'Potential Memory Leak Detected',
        message: `Memory growing at ${Math.round(growthRate / 1024)}KB/sec`,
        timestamp: new Date().toISOString(),
        active: true
      });
      
      this.broadcastAlert(this.alerts[this.alerts.length - 1]);
    }
  }

  startPerformanceBudgetEnforcement() {
    console.log('💰 Starting performance budget enforcement...');
    
    setInterval(() => {
      this.enforcePerformanceBudgets();
    }, 10000); // Check every 10 seconds
  }

  enforcePerformanceBudgets() {
    const budgets = {
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      maxResponseTime: 2000, // 2 seconds
      minPerformanceScore: 80,
      maxErrorRate: 0.05 // 5%
    };
    
    const violations = [];
    
    if (this.metrics.memory.heapUsed > budgets.maxMemoryUsage) {
      violations.push({
        type: 'memory-budget',
        message: `Memory usage exceeds budget: ${Math.round(this.metrics.memory.heapUsed / 1024 / 1024)}MB > ${budgets.maxMemoryUsage / 1024 / 1024}MB`
      });
    }
    
    if (this.metrics.network.responseTime > budgets.maxResponseTime) {
      violations.push({
        type: 'response-time-budget',
        message: `Response time exceeds budget: ${Math.round(this.metrics.network.responseTime)}ms > ${budgets.maxResponseTime}ms`
      });
    }
    
    if (this.metrics.performance.score < budgets.minPerformanceScore) {
      violations.push({
        type: 'performance-budget',
        message: `Performance score below budget: ${this.metrics.performance.score} < ${budgets.minPerformanceScore}`
      });
    }
    
    // Broadcast violations
    violations.forEach(violation => {
      this.alerts.push({
        id: `budget-${Date.now()}`,
        type: 'budget-violation',
        severity: 'warning',
        title: 'Performance Budget Violation',
        message: violation.message,
        timestamp: new Date().toISOString(),
        active: true
      });
      
      this.broadcastAlert(this.alerts[this.alerts.length - 1]);
    });
  }

  broadcastMetrics() {
    const message = JSON.stringify({
      type: 'metrics_update',
      data: this.metrics
    });
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  broadcastAlert(alert) {
    const message = JSON.stringify({
      type: 'alert',
      data: alert
    });
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const port = args.includes('--port') ? parseInt(args[args.indexOf('--port') + 1]) : 3001;
  
  console.log('🚀 Starting Cloud Gallery Performance Dashboard...');
  
  try {
    const dashboard = new PerformanceDashboard();
    const { server, wss } = dashboard.startServer(port);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down performance dashboard...');
      wss.close();
      server.close(() => {
        console.log('✅ Performance dashboard stopped');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start performance dashboard:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceDashboard;
