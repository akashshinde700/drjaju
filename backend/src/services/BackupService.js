const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');

const { getDb } = require('../config/db');
const env = require('../config/env');
const { ApiError } = require('../utils');

const execAsync = promisify(exec);

class BackupService {
  static _getBackupDir() {
    return path.join(__dirname, '../../backups');
  }

  static _validateBackupFilename(filename) {
    const allowed = filename.endsWith('.sql') || filename.endsWith('.csv') || filename.endsWith('.html');
    if (!allowed || filename.includes('..') || filename.includes('/')) {
      throw ApiError.badRequest('Invalid filename');
    }
  }

  static _getJobsDir() {
    return path.join(BackupService._getBackupDir(), 'jobs');
  }

  static async startExportJob(type = 'sql') {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const jobsDir = BackupService._getJobsDir();
    await fs.mkdir(jobsDir, { recursive: true });
    const jobFile = path.join(jobsDir, `${jobId}.json`);

    await fs.writeFile(jobFile, JSON.stringify({
      status: 'processing',
      type,
      startedAt: new Date().toISOString()
    }), 'utf8');

    BackupService._runExportJob(jobFile, type).catch(console.error);

    return { jobId, status: 'processing', type };
  }

  static async _runExportJob(jobFile, type = 'sql') {
    try {
      let result;
      if (type === 'csv') result = await BackupService.exportDatabaseCSVToFile();
      else if (type === 'excel') result = await BackupService.exportDatabaseExcelToFile();
      else result = await BackupService.exportDatabase();

      await fs.writeFile(jobFile, JSON.stringify({
        status: 'done',
        filename: result.filename,
        size: result.size,
        completedAt: new Date().toISOString()
      }), 'utf8');
    } catch (error) {
      console.error(`Export job (${type}) failed:`, error.message);
      await fs.writeFile(jobFile, JSON.stringify({
        status: 'error',
        error: error.message,
        completedAt: new Date().toISOString()
      }), 'utf8').catch(console.error);
    }
  }

  static async getJobStatus(jobId) {
    if (!/^job-\d+-[a-z0-9]{6}$/.test(jobId)) {
      throw ApiError.badRequest('Invalid job ID');
    }
    const jobsDir = BackupService._getJobsDir();
    const jobFile = path.join(jobsDir, `${jobId}.json`);
    try {
      const content = await fs.readFile(jobFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw ApiError.notFound('Job');
      }
      throw error;
    }
  }

  static async exportDatabase() {
    const dbConfig = env.db;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = BackupService._getBackupDir();
    const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

    await fs.mkdir(backupDir, { recursive: true });

    const command = `mysqldump -h ${dbConfig.host} -u ${dbConfig.user} -p${dbConfig.password} ${dbConfig.database} > "${backupFile}"`;

    try {
      await execAsync(command);
    } catch (error) {
      // If file has real content despite error, use it; otherwise try manual export
      const stats = await fs.stat(backupFile).catch(() => null);
      if (!stats || stats.size < 1024) {
        console.warn('mysqldump failed, creating manual export:', error.message);
        return await BackupService._manualExport(backupFile);
      }
      console.warn('mysqldump had warnings but file created:', error.message);
    }

    const stats = await fs.stat(backupFile);
    return {
      filename: path.basename(backupFile),
      path: backupFile,
      size: stats.size,
    };
  }

  static async _manualExport(backupFile) {
    const db = getDb();
    let sqlContent = '-- Database Backup\n';
    sqlContent += `-- Generated: ${new Date().toISOString()}\n\n`;
    sqlContent += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

    const [tables] = await db.execute('SHOW TABLES');
    const tableNameKey = `Tables_in_${env.db.database}`;

    for (const table of tables) {
      const tableName = table[tableNameKey];
      sqlContent += `-- Table: ${tableName}\n`;
      sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;

      const [createTable] = await db.execute(`SHOW CREATE TABLE \`${tableName}\``);
      sqlContent += createTable[0]['Create Table'] + ';\n\n';

      const [rows] = await db.execute(`SELECT * FROM \`${tableName}\``);
      if (rows.length > 0) {
        sqlContent += `INSERT INTO \`${tableName}\` VALUES\n`;
        const values = rows.map((row) => {
          const rowValues = Object.values(row).map((val) => {
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            return val;
          });
          return `(${rowValues.join(', ')})`;
        });
        sqlContent += values.join(',\n') + ';\n\n';
      }
    }

    sqlContent += 'SET FOREIGN_KEY_CHECKS = 1;\n';

    await fs.writeFile(backupFile, sqlContent, 'utf8');

    const stats = await fs.stat(backupFile);
    return {
      filename: path.basename(backupFile),
      path: backupFile,
      size: stats.size,
    };
  }

