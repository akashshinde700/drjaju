const ServicesService = require('../services/ServicesService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getServices = asyncHandler(async (req, res) => {
  const { clinic_id } = req.query;
  const result = await ServicesService.getServices({ clinic_id });
  res.json(ApiResponse.success(result, 'Services retrieved successfully'));
});

exports.getServiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await ServicesService.getServiceById({ id });
  res.json(ApiResponse.success(result, 'Service retrieved successfully'));
});
