/**
 * Pad Configuration Controller
 * Manages prescription pad settings, field ordering, and customization
 */

const { getDb } = require('../config/db');
const { resolveClinicIdForPatient } = require('../utils/helpers');

/**
 * Get pad configuration for a doctor
 * GET /api/pad-config
 */
async function getPadConfiguration(req, res) {
  try {
    const doctorId = req.user?.id;
    const db = getDb();

    // Get pad configuration
    const [configs] = await db.execute(
      `SELECT * FROM pad_configurations WHERE doctor_id = ?`,
      [doctorId]
    );

    // Get rx template configs
    const [templateConfigs] = await db.execute(
      `SELECT * FROM rx_template_config WHERE doctor_id = ? AND is_active = 1`,
      [doctorId]
    );

    if (configs.length === 0) {
      // Return default configuration if none exists
      return res.json({
        success: true,
        config: {
          doctor_id: doctorId,
          default_font_size: 12,
          default_font_family: 'Arial',
          signature_image_url: null,
          clinic_name: null,
          clinic_details: null,
          header_content: null,
          footer_content: null,
          field_order: getDefaultFieldOrder(),
          sections: getDefaultSections()
        },
        templateConfigs: templateConfigs
      });
    }

    // Parse any JSON fields if needed
    const config = configs[0];

    res.json({
      success: true,
      config,
      templateConfigs
    });

  } catch (error) {
    console.error('Get pad configuration error:', error);
    res.status(500).json({
      error: 'Failed to fetch pad configuration',
      details: error.message
    });
  }
}

/**
 * Save/Update pad configuration
 * POST /api/pad-config
 */
async function savePadConfiguration(req, res) {
  try {
    const doctorId = req.user?.id;
    const {
      default_font_size,
      default_font_family,
      signature_image_url,
      clinic_name,
      clinic_details,
      header_content,
      footer_content,
      header_image,
      footer_image,
      field_order,
      sections
    } = req.body;

    const db = getDb();

    // Check if config exists
    const [existing] = await db.execute(
      `SELECT id FROM pad_configurations WHERE doctor_id = ?`,
      [doctorId]
    );

    if (existing.length > 0) {
      // Update existing
      await db.execute(
        `UPDATE pad_configurations SET
          default_font_size = ?,
          default_font_family = ?,
          signature_image_url = ?,
          clinic_name = ?,
          clinic_details = ?,
          header_content = ?,
          footer_content = ?,
          header_image = ?,
          footer_image = ?,
          updated_at = NOW()
        WHERE doctor_id = ?`,
        [
          default_font_size || 12,
          default_font_family || 'Arial',
          signature_image_url || null,
          clinic_name || null,
          clinic_details || null,
          header_content || null,
          footer_content || null,
          header_image || null,
          footer_image || null,
          doctorId
        ]
      );
    } else {
      // Insert new
      await db.execute(
        `INSERT INTO pad_configurations
          (doctor_id, default_font_size, default_font_family, signature_image_url, clinic_name, clinic_details, header_content, footer_content, header_image, footer_image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doctorId,
          default_font_size || 12,
          default_font_family || 'Arial',
          signature_image_url || null,
          clinic_name || null,
          clinic_details || null,
          header_content || null,
          footer_content || null,
          header_image || null,
          footer_image || null
        ]
      );
    }

    // Save field order and sections to rx_template_config if provided
    if (field_order || sections) {
      const templateContent = JSON.stringify({ field_order, sections });

      // Check if default layout config exists
      const [existingTemplate] = await db.execute(
        `SELECT id FROM rx_template_config WHERE doctor_id = ? AND template_type = 'layout' AND is_default = 1`,
        [doctorId]
      );

      if (existingTemplate.length > 0) {
        await db.execute(
          `UPDATE rx_template_config SET content = ?, updated_at = NOW() WHERE id = ?`,
          [templateContent, existingTemplate[0].id]
        );
      } else {
        await db.execute(
          `INSERT INTO rx_template_config (doctor_id, template_name, template_type, content, is_default, is_active)
           VALUES (?, 'Default Layout', 'layout', ?, 1, 1)`,
          [doctorId, templateContent]
        );
      }
    }

    res.json({
      success: true,
      message: 'Pad configuration saved successfully'
    });

  } catch (error) {
    console.error('Save pad configuration error:', error);
    res.status(500).json({
      error: 'Failed to save pad configuration',
      details: error.message
    });
  }
}

/**
 * Save field order configuration
 * POST /api/pad-config/field-order
 */
async function saveFieldOrder(req, res) {
  try {
    const doctorId = req.user?.id;
    const { field_order, sections } = req.body;

    if (!field_order && !sections) {
      return res.status(400).json({ error: 'field_order or sections is required' });
    }

    const db = getDb();
    const templateContent = JSON.stringify({ field_order, sections });

    // Check if layout config exists
    const [existing] = await db.execute(
      `SELECT id FROM rx_template_config WHERE doctor_id = ? AND template_type = 'layout' AND is_default = 1`,
      [doctorId]
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE rx_template_config SET content = ?, updated_at = NOW() WHERE id = ?`,
        [templateContent, existing[0].id]
      );
    } else {
      await db.execute(
        `INSERT INTO rx_template_config (doctor_id, template_name, template_type, content, is_default, is_active)
         VALUES (?, 'Default Layout', 'layout', ?, 1, 1)`,
        [doctorId, templateContent]
      );
    }

    res.json({
      success: true,
      message: 'Field order saved successfully'
    });

  } catch (error) {
    console.error('Save field order error:', error);
    res.status(500).json({
      error: 'Failed to save field order',
      details: error.message
    });
  }
}

