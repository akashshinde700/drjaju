const { getDb } = require('../config/db');

// Get doctor's time slots (with optional filtering by appointment type and date)
async function getDoctorTimeSlots(req, res) {
  try {
    const { doctor_id } = req.params;
    const { appointment_type, date } = req.query; // appointment_type: 'offline' or 'online', date: 'YYYY-MM-DD'
    const db = getDb();

    // Build query to get time slots
    // If appointment_type is provided, filter by it (include 'both' and the specific type)
    let slotsQuery = `
      SELECT
        id,
        slot_time,
        TIME_FORMAT(slot_time, '%h:%i %p') as display_time,
        appointment_type,
        is_active,
        display_order
      FROM doctor_time_slots
      WHERE doctor_id = ? AND is_active = 1
    `;

    const queryParams = [doctor_id];

    if (appointment_type && ['offline', 'online'].includes(appointment_type)) {
      slotsQuery += ` AND (appointment_type = 'both' OR appointment_type = ?)`;
      queryParams.push(appointment_type);
    }

    // Chronological, not insertion order: display_order is assigned as
    // MAX(display_order)+1 whenever a slot is added (addTimeSlot below), so a
    // slot added later — e.g. a 2:10 PM gap-filler added after evening slots
    // already existed — got a HIGHER display_order despite being chronologically
    // earlier, and sorted after 7:50 PM on the public booking page.
    slotsQuery += ` ORDER BY slot_time, display_order`;

    const [slots] = await db.execute(slotsQuery, queryParams);

    // If date is provided, filter out booked slots
    if (date && appointment_type) {
      // Get booked appointments for this doctor, date, and appointment type
      const [bookedSlots] = await db.execute(`
        SELECT appointment_time
        FROM appointments
        WHERE doctor_id = ?
          AND appointment_date = ?
          AND appointment_type = ?
          AND status != 'cancelled'
      `, [doctor_id, date, appointment_type]);

      // Create a Set of booked slot times for quick lookup (format: HH:MM:SS)
      const bookedTimes = new Set(
        bookedSlots.map(slot => slot.appointment_time)
      );

      // Filter out booked slots
      const availableSlots = slots.filter(slot => !bookedTimes.has(slot.slot_time));
      return res.json({ slots: availableSlots });
    }

    res.json({ slots });
  } catch (error) {
    console.error('Error fetching doctor time slots:', error);
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
}

// Get doctor's availability (working days)
async function getDoctorAvailability(req, res) {
  try {
    const { doctor_id } = req.params;
    const db = getDb();

    const [availability] = await db.execute(`
      SELECT
        id,
        day_of_week,
        is_available,
        CASE day_of_week
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day_name
      FROM doctor_availability
      WHERE doctor_id = ?
      ORDER BY day_of_week
    `, [doctor_id]);

    res.json({ availability });
  } catch (error) {
    console.error('Error fetching doctor availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
}

// Update doctor time slots
async function updateDoctorTimeSlots(req, res) {
  try {
    const { doctor_id } = req.params;
    const { slots } = req.body; // Array of { slot_time, is_active }

    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: 'Slots must be an array' });
    }

    const db = getDb();

    // Start transaction
    await db.query('START TRANSACTION');

    try {
      // Delete all existing slots for this doctor
      await db.execute('DELETE FROM doctor_time_slots WHERE doctor_id = ?', [doctor_id]);

      // Insert new slots
      if (slots.length > 0) {
        const values = slots.map((slot, index) => [
          doctor_id,
          slot.slot_time,
          slot.is_active !== undefined ? slot.is_active : true,
          index + 1
        ]);

        await db.query(
          `INSERT INTO doctor_time_slots (doctor_id, slot_time, is_active, display_order)
           VALUES ?`,
          [values]
        );
      }

      await db.query('COMMIT');
      res.json({ message: 'Time slots updated successfully' });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating doctor time slots:', error);
    res.status(500).json({ error: 'Failed to update time slots' });
  }
}

// Update doctor availability (working days)
async function updateDoctorAvailability(req, res) {
  try {
    const { doctor_id } = req.params;
    const { availability } = req.body; // Array of { day_of_week, is_available }

    if (!Array.isArray(availability)) {
      return res.status(400).json({ error: 'Availability must be an array' });
    }

    const db = getDb();

    // Update each day's availability
    for (const day of availability) {
      await db.execute(`
        INSERT INTO doctor_availability (doctor_id, day_of_week, is_available)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          is_available = VALUES(is_available),
          updated_at = NOW()
      `, [doctor_id, day.day_of_week, day.is_available]);
    }

    res.json({ message: 'Availability updated successfully' });
  } catch (error) {
    console.error('Error updating doctor availability:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
}

// Add a single time slot
async function addTimeSlot(req, res) {
  try {
    const { doctor_id } = req.params;
    const { slot_time } = req.body;

    if (!slot_time) {
      return res.status(400).json({ error: 'slot_time is required' });
    }

    const db = getDb();

    // Get the max display_order
    const [maxOrder] = await db.execute(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM doctor_time_slots WHERE doctor_id = ?',
      [doctor_id]
    );

    const nextOrder = maxOrder[0].max_order + 1;

    await db.execute(
      `INSERT INTO doctor_time_slots (doctor_id, slot_time, is_active, display_order)
       VALUES (?, ?, TRUE, ?)`,
      [doctor_id, slot_time, nextOrder]
    );

    res.json({ message: 'Time slot added successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'This time slot already exists' });
    }
    console.error('Error adding time slot:', error);
    res.status(500).json({ error: 'Failed to add time slot' });
  }
}

// Delete a time slot
async function deleteTimeSlot(req, res) {
  try {
    const { doctor_id, slot_id } = req.params;
    const db = getDb();

    const [result] = await db.execute(
      'DELETE FROM doctor_time_slots WHERE id = ? AND doctor_id = ?',
      [slot_id, doctor_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    res.json({ message: 'Time slot deleted successfully' });
  } catch (error) {
    console.error('Error deleting time slot:', error);
    res.status(500).json({ error: 'Failed to delete time slot' });
  }
}

module.exports = {
  getDoctorTimeSlots,
  getDoctorAvailability,
  updateDoctorTimeSlots,
  updateDoctorAvailability,
  addTimeSlot,
  deleteTimeSlot
};
