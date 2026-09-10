const crypto = require('crypto');
const { sendError } = require('../utils/responseHelper');

// Middleware to generate and validate ETags and Last-Modified for reference data endpoints
function etagMiddleware(options = {}) {
  const { weak = false, maxAge = 600 } = options;
  return (req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
      const body = JSON.stringify(data);
      const hash = crypto.createHash('sha1').update(body).digest('base64');
      const etag = weak ? `W/"${hash}"` : `"${hash}"`;
      const lastModified = new Date().toUTCString();
      res.set('ETag', etag);
      res.set('Last-Modified', lastModified);
      // Cache-Control header can also be set here if not already
      if (!res.getHeader('Cache-Control')) {
        res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=60`);
      }

      // Check If-None-Match header
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === etag) {
        return res.status(304).end();
      }

      // Check If-Modified-Since header as fallback
      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifModifiedSince && ifModifiedSince === lastModified && !ifNoneMatch) {
        return res.status(304).end();
      }

      return originalJson.call(this, data);
    };
    next();
  };
}

module.exports = { etagMiddleware };
