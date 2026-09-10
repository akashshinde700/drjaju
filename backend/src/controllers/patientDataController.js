const { getDb } = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { processLabReportImage } = require('../services/ocrExtractor');
const { getLocalDateString } = require('../utils/localDate');
const { unwrapJsonText } = require('../utils/unwrapJsonText');

// Configure multer for file uploads
const uploadsRootDir = path.resolve(__dirname, '..', '..', 'uploads');
const uploadDir = path.join(uploadsRootDir, 'records');

// Allowed file types for medical records
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
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
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1 // Only 1 file at a time
  },
  fileFilter
});

async function listRecords(req, res) {
  const { patientId } = req.params;
  try {
    const db = getDb();
    const [records] = await db.execute(
      `SELECT id, record_title as name, uploaded_date as date, record_type as category, file_path, description
       FROM medical_records WHERE patient_id = ? ORDER BY uploaded_date DESC`,
      [patientId]
    );

    // Ensure file_path points to an existing file. If an older DB entry points to a
    // missing file (e.g., after manual file moves/renames), attempt best-effort repair
    // by matching the original sanitized filename suffix inside uploads/records.
    const fixedRecords = await Promise.all(
      (records || []).map(async (r) => {
        if (!r?.file_path) return r;
        const filePath = String(r.file_path);
        if (!filePath.startsWith('/uploads/records/')) return r;

        const onDisk = path.join(uploadsRootDir, filePath.replace(/^\/uploads\//, ''));
        try {
          await fs.access(onDisk);
          return r;
        } catch (_) {
          // missing on disk; try to find by suffix
        }

        try {
          const basename = path.basename(filePath);
          const match = /^record-\d+-\d+-(.+)$/.exec(basename);
          const originalName = match?.[1];
          if (!originalName) return r;

          const dirPath = uploadDir;
          const files = await fs.readdir(dirPath);
          const candidates = (files || []).filter((f) => f.endsWith(originalName));
          if (candidates.length === 0) return r;

          // pick newest (best guess)
          const chosen = candidates.sort().slice(-1)[0];
          const repairedPath = `/uploads/records/${chosen}`;

          // Optionally update DB so future calls are correct
          try {
            await db.execute('UPDATE medical_records SET file_path = ? WHERE id = ?', [repairedPath, r.id]);
          } catch (_) {
            // ignore
          }

          return { ...r, file_path: repairedPath };
        } catch (_) {
          return r;
        }
      })
    );

    res.json({ records: fixedRecords });
  } catch (error) {
    console.error('List records error:', error);
    console.error('SQL Error:', error.sqlMessage);
    console.error('SQL State:', error.sqlState);
    console.error('Patient ID:', patientId);
    res.status(500).json({ error: 'Failed to fetch records', details: error.message });
  }
}

async function addRecord(req, res) {
  try {
    const { patientId } = req.params;
    const { name, category, description, date } = req.body;
    const file = req.file;
    const db = getDb();

    // Resolve clinic_id from user or default
    const clinicId = req.user?.clinic_id || null;

    const [result] = await db.execute(
      `INSERT INTO medical_records (patient_id, clinic_id, doctor_id, record_title, record_type, file_path, file_type, file_size, description, uploaded_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        clinicId,
        req.user?.id || null,
        name,
        category || 'OTHERS',
        file ? `/uploads/records/${file.filename}` : null,
        file ? file.mimetype : null,
        file ? file.size : null,
        description || null,
        date || new Date()
      ]
    );

    const recordId = result.insertId;
    let extractedLabResults = null;

    // If file is an image or PDF, try OCR extraction
    if (file && (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf')) {
      try {
        const filePath = path.join(uploadDir, file.filename);
        
        // Get all lab templates for matching
        const [labTemplates] = await db.execute(
          `SELECT id, test_name, test_code, unit, reference_range, category FROM lab_templates WHERE is_active = 1 LIMIT 500`
        );

        // Process the image/PDF with OCR
        const ocrResult = await processLabReportImage(filePath, labTemplates);
        
        if (ocrResult.success && ocrResult.results.length > 0) {
          const insertedResults = [];
          
          // Insert extracted lab results into lab_investigations table
          for (const result of ocrResult.results) {
            if (!result?.test_name || result.reading === undefined || result.reading === null) continue;

            let finalTestName = result.test_name;
            let finalUnit = result.unit || null;
            let finalReferenceRange = result.reference_range || null;

            if (result.confidence === 'unmatched') {
              try {
                const [existing] = await db.execute(
                  'SELECT id, test_name, unit, reference_range FROM lab_templates WHERE LOWER(test_name) = LOWER(?) LIMIT 1',
                  [finalTestName]
                );

                if (existing.length === 0) {
                  await db.execute(
                    `INSERT INTO lab_templates (test_name, test_code, description, sample_type, category, unit, reference_range, special_instructions, is_active)
                     VALUES (?, NULL, NULL, NULL, ?, ?, ?, NULL, 1)`,
                    [finalTestName, 'AUTO', finalUnit, finalReferenceRange]
                  );
                } else {
                  finalUnit = finalUnit || existing[0].unit || null;
                  finalReferenceRange = finalReferenceRange || existing[0].reference_range || null;
                }
              } catch (err) {
                console.error('Failed to auto-create lab template:', err);
              }
            }

            try {
              const [insertResult] = await db.execute(
                `INSERT INTO lab_investigations (patient_id, clinic_id, doctor_id, test_name, result_value, result_unit, reference_range, result_date, notes, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
                [
                  patientId,
                  clinicId,
                  req.user?.id || null,
                  finalTestName,
                  result.reading,
                  finalUnit,
                  finalReferenceRange,
                  new Date(),
                  `Extracted from: ${name}`
                ]
              );
              insertedResults.push({
                id: insertResult.insertId,
                test_name: finalTestName,
                reading: result.reading,
                unit: finalUnit
              });
            } catch (err) {
              console.error('Failed to insert extracted lab result:', err);
            }
          }
          
          extractedLabResults = {
            extracted: true,
            count: insertedResults.length,
            results: insertedResults,
            unmatchedCount: ocrResult.results.filter(r => r.confidence === 'unmatched').length
          };
        }
      } catch (ocrErr) {
        console.error('OCR extraction failed (non-critical):', ocrErr.message);
        extractedLabResults = {
          extracted: false,
          error: ocrErr.message,
          hint: 'Make sure to upload a clear image (JPG/PNG) or PDF of the lab report.'
        };
      }
    }

    res.status(201).json({
      id: recordId,
      message: 'Record added successfully',
      extractedLabData: extractedLabResults
    });
  } catch (error) {
    console.error('Add record error:', error);
    res.status(500).json({ error: 'Failed to add record' });
  }
}

