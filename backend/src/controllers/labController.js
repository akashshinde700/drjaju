const { getDb } = require('../config/db');

async function listLabs(req, res) {
  try {
    const { search, patientId } = req.query;
    const db = getDb();
    let query = `SELECT id, test_name as name, ordered_date as testOn, 
                        DATE_ADD(ordered_date, INTERVAL 7 DAY) as repeatOn, 
                        notes as remarks, status, 
                        CASE WHEN status = 'pending' THEN 1 ELSE 0 END as bookable
                 FROM lab_investigations WHERE 1=1`;
    const params = [];

    if (patientId) {
      query += ' AND patient_id = ?';
      params.push(patientId);
    }

    if (search) {
      query += ' AND test_name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY ordered_date DESC LIMIT 50';

    const [labs] = await db.execute(query, params);
    res.json({ labs });
  } catch (error) {
    console.error('List labs error:', error);
    res.status(500).json({ error: 'Failed to fetch labs' });
  }
}

async function addLab(req, res) {
  try {
    const { name, testOn, repeatOn, remarks, bookable, patientId } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const db = getDb();
    
    // Use a default patient_id of 1 if not provided (for general lab tests)
    // In a real scenario, you might want to create a "general" patient or handle this differently
    const finalPatientId = patientId || 1;
    
    try {
      const [result] = await db.execute(
        `INSERT INTO lab_investigations (patient_id, doctor_id, test_name, ordered_date, notes, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          finalPatientId,
          req.user?.id || null,
          name,
          testOn ? new Date(testOn) : new Date(),
          remarks || null,
          bookable ? 'pending' : 'completed'
        ]
      );

      const [lab] = await db.execute(
        `SELECT id, test_name as name, ordered_date as testOn, 
                DATE_ADD(ordered_date, INTERVAL 7 DAY) as repeatOn, 
                notes as remarks, status,
                CASE WHEN status = 'pending' THEN 1 ELSE 0 END as bookable
         FROM lab_investigations WHERE id = ?`,
        [result.insertId]
      );

      res.status(201).json(lab[0]);
    } catch (dbError) {
      console.error('Database error:', dbError);
      if (dbError.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ error: 'Invalid patient ID' });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Add lab error:', error);
    res.status(500).json({ error: 'Failed to add lab investigation' });
  }
}

async function updateLab(req, res) {
  try {
    const { id } = req.params;
    const { name, testOn, repeatOn, remarks, bookable } = req.body;
    const db = getDb();

    await db.execute(
      `UPDATE lab_investigations SET test_name = ?, ordered_date = ?, notes = ?, status = ?
       WHERE id = ?`,
      [name, testOn ? new Date(testOn) : new Date(), remarks, bookable ? 'pending' : 'completed', id]
    );

    res.json({ message: 'Lab investigation updated' });
  } catch (error) {
    console.error('Update lab error:', error);
    res.status(500).json({ error: 'Failed to update lab investigation' });
  }
}

async function deleteLab(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.execute('DELETE FROM lab_investigations WHERE id = ?', [id]);
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete lab error:', error);
    res.status(500).json({ error: 'Failed to delete lab investigation' });
  }
}

module.exports = { listLabs, addLab, updateLab, deleteLab };
