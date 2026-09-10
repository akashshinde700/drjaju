const ComplianceService = require('../services/ComplianceService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.logCompliance = asyncHandler(async (req, res) => {
  await ComplianceService.logCompliance(req.body);
  res.status(201).json(ApiResponse.created(null, 'Compliance logged'));
});

exports.getComplianceReport = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const report = await ComplianceService.getComplianceReport(patientId);
  res.json(ApiResponse.success(report, 'Compliance report retrieved'));
});
