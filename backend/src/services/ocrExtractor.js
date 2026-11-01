const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

/**
 * Preprocess image with sharp for better OCR accuracy:
 * grayscale → normalize contrast → sharpen
 */
async function preprocessImageForOCR(imagePath) {
  try {
    const outputPath = imagePath + '_ocr_prep.png';
    await sharp(imagePath, { limitInputPixels: 40000000 })
      .rotate()
      .resize({ width: 3000, height: 4000, fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalize()          // auto contrast stretch
      .sharpen({ sigma: 1.5 })
      .png()
      .toFile(outputPath);
    return outputPath;
  } catch (err) {
    console.error('Image preprocessing skipped:', err.message);
    return imagePath; // fall back to original
  }
}

// Render PDFs directly: browser PDF viewers can produce blank screenshots and
// only captured page one. Bound page count and raster size for untrusted uploads.
async function extractTextFromReport(filePath) {
  const tempFiles = [];
  let worker;
  let timer;
  let pdf;
  let loadingTask;
  try {
    worker = await Tesseract.createWorker('eng', 1, {
      langPath: path.resolve(__dirname, '../..'),
      gzip: false,
      cachePath: path.resolve(__dirname, '../..'),
    });
    const run = async () => {
      if (path.extname(filePath).toLowerCase() === '.pdf') {
        const { DOMMatrix, ImageData, Path2D, createCanvas } = require('@napi-rs/canvas');
        Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
        const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        loadingTask = getDocument({ data: new Uint8Array(await fs.readFile(filePath)),
          isEvalSupported: false, useSystemFonts: true });
        pdf = await loadingTask.promise;
        if (pdf.numPages > 20) throw new Error('Please upload a PDF with 20 pages or fewer.');
        const texts = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          const text = content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
          if (text.trim().length >= 30) { texts.push(text); continue; }
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(2, 2500 / Math.max(base.width, base.height)) });
          const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          texts.push((await worker.recognize(canvas.toBuffer('image/png'))).data.text);
        }
        return texts.join('\n');
      }
      const prep = await preprocessImageForOCR(filePath);
      if (prep !== filePath) tempFiles.push(prep);
      return (await worker.recognize(prep)).data.text;
    };
    return await Promise.race([run(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('OCR timed out. Please upload a smaller, clearer report.')), 60000);
    })]);
  } finally {
    clearTimeout(timer);
    if (worker) await worker.terminate();
    if (loadingTask) await loadingTask.destroy();
    for (const f of tempFiles) { try { await fs.unlink(f); } catch {} }
  }
}

/**
 * Parse extracted OCR text to find lab test data.
 * Handles common Indian lab report formats (Dr. Lal, SRL, Thyrocare, etc.)
 * Returns: [{ testName, value, unit, referenceRange, originalLine }]
 */