/**
 * Get patient medical history summary for prescription pad
 * GET /api/pad-config/patient-history/:patientId
 */
async function getPatientHistoryForPad(req, res) {
  try {
    const { patientId } = req.params;
    const db = getDb();

    // Fetch all medical history in parallel
    const [
      [chronicConditions],
      [allergies],
      [familyHistory],
      [surgicalHistory],
      [recentVitals],
      [recentPrescriptions]
    ] = await Promise.all([
      // Chronic conditions
      db.execute(
        `SELECT id, condition_name, icd_code, status, start_date, notes
         FROM patient_chronic_conditions
         WHERE patient_id = ? AND status = 'Active'
         ORDER BY created_at DESC`,
        [patientId]
      ),
      // Allergies
      db.execute(
        `SELECT id, category, allergen_name, severity, reaction, snomed_id
         FROM patient_allergies
         WHERE patient_id = ? AND is_active = 1
         ORDER BY severity DESC`,
        [patientId]
      ),
      // Family history
      db.execute(
        `SELECT id, relation, condition_name, icd_code
         FROM family_history
         WHERE patient_id = ?
         ORDER BY created_at DESC`,
        [patientId]
      ),
      // Surgical history
      db.execute(
        `SELECT id, surgery_name, surgery_date, hospital, surgeon, complications
         FROM patient_surgical_history
         WHERE patient_id = ?
         ORDER BY surgery_date DESC`,
        [patientId]
      ),
      // Recent vitals
      db.execute(
        `SELECT temperature, height_cm, weight_kg, bmi, pulse, spo2, blood_pressure, recorded_at
         FROM patient_vitals
         WHERE patient_id = ?
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [patientId]
      ),
      // Recent prescriptions (last 5)
      db.execute(
        `SELECT p.id, p.diagnosis, p.chief_complaint, p.created_at, u.name as doctor_name
         FROM prescriptions p
         LEFT JOIN doctors d ON p.doctor_id = d.id
         LEFT JOIN users u ON d.user_id = u.id
         WHERE p.patient_id = ?
         ORDER BY p.created_at DESC
         LIMIT 5`,
        [patientId]
      )
    ]);

    res.json({
      success: true,
      patientHistory: {
        chronicConditions,
        allergies,
        familyHistory,
        surgicalHistory,
        recentVitals: recentVitals[0] || null,
        recentPrescriptions
      }
    });

  } catch (error) {
    console.error('Get patient history error:', error);
    res.status(500).json({
      error: 'Failed to fetch patient history',
      details: error.message
    });
  }
}

/**
 * Add chronic condition
 * POST /api/pad-config/chronic-condition/:patientId
 */
async function addChronicCondition(req, res) {
  try {
    const { patientId } = req.params;
    const { condition_name, icd_code, snomed_id, start_date, notes } = req.body;

    if (!condition_name) {
      return res.status(400).json({ error: 'Condition name is required' });
    }

    const db = getDb();

    const clinicId = await resolveClinicIdForPatient(db, patientId, req.user?.clinic_id);
    if (!clinicId) {
      return res.status(400).json({
        error: 'Cannot add condition: clinic is not set for this patient or your account.',
      });
    }

    let safeIcd = null;
    if (icd_code) {
      const [icdRows] = await db.execute('SELECT icd_code FROM icd_codes WHERE icd_code = ? LIMIT 1', [icd_code]);
      if (icdRows.length > 0) safeIcd = icd_code;
    }
    let safeSnomed = null;
    if (snomed_id) {
      const [sRows] = await db.execute('SELECT snomed_id FROM snomed_concepts WHERE snomed_id = ? LIMIT 1', [snomed_id]);
      if (sRows.length > 0) safeSnomed = snomed_id;
    }

    const [result] = await db.execute(
      `INSERT INTO patient_chronic_conditions
        (patient_id, clinic_id, condition_name, icd_code, snomed_id, start_date, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [patientId, clinicId, condition_name, safeIcd, safeSnomed, start_date || null, notes || null]
    );

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Chronic condition added successfully'
    });

  } catch (error) {
    console.error('Add chronic condition error:', error);
    res.status(500).json({
      error: 'Failed to add chronic condition',
      details: error.message
    });
  }
}

/**
 * Add surgical history
 * POST /api/pad-config/surgical-history/:patientId
 */
async function addSurgicalHistory(req, res) {
  try {
    const { patientId } = req.params;
    const { surgery_name, surgery_date, hospital, surgeon, complications } = req.body;

    if (!surgery_name) {
      return res.status(400).json({ error: 'Surgery name is required' });
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO patient_surgical_history
        (patient_id, surgery_name, surgery_date, hospital, surgeon, complications)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patientId, surgery_name, surgery_date || null, hospital || null, surgeon || null, complications || null]
    );

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: 'Surgical history added successfully'
    });

  } catch (error) {
    console.error('Add surgical history error:', error);
    res.status(500).json({
      error: 'Failed to add surgical history',
      details: error.message
    });
  }
}

