const express = require('express');

const { authenticateToken } = require('../middleware/auth');

const certificateTypeController = require('../controllers/certificateTypeController');

const router = express.Router();

router.get('/', authenticateToken, certificateTypeController.listCertificateTypes);
router.post('/', authenticateToken, certificateTypeController.createCertificateType);
router.put('/:id', authenticateToken, certificateTypeController.updateCertificateType);
router.delete('/:id', authenticateToken, certificateTypeController.deleteCertificateType);

module.exports = router;
