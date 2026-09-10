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
    await sharp(imagePath)
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

/**
 * Convert first page of PDF to PNG image using puppeteer
 */
async function pdfToImagePath(pdfPath) {
  const puppeteer = require('puppeteer');
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 2000 });
    const absolutePath = path.resolve(pdfPath);
    await page.goto(`file://${absolutePath}`, { waitUntil: 'load', timeout: 30000 });
    // Give extra time for PDF renderer
    await new Promise(r => setTimeout(r, 1500));
    const imagePath = pdfPath + '_pdf_page.png';
    await page.screenshot({ path: imagePath, type: 'png', fullPage: true });
    return imagePath;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Extract text from image or PDF medical report
 */
async function extractTextFromReport(filePath) {
  const tempFiles = [];
  let processedPath = filePath;

  try {
    const ext = path.extname(filePath).toLowerCase();

    // Step 1: Convert PDF → PNG image
    if (ext === '.pdf') {
      const imgPath = await pdfToImagePath(filePath);
      tempFiles.push(imgPath);
      processedPath = imgPath;
    }

    // Step 2: Preprocess image for better OCR (grayscale + contrast)
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const procExt = path.extname(processedPath).toLowerCase();
    if (imageExts.includes(procExt)) {
      const prep = await preprocessImageForOCR(processedPath);
      if (prep !== processedPath) {
        tempFiles.push(prep);
        processedPath = prep;
      }
    }

    // Step 3: Run Tesseract OCR (60s timeout)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR timeout (60s)')), 60000)
    );

    const ocrPromise = Tesseract.recognize(processedPath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\rOCR: ${(m.progress * 100).toFixed(0)}%`);
        }
      }
    });

    const result = await Promise.race([ocrPromise, timeoutPromise]);
    return result.data.text;

  } finally {
    // Cleanup temp files
    for (const f of tempFiles) {
      try { await fs.unlink(f); } catch {}
    }
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
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  /**
   * Test name blacklist — skip header/footer lines
   */
  const skipWords = /^(test|investigation|result|value|unit|reference|range|normal|method|remark|report|date|patient|doctor|lab|page|sample|collected|reported|printed|name|age|sex|gender|ref\.?\s*interval|bio\.?\s*ref)/i;

  const patterns = [
    // Pipe-separated: "Hemoglobin | 14.2 | g/dL | 13.0 - 17.0"
    /^([A-Za-z][A-Za-z0-9\s%#/(). -]{2,45}?)\s*\|\s*([0-9][0-9,. ]*)\s*(?:\|\s*([a-zA-Z0-9/%^µ·. ]+?))?\s*(?:\|\s*(.+))?$/,

    // Colon-separated: "Hemoglobin: 14.2 g/dL"
    /^([A-Za-z][A-Za-z0-9\s%#/(). -]{2,45}?):\s*([0-9][0-9,.]*)\s*([a-zA-Z0-9/%^µ·]+)?\s*(.*)?$/,

    // Tab or multi-space: "Hemoglobin    14.2    g/dL    13.0-17.0"
    /^([A-Za-z][A-Za-z0-9\s%#/(). -]{2,45}?)\s{2,}([0-9][0-9,.]*)\s+([a-zA-Z0-9/%^µ·]+)\s*(.*)?$/,

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

  const q = extractedTest.testName.toLowerCase();

  // Exact match
  for (const t of labTemplates) {
    if (t.test_name.toLowerCase() === q) return t;
  }

  // Contains match
  for (const t of labTemplates) {
    const tl = t.test_name.toLowerCase();
    if (tl.includes(q) || q.includes(tl)) return t;
  }

  // Keyword match (at least one significant word)
  const keywords = q.split(/\s+/).filter(w => w.length >= 3);
  for (const t of labTemplates) {
    const tl = t.test_name.toLowerCase();
    if (keywords.some(kw => tl.includes(kw))) return t;
  }

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
    const unmatchedCount = matchedResults.filter(r => r.confidence === 'unmatched').length;
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
