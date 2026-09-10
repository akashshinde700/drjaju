const SymptomsTemplatesService = require('../services/SymptomsTemplatesService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.getAllTemplates = asyncHandler(async (_req, res) => {
  const result = await SymptomsTemplatesService.getAllTemplates();
  res.json(ApiResponse.success(result, 'Templates retrieved successfully'));
});

exports.getTemplateById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await SymptomsTemplatesService.getTemplateById(id);
  res.json(ApiResponse.success(result, 'Template retrieved successfully'));
});

exports.createTemplate = asyncHandler(async (req, res) => {
  const result = await SymptomsTemplatesService.createTemplate({ body: req.body, user: req.user });
  res.status(201).json(ApiResponse.created(result, 'Template created successfully'));
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SymptomsTemplatesService.updateTemplate({ id, body: req.body });
  res.json(ApiResponse.updated(null, 'Template updated successfully'));
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await SymptomsTemplatesService.deleteTemplate(id);
  res.json(ApiResponse.deleted(null, 'Template deleted successfully'));
});

exports.getTemplatesByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const result = await SymptomsTemplatesService.getTemplatesByCategory(category);
  res.json(ApiResponse.success(result, 'Templates retrieved successfully'));
});
