const { getDb } = require('../config/db');
const { getLocalDateString } = require('../utils/localDate');

class SubscriptionPackageService {
  static async getAllPackages({ user }) {
    const db = getDb();
    const userId = user?.id;
    const userRole = user?.role;

    let sql = `
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

    if (userRole === 'doctor') {
      sql += ` AND (sp.doctor_id IS NULL OR sp.doctor_id = ?)`;
      params.push(userId);
    }

    sql += ` ORDER BY sp.created_at DESC`;

    const [packages] = await db.execute(sql, params);
    return { packages };
  }

  static async getPackageById(id) {
    const db = getDb();

    const [packages] = await db.execute(
      `
      SELECT sp.*,
             c.name as clinic_name,
             u.name as doctor_name
      FROM subscription_packages sp
      LEFT JOIN clinics c ON sp.clinic_id = c.id
      LEFT JOIN doctors d ON sp.doctor_id = d.user_id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE sp.id = ?
    `,
      [id]
    );

    if (packages.length === 0) {
      const err = new Error('Package not found');
      err.statusCode = 404;
      throw err;
    }

    const [sessions] = await db.execute(
      `
      SELECT * FROM package_sessions
      WHERE package_id = ?
      ORDER BY session_number ASC
    `,
      [id]
    );

    return { package: { ...packages[0], sessions } };
  }

  static async createPackage({ body, user }) {
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
      sessions,
    } = body;

    if (!package_name || !num_sessions || !total_price || !validity_days) {
      const err = new Error('Package name, sessions, price, and validity are required');
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();
    const userId = user?.id;
    const userRole = user?.role;

    let clinicId = null;
    let doctorId = null;

    if (userRole === 'doctor') {
      doctorId = userId;
      const [doctors] = await db.execute('SELECT clinic_id FROM doctors WHERE user_id = ?', [userId]);
      if (doctors.length > 0) {
        clinicId = doctors[0].clinic_id;
      }
    } else if (userRole === 'admin') {
      const [users] = await db.execute('SELECT clinic_id FROM users WHERE id = ?', [userId]);
      if (users.length > 0) {
        clinicId = users[0].clinic_id;
      }
    }

    const [result] = await db.execute(
      `
      INSERT INTO subscription_packages
      (clinic_id, doctor_id, package_type, package_name, description, num_sessions,
       pricing_model, price_per_session, total_price, validity_days,
       allow_family_members, staff_edit_access)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
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
        staff_edit_access || 1,
      ]
    );

    const packageId = result.insertId;

    if (sessions && Array.isArray(sessions) && sessions.length > 0) {
      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        await db.execute(
          `
          INSERT INTO package_sessions
          (package_id, session_name, session_number, duration_minutes, scheduled_time,
           days_of_week, description, sample_schedule)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            packageId,
            session.session_name,
            session.session_number || i + 1,
            session.duration_minutes,
            session.scheduled_time,
            JSON.stringify(session.days_of_week || []),
            session.description,
            session.sample_schedule,
          ]
        );
      }
    }

    return { package_id: packageId };
  }

  static async updatePackage({ id, body }) {
    const db = getDb();

    const [existing] = await db.execute('SELECT * FROM subscription_packages WHERE id = ?', [id]);
    if (existing.length === 0) {
      const err = new Error('Package not found');
      err.statusCode = 404;
      throw err;
    }

    const updateFields = [];
    const values = [];

    const allowedFields = [
      'package_type',
      'package_name',
      'description',
      'num_sessions',
      'pricing_model',
      'price_per_session',
      'total_price',
      'validity_days',
      'allow_family_members',
      'staff_edit_access',
      'is_active',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updateFields.length === 0) {
      const err = new Error('No fields to update');
      err.statusCode = 400;
      throw err;
    }

    values.push(id);

    await db.execute(
      `
      UPDATE subscription_packages
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `,
      values
    );

    return { updated: true };
  }

  static async deletePackage(id) {
    const db = getDb();
    await db.execute('UPDATE subscription_packages SET is_active = 0 WHERE id = ?', [id]);
    return { deleted: true };
  }

  static async enrollPatient({ body }) {
    const { patient_id, package_id, start_date, payment_status, amount_paid, notes } = body;

    if (!patient_id || !package_id || !start_date) {
      const err = new Error('Patient ID, package ID, and start date are required');
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();

    const [packages] = await db.execute('SELECT * FROM subscription_packages WHERE id = ?', [package_id]);

    if (packages.length === 0) {
      const err = new Error('Package not found');
      err.statusCode = 404;
      throw err;
    }

    const pkg = packages[0];

    const endDate = new Date(start_date);
    endDate.setDate(endDate.getDate() + pkg.validity_days);

    const subscriptionCode = `SUB${new Date().getFullYear()}${String(patient_id).padStart(5, '0')}${String(package_id).padStart(3, '0')}`;

    const amountDue = pkg.total_price - (amount_paid || 0);

    const [result] = await db.execute(
      `
      INSERT INTO patient_subscriptions
      (patient_id, package_id, subscription_code, start_date, end_date,
       sessions_total, sessions_completed, payment_status, amount_paid, amount_due, notes)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `,
      [
        patient_id,
        package_id,
        subscriptionCode,
        start_date,
        getLocalDateString(endDate),
        pkg.num_sessions,
        payment_status || 'pending',
        amount_paid || 0,
        amountDue,
        notes,
      ]
    );

    return { subscription_id: result.insertId, subscription_code: subscriptionCode };
  }

  static async getPatientSubscriptions(patient_id) {
    const db = getDb();

    const [subscriptions] = await db.execute(
      `
      SELECT ps.*, sp.package_name, sp.package_type
      FROM patient_subscriptions ps
      INNER JOIN subscription_packages sp ON ps.package_id = sp.id
      WHERE ps.patient_id = ?
      ORDER BY ps.created_at DESC
    `,
      [patient_id]
    );

    return { subscriptions };
  }

  static async trackSessionUsage({ subscriptionId, body }) {
    const { appointment_id } = body;
    const db = getDb();

    if (!subscriptionId) {
      const err = new Error('Subscription ID required');
      err.statusCode = 400;
      throw err;
    }

    const [subscriptions] = await db.execute(
      `
      SELECT ps.*, sp.total_sessions
      FROM patient_subscriptions ps
      JOIN subscription_packages sp ON ps.package_id = sp.id
      WHERE ps.id = ?
    `,
      [subscriptionId]
    );

    if (subscriptions.length === 0) {
      const err = new Error('Subscription not found');
      err.statusCode = 404;
      throw err;
    }

    const subscription = subscriptions[0];
    const usedBefore = subscription.sessions_used || 0;
    const totalSessions = subscription.total_sessions;

    const today = getLocalDateString();
    if (subscription.status !== 'active' || new Date(subscription.end_date) < new Date(today)) {
      const err = new Error('Subscription is not active or has expired');
      err.statusCode = 400;
      throw err;
    }

    if (usedBefore >= totalSessions) {
      const err = new Error('No sessions remaining in this subscription');
      err.statusCode = 400;
      throw err;
    }

    await db.execute(
      `
      UPDATE patient_subscriptions
      SET 
        sessions_used = sessions_used + 1,
        last_session_date = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `,
      [subscriptionId]
    );

    if (appointment_id) {
      await db
        .execute(
          `
        INSERT INTO subscription_session_history (subscription_id, appointment_id, used_at)
        VALUES (?, ?, NOW())
      `,
          [subscriptionId, appointment_id]
        )
        .catch((err) => {
          console.warn('Could not record session history:', err.message);
        });
    }

    const [updated] = await db.execute(
      `
      SELECT ps.*, sp.total_sessions, 
             (sp.total_sessions - ps.sessions_used) as sessions_remaining
      FROM patient_subscriptions ps
      JOIN subscription_packages sp ON ps.package_id = sp.id
      WHERE ps.id = ?
    `,
      [subscriptionId]
    );

    return {
      subscription: updated[0],
      sessions_remaining: updated[0].sessions_remaining,
      sessions_used: updated[0].sessions_used,
    };
  }
}

module.exports = SubscriptionPackageService;
