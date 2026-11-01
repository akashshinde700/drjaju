// Real engine integration, no network needed: bundled English trained data.
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const PDFDocument = require('pdfkit');
const { extractTextFromReport, parseLabData } = require('../src/services/ocrExtractor');
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clinic-ocr-'));
  try {
    const canvas = createCanvas(1400, 500);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1400, 500);
    ctx.fillStyle = 'black'; ctx.font = '48px sans-serif';
    ctx.fillText('Hemoglobin: 14.2 g/dL', 40, 100);
    ctx.fillText('Platelets: 250000 /uL', 40, 200);
    const image = path.join(dir, 'lab.png');
    await fs.writeFile(image, canvas.toBuffer('image/png'));
    assert.deepEqual(parseLabData(await extractTextFromReport(image)).map(r => r.value), [14.2,250000]);
    console.log('PASS real image OCR');
    for (const scanned of [false, true]) {
      const doc = new PDFDocument();
      const chunks = []; doc.on('data',chunk=>chunks.push(chunk));
      const ended = new Promise(resolve=>doc.on('end',resolve));
      if (scanned) { doc.image(image,{width:500}); doc.addPage().image(image,{width:500}); }
      else { doc.fontSize(18).text('Hemoglobin: 14.2 g/dL'); doc.addPage().text('Platelets: 250000 /uL'); }
      doc.end(); await ended;
      const pdf = path.join(dir,`lab-${scanned}.pdf`);
      await fs.writeFile(pdf,Buffer.concat(chunks));
      const text = await extractTextFromReport(pdf);
      assert.ok(text.includes('14.2') && text.includes('250000'));
      if (scanned) assert.equal((text.match(/Hemoglobin/g)||[]).length,2);
      console.log(`PASS two-page ${scanned ? 'scanned' : 'text'} PDF extraction`);
    }
    assert.deepEqual((await fs.readdir(dir)).sort(),['lab-false.pdf','lab-true.pdf','lab.png']);
    console.log('PASS OCR temporary files cleaned');
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
