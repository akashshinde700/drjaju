const { ApiError, ApiResponse, asyncHandler } = require('../utils');
const VitalsService = require('../services/VitalsService');

exports.exists = asyncHandler(async (req, res) => {
  const { patientId, appointmentId } = req.query;
  if (!patientId) {
    throw ApiError.badRequest('patientId required');
  }

  const result = await VitalsService.exists({ patientId, appointmentId });
  res.json(ApiResponse.success(result, 'Vitals check completed'));
});
