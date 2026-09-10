const LabRoutesService = require('../services/LabRoutesService');
const { asyncHandler } = require('../utils');

exports.addLabResultForPatient = asyncHandler(async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await LabRoutesService.addLabResultForPatient({
      patientId,
      user: req.user,
      body: req.body
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error('Add lab result error:', error);
    if (error?.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to add lab result' });
  }
});

exports.listLabsForPatient = asyncHandler(async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await LabRoutesService.listLabsForPatient({ patientId });
    return res.json(result);
  } catch (error) {
    console.error('List patient labs error:', error);
    return res.status(500).json({ error: 'Failed to fetch labs' });
  }
});