/**
 * Default field order for prescription pad
 */
function getDefaultFieldOrder() {
  return [
    { id: 'patient_info', label: 'Patient Information', enabled: true, order: 1 },
    { id: 'vitals', label: 'Vitals', enabled: true, order: 2 },
    { id: 'chief_complaint', label: 'Chief Complaint', enabled: true, order: 3 },
    { id: 'history', label: 'Medical History', enabled: true, order: 4 },
    { id: 'diagnosis', label: 'Diagnosis', enabled: true, order: 5 },
    { id: 'medications', label: 'Medications', enabled: true, order: 6 },
    { id: 'injections', label: 'Injections', enabled: true, order: 7 },
    { id: 'investigations', label: 'Investigations', enabled: true, order: 8 },
    { id: 'advice', label: 'Advice', enabled: true, order: 9 },
    { id: 'follow_up', label: 'Follow Up', enabled: true, order: 10 }
  ];
}

/**
 * Default sections configuration
 */
function getDefaultSections() {
  return {
    patient_info: { visible: true, collapsed: false },
    vitals: { visible: true, collapsed: false },
    chief_complaint: { visible: true, collapsed: false },
    history: { visible: true, collapsed: true },
    diagnosis: { visible: true, collapsed: false },
    medications: { visible: true, collapsed: false },
    injections: { visible: true, collapsed: false },
    investigations: { visible: true, collapsed: true },
    advice: { visible: true, collapsed: false },
    follow_up: { visible: true, collapsed: false }
  };
}

