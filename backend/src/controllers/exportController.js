const { getDb } = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Helper: Build formatted patient export data
async function getPatientExportData(patientId, db) {
  // Patient details
  const [patientRows] = await db.execute(
    'SELECT * FROM patients WHERE id = ? LIMIT 1',
    [patientId]
  );

  if (!patientRows || patientRows.length === 0) {
    return null;
  }

  const patient = patientRows[0];

  // Prescriptions with full details
  const [prescriptions] = await db.execute(
    `SELECT pr.*,
            u.name as doctor_name,
            u.id as doctor_user_id
     FROM prescriptions pr
     LEFT JOIN doctors d ON pr.doctor_id = d.id
     LEFT JOIN users u ON d.user_id = u.id
     WHERE pr.patient_id = ?
     ORDER BY pr.prescribed_date DESC`,
    [patientId]
  );

  // Prescription items (medicines) for each prescription
  let prescriptionItems = [];
  if (prescriptions.length > 0) {
    const ids = prescriptions.map(p => p.id);
    const placeholders = ids.map(() => '?').join(',');
    const [items] = await db.execute(
      `SELECT pi.*, m.name as medication_name, m.generic_name, m.brand
       FROM prescription_items pi
       LEFT JOIN medicines m ON pi.medicine_id = m.id
       WHERE pi.prescription_id IN (${placeholders})
       ORDER BY pi.prescription_id, pi.sort_order`,
      ids
    );
    prescriptionItems = items;
  }

  // Prescription diagnoses
  let prescriptionDiagnoses = [];
  if (prescriptions.length > 0) {
    const ids = prescriptions.map(p => p.id);
    const placeholders = ids.map(() => '?').join(',');
    const [diagnoses] = await db.execute(
      `SELECT pd.* FROM prescription_diagnoses pd
       WHERE pd.prescription_id IN (${placeholders})
       ORDER BY pd.prescription_id, pd.sort_order`,
      ids
    );
    prescriptionDiagnoses = diagnoses;
  }

  // Patient allergies
  const [allergies] = await db.execute(
    'SELECT * FROM patient_allergies WHERE patient_id = ? AND is_active = 1',
    [patientId]
  );

  // Patient chronic conditions
  const [conditions] = await db.execute(
    'SELECT * FROM patient_chronic_conditions WHERE patient_id = ? AND status = "Active"',
    [patientId]
  );

  // Vitals
  const [vitals] = await db.execute(
    'SELECT * FROM patient_vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 20',
    [patientId]
  );

  // Lab investigations
  const [labs] = await db.execute(
    'SELECT * FROM lab_investigations WHERE patient_id = ? ORDER BY ordered_date DESC LIMIT 20',
    [patientId]
  );

  // Appointments
  const [appointments] = await db.execute(
    `SELECT a.*, u.name as doctor_name
     FROM appointments a
     LEFT JOIN doctors d ON a.doctor_id = d.id
     LEFT JOIN users u ON d.user_id = u.id
     WHERE a.patient_id = ?
     ORDER BY a.appointment_date DESC LIMIT 20`,
    [patientId]
  );

  return {
    patient,
    prescriptions,
    prescriptionItems,
    prescriptionDiagnoses,
    allergies,
    conditions,
    vitals,
    labs,
    appointments
  };
}

// Helper: Get doctor name for export
function getDoctorName(prescription) {
  return prescription.doctor_name || 'Unknown Doctor';
}

