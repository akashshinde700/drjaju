const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Image optimization middleware
 * Compresses and resizes images to reduce file size
 */
async function optimizeImage(inputPath, outputPath, options = {}) {
  try {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 85,
      format = 'jpeg'
    } = options;

    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Determine if resizing is needed
    let width = metadata.width;
    let height = metadata.height;
    let needsResize = false;

    if (width > maxWidth || height > maxHeight) {
      needsResize = true;
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Build processing pipeline
    let pipeline = image;

    if (needsResize) {
      pipeline = pipeline.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert and compress based on format
    if (format === 'jpeg' || format === 'jpg') {
      pipeline = pipeline.jpeg({ quality, progressive: true });
    } else if (format === 'png') {
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    }

    // Save optimized image
    await pipeline.toFile(outputPath);

    // Get file sizes
    const originalStats = await fs.stat(inputPath);
    const optimizedStats = await fs.stat(outputPath);
    const savings = ((1 - optimizedStats.size / originalStats.size) * 100).toFixed(2);

    return {
      success: true,
      originalSize: originalStats.size,
      optimizedSize: optimizedStats.size,
      savings: `${savings}%`,
      dimensions: { width, height }
    };
  } catch (error) {
    console.error('Image optimization error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Middleware to optimize uploaded images
 * Automatically optimizes images before saving
 */
function imageOptimizationMiddleware(options = {}) {
  return async (req, res, next) => {
    if (!req.file) {
      return next();
    }

    // Only process image files
    const imageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!imageMimeTypes.includes(req.file.mimetype)) {
      return next();
    }

    try {
      const originalPath = req.file.path;
      const ext = path.extname(req.file.filename);
      const optimizedPath = originalPath.replace(ext, `_optimized${ext}`);

      // Optimize the image
      const result = await optimizeImage(originalPath, optimizedPath, {
        maxWidth: options.maxWidth || 1920,
        maxHeight: options.maxHeight || 1080,
        quality: options.quality || 85,
        format: options.format || 'jpeg'
      });

      if (result.success) {
        // Replace original with optimized version
        await fs.unlink(originalPath);
        await fs.rename(optimizedPath, originalPath);

        // Update file size in request
        req.file.size = result.optimizedSize;
        req.file.optimization = {
          originalSize: result.originalSize,
          optimizedSize: result.optimizedSize,
          savings: result.savings,
          dimensions: result.dimensions
        };
        // Image optimization completed successfully
      } else {
        // If optimization fails, keep original
        if (await fs.access(optimizedPath).then(() => true).catch(() => false)) {
          await fs.unlink(optimizedPath);
        }
      }
    } catch (error) {
      console.error('Image optimization middleware error:', error);
      // Continue with original file if optimization fails
    }

    next();
  };
}

module.exports = {
  optimizeImage,
  imageOptimizationMiddleware
};