async function listLabs(req, res) {
  try {
    const { patientId } = req.params;
    const db = getDb();
    const [labs] = await db.execute(
      `SELECT id, test_name as name, result_value as reading, result_date as date, result_unit as unit, report_group, reference_range, test_category
       FROM lab_investigations WHERE patient_id = ? AND status = 'completed' ORDER BY result_date DESC, report_group, id`,
      [patientId]
    );
    res.json({ labs });
  } catch (error) {
    console.error('List labs error:', error);
    res.status(500).json({ error: 'Failed to fetch labs' });
  }
}

async function addLab(req, res) {
  try {
    const { patientId } = req.params;
    const { name, reading, date, unit } = req.body;
    const db = getDb();
    const clinicId = req.user?.clinic_id || null;
    const [result] = await db.execute(
      `INSERT INTO lab_investigations (patient_id, clinic_id, doctor_id, test_name, result_value, result_date, result_unit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [patientId, clinicId, req.user?.id || null, name, reading, date || new Date(), unit || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Lab result added' });
  } catch (error) {
    console.error('Add lab error:', error);
    res.status(500).json({ error: 'Failed to add lab result' });
  }
}

async function addLabBatch(req, res) {
  try {
    const { patientId } = req.params;
    const { category, results, date } = req.body;
    if (!category || !results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'category and results array are required' });
    }
    const db = getDb();
    const clinicId = req.user?.clinic_id || null;
    const doctorId = req.user?.id || null;
    const reportGroup = `${category}-${Date.now()}`;
    const resultDate = date || new Date();
    const ids = [];
    for (const item of results) {
      if (!item.name || !item.reading) continue;
      const [result] = await db.execute(
        `INSERT INTO lab_investigations (patient_id, clinic_id, doctor_id, test_name, result_value, result_date, result_unit, status, report_group, reference_range, test_category)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
        [patientId, clinicId, doctorId, item.name, item.reading, resultDate, item.unit || null, reportGroup, item.normalRange || null, category]
      );
      ids.push(result.insertId);
    }
    res.status(201).json({ ids, report_group: reportGroup, message: `${ids.length} lab results saved` });
  } catch (error) {
    console.error('Add lab batch error:', error);
    res.status(500).json({ error: 'Failed to save lab results' });
  }
}

