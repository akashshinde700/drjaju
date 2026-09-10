const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

class PDFService {
  constructor() {
    this.browser = null;
  }

  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async generatePrescriptionPDF(prescriptionData, clinicData, doctorData, patientData) {
    await this.init();

    const page = await this.browser.newPage();

    // Set viewport for better PDF quality
    await page.setViewport({ width: 794, height: 1123 }); // A4 size

    // Generate HTML content for prescription
    const htmlContent = this.generatePrescriptionHTML(prescriptionData, clinicData, doctorData, patientData);

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await page.close();
    return pdfBuffer;
  }

  async generateReceiptPDF(receiptData, clinicData, patientData) {
    await this.init();

    const page = await this.browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });

    const htmlContent = this.generateReceiptHTML(receiptData, clinicData, patientData);

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await page.close();
    return pdfBuffer;
  }

  generatePrescriptionHTML(prescriptionData, clinicData, doctorData, patientData) {
    const currentDate = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Prescription</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Arial', sans-serif;
            font-size: 14px;
            line-height: 1.4;
            color: #333;
            background: white;
          }

          .prescription-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            border: 2px solid #2563eb;
            border-radius: 8px;
          }

          .header {
            text-align: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }

          .clinic-name {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 5px;
          }

          .clinic-details {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
          }

          .doctor-info {
            text-align: right;
            margin-bottom: 20px;
            padding: 10px;
            background: #f8fafc;
            border-radius: 5px;
          }

          .doctor-name {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 5px;
          }

          .doctor-details {
            font-size: 12px;
            color: #666;
          }

          .patient-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 15px;
            background: #f0f9ff;
            border-radius: 5px;
          }

          .patient-details, .prescription-details {
            flex: 1;
          }

          .info-row {
            display: flex;
            margin-bottom: 5px;
          }

          .info-label {
            font-weight: bold;
            width: 100px;
            color: #374151;
          }

          .info-value {
            color: #1f2937;
          }

          .section {
            margin-bottom: 20px;
          }

          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e5e7eb;
          }

          .vitals-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }

          .vitals-table th, .vitals-table td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: left;
          }

          .vitals-table th {
            background: #f9fafb;
            font-weight: bold;
            color: #374151;
          }

          .symptoms-list, .diagnosis-list {
            margin-bottom: 15px;
          }

          .symptom-item, .diagnosis-item {
            padding: 5px 0;
            border-bottom: 1px solid #f3f4f6;
          }

          .medication-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }

          .medication-table th, .medication-table td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: left;
          }

          .medication-table th {
            background: #f9fafb;
            font-weight: bold;
            color: #374151;
          }

          .advice-section {
            background: #f8fafc;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 15px;
          }

          .follow-up {
            background: #fef3c7;
            padding: 10px;
            border-radius: 5px;
            border-left: 4px solid #f59e0b;
          }

          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
          }

          .signature {
            margin-top: 40px;
            text-align: right;
          }

          .signature-line {
            border-bottom: 1px solid #000;
            width: 200px;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="prescription-container">
          <!-- Header -->
          <div class="header">
            <div class="clinic-name">${clinicData?.name || process.env.DEFAULT_CLINIC_NAME || 'Clinic Name'}</div>
            <div class="clinic-details">
              ${clinicData?.address || process.env.DEFAULT_CLINIC_ADDRESS || 'Clinic Address'}<br>
              ${clinicData?.city || process.env.DEFAULT_CLINIC_CITY || 'City'}, ${clinicData?.state || process.env.DEFAULT_CLINIC_STATE || 'State'} - ${clinicData?.pincode || process.env.DEFAULT_CLINIC_PINCODE || '000000'}<br>
              Phone: ${clinicData?.phone || process.env.DEFAULT_CLINIC_PHONE || ''} | Email: ${clinicData?.email || process.env.DEFAULT_CLINIC_EMAIL || ''}
            </div>
          </div>

          <!-- Doctor Info -->
          <div class="doctor-info">
            <div class="doctor-name">Dr. ${doctorData?.name || 'Doctor Name'}</div>
            <div class="doctor-details">
              ${doctorData?.qualification || 'MBBS'} | ${doctorData?.specialization || 'General Medicine'}<br>
              License: ${doctorData?.license_number || ''} | Experience: ${doctorData?.experience_years || ''} years
            </div>
          </div>

          <!-- Patient & Prescription Info -->
          <div class="patient-info">
            <div class="patient-details">
              <div class="info-row">
                <span class="info-label">Patient:</span>
                <span class="info-value">${patientData?.name || 'Patient Name'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Age/Gender:</span>
                <span class="info-value">${this.calculateAge(patientData?.date_of_birth)} / ${patientData?.gender || 'Not specified'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">UHID:</span>
                <span class="info-value">${patientData?.patient_id || patientData?.uhid || 'UHID123456'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Phone:</span>
                <span class="info-value">${patientData?.phone || 'N/A'}</span>
              </div>
            </div>
            <div class="prescription-details">
              <div class="info-row">
                <span class="info-label">Date:</span>
                <span class="info-value">${currentDate}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Prescription ID:</span>
                <span class="info-value">${prescriptionData?.id || 'RX001'}</span>
              </div>
            </div>
          </div>

          <!-- Vitals -->
          ${prescriptionData?.vitals ? `
          <div class="section">
            <div class="section-title">Vitals</div>
            <table class="vitals-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(prescriptionData.vitals).map(([key, value]) => `
                  <tr>
                    <td>${key.charAt(0).toUpperCase() + key.slice(1)}</td>
                    <td>${value || '-'}</td>
                    <td>${this.getVitalUnit(key)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- Chief Complaints -->
          ${prescriptionData?.symptoms && prescriptionData.symptoms.length > 0 ? `
          <div class="section">
            <div class="section-title">Chief Complaints</div>
            <div class="symptoms-list">
              ${prescriptionData.symptoms.map(symptom => `
                <div class="symptom-item">
                  • ${symptom.name || symptom} ${symptom.duration ? `(Since ${symptom.duration})` : ''}
                  ${symptom.severity ? `- ${symptom.severity}` : ''}
                  ${symptom.note ? `- ${symptom.note}` : ''}
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- Diagnosis -->
          ${prescriptionData?.diagnosis && prescriptionData.diagnosis.length > 0 ? `
          <div class="section">
            <div class="section-title">Diagnosis</div>
            <div class="diagnosis-list">
              ${prescriptionData.diagnosis.map(dx => `
                <div class="diagnosis-item">
                  • ${dx.name || dx} ${dx.since ? `(Since ${dx.since})` : ''}
                  ${dx.status ? `- ${dx.status}` : ''}
                  ${dx.severity ? `- ${dx.severity}` : ''}
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- Medications -->
          ${prescriptionData?.medications && prescriptionData.medications.length > 0 ? `
          <div class="section">
            <div class="section-title">Prescription</div>
            <table class="medication-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                  <th>Timing</th>
                  <th>Instructions</th>
                </tr>
              </thead>
              <tbody>
                ${prescriptionData.medications.map(med => `
                  <tr>
                    <td>
                      <strong>${med.name || med.medicine_name || med.medicine}</strong>
                      ${med.dosage_form ? `<br><small style="color: #666">${med.dosage_form}</small>` : ''}
                    </td>
                    <td>${med.dosage || '-'}</td>
                    <td>${med.frequency || '-'}</td>
                    <td>${this.formatDuration(med.duration)}</td>
                    <td>${this.getTimingDisplay(med.timing)}</td>
                    <td>${med.instructions || med.notes || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- Advice -->
          ${prescriptionData?.advice ? `
          <div class="section">
            <div class="section-title">Advice</div>
            <div class="advice-section">
              ${prescriptionData.advice}
            </div>
          </div>
          ` : ''}

          <!-- Follow Up -->
          ${prescriptionData?.follow_up ? `
          <div class="section">
            <div class="section-title">Follow Up</div>
            <div class="follow-up">
              ${prescriptionData.follow_up}
            </div>
          </div>
          ` : ''}

          <!-- Signature -->
          <div class="signature">
            <div class="doctor-name">Dr. ${doctorData?.name || 'Doctor Name'}</div>
            <div class="signature-line"></div>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">Doctor's Signature</div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>This prescription is electronically generated and valid without signature.</p>
            <p>For any queries, please contact the clinic.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateReceiptHTML(receiptData, clinicData, patientData) {
    const currentDate = new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const totalAmount = receiptData?.services?.reduce((sum, service) => sum + (service.amount || 0), 0) || 0;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Arial', sans-serif;
            font-size: 14px;
            line-height: 1.4;
            color: #333;
            background: white;
          }

          .receipt-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border: 2px solid #059669;
            border-radius: 8px;
          }

          .header {
            text-align: center;
            border-bottom: 2px solid #059669;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }

          .clinic-name {
            font-size: 24px;
            font-weight: bold;
            color: #059669;
            margin-bottom: 5px;
          }

          .receipt-title {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
            margin: 10px 0;
          }

          .receipt-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 15px;
            background: #f0fdf4;
            border-radius: 5px;
          }

          .info-row {
            display: flex;
            margin-bottom: 5px;
          }

          .info-label {
            font-weight: bold;
            width: 100px;
            color: #374151;
          }

          .info-value {
            color: #1f2937;
          }

          .services-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }

          .services-table th, .services-table td {
            border: 1px solid #e5e7eb;
            padding: 10px;
            text-align: left;
          }

          .services-table th {
            background: #f9fafb;
            font-weight: bold;
            color: #374151;
          }

          .total-row {
            background: #f0fdf4;
            font-weight: bold;
          }

          .payment-info {
            background: #fef3c7;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #f59e0b;
          }

          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
          }

          .thank-you {
            font-size: 16px;
            font-weight: bold;
            color: #059669;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <!-- Header -->
          <div class="header">
            <div class="clinic-name">${clinicData?.name || 'Eka Care Clinic'}</div>
            <div class="receipt-title">PAYMENT RECEIPT</div>
          </div>

          <!-- Receipt Details -->
          <div class="receipt-details">
            <div>
              <div class="info-row">
                <span class="info-label">Billed To:</span>
                <span class="info-value">${patientData?.name || 'Patient Name'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">UHID:</span>
                <span class="info-value">${patientData?.patient_id || 'UHID123456'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Phone:</span>
                <span class="info-value">${patientData?.phone || 'N/A'}</span>
              </div>
            </div>
            <div>
              <div class="info-row">
                <span class="info-label">Receipt No:</span>
                <span class="info-value">${receiptData?.receipt_number || 'REC001'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date:</span>
                <span class="info-value">${currentDate}</span>
              </div>
            </div>
          </div>

          <!-- Services Table -->
          ${receiptData?.services && receiptData.services.length > 0 ? `
          <table class="services-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${receiptData.services.map(service => `
                <tr>
                  <td>${service.name || service.service}</td>
                  <td>${service.quantity || 1}</td>
                  <td>₹${service.rate || service.amount}</td>
                  <td>₹${service.amount || 0}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3" style="text-align: right; font-weight: bold;">Total Amount:</td>
                <td style="font-weight: bold;">₹${totalAmount}</td>
              </tr>
            </tbody>
          </table>
          ` : ''}

          <!-- Payment Info -->
          <div class="payment-info">
            <div class="info-row">
              <span class="info-label">Payment Method:</span>
              <span class="info-value">${receiptData?.payment_method || 'Cash'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Amount Paid:</span>
              <span class="info-value">₹${(receiptData?.total_amount !== undefined ? receiptData.total_amount : totalAmount)}</span>
            </div>
            ${receiptData?.transaction_id ? `
            <div class="info-row">
              <span class="info-label">Transaction ID:</span>
              <span class="info-value">${receiptData.transaction_id}</span>
            </div>
            ` : ''}
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="thank-you">Thank you for choosing our services!</div>
            <p>This is a computer generated receipt and does not require signature.</p>
            <p>For any queries, please contact: ${clinicData?.phone || 'N/A'}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return 'Not specified';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return `${age} years`;
  }

  formatDuration(duration) {
    if (!duration) return '-';
    // If it's just a number, add "Days"
    if (/^\d+$/.test(String(duration))) {
      return `${duration} Days`;
    }
    return duration;
  }

  getTimingDisplay(timing) {
    if (!timing) return '-';
    
    let t = timing;
    // Handle JSON string if stored that way in DB
    if (typeof timing === 'string' && timing.startsWith('{')) {
      try {
        t = JSON.parse(timing);
      } catch (e) {
        return timing;
      }
    }

    if (typeof t === 'object' && t !== null) {
      if (t.type === 'FIXED_TIME' && t.time) {
        return `At ${t.time}`;
      }
      return t.type || '-';
    }
    
    return String(timing);
  }

  getVitalUnit(vital) {
    const units = {
      temperature: '°F',
      height: 'cm',
      weight: 'kg',
      bmi: 'kg/m²',
      pulse_rate: 'bpm',
      blood_pressure: 'mmHg',
      respiratory_rate: 'per min',
      oxygen_saturation: '%'
    };
    return units[vital] || '';
  }
}

module.exports = new PDFService();