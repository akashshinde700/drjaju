const express = require('express');

const backupController = require('../controllers/backupController');

const router = express.Router();

// Auth + admin role enforced by app.js before this router
router.post('/export', backupController.exportDatabase);
router.post('/export/csv', backupController.startCSVExportJob);
router.post('/export/excel', backupController.startExcelExportJob);
router.get('/jobs/:jobId', backupController.getJobStatus);
router.get('/export-excel', backupController.exportDatabaseExcel);
router.get('/export-csv', backupController.exportDatabaseCSV);
router.get('/list', backupController.listBackups);
router.get('/download/:filename', backupController.downloadBackup);
router.delete('/:filename', backupController.deleteBackup);
router.get('/data/export', backupController.exportData);
// Fallback: direct GET /api/backup/:filename also serves the file
router.get('/:filename', backupController.downloadBackup);

module.exports = router;