async function listVitals(req, res) {
  try {
    const { patientId } = req.params;
    const db = getDb();
    const [vitals] = await db.execute(
      `SELECT temperature as temp, height_cm, weight_kg, bmi,
              pulse, spo2, blood_pressure, recorded_at as date
       FROM patient_vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 10`,
      [patientId]
    );
    
    // Format vitals to match frontend expectations
    const formatted = vitals.map((v) => {
      return {
        Temperature: v.temp,
        Height: v.height_cm,
        Weight: v.weight_kg,
        BMI: v.bmi,
        'Pulse Rate': v.pulse,
        'Blood Pressure': v.blood_pressure,
        'SpO2': v.spo2,
        date: v.date ? getLocalDateString(new Date(v.date)) : getLocalDateString()
      };
    });
    
    // Flatten the vitals data to match the expected format
    const flattenedVitals = [];
    formatted.forEach((vitalSet) => {
      const date = vitalSet.date;
      Object.keys(vitalSet).forEach((key) => {
        if (key !== 'date' && vitalSet[key] !== null) {
          flattenedVitals.push({
            label: key,
            value: vitalSet[key],
            date: date
          });
        }
      });
    });
    
    res.json({ vitals: flattenedVitals });
  } catch (error) {
    console.error('List vitals error:', error);
    res.status(500).json({ error: 'Failed to fetch vitals' });
  }
}

async function addVital(req, res) {
  try {
    const { patientId } = req.params;
    const b = req.body || {};
    // Accept the several field names the various callers send
    // (temp/temperature, height/height_cm, weight/weight_kg, bp/systolic+diastolic).
    const temp = b.temp ?? b.temperature ?? null;
    const height = b.height ?? b.height_cm ?? null;
    const weight = b.weight ?? b.weight_kg ?? null;
    const pulse = b.pulse ?? null;
    const spo2 = b.spo2 ?? null;
    let blood_pressure = b.blood_pressure ?? b.bp ?? null;
    if (!blood_pressure && (b.bp_systolic || b.bp_diastolic)) {
      blood_pressure = `${b.bp_systolic || ''}/${b.bp_diastolic || ''}`;
    }
    // Link the reading to the visit when the caller knows it, so the
    // prescription PDF's appointment-scoped vitals lookup can find it.
    const appointmentId = b.appointment_id ? parseInt(b.appointment_id, 10) || null : null;

    // Calculate BMI if height and weight are provided
    let bmi = b.bmi ?? null;
    if (!bmi && height && weight) {
      bmi = (weight / ((height / 100) ** 2)).toFixed(2);
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO patient_vitals (patient_id, appointment_id, height_cm, weight_kg, bmi, blood_pressure, pulse, temperature, spo2)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        appointmentId,
        height || null,
        weight || null,
        bmi,
        blood_pressure || null,
        pulse || null,
        temp || null,
        spo2 || null
      ]
    );
    res.status(201).json({ id: result.insertId, message: 'Vitals recorded', bmi });
  } catch (error) {
    console.error('Add vital error:', error);
    res.status(500).json({ error: 'Failed to record vitals' });
  }
}

