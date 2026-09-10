// src/routes/googleReviewsRoutes.js
const express = require('express');
const googleReviewsRoutesController = require('../controllers/googleReviewsRoutesController');
const router = express.Router();

/**
 * GET /api/google-reviews
 * Fetch Google reviews for a place
 * Query params: placeId
 */
router.get('/', googleReviewsRoutesController.getGoogleReviews);

module.exports = router;
