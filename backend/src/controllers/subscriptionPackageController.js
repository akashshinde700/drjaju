const { getDb } = require('../config/db');
const { getLocalDateString } = require('../utils/localDate');

/**
 * Get all subscription packages
 */
async function getAllPackages(req, res) {
  try {
    const db = getDb();
    const userId = req.user?.id;
    const userRole = req.user?.role;

    let query = `
      SELECT sp.*,
             c.name as clinic_name,
             u.name as doctor_name,
             (SELECT COUNT(*) FROM patient_subscriptions WHERE package_id = sp.id) as subscribers_count
      FROM subscription_packages sp
      LEFT JOIN clinics c ON sp.clinic_id = c.id
      LEFT JOIN doctors d ON sp.doctor_id = d.user_id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE sp.is_active = 1
    `;

    const params = [];

    // Filter by doctor for non-admin users
    if (userRole === 'doctor') {
      query += ` AND (sp.doctor_id IS NULL OR sp.doctor_id = ?)`;
      params.push(userId);
    }

    query += ` ORDER BY sp.created_at DESC`;

    const [packages] = await db.execute(query, params);

    res.json({
      success: true,
      packages
    });
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch packages'
    });
  }
}

/**
 * Get package by ID with sessions
 */
async function getPackageById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [packages] = await db.execute(`
      SELECT sp.*,
             c.name as clinic_name,
             u.name as doctor_name
      FROM subscription_packages sp
      LEFT JOIN clinics c ON sp.clinic_id = c.id
      LEFT JOIN doctors d ON sp.doctor_id = d.user_id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE sp.id = ?
    `, [id]);

    if (packages.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    // Get sessions for this package
    const [sessions] = await db.execute(`
      SELECT * FROM package_sessions
      WHERE package_id = ?
      ORDER BY session_number ASC
    `, [id]);

    const packageData = {
      ...packages[0],
      sessions
    };

    res.json({
      success: true,
      package: packageData
    });
  } catch (error) {
    console.error('Get package by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch package'
    });
  }
}

/**
 * Create new subscription package
 */
async function createPackage(req, res) {
  try {
    const {
      package_type,
      package_name,
      description,
      num_sessions,
      pricing_model,
      price_per_session,
      total_price,
      validity_days,
      allow_family_members,
      staff_edit_access,
      sessions
    } = req.body;

    // Validation
    if (!package_name || !num_sessions || !total_price || !validity_days) {
      return res.status(400).json({
        success: false,
        error: 'Package name, sessions, price, and validity are required'
      });
    }

    const db = getDb();
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Determine clinic_id and doctor_id
    let clinicId = null;
    let doctorId = null;

    if (userRole === 'doctor') {
      doctorId = userId;
      // Get doctor's clinic
      const [doctors] = await db.execute('SELECT clinic_id FROM doctors WHERE user_id = ?', [userId]);
      if (doctors.length > 0) {
        clinicId = doctors[0].clinic_id;
      }
    } else if (userRole === 'admin') {
      // Admin can create clinic-wide packages
      const [users] = await db.execute('SELECT clinic_id FROM users WHERE id = ?', [userId]);
      if (users.length > 0) {
        clinicId = users[0].clinic_id;
      }
    }

    // Create package
    const [result] = await db.execute(`
      INSERT INTO subscription_packages
      (clinic_id, doctor_id, package_type, package_name, description, num_sessions,
       pricing_model, price_per_session, total_price, validity_days,
       allow_family_members, staff_edit_access)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      clinicId,
      doctorId,
      package_type || 'treatment_plan',
      package_name,
      description,
      num_sessions,
      pricing_model || 'advance',
      price_per_session,
      total_price,
      validity_days,
      allow_family_members || 0,
      staff_edit_access || 1
    ]);

    const packageId = result.insertId;

    // Create sessions if provided
    if (sessions && Array.isArray(sessions) && sessions.length > 0) {
      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        await db.execute(`
          INSERT INTO package_sessions
          (package_id, session_name, session_number, duration_minutes, scheduled_time,
           days_of_week, description, sample_schedule)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          packageId,
          session.session_name,
          session.session_number || (i + 1),
          session.duration_minutes,
          session.scheduled_time,
          JSON.stringify(session.days_of_week || []),
          session.description,
          session.sample_schedule
        ]);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      package_id: packageId
    });
  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create package'
    });
  }
}

/**
 * Update subscription package
 */
async function updatePackage(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const db = getDb();

    // Check if package exists
    const [existing] = await db.execute('SELECT * FROM subscription_packages WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    // Build update query
    const updateFields = [];
    const values = [];

    const allowedFields = [
      'package_type', 'package_name', 'description', 'num_sessions',
      'pricing_model', 'price_per_session', 'total_price', 'validity_days',
      'allow_family_members', 'staff_edit_access', 'is_active'
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
      UPDATE subscription_packages
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, values);

    res.json({
      success: true,
      message: 'Package updated successfully'
    });
  } catch (error) {
    console.error('Update package error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update package'
    });
  }
}