function parseLabData(text) {
  const labResults = [];

  if (!text || text.trim().length === 0) return labResults;

  // Normalize: remove carriage returns, collapse multiple blank lines
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3);

  /**
   * Parse a numeric value that may contain commas (Indian format: 2,50,000)
   */
  function parseIndianNumber(str) {
    const cleaned = str.replace(/,/g, '');
    if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return isNaN(n) ? null : n;
  }

  /**
   * Test name blacklist — skip header/footer lines
   */
  const skipWords = /^(test|investigation|result|value|unit|reference|range|normal|method|remark|report|date|patient|doctor|lab|page|sample|collected|reported|printed|name|age|sex|gender|ref\.?\s*interval|bio\.?\s*ref)\b/i;

  const patterns = [
    // Pipe-separated: "Hemoglobin | 14.2 | g/dL | 13.0 - 17.0"
    /^([A-Za-z][A-Za-z0-9\s%#/(). -]{2,45}?)\s*\|\s*([0-9][0-9,. ]*)\s*(?:\|\s*([a-zA-Z0-9/%^µ·. ]+?))?\s*(?:\|\s*(.+))?$/,

    // Colon-separated: "Hemoglobin: 14.2 g/dL"
    /^([A-Za-z][A-Za-z0-9\s%#/(). -]{2,45}?):\s*([0-9][0-9,.]*)\s*([a-zA-Z0-9/%^µ·]+)?\s*(.*)?$/,

    // Tab or multi-space: "Hemoglobin    14.2    g/dL    13.0-17.0"
    /^([A-Za-z][A-Za-z0-9\s%#/(). -]{2,45}?)\s{2,}([0-9][0-9,.]*)\s+([a-zA-Z0-9/%^µ·]+)\s*(.*)?$/,

    // OCR and embedded PDF text commonly collapse columns to single spaces.
    /^([A-Za-z][A-Za-z0-9\s%#/(). -]{2,45}?)\s+([0-9][0-9,.]*)\s+([a-zA-Z/%µ][a-zA-Z0-9/%^µ·]*)\s*(.*)?$/,

    // Simple 2-column: "Hemoglobin  14.2" (no unit)
    /^([A-Za-z][A-Za-z0-9\s%#/(). -]{2,45}?)\s{2,}([0-9][0-9,. ]+)\s*$/,
  ];

  for (const line of lines) {
    if (line.length > 250) continue; // skip very long lines

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;

      const testName = match[1].trim().replace(/\s+/g, ' ');
      const rawValue = match[2] ? match[2].trim() : '';
      const unit = match[3] ? match[3].trim() : '';
      const refRange = match[4] ? match[4].trim() : '';

      const value = parseIndianNumber(rawValue);

      // Validate
      if (!testName || value === null) continue;
      if (testName.length < 3 || testName.length > 50) continue;
      if (skipWords.test(testName)) continue;
      if (/^\d/.test(testName)) continue; // starts with digit = not a test name

      // Avoid duplicate test names
      if (labResults.some(r => r.testName.toLowerCase() === testName.toLowerCase())) continue;

      labResults.push({ testName, value, unit, referenceRange: refRange, originalLine: line });
      break; // next line
    }
  }

  return labResults;
}

/**
 * Find matching lab template from DB by name similarity
 */
async function findMatchingLabTest(extractedTest, labTemplates) {
  if (!labTemplates || labTemplates.length === 0) return null;

  // Never infer clinical equivalence from one shared word (e.g. total
  // bilirubin vs direct bilirubin). Uncertain names remain unmatched for review.
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const q = normalize(extractedTest?.testName);
  if (!q) return null;
  const matches = labTemplates.filter(t => normalize(t.test_name) === q);
  if (matches.length === 1) return matches[0];

  return null;
}

/**
 * Main: extract + parse + match lab data from uploaded report image/PDF
 */
async function processLabReportImage(filePath, labTemplates) {
  try {
    const extractedText = await extractTextFromReport(filePath);

    if (!extractedText || extractedText.trim().length < 10) {
      return { success: false, error: 'OCR returned no readable text', results: [] };
    }

    const extractedLabData = parseLabData(extractedText);

    if (extractedLabData.length === 0) {
      return {
        success: false,
        error: 'No lab values found in extracted text. The image quality may be low or format not recognized.',
        rawText: extractedText.substring(0, 500),
        results: []
      };
    }

    const matchedResults = [];
    for (const item of extractedLabData) {
      const template = await findMatchingLabTest(item, labTemplates);
      if (template) {
        matchedResults.push({
          test_name: template.test_name,
          test_id: template.id,
          reading: item.value,
          unit: item.unit || template.unit,
          reference_range: item.referenceRange || template.reference_range,
          extracted: true,
          source: 'medical_record',
          confidence: 'high'
        });
      } else {
        matchedResults.push({
          test_name: item.testName,
          reading: item.value,
          unit: item.unit,
          reference_range: item.referenceRange,
          extracted: true,
          source: 'medical_record',
          confidence: 'unmatched'
        });
      }
    }

    const highCount = matchedResults.filter(r => r.confidence === 'high').length;
    return {
      success: true,
      extractedCount: extractedLabData.length,
      matchedCount: highCount,
      results: matchedResults,
      rawText: extractedText
    };

  } catch (err) {
    console.error('OCR processing error:', err.message);
    return { success: false, error: err.message, results: [] };
  }
}

module.exports = {
  extractTextFromReport,
  parseLabData,
  findMatchingLabTest,
  processLabReportImage
};
