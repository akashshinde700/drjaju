const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = 3306,
  DB_USER = 'drjaju',
  DB_PASSWORD = '',
  DB_NAME = 'patientmanagement',
  BCRYPT_ROUNDS = 10,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME = 'Admin User',
  ADMIN_CLINIC_ID = 2, // Default clinic ID from backup
  ADMIN_PHONE = null,
} = process.env;

const args = process.argv.slice(2);
const email = args[0] || ADMIN_EMAIL;
const password = args[1] || ADMIN_PASSWORD;
const name = args[2] || ADMIN_NAME;
const clinicId = args[3] ? parseInt(args[3], 10) : (ADMIN_CLINIC_ID ? parseInt(ADMIN_CLINIC_ID, 10) : 2);
const phone = ADMIN_PHONE || null;

if (!email || !password) {
  console.error('Usage: node seedUsers.js <admin-email> <admin-password> [admin-name]');
  console.error('Or set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env');
  process.exit(1);
}

async function createOrUpdateAdmin() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    const hashedPassword = await bcrypt.hash(password, Number(BCRYPT_ROUNDS));

    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length > 0) {
      const userId = existing[0].id;
      await connection.execute(
        `UPDATE users
         SET password = ?, name = ?, role = 'admin', is_active = 1, clinic_id = ?, phone = ?, updated_at = NOW()
         WHERE id = ?`,
        [hashedPassword, name, clinicId, phone, userId]
      );
      console.log(`✅ Updated existing admin user: ${email} (id=${userId})`);
    } else {
      await connection.execute(
        `INSERT INTO users (name, email, password, role, clinic_id, phone, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 'admin', ?, ?, 1, NOW(), NOW())`,
        [name, email, hashedPassword, clinicId, phone]
      );
      console.log(`✅ Created new admin user: ${email}`);
    }
  } catch (err) {
    console.error('❌ Failed to create/update admin user:', err.message || err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

createOrUpdateAdmin();
