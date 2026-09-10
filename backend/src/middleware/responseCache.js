// Response Caching Middleware for GET requests
// Implements 30-second cache for list queries
// Cache is invalidated on POST/PUT/PATCH/DELETE operations

const NodeCache = require('node-cache');

// Initialize cache with 30-second TTL (stdTTL)
const apiCache = new NodeCache({ stdTTL: 30, checkperiod: 35 });

// Generate cache key from request
const getCacheKey = (req) => {
  return `${req.method}:${req.originalUrl || req.url}`;
};

// Cache middleware for GET requests
const cacheMiddleware = (req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') {
    // Clear cache on mutation operations (except for bulk operations)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      // Clear related caches - for appointments and queue endpoints
      const keys = apiCache.keys();
      keys.forEach(key => {
        if (key.includes(`GET:${req.baseUrl}`) || 
            (req.baseUrl.includes('appointments') && key.includes('appointments')) ||
            (req.baseUrl.includes('queue') && key.includes('queue'))) {
          apiCache.del(key);
        }
      });
    }
    return next();
  }

  // Safety: never cache authenticated requests.
  // This middleware is mounted globally and may run before auth middleware.
  // Caching authenticated responses by URL can leak data across users.
  if (req.headers.authorization || (req.headers.cookie && req.headers.cookie.length > 0)) {
    return next();
  }

  // Skip caching for specific routes
  const skipCacheRoutes = [
    '/me', // Current user info
    '/verify', // Verification endpoints
    '/check', // Check endpoints
    '/health', // Health checks
    '/stats', // Real-time stats
  ];

  if (skipCacheRoutes.some(route => req.url.includes(route))) {
    return next();
  }

  const cacheKey = getCacheKey(req);
  
  // Check if response is cached
  const cachedData = apiCache.get(cacheKey);
  if (cachedData) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('X-Cache-Key', cacheKey);
    return res.json(cachedData);
  }

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to cache response
  res.json = (data) => {
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-Key', cacheKey);
    
    // Cache successful responses (2xx status)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      apiCache.set(cacheKey, data);
    }
    
    return originalJson(data);
  };

  next();
};

// Manual cache invalidation method
const invalidateCache = (pattern) => {
  const keys = apiCache.keys();
  keys.forEach(key => {
    if (key.includes(pattern)) {
      apiCache.del(key);
    }
  });
};

// Clear all cache
const clearAllCache = () => {
  apiCache.flushAll();
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  clearAllCache,
  apiCache
};
