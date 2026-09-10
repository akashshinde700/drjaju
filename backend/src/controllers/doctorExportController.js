const { getDb } = require('../config/db');
const fs = require('fs').promises;
const path = require('path');

const tableColumnCache = new Map();

/**
 * Get all data related to a specific doctor
 */
async function getDoctorData(doctorId, startDate = null, endDate = null) {
  const db = getDb();

  try {
    // Get doctor details with user info
    const [doctors] = await db.execute(`
      SELECT
        d.*,
        u.name as doctor_name,
        u.email as doctor_email,
        u.phone as doctor_phone,
        c.name as clinic_name,
        c.address as clinic_address,
        c.city as clinic_city
      FROM doctors d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON d.clinic_id = c.id
      WHERE d.id = ?
    `, [doctorId]);

    if (doctors.length === 0) {
      throw new Error('Doctor not found');
    }

    const doctorInfo = doctors[0];

    // Build date filter
    let dateFilter = '';
    let dateParams = [doctorId];

    if (startDate && endDate) {
      dateFilter = ' AND appointment_date BETWEEN ? AND ?';
      dateParams.push(startDate, endDate);
    }

    // Get appointments
    const [appointments] = await db.execute(`
      SELECT
        a.*,
        p.patient_id as patient_unique_id,
        p.name as patient_name,
        p.phone as patient_phone,
        p.email as patient_email,
        p.dob,
        p.gender,
        p.blood_group
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      WHERE a.doctor_id = ?${dateFilter}
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `, dateParams);

    // Get unique patient IDs from appointments
    const patientIds = [...new Set(appointments.map(a => a.patient_id))];

    // Get prescriptions
    let prescriptions = [];
    if (patientIds.length > 0) {
      const placeholders = patientIds.map(() => '?').join(',');
      const [prescData] = await db.execute(`
        SELECT
          pr.*,
          p.patient_id as patient_unique_id,
          p.name as patient_name,
          GROUP_CONCAT(
            CONCAT(
              pi.dosage, ' | ',
              pi.frequency, ' | ',
              pi.duration, ' | ',
              IFNULL(pi.notes, '')
            ) SEPARATOR '; '
          ) as medications
        FROM prescriptions pr
        LEFT JOIN patients p ON pr.patient_id = p.id
        LEFT JOIN prescription_items pi ON pr.id = pi.prescription_id
        WHERE pr.doctor_id = ? AND pr.patient_id IN (${placeholders})
        GROUP BY pr.id
        ORDER BY pr.prescribed_date DESC
      `, [doctorId, ...patientIds]);
      prescriptions = prescData;
    }

    // Get lab investigations
    let labInvestigations = [];
    if (patientIds.length > 0) {
      const placeholders = patientIds.map(() => '?').join(',');
      const [labData] = await db.execute(`
        SELECT
          l.*,
          p.patient_id as patient_unique_id,
          p.name as patient_name
        FROM lab_investigations l
        LEFT JOIN patients p ON l.patient_id = p.id
        WHERE l.doctor_id = ? AND l.patient_id IN (${placeholders})
        ORDER BY l.ordered_date DESC
      `, [doctorId, ...patientIds]);
      labInvestigations = labData;
    }

    // Get bills (via appointments)
    let bills = [];
    if (patientIds.length > 0) {
      const placeholders = patientIds.map(() => '?').join(',');
      const [billData] = await db.execute(`
        SELECT
          b.*,
          p.patient_id as patient_unique_id,
          p.name as patient_name,
          a.appointment_date
        FROM bills b
        LEFT JOIN patients p ON b.patient_id = p.id
        LEFT JOIN appointments a ON b.appointment_id = a.id
        WHERE a.doctor_id = ? AND b.patient_id IN (${placeholders})
        ORDER BY b.bill_date DESC
      `, [doctorId, ...patientIds]);
      bills = billData;
    }

    // Get medical records
    let medicalRecords = [];
    if (patientIds.length > 0) {
      const placeholders = patientIds.map(() => '?').join(',');
      const [recordData] = await db.execute(`
        SELECT
          m.*,
          p.patient_id as patient_unique_id,
          p.name as patient_name
        FROM medical_records m
        LEFT JOIN patients p ON m.patient_id = p.id
        WHERE m.doctor_id = ? AND m.patient_id IN (${placeholders})
        ORDER BY m.uploaded_date DESC
      `, [doctorId, ...patientIds]);
      medicalRecords = recordData;
    }

    // Get unique patients list
    let patients = [];
    if (patientIds.length > 0) {
      const placeholders = patientIds.map(() => '?').join(',');
      const [patientData] = await db.execute(`
        SELECT * FROM patients
        WHERE id IN (${placeholders})
        ORDER BY name
      `, patientIds);
      patients = patientData;
    }

    return {
      doctorInfo,
      appointments,
      prescriptions,
      labInvestigations,
      bills,
      medicalRecords,
      patients
    };

  } catch (error) {
    console.error('Get doctor data error:', error);
    throw error;
  }
}

/**
 * Export doctor data as CSV
 */
async function exportDoctorCSV(req, res) {
  try {
    const { doctorId, table, startDate, endDate } = req.query;

    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }

    const data = await getDoctorData(doctorId, startDate, endDate);

    let rows = [];
    let filename = '';

    // Select which table to export
    switch (table) {
      case 'appointments':
        rows = data.appointments;
        filename = `doctor-${doctorId}-appointments-${Date.now()}.csv`;
        break;
      case 'prescriptions':
        rows = data.prescriptions;
        filename = `doctor-${doctorId}-prescriptions-${Date.now()}.csv`;
        break;
      case 'lab_investigations':
        rows = data.labInvestigations;
        filename = `doctor-${doctorId}-lab-investigations-${Date.now()}.csv`;
        break;
      case 'bills':
        rows = data.bills;
        filename = `doctor-${doctorId}-bills-${Date.now()}.csv`;
        break;
      case 'patients':
        rows = data.patients;
        filename = `doctor-${doctorId}-patients-${Date.now()}.csv`;
        break;
      case 'medical_records':
        rows = data.medicalRecords;
        filename = `doctor-${doctorId}-medical-records-${Date.now()}.csv`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid table name' });
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No data found' });
    }

    // Generate CSV
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
        if (value instanceof Date) return `"${value.toISOString()}"`;
        return value;
      }).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csv); // UTF-8 BOM for Excel compatibility

  } catch (error) {
    console.error('Export doctor CSV error:', error);
    res.status(500).json({ error: 'Failed to export CSV', details: error.message });
  }
}

/**
 * Export doctor data as Excel (XLSX)
 */
async function exportDoctorExcel(req, res) {
  try {
    const { doctorId, startDate, endDate, tables } = req.query;

    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }

    const data = await getDoctorData(doctorId, startDate, endDate);

    // Parse tables parameter (comma-separated)
    const tablesToExport = tables ? tables.split(',') : ['all'];

    // Create Excel file manually (without external library)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `doctor-${data.doctorInfo.doctor_name || doctorId}-export-${timestamp}.html`;

    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Doctor Export - ${data.doctorInfo.doctor_name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    .info { background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
    th { background: #3498db; color: white; padding: 10px; text-align: left; }
    td { border: 1px solid #bdc3c7; padding: 8px; }
    tr:nth-child(even) { background: #f8f9fa; }
  </style>
</head>
<body>
  <h1>Doctor Data Export</h1>

  <div class="info">
    <h3>Doctor Information</h3>
    <p><strong>Name:</strong> ${data.doctorInfo.doctor_name || 'N/A'}</p>
    <p><strong>Specialization:</strong> ${data.doctorInfo.specialization || 'N/A'}</p>
    <p><strong>License:</strong> ${data.doctorInfo.license_number || 'N/A'}</p>
    <p><strong>Email:</strong> ${data.doctorInfo.doctor_email || 'N/A'}</p>
    <p><strong>Phone:</strong> ${data.doctorInfo.doctor_phone || 'N/A'}</p>
    <p><strong>Clinic:</strong> ${data.doctorInfo.clinic_name || 'N/A'}</p>
  </div>
`;

    // Export tables based on selection
    if (tablesToExport.includes('all') || tablesToExport.includes('patients')) {
      htmlContent += generateTableHTML('Patients', data.patients);
    }

    if (tablesToExport.includes('all') || tablesToExport.includes('appointments')) {
      htmlContent += generateTableHTML('Appointments', data.appointments);
    }

    if (tablesToExport.includes('all') || tablesToExport.includes('prescriptions')) {
      htmlContent += generateTableHTML('Prescriptions', data.prescriptions);
    }

    if (tablesToExport.includes('all') || tablesToExport.includes('lab_investigations')) {
      htmlContent += generateTableHTML('Lab Investigations', data.labInvestigations);
    }

    if (tablesToExport.includes('all') || tablesToExport.includes('bills')) {
      htmlContent += generateTableHTML('Bills', data.bills);
    }

    if (tablesToExport.includes('all') || tablesToExport.includes('medical_records')) {
      htmlContent += generateTableHTML('Medical Records', data.medicalRecords);
    }

    htmlContent += `
</body>
</html>
`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(htmlContent);

  } catch (error) {
    console.error('Export doctor Excel error:', error);
    res.status(500).json({ error: 'Failed to export Excel', details: error.message });
  }
}

/**
 * Generate HTML table from data
 */
function generateTableHTML(title, rows) {
  if (!rows || rows.length === 0) {
    return `<h2>${title}</h2><p>No data available</p>`;
  }

  const headers = Object.keys(rows[0]);

  let html = `<h2>${title} (${rows.length} records)</h2>`;
  html += '<table>';
  html += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

  rows.forEach(row => {
    html += '<tr>';
    headers.forEach(header => {
      let value = row[header];
      if (value === null || value === undefined) value = '';
      if (value instanceof Date) value = value.toISOString().split('T')[0];
      html += `<td>${value}</td>`;
    });
    html += '</tr>';
  });

  html += '</table>';
  return html;
}

/**
 * Export doctor data as SQL file
 */
async function exportDoctorSQL(req, res) {
  try {
    const { doctorId, startDate, endDate } = req.query;

    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }

    const db = getDb();
    const data = await getDoctorData(doctorId, startDate, endDate);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeDoctorName = String(data.doctorInfo.doctor_name || doctorId).replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
    const filename = `doctor-${safeDoctorName}-backup-${timestamp}.sql`;

    // Generate SQL content
    let sqlContent = `-- =====================================================\n`;
    sqlContent += `-- Doctor Data Export\n`;
    sqlContent += `-- Doctor: ${data.doctorInfo.doctor_name}\n`;
    sqlContent += `-- Specialization: ${data.doctorInfo.specialization}\n`;
    sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
    sqlContent += `-- =====================================================\n\n`;
    sqlContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    // Export doctor info
    sqlContent += await generateSQLInsert(db, 'doctors', [data.doctorInfo]);

    // Export patients
    if (data.patients.length > 0) {
      sqlContent += await generateSQLInsert(db, 'patients', data.patients);
    }

    // Export appointments
    if (data.appointments.length > 0) {
      sqlContent += await generateSQLInsert(db, 'appointments', data.appointments);
    }

    // Export prescriptions
    if (data.prescriptions.length > 0) {
      sqlContent += await generateSQLInsert(db, 'prescriptions', data.prescriptions);
    }

    // Export lab investigations
    if (data.labInvestigations.length > 0) {
      sqlContent += await generateSQLInsert(db, 'lab_investigations', data.labInvestigations);
    }

    // Export bills
    if (data.bills.length > 0) {
      sqlContent += await generateSQLInsert(db, 'bills', data.bills);
    }

    // Export medical records
    if (data.medicalRecords.length > 0) {
      sqlContent += await generateSQLInsert(db, 'medical_records', data.medicalRecords);
    }

    sqlContent += `\nSET FOREIGN_KEY_CHECKS = 1;\n`;
    sqlContent += `-- Export completed successfully\n`;

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(sqlContent);

  } catch (error) {
    console.error('Export doctor SQL error:', error);
    res.status(500).json({ error: 'Failed to export SQL', details: error.message });
  }
}

/**
 * Get actual DB columns for a table.
 */
async function getTableColumns(db, tableName) {
  if (tableColumnCache.has(tableName)) {
    return tableColumnCache.get(tableName);
  }

  const [rows] = await db.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [tableName]
  );

  const columns = rows.map((r) => r.COLUMN_NAME);
  tableColumnCache.set(tableName, columns);
  return columns;
}

function toSqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'bigint') return String(val);
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

/**
 * Generate SQL INSERT statements using only real table columns.
 */
async function generateSQLInsert(db, tableName, rows) {
  if (!rows || rows.length === 0) return '';

  const actualColumns = await getTableColumns(db, tableName);
  if (!actualColumns.length) return '';

  const columns = actualColumns.filter((col) => rows.some((row) => Object.prototype.hasOwnProperty.call(row, col)));
  if (!columns.length) return '';

  let sql = `-- Table: ${tableName}\n`;
  sql += `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES\n`;

  const values = rows.map((row) => {
    const rowValues = columns.map((col) => toSqlLiteral(row[col]));
    return `  (${rowValues.join(', ')})`;
  });

  sql += values.join(',\n');
  sql += ';\n\n';

  return sql;
}

/**
 * Get doctor statistics for export summary
 */
async function getDoctorStats(req, res) {
  try {
    const { doctorId, startDate, endDate } = req.query;

    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }

    const data = await getDoctorData(doctorId, startDate, endDate);

    const stats = {
      doctorInfo: {
        name: data.doctorInfo.doctor_name,
        specialization: data.doctorInfo.specialization,
        license: data.doctorInfo.license_number,
        clinic: data.doctorInfo.clinic_name
      },
      counts: {
        patients: data.patients.length,
        appointments: data.appointments.length,
        prescriptions: data.prescriptions.length,
        labInvestigations: data.labInvestigations.length,
        bills: data.bills.length,
        medicalRecords: data.medicalRecords.length
      },
      appointmentStats: {
        scheduled: data.appointments.filter(a => a.status === 'scheduled').length,
        completed: data.appointments.filter(a => a.status === 'completed').length,
        cancelled: data.appointments.filter(a => a.status === 'cancelled').length,
        noShow: data.appointments.filter(a => a.status === 'no-show').length
      },
      revenue: {
        totalBills: data.bills.length,
        totalAmount: data.bills.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0),
        paidAmount: data.bills.filter(b => b.payment_status === 'paid')
          .reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0),
        pendingAmount: data.bills.filter(b => b.payment_status === 'pending')
          .reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0)
      }
    };

    res.json(stats);

  } catch (error) {
    console.error('Get doctor stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics', details: error.message });
  }
}

module.exports = {
  exportDoctorCSV,
  exportDoctorExcel,
  exportDoctorSQL,
  getDoctorStats
};
