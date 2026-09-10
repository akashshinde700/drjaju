const { getDb } = require('../config/db');

/**
 * Get all referrals
 */
async function getAllReferrals(req, res) {
  try {
    const db = getDb();
    const userId = req.user?.id;
    const userRole = req.user?.role;

    let query = `
      SELECT pr.*,
             p.name as patient_name, p.patient_id as uhid, p.phone as patient_phone,
             p.age_years as patient_age, p.gender as patient_gender,
             u1.name as referring_doctor_name,
             u2.name as referred_to_doctor_name
      FROM patient_referrals pr
      LEFT JOIN patients p ON pr.patient_id = p.id
      LEFT JOIN users u1 ON pr.referring_doctor_id = u1.id
      LEFT JOIN users u2 ON pr.referred_to_doctor_id = u2.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by patient_id if provided
    if (req.query.patient_id) {
      query += ` AND pr.patient_id = ?`;
      params.push(req.query.patient_id);
    }

    // Filter by doctor
    if (userRole === 'doctor') {
      query += ` AND pr.referring_doctor_id = ?`;
      params.push(userId);
    }

    query += ` ORDER BY pr.referral_date DESC, pr.created_at DESC`;

    const [referrals] = await db.execute(query, params);

    res.json({
      success: true,
      referrals
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch referrals'
    });
  }
}

/**
 * Get referral by ID
 */
async function getReferralById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [referrals] = await db.execute(`
      SELECT pr.*,
             p.name as patient_name, p.patient_id as uhid, p.phone as patient_phone, p.age_years as age, p.gender,
             u1.name as referring_doctor_name,
             u2.name as referred_to_doctor_name
      FROM patient_referrals pr
      LEFT JOIN patients p ON pr.patient_id = p.id
      LEFT JOIN users u1 ON pr.referring_doctor_id = u1.id
      LEFT JOIN users u2 ON pr.referred_to_doctor_id = u2.id
      WHERE pr.id = ?
    `, [id]);

    if (referrals.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Referral not found'
      });
    }

    res.json({
      success: true,
      referral: referrals[0]
    });
  } catch (error) {
    console.error('Get referral by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch referral'
    });
  }
}

/**
 * Create referral
 */
async function createReferral(req, res) {
  try {
    const {
      patient_id,
      referred_to_doctor_id,
      referred_doctor_name,
      referred_doctor_phone,
      referred_doctor_email,
      referred_doctor_specialization,
      hospital_name,
      referral_date,
      referral_time,
      reason,
      priority,
      notes
    } = req.body;

    if (!patient_id || !referral_date) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID and referral date are required'
      });
    }

    if (!referred_to_doctor_id && !referred_doctor_name) {
      return res.status(400).json({
        success: false,
        error: 'Either referred doctor ID or name is required'
      });
    }

    const db = getDb();
    const userId = req.user?.id;

    const [result] = await db.execute(`
      INSERT INTO patient_referrals
      (patient_id, referring_doctor_id, referred_to_doctor_id, referred_doctor_name,
       referred_doctor_phone, referred_doctor_email, referred_doctor_specialization,
       hospital_name, referral_date, referral_time, reason, priority, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      patient_id,
      userId || null,
      referred_to_doctor_id || null,
      referred_doctor_name || null,
      referred_doctor_phone || null,
      referred_doctor_email || null,
      referred_doctor_specialization || null,
      hospital_name || null,
      referral_date,
      referral_time || null,
      reason || null,
      priority || 'routine',
      notes || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Referral created successfully',
      referral_id: result.insertId
    });
  } catch (error) {
    console.error('Create referral error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create referral'
    });
  }
}

/**
 * Update referral
 */
async function updateReferral(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const db = getDb();

    // Check if exists
    const [existing] = await db.execute('SELECT * FROM patient_referrals WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Referral not found'
      });
    }

    const updateFields = [];
    const values = [];

    const allowedFields = [
      'referred_doctor_name', 'referred_doctor_phone', 'referred_doctor_email',
      'referred_doctor_specialization', 'hospital_name', 'referral_date',
      'referral_time', 'reason', 'priority', 'status', 'notes', 'outcome'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(id);

    await db.execute(`
      UPDATE patient_referrals
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);

    res.json({
      success: true,
      message: 'Referral updated successfully'
    });
  } catch (error) {
    console.error('Update referral error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update referral'
    });
  }
}

/**
 * Delete referral
 */
async function deleteReferral(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    await db.execute('DELETE FROM patient_referrals WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Referral deleted successfully'
    });
  } catch (error) {
    console.error('Delete referral error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete referral'
    });
  }
}

/**
 * Get referral network for a doctor
 */
async function getReferralNetwork(req, res) {
  try {
    const db = getDb();
    const userId = req.user?.id;

    const [network] = await db.execute(`
      SELECT * FROM referral_network
      WHERE doctor_id = ? AND is_active = 1
      ORDER BY is_preferred DESC, referral_count DESC, network_doctor_name ASC
    `, [userId]);

    res.json({
      success: true,
      network
    });
  } catch (error) {
    console.error('Get referral network error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch referral network'
    });
  }
}

/**
 * Add doctor to referral network
 */
async function addToNetwork(req, res) {
  try {
    const {
      network_doctor_name,
      network_doctor_phone,
      network_doctor_email,
      specialization,
      hospital_name,
      hospital_address,
      city,
      state,
      notes,
      is_preferred
    } = req.body;

    if (!network_doctor_name) {
      return res.status(400).json({
        success: false,
        error: 'Doctor name is required'
      });
    }

    const db = getDb();
    const userId = req.user?.id;

    const [result] = await db.execute(`
      INSERT INTO referral_network
      (doctor_id, network_doctor_name, network_doctor_phone, network_doctor_email,
       specialization, hospital_name, hospital_address, city, state, notes, is_preferred)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      network_doctor_name,
      network_doctor_phone || null,
      network_doctor_email || null,
      specialization || null,
      hospital_name || null,
      hospital_address || null,
      city || null,
      state || null,
      notes || null,
      is_preferred || 0
    ]);

    res.status(201).json({
      success: true,
      message: 'Doctor added to network',
      network_id: result.insertId
    });
  } catch (error) {
    console.error('Add to network error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add to network'
    });
  }
}

/**
 * Update network doctor
 */
async function updateNetworkDoctor(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const db = getDb();

    const updateFields = [];
    const values = [];

    const allowedFields = [
      'network_doctor_name', 'network_doctor_phone', 'network_doctor_email',
      'specialization', 'hospital_name', 'hospital_address', 'city', 'state',
      'notes', 'is_preferred', 'is_active'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(id);

    await db.execute(`
      UPDATE referral_network
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);

    res.json({
      success: true,
      message: 'Network doctor updated'
    });
  } catch (error) {
    console.error('Update network doctor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update network doctor'
    });
  }
}

/**
 * Delete network doctor
 */
async function deleteNetworkDoctor(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    await db.execute('UPDATE referral_network SET is_active = 0 WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Network doctor removed'
    });
  } catch (error) {
    console.error('Delete network doctor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove network doctor'
    });
  }
}

module.exports = require('./patientReferralController_refactored');
