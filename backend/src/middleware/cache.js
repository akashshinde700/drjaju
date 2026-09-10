// Enhanced cache middleware for high-performance operations
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default
const MAX_CACHE_SIZE = 1000; // Increased cache size for high concurrency

// Performance monitoring
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Cache middleware for GET requests - optimized for high concurrency
 * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
 */
function cacheMiddleware(ttl = CACHE_TTL) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const hasAuth = Boolean(req.headers?.authorization) || Boolean(req.headers?.cookie);
    if (hasAuth) {
      return next();
    }

    const key = `${req.originalUrl || req.url}`;
    const cached = cache.get(key);

    if (cached && (Date.now() - cached.timestamp) < ttl) {
      cacheHits++;
      // Set cache headers for client-side caching
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-TTL', Math.max(0, ttl - (Date.now() - cached.timestamp)).toString());
      return res.json(cached.data);
    }

    cacheMisses++;
    res.set('X-Cache', 'MISS');

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = function (data) {
      // Cache the response
      cache.set(key, {
        data: JSON.parse(JSON.stringify(data)), // Deep clone
        timestamp: Date.now()
      });

      // Clean old cache entries periodically
      if (cache.size > MAX_CACHE_SIZE) {
        cleanupCache(ttl);
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Optimized cache cleanup
 */
function cleanupCache(ttl) {
  const now = Date.now();
  const entriesToDelete = [];
  
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > ttl) {
      entriesToDelete.push(key);
    }
  }
  
  // Batch delete for better performance
  entriesToDelete.forEach(key => cache.delete(key));
}

/**
 * Clear cache for a specific key pattern
 */
function clearCache(pattern) {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

/**
 * Clear all cache
 */
function clearAllCache() {
  cache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Get cache statistics for monitoring
 */
function getCacheStats() {
  const total = cacheHits + cacheMisses;
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? ((cacheHits / total) * 100).toFixed(2) + '%' : '0%',
    ttl: CACHE_TTL
  };
}

module.exports = {
  cacheMiddleware,
  clearCache,
  clearAllCache,
  getCacheStats
};

