const express = require('express');

const { authenticateToken } = require('../middleware/auth');
const medicalCertificateController = require('../controllers/medicalCertificateController');
const joiValidate = require('../middleware/joiValidate');
const { createMedicalCertificate: createMedicalCertificateSchema, updateMedicalCertificate: updateMedicalCertificateSchema } = require('../validation/commonSchemas');

const router = express.Router();

// Medical certificate routes
router.get('/', authenticateToken, medicalCertificateController.listMedicalCertificates);
router.get('/:id', authenticateToken, medicalCertificateController.getMedicalCertificate);
router.post('/', authenticateToken, joiValidate(createMedicalCertificateSchema), medicalCertificateController.createMedicalCertificate);
router.put('/:id', authenticateToken, joiValidate(updateMedicalCertificateSchema), medicalCertificateController.updateMedicalCertificate);
router.delete('/:id', authenticateToken, medicalCertificateController.deleteMedicalCertificate);

// Certificate template routes
router.get('/templates/list', authenticateToken, medicalCertificateController.listCertificateTemplates);
router.get('/templates/:id', authenticateToken, medicalCertificateController.getCertificateTemplate);
router.post('/templates', authenticateToken, medicalCertificateController.createCertificateTemplate);
router.put('/templates/:id', authenticateToken, medicalCertificateController.updateCertificateTemplate);
router.delete('/templates/:id', authenticateToken, medicalCertificateController.deleteCertificateTemplate);

module.exports = router;
