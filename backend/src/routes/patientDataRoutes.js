const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const patientDataController = require('../controllers/patientDataController');
const joiValidate = require('../middleware/joiValidate');
const { addVitals, addLabRecord } = require('../validation/commonSchemas');

const router = express.Router();

router.get('/records/:patientId', authenticateToken, patientDataController.listRecords);
router.post('/records/:patientId', authenticateToken, patientDataController.upload.single('file'), patientDataController.addRecord);
router.delete('/records/:patientId/:recordId', authenticateToken, patientDataController.deleteRecord);
router.get('/records/view/:recordId', authenticateToken, patientDataController.viewRecord);
router.get('/records/download/:recordId', authenticateToken, patientDataController.downloadRecord);
router.get('/labs/:patientId', authenticateToken, patientDataController.listLabs);
router.post('/labs/:patientId', authenticateToken, joiValidate(addLabRecord), patientDataController.addLab);
router.post('/labs/:patientId/batch', authenticateToken, patientDataController.addLabBatch);
router.get('/vitals/:patientId', authenticateToken, patientDataController.listVitals);
router.post('/vitals/:patientId', authenticateToken, joiValidate(addVitals), patientDataController.addVital);
router.get('/timeline/:patientId', authenticateToken, patientDataController.listTimeline);

module.exports = router;
