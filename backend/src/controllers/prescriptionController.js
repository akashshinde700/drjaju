// backend/src/controllers/prescriptionController.js

const { getDb, query } = require('../config/db');

const pdfService = require('../services/pdfService');

const DoseValidator = require('../services/doseValidator');

const DiagnosisService = require('../services/DiagnosisService');

const { sendSuccess, sendError } = require('../utils/responseHelper');
const { unwrapJsonText } = require('../utils/unwrapJsonText');
const qrcode = require('qrcode');
const emailService = require('../services/emailService');

// Build the public, patient-facing prescription view URL. The frontend origin is
// not known to the backend by default, so prefer FRONTEND_URL and fall back to the
// request's own origin/referer.
function buildPrescriptionViewUrl(req, prescriptionId) {
  const base = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || req.get('origin') || (req.get('referer') || '').replace(/\/[^/]*$/, '') || '').replace(/\/$/, '');
  return `${base}/prescription/view/${prescriptionId}`;
}

// POST /api/prescriptions/:prescriptionId/share  { method: 'whatsapp'|'qrcode'|'email', email? }
// Implements the Share button (previously called a non-existent endpoint). Uses only
// the public view link (no PHI in the message) + the already-installed qrcode/email services.
async function sharePrescription(req, res) {
  try {
    const { prescriptionId } = req.params;
    const { method, email } = req.body || {};
    const viewUrl = buildPrescriptionViewUrl(req, prescriptionId);

    if (method === 'whatsapp') {
      const text = encodeURIComponent(`View your prescription: ${viewUrl}`);
      return res.json({ success: true, shareUrl: `https://wa.me/?text=${text}`, viewUrl });
    }
    if (method === 'qrcode') {
      const qrCode = await qrcode.toDataURL(viewUrl);
      return res.json({ success: true, qrCode, shareUrl: viewUrl, viewUrl });
    }
    if (method === 'email') {
      if (!email) return res.status(400).json({ success: false, error: 'Email address is required' });
      await emailService.sendEmail({
        to: email,
        subject: 'Your Prescription',
        html: `<p>Hello,</p><p>You can view your prescription here:</p><p><a href="${viewUrl}">${viewUrl}</a></p><p>Regards,</p>`,
        text: `View your prescription: ${viewUrl}`,
      });
      return res.json({ success: true });
    }
    return res.status(400).json({ success: false, error: 'Invalid share method' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to share prescription' });
  }
}

// GET /api/prescriptions/:prescriptionId/share-options — bundle of ready-to-use share links.
async function getShareOptions(req, res) {
  try {
    const { prescriptionId } = req.params;
    const viewUrl = buildPrescriptionViewUrl(req, prescriptionId);
    const qrCode = await qrcode.toDataURL(viewUrl);
    const text = encodeURIComponent(`View your prescription: ${viewUrl}`);
    return res.json({
      success: true,
      sharing: {
        viewUrl,
        whatsapp: { url: `https://wa.me/?text=${text}` },
        qrCode,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to build share options' });
  }
}



/**

 * GET /api/prescriptions/:patientId

 * Past prescriptions for a patient

 */

async function listPrescriptions(req, res) {

  const { patientId } = req.params;

  const { page = 1, limit = 20 } = req.query;

  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

  const offset = (parseInt(page, 10) - 1) * limitNum;

  try {

    const db = getDb();



    // Get prescriptions with pagination (trimmed fields for list)

    const [prescriptions] = await db.execute(

      `SELECT

         p.id,

         p.patient_id,

         p.doctor_id,

         p.chief_complaint,

         p.diagnosis,

         p.advice,

         p.follow_up_days,

         p.follow_up_date,

         p.patient_notes,

         p.prescribed_date,

         p.lab_advice,

         p.custom_fields,

         p.created_at,

         p.updated_at,

         u.name AS doctor_name,

         d.specialization

       FROM prescriptions p

       JOIN doctors d ON p.doctor_id = d.id

       JOIN users u   ON d.user_id = u.id

       WHERE p.patient_id = ?

       ORDER BY p.created_at DESC

       LIMIT ${limitNum} OFFSET ${offset}`,

      [patientId]

    );



    // Get total count

    const [countResult] = await db.execute(

      `SELECT COUNT(*) as total FROM prescriptions WHERE patient_id = ?`,

      [patientId]

    );

    const total = countResult[0].total;



    // Fetch all prescription items in a single query (fix N+1)

    if (prescriptions.length > 0) {

      const prescriptionIds = prescriptions.map(p => p.id);

      const placeholders = prescriptionIds.map(() => '?').join(',');

      const [allItems] = await db.execute(

        `SELECT

           pi.id,

           pi.prescription_id,

           pi.medicine_name,

           m.name AS medication_name,

           m.generic_name,

           m.dosage_form,

           pi.dosage,

           pi.frequency,

           pi.duration,

           pi.timing,

           pi.quantity,

           pi.notes AS instructions,

           pi.is_tapering

         FROM prescription_items pi

         LEFT JOIN medicines m ON m.id = pi.medicine_id

         WHERE pi.prescription_id IN (${placeholders})

         ORDER BY pi.sort_order ASC, pi.id ASC`,

        prescriptionIds

      );



      // Batch load tapering schedules (avoids N+1 queries)

      const taperingItemIds = allItems.filter(i => i.is_tapering).map(i => i.id);

      let stepsByItemId = {};

      if (taperingItemIds.length > 0) {

        const tPlaceholders = taperingItemIds.map(() => '?').join(',');

        const [allSteps] = await db.execute(

          `SELECT prescription_item_id, step_number, dose, frequency, duration_days

           FROM tapering_schedules WHERE prescription_item_id IN (${tPlaceholders})

           ORDER BY step_number ASC`,

          taperingItemIds

        );

        for (const step of allSteps) {

          if (!stepsByItemId[step.prescription_item_id]) stepsByItemId[step.prescription_item_id] = [];

          stepsByItemId[step.prescription_item_id].push(step);

        }

      }

      for (const item of allItems) {

        item.medication_name = item.medication_name || item.medicine_name;

        item.tapering_schedule = item.is_tapering ? (stepsByItemId[item.id] || []) : [];

      }



      // Group items by prescription_id

      const itemsByPrescriptionId = {};

      for (let item of allItems) {

        if (!itemsByPrescriptionId[item.prescription_id]) {

          itemsByPrescriptionId[item.prescription_id] = [];

        }

        itemsByPrescriptionId[item.prescription_id].push(item);

      }



      // Attach items to prescriptions

      for (const rx of prescriptions) {

        rx.medications = itemsByPrescriptionId[rx.id] || [];

      }



      // Fetch vitals for prescriptions that have appointment_id

      const appointmentIds = prescriptions

        .filter(p => p.appointment_id)

        .map(p => p.appointment_id);



      if (appointmentIds.length > 0) {

        const vitalsPlaceholders = appointmentIds.map(() => '?').join(',');

        const [allVitals] = await db.execute(

          `SELECT

             appointment_id,

             temperature AS temp,

             height_cm AS height,

             weight_kg AS weight,

             pulse,

             spo2,

             blood_pressure

           FROM patient_vitals

           WHERE appointment_id IN (${vitalsPlaceholders})

           ORDER BY recorded_at DESC`,

          appointmentIds

        );



        // Group vitals by appointment_id (take latest)

        const vitalsByAppointmentId = {};

        for (let vital of allVitals) {

          if (!vitalsByAppointmentId[vital.appointment_id]) {

            vitalsByAppointmentId[vital.appointment_id] = vital;

          }

        }



        // Attach vitals to prescriptions

        for (const rx of prescriptions) {

          if (rx.appointment_id && vitalsByAppointmentId[rx.appointment_id]) {

            rx.vitals = vitalsByAppointmentId[rx.appointment_id];

          } else {

            rx.vitals = {};

          }

        }

      } else {

        // No appointment_ids, set empty vitals

        for (const rx of prescriptions) {

          rx.vitals = {};

        }

      }

    } else {

      // No prescriptions, nothing to do

    }



    // Batch fetch vitals by patient_id for prescriptions without appointment_id

    const rxNeedingVitals = prescriptions.filter(rx => !rx.vitals || Object.keys(rx.vitals).length === 0);

    if (rxNeedingVitals.length > 0) {

      const dateConditions = rxNeedingVitals.map(() => 'DATE(recorded_at) = DATE(?)').join(' OR ');

      const dateParams = rxNeedingVitals.map(rx => rx.created_at);

      const [batchVitals] = await db.execute(

        `SELECT

           DATE(recorded_at) AS vital_date,

           temperature AS temp,

           height_cm AS height,

           weight_kg AS weight,

           pulse,

           spo2,

           blood_pressure

         FROM patient_vitals

         WHERE patient_id = ?

         AND (${dateConditions})

         ORDER BY recorded_at DESC`,

        [patientId, ...dateParams]

      );

      const vitalsByDate = {};

      for (const v of batchVitals) {

        const dateKey = v.vital_date ? new Date(v.vital_date).toISOString().slice(0, 10) : null;

        if (dateKey && !vitalsByDate[dateKey]) vitalsByDate[dateKey] = v;

      }

      for (const rx of rxNeedingVitals) {

        const rxDate = rx.created_at ? new Date(rx.created_at).toISOString().slice(0, 10) : null;

        rx.vitals = (rxDate && vitalsByDate[rxDate]) || {};

      }

    }



    // Fetch diagnoses for all prescriptions

    if (prescriptions.length > 0) {

      const prescriptionIds = prescriptions.map(p => p.id);

      const diagPlaceholders = prescriptionIds.map(() => '?').join(',');

      const [allDiagnoses] = await db.execute(

        `SELECT pd.prescription_id, pd.icd_code, ic.primary_description as icd_title

         FROM prescription_diagnoses pd

         LEFT JOIN icd_codes ic ON pd.icd_code = ic.icd_code

         WHERE pd.prescription_id IN (${diagPlaceholders})`,

        prescriptionIds

      );



      // Group diagnoses by prescription_id

      const diagnosesByPrescriptionId = {};

      for (let diag of allDiagnoses) {

        if (!diagnosesByPrescriptionId[diag.prescription_id]) {

          diagnosesByPrescriptionId[diag.prescription_id] = [];

        }

        diagnosesByPrescriptionId[diag.prescription_id].push(diag.icd_title || diag.icd_code);

      }



      // Attach diagnoses to prescriptions

      for (const rx of prescriptions) {

        rx.diagnoses = diagnosesByPrescriptionId[rx.id] || [];

        // Also use diagnosis text field if diagnoses array is empty

        if (rx.diagnoses.length === 0 && rx.diagnosis) {

          rx.diagnoses = unwrapJsonText(rx.diagnosis).split(',').map(d => d.trim()).filter(Boolean);

        }

      }



      // Fetch symptoms from appointments (stored in notes field)

      const appointmentIds = prescriptions.filter(p => p.appointment_id).map(p => p.appointment_id);

      if (appointmentIds.length > 0) {

        const apptPlaceholders = appointmentIds.map(() => '?').join(',');

        const [appointments] = await db.execute(

          `SELECT id, notes, reason_for_visit FROM appointments WHERE id IN (${apptPlaceholders})`,

          appointmentIds

        );



        const appointmentMap = {};

        for (let appt of appointments) {

          appointmentMap[appt.id] = appt;

        }



        for (const rx of prescriptions) {

          if (rx.appointment_id && appointmentMap[rx.appointment_id]) {

            const appt = appointmentMap[rx.appointment_id];

            // Symptoms are stored in notes field

            rx.symptoms = appt.notes ? appt.notes.split(',').map(s => s.trim()).filter(Boolean) : [];

          } else {

            rx.symptoms = [];

          }

        }

      } else {

        for (const rx of prescriptions) {

          rx.symptoms = [];

        }

      }

    }



    sendSuccess(res, {

      prescriptions,

      pagination: {

        page: parseInt(page, 10),

        limit: limitNum,

        total,

        pages: Math.ceil(total / limitNum)

      }

    });

  } catch (error) {

    console.error('List prescriptions error:', error);

    console.error('SQL Error:', error.sqlMessage);

    console.error('SQL State:', error.sqlState);

    console.error('Patient ID:', patientId);

    sendError(res, 'Failed to fetch prescriptions', 500, error.message);

  }

}



/**

 * POST /api/prescriptions

 * Create a new prescription

 */

async function addPrescription(req, res) {

  try {

    const {

      patient_id,

      doctor_id,

      appointment_id,

      template_id,

      medications = [],

      symptoms = [],

      diagnosis = [],

      vitals = {},

      advice = '',

      follow_up_days = null,

      follow_up_date = null,

      patient_notes = '',

      private_notes = '',

      lab_advice = '',

      lab_remarks = '',

      custom_fields = null

    } = req.body;



    if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });



    const db = getDb();



    // 1) Resolve doctor_id (fallbacks)

    let finalDoctorId = doctor_id;



    if (!finalDoctorId && req.user && req.user.id) {

      try {

        const [rows] = await db.execute('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.id]);

        if (rows.length > 0) finalDoctorId = rows[0].id;

      } catch (e) {

        // ignore

      }

    }



    if (!finalDoctorId) {

      const [rows] = await db.execute("SELECT id FROM doctors WHERE status = 'active' LIMIT 1");

      if (rows.length > 0) finalDoctorId = rows[0].id;

    }



    if (!finalDoctorId) {

      const [rows] = await db.execute('SELECT id FROM doctors LIMIT 1');

      if (rows.length > 0) finalDoctorId = rows[0].id;

    }



    if (!finalDoctorId) {

      return res.status(400).json({ error: 'No doctor found in system. Please create a doctor first.' });

    }



    // 2) Run allergy check, patient fetch, and appointment validation in parallel

    const [allergyResult, patientResult, appointmentCheckResult] = await Promise.all([

      db.execute(

        `SELECT allergen_name, snomed_concept_id, severity

         FROM patient_allergies

         WHERE patient_id = ? AND is_active = 1 AND category = 'drug'`,

        [patient_id]

      ),

      db.execute('SELECT dob FROM patients WHERE id = ? LIMIT 1', [patient_id]),

      appointment_id ? db.execute('SELECT id FROM appointments WHERE id = ?', [appointment_id]) : Promise.resolve([[]])

    ]);



    const [activeAllergies] = allergyResult;

    const [patients] = patientResult;

    const [appointmentRows] = appointmentCheckResult;



    if (patients.length === 0) return res.status(400).json({ error: 'Patient not found' });



    const alerts = [];

    const normalize = (s) => (s || '')

      .toString()

      .toLowerCase()

      .replace(/\s+/g, ' ')

      .replace(/[^a-z0-9\s\.\-]/g, '')

      .trim();



    const allergenNames = activeAllergies.map(a => ({

      name: normalize(a.allergen_name),

      conceptId: a.snomed_concept_id || null,

      severity: a.severity || null,

    }));



    for (const med of medications) {

      const medName = normalize(med.medication_name || med.name || med.brand_name);

      if (!medName) continue;

      for (const al of allergenNames) {

        if (!al.name) continue;

        if (medName.includes(al.name) || al.name.includes(medName)) {

          alerts.push({ drugName: medName, allergenName: al.name, severity: al.severity || null });

        }

      }

    }



    if (alerts.length > 0) {

      console.warn('Allergy alerts (warn):', alerts);

      const blockOnAllergy = (process.env.REQUIRE_NO_ALLERGY_CONFLICT || 'false').toLowerCase() === 'true';

      if (blockOnAllergy) return res.status(400).json({ error: 'Allergy conflict detected', details: alerts });

    }



    // 2.4) Dose Validation

    try {

      const patientRow = patients[0];

      const patientData = { dob: patientRow.dob, weight: patientRow.weight };

      const doseValidation = DoseValidator.validatePrescription(medications, patientData);

      if (!doseValidation.valid) {

        return res.status(400).json({

          error: 'Medication dose validation failed',

          details: doseValidation.errors,

          warnings: doseValidation.warnings

        });

      }

      if (doseValidation.warnings.length > 0) res.locals.doseWarnings = doseValidation.warnings;

    } catch (e) {

      // ignore

    }



    // 2.5) Appointment validation

    let validAppointmentId = null;

    if (appointment_id) validAppointmentId = appointmentRows.length === 0 ? null : appointment_id;



    // Vitals-first enforcement

    const requireVitals = (process.env.REQUIRE_VITALS_BEFORE_DIAGNOSIS || 'false').toLowerCase() === 'true';

    if (requireVitals) {

      const [vitalsRows] = await db.execute(

        `SELECT 1 FROM patient_vitals

         WHERE patient_id = ?

           AND (appointment_id = ? OR DATE(recorded_at) = CURDATE())

         ORDER BY recorded_at DESC

         LIMIT 1`,

        [patient_id, validAppointmentId]

      );

      if (vitalsRows.length === 0) return res.status(400).json({ error: 'Vitals required before diagnosis/prescription' });

    }



    // 3) Save vitals (optional)

    if (vitals && (vitals.temp || vitals.height || vitals.weight || vitals.pulse || vitals.blood_pressure || vitals.spo2)) {

      let bmi = null;

      if (vitals.height && vitals.weight) {

        bmi = (vitals.weight / ((vitals.height / 100) ** 2)).toFixed(2);

      }



      await db.execute(

        `INSERT INTO patient_vitals

           (patient_id, appointment_id, height_cm, weight_kg, bmi, blood_pressure, pulse, temperature, spo2)

         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,

        [

          patient_id,

          validAppointmentId,

          vitals.height || null,

          vitals.weight || null,

          bmi,

          vitals.blood_pressure || null,

          vitals.pulse || null,

          vitals.temp || null,

          vitals.spo2 || null

        ]

      );

    }



    // The `advice` column is the Advice section; `patient_notes` is its own
    // column and its own "Notes" section on the printout. Merging them here made
    // every Patient Note also print under Advice (double-printed on the PDF).
    const combinedInstructions = advice || null;



    // 4) Resolve clinic_id

    let clinicId = null;

    try {

      const [doctorClinic] = await db.execute('SELECT clinic_id FROM doctors WHERE id = ?', [finalDoctorId]);

      if (doctorClinic.length > 0) clinicId = doctorClinic[0].clinic_id;

    } catch (e) {

      // ignore

    }

    if (!clinicId) {

      const [clinics] = await db.execute('SELECT id FROM clinics LIMIT 1');

      if (clinics.length > 0) clinicId = clinics[0].id;

    }

    if (!clinicId) return res.status(400).json({ error: 'No clinic found in system. Please create a clinic first.' });



    // 5) Insert prescription (schema-resilient)

    const insertPrescription = async () => {

      const followUpDays = follow_up_days !== null && follow_up_days !== undefined ? parseInt(follow_up_days, 10) : null;

      // unwrapJsonText handles both object items ({label}/{name}/...) and
      // items that are themselves already-stringified JSON from a previous
      // edit of this record — without it, re-saving a record whose text was
      // corrupted once keeps compounding the corruption on every edit.
      // IMPORTANT: never JSON.stringify a leftover string here. Doing that on a
      // value unwrapJsonText couldn't clean just adds another escaping layer and
      // is exactly how "\"\\\"[]\\\"\"" ended up printed on the Rx. Objects with
      // no usable label are simply dropped, and empty entries are filtered out.
      const cleanLabel = (v) => {
        if (v && typeof v === 'object') {
          return String(v.name || v.symptom_name || v.icd_title || v.title || v.label || '').trim();
        }
        return String(unwrapJsonText(v) || '').trim();
      };
      const chief = Array.isArray(symptoms) && symptoms.length > 0
        ? (symptoms.map(cleanLabel).filter(Boolean).join(', ') || null)
        : (typeof symptoms === 'string' ? (unwrapJsonText(symptoms) || null) : null);

      const diag = Array.isArray(diagnosis) && diagnosis.length > 0
        ? (diagnosis.map(cleanLabel).filter(Boolean).join(', ') || null)
        : (typeof diagnosis === 'string' ? (unwrapJsonText(diagnosis) || null) : null);



      const attempts = [

        {

          sql: `INSERT INTO prescriptions (

                  patient_id, doctor_id, clinic_id, appointment_id, template_id,

                  chief_complaint, diagnosis, advice, follow_up_date, follow_up_days, patient_notes, private_notes, lab_advice, lab_remarks, custom_fields, prescribed_date, status

                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'active')`,

          params: [

            patient_id,

            finalDoctorId,

            clinicId,

            validAppointmentId,

            template_id || null,

            chief,

            diag,

            combinedInstructions || null,

            follow_up_date || null,

            followUpDays,

            patient_notes || null,

            private_notes || null,

            lab_advice || null,

            lab_remarks || null,

            custom_fields && typeof custom_fields === 'object' && Object.keys(custom_fields).length > 0 ? JSON.stringify(custom_fields) : null

          ]

        },

        {

          sql: `INSERT INTO prescriptions (

                  patient_id, doctor_id, clinic_id, appointment_id,

                  chief_complaint, diagnosis, advice, follow_up_date, follow_up_days, patient_notes, prescribed_date, status

                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'active')`,

          params: [

            patient_id,

            finalDoctorId,

            clinicId,

            validAppointmentId,

            chief,

            diag,

            combinedInstructions || null,

            follow_up_date || null,

            followUpDays,

            patient_notes || null

          ]

        },

        {

          sql: `INSERT INTO prescriptions (patient_id, doctor_id, clinic_id, appointment_id, diagnosis, advice)

                VALUES (?, ?, ?, ?, ?, ?)`,

          params: [patient_id, finalDoctorId, clinicId, validAppointmentId, diag, combinedInstructions || null]

        }

      ];



      let lastErr;

      for (const a of attempts) {

        try {

          const [r] = await db.execute(a.sql, a.params);

          return r;

        } catch (e) {

          lastErr = e;

          const msg = String(e?.message || '').toLowerCase();

          const isUnknownCol = e?.code === 'ER_BAD_FIELD_ERROR' || msg.includes('unknown column');

          if (!isUnknownCol) throw e;

        }

      }

      throw lastErr;

    };



    const rxResult = await insertPrescription();

    const prescriptionId = rxResult.insertId;

    // 5.1) Populate prescription_diagnoses for analytics (parallel)
    if (Array.isArray(diagnosis) && diagnosis.length > 0) {
      await Promise.all(diagnosis.filter(d => typeof d === 'object' && (d.icd_code || d.code)).map(async (d) => {
        try {
          const code = (d.icd_code || d.code || '').toString().trim();
          const title = (d.icd_title || d.title || d.name || '').toString().trim();
          const version = d.version || 'icd10';
          await db.execute(
            `INSERT INTO prescription_diagnoses (prescription_id, icd_code, icd11_code, diagnosis_text, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [prescriptionId, version === 'icd10' ? code : null, version === 'icd11' ? code : null, title]
          );
        } catch (e) { /* ignore single diagnosis insert failure */ }
      }));
    }
    // NOTE: insert sequentially (not Promise.all) so the auto-increment id order
    // matches the order the doctor arranged the meds in. We also write an
    // explicit sort_order (= array index) which every read path already sorts by
    // (`ORDER BY pi.sort_order ASC, pi.id ASC`). Concurrent inserts previously
    // resolved in a non-deterministic order (meds needing a new `medicines` row
    // finished later), so the printed Rx list came out shuffled.
    for (let medIdx = 0; medIdx < medications.length; medIdx++) {
      const med = medications[medIdx];
      const medName = med.medication_name || med.name || med.brand_name || null;
      let medicineId = null;

      // Only look up in medicines table (skip medicines_consolidated — huge FULLTEXT table, too slow)
      if (medName) {
        try {
          const [existing] = await db.execute('SELECT id FROM medicines WHERE name = ? LIMIT 1', [medName]);
          if (existing.length > 0) {
            medicineId = existing[0].id;
          } else {
            try {
              const [newMed] = await db.execute(
                'INSERT INTO medicines (name, generic_name, brand) VALUES (?, ?, ?)',
                [medName, med.generic_name || null, med.brand_name || null]
              );
              medicineId = newMed.insertId;
            } catch (e) {
              if (e?.code === 'ER_BAD_FIELD_ERROR' || String(e?.message || '').toLowerCase().includes('unknown column')) {
                const [newMed2] = await db.execute('INSERT INTO medicines (name) VALUES (?)', [medName]);
                medicineId = newMed2.insertId;
              }
              // If INSERT fails for any other reason, continue with medicineId = null
            }
          }
        } catch (e) { /* ignore lookup errors, proceed without medicineId */ }
      }

      // Insert prescription item
      let itemResult;
      const timingVal = med.timing && typeof med.timing === 'object'
        ? JSON.stringify(med.timing) : (med.timing || '');
      try {
        const [r] = await db.execute(
          `INSERT INTO prescription_items
             (prescription_id, medicine_id, medicine_name, dosage, frequency, duration, timing, quantity, notes, is_tapering, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [prescriptionId, medicineId, medName, med.dosage || '', med.frequency || '',
           med.duration || '', timingVal, med.quantity || 0,
           med.instructions || med.remarks || '', med.is_tapering ? 1 : 0, medIdx]
        );
        itemResult = r;
      } catch (e) {
        // Older schema without a sort_order column — retry with the original set.
        try {
          const [r] = await db.execute(
            `INSERT INTO prescription_items
               (prescription_id, medicine_id, medicine_name, dosage, frequency, duration, timing, quantity, notes, is_tapering)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [prescriptionId, medicineId, medName, med.dosage || '', med.frequency || '',
             med.duration || '', timingVal, med.quantity || 0,
             med.instructions || med.remarks || '', med.is_tapering ? 1 : 0]
          );
          itemResult = r;
        } catch (e2) {
          // Fallback: insert with minimal columns
          const [r] = await db.execute(
            'INSERT INTO prescription_items (prescription_id, medicine_name) VALUES (?, ?)',
            [prescriptionId, medName]
          );
          itemResult = r;
        }
      }

      // Insert tapering steps in parallel
      if (med.is_tapering && Array.isArray(med.tapering_schedule) && med.tapering_schedule.length > 0) {
        await Promise.all(med.tapering_schedule.map((step) =>
          db.execute(
            'INSERT INTO tapering_schedules (prescription_item_id, step_number, dose, frequency, duration_days) VALUES (?, ?, ?, ?, ?)',
            [itemResult.insertId, step.step_number || 1, step.dose || '', step.frequency || '', step.duration_days || 1]
          ).catch(() => {}) // non-blocking
        ));
      }
    }



    // 7) Update appointment notes / reason

    if (appointment_id) {

      // Same unwrap as the `diag`/`chief` values above — diagnosis/symptoms
      // here are the raw request body (picker option objects, or already-
      // stringified JSON from a previous edit), not the sanitized versions,
      // and this write was the actual source of the corrupted
      // appointments.reason_for_visit values found in production.
      const reasonForVisit = diagnosis.length > 0
        ? diagnosis.map(d => (typeof d === 'object' ? (d.icd_title || d.name || d.title) : unwrapJsonText(d)) || '').filter(Boolean).join(', ')
        : null;

      const appointmentNotes = symptoms.length > 0
        ? symptoms.map(s => (typeof s === 'object' ? (s.name || s.symptom_name || s.title) : unwrapJsonText(s)) || '').filter(Boolean).join(', ')
        : null;

      await db.execute(

        `UPDATE appointments

         SET reason_for_visit = COALESCE(?, reason_for_visit),

             notes = COALESCE(?, notes)

         WHERE id = ?`,

        [reasonForVisit, appointmentNotes, appointment_id]

      );

    }



    // 8) visit_advice (non-blocking)

    let nextVisit = null;

    if (follow_up_date) {

      const fd = new Date(follow_up_date);

      nextVisit = Number.isNaN(fd.getTime()) ? null : fd;

    } else if (follow_up_days !== null && follow_up_days !== undefined) {

      const dt = new Date();

      dt.setDate(dt.getDate() + parseInt(follow_up_days, 10));

      nextVisit = dt;

    }

    if (advice || nextVisit) {

      try {

        await db.execute(

          `INSERT INTO visit_advice (patient_id, appointment_id, advice, follow_up_days, next_visit_date, special_instructions)

           VALUES (?, ?, ?, ?, ?, ?)`,

          [

            patient_id,

            validAppointmentId,

            advice || null,

            follow_up_days !== null && follow_up_days !== undefined ? parseInt(follow_up_days, 10) : null,

            nextVisit ? new Date(nextVisit.getTime() - nextVisit.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null,

            null

          ]

        );

      } catch (e) {

        console.warn('visit_advice insert failed (non-blocking):', e.message);

      }

    }



    // 9) appointment_followups (non-blocking)

    if (follow_up_date && validAppointmentId) {

      try {

        await db.execute(

          `INSERT INTO appointment_followups (

             appointment_id, followup_date, reason, status, created_at

           ) VALUES (?, ?, ?, 'pending', NOW())`,

          [validAppointmentId, follow_up_date, 'Follow-up visit']

        );

      } catch (e) {

        console.warn('appointment_followups insert failed (non-blocking):', e.message);

      }

    }



    // 10) Update queue status (non-blocking)

    try {

      await db.execute(

        `UPDATE queue 

         SET status = 'completed', 

             end_time = NOW(),

             completed_at = NOW()

         WHERE patient_id = ? 

         AND doctor_id = ? 

         AND status IN ('waiting', 'called', 'in_progress')

         ORDER BY check_in_time DESC 

         LIMIT 1`,

        [patient_id, finalDoctorId]

      );

    } catch (queueError) {

      console.error('⚠️ Error updating queue status:', queueError);

    }

    // Track diagnoses for "FREQUENTLY seen by you" — fire-and-forget, non-blocking
    if (finalDoctorId && diagnosis && diagnosis.length > 0) {
      Promise.all(diagnosis.map(async (diag) => {
        try {
          let diagName = diag;
          let icdCode = null;
          if (diag && diag.includes(' - ')) {
            const parts = diag.split(' - ');
            diagName = parts[0].trim();
            icdCode = parts[1].trim();
          }
          if (!diagName) return;
          await db.execute(
            `INSERT INTO doctor_diagnoses (doctor_id, diagnosis_name, icd_code, usage_count)
             VALUES (?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE usage_count = usage_count + 1, icd_code = COALESCE(?, icd_code)`,
            [finalDoctorId, diagName, icdCode, icdCode]
          );
        } catch (e) { /* non-blocking, ignore errors */ }
      })).catch(() => {});
    }

    return res.status(201).json({

      id: prescriptionId,

      message: 'Prescription saved successfully',

      doctor_id: finalDoctorId,

      warnings: res.locals.doseWarnings || []

    });

  } catch (error) {

    console.error('Prescription creation error:', error);

    console.error('SQL Error:', error.sqlMessage);

    console.error('SQL State:', error.sqlState);

    console.error('Error code:', error.code);

    console.error('Request body:', req.body);



    return res.status(500).json({

      error: 'Failed to save prescription',

      details: error.message,

      sqlMessage: error.sqlMessage || null,

      sqlState: error.sqlState || null,

      code: error.code || null

    });

  }

}



/**

 * GET /api/prescriptions/detail/:id

 * Full details of a single prescription

 */

async function getPrescription(req, res) {

  try {

    const { id } = req.params;

    const db = getDb();



    const [rows] = await db.execute(

      `SELECT 

         p.*,

         u.name AS doctor_name,

         d.specialization,

         d.qualification,

         pt.name  AS patient_name,

         pt.patient_id,

         pt.gender,

         pt.dob,

         pt.phone

       FROM prescriptions p

       JOIN doctors d ON p.doctor_id = d.id

       JOIN users   u ON d.user_id = u.id

       JOIN patients pt ON p.patient_id = pt.id

       WHERE p.id = ?`,

      [id]

    );



    if (rows.length === 0) {

      return res.status(404).json({ error: 'Prescription not found' });

    }



    const rx = rows[0];



    // Medications

    const [items] = await db.execute(

      `SELECT

         pi.*,

         m.name AS medication_name,

         m.generic_name,

         m.dosage_form

       FROM prescription_items pi

       LEFT JOIN medicines m ON m.id = pi.medicine_id

       WHERE pi.prescription_id = ?`,

      [id]

    );



    // Batch load tapering schedules

    const taperingIds = items.filter(i => i.is_tapering).map(i => i.id);

    let taperingMap = {};

    if (taperingIds.length > 0) {

      const ph = taperingIds.map(() => '?').join(',');

      const [allSteps] = await db.execute(

        `SELECT prescription_item_id, step_number, dose, frequency, duration_days

         FROM tapering_schedules WHERE prescription_item_id IN (${ph})

         ORDER BY step_number ASC`, taperingIds

      );

      for (const step of allSteps) {

        if (!taperingMap[step.prescription_item_id]) taperingMap[step.prescription_item_id] = [];

        taperingMap[step.prescription_item_id].push(step);

      }

    }

    for (const item of items) {

      item.tapering_schedule = item.is_tapering ? (taperingMap[item.id] || []) : [];

    }



    rx.medications = items;



    // Vitals (from appointment, if any)

    if (rx.appointment_id) {

      const [vitals] = await db.execute(

        `SELECT 

           temperature AS temp,

           height_cm  AS height,

           weight_kg  AS weight,

           pulse,

           spo2,

           blood_pressure

         FROM patient_vitals

         WHERE appointment_id = ?

         ORDER BY recorded_at DESC

         LIMIT 1`,

        [rx.appointment_id]

      );

      rx.vitals = vitals[0] || {};

    } else {

      rx.vitals = {};

    }



    res.json(rx);

  } catch (error) {

    // Error handled by global handler

    res.status(500).json({ error: 'Failed to fetch prescription' });

  }

}



/**

 * GET /api/prescriptions/view/:id

 * Public JSON view for shared links (no auth)

 */

async function getPublicPrescriptionView(req, res) {

  try {

    const { id } = req.params;

    const db = getDb();



    const [rows] = await db.execute(

      `SELECT 

         p.id,

         p.patient_id,

         p.doctor_id,

         p.appointment_id,

         p.chief_complaint,

         p.diagnosis,

         p.advice,

         p.follow_up_days,

         p.follow_up_date,

         p.patient_notes,

         p.prescribed_date,

         p.created_at,

         u.name AS doctor_name,

         d.specialization,

         pt.name AS patient_name,

         pt.patient_id AS uhid,

         pt.gender,

         pt.dob,

         pt.phone AS patient_phone,

         c.name AS clinic_name,

         c.address AS clinic_address,

         c.phone AS clinic_phone,

         c.email AS clinic_email

       FROM prescriptions p

       LEFT JOIN doctors d ON p.doctor_id = d.id

       LEFT JOIN users u ON d.user_id = u.id

       LEFT JOIN patients pt ON p.patient_id = pt.id

       LEFT JOIN clinics c ON p.clinic_id = c.id

       WHERE p.id = ?

       LIMIT 1`,

      [id]

    );



    if (rows.length === 0) {

      return res.status(404).json({ success: false, error: 'Prescription not found' });

    }



    const rx = rows[0];



    const [items] = await db.execute(

      `SELECT

         pi.id,

         pi.medicine_name,

         pi.dosage,

         pi.frequency,

         pi.duration,

         pi.timing,

         pi.quantity,

         pi.notes AS instructions,

         pi.is_tapering

       FROM prescription_items pi

       WHERE pi.prescription_id = ?

       ORDER BY pi.sort_order ASC, pi.id ASC`,

      [id]

    );



    const taperingIds = items.filter(i => i.is_tapering).map(i => i.id);

    if (taperingIds.length > 0) {

      const ph = taperingIds.map(() => '?').join(',');

      const [steps] = await db.execute(

        `SELECT prescription_item_id, step_number, dose, frequency, duration_days

         FROM tapering_schedules

         WHERE prescription_item_id IN (${ph})

         ORDER BY step_number ASC`,

        taperingIds

      );

      const byItem = {};

      for (const s of steps) {

        if (!byItem[s.prescription_item_id]) byItem[s.prescription_item_id] = [];

        byItem[s.prescription_item_id].push(s);

      }

      for (const item of items) {

        item.tapering_schedule = item.is_tapering ? (byItem[item.id] || []) : [];

      }

    } else {

      for (const item of items) {

        item.tapering_schedule = [];

      }

    }



    rx.medicines = items;



    return res.json({ success: true, prescription: rx });

  } catch (error) {

    console.error('Public prescription view error:', error);

    return res.status(500).json({ success: false, error: 'Failed to load prescription' });

  }

}



/**

 * DELETE /api/prescriptions/detail/:id

 * Authenticated delete for prescriptions list page

 */

async function deletePrescription(req, res) {

  try {

    const { id } = req.params;

    const db = getDb();



    // Remove child rows first

    await db.execute('DELETE FROM tapering_schedules WHERE prescription_item_id IN (SELECT id FROM prescription_items WHERE prescription_id = ?)', [id]);

    await db.execute('DELETE FROM prescription_items WHERE prescription_id = ?', [id]);

    await db.execute('DELETE FROM prescription_diagnoses WHERE prescription_id = ?', [id]);



    const [result] = await db.execute('DELETE FROM prescriptions WHERE id = ?', [id]);

    if (!result || result.affectedRows === 0) {

      return res.status(404).json({ error: 'Prescription not found' });

    }

    return res.json({ success: true, deleted: true });

  } catch (error) {

    console.error('Delete prescription error:', error);

    return res.status(500).json({ error: 'Failed to delete prescription' });

  }

}



/**

 * GET /api/prescriptions/:prescriptionId/pdf

 * Generate prescription PDF

 */

async function generatePrescriptionPDF(req, res) {

  try {

    const { prescriptionId } = req.params;

    const db = getDb();



    const [rows] = await db.execute(

      `SELECT 

         p.*,

         u.name AS doctor_name,

         d.specialization,

         d.qualification,

         d.license_number,

         d.experience_years,

         c.name  AS clinic_name,

         c.address,

         c.city,

         c.state,

         c.pincode,

         c.phone,

         c.email,

         pt.name AS patient_name,

         pt.patient_id,

         pt.dob AS date_of_birth,

         pt.gender,

         pt.phone AS patient_phone

       FROM prescriptions p

       JOIN doctors d ON p.doctor_id = d.id

       JOIN users   u ON d.user_id = u.id

       LEFT JOIN clinics c ON d.clinic_id = c.id

       JOIN patients pt ON p.patient_id = pt.id

       WHERE p.id = ?`,

      [prescriptionId]

    );



    if (rows.length === 0) {

      return res.status(404).json({ error: 'Prescription not found' });

    }



    const prescription = rows[0];



    // Medications

    const [medications] = await db.execute(

      `SELECT 

         pi.*,

         m.name AS medication_name,

         m.generic_name,

         m.dosage_form

       FROM prescription_items pi

       LEFT JOIN medicines m ON m.id = pi.medicine_id

       WHERE pi.prescription_id = ?

       ORDER BY pi.sort_order ASC, pi.id ASC`,

      [prescriptionId]

    );



    // Vitals

    let vitals = {};

    if (prescription.appointment_id) {

      const [vitalsRows] = await db.execute(

        `SELECT 

           temperature AS temp,

           height_cm AS height,

           weight_kg AS weight,

           pulse,

           spo2,

           blood_pressure

         FROM patient_vitals

         WHERE appointment_id = ?

         ORDER BY recorded_at DESC

         LIMIT 1`,

        [prescription.appointment_id]

      );

      vitals = vitalsRows[0] || {};

    }



    // Advice/follow-up: prefer latest visit_advice if available

    let adviceRow = null;

    if (prescription.appointment_id) {

      const [advRows] = await db.execute(

        `SELECT advice, follow_up_days, next_visit_date, special_instructions

         FROM visit_advice

         WHERE appointment_id = ?

         ORDER BY created_at DESC

         LIMIT 1`,

        [prescription.appointment_id]

      );

      adviceRow = advRows[0] || null;

    }

    if (!adviceRow) {

      const [advRows] = await db.execute(

        `SELECT advice, follow_up_days, next_visit_date, special_instructions

         FROM visit_advice

         WHERE patient_id = ?

         ORDER BY created_at DESC

         LIMIT 1`,

        [prescription.patient_id]

      );

      adviceRow = advRows[0] || null;

    }



    const adviceText = adviceRow?.advice || prescription.instructions || null;

    const followUpText = adviceRow?.next_visit_date

      ? `Follow up on ${new Date(adviceRow.next_visit_date).toLocaleDateString()}`

      : (prescription.follow_up_date ? `Follow up on ${new Date(prescription.follow_up_date).toLocaleDateString()}` : null);



    const prescriptionData = {

      id: prescription.id,

      vitals,

      symptoms: [],      // if you later store these, fill here

      diagnosis: [],     // same as above

      medications: medications.map(m => ({

        name: m.medication_name || m.name,

        dosage: m.dosage,

        frequency: m.frequency,

        duration: m.duration,

        instructions: m.notes

      })),

      advice: adviceText,

      follow_up: followUpText

    };



    const clinicData = {

      name: prescription.clinic_name || 'Clinic',

      address: prescription.address || '',

      city: prescription.city || '',

      state: prescription.state || '',

      pincode: prescription.pincode || '',

      phone: prescription.phone || '',

      email: prescription.email || ''

    };



    const doctorData = {

      name: prescription.doctor_name,

      specialization: prescription.specialization,

      qualification: prescription.qualification,

      license_number: prescription.license_number,

      experience_years: prescription.experience_years

    };



    const patientData = {

      name: prescription.patient_name,

      patient_id: prescription.patient_id,

      uhid: prescription.patient_id,

      date_of_birth: prescription.date_of_birth,

      gender: prescription.gender,

      phone: prescription.patient_phone

    };



    const pdfBuffer = await pdfService.generatePrescriptionPDF(

      prescriptionData,

      clinicData,

      doctorData,

      patientData

    );



    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(

      'Content-Disposition',

      `inline; filename=prescription-${prescriptionId}.pdf`

    );



    res.send(pdfBuffer);

  } catch (error) {

    // Error handled by global handler

    res.status(500).json({ error: 'Failed to generate prescription PDF' });

  }

}



/**

 * GET /api/prescriptions/patient/:patientId/last

 * Get the last prescription for repeat prescription feature

 */

/**
 * GET /api/prescriptions/patient/:patientId/latest-id
 * Lightweight endpoint for quickly opening latest Rx PDF.
 */
async function getLatestPrescriptionId(req, res) {
  try {
    const { patientId } = req.params;
    const db = getDb();

    const [rows] = await db.execute(
      `SELECT id
       FROM prescriptions
       WHERE patient_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [patientId]
    );

    // Return 200 with id:null (not 404) when the patient simply has no
    // prescription yet. This is a lookup, not a missing resource — returning
    // 404 made the browser log noisy "Failed to load resource: 404" errors on
    // the Queue page for every patient without an Rx. Callers already treat a
    // null id as "no prescription found".
    if (!rows || rows.length === 0) {
      return sendSuccess(res, { id: null }, 'No prescription found');
    }

    return sendSuccess(res, { id: rows[0].id }, 'Latest prescription id fetched');
  } catch (error) {
    console.error('getLatestPrescriptionId error:', error);
    return sendError(res, 'Failed to fetch latest prescription id', 500, error.message);
  }
}

async function getLastPrescription(req, res) {

  try {

    const { patientId } = req.params;

    const db = getDb();



    // Get the most recent prescription with all details

    const [prescriptions] = await db.execute(

      `SELECT

         p.*,

         u.name AS doctor_name,

         d.specialization,

         d.qualification,

         pt.name AS patient_name,

         pt.patient_id,

         pt.gender,

         pt.dob,

         pt.phone

       FROM prescriptions p

       JOIN doctors d ON p.doctor_id = d.id

       JOIN users u ON d.user_id = u.id

       JOIN patients pt ON p.patient_id = pt.id

       WHERE p.patient_id = ?

       ORDER BY p.created_at DESC

       LIMIT 1`,

      [patientId]

    );



    if (prescriptions.length === 0) {

      return res.status(404).json({

        message: 'No previous prescriptions found for this patient'

      });

    }



    const prescription = prescriptions[0];



    // Get all medications for this prescription

    const [medications] = await db.execute(

      `SELECT

         pi.*,

         m.name AS medication_name,

         m.generic_name,

         m.dosage_form,

         m.brand AS brand_name

       FROM prescription_items pi

       LEFT JOIN medicines m ON m.id = pi.medicine_id

       WHERE pi.prescription_id = ?`,

      [prescription.id]

    );



    // Batch load tapering schedules

    const lastRxTaperingIds = medications.filter(m => m.is_tapering).map(m => m.id);

    let lastRxTaperingMap = {};

    if (lastRxTaperingIds.length > 0) {

      const ph = lastRxTaperingIds.map(() => '?').join(',');

      const [allSteps] = await db.execute(

        `SELECT prescription_item_id, step_number, dose, frequency, duration_days

         FROM tapering_schedules WHERE prescription_item_id IN (${ph})

         ORDER BY step_number ASC`, lastRxTaperingIds

      );

      for (const step of allSteps) {

        if (!lastRxTaperingMap[step.prescription_item_id]) lastRxTaperingMap[step.prescription_item_id] = [];

        lastRxTaperingMap[step.prescription_item_id].push(step);

      }

    }

    for (const med of medications) {

      med.tapering_schedule = med.is_tapering ? (lastRxTaperingMap[med.id] || []) : [];

    }



    prescription.medications = medications.map(med => ({

      medication_name: med.medication_name,

      generic_name: med.generic_name,

      brand_name: med.brand_name,

      dosage: med.dosage,

      frequency: med.frequency,

      timing: med.timing || '',

      duration: med.duration,

      instructions: med.notes,

      is_tapering: med.is_tapering || 0,

      tapering_schedule: med.tapering_schedule || []

    }));



    // Get vitals if available

    if (prescription.appointment_id) {

      const [vitals] = await db.execute(

        `SELECT

           temperature AS temp,

           height_cm AS height,

           weight_kg AS weight,

           pulse,

           spo2,

           blood_pressure

         FROM patient_vitals

         WHERE appointment_id = ?

         ORDER BY recorded_at DESC

         LIMIT 1`,

        [prescription.appointment_id]

      );

      prescription.vitals = vitals[0] || {};

    } else {

      prescription.vitals = {};

    }



    res.json({

      success: true,

      prescription: prescription,

      message: 'Last prescription retrieved successfully'

    });



  } catch (error) {

    // Error handled by global handler

    res.status(500).json({

      error: 'Failed to fetch last prescription',

      details: error.message

    });

  }

}



/**

 * GET /api/prescriptions/detail/:id/diagnoses

 * List ICD diagnoses associated with a prescription

 */

async function getPrescriptionDiagnoses(req, res) {

  try {

    const { id } = req.params;

    const db = getDb();

    const [rows] = await db.execute(

      `SELECT id, icd_code, icd_title, created_at

       FROM prescription_diagnoses

       WHERE prescription_id = ?

       ORDER BY created_at ASC`,

      [id]

    );

    res.json({ success: true, diagnoses: rows });

  } catch (error) {

    // Error handled by global handler

    res.status(500).json({ success: false, error: 'Failed to fetch prescription diagnoses' });

  }

}



/**

 * POST /api/prescriptions/detail/:id/diagnoses

 * Replace-set ICD diagnoses for a prescription

 * Body: [{ icd_code, icd_title }]

 */

async function savePrescriptionDiagnoses(req, res) {

  try {

    const { id } = req.params;

    const diagnoses = Array.isArray(req.body) ? req.body : req.body?.diagnoses;

    if (!Array.isArray(diagnoses)) {

      return res.status(400).json({ success: false, error: 'diagnoses array is required' });

    }



    const db = getDb();

    await db.execute('DELETE FROM prescription_diagnoses WHERE prescription_id = ?', [id]);



    for (const d of diagnoses) {

      const code = (d.icd_code || d.code || '').toString().trim();

      const title = (d.icd_title || d.title || '').toString().trim();

      const version = d.version || 'icd10';

      

      if (!code || !title) continue;

      

      // Insert with support for both ICD-10 and ICD-11 codes

      await db.execute(

        `INSERT INTO prescription_diagnoses (prescription_id, icd_code, icd11_code, diagnosis_text, created_at)

         VALUES (?, ?, ?, ?, NOW())`,

        [

          id, 

          version === 'icd10' ? code : null,

          version === 'icd11' ? code : null,

          title

        ]

      );

    }



    res.json({ success: true, message: 'Diagnoses saved' });

  } catch (error) {

    // Error handled by global handler

    res.status(500).json({ success: false, error: 'Failed to save prescription diagnoses' });

  }

}



/**

 * POST /api/prescriptions/:prescriptionId/add-medications

 * Add medications from suggestions to an existing prescription

 */

async function addMedicationsToPrescription(req, res) {

  try {

    const { prescriptionId } = req.params;

    const { medications = [] } = req.body;



    if (!medications || medications.length === 0) {

      return res.status(400).json({ error: 'Medications array is required' });

    }



    const db = getDb();



    // Verify prescription exists

    const [rxRows] = await db.execute(

      'SELECT id, patient_id FROM prescriptions WHERE id = ? LIMIT 1',

      [prescriptionId]

    );



    if (rxRows.length === 0) {

      return res.status(404).json({ error: 'Prescription not found' });

    }



    const patientId = rxRows[0].patient_id;



    // Add all medications

    const addedMeds = [];

    for (const med of medications) {

      const medName = med.medication_name || med.name || med.brand_name || null;

      if (!medName) continue;



      let medicineId = null;



      // Check if medicine exists in consolidated table first (has all Indian brands)

      let [existing] = await db.execute(

        'SELECT id FROM medicines_consolidated WHERE LOWER(name) = LOWER(?) LIMIT 1',

        [medName]

      );



      if (existing.length > 0) {

        medicineId = existing[0].id;

      } else {

        // Check in regular medicines table

        [existing] = await db.execute(

          'SELECT id FROM medicines WHERE LOWER(name) = LOWER(?) LIMIT 1',

          [medName]

        );



        if (existing.length > 0) {

          medicineId = existing[0].id;

        } else {

          // Create new medicine in regular medicines table

          const [newMed] = await db.execute(

            `INSERT INTO medicines (name, generic_name, brand, dosage_form, strength, is_active)

             VALUES (?, ?, ?, ?, ?, 1)`,

            [

              medName,

              med.composition || med.generic_name || null,

              med.brand_name || null,

              med.form || med.dosage_form || null,

              med.strength || null

            ]

          );

          medicineId = newMed.insertId;

        }

      }



      // Insert prescription item

      await db.execute(

        `INSERT INTO prescription_items (

           prescription_id, medicine_id, dosage, frequency, duration, notes

         ) VALUES (?, ?, ?, ?, ?, ?)`,

        [

          prescriptionId,

          medicineId,

          med.adjusted_dosage || med.standard_dosage || med.dosage || '',

          med.recommended_frequency || med.frequency || '',

          med.recommended_duration || med.duration || '',

          med.instructions || med.remarks || med.indication || ''

        ]

      );



      addedMeds.push({

        name: medName,

        medicine_id: medicineId,

        dosage: med.adjusted_dosage || med.standard_dosage || med.dosage,

        frequency: med.recommended_frequency || med.frequency,

        duration: med.recommended_duration || med.duration

      });

    }



    res.status(200).json({

      message: `${addedMeds.length} medication(s) added successfully`,

      added_count: addedMeds.length,

      medications: addedMeds

    });

  } catch (error) {

    // Error handled by global handler

    res.status(500).json({

      error: 'Failed to add medications',

      details: error.message

    });

  }

}



/**

 * GET /prescriptions

 * Collection search (date range + optional filters)

 */

async function searchPrescriptions(req, res) {

  try {

    const {

      start_date,

      end_date,

      status,

      patient_id,

      q,

      page = 1,

      limit = 20

    } = req.query;



    const db = getDb();

    const params = [];

    const where = [];



    // Patient ID filter (for queue actions)

    if (patient_id) {

      where.push('p.patient_id = ?');

      params.push(patient_id);

    }



    // Date range filter

    if (start_date && end_date) {

      where.push('p.prescribed_date BETWEEN ? AND ?');

      params.push(start_date, end_date);

    }



    if (status) {

      where.push('p.status = ?');

      params.push(status);

    }



    if (q) {

      where.push('(pt.name LIKE ? OR pt.patient_id LIKE ? OR u.name LIKE ?)');

      const like = `%${q}%`;

      params.push(like, like, like);

    }



    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';



    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const off = (pageNum - 1) * lim;



    const [prescriptions] = await db.execute(

      `SELECT p.id, p.patient_id, p.doctor_id, p.prescribed_date, p.status,

              p.chief_complaint, p.diagnosis, p.advice,

              pt.name AS patient_name, pt.patient_id AS uhid,

              u.name AS doctor_name

       FROM prescriptions p

       LEFT JOIN patients pt ON p.patient_id = pt.id

       LEFT JOIN doctors d ON p.doctor_id = d.id

       LEFT JOIN users u ON d.user_id = u.id

       ${whereSql}

       ORDER BY p.created_at DESC

       LIMIT ${lim} OFFSET ${off}`,

      params

    );



    const countParams = [...params];

    const [countResult] = await db.execute(

      `SELECT COUNT(*) as total FROM prescriptions p

       LEFT JOIN patients pt ON p.patient_id = pt.id

       LEFT JOIN doctors d ON p.doctor_id = d.id

       LEFT JOIN users u ON d.user_id = u.id

       ${whereSql}`,

      countParams

    );

    const total = countResult[0].total;



    sendSuccess(res, {

      prescriptions,

      pagination: { page: pageNum, limit: lim, total, pages: Math.ceil(total / lim) }

    }, 'Prescriptions retrieved successfully');

  } catch (error) {

    console.error('Prescriptions search error:', error);

    sendError(res, 'Failed to fetch prescriptions', 500, error.message);

  }

}



/**

 * POST /api/prescriptions/end-visit

 * End patient visit without creating prescription (updates queue status)

 */

async function endVisit(req, res) {

  try {

    const { patient_id, doctor_id, notes } = req.body;



    if (!patient_id || !doctor_id) {

      return res.status(400).json({ error: 'Patient ID and Doctor ID are required' });

    }



    const db = getDb();

    

    // Update queue status to 'completed' and set end_time

    const [queueUpdate] = await db.execute(

      `UPDATE queue 

       SET status = 'completed', 

           end_time = NOW(),

           completed_at = NOW(),

           notes = COALESCE(?, notes)

       WHERE patient_id = ? 

       AND doctor_id = ? 

       AND status IN ('waiting', 'called', 'in_progress')

       ORDER BY check_in_time DESC 

       LIMIT 1`,

      [notes, patient_id, doctor_id]

    );

    

    if (queueUpdate.affectedRows > 0) {

      res.json({ 

        message: 'Visit ended successfully',

        patient_id,

        doctor_id

      });

    } else {

      res.status(404).json({ 

        error: 'No active visit found for this patient',

        patient_id

      });

    }

    

  } catch (error) {

    console.error('End visit error:', error);

    res.status(500).json({ 

      error: 'Failed to end visit',

      details: error.message

    });

  }

}



// Dashboard helper: recent prescriptions count (today by default)

async function getRecentPrescriptionsCount(req, res) {

  try {

    const db = getDb();

    const doctorId = req.user?.role === 'doctor' ? (req.user?.doctor_id || null) : null;

    const clinicId = req.user?.clinic_id || null;



    const where = ['DATE(p.created_at) = CURDATE()'];

    const params = [];



    if (doctorId) {

      where.push('p.doctor_id = ?');

      params.push(doctorId);

    } else if (clinicId) {

      where.push('p.clinic_id = ?');

      params.push(clinicId);

    }



    const [rows] = await db.execute(

      `SELECT COUNT(*) AS count FROM prescriptions p WHERE ${where.join(' AND ')}`,

      params

    );



    return res.json({ count: parseInt(rows[0]?.count || 0, 10) });

  } catch (error) {

    console.error('getRecentPrescriptionsCount error:', error);

    return res.status(500).json({ error: 'Failed to fetch recent prescriptions' });

  }

}



module.exports = {
  ...require('./prescriptionController_refactored'),
  // Override with original full implementations
  addPrescription,
  createPrescription: addPrescription,
  listPrescriptions,
  getPrescription,
  getPrescriptionById: getPrescription,
  getPublicPrescriptionView,
  deletePrescription,
  generatePrescriptionPDF,
  getLatestPrescriptionId,
  getLastPrescription,
  getPrescriptionDiagnoses,
  savePrescriptionDiagnoses,
  addMedicationsToPrescription,
  searchPrescriptions,
  endVisit,
  getRecentPrescriptionsCount,
  sharePrescription,
  getShareOptions,
};