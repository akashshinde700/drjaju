const { getDb } = require('../config/db');

async function ensureCertificateTypesTable(db) {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS certificate_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    const [rows] = await db.execute('SELECT COUNT(*) AS cnt FROM certificate_types');
    if (rows[0].cnt === 0) {
      await db.execute(`INSERT INTO certificate_types (name) VALUES ('Fitness Certificate'),('Sick Leave Certificate'),('Medical Certificate'),('Disability Certificate'),('Other')`);
    }
  } catch (err) {
    console.error('certificate_types migration error:', err.message);
  }
}

// List all certificate types
exports.listCertificateTypes = async (req, res) => {
  try {
    const db = getDb();
    await ensureCertificateTypesTable(db);
    const [rows] = await db.execute('SELECT * FROM certificate_types WHERE is_active = 1 ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch certificate types' });
  }
};

// Create a new certificate type
exports.createCertificateType = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const db = getDb();
    await ensureCertificateTypesTable(db);
    const [result] = await db.execute('INSERT INTO certificate_types (name) VALUES (?)', [name]);
    res.status(201).json({ id: result.insertId, name });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Type already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create certificate type' });
    }
  }
};

// Update a certificate type
exports.updateCertificateType = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const db = getDb();
    const [result] = await db.execute('UPDATE certificate_types SET name = ? WHERE id = ?', [name, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Type not found' });
    res.json({ id, name });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Type already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update certificate type' });
    }
  }
};

// Delete (deactivate) a certificate type
exports.deleteCertificateType = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const [result] = await db.execute('UPDATE certificate_types SET is_active = 0 WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Type not found' });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete certificate type' });
  }
};