async function deleteRecord(req, res) {
  try {
    const { patientId, recordId } = req.params;
    const db = getDb();

    // Get record to retrieve file path
    const [records] = await db.execute(
      `SELECT file_path FROM medical_records WHERE id = ? AND patient_id = ?`,
      [recordId, patientId]
    );

    if (records.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const record = records[0];

    // Delete file from disk if it exists
    if (record.file_path) {
      try {
        const filePath = path.join(__dirname, '../../', record.file_path);
        await fs.unlink(filePath);
      } catch (err) {
        console.warn('File deletion warning:', err.message);
      }
    }

    // Delete record from database
    await db.execute(
      `DELETE FROM medical_records WHERE id = ? AND patient_id = ?`,
      [recordId, patientId]
    );

    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Delete record error:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
}

async function listTimeline(req, res) {
  const { patientId } = req.params;
  try {
    const db = getDb();
    
    // Get all appointments (not just completed) that have prescriptions or are completed
    const [appointments] = await db.execute(
      `SELECT a.id, a.appointment_date as date, a.reason_for_visit, a.notes, a.status,
              GROUP_CONCAT(DISTINCT pi.medicine_name) as meds,
              GROUP_CONCAT(DISTINCT CONCAT(pi.dosage, ' ', pi.frequency)) as med_details,
              COUNT(DISTINCT pi.id) as prescription_count
       FROM appointments a
       LEFT JOIN prescriptions p ON p.appointment_id = a.id
       LEFT JOIN prescription_items pi ON pi.prescription_id = p.id
       WHERE a.patient_id = ?
       GROUP BY a.id
       HAVING prescription_count > 0 OR a.status IN ('completed', 'in-progress')
       ORDER BY a.appointment_date DESC LIMIT 50`,
      [patientId]
    );
    
    const timeline = appointments.map((a) => ({
      id: a.id,
      date: a.date ? getLocalDateString(new Date(a.date)) : getLocalDateString(),
      diagnosis: unwrapJsonText(a.reason_for_visit) || 'General Consultation',
      symptoms: a.notes ? [unwrapJsonText(a.notes)] : [],
      meds: a.meds ? a.meds.split(',').map(m => m.trim()).filter(m => m) : [],
      status: a.status,
      prescription_count: a.prescription_count || 0
    }));
    
    res.json({ timeline });
  } catch (error) {
    console.error('List timeline error:', error);
    console.error('SQL Error:', error.sqlMessage);
    console.error('SQL State:', error.sqlState);
    console.error('Patient ID:', patientId);
    res.status(500).json({ error: 'Failed to fetch timeline', details: error.message });
  }
}

async function viewRecord(req, res) {
  try {
    const { recordId } = req.params;
    const db = getDb();

    const [records] = await db.execute(
      `SELECT file_path, file_type FROM medical_records WHERE id = ?`,
      [recordId]
    );

    if (!records || records.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const record = records[0];
    if (!record.file_path) {
      return res.status(404).json({ error: 'No file associated with this record' });
    }

    let fullPath = record.file_path;
    if (fullPath.startsWith('/')) {
      fullPath = path.join(__dirname, '../../', fullPath);
    } else {
      fullPath = path.join(__dirname, '../../uploads/records', fullPath);
    }

    const resolvedPath = path.resolve(fullPath);
    const recordsDir = path.resolve(path.join(__dirname, '../../uploads/records'));

    if (!resolvedPath.startsWith(recordsDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      await fs.access(resolvedPath);
    } catch (err) {
      console.error('File not found:', resolvedPath);
      return res.status(404).json({ error: 'File not found' });
    }

    if (record.file_type) {
      res.setHeader('Content-Type', record.file_type);
    }
    res.setHeader('Content-Disposition', 'inline');

    return res.sendFile(resolvedPath);
  } catch (error) {
    console.error('View record error:', error);
    return res.status(500).json({ error: 'Failed to view record' });
  }
}

async function downloadRecord(req, res) {
  try {
    const { recordId } = req.params;
    const db = getDb();

    // Get record from database
    const [records] = await db.execute(
      `SELECT file_path, record_title FROM medical_records WHERE id = ?`,
      [recordId]
    );

    if (!records || records.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const record = records[0];
    if (!record.file_path) {
      return res.status(404).json({ error: 'No file associated with this record' });
    }

    // Construct full file path
    let fullPath = record.file_path;
    if (fullPath.startsWith('/')) {
      fullPath = path.join(__dirname, '../../', fullPath);
    } else {
      fullPath = path.join(__dirname, '../../uploads/records', fullPath);
    }

    // Security: Prevent path traversal
    const resolvedPath = path.resolve(fullPath);
    const recordsDir = path.resolve(path.join(__dirname, '../../uploads/records'));
    
    if (!resolvedPath.startsWith(recordsDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch (err) {
      console.error('File not found:', resolvedPath);
      return res.status(404).json({ error: 'File not found' });
    }

    // Download the file
    res.download(resolvedPath, record.record_title || 'record', (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
  } catch (error) {
    console.error('Download record error:', error);
    res.status(500).json({ error: 'Failed to download record' });
  }
}

module.exports = require('./patientDataController_refactored');