// Helper: Format date
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// Export to JSON
async function exportAsJSON(req, res) {
  try {
    const { patientId, allPatients, doctorId } = req.query;
    const db = getDb();

    let data = {};

    if (allPatients === 'true') {
      // Export all patients (filtered by doctor if provided)
      const query = doctorId
        ? 'SELECT id FROM patients WHERE primary_doctor_id = ? ORDER BY name'
        : 'SELECT id FROM patients ORDER BY name';
      const params = doctorId ? [doctorId] : [];
      const [patients] = await db.execute(query, params);

      data.patients = [];
      for (const p of patients) {
        const patientData = await getPatientExportData(p.id, db);
        if (patientData) data.patients.push(patientData);
      }
      data.exportType = 'all_patients';
      data.totalPatients = data.patients.length;
    } else {
      // Single patient
      const patientData = await getPatientExportData(parseInt(patientId), db);
      if (!patientData) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      data = patientData;
      data.exportType = 'single_patient';
    }

    data.exportDate = new Date().toISOString();
    data.exportFormat = 'json';

    const filename = allPatients === 'true'
      ? `all-patients-export-${Date.now()}.json`
      : `patient-${data.patient?.patient_id || 'export'}-${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('JSON export error:', error);
    res.status(500).json({ error: 'Failed to export as JSON', details: error.message });
  }
}

// Export to PDF
async function exportAsPDF(req, res) {
  try {
    const { patientId, allPatients, doctorId } = req.query;
    const db = getDb();

    // For PDF, we'll handle single patient only (multiple patients would be too large)
    if (allPatients === 'true') {
      return res.status(400).json({ 
        error: 'PDF export for all patients not supported. Use JSON or Excel instead.' 
      });
    }

    const patientData = await getPatientExportData(parseInt(patientId), db);
    if (!patientData) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const { patient, prescriptions, prescriptionItems, prescriptionDiagnoses } = patientData;

    // Create PDF document
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    const filename = `patient-${patient.patient_id}-export-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('PATIENT MEDICAL RECORD', { align: 'center' });
    doc.fontSize(10).text(`Export Date: ${formatDate(new Date())}`, { align: 'center' });
    doc.moveDown(0.5);

    // Patient Details Section
    doc.fontSize(14).font('Helvetica-Bold').text('PATIENT DETAILS', { underline: true });
    doc.fontSize(10).font('Helvetica');
    
    const details = [
      ['Name:', patient.name],
      ['Patient ID:', patient.patient_id],
      ['Age:', patient.age_years ? `${patient.age_years} years` : 'N/A'],
      ['Gender:', patient.gender || 'N/A'],
      ['Phone:', patient.phone || 'N/A'],
      ['Email:', patient.email || 'N/A'],
      ['Blood Group:', patient.blood_group || 'N/A'],
      ['Address:', patient.address || 'N/A'],
      ['Registered Date:', formatDate(patient.registered_date)]
    ];

    for (const [label, value] of details) {
      doc.font('Helvetica-Bold').text(label, { continued: true });
      doc.font('Helvetica').text(` ${value}`);
    }

    doc.moveDown(1);

    // Allergies Section
    if (patientData.allergies && patientData.allergies.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('ALLERGIES', { underline: true });
      doc.fontSize(10).font('Helvetica');
      for (const allergy of patientData.allergies) {
        doc.text(`• ${allergy.allergen_name} (${allergy.severity}) - ${allergy.reaction || 'N/A'}`);
      }
      doc.moveDown(0.5);
    }

    // Chronic Conditions Section
    if (patientData.conditions && patientData.conditions.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('CHRONIC CONDITIONS', { underline: true });
      doc.fontSize(10).font('Helvetica');
      for (const cond of patientData.conditions) {
        doc.text(`• ${cond.condition_name} (${cond.status}) - Since ${formatDate(cond.start_date)}`);
      }
      doc.moveDown(0.5);
    }

    // Prescriptions Section
    if (prescriptions && prescriptions.length > 0) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('PRESCRIPTION HISTORY', { underline: true });
      doc.moveDown(0.5);

      for (const presc of prescriptions) {
        doc.fontSize(11).font('Helvetica-Bold').text(`📋 ${formatDate(presc.prescribed_date)} | Dr. ${getDoctorName(presc)}`);
        
        // Diagnoses for this prescription
        const prescsForThis = prescriptionDiagnoses.filter(d => d.prescription_id === presc.id);
        if (prescsForThis.length > 0) {
          doc.fontSize(9).font('Helvetica').text('Diagnosis: ' + prescsForThis.map(d => d.diagnosis_text).join(', '));
        }

        // Medicines for this prescription
        const medsForThis = prescriptionItems.filter(m => m.prescription_id === presc.id);
        if (medsForThis.length > 0) {
          doc.fontSize(9).text('Medicines:');
          for (const med of medsForThis) {
            const dosage = med.dosage ? ` ${med.dosage}` : '';
            const frequency = med.frequency ? ` - ${med.frequency}` : '';
            const duration = med.duration ? ` for ${med.duration}` : '';
            const instruction = med.before_after_food ? ` (${med.before_after_food})` : '';
            doc.text(`  • ${med.medication_name}${dosage}${frequency}${duration}${instruction}`);
          }
        }

        // Chief complaint
        if (presc.chief_complaint) {
          doc.fontSize(9).text('Chief Complaint: ' + presc.chief_complaint);
        }

        // Advice
        if (presc.advice) {
          doc.fontSize(9).text('Advice: ' + presc.advice);
        }

        // Follow-up
        if (presc.follow_up_date) {
          doc.fontSize(9).text('Follow-up: ' + formatDate(presc.follow_up_date));
        }

        doc.moveDown(0.3);
      }
    }

    // Vitals Section
    if (patientData.vitals && patientData.vitals.length > 0) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('VITAL SIGNS (LATEST)', { underline: true });
      doc.moveDown(0.3);

      const latestVital = patientData.vitals[0];
      doc.fontSize(10).font('Helvetica');
      doc.text(`Height: ${latestVital.height_cm} cm | Weight: ${latestVital.weight_kg} kg | BMI: ${latestVital.bmi}`);
      doc.text(`BP: ${latestVital.blood_pressure} | Pulse: ${latestVital.pulse} bpm`);
      doc.text(`Temperature: ${latestVital.temperature}°${latestVital.temperature_unit}`);
      doc.text(`SpO2: ${latestVital.spo2}% | RR: ${latestVital.respiratory_rate}`);
      doc.text(`Recorded: ${formatDate(latestVital.recorded_at)}`);
    }

    // Labs Section
    if (patientData.labs && patientData.labs.length > 0) {
      doc.moveDown(1);
      doc.fontSize(14).font('Helvetica-Bold').text('LAB INVESTIGATIONS', { underline: true });
      doc.fontSize(9).font('Helvetica');
      
      for (const lab of patientData.labs.slice(0, 5)) {
        doc.text(`• ${lab.test_name} - ${formatDate(lab.ordered_date)}`);
      }
      if (patientData.labs.length > 5) {
        doc.text(`... and ${patientData.labs.length - 5} more tests`);
      }
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export as PDF', details: error.message });
  }
}

