const { getDb } = require('../config/db');

// Simple middleware to add Cache-Control headers for reference data endpoints
function cacheReferenceData(options = {}) {
  const {
    maxAge = 300, // 5 minutes default
    public: isPublic = true,
    staleWhileRevalidate = 60
  } = options;

  return (req, res, next) => {
    const directives = [];
    if (isPublic) directives.push('public');
    else directives.push('private');

    directives.push(`max-age=${maxAge}`);
    if (staleWhileRevalidate) directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);

    res.set('Cache-Control', directives.join(', '));
    next();
  };
}

module.exports = { cacheReferenceData };
