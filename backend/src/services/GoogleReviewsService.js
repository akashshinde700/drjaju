const axios = require('axios');
const { ApiError } = require('../utils');

class GoogleReviewsService {
  static async getGoogleReviews({ placeId }) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!placeId) {
      throw ApiError.badRequest('placeId is required');
    }

    if (!apiKey) {
      const err = new Error('Google Places API not configured');
      err.status = 503;
      err.details = { message: 'Set GOOGLE_PLACES_API_KEY in environment variables' };
      throw err;
    }

    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'name,rating,reviews,user_ratings_total',
        key: apiKey
      }
    });

    if (response.data.status !== 'OK') {
      const err = new Error('Failed to fetch reviews');
      err.status = 400;
      err.details = {
        status: response.data.status,
        message: response.data.error_message
      };
      throw err;
    }

    const { result } = response.data;

    return {
      name: result.name,
      rating: result.rating,
      total_reviews: result.user_ratings_total,
      reviews: result.reviews || []
    };
  }
}

module.exports = GoogleReviewsService;