// Export to Excel
async function exportAsExcel(req, res) {
  try {
    const { patientId, allPatients, doctorId } = req.query;
    const db = getDb();

    const workbook = new ExcelJS.Workbook();

    if (allPatients === 'true') {
      // Export all patients
      const query = doctorId
        ? 'SELECT id FROM patients WHERE primary_doctor_id = ? ORDER BY name'
        : 'SELECT id FROM patients ORDER BY name';
      const params = doctorId ? [doctorId] : [];
      const [patients] = await db.execute(query, params);

      // Summary sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Patient ID', key: 'patient_id', width: 15 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Age', key: 'age_years', width: 10 },
        { header: 'Gender', key: 'gender', width: 10 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Prescriptions', key: 'rx_count', width: 12 },
        { header: 'Last Visit', key: 'last_visit_date', width: 15 }
      ];

      for (const p of patients) {
        const patientData = await getPatientExportData(p.id, db);
        if (patientData) {
          const row = {
            patient_id: patientData.patient.patient_id,
            name: patientData.patient.name,
            age_years: patientData.patient.age_years,
            gender: patientData.patient.gender,
            phone: patientData.patient.phone,
            rx_count: patientData.prescriptions.length,
            last_visit_date: formatDate(patientData.patient.last_visit_date)
          };
          summarySheet.addRow(row);

          // Individual patient sheet
          const patientSheet = workbook.addWorksheet(patientData.patient.name.substring(0, 31));
          
          // Patient details
          patientSheet.columns = [
            { header: 'Field', key: 'field', width: 20 },
            { header: 'Value', key: 'value', width: 40 }
          ];

          patientSheet.addRow({ field: 'Name', value: patientData.patient.name });
          patientSheet.addRow({ field: 'Patient ID', value: patientData.patient.patient_id });
          patientSheet.addRow({ field: 'Age', value: patientData.patient.age_years });
          patientSheet.addRow({ field: 'Gender', value: patientData.patient.gender });
          patientSheet.addRow({ field: 'Blood Group', value: patientData.patient.blood_group });
          patientSheet.addRow({ field: 'Phone', value: patientData.patient.phone });
          patientSheet.addRow({ field: 'Email', value: patientData.patient.email });

          // Prescriptions table
          patientSheet.moveDown = 2;
          if (patientData.prescriptions.length > 0) {
            patientSheet.addRows([{ field: 'PRESCRIPTIONS' }]);
            const rxSheet = workbook.addWorksheet(`${patientData.patient.name.substring(0, 25)}-Rx`);
            rxSheet.columns = [
              { header: 'Date', key: 'prescribed_date', width: 15 },
              { header: 'Doctor', key: 'doctor_name', width: 20 },
              { header: 'Diagnosis', key: 'diagnosis', width: 25 },
              { header: 'Medicine', key: 'medicine', width: 20 },
              { header: 'Dosage', key: 'dosage', width: 12 },
              { header: 'Frequency', key: 'frequency', width: 12 },
              { header: 'Duration', key: 'duration', width: 12 },
              { header: 'Follow-up', key: 'follow_up', width: 15 }
            ];

            for (const rx of patientData.prescriptions) {
              const diagText = patientData.prescriptionDiagnoses
                .filter(d => d.prescription_id === rx.id)
                .map(d => d.diagnosis_text)
                .join(', ');

              const meds = patientData.prescriptionItems.filter(m => m.prescription_id === rx.id);
              if (meds.length === 0) {
                rxSheet.addRow({
                  prescribed_date: formatDate(rx.prescribed_date),
                  doctor_name: getDoctorName(rx),
                  diagnosis: diagText,
                  medicine: 'N/A',
                  dosage: '',
                  frequency: '',
                  duration: '',
                  follow_up: formatDate(rx.follow_up_date)
                });
              } else {
                for (let i = 0; i < meds.length; i++) {
                  const med = meds[i];
                  rxSheet.addRow({
                    prescribed_date: i === 0 ? formatDate(rx.prescribed_date) : '',
                    doctor_name: i === 0 ? getDoctorName(rx) : '',
                    diagnosis: i === 0 ? diagText : '',
                    medicine: med.medication_name,
                    dosage: med.dosage || '',
                    frequency: med.frequency || '',
                    duration: med.duration || '',
                    follow_up: i === 0 ? formatDate(rx.follow_up_date) : ''
                  });
                }
              }
            }
          }
        }
      }
    } else {
      // Single patient export
      const patientData = await getPatientExportData(parseInt(patientId), db);
      if (!patientData) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const { patient, prescriptions, prescriptionItems, prescriptionDiagnoses, allergies, conditions, vitals, labs } = patientData;

      // Patient Details Sheet
      const detailsSheet = workbook.addWorksheet('Patient Details');
      detailsSheet.columns = [
        { header: 'Field', key: 'field', width: 20 },
        { header: 'Value', key: 'value', width: 40 }
      ];

      const rows = [
        { field: 'Name', value: patient.name },
        { field: 'Patient ID', value: patient.patient_id },
        { field: 'Age', value: patient.age_years },
        { field: 'Gender', value: patient.gender },
        { field: 'Blood Group', value: patient.blood_group },
        { field: 'DOB', value: formatDate(patient.dob) },
        { field: 'Phone', value: patient.phone },
        { field: 'Email', value: patient.email },
        { field: 'Address', value: patient.address },
        { field: 'Registered Date', value: formatDate(patient.registered_date) },
        { field: 'Last Visit', value: formatDate(patient.last_visit_date) },
        { field: 'Total Visits', value: patient.total_visits }
      ];
      detailsSheet.addRows(rows);

      // Prescriptions Sheet
      const rxSheet = workbook.addWorksheet('Prescriptions');
      rxSheet.columns = [
        { header: 'Date', key: 'prescribed_date', width: 15 },
        { header: 'Doctor', key: 'doctor_name', width: 20 },
        { header: 'Diagnosis', key: 'diagnosis', width: 25 },
        { header: 'Medicine', key: 'medicine', width: 20 },
        { header: 'Dosage', key: 'dosage', width: 12 },
        { header: 'Frequency', key: 'frequency', width: 12 },
        { header: 'Duration', key: 'duration', width: 12 },
        { header: 'Instructions', key: 'instructions', width: 20 },
        { header: 'Follow-up', key: 'follow_up', width: 15 }
      ];

      for (const rx of prescriptions) {
        const diagText = prescriptionDiagnoses
          .filter(d => d.prescription_id === rx.id)
          .map(d => d.diagnosis_text)
          .join(', ');

        const meds = prescriptionItems.filter(m => m.prescription_id === rx.id);
        if (meds.length === 0) {
          rxSheet.addRow({
            prescribed_date: formatDate(rx.prescribed_date),
            doctor_name: getDoctorName(rx),
            diagnosis: diagText,
            medicine: 'N/A',
            dosage: '',
            frequency: '',
            duration: '',
            instructions: '',
            follow_up: formatDate(rx.follow_up_date)
          });
        } else {
          for (let i = 0; i < meds.length; i++) {
            const med = meds[i];
            rxSheet.addRow({
              prescribed_date: i === 0 ? formatDate(rx.prescribed_date) : '',
              doctor_name: i === 0 ? getDoctorName(rx) : '',
              diagnosis: i === 0 ? diagText : '',
              medicine: med.medication_name,
              dosage: med.dosage || '',
              frequency: med.frequency || '',
              duration: med.duration || '',
              instructions: med.before_after_food || '',
              follow_up: i === 0 ? formatDate(rx.follow_up_date) : ''
            });
          }
        }
      }

      // Allergies Sheet
      if (allergies && allergies.length > 0) {
        const allergiesSheet = workbook.addWorksheet('Allergies');
        allergiesSheet.columns = [
          { header: 'Allergen', key: 'allergen_name', width: 20 },
          { header: 'Category', key: 'category', width: 15 },
          { header: 'Severity', key: 'severity', width: 12 },
          { header: 'Reaction', key: 'reaction', width: 30 }
        ];
        for (const allergy of allergies) {
          allergiesSheet.addRow({
            allergen_name: allergy.allergen_name,
            category: allergy.category,
            severity: allergy.severity,
            reaction: allergy.reaction
          });
        }
      }

      // Chronic Conditions Sheet
      if (conditions && conditions.length > 0) {
        const conditionsSheet = workbook.addWorksheet('Conditions');
        conditionsSheet.columns = [
          { header: 'Condition', key: 'condition_name', width: 25 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Start Date', key: 'start_date', width: 15 },
          { header: 'Notes', key: 'notes', width: 30 }
        ];
        for (const cond of conditions) {
          conditionsSheet.addRow({
            condition_name: cond.condition_name,
            status: cond.status,
            start_date: formatDate(cond.start_date),
            notes: cond.notes
          });
        }
      }

      // Vitals Sheet
      if (vitals && vitals.length > 0) {
        const vitalsSheet = workbook.addWorksheet('Vitals');
        vitalsSheet.columns = [
          { header: 'Date', key: 'recorded_at', width: 15 },
          { header: 'Height (cm)', key: 'height_cm', width: 12 },
          { header: 'Weight (kg)', key: 'weight_kg', width: 12 },
          { header: 'BMI', key: 'bmi', width: 10 },
          { header: 'BP', key: 'blood_pressure', width: 12 },
          { header: 'Pulse', key: 'pulse', width: 10 },
          { header: 'Temp (°C)', key: 'temperature', width: 12 },
          { header: 'SpO2', key: 'spo2', width: 10 },
          { header: 'RR', key: 'respiratory_rate', width: 10 }
        ];
        for (const vital of vitals) {
          vitalsSheet.addRow({
            recorded_at: formatDate(vital.recorded_at),
            height_cm: vital.height_cm,
            weight_kg: vital.weight_kg,
            bmi: vital.bmi,
            blood_pressure: vital.blood_pressure,
            pulse: vital.pulse,
            temperature: vital.temperature,
            spo2: vital.spo2,
            respiratory_rate: vital.respiratory_rate
          });
        }
      }

      // Labs Sheet
      if (labs && labs.length > 0) {
        const labsSheet = workbook.addWorksheet('Lab Tests');
        labsSheet.columns = [
          { header: 'Test', key: 'test_name', width: 25 },
          { header: 'Ordered Date', key: 'ordered_date', width: 15 },
          { header: 'Result Date', key: 'result_date', width: 15 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Notes', key: 'notes', width: 30 }
        ];
        for (const lab of labs) {
          labsSheet.addRow({
            test_name: lab.test_name,
            ordered_date: formatDate(lab.ordered_date),
            result_date: formatDate(lab.result_date),
            status: lab.status,
            notes: lab.notes
          });
        }
      }
    }

    const timestamp = Date.now();
    const filename = allPatients === 'true'
      ? `all-patients-export-${timestamp}.xlsx`
      : `patient-${patientId}-export-${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Failed to export as Excel', details: error.message });
  }
}

module.exports = {
  exportAsJSON,
  exportAsPDF,
  exportAsExcel,
  getPatientExportData
};

const refactored = require('./exportController_refactored');
module.exports = {
  ...refactored,
  getPatientExportData,
};