/**
 * Print layout (page margins + pre-printed letterhead padding)
 * GET /api/pad-config/print-layout
 *
 * Kept in rx_template_config under its own template_type so it never collides
 * with the 'layout' row that stores field order/sections.
 */
const { BLANK_LETTERHEAD_MM } = require('../services/PdfGeneratorService');

// The page shows these when nothing has been saved yet. contentTop is seeded
// from the band the PDF ALREADY leaves for pre-printed stationery, so pressing
// Save without touching anything cannot silently shrink that band and push the
// patient block up into a pre-printed header.
const PRINT_LAYOUT_DEFAULTS = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
  contentTop: Math.max(0, BLANK_LETTERHEAD_MM - 10),
  contentBottom: 0,
};

function sanitizePrintLayout(input) {
  const out = {};
  for (const key of Object.keys(PRINT_LAYOUT_DEFAULTS)) {
    const n = Number(input?.[key]);
    out[key] = Number.isFinite(n) && n >= 0 && n <= 200 ? Math.round(n) : PRINT_LAYOUT_DEFAULTS[key];
  }
  return out;
}

async function getPrintLayout(req, res) {
  try {
    const doctorId = req.user?.id;
    const db = getDb();
    const [rows] = await db.execute(
      `SELECT content FROM rx_template_config
        WHERE doctor_id = ? AND template_type = 'print_layout' AND is_active = 1
        ORDER BY is_default DESC, id DESC LIMIT 1`,
      [doctorId]
    );

    if (rows.length === 0) {
      return res.json({ success: true, layout: { ...PRINT_LAYOUT_DEFAULTS }, configured: false });
    }

    let parsed = rows[0].content;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { parsed = null; }
    }
    res.json({ success: true, layout: sanitizePrintLayout(parsed), configured: true });
  } catch (error) {
    console.error('Get print layout error:', error);
    res.status(500).json({ error: 'Failed to load print layout', details: error.message });
  }
}

/**
 * POST /api/pad-config/print-layout
 */
async function savePrintLayout(req, res) {
  try {
    const doctorId = req.user?.id;
    if (!doctorId) return res.status(401).json({ error: 'Not authenticated' });

    const layout = sanitizePrintLayout(req.body?.layout || req.body);
    const db = getDb();

    const [existing] = await db.execute(
      `SELECT id FROM rx_template_config
        WHERE doctor_id = ? AND template_type = 'print_layout' AND is_default = 1`,
      [doctorId]
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE rx_template_config SET content = ?, is_active = 1, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(layout), existing[0].id]
      );
    } else {
      await db.execute(
        `INSERT INTO rx_template_config (doctor_id, template_name, template_type, content, is_default, is_active)
         VALUES (?, 'Print Layout', 'print_layout', ?, 1, 1)`,
        [doctorId, JSON.stringify(layout)]
      );
    }

    res.json({ success: true, layout, message: 'Print layout saved successfully' });
  } catch (error) {
    console.error('Save print layout error:', error);
    res.status(500).json({ error: 'Failed to save print layout', details: error.message });
  }
}

module.exports = {
  getPadConfiguration,
  savePadConfiguration,
  saveFieldOrder,
  getPatientHistoryForPad,
  addChronicCondition,
  addSurgicalHistory,
  getPrintLayout,
  savePrintLayout
};
