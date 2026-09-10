const PatientQueueService = require('../services/PatientQueueService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.searchPatients = asyncHandler(async (req, res) => {
  const { query, page = 1, limit = 20 } = req.query;
  const result = await PatientQueueService.searchPatients({ query, page, limit });
  res.json(
    ApiResponse.success(
      {
        patients: result.patients,
        pagination: result.pagination,
      },
      'Patients retrieved successfully'
    )
  );
});

exports.registerNewPatientAndQueue = asyncHandler(async (req, res) => {
  const result = await PatientQueueService.registerNewPatientAndQueue({ payload: req.body, user: req.user });
  res.status(201).json(ApiResponse.created(result, 'Patient registered and added to queue successfully'));
});

exports.addExistingPatientToQueue = asyncHandler(async (req, res) => {
  const result = await PatientQueueService.addExistingPatientToQueue({ payload: req.body, user: req.user });
  res.status(201).json(ApiResponse.created(result, 'Patient added to queue successfully'));
});

exports.getQueueByDate = asyncHandler(async (req, res) => {
  const { date, page = 1, limit = 50 } = req.query;
  const result = await PatientQueueService.getQueueByDate({ date, page, limit });
  res.json(ApiResponse.success(result, 'Queue retrieved successfully'));
});

exports.getAvailableDoctors = asyncHandler(async (_req, res) => {
  const result = await PatientQueueService.getAvailableDoctors();
  res.json(ApiResponse.success(result, 'Doctors retrieved successfully'));
});
