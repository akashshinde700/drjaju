const { getDb } = require('../config/db');

// Get all custom lab tests for a patient
async function getCustomLabTests(req, res) {
  try {
    const { patientId } = req.query;
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const db = getDb();
    const [tests] = await db.execute(
      `SELECT id, patient_id, test_name, remark, result_value, unit, created_at, updated_at
       FROM custom_lab_tests
       WHERE patient_id = ?
       ORDER BY created_at DESC`,
      [patientId]
    );

    res.json({ customLabTests: tests });
  } catch (error) {
    console.error('Get custom lab tests error:', error);
    res.status(500).json({ error: 'Failed to fetch custom lab tests' });
  }
}

// Add a new custom lab test
async function addCustomLabTest(req, res) {
  try {
    const { patientId, test_name, remark, result_value, unit } = req.body;

    if (!patientId || !test_name) {
      return res.status(400).json({ error: 'Patient ID and test name are required' });
    }

    const db = getDb();
    const [result] = await db.execute(
      `INSERT INTO custom_lab_tests (patient_id, test_name, remark, result_value, unit)
       VALUES (?, ?, ?, ?, ?)`,
      [patientId, test_name, remark || null, result_value || null, unit || null]
    );

    const [newTest] = await db.execute(
      `SELECT id, patient_id, test_name, remark, result_value, unit, created_at, updated_at
       FROM custom_lab_tests
       WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ customLabTest: newTest[0] });
  } catch (error) {
    console.error('Add custom lab test error:', error);
    res.status(500).json({ error: 'Failed to add custom lab test' });
  }
}

// Update a custom lab test
async function updateCustomLabTest(req, res) {
  try {
    const { id } = req.params;
    const { test_name, remark, result_value, unit } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Test ID is required' });
    }

    const db = getDb();
    await db.execute(
      `UPDATE custom_lab_tests
       SET test_name = ?, remark = ?, result_value = ?, unit = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [test_name, remark || null, result_value || null, unit || null, id]
    );

    const [updatedTest] = await db.execute(
      `SELECT id, patient_id, test_name, remark, result_value, unit, created_at, updated_at
       FROM custom_lab_tests
       WHERE id = ?`,
      [id]
    );

    if (updatedTest.length === 0) {
      return res.status(404).json({ error: 'Custom lab test not found' });
    }

    res.json({ customLabTest: updatedTest[0] });
  } catch (error) {
    console.error('Update custom lab test error:', error);
    res.status(500).json({ error: 'Failed to update custom lab test' });
  }
}

// Delete a custom lab test
async function deleteCustomLabTest(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Test ID is required' });
    }

    const db = getDb();
    const [result] = await db.execute(
      `DELETE FROM custom_lab_tests WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Custom lab test not found' });
    }

    res.json({ message: 'Custom lab test deleted successfully' });
  } catch (error) {
    console.error('Delete custom lab test error:', error);
    res.status(500).json({ error: 'Failed to delete custom lab test' });
  }
}

module.exports = {
  getCustomLabTests,
  addCustomLabTest,
  updateCustomLabTest,
  deleteCustomLabTest
};
