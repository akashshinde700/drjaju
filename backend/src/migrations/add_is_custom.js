require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const db = process.env.DB_NAME;

  const [colRows] = await conn.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='medicines' AND COLUMN_NAME='is_custom'`, [db]
  );
  if (colRows[0].cnt > 0) {
    console.log('SKIP: is_custom column already exists');
  } else {
    await conn.query('ALTER TABLE medicines ADD COLUMN is_custom TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active');
    console.log('ADD:  is_custom column added');
  }

  const [idxRows] = await conn.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='medicines' AND INDEX_NAME='idx_medicines_custom'`, [db]
  );
  if (idxRows[0].cnt > 0) {
    console.log('SKIP: idx_medicines_custom already exists');
  } else {
    await conn.query('ALTER TABLE medicines ADD INDEX idx_medicines_custom (is_custom)');
    console.log('ADD:  idx_medicines_custom index created');
  }

  await conn.end();
  console.log('Migration done.');
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
