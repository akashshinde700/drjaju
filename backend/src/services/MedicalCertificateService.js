const { getDb } = require('../config/db');
const { ApiError } = require('../utils');

// The schema check below issues ALTER TABLE statements, each of which takes a
// metadata lock and rewrites the table. Running it on every create request is
// both slow and lock-prone, so do it at most once per process.
let schemaEnsured = false;

class MedicalCertificateService {
  static async ensureMedicalCertTableExists(db) {
    if (schemaEnsured) return;
    try {
      await db.execute(`
      CREATE TABLE IF NOT EXISTS medical_certificates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        doctor_name VARCHAR(255) NOT NULL,
        doctor_registration_no VARCHAR(100) DEFAULT NULL,
        doctor_qualification VARCHAR(255) DEFAULT NULL,
        type_id INT DEFAULT NULL,
        certificate_title VARCHAR(255) NOT NULL,
        diagnosis TEXT DEFAULT NULL,
        certificate_content MEDIUMTEXT NOT NULL,
        issued_date DATE NOT NULL,
        valid_from DATE DEFAULT NULL,
        valid_until DATE DEFAULT NULL,
        resume_date DATE DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        header_image MEDIUMTEXT DEFAULT NULL,
        footer_image MEDIUMTEXT DEFAULT NULL,
        clinic_id INT DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

      const [cols] = await db.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'medical_certificates'"
      );
      const existingCols = cols.map((c) => (c.column_name || c.COLUMN_NAME).toLowerCase());
      const toAdd = [
        ['doctor_name', "VARCHAR(255) NOT NULL DEFAULT ''"],
        ['doctor_registration_no', 'VARCHAR(100) DEFAULT NULL'],
        ['doctor_qualification', 'VARCHAR(255) DEFAULT NULL'],
        ['type_id', 'INT DEFAULT NULL'],
        ['certificate_title', "VARCHAR(255) NOT NULL DEFAULT ''"],
        ['diagnosis', 'TEXT DEFAULT NULL'],
        ['certificate_content', 'MEDIUMTEXT DEFAULT NULL'],
        ['issued_date', 'DATE DEFAULT NULL'],
        ['valid_from', 'DATE DEFAULT NULL'],
        ['valid_until', 'DATE DEFAULT NULL'],
        ['resume_date', 'DATE DEFAULT NULL'],
        ['notes', 'TEXT DEFAULT NULL'],
        ['header_image', 'MEDIUMTEXT DEFAULT NULL'],
        ['footer_image', 'MEDIUMTEXT DEFAULT NULL'],
        ['clinic_id', 'INT DEFAULT NULL'],
        ['created_by', 'INT DEFAULT NULL'],
      ];

      for (const [colName, colDef] of toAdd) {
        if (!existingCols.includes(colName)) {
          await db.execute(`ALTER TABLE medical_certificates ADD COLUMN ${colName} ${colDef}`);
        }
      }

      // Old tables may carry NOT NULL constraints on columns that are optional
      // now. Relax them — using each column's REAL type. The previous version of
      // this loop forced every column to INT, which turned the DATE columns
      // (valid_from / valid_until / resume_date) into INT on any freshly created
      // table and then made "Create Certificate" 500 with
      // "Incorrect integer value: '2026-08-24 00:00:00' for column 'valid_from'".
      const nullableIntFixes = ['clinic_id', 'created_by', 'type_id'];
      for (const col of nullableIntFixes) {
        if (existingCols.includes(col)) {
          try {
            await db.execute(`ALTER TABLE medical_certificates MODIFY COLUMN ${col} INT DEFAULT NULL`);
          } catch {
            // ignore — column may already be nullable or a different type
          }
        }
      }
      const nullableDateFixes = ['valid_from', 'valid_until', 'resume_date'];
      for (const col of nullableDateFixes) {
        if (existingCols.includes(col)) {
          try {
            await db.execute(`ALTER TABLE medical_certificates MODIFY COLUMN ${col} DATE DEFAULT NULL`);
          } catch {
            // ignore
          }
        }
      }
      if (existingCols.includes('certificate_content')) {
        try {
          await db.execute("ALTER TABLE medical_certificates MODIFY COLUMN certificate_content MEDIUMTEXT DEFAULT NULL");
        } catch {
          // ignore
        }
      }
      schemaEnsured = true;
    } catch (err) {
      console.error('medical_certificates migration error:', err.message);
    }
  }

  static async listMedicalCertificates(query) {
    const { patient_id, type_id, from_date, to_date, page = 1, limit = 20 } = query;
    const db = getDb();

    let where = 'WHERE 1=1';
    const params = [];

    if (patient_id) {
      where += ' AND mc.patient_id = ?';
      params.push(patient_id);
    }

    if (type_id) {
      where += ' AND mc.type_id = ?';
      params.push(type_id);
    }

    if (from_date) {
      where += ' AND mc.issued_date >= ?';
      params.push(from_date);
    }

    if (to_date) {
      where += ' AND mc.issued_date <= ?';
      params.push(to_date);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const countSql = `SELECT COUNT(*) as total FROM medical_certificates mc ${where}`;
    const [[countRow]] = await db.query(countSql, params);

    const dataSql = `
      SELECT
        mc.*,
        ct.name as certificate_type_name,
        p.name as patient_name,
        p.patient_id as patient_identifier,
        p.dob,
        p.gender,
        p.phone,
        c.name as clinic_name,
        u.name as created_by_username
      FROM medical_certificates mc
      LEFT JOIN certificate_types ct ON mc.type_id = ct.id
      LEFT JOIN patients p ON mc.patient_id = p.id
      LEFT JOIN clinics c ON mc.clinic_id = c.id
      LEFT JOIN users u ON mc.created_by = u.id
      ${where}
      ORDER BY mc.issued_date DESC, mc.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, Number(limit), offset];
    const [rows] = await db.query(dataSql, dataParams);

    return {
      certificates: rows,
      total: countRow.total || 0,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil((countRow.total || 0) / Number(limit)),
    };
  }

  static async getMedicalCertificate(id) {
    const db = getDb();

    const [rows] = await db.execute(
      `SELECT
        mc.*,
        ct.name as certificate_type_name,
        p.name as patient_name,
        p.patient_id as patient_identifier,
        p.dob,
        p.gender,
        p.phone,
        p.email,
        p.address,
        c.name as clinic_name,
        c.address as clinic_address,
        c.phone as clinic_phone,
        u.name as created_by_username
      FROM medical_certificates mc
      LEFT JOIN certificate_types ct ON mc.type_id = ct.id
      LEFT JOIN patients p ON mc.patient_id = p.id
      LEFT JOIN clinics c ON mc.clinic_id = c.id
      LEFT JOIN users u ON mc.created_by = u.id
      WHERE mc.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw ApiError.notFound('Medical certificate');
    }

    return { certificate: rows[0] };
  }

  static async createMedicalCertificate({ body, user }) {
    const {
      patient_id,
      doctor_name,
      doctor_registration_no,
      doctor_qualification,
      type_id,
      certificate_title,
      diagnosis,
      certificate_content,
      issued_date,
      valid_from,
      valid_until,
      resume_date,
      notes,
      header_image,
      footer_image,
      clinic_id,
    } = body;

    if (!patient_id || !doctor_name || !type_id || !certificate_title || !issued_date) {
      throw ApiError.badRequest('patient_id, doctor_name, type_id, certificate_title, and issued_date are required');
    }

    const db = getDb();
    await MedicalCertificateService.ensureMedicalCertTableExists(db);

    const created_by = user?.id || null;

    let resolvedClinicId = clinic_id || null;
    if (!resolvedClinicId && created_by) {
      try {
        const [userRows] = await db.execute('SELECT clinic_id FROM users WHERE id = ?', [created_by]);
        resolvedClinicId = userRows[0]?.clinic_id || null;
      } catch {
        // ignore
      }
    }

    // Joi.date() hands us a Date object; a bare 'YYYY-MM-DD' string is what a
    // DATE column wants and it sidesteps any server-timezone day-shift.
    const toDateStr = (v) => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(v);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    };

    const values = [
      patient_id,
      doctor_name,
      doctor_registration_no || null,
      doctor_qualification || null,
      type_id,
      certificate_title,
      diagnosis || null,
      certificate_content || '',
      toDateStr(issued_date),
      toDateStr(valid_from),
      toDateStr(valid_until),
      toDateStr(resume_date),
      notes || null,
      header_image || null,
      footer_image || null,
      created_by,
      resolvedClinicId,
    ];

    const insertSql = `INSERT INTO medical_certificates (
        patient_id, doctor_name, doctor_registration_no, doctor_qualification,
        type_id, certificate_title, diagnosis, certificate_content,
        issued_date, valid_from, valid_until, resume_date,
        notes, header_image, footer_image, created_by, clinic_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    try {
      const [result] = await db.execute(insertSql, values);
      return { id: result.insertId };
    } catch (err) {
      // Schema drift on the live table (missing column, or a column left with a
      // wrong type by an earlier buggy migration). Force a fresh schema pass and
      // retry once before giving up with a message that actually says what broke.
      const recoverable = ['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_BAD_NULL_ERROR']
        .includes(err.code);
      if (recoverable) {
        schemaEnsured = false;
        await MedicalCertificateService.ensureMedicalCertTableExists(db);
        try {
          const [result] = await db.execute(insertSql, values);
          return { id: result.insertId };
        } catch (err2) {
          console.error('Create medical certificate insert failed after schema repair:', err2.code, err2.sqlMessage);
          throw ApiError.internal(`Could not save certificate: ${err2.sqlMessage || err2.message}`);
        }
      }
      console.error('Create medical certificate insert failed:', err.code, err.sqlMessage);
      throw ApiError.internal(`Could not save certificate: ${err.sqlMessage || err.message}`);
    }
  }

  static async updateMedicalCertificate({ id, body }) {
    const {
      doctor_name,
      doctor_registration_no,
      doctor_qualification,
      type_id,
      certificate_title,
      diagnosis,
      certificate_content,
      issued_date,
      valid_from,
      valid_until,
      notes,
    } = body;

    const db = getDb();

    const [existing] = await db.execute('SELECT id FROM medical_certificates WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Medical certificate');
    }

    const toDateStr = (v) => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(v);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    };

    await db.execute(
      `UPDATE medical_certificates SET
        doctor_name = ?,
        doctor_registration_no = ?,
        doctor_qualification = ?,
        type_id = ?,
        certificate_title = ?,
        diagnosis = ?,
        certificate_content = ?,
        issued_date = ?,
        valid_from = ?,
        valid_until = ?,
        notes = ?
      WHERE id = ?`,
      [
        doctor_name,
        doctor_registration_no || null,
        doctor_qualification || null,
        type_id,
        certificate_title,
        diagnosis || null,
        certificate_content,
        toDateStr(issued_date),
        toDateStr(valid_from),
        toDateStr(valid_until),
        notes || null,
        id,
      ]
    );

    return { updated: true };
  }

  static async deleteMedicalCertificate(id) {
    const db = getDb();
    const [result] = await db.execute('DELETE FROM medical_certificates WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw ApiError.notFound('Medical certificate');
    }

    return { deleted: true };
  }

  static async listCertificateTemplates(query) {
    const { type_id, clinic_id } = query;
    const db = getDb();

    let where = 'WHERE 1=1';
    const params = [];

    if (type_id) {
      where += ' AND type_id = ?';
      params.push(type_id);
    }

    if (clinic_id) {
      where += ' AND (clinic_id = ? OR clinic_id IS NULL)';
      params.push(clinic_id);
    }

    const [rows] = await db.query(
      `SELECT * FROM medical_certificate_templates ${where} ORDER BY is_default DESC, template_name ASC`,
      params
    );

    return { templates: rows };
  }

  static async getCertificateTemplate(id) {
    const db = getDb();
    const [rows] = await db.execute('SELECT * FROM medical_certificate_templates WHERE id = ?', [id]);

    if (rows.length === 0) {
      throw ApiError.notFound('Certificate template');
    }

    return { template: rows[0] };
  }

  static async createCertificateTemplate(body) {
    const { template_name, type_id, template_content, header_image, footer_image, clinic_id, is_default = false } = body;

    if (!template_name || !type_id || !template_content) {
      throw ApiError.badRequest('template_name, type_id, and template_content are required');
    }

    const db = getDb();

    if (is_default) {
      if (clinic_id) {
        await db.execute('UPDATE medical_certificate_templates SET is_default = 0 WHERE type_id = ? AND clinic_id = ?', [
          type_id,
          clinic_id,
        ]);
      } else {
        await db.execute('UPDATE medical_certificate_templates SET is_default = 0 WHERE type_id = ? AND clinic_id IS NULL', [
          type_id,
        ]);
      }
    }

    const [result] = await db.execute(
      `INSERT INTO medical_certificate_templates (
        template_name, type_id, template_content, header_image, footer_image, clinic_id, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        template_name,
        type_id,
        template_content,
        header_image || null,
        footer_image || null,
        clinic_id || null,
        is_default ? 1 : 0,
      ]
    );

    return { id: result.insertId };
  }

  static async updateCertificateTemplate({ id, body }) {
    const { template_name, type_id, template_content, header_image, footer_image, is_default } = body;

    const db = getDb();

    const [existing] = await db.execute('SELECT clinic_id FROM medical_certificate_templates WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw ApiError.notFound('Certificate template');
    }

    if (is_default) {
      const clinic_id = existing[0].clinic_id;
      if (clinic_id) {
        await db.execute(
          'UPDATE medical_certificate_templates SET is_default = 0 WHERE type_id = ? AND clinic_id = ? AND id != ?',
          [type_id, clinic_id, id]
        );
      } else {
        await db.execute(
          'UPDATE medical_certificate_templates SET is_default = 0 WHERE type_id = ? AND clinic_id IS NULL AND id != ?',
          [type_id, id]
        );
      }
    }

    await db.execute(
      `UPDATE medical_certificate_templates SET
        template_name = ?,
        type_id = ?,
        template_content = ?,
        header_image = ?,
        footer_image = ?,
        is_default = ?
      WHERE id = ?`,
      [
        template_name,
        type_id,
        template_content,
        header_image || null,
        footer_image || null,
        is_default ? 1 : 0,
        id,
      ]
    );

    return { updated: true };
  }

  static async deleteCertificateTemplate(id) {
    const db = getDb();
    const [result] = await db.execute('DELETE FROM medical_certificate_templates WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      throw ApiError.notFound('Certificate template');
    }

    return { deleted: true };
  }
}

module.exports = MedicalCertificateService;
