const { getDb } = require('../config/db');

/**
 * Get all insurance policies for a patient
 */
async function getPatientInsurance(req, res, next) {
  try {
    const { patientId } = req.params;
    const db = getDb();

    const [policies] = await db.execute(
      `SELECT 
        ip.*,
        p.name as patient_name,
        p.patient_id as patient_uhid
      FROM insurance_policies ip
      JOIN patients p ON ip.patient_id = p.id
      WHERE ip.patient_id = ?
      ORDER BY ip.created_at DESC`,
      [patientId]
    );

    res.json({ policies });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single insurance policy by ID
 */
async function getInsurancePolicy(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [policies] = await db.execute(
      `SELECT 
        ip.*,
        p.name as patient_name,
        p.patient_id as patient_uhid
      FROM insurance_policies ip
      JOIN patients p ON ip.patient_id = p.id
      WHERE ip.id = ?`,
      [id]
    );

    if (policies.length === 0) {
      return res.status(404).json({ error: 'Insurance policy not found' });
    }

    res.json({ policy: policies[0] });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new insurance policy
 */
async function createInsurancePolicy(req, res, next) {
  try {
    const { patient_id, provider, policy_number, coverage_details, valid_till } = req.body;
    const db = getDb();

    if (!patient_id) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    // Verify patient exists
    const [patients] = await db.execute('SELECT id FROM patients WHERE id = ?', [patient_id]);
    if (patients.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const [result] = await db.execute(
      `INSERT INTO insurance_policies 
        (patient_id, provider, policy_number, coverage_details, valid_till)
      VALUES (?, ?, ?, ?, ?)`,
      [patient_id, provider || null, policy_number || null, coverage_details || null, valid_till || null]
    );

    const [newPolicy] = await db.execute(
      `SELECT 
        ip.*,
        p.name as patient_name,
        p.patient_id as patient_uhid
      FROM insurance_policies ip
      JOIN patients p ON ip.patient_id = p.id
      WHERE ip.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ policy: newPolicy[0] });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an insurance policy
 */
async function updateInsurancePolicy(req, res, next) {
  try {
    const { id } = req.params;
    const { provider, policy_number, coverage_details, valid_till } = req.body;
    const db = getDb();

    // Check if policy exists
    const [existing] = await db.execute('SELECT id FROM insurance_policies WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Insurance policy not found' });
    }

    await db.execute(
      `UPDATE insurance_policies 
      SET provider = ?, policy_number = ?, coverage_details = ?, valid_till = ?
      WHERE id = ?`,
      [provider || null, policy_number || null, coverage_details || null, valid_till || null, id]
    );

    const [updated] = await db.execute(
      `SELECT 
        ip.*,
        p.name as patient_name,
        p.patient_id as patient_uhid
      FROM insurance_policies ip
      JOIN patients p ON ip.patient_id = p.id
      WHERE ip.id = ?`,
      [id]
    );

    res.json({ policy: updated[0] });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an insurance policy
 */
async function deleteInsurancePolicy(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Check if policy exists
    const [existing] = await db.execute('SELECT id FROM insurance_policies WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Insurance policy not found' });
    }

    await db.execute('DELETE FROM insurance_policies WHERE id = ?', [id]);

    res.json({ message: 'Insurance policy deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPatientInsurance,
  getInsurancePolicy,
  createInsurancePolicy,
  updateInsurancePolicy,
  deleteInsurancePolicy
};

