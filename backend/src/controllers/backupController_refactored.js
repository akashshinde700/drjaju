const BackupService = require('../services/BackupService');
const { ApiResponse, asyncHandler } = require('../utils');

exports.exportDatabase = asyncHandler(async (_req, res) => {
  const result = await BackupService.startExportJob('sql');
  res.json(ApiResponse.success(result, 'Export started'));
});

exports.startCSVExportJob = asyncHandler(async (_req, res) => {
  const result = await BackupService.startExportJob('csv');
  res.json(ApiResponse.success(result, 'CSV export started'));
});

exports.startExcelExportJob = asyncHandler(async (_req, res) => {
  const result = await BackupService.startExportJob('excel');
  res.json(ApiResponse.success(result, 'Excel export started'));
});

exports.getJobStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const result = await BackupService.getJobStatus(jobId);
  res.json(ApiResponse.success(result, 'Job status'));
});

exports.exportDatabaseExcel = asyncHandler(async (_req, res) => {
  const result = await BackupService.exportDatabaseExcel();
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.buffer);
});

exports.exportDatabaseCSV = asyncHandler(async (_req, res) => {
  const result = await BackupService.exportDatabaseCSV();
  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.send(result.buffer);
});

exports.listBackups = asyncHandler(async (_req, res) => {
  const result = await BackupService.listBackups();
  res.json(ApiResponse.success(result, 'Backups retrieved successfully'));
});

exports.downloadBackup = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const result = await BackupService.getBackupFilePath(filename);
  res.download(result.path, result.filename);
});

exports.deleteBackup = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  await BackupService.deleteBackup(filename);
  res.json(ApiResponse.deleted(null, 'Backup deleted successfully'));
});

exports.exportData = asyncHandler(async (req, res) => {
  const { table, format } = req.query;
  const result = await BackupService.exportData({ table, format });

  if (result.type === 'file') {
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  }

  res.json(ApiResponse.success({ table: result.table, count: result.count, data: result.data }, 'Data exported successfully'));
});
