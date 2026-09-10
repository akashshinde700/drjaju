const MedicalCertificateService = require('../services/MedicalCertificateService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.listMedicalCertificates = asyncHandler(async (req, res) => {
  const result = await MedicalCertificateService.listMedicalCertificates(req.query);
  res.json(ApiResponse.success(result, 'Medical certificates retrieved successfully'));
});

exports.getMedicalCertificate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await MedicalCertificateService.getMedicalCertificate(id);
  res.json(ApiResponse.success(result, 'Medical certificate retrieved successfully'));
});

exports.createMedicalCertificate = asyncHandler(async (req, res) => {
  const result = await MedicalCertificateService.createMedicalCertificate({ body: req.body, user: req.user });
  res.status(201).json(ApiResponse.created(result, 'Medical certificate created successfully'));
});

exports.updateMedicalCertificate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await MedicalCertificateService.updateMedicalCertificate({ id, body: req.body });
  res.json(ApiResponse.updated(null, 'Medical certificate updated successfully'));
});

exports.deleteMedicalCertificate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await MedicalCertificateService.deleteMedicalCertificate(id);
  res.json(ApiResponse.deleted(null, 'Medical certificate deleted successfully'));
});

exports.listCertificateTemplates = asyncHandler(async (req, res) => {
  const result = await MedicalCertificateService.listCertificateTemplates(req.query);
  res.json(ApiResponse.success(result, 'Certificate templates retrieved successfully'));
});

exports.getCertificateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await MedicalCertificateService.getCertificateTemplate(id);
  res.json(ApiResponse.success(result, 'Certificate template retrieved successfully'));
});

exports.createCertificateTemplate = asyncHandler(async (req, res) => {
  const result = await MedicalCertificateService.createCertificateTemplate(req.body);
  res.status(201).json(ApiResponse.created(result, 'Certificate template created successfully'));
});

exports.updateCertificateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await MedicalCertificateService.updateCertificateTemplate({ id, body: req.body });
  res.json(ApiResponse.updated(null, 'Certificate template updated successfully'));
});

exports.deleteCertificateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await MedicalCertificateService.deleteCertificateTemplate(id);
  res.json(ApiResponse.deleted(null, 'Certificate template deleted successfully'));
});
