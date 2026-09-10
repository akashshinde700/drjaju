// Performance monitoring middleware for high-concurrency applications

const { performance } = require('perf_hooks');

// Performance metrics
const metrics = {
  requests: {
    total: 0,
    success: 0,
    error: 0,
    responseTimes: []
  },
  connections: {
    active: 0,
    peak: 0
  },
  memory: {
    samples: []
  },
  cpu: {
    samples: []
  }
};

// Performance tracking
let lastCpuUsage = process.cpuUsage();

/**
 * Performance monitoring middleware
 */
function performanceMonitor(req, res, next) {
  const startTime = performance.now();
  metrics.connections.active++;
  metrics.connections.peak = Math.max(metrics.connections.peak, metrics.connections.active);
  
  // Track request
  metrics.requests.total++;
  
  // Override res.end to track completion
  const originalEnd = res.end.bind(res);
  res.end = function(...args) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    metrics.requests.responseTimes.push(responseTime);
    metrics.connections.active--;
    
    if (res.statusCode >= 200 && res.statusCode < 400) {
      metrics.requests.success++;
    } else {
      metrics.requests.error++;
    }
    
    // Add performance headers only if headers haven't been sent yet
    if (!res.headersSent) {
      res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      res.set('X-Active-Connections', metrics.connections.active.toString());
    }
    
    return originalEnd(...args);
  };
  
  next();
}

/**
 * Collect system metrics periodically
 */
function collectMetrics() {
  // Memory usage
  const memUsage = process.memoryUsage();
  metrics.memory.samples.push({
    timestamp: Date.now(),
    rss: memUsage.rss,
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    external: memUsage.external
  });
  
  // CPU usage
  const currentCpuUsage = process.cpuUsage(lastCpuUsage);
  const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / 1000000; // Convert to seconds
  metrics.cpu.samples.push({
    timestamp: Date.now(),
    usage: cpuPercent
  });
  
  lastCpuUsage = process.cpuUsage();
  
  // Keep only last 100 samples to prevent memory leaks
  if (metrics.memory.samples.length > 100) {
    metrics.memory.samples = metrics.memory.samples.slice(-100);
  }
  if (metrics.cpu.samples.length > 100) {
    metrics.cpu.samples = metrics.cpu.samples.slice(-100);
  }
  if (metrics.requests.responseTimes.length > 1000) {
    metrics.requests.responseTimes = metrics.requests.responseTimes.slice(-1000);
  }
}

/**
 * Get performance statistics
 */
function getStats() {
  const responseTimes = metrics.requests.responseTimes;
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  
  const avgResponseTime = responseTimes.length > 0 
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
    : 0;
  
  const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
  const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;
  
  const successRate = metrics.requests.total > 0 
    ? (metrics.requests.success / metrics.requests.total) * 100 
    : 0;
  
  // Calculate average CPU usage from recent samples
  const recentCpuSamples = metrics.cpu.samples.slice(-10);
  const avgCpuUsage = recentCpuSamples.length > 0
    ? recentCpuSamples.reduce((sum, sample) => sum + sample.usage, 0) / recentCpuSamples.length
    : 0;
  
  // Get current memory usage
  const currentMemory = process.memoryUsage();
  
  return {
    requests: {
      total: metrics.requests.total,
      success: metrics.requests.success,
      error: metrics.requests.error,
      successRate: successRate.toFixed(2) + '%',
      responseTime: {
        average: avgResponseTime.toFixed(2) + 'ms',
        p50: p50.toFixed(2) + 'ms',
        p95: p95.toFixed(2) + 'ms',
        p99: p99.toFixed(2) + 'ms'
      }
    },
    connections: {
      active: metrics.connections.active,
      peak: metrics.connections.peak
    },
    system: {
      memory: {
        rss: (currentMemory.rss / 1024 / 1024).toFixed(2) + ' MB',
        heapUsed: (currentMemory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (currentMemory.heapTotal / 1024 / 1024).toFixed(2) + ' MB'
      },
      cpu: avgCpuUsage.toFixed(2) + '%'
    },
    uptime: process.uptime()
  };
}

/**
 * Reset metrics
 */
function resetMetrics() {
  metrics.requests.total = 0;
  metrics.requests.success = 0;
  metrics.requests.error = 0;
  metrics.requests.responseTimes = [];
  metrics.connections.active = 0;
  metrics.connections.peak = 0;
  metrics.memory.samples = [];
  metrics.cpu.samples = [];
}

// Start metrics collection
setInterval(collectMetrics, 5000); // Collect every 5 seconds

module.exports = {
  performanceMonitor,
  getStats,
  resetMetrics
};
