const { getDb } = require('../config/db');

async function listClinics(req, res) {
  try {
    const db = getDb();
    const [clinics] = await db.execute(
      'SELECT * FROM clinics WHERE is_active = 1 ORDER BY name'
    );
    res.json({ clinics });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to fetch clinics' });
  }
}

async function getClinic(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const [clinics] = await db.execute(
      'SELECT * FROM clinics WHERE id = ?',
      [id]
    );

    if (clinics.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    res.json({ clinic: clinics[0] });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to fetch clinic' });
  }
}

async function createClinic(req, res) {
  try {
    const { name, address, city, state, pincode, phone, email, logo_url } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Clinic name is required' });
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO clinics (name, address, city, state, pincode, phone, email, logo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, address || null, city || null, state || null, pincode || null, phone || null, email || null, logo_url || null]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Clinic created successfully'
    });
  } catch (error) {
    // Error handled by global handler
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Clinic with this email already exists' });
    }
    res.status(500).json({ error: 'Failed to create clinic' });
  }
}

async function updateClinic(req, res) {
  try {
    const { id } = req.params;
    const { name, address, city, state, pincode, phone, email, logo_url, is_active } = req.body;

    const db = getDb();
    const updateFields = [];
    const params = [];

    if (name) { updateFields.push('name = ?'); params.push(name); }
    if (address !== undefined) { updateFields.push('address = ?'); params.push(address); }
    if (city) { updateFields.push('city = ?'); params.push(city); }
    if (state) { updateFields.push('state = ?'); params.push(state); }
    if (pincode) { updateFields.push('pincode = ?'); params.push(pincode); }
    if (phone) { updateFields.push('phone = ?'); params.push(phone); }
    if (email) { updateFields.push('email = ?'); params.push(email); }
    if (logo_url !== undefined) { updateFields.push('logo_url = ?'); params.push(logo_url); }
    if (is_active !== undefined) { updateFields.push('is_active = ?'); params.push(is_active); }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    await db.execute(
      `UPDATE clinics SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'Clinic updated successfully' });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to update clinic' });
  }
}

async function switchClinic(req, res) {
  try {
    const { clinic_id } = req.body;
    const userId = req.user?.id;

    if (!clinic_id) {
      return res.status(400).json({ error: 'Clinic ID is required' });
    }

    const db = getDb();

    // Verify clinic exists
    const [clinics] = await db.execute('SELECT id FROM clinics WHERE id = ? AND is_active = 1', [clinic_id]);
    if (clinics.length === 0) {
      return res.status(404).json({ error: 'Clinic not found or inactive' });
    }

    // Check if user has access to this clinic (admin can access all, others only their assigned clinic)
    if (req.user.role !== 'admin') {
      const [userClinics] = await db.execute('SELECT clinic_id FROM users WHERE id = ?', [userId]);
      if (userClinics.length === 0 || userClinics[0].clinic_id !== parseInt(clinic_id)) {
        return res.status(403).json({ error: 'You do not have access to this clinic' });
      }
    }

    // Update user's current clinic (store in session/token, or update user record)
    // For now, we'll return the clinic info and let frontend handle the switch
    const [clinic] = await db.execute('SELECT * FROM clinics WHERE id = ?', [clinic_id]);

    res.json({
      message: 'Clinic switched successfully',
      clinic: clinic[0]
    });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to switch clinic' });
  }
}

module.exports = require('./clinicController_refactored');

