const { getDb } = require('../config/db');
const path = require('path');
const fs = require('fs').promises;
const { processLabReportImage } = require('./ocrExtractor');
const { getLocalDateString } = require('../utils/localDate');

const uploadsRootDir = path.resolve(__dirname, '..', '..', 'uploads');
const uploadsRecordsDir = path.join(uploadsRootDir, 'records');

async function repairUploadsRecordPath({ db, recordId, filePath }) {
  if (!filePath || typeof filePath !== 'string') return null;
  if (!filePath.startsWith('/uploads/records/')) return null;

  const onDisk = path.join(uploadsRootDir, filePath.replace(/^\/uploads\//, ''));
  try {
    await fs.access(onDisk);
    return filePath;
  } catch (_) {
    // missing; attempt repair
  }

  const basename = path.basename(filePath);
  const match = /^record-\d+-\d+-(.+)$/.exec(basename);
  const originalName = match?.[1];
  if (!originalName) return null;

  const files = await fs.readdir(uploadsRecordsDir);
  const candidates = (files || []).filter((f) => f.endsWith(originalName));
  if (candidates.length === 0) return null;

  const chosen = candidates.sort().slice(-1)[0];
  const repairedPath = `/uploads/records/${chosen}`;

  if (db && recordId) {
    try {
      await db.execute('UPDATE medical_records SET file_path = ? WHERE id = ?', [repairedPath, recordId]);
    } catch (_) {
      // ignore
    }
  }

  return repairedPath;
}

class PatientDataService {
  static async listRecords(patientId) {
    const db = getDb();
    const [records] = await db.execute(
      `SELECT id, record_title as name, uploaded_date as date, record_type as category, file_path, description
       FROM medical_records WHERE patient_id = ? ORDER BY uploaded_date DESC`,
      [patientId]
    );

    const fixedRecords = await Promise.all(
      (records || []).map(async (r) => {
        if (!r?.file_path) return r;
        try {
          const repaired = await repairUploadsRecordPath({ db, recordId: r.id, filePath: r.file_path });
          if (repaired && repaired !== r.file_path) return { ...r, file_path: repaired };
          return r;
        } catch (_) {
          return r;
        }
      })
    );

    return { records: fixedRecords };
  }

  static async addRecord({ patientId, body, file, user }) {
    const { name, category, description, date } = body;
    const db = getDb();

    const clinicId = user?.clinic_id || null;

    const [result] = await db.execute(
      `INSERT INTO medical_records (patient_id, clinic_id, doctor_id, record_title, record_type, file_path, file_type, file_size, description, uploaded_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        clinicId,
        user?.id || null,
        name,
        category || 'OTHERS',
        file ? `/uploads/records/${file.filename}` : null,
        file ? file.mimetype : null,
        file ? file.size : null,
        description || null,
        date || new Date(),
      ]
    );

    const recordId = result.insertId;
    let extractedLabResults = null;

    if (file && (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf')) {
      try {
        const filePath = path.join(uploadsRecordsDir, file.filename);

        const [labTemplates] = await db.execute(
          `SELECT id, test_name, test_code, unit, reference_range, category FROM lab_templates WHERE is_active = 1 LIMIT 500`
        );

        const ocrResult = await processLabReportImage(filePath, labTemplates);

        if (ocrResult.success && ocrResult.results.length > 0) {
          const insertedResults = [];

          for (const row of ocrResult.results) {
            if (!row?.test_name || row.reading === undefined || row.reading === null) continue;

            let finalTestName = row.test_name;
            let finalUnit = row.unit || null;
            let finalReferenceRange = row.reference_range || null;

            if (row.confidence === 'unmatched') {
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
                  user?.id || null,
                  finalTestName,
                  row.reading,
                  finalUnit,
                  finalReferenceRange,
                  new Date(),
                  `Extracted from: ${name}`,
                ]
              );

              insertedResults.push({
                id: insertResult.insertId,
                test_name: finalTestName,
                reading: row.reading,
                unit: finalUnit,
              });
            } catch (err) {
              console.error('Failed to insert extracted lab result:', err);
            }
          }

          extractedLabResults = {
            extracted: true,
            count: insertedResults.length,
            results: insertedResults,
            unmatchedCount: ocrResult.results.filter((r) => r.confidence === 'unmatched').length,
          };
        }
      } catch (ocrErr) {
        console.error('OCR extraction failed (non-critical):', ocrErr.message);
        extractedLabResults = {
          extracted: false,
          error: 'OCR extraction failed but file was saved',
          details: ocrErr.message,
        };
      }
    }

    return {
      id: recordId,
      extractedLabData: extractedLabResults,
    };
  }

  static async deleteRecord({ patientId, recordId }) {
    const db = getDb();

    const [records] = await db.execute(
      `SELECT file_path FROM medical_records WHERE id = ? AND patient_id = ?`,
      [recordId, patientId]
    );

    if (records.length === 0) {
      const err = new Error('Record not found');
      err.statusCode = 404;
      throw err;
    }

    const record = records[0];

    if (record.file_path) {
      try {
        const filePath = record.file_path.startsWith('/uploads/')
          ? path.join(uploadsRootDir, record.file_path.replace(/^\/uploads\//, ''))
          : path.join(uploadsRecordsDir, record.file_path);
        await fs.unlink(filePath);
      } catch (e) {
        console.warn('File deletion warning:', e.message);
      }
    }

    await db.execute(`DELETE FROM medical_records WHERE id = ? AND patient_id = ?`, [recordId, patientId]);

    return { deleted: true };
  }

  static async listLabs(patientId) {
    const db = getDb();
    const [labs] = await db.execute(
      `SELECT id, test_name as name, result_value as reading, result_date as date, result_unit as unit, report_group, reference_range, test_category
       FROM lab_investigations WHERE patient_id = ? AND status = 'completed' ORDER BY result_date DESC, report_group, id`,
      [patientId]
    );

    return { labs };
  }

  static async addLab({ patientId, body, user }) {
    const { name, reading, date, unit } = body;
    const db = getDb();
    const clinicId = user?.clinic_id || null;

    const [result] = await db.execute(
      `INSERT INTO lab_investigations (patient_id, clinic_id, doctor_id, test_name, result_value, result_date, result_unit, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [patientId, clinicId, user?.id || null, name, reading, date || new Date(), unit || null]
    );

    return { id: result.insertId };
  }

  static async addLabBatch({ patientId, body, user }) {
    const { category, results, date } = body;
    if (!category || !results || !Array.isArray(results) || results.length === 0) {
      const err = new Error('category and results array are required');
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();
    const clinicId = user?.clinic_id || null;
    const doctorId = user?.id || null;
    const reportGroup = `${category}-${Date.now()}`;
    const resultDate = date || new Date();

    const ids = [];

    for (const item of results) {
      if (!item.name || !item.reading) continue;

      const [result] = await db.execute(
        `INSERT INTO lab_investigations (patient_id, clinic_id, doctor_id, test_name, result_value, result_date, result_unit, status, report_group, reference_range, test_category)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
        [
          patientId,
          clinicId,
          doctorId,
          item.name,
          item.reading,
          resultDate,
          item.unit || null,
          reportGroup,
          item.normalRange || null,
          category,
        ]
      );

      ids.push(result.insertId);
    }

    return { ids, report_group: reportGroup };
  }

  static async listVitals(patientId) {
    const db = getDb();
    const [vitals] = await db.execute(
      `SELECT temperature as temp, height_cm, weight_kg, bmi,
              pulse, spo2, blood_pressure, recorded_at as date
       FROM patient_vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 10`,
      [patientId]
    );

    const formatted = vitals.map((v) => ({
      Temperature: v.temp,
      Height: v.height_cm,
      Weight: v.weight_kg,
      BMI: v.bmi,
      'Pulse Rate': v.pulse,
      'Blood Pressure': v.blood_pressure,
      SpO2: v.spo2,
      date: v.date ? getLocalDateString(new Date(v.date)) : getLocalDateString(),
    }));

    const flattenedVitals = [];
    formatted.forEach((vitalSet) => {
      const d = vitalSet.date;
      Object.keys(vitalSet).forEach((key) => {
        if (key !== 'date' && vitalSet[key] !== null) {
          flattenedVitals.push({ label: key, value: vitalSet[key], date: d });
        }
      });
    });

    return { vitals: flattenedVitals };
  }

  static async addVital({ patientId, body }) {
    const { temp, height, weight, pulse, spo2, blood_pressure } = body;

    let bmi = null;
    if (height && weight) {
      bmi = (weight / ((height / 100) ** 2)).toFixed(2);
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO patient_vitals (patient_id, appointment_id, height_cm, weight_kg, bmi, blood_pressure, pulse, temperature, spo2)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        null,
        height || null,
        weight || null,
        bmi,
        blood_pressure || null,
        pulse || null,
        temp || null,
        spo2 || null,
      ]
    );

    return { id: result.insertId, bmi };
  }

  static async listTimeline(patientId) {
    const db = getDb();

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
      diagnosis: a.reason_for_visit || 'General Consultation',
      symptoms: a.notes ? [a.notes] : [],
      meds: a.meds ? a.meds.split(',').map((m) => m.trim()).filter((m) => m) : [],
      status: a.status,
      prescription_count: a.prescription_count || 0,
    }));

    return { timeline };
  }

  static async getRecordForView(recordId) {
    const db = getDb();

    const [records] = await db.execute(`SELECT file_path, file_type FROM medical_records WHERE id = ?`, [recordId]);

    if (!records || records.length === 0) {
      const err = new Error('Record not found');
      err.statusCode = 404;
      throw err;
    }

    const record = records[0];
    if (!record.file_path) {
      const err = new Error('No file associated with this record');
      err.statusCode = 404;
      throw err;
    }

    // Repair stale file_path if needed
    try {
      const repaired = await repairUploadsRecordPath({ db, recordId, filePath: record.file_path });
      if (repaired) record.file_path = repaired;
    } catch (_) {
      // ignore
    }

    // Repair stale file_path if needed
    try {
      const repaired = await repairUploadsRecordPath({ db, recordId, filePath: record.file_path });
      if (repaired) record.file_path = repaired;
    } catch (_) {
      // ignore
    }

    let fullPath = record.file_path;
    if (fullPath.startsWith('/')) {
      if (fullPath.startsWith('/uploads/')) {
        fullPath = path.join(uploadsRootDir, fullPath.replace(/^\/uploads\//, ''));
      } else {
        fullPath = path.join(__dirname, '../../', fullPath);
      }
    } else {
      fullPath = path.join(uploadsRecordsDir, fullPath);
    }

    const resolvedPath = path.resolve(fullPath);
    const recordsDir = path.resolve(uploadsRecordsDir);

    if (!resolvedPath.startsWith(recordsDir)) {
      const err = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      const err = new Error('File not found');
      err.statusCode = 404;
      throw err;
    }

    return {
      resolvedPath,
      fileType: record.file_type || null,
    };
  }

  static async getRecordForDownload(recordId) {
    const db = getDb();

    const [records] = await db.execute(`SELECT file_path, record_title FROM medical_records WHERE id = ?`, [recordId]);

    if (!records || records.length === 0) {
      const err = new Error('Record not found');
      err.statusCode = 404;
      throw err;
    }

    const record = records[0];
    if (!record.file_path) {
      const err = new Error('No file associated with this record');
      err.statusCode = 404;
      throw err;
    }

    let fullPath = record.file_path;
    if (fullPath.startsWith('/')) {
      if (fullPath.startsWith('/uploads/')) {
        fullPath = path.join(uploadsRootDir, fullPath.replace(/^\/uploads\//, ''));
      } else {
        fullPath = path.join(__dirname, '../../', fullPath);
      }
    } else {
      fullPath = path.join(uploadsRecordsDir, fullPath);
    }

    const resolvedPath = path.resolve(fullPath);
    const recordsDir = path.resolve(uploadsRecordsDir);

    if (!resolvedPath.startsWith(recordsDir)) {
      const err = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      const err = new Error('File not found');
      err.statusCode = 404;
      throw err;
    }

    return {
      resolvedPath,
      filename: record.record_title || 'record',
    };
  }
}

module.exports = PatientDataService;
