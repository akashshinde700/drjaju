const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const PatientDataService = require('../services/PatientDataService');
const { ApiResponse, asyncHandler } = require('../utils');

const uploadDir = path.join(__dirname, '../../uploads/records');

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }

  cb(null, true);
};

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `record-${uniqueSuffix}-${sanitizedFilename}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
});

exports.upload = upload;

exports.listRecords = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await PatientDataService.listRecords(patientId);
  res.json(ApiResponse.success(result, 'Records retrieved successfully'));
});

exports.addRecord = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await PatientDataService.addRecord({ patientId, body: req.body, file: req.file, user: req.user });
  res.status(201).json(ApiResponse.created(result, 'Record added successfully'));
});

exports.deleteRecord = asyncHandler(async (req, res) => {
  const { patientId, recordId } = req.params;
  await PatientDataService.deleteRecord({ patientId, recordId });
  res.json(ApiResponse.deleted(null, 'Record deleted successfully'));
});

exports.listLabs = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await PatientDataService.listLabs(patientId);
  res.json(ApiResponse.success(result, 'Labs retrieved successfully'));
});

exports.addLab = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await PatientDataService.addLab({ patientId, body: req.body, user: req.user });
  res.status(201).json(ApiResponse.created(result, 'Lab result added'));
});

exports.addLabBatch = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await PatientDataService.addLabBatch({ patientId, body: req.body, user: req.user });
  res.status(201).json(ApiResponse.created(result, 'Lab results saved'));
});

exports.listVitals = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await PatientDataService.listVitals(patientId);
  res.json(ApiResponse.success(result, 'Vitals retrieved successfully'));
});

exports.addVital = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await PatientDataService.addVital({ patientId, body: req.body });
  res.status(201).json(ApiResponse.created(result, 'Vitals recorded'));
});

exports.listTimeline = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const result = await PatientDataService.listTimeline(patientId);
  res.json(ApiResponse.success(result, 'Timeline retrieved successfully'));
});

exports.viewRecord = asyncHandler(async (req, res) => {
  const { recordId } = req.params;
  const { resolvedPath, fileType } = await PatientDataService.getRecordForView(recordId);

  if (fileType) {
    res.setHeader('Content-Type', fileType);
  }
  res.setHeader('Content-Disposition', 'inline');

  return res.sendFile(resolvedPath);
});

exports.downloadRecord = asyncHandler(async (req, res) => {
  const { recordId } = req.params;
  const { resolvedPath, filename } = await PatientDataService.getRecordForDownload(recordId);

  res.download(resolvedPath, filename, (err) => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    }
  });
});

