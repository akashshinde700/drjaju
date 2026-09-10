const GoogleReviewsService = require('../services/GoogleReviewsService');
const asyncHandler = require('../utils/asyncHandler');

class GoogleReviewsRoutesController {
  static getGoogleReviews = asyncHandler(async (req, res) => {
    const { placeId } = req.query;
    const result = await GoogleReviewsService.getGoogleReviews({ placeId });
    return res.json(result);
  });
}

module.exports = GoogleReviewsRoutesController;
