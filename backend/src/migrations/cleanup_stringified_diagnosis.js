/**
 * One-off data cleanup: prescriptions.diagnosis / chief_complaint were saved by
 * an older code path as JSON.stringify(pickerArray), and re-editing a record
 * compounded the escaping — producing garbage like  "\"\\\"[]\\\"\""  on the
 * printed Rx. The write paths and unwrapJsonText are fixed now; this rewrites
 * the rows that were already corrupted so historical PDFs read cleanly too.
 *
 * Also backfills prescription_items.sort_order (0..n-1 by id) for old rows so
 * the Rx list order on the PDF matches the order meds were entered.
 *
 * Usage:  node src/migrations/cleanup_stringified_diagnosis.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const { unwrapJsonText } = require('../utils/unwrapJsonText');

const DRY = process.argv.includes('--dry-run');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  // ── 1. Clean diagnosis / chief_complaint text ──────────────────────────────
  const [rows] = await conn.query(
    `SELECT id, diagnosis, chief_complaint FROM prescriptions
      WHERE diagnosis LIKE '%\\\\%' OR diagnosis LIKE '[%' OR diagnosis LIKE '"%'
         OR chief_complaint LIKE '%\\\\%' OR chief_complaint LIKE '[%' OR chief_complaint LIKE '"%'`
  );

  let fixed = 0;
  for (const r of rows) {
    const newDx = r.diagnosis == null ? r.diagnosis : (unwrapJsonText(r.diagnosis) || null);
    const newCc = r.chief_complaint == null ? r.chief_complaint : (unwrapJsonText(r.chief_complaint) || null);
    if (newDx === r.diagnosis && newCc === r.chief_complaint) continue;
    fixed++;
    console.log(`#${r.id}`);
    if (newDx !== r.diagnosis) console.log(`  Dx : ${JSON.stringify(r.diagnosis)}\n     -> ${JSON.stringify(newDx)}`);
    if (newCc !== r.chief_complaint) console.log(`  C/O: ${JSON.stringify(r.chief_complaint)}\n     -> ${JSON.stringify(newCc)}`);
    if (!DRY) {
      await conn.query('UPDATE prescriptions SET diagnosis = ?, chief_complaint = ? WHERE id = ?', [newDx, newCc, r.id]);
    }
  }
  console.log(`\n${DRY ? '[dry-run] would fix' : 'fixed'} ${fixed} prescription row(s) of ${rows.length} scanned.`);

  // ── 2. Backfill prescription_items.sort_order ──────────────────────────────
  try {
    const [grp] = await conn.query(
      `SELECT prescription_id FROM prescription_items
        GROUP BY prescription_id HAVING COUNT(*) > 1 AND MAX(sort_order) = 0 AND MIN(sort_order) = 0`
    );
    let ordered = 0;
    for (const g of grp) {
      const [items] = await conn.query(
        'SELECT id FROM prescription_items WHERE prescription_id = ? ORDER BY id ASC', [g.prescription_id]
      );
      for (let i = 0; i < items.length; i++) {
        if (!DRY) await conn.query('UPDATE prescription_items SET sort_order = ? WHERE id = ?', [i, items[i].id]);
      }
      ordered++;
    }
    console.log(`${DRY ? '[dry-run] would set' : 'set'} sort_order on ${ordered} prescription(s).`);
  } catch (e) {
    console.warn('sort_order backfill skipped:', e.message);
  }

  await conn.end();
  console.log('Done.');
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
