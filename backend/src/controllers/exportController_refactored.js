const ExportService = require('../services/ExportService');
const { asyncHandler } = require('../utils');

exports.exportAsJSON = asyncHandler(async (req, res) => {
  const patientId = req.query.patientId ?? req.params.id;
  const { allPatients, doctorId } = req.query;
  const result = await ExportService.exportAsJSON({ patientId, allPatients, doctorId });

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.buffer);
});

exports.exportAsPDF = asyncHandler(async (req, res) => {
  const patientId = req.query.patientId ?? req.params.id;
  const { allPatients } = req.query;
  const result = await ExportService.exportAsPDF({ patientId, allPatients });

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.buffer);
});

exports.exportAsExcel = asyncHandler(async (req, res) => {
  const patientId = req.query.patientId ?? req.params.id;
  const { allPatients, doctorId } = req.query;
  const result = await ExportService.exportAsExcel({ patientId, allPatients, doctorId });

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.buffer);
});