/**
 * Delete package (soft delete)
 */
async function deletePackage(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    await db.execute('UPDATE subscription_packages SET is_active = 0 WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error) {
    console.error('Delete package error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete package'
    });
  }
}

/**
 * Enroll patient in package
 */
async function enrollPatient(req, res) {
  try {
    const {
      patient_id,
      package_id,
      start_date,
      payment_status,
      amount_paid,
      notes
    } = req.body;

    if (!patient_id || !package_id || !start_date) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID, package ID, and start date are required'
      });
    }

    const db = getDb();

    // Get package details
    const [packages] = await db.execute(`
      SELECT * FROM subscription_packages WHERE id = ?
    `, [package_id]);

    if (packages.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    const pkg = packages[0];

    // Calculate end date
    const endDate = new Date(start_date);
    endDate.setDate(endDate.getDate() + pkg.validity_days);

    // Generate subscription code
    const subscriptionCode = `SUB${new Date().getFullYear()}${String(patient_id).padStart(5, '0')}${String(package_id).padStart(3, '0')}`;

    // Calculate amount due
    const amountDue = pkg.total_price - (amount_paid || 0);

    // Create subscription
    const [result] = await db.execute(`
      INSERT INTO patient_subscriptions
      (patient_id, package_id, subscription_code, start_date, end_date,
       sessions_total, sessions_completed, payment_status, amount_paid, amount_due, notes)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `, [
      patient_id,
      package_id,
      subscriptionCode,
      start_date,
      getLocalDateString(endDate),
      pkg.num_sessions,
      payment_status || 'pending',
      amount_paid || 0,
      amountDue,
      notes
    ]);

    res.status(201).json({
      success: true,
      message: 'Patient enrolled successfully',
      subscription_id: result.insertId,
      subscription_code: subscriptionCode
    });
  } catch (error) {
    console.error('Enroll patient error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enroll patient'
    });
  }
}

/**
 * Get patient subscriptions
 */
async function getPatientSubscriptions(req, res) {
  try {
    const { patient_id } = req.params;
    const db = getDb();

    const [subscriptions] = await db.execute(`
      SELECT ps.*, sp.package_name, sp.package_type
      FROM patient_subscriptions ps
      INNER JOIN subscription_packages sp ON ps.package_id = sp.id
      WHERE ps.patient_id = ?
      ORDER BY ps.created_at DESC
    `, [patient_id]);

    res.json({
      success: true,
      subscriptions
    });
  } catch (error) {
    console.error('Get patient subscriptions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscriptions'
    });
  }
}

/**
 * Track session usage - decrement remaining sessions when patient completes appointment
 */
async function trackSessionUsage(req, res) {
  try {
    const { id: subscriptionId } = req.params;
    const { appointment_id } = req.body;
    const db = getDb();
    const userId = req.user?.id;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'Subscription ID required'
      });
    }

    // Get subscription details
    const [subscriptions] = await db.execute(`
      SELECT ps.*, sp.total_sessions
      FROM patient_subscriptions ps
      JOIN subscription_packages sp ON ps.package_id = sp.id
      WHERE ps.id = ?
    `, [subscriptionId]);

    if (subscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    const subscription = subscriptions[0];
    const remainingBefore = subscription.sessions_used || 0;
    const totalSessions = subscription.total_sessions;

    // Check if subscription is active and not expired
    const today = getLocalDateString();
    if (subscription.status !== 'active' || new Date(subscription.end_date) < new Date(today)) {
      return res.status(400).json({
        success: false,
        error: 'Subscription is not active or has expired'
      });
    }

    // Check if sessions remaining
    if (remainingBefore >= totalSessions) {
      return res.status(400).json({
        success: false,
        error: 'No sessions remaining in this subscription'
      });
    }

    // Increment sessions_used (which effectively decrements available sessions)
    await db.execute(`
      UPDATE patient_subscriptions
      SET 
        sessions_used = sessions_used + 1,
        last_session_date = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `, [subscriptionId]);

    // Record session activity if appointment_id provided
    if (appointment_id) {
      await db.execute(`
        INSERT INTO subscription_session_history (subscription_id, appointment_id, used_at)
        VALUES (?, ?, NOW())
      `, [subscriptionId, appointment_id]).catch(err => {
        // Table might not exist, just log it
        console.warn('Could not record session history:', err.message);
      });
    }

    // Get updated subscription
    const [updated] = await db.execute(`
      SELECT ps.*, sp.total_sessions, 
             (sp.total_sessions - ps.sessions_used) as sessions_remaining
      FROM patient_subscriptions ps
      JOIN subscription_packages sp ON ps.package_id = sp.id
      WHERE ps.id = ?
    `, [subscriptionId]);

    res.json({
      success: true,
      message: 'Session usage tracked',
      subscription: updated[0],
      sessions_remaining: updated[0].sessions_remaining,
      sessions_used: updated[0].sessions_used
    });
  } catch (error) {
    console.error('Track session usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track session usage'
    });
  }
}

module.exports = require('./subscriptionPackageController_refactored');
