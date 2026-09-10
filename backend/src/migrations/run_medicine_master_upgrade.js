/**
 * Medicine Master DB Migration
 * Run: node backend/src/migrations/run_medicine_master_upgrade.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
};

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.database, table, column]
  );
  return rows[0].cnt > 0;
}

async function indexExists(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [config.database, table, indexName]
  );
  return rows[0].cnt > 0;
}

async function run() {
  const conn = await mysql.createConnection(config);
  console.log('Connected to MySQL. Running medicine_master migration...\n');

  const addColumns = [
    { col: 'composition',           sql: `ALTER TABLE medicines ADD COLUMN composition TEXT NULL AFTER generic_name` },
    { col: 'default_timing',        sql: `ALTER TABLE medicines ADD COLUMN default_timing VARCHAR(100) NULL AFTER default_frequency` },
    { col: 'notes',                 sql: `ALTER TABLE medicines ADD COLUMN notes TEXT NULL AFTER default_instructions` },
    { col: 'search_text',           sql: `ALTER TABLE medicines ADD COLUMN search_text TEXT NULL AFTER notes` },
  ];

  for (const { col, sql } of addColumns) {
    const exists = await columnExists(conn, 'medicines', col);
    if (exists) {
      console.log(`  SKIP  column '${col}' already exists`);
    } else {
      await conn.query(sql);
      console.log(`  ADD   column '${col}' added`);
    }
  }

  // Backfill search_text
  console.log('\n  Backfilling search_text for existing rows...');
  const [result] = await conn.query(`
    UPDATE medicines
    SET search_text = LOWER(CONCAT_WS(' ',
      COALESCE(name, ''),
      COALESCE(generic_name, ''),
      COALESCE(composition, ''),
      COALESCE(brand, '')
    ))
    WHERE search_text IS NULL OR search_text = ''
  `);
  console.log(`  DONE  ${result.affectedRows} rows updated`);

  const addIndexes = [
    { name: 'idx_medicines_name',        sql: `ALTER TABLE medicines ADD INDEX idx_medicines_name (name(100))` },
    { name: 'idx_medicines_generic',     sql: `ALTER TABLE medicines ADD INDEX idx_medicines_generic (generic_name(100))` },
    { name: 'idx_medicines_active',      sql: `ALTER TABLE medicines ADD INDEX idx_medicines_active (is_active)` },
    { name: 'idx_medicines_active_name', sql: `ALTER TABLE medicines ADD INDEX idx_medicines_active_name (is_active, name(100))` },
  ];

  console.log('');
  for (const { name, sql } of addIndexes) {
    const exists = await indexExists(conn, 'medicines', name);
    if (exists) {
      console.log(`  SKIP  index '${name}' already exists`);
    } else {
      await conn.query(sql);
      console.log(`  ADD   index '${name}' created`);
    }
  }

  await conn.end();
  console.log('\nMigration complete.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
