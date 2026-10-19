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

// Certificate templates usually carry their own title line and a signature /
// "Date:" block at the end; the PDF renders a styled title, date and signature
// itself, so those lines printed twice (and pushed the page past one sheet).
// Drop only an exact leading title and trailing signature-block lines, and
// collapse runs of blank lines.
function cleanCertificateContent(cert) {
  const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const lines = String(cert?.certificate_content || '').replace(/\r\n?/g, '\n').split('\n');

  const titles = new Set([norm(cert?.certificate_title), norm(cert?.certificate_type_name)].filter(Boolean));
  const first = lines.findIndex((l) => l.trim() !== '');
  if (first !== -1 && titles.has(norm(lines[first]))) lines.splice(0, first + 1);

  const doctor = norm(String(cert?.doctor_name || '').replace(/^\s*dr\.?\s*/i, ''));
  const qualification = norm(cert?.doctor_qualification);
  const isSignatureLine = (line) => {
    const raw = line.trim();
    if (!raw) return true;
    if (raw.length > 60) return false;
    const n = norm(raw);
    return /^date\s*[:-]?\s*(\d|\{\{)/i.test(raw)
      || (doctor && (n === doctor || n === `dr ${doctor}`))
      || /^reg(istration)?\.?\s*(no\.?|number)?\s*[:-]?\s*\S+$/i.test(raw)
      || (qualification && n === qualification)
      || /^(doctor s |doctors |medical officer s )?signature\b|^authori[sz]ed signatory/.test(n);
  };
  while (lines.length && isSignatureLine(lines[lines.length - 1])) lines.pop();
  while (lines.length && lines[0].trim() === '') lines.shift();

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

// Medical certificate — printed on the same letterhead as the prescription pad
// (or with the top left blank for pre-printed paper), so every document the
// clinic hands out looks the same.
function buildCertificateHtml(cert, { withLetterhead, lh, padLeftMm, padRightMm }) {
  const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '');
  const issuedDate = fmt(cert?.issued_date);
  const title = cert?.certificate_title || 'Medical Certificate';

  let headerHTML = '';
  if (withLetterhead) {
    if (lh?.header_image) {
      headerHTML += `<div class="lh-img"><img src="${escapeHtml(lh.header_image)}"/></div>`;
    }
    if (lh?.header_content) {
      headerHTML += `<div class="lh-content">${PdfGeneratorService.safeTemplateHtml(lh.header_content)}</div>`;
    }
    if (!lh?.header_image && !lh?.header_content) {
      headerHTML = `<div class="clinic-text">
          <div class="clinic-name">${escapeHtml(cert?.clinic_name || 'Clinic')}</div>
          ${cert?.clinic_address || cert?.clinic_phone ? `<div class="clinic-sub">${escapeHtml(cert?.clinic_address || '')}${cert?.clinic_address && cert?.clinic_phone ? ' &nbsp;|&nbsp; ' : ''}${cert?.clinic_phone ? 'Ph: ' + escapeHtml(cert.clinic_phone) : ''}</div>` : ''}
        </div>`;
    }
    headerHTML += '<div class="header-rule"></div>';
  }

  const regNo = cert?.doctor_registration_no || lh?.doctor_license_number;
  const content = cleanCertificateContent(cert);
  // Skip the Validity row when the certificate text already states the dates.
  const validity = cert?.valid_from && content.includes(fmt(cert.valid_from))
    ? ''
    : [cert?.valid_from ? `From ${fmt(cert.valid_from)}` : '', cert?.valid_until ? `To ${fmt(cert.valid_until)}` : '']
      .filter(Boolean).join(' ');

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,'Helvetica Neue','Noto Sans','DejaVu Sans',sans-serif;color:#111;font-size:11pt;padding:10mm ${padRightMm}mm 10mm ${padLeftMm}mm}
      .lh-img{margin:-10mm -${padRightMm}mm 2mm -${padLeftMm}mm}
      .lh-img img{width:100%;display:block}
      .lh-content{font-size:9pt;color:#374151;margin-bottom:2mm}
      .clinic-text{text-align:center;margin-bottom:2mm}
      .clinic-name{font-size:15pt;font-weight:700;color:#003366}
      .clinic-sub{font-size:8.5pt;color:#555;margin-top:1mm}
      .header-rule{border-top:1.5px solid #003366;margin:1mm 0 4mm}
      .date-row{text-align:right;font-size:10pt;margin-bottom:3mm}
      .title{font-size:15pt;font-weight:700;text-align:center;letter-spacing:1pt;text-transform:uppercase;color:#003366;margin-bottom:5mm}
      .title span{border-bottom:1.5px solid #003366;padding-bottom:1mm}
      .patient{display:flex;justify-content:space-between;gap:6mm;padding:2.5mm 4mm;background:#f0f4ff;border-radius:2mm;margin-bottom:6mm;font-size:10pt}
      .content{font-size:11.5pt;line-height:1.6;white-space:pre-wrap;text-align:justify}
      .validity{margin-top:4mm;font-size:10.5pt}
      .notes{margin-top:3mm;font-size:10pt;color:#374151}
      .sig{margin-top:12mm;display:flex;justify-content:flex-end;page-break-inside:avoid}
      .sig-box{text-align:right;min-width:60mm}
      .sig-img{height:14mm;margin-left:auto;display:block}
      .sig-line{border-top:1px solid #333;width:55mm;margin-left:auto;margin-bottom:1.5mm}
      .sig-name{font-weight:700;font-size:11pt}
      .sig-sub{font-size:9pt;color:#555}
    </style>
  </head>
  <body>
    ${headerHTML}
    <div class="date-row"><strong>Date:</strong> ${escapeHtml(issuedDate)}</div>
    <div class="title"><span>${escapeHtml(title)}</span></div>
    <div class="patient">
      <div><strong>Patient:</strong> ${escapeHtml(cert?.patient_name || '')}${cert?.patient_identifier ? ` (${escapeHtml(cert.patient_identifier)})` : ''}</div>
      ${cert?.phone ? `<div><strong>Ph:</strong> ${escapeHtml(cert.phone)}</div>` : ''}
    </div>
    <div class="content">${escapeHtml(content)}</div>
    ${validity ? `<div class="validity"><strong>Validity:</strong> ${escapeHtml(validity)}</div>` : ''}
    ${cert?.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(cert.notes)}</div>` : ''}
    <div class="sig">
      <div class="sig-box">
        ${lh?.signature_image ? `<img class="sig-img" src="${escapeHtml(lh.signature_image)}"/>` : '<div class="sig-line"></div>'}
        <div class="sig-name">Dr. ${escapeHtml(String(cert?.doctor_name || '').replace(/^\s*dr\.?\s*/i, ''))}</div>
        ${cert?.doctor_qualification ? `<div class="sig-sub">${escapeHtml(cert.doctor_qualification)}</div>` : ''}
        ${regNo ? `<div class="sig-sub">Reg. No: ${escapeHtml(regNo)}${lh?.doctor_medical_council ? ` (${escapeHtml(lh.doctor_medical_council)})` : ''}</div>` : ''}
      </div>
    </div>
    ${withLetterhead && lh?.footer_content ? `<div style="margin-top:8mm;padding-top:3mm;border-top:1px solid #e2e8f0;text-align:center;font-size:9pt;color:#475569">${PdfGeneratorService.safeTemplateHtml(lh.footer_content)}</div>` : ''}
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
  const templateId = req.query.template_id ? parseInt(req.query.template_id, 10) || null : null;

  const { buffer, filename, contentType } = await PdfGeneratorService.generateBillingPDF({
    billId,
    withLetterhead,
    templateId,
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
  // Explicit `with_letterhead=0` = plain (pre-printed) paper; anything else
  // keeps the letterhead, which is what older links/callers expect.
  const withLetterhead = req.query.with_letterhead !== '0';

  // getMedicalCertificate already attaches the resolved letterhead (the same
  // one the on-screen preview shows).
  const { certificate } = await MedicalCertificateService.getMedicalCertificate(certificateId);
  const lh = certificate.letterhead || {};

  // Same stationery as the doctor's prescriptions: honour their Rx print layout.
  const { getDb } = require('../config/db');
  const layout = await PdfGeneratorService.loadPrintLayout(getDb(), lh.doctor_user_id);
  const layoutMm = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= 200 ? n : fallback;
  };
  const padLeftMm = layoutMm(layout?.left, 15);
  const padRightMm = layoutMm(layout?.right, 15);
  // The Rx layout's blank bands clear the header/footer PRE-PRINTED on the
  // clinic's paper — plain paper only. With a letterhead we draw our own, and
  // reserving the band too is what pushed certificates onto extra sheets.
  const topBandMm = withLetterhead
    ? 10
    : (layout ? layoutMm(layout.top, 10) + layoutMm(layout.contentTop, 0) : PdfGeneratorService.BLANK_LETTERHEAD_MM);
  const bottomBandMm = withLetterhead
    ? 0
    : (layout ? layoutMm(layout.bottom, 10) + layoutMm(layout.contentBottom, 0) : 0);

  const html = buildCertificateHtml(certificate, { withLetterhead, lh, padLeftMm, padRightMm });

  const footerSrc = withLetterhead ? lh.footer_image : null;
  const footerSize = footerSrc ? PdfGeneratorService.imageSizeFromDataUrl(footerSrc) : null;
  const footerMm = footerSrc
    ? Math.min(40, footerSize && footerSize.w > 0 ? (210 * footerSize.h) / footerSize.w : 25)
    : 0;
  const marginTopMm = Math.max(0, topBandMm - 10);
  const marginBottomMm = Math.max(footerSrc ? footerMm : 10, bottomBandMm);

  const launchOpts = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] };
  try { launchOpts.executablePath = puppeteer.executablePath(); } catch { /* use default */ }
  const browser = await puppeteer.launch(launchOpts);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 }); // A4 @ 96dpi, so measuring matches print
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const scale = await PdfGeneratorService.fitToOnePageScale(page, { marginTopMm, marginBottomMm });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      scale,
      displayHeaderFooter: Boolean(footerSrc),
      headerTemplate: '<div></div>',
      footerTemplate: footerSrc
        ? `<div style="width:100%;margin:0;padding:0;-webkit-print-color-adjust:exact"><img src="${footerSrc}" style="width:100%;height:${footerMm.toFixed(2)}mm;display:block;object-fit:fill"/></div>`
        : '<div></div>',
      margin: {
        // Plain paper = the clinic's pre-printed letterhead: keep that band clear
        // (body padding supplies 10mm of it).
        top: `${marginTopMm.toFixed(2)}mm`,
        right: '0',
        bottom: `${marginBottomMm.toFixed(2)}mm`,
        left: '0',
      },
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
