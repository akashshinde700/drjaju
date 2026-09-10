const { exportAsJSON, exportAsPDF, exportAsExcel } = require('./exportController');
const ExportRoutesService = require('../services/ExportRoutesService');
const ExportService = require('../services/ExportService');
const { asyncHandler } = require('../utils');

// exportAsJSON/exportAsPDF/exportAsExcel (from exportController_refactored.js) are
// each already asyncHandler(async (req, res, next) => ...) — they must be called
// with a real `next`, or their internal catch throws "next is not a function"
// the moment ExportService rejects.
exports.exportPatient = asyncHandler(async (req, res, next) => {
  const format = ExportRoutesService.getFormat(req);

  switch (format) {
    case 'json':
      return exportAsJSON(req, res, next);
    case 'pdf':
      return exportAsPDF(req, res, next);
    case 'excel':
    case 'xlsx':
      return exportAsExcel(req, res, next);
    default:
      return res.status(400).json({
        error: 'Invalid format. Supported: json, pdf, excel',
        supportedFormats: ['json', 'pdf', 'excel']
      });
  }
});

// Calls ExportService directly with an explicit { allPatients: 'true' } rather
// than mutating req.query and re-dispatching through exportAsJSON/exportAsExcel
// — Express 5's req.query mutation isn't reliably picked back up downstream,
// which silently dropped bulk mode and 404'd looking up a patient with no id.
exports.exportAllPatients = asyncHandler(async (req, res, next) => {
  const format = ExportRoutesService.getFormat(req);
  const { doctorId } = req.query;

  // No frontend page calls this route yet, and unscoped it would sequentially
  // export every patient in the clinic (11,000+) in one request — require a
  // doctor filter so it can't hang/crash the server if it ever is wired up.
  if (!doctorId) {
    return res.status(400).json({
      error: 'doctorId is required for bulk export to keep the request scoped to a reasonable size'
    });
  }

  let result;
  switch (format) {
    case 'json':
      result = await ExportService.exportAsJSON({ allPatients: 'true', doctorId });
      break;
    case 'excel':
    case 'xlsx':
      result = await ExportService.exportAsExcel({ allPatients: 'true', doctorId });
      break;
    default:
      return res.status(400).json({
        error: 'Invalid format for bulk export. Supported: json, excel'
      });
  }

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.buffer);
});