  static async listBackups() {
    const backupDir = BackupService._getBackupDir();

    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = [];

      for (const file of files) {
        if (file.endsWith('.sql') || file.endsWith('.csv') || file.endsWith('.html')) {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          if (stats.size === 0) continue; // skip files still being written
          backupFiles.push({
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
          });
        }
      }

      backupFiles.sort((a, b) => b.created - a.created);
      return { backups: backupFiles };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { backups: [] };
      }
      throw error;
    }
  }

  static async getBackupFilePath(filename) {
    BackupService._validateBackupFilename(filename);

    const backupDir = BackupService._getBackupDir();
    const backupFile = path.join(backupDir, filename);

    try {
      await fs.access(backupFile);
      return { path: backupFile, filename };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw ApiError.notFound('Backup file');
      }
      throw error;
    }
  }

  static async deleteBackup(filename) {
    BackupService._validateBackupFilename(filename);

    const backupDir = BackupService._getBackupDir();
    const backupFile = path.join(backupDir, filename);

    try {
      await fs.unlink(backupFile);
      return { deleted: true };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw ApiError.notFound('Backup file');
      }
      throw error;
    }
  }

  static async exportData({ table, format = 'json' }) {
    if (!table) {
      throw ApiError.badRequest('Table name is required');
    }

    const validTables = ['patients', 'appointments', 'prescriptions', 'bills', 'users', 'clinics'];
    if (!validTables.includes(table)) {
      throw ApiError.badRequest('Invalid table name');
    }

    const db = getDb();
    const [rows] = await db.execute(`SELECT * FROM \`${table}\``);

    if (format === 'csv') {
      if (rows.length === 0) {
        throw ApiError.notFound('Data');
      }

      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(','),
        ...rows.map((row) =>
          headers
            .map((header) => {
              const value = row[header];
              if (value === null) return '';
              if (typeof value === 'string') return `\"${value.replace(/\"/g, '\"\"')}\"`;
              return value;
            })
            .join(',')
        ),
      ].join('\n');

      return {
        type: 'file',
        contentType: 'text/csv',
        filename: `${table}-${Date.now()}.csv`,
        buffer: Buffer.from(csv, 'utf8'),
      };
    }

    return {
      type: 'json',
      table,
      count: rows.length,
      data: rows,
    };
  }

  static async exportDatabaseCSVToFile() {
    const db = getDb();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = BackupService._getBackupDir();
    await fs.mkdir(backupDir, { recursive: true });
    const filename = `database-export-${timestamp}.csv`;
    const filePath = path.join(backupDir, filename);

    await fs.writeFile(filePath, '﻿', 'utf8'); // BOM

    const [tables] = await db.execute('SHOW TABLES');
    const tableNameKey = `Tables_in_${env.db.database}`;

    for (const table of tables) {
      const tableName = table[tableNameKey];
      try {
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) as total FROM \`${tableName}\``);
        if (total === 0) continue;

        await fs.appendFile(filePath, `\n=== ${tableName} (${total} records) ===\n`, 'utf8');

        const CHUNK = 5000;
        let offset = 0;
        let headers = null;

        while (offset < total) {
          const [rows] = await db.execute(`SELECT * FROM \`${tableName}\` LIMIT ${CHUNK} OFFSET ${offset}`);
          if (rows.length === 0) break;

          if (!headers) {
            headers = Object.keys(rows[0]);
            await fs.appendFile(filePath, headers.join(',') + '\n', 'utf8');
          }

          const chunk = rows.map((row) => {
            return headers.map((h) => {
              const v = row[h];
              if (v === null || v === undefined) return '';
              if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`;
              if (v instanceof Date) return `"${v.toISOString()}"`;
              if (typeof v === 'object') return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
              return v;
            }).join(',');
          }).join('\n') + '\n';

          await fs.appendFile(filePath, chunk, 'utf8');
          offset += CHUNK;
        }
        await fs.appendFile(filePath, '\n', 'utf8');
      } catch (error) {
        console.error(`CSV export error on table ${tableName}:`, error.message);
        await fs.appendFile(filePath, `\n=== ${tableName} - Error: ${error.message} ===\n\n`, 'utf8').catch(() => {});
      }
    }

    const stats = await fs.stat(filePath);
    return { filename, path: filePath, size: stats.size };
  }

  static async exportDatabaseExcelToFile() {
    const db = getDb();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = BackupService._getBackupDir();
    await fs.mkdir(backupDir, { recursive: true });
    const filename = `database-export-${timestamp}.html`;
    const filePath = path.join(backupDir, filename);

    const [tables] = await db.execute('SHOW TABLES');
    const tableNameKey = `Tables_in_${env.db.database}`;

    const header = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DB Export</title>
<style>body{font-family:Arial,sans-serif;margin:20px}h2{background:#ecf0f1;padding:8px}
table{border-collapse:collapse;width:100%;margin-bottom:20px;font-size:12px}
th{background:#3498db;color:#fff;padding:6px;text-align:left}
td{border:1px solid #bdc3c7;padding:5px}tr:nth-child(even){background:#f8f9fa}
.note{color:#e67e22;font-size:12px}</style></head><body>
<h1>Database Export — ${new Date().toLocaleString()}</h1>\n`;

    await fs.writeFile(filePath, header, 'utf8');

    const ROW_LIMIT = 500;
    for (const table of tables) {
      const tableName = table[tableNameKey];
      try {
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) as total FROM \`${tableName}\``);
        const [rows] = await db.execute(`SELECT * FROM \`${tableName}\` LIMIT ${ROW_LIMIT}`);

        if (rows.length === 0) {
          await fs.appendFile(filePath, `<h2>${tableName}</h2><p>No data</p>\n`, 'utf8');
          continue;
        }

        const headers = Object.keys(rows[0]);
        const truncated = total > ROW_LIMIT;
        let block = `<h2>${tableName} (${total} records${truncated ? `, showing first ${ROW_LIMIT}` : ''})</h2>`;
        if (truncated) block += `<p class="note">Use SQL export for full data.</p>`;
        block += '<table><tr>' + headers.map((h) => `<th>${h}</th>`).join('') + '</tr>';

        for (const row of rows) {
          block += '<tr>';
          for (const h of headers) {
            let v = row[h];
            if (v === null || v === undefined) v = '';
            if (v instanceof Date) v = v.toISOString().split('T')[0];
            if (typeof v === 'object') v = JSON.stringify(v);
            block += `<td>${String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
          }
          block += '</tr>';
        }
        block += '</table>\n';
        await fs.appendFile(filePath, block, 'utf8');
      } catch (error) {
        console.error(`Excel export error on table ${tableName}:`, error.message);
        await fs.appendFile(filePath, `<h2>${tableName}</h2><p>Error: ${error.message}</p>\n`, 'utf8').catch(() => {});
      }
    }

    await fs.appendFile(filePath, '</body></html>', 'utf8');
    const stats = await fs.stat(filePath);
    return { filename, path: filePath, size: stats.size };
  }

  static async exportDatabaseExcel() {
    const db = getDb();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `database-export-${timestamp}.html`;

    const [tables] = await db.execute('SHOW TABLES');
    const tableNameKey = `Tables_in_${env.db.database}`;

    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Complete Database Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; background: #ecf0f1; padding: 10px; border-radius: 5px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 30px; font-size: 12px; }
    th { background: #3498db; color: white; padding: 8px; text-align: left; position: sticky; top: 0; }
    td { border: 1px solid #bdc3c7; padding: 6px; }
    tr:nth-child(even) { background: #f8f9fa; }
    .summary { background: #e8f5e9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>Complete Database Export</h1>
  <div class="summary">
    <p><strong>Database:</strong> ${env.db.database}</p>
    <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Total Tables:</strong> ${tables.length}</p>
  </div>
`;

    for (const table of tables) {
      const tableName = table[tableNameKey];

      const ROW_LIMIT = 500;
      try {
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) as total FROM \`${tableName}\``);
        const [rows] = await db.execute(`SELECT * FROM \`${tableName}\` LIMIT ${ROW_LIMIT}`);

        if (rows.length > 0) {
          const headers = Object.keys(rows[0]);
          const truncated = total > ROW_LIMIT;

          htmlContent += `<h2>${tableName} (${total} records${truncated ? ` — showing first ${ROW_LIMIT}` : ''})</h2>`;
          if (truncated) {
            htmlContent += `<p style="color:#e67e22"><strong>Note:</strong> Table has ${total} records. Only first ${ROW_LIMIT} shown. Use SQL export for full data.</p>`;
          }
          htmlContent += '<table>';
          htmlContent += '<tr>' + headers.map((h) => `<th>${h}</th>`).join('') + '</tr>';

          rows.forEach((row) => {
            htmlContent += '<tr>';
            headers.forEach((header) => {
              let value = row[header];
              if (value === null || value === undefined) value = '';
              if (value instanceof Date) value = value.toISOString().split('T')[0];
              if (typeof value === 'object') value = JSON.stringify(value);
              htmlContent += `<td>${String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
            });
            htmlContent += '</tr>';
          });

          htmlContent += '</table>';
        } else {
          htmlContent += `<h2>${tableName}</h2><p>No data available</p>`;
        }
      } catch (error) {
        console.error(`Error exporting table ${tableName}:`, error);
        htmlContent += `<h2>${tableName}</h2><p>Error: ${error.message}</p>`;
      }
    }

    htmlContent += `
  <p style="margin-top: 30px; text-align: center; color: #7f8c8d;">
    <small>Generated by Patient Management System - ${new Date().toISOString()}</small>
  </p>
</body>
</html>
`;

    return {
      filename,
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      buffer: Buffer.from(htmlContent, 'utf8'),
    };
  }

  static async exportDatabaseCSV() {
    const db = getDb();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `database-export-${timestamp}.csv`;

    const [tables] = await db.execute('SHOW TABLES');
    const tableNameKey = `Tables_in_${env.db.database}`;

    let csvContent = '';

    for (const table of tables) {
      const tableName = table[tableNameKey];

      try {
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) as total FROM \`${tableName}\``);
        if (total === 0) continue;

        csvContent += `\n=== ${tableName} (${total} records) ===\n`;

        // Fetch first chunk to get headers
        const CHUNK = 5000;
        let offset = 0;
        let headersWritten = false;
        let headers = [];

        while (offset < total) {
          const [rows] = await db.execute(`SELECT * FROM \`${tableName}\` LIMIT ${CHUNK} OFFSET ${offset}`);
          if (rows.length === 0) break;

          if (!headersWritten) {
            headers = Object.keys(rows[0]);
            csvContent += headers.join(',') + '\n';
            headersWritten = true;
          }

          rows.forEach((row) => {
            const values = headers.map((header) => {
              const value = row[header];
              if (value === null || value === undefined) return '';
              if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
              if (value instanceof Date) return `"${value.toISOString()}"`;
              if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
              return value;
            });
            csvContent += values.join(',') + '\n';
          });

          offset += CHUNK;
        }

        csvContent += '\n';
      } catch (error) {
        console.error(`Error exporting table ${tableName}:`, error);
        csvContent += `\n=== ${tableName} - Error: ${error.message} ===\n\n`;
      }
    }

    return {
      filename,
      contentType: 'text/csv; charset=utf-8',
      buffer: Buffer.from('\ufeff' + csvContent, 'utf8'),
    };
  }
}

module.exports = BackupService;
