const { getDb } = require('../config/db');

// List doctors (for dropdown/selection)
async function listDoctors(req, res) {
  try {
    const db = getDb();
    const [doctors] = await db.execute(`
      SELECT d.id, d.user_id, d.clinic_id, d.specialization, d.status,
             u.name, u.email, u.phone,
             c.name as clinic_name
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON d.clinic_id = c.id
      WHERE d.status = 'active'
      ORDER BY u.name
    `);
    res.json({ doctors });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
}

// Get all doctors (admin)
async function getAllDoctors(req, res) {
  try {
    const db = getDb();
    const [doctors] = await db.execute(`
      SELECT d.*, u.name as doctor_name, u.email, u.phone, u.is_active,
             c.name as clinic_name
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON d.clinic_id = c.id
      ORDER BY u.name
    `);
    res.json({ doctors });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
}

// Get doctor count
async function getDoctorCount(req, res) {
  try {
    const db = getDb();
    const [result] = await db.execute('SELECT COUNT(*) as count FROM doctors');
    res.json({ count: result[0].count });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to get doctor count' });
  }
}

// Get doctor by ID
async function getDoctorById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const [doctors] = await db.execute(`
      SELECT d.*, u.name, u.email, u.phone, u.is_active,
             c.name as clinic_name
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON d.clinic_id = c.id
      WHERE d.id = ?
    `, [id]);

    if (doctors.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json(doctors[0]);
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
}

// Get doctor by user_id (for logged-in doctor)
async function getDoctorByUserId(req, res) {
  try {
    const { userId } = req.params;
    const db = getDb();
    
    const [doctors] = await db.execute(`
      SELECT d.*, u.name, u.email, u.phone, u.is_active,
             c.name as clinic_name
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON d.clinic_id = c.id
      WHERE d.user_id = ?
      LIMIT 1
    `, [userId]);
    
    if (doctors.length === 0) {
      return res.status(404).json({ error: 'Doctor not found for this user' });
    }
    
    res.json(doctors[0]);
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
}

// Add new doctor
async function addDoctor(req, res) {
  try {
    const {
      user_id,
      clinic_id,
      specialization,
      license_number,
      consultation_fee,
      qualification,
      experience_years,
      available_from,
      available_to,
      available_days,
      status = 'active'
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const db = getDb();

    // Check if doctor already exists for this user
    const [existing] = await db.execute(
      'SELECT id FROM doctors WHERE user_id = ?',
      [user_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Doctor profile already exists for this user' });
    }

    // If clinic_id not provided, look it up from the user's record
    let resolvedClinicId = clinic_id || null;
    if (!resolvedClinicId) {
      const [userRows] = await db.execute('SELECT clinic_id FROM users WHERE id = ?', [user_id]);
      resolvedClinicId = userRows[0]?.clinic_id || null;
    }
    // Last fallback: use first available clinic
    if (!resolvedClinicId) {
      const [clinics] = await db.execute('SELECT id FROM clinics ORDER BY id ASC LIMIT 1');
      resolvedClinicId = clinics[0]?.id || null;
    }

    const [result] = await db.execute(`
      INSERT INTO doctors (
        user_id, clinic_id, specialization, license_number,
        consultation_fee, qualification, experience_years,
        available_from, available_to, available_days, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id,
      resolvedClinicId,
      specialization || 'General',
      license_number || null,
      consultation_fee || null,
      qualification || null,
      experience_years || 0,
      available_from || null,
      available_to || null,
      available_days ? JSON.stringify(available_days) : null,
      status
    ]);

    res.status(201).json({
      id: result.insertId,
      message: 'Doctor added successfully'
    });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to add doctor' });
  }
}

// Update doctor
async function updateDoctor(req, res) {
  try {
    const { id } = req.params;
    const {
      clinic_id,
      specialization,
      license_number,
      consultation_fee,
      qualification,
      experience_years,
      available_from,
      available_to,
      available_days,
      status
    } = req.body;

    const db = getDb();

    // Check if doctor exists
    const [existing] = await db.execute('SELECT id FROM doctors WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    await db.execute(`
      UPDATE doctors SET
        clinic_id = COALESCE(?, clinic_id),
        specialization = COALESCE(?, specialization),
        license_number = COALESCE(?, license_number),
        consultation_fee = COALESCE(?, consultation_fee),
        qualification = COALESCE(?, qualification),
        experience_years = COALESCE(?, experience_years),
        available_from = COALESCE(?, available_from),
        available_to = COALESCE(?, available_to),
        available_days = COALESCE(?, available_days),
        status = COALESCE(?, status),
        updated_at = NOW()
      WHERE id = ?
    `, [
      clinic_id,
      specialization,
      license_number,
      consultation_fee,
      qualification,
      experience_years,
      available_from,
      available_to,
      available_days ? JSON.stringify(available_days) : null,
      status,
      id
    ]);

    res.json({ message: 'Doctor updated successfully' });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to update doctor' });
  }
}

// Update a doctor's own WhatsApp follow-up / online-presence config
// (website, Google review link, socials, custom message template). Separate
// from updateDoctor (admin-only, covers fees/license/etc.) so a doctor can
// self-service these fields without needing admin rights — deliberately
// scoped to ONLY these columns so this endpoint can't be used to touch
// anything else on the doctor row.
async function updateDoctorWhatsAppSettings(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [existing] = await db.execute('SELECT id, user_id FROM doctors WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const isAdmin = req.user?.role === 'admin';
    const isSelf = req.user?.id && existing[0].user_id === req.user.id;
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Access denied. You can only edit your own settings.' });
    }

    const {
      website_url,
      google_review_url,
      show_google_review,
      facebook_url,
      instagram_url,
      youtube_url,
      whatsapp_followup_template,
      booking_url
    } = req.body;

    await db.execute(`
      UPDATE doctors SET
        website_url = ?,
        google_review_url = ?,
        show_google_review = ?,
        facebook_url = ?,
        instagram_url = ?,
        youtube_url = ?,
        whatsapp_followup_template = ?,
        booking_url = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      website_url || null,
      google_review_url || null,
      show_google_review ? 1 : 0,
      facebook_url || null,
      instagram_url || null,
      youtube_url || null,
      whatsapp_followup_template || null,
      booking_url || null,
      id
    ]);

    res.json({ message: 'WhatsApp settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update WhatsApp settings' });
  }
}

// Generate (or regenerate) a QR code image encoding the doctor's own
// booking_url, and store it as booking_qr_image. Kept separate from the
// settings save above since it's a derived artifact, not a form field —
// regenerated on demand whenever booking_url changes, not on every save.
async function generateDoctorBookingQR(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [existing] = await db.execute('SELECT id, user_id, booking_url FROM doctors WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const isAdmin = req.user?.role === 'admin';
    const isSelf = req.user?.id && existing[0].user_id === req.user.id;
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Access denied. You can only edit your own settings.' });
    }

    if (!existing[0].booking_url) {
      return res.status(400).json({ error: 'Set a Booking URL first, then generate its QR code.' });
    }

    const QRCode = require('qrcode');
    const qrDataUrl = await QRCode.toDataURL(existing[0].booking_url, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });

    await db.execute('UPDATE doctors SET booking_qr_image = ?, updated_at = NOW() WHERE id = ?', [qrDataUrl, id]);

    res.json({ message: 'QR code generated', booking_qr_image: qrDataUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
}

// Delete doctor
async function deleteDoctor(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Check if doctor exists
    const [existing] = await db.execute('SELECT id FROM doctors WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Soft delete - just mark as inactive
    await db.execute(
      "UPDATE doctors SET status = 'inactive', updated_at = NOW() WHERE id = ?",
      [id]
    );

    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    // Error handled by global handler
    res.status(500).json({ error: 'Failed to delete doctor' });
  }
}

// Get hospital affiliations for a doctor
async function getAffiliations(req, res) {
  try {
    const { doctorId } = req.params;
    const db = getDb();
    const [affiliations] = await db.execute(
      'SELECT id, name, location, created_at FROM hospital_affiliations WHERE doctor_id = ? ORDER BY id ASC',
      [doctorId]
    );
    res.json({ affiliations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch affiliations' });
  }
}

// Add hospital affiliation
async function addAffiliation(req, res) {
  try {
    const { doctorId } = req.params;
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Hospital name is required' });
    const db = getDb();
    const [result] = await db.execute(
      'INSERT INTO hospital_affiliations (doctor_id, name, location) VALUES (?, ?, ?)',
      [doctorId, name, location || '']
    );
    res.status(201).json({ id: result.insertId, name, location, message: 'Affiliation added' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add affiliation' });
  }
}

// Delete hospital affiliation
async function deleteAffiliation(req, res) {
  try {
    const { doctorId, id } = req.params;
    const db = getDb();
    await db.execute('DELETE FROM hospital_affiliations WHERE id = ? AND doctor_id = ?', [id, doctorId]);
    res.json({ message: 'Affiliation deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete affiliation' });
  }
}

// Get landing page data for a doctor (public)
async function getLandingPageData(req, res) {
  try {
    const { doctorId } = req.params;
    const db = getDb();

    // Doctor + user + clinic info
    const [doctors] = await db.execute(`
      SELECT d.id, d.specialization, d.qualification, d.experience_years,
             u.name as doctor_name, u.phone as doctor_phone, u.email as doctor_email,
             c.name as clinic_name, c.address as clinic_address, c.city as clinic_city,
             c.phone as clinic_phone, c.email as clinic_email
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON d.clinic_id = c.id
      WHERE d.id = ?
    `, [doctorId]);

    if (doctors.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Hospital affiliations
    const [affiliations] = await db.execute(
      'SELECT id, name, location FROM hospital_affiliations WHERE doctor_id = ? ORDER BY id ASC',
      [doctorId]
    );

    const doc = doctors[0];
    res.json({
      doctor: {
        id: doc.id,
        name: doc.doctor_name,
        phone: doc.doctor_phone,
        email: doc.doctor_email,
        specialization: doc.specialization,
        qualification: doc.qualification,
        experience_years: doc.experience_years
      },
      clinic: {
        name: doc.clinic_name,
        address: doc.clinic_address,
        city: doc.clinic_city,
        phone: doc.clinic_phone,
        email: doc.clinic_email
      },
      affiliations
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch landing page data' });
  }
}

module.exports = {
  listDoctors,
  addDoctor,
  getDoctorCount,
  getAllDoctors,
  getDoctorById,
  updateDoctor,
  updateDoctorWhatsAppSettings,
  generateDoctorBookingQR,
  deleteDoctor,
  getDoctorByUserId,
  getAffiliations,
  addAffiliation,
  deleteAffiliation,
  getLandingPageData
};