// =====================================================
// PDF GENERATOR CONTROLLER
// Purpose: Generate PDFs for prescriptions, bills, certificates, referrals
// Version: 1.0
// =====================================================

const { asyncHandler } = require('../utils');
const PdfGeneratorService = require('../services/PdfGeneratorService');
const MedicalCertificateService = require('../services/MedicalCertificateService');
const puppeteer = require('puppeteer');

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, '<br/>');
}

function buildCertificateHtml(cert) {
  const issuedDate = cert?.issued_date
    ? new Date(cert.issued_date).toLocaleDateString('en-IN')
    : '';

  const headerImg = cert?.header_image
    ? `<img class="header-img" src="${escapeHtml(cert.header_image)}" alt="Header" />`
    : '';
  const footerImg = cert?.footer_image
    ? `<img class="footer-img" src="${escapeHtml(cert.footer_image)}" alt="Footer" />`
    : '';

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(cert?.certificate_title || 'Medical Certificate')}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
      .page { width: 100%; }
      .header-img, .footer-img { width: 100%; max-height: 140px; object-fit: contain; }
      .title { font-size: 20px; font-weight: 700; text-align: center; margin: 14px 0 6px; }
      .meta { font-size: 12px; color: #334155; display: flex; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
      .meta .left, .meta .right { flex: 1; }
      .section { margin-top: 12px; }
      .label { font-size: 12px; color: #475569; margin-bottom: 4px; }
      .value { font-size: 14px; line-height: 1.5; }
      .content { margin-top: 10px; font-size: 14px; line-height: 1.6; }
      .sig { margin-top: 26px; display: flex; justify-content: flex-end; }
      .sig-box { text-align: right; }
      .sig-name { font-weight: 700; }
      .sig-reg { font-size: 12px; color: #334155; }
      hr { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
    </style>
  </head>
  <body>
    <div class="page">
      ${headerImg}

      <div class="title">${escapeHtml(cert?.certificate_title || 'Medical Certificate')}</div>

      <div class="meta">
        <div class="left">
          <div><strong>Patient:</strong> ${escapeHtml(cert?.patient_name || '')} ${cert?.patient_identifier ? `(${escapeHtml(cert.patient_identifier)})` : ''}</div>
          <div><strong>Phone:</strong> ${escapeHtml(cert?.phone || '')}</div>
        </div>
        <div class="right" style="text-align:right">
          <div><strong>Date:</strong> ${escapeHtml(issuedDate)}</div>
          <div><strong>Clinic:</strong> ${escapeHtml(cert?.clinic_name || '')}</div>
        </div>
      </div>

      <hr />

      <div class="content">${nl2br(cert?.certificate_content || '')}</div>

      <div class="sig">
        <div class="sig-box">
          <div class="sig-name">Dr. ${escapeHtml(cert?.doctor_name || '')}</div>
          ${cert?.doctor_registration_no ? `<div class="sig-reg">Reg No: ${escapeHtml(cert.doctor_registration_no)}</div>` : ''}
          ${cert?.doctor_qualification ? `<div class="sig-reg">${escapeHtml(cert.doctor_qualification)}</div>` : ''}
        </div>
      </div>

      <div style="margin-top:18px;">${footerImg}</div>
    </div>
  </body>
  </html>`;
}

// =====================================================
// PRESCRIPTION PDF
// =====================================================
exports.generatePrescriptionPDF = asyncHandler(async (req, res) => {
  const { prescriptionId } = req.params;
  const overrideTemplateId = req.query.template_id || null;
  const withLetterhead = req.query.with_letterhead === '1';
  const lang = req.query.lang || 'en';

  const { buffer, filename, contentType } = await PdfGeneratorService.generatePrescriptionPDF({
    prescriptionId,
    overrideTemplateId,
    withLetterhead,
    lang,
  });

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(buffer);
});

// =====================================================
// BILLING/INVOICE PDF
// =====================================================

exports.generateBillingPDF = asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const withLetterhead = req.query.with_letterhead === '1';

  const { buffer, filename, contentType } = await PdfGeneratorService.generateBillingPDF({
    billId,
    withLetterhead,
  });

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(buffer);
});

// =====================================================
// MEDICAL CERTIFICATE PDF
// =====================================================

exports.generateCertificatePDF = asyncHandler(async (req, res) => {
  const { certificateId } = req.params;

  // NOTE: We intentionally bypass PdfGeneratorService here because the service file
  // may be corrupted in this codebase (null bytes) which can cause runtime 500s.
  // Generating the PDF directly avoids that failure mode.
  const { certificate } = await MedicalCertificateService.getMedicalCertificate(certificateId);

  const html = buildCertificateHtml(certificate);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18px', right: '18px', bottom: '18px', left: '18px' },
    });
    await page.close();

    const safePatient = String(certificate?.patient_name || 'patient').replace(/[^a-z0-9_-]+/gi, '_');
    const filename = `certificate_${certificateId}_${safePatient}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  } finally {
    await browser.close();
  }
});

// =====================================================
// REFERRAL PDF
// =====================================================

exports.generateReferralPDF = asyncHandler(async (req, res) => {
  const { referralId } = req.params;

  const { buffer, filename, contentType } = await PdfGeneratorService.generateReferralPDF({
    referralId,
  });

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(buffer);
});

// =====================================================
// LAB REPORT PDF
// =====================================================

exports.generateLabReportPDF = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const { report_group } = req.query;

  const { buffer, filename, contentType } = await PdfGeneratorService.generateLabReportPDF({
    patientId,
    report_group: report_group || null,
  });

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(buffer);
});
