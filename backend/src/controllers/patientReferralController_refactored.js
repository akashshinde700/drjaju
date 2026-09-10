const PatientReferralService = require('../services/PatientReferralService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getAllReferrals = asyncHandler(async (req, res) => {
  const result = await PatientReferralService.getAllReferrals({ query: req.query, user: req.user });
  res.json(ApiResponse.success(result, 'Referrals retrieved successfully'));
});

exports.getReferralById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await PatientReferralService.getReferralById(id);
  res.json(ApiResponse.success(result, 'Referral retrieved successfully'));
});

exports.createReferral = asyncHandler(async (req, res) => {
  const result = await PatientReferralService.createReferral({ body: req.body, user: req.user });
  res.status(201).json(ApiResponse.created(result, 'Referral created successfully'));
});

exports.updateReferral = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await PatientReferralService.updateReferral({ id, body: req.body });
  res.json(ApiResponse.updated(null, 'Referral updated successfully'));
});

exports.deleteReferral = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await PatientReferralService.deleteReferral(id);
  res.json(ApiResponse.deleted(null, 'Referral deleted successfully'));
});

exports.getReferralNetwork = asyncHandler(async (req, res) => {
  const result = await PatientReferralService.getReferralNetwork(req.user);
  res.json(ApiResponse.success(result, 'Referral network retrieved successfully'));
});

exports.addToNetwork = asyncHandler(async (req, res) => {
  const result = await PatientReferralService.addToNetwork({ body: req.body, user: req.user });
  res.status(201).json(ApiResponse.created(result, 'Doctor added to network'));
});

exports.updateNetworkDoctor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await PatientReferralService.updateNetworkDoctor({ id, body: req.body });
  res.json(ApiResponse.updated(null, 'Network doctor updated'));
});

exports.deleteNetworkDoctor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await PatientReferralService.deleteNetworkDoctor(id);
  res.json(ApiResponse.deleted(null, 'Network doctor removed'));
});
