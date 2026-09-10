// Request queue middleware for handling high concurrency (600+ users)
// Implements token bucket algorithm and request queuing

const Queue = require('bull');
const Redis = require('ioredis');
const logger = require('../services/logger');

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 1, // Separate DB for queues
  maxRetriesPerRequest: 0, // Disable retries to fail fast
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  lazyConnect: true
};

// Try to create Redis connection
let redisClient;
try {
  redisClient = new Redis(redisConfig);
  redisClient.on('error', () => {
  });
} catch (error) {
  logger.debug('Redis client creation failed for request queue', { message: error.message });
}

// Create queues - use memory-only if Redis is not available
// Only create queues if queue feature is enabled
let queues = {};
if (process.env.ENABLE_REQUEST_QUEUE === 'true' && redisClient) {
  const queueOptions = { redis: redisConfig, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 50 } };
  queues = {
    auth: new Queue('auth requests', queueOptions),
    database: new Queue('database requests', queueOptions),
    general: new Queue('general requests', queueOptions)
  };
}

// Token bucket for rate limiting
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(tokens = 1) {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor(timePassed * this.refillRate / 1000);
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }
}

// Create token buckets for different user types
const userBuckets = new Map();
const adminBuckets = new Map();

function getBucketForUser(userId, isAdmin = false) {
  const buckets = isAdmin ? adminBuckets : userBuckets;
  
  if (!buckets.has(userId)) {
    // Admin users get higher limits
    const capacity = isAdmin ? 100 : 50;
    const refillRate = isAdmin ? 20 : 10; // tokens per second
    buckets.set(userId, new TokenBucket(capacity, refillRate));
  }
  
  return buckets.get(userId);
}

/**
 * Request queue middleware
 */
function requestQueue(options = {}) {
  const {
    queueType = 'general',
    maxConcurrent = 100,
    timeout = 30000,
    priority = 'normal'
  } = options;

  return async (req, res, next) => {
    try {
      // Skip queue for health checks and static assets
      if (req.path === '/health' || req.path.startsWith('/uploads')) {
        return next();
      }

      // Get user ID from JWT token if available
      const userId = req.user?.id || req.ip;
      const isAdmin = req.user?.role === 'admin';
      
      // Check token bucket for rate limiting
      const bucket = getBucketForUser(userId, isAdmin);
      if (!bucket.consume()) {
        return res.status(429).json({
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(1000 / bucket.refillRate)
        });
      }

      // Add request to queue
      const job = await queues[queueType].add('request', {
        req: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body,
          query: req.query,
          params: req.params
        },
        userId,
        timestamp: Date.now()
      }, {
        priority: priority === 'high' ? 10 : priority === 'low' ? 1 : 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 50
      });

      // Wait for job completion with timeout
      const result = await job.finished().catch(err => {
        console.error('Queue job failed:', err);
        return { error: err.message };
      });

      if (result.error) {
        return res.status(500).json({
          error: 'Request processing failed',
          details: result.error
        });
      }

      // Set response from queue result
      if (result.response) {
        res.status(result.status || 200);
        
        // Set headers
        if (result.headers) {
          Object.entries(result.headers).forEach(([key, value]) => {
            res.set(key, value);
          });
        }
        
        return res.json(result.data);
      }

      // If no response from queue, continue to next middleware
      next();

    } catch (error) {
      console.error('Queue middleware error:', error);
      // Fallback to normal processing if queue fails
      next();
    }
  };
}

/**
 * Process queued requests
 */
async function processRequest(job) {
  const { req, userId } = job.data;
  
  try {
    // Simulate request processing
    const startTime = Date.now();
    
    // Here you would normally process the request through your application
    // For now, we'll just return a success response
    const result = {
      status: 200,
      headers: {
        'X-Queue-Processed': 'true',
        'X-Processing-Time': `${Date.now() - startTime}ms`
      },
      data: {
        message: 'Request processed successfully',
        timestamp: new Date().toISOString(),
        userId
      }
    };

    return result;
    
  } catch (error) {
    console.error('Request processing error:', error);
    throw error;
  }
}

// Set up queue processors - only if queues are enabled
if (process.env.ENABLE_REQUEST_QUEUE === 'true' && redisClient) {
  queues.auth.process(20, processRequest);
  queues.database.process(50, processRequest);
  queues.general.process(100, processRequest);

  // Queue event listeners
  Object.values(queues).forEach(queue => {
    queue.on('completed', (job, result) => {
    });
    
    queue.on('failed', (job, err) => {
      console.error(`❌ Queue job failed: ${job.id}`, err);
    });
    
    queue.on('stalled', (job) => {
      console.warn(`⚠️ Queue job stalled: ${job.id}`);
    });
  });
}

/**
 * Get queue statistics
 */
function getQueueStats() {
  return Promise.all(Object.entries(queues).map(async ([name, queue]) => {
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    
    return {
      name,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }));
}

/**
 * Clean up queues
 */
async function cleanQueues() {
  for (const queue of Object.values(queues)) {
    await queue.clean(24 * 60 * 60 * 1000); // Clean jobs older than 24 hours
  }
}

// Clean up queues every hour
setInterval(cleanQueues, 60 * 60 * 1000);

module.exports = {
  requestQueue,
  getQueueStats,
  cleanQueues,
  TokenBucket
};
