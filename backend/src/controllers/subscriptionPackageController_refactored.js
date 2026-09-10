const SubscriptionPackageService = require('../services/SubscriptionPackageService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getAllPackages = asyncHandler(async (req, res) => {
  const result = await SubscriptionPackageService.getAllPackages({ user: req.user });
  res.json(ApiResponse.success(result, 'Packages retrieved successfully'));
});

exports.getPackageById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await SubscriptionPackageService.getPackageById(id);
  res.json(ApiResponse.success(result, 'Package retrieved successfully'));
});

exports.createPackage = asyncHandler(async (req, res) => {
  const result = await SubscriptionPackageService.createPackage({ body: req.body, user: req.user });
  res.status(201).json(ApiResponse.created(result, 'Package created successfully'));
});

exports.updatePackage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SubscriptionPackageService.updatePackage({ id, body: req.body });
  res.json(ApiResponse.updated(null, 'Package updated successfully'));
});

exports.deletePackage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SubscriptionPackageService.deletePackage(id);
  res.json(ApiResponse.deleted(null, 'Package deleted successfully'));
});

exports.enrollPatient = asyncHandler(async (req, res) => {
  const result = await SubscriptionPackageService.enrollPatient({ body: req.body });
  res.status(201).json(ApiResponse.created(result, 'Patient enrolled successfully'));
});

exports.getPatientSubscriptions = asyncHandler(async (req, res) => {
  const { patient_id } = req.params;
  const result = await SubscriptionPackageService.getPatientSubscriptions(patient_id);
  res.json(ApiResponse.success(result, 'Patient subscriptions retrieved successfully'));
});

exports.trackSessionUsage = asyncHandler(async (req, res) => {
  const { id: subscriptionId } = req.params;
  const result = await SubscriptionPackageService.trackSessionUsage({ subscriptionId, body: req.body });
  res.json(ApiResponse.updated(result, 'Session usage tracked'));
});
