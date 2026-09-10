const ExportRoutesFormatsService = require('../services/ExportRoutesFormatsService');
const asyncHandler = require('../utils/asyncHandler');

class ExportRoutesFormatsController {
  static getFormats = asyncHandler(async (req, res) => {
    const formats = ExportRoutesFormatsService.getAvailableFormats();
    res.json({
      availableFormats: formats
    });
  });
}

module.exports = ExportRoutesFormatsController;
