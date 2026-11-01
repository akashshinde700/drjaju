const { jsPDF } = require('jspdf');
const { applyPlugin } = require('jspdf-autotable');
const puppeteer = require('puppeteer');
const { getDb } = require('../config/db');
const { ApiError } = require('../utils');
const { unwrapJsonText } = require('../utils/unwrapJsonText');

applyPlugin(jsPDF);

// Height of the blank band left at the top of a prescription printed WITHOUT a
// letterhead. The clinic prints those on paper that ALREADY has its letterhead
// pre-printed, so "no letterhead" must mean "leave that area empty", not "start
// the text at the top of the page" — otherwise the patient block overprints the
// pre-printed header. Matches the ~140px (≈37mm) banner the in-app Letterhead
// component renders. Tune per printer/stationery with PRINT_BLANK_LETTERHEAD_MM
// (set it to 0 to go back to text starting at the top).
const BLANK_LETTERHEAD_MM = (() => {
  const raw = Number(process.env.PRINT_BLANK_LETTERHEAD_MM);
  return Number.isFinite(raw) && raw >= 0 && raw <= 120 ? raw : 38;
})();

// Timing translation dictionaries for PDF generation
const timingTranslations = {
  en: ['After Meal', 'Before Breakfast', 'Before Meal', 'Empty Stomach', 'With Food'],
  hi: ['खाने के बाद', 'नाश्ते से पहले', 'खाने से पहले', 'खाली पेट', 'खाने के साथ'],
  mr: ['जेवणानंतर', 'नाश्त्यापूर्वी', 'जेवणापूर्वी', 'रिकाम्या पोटी', 'जेवणासोबत'],
  bn: ['খাওয়ার পরে', 'সকালের খাবারের আগে', 'খাবারের আগে', 'পেট খালি', 'খাবারের সাথে'],
  gu: ['ખાણ પછી', 'નાસ્તા પહેલાં', 'ખાણ પહેલાં', 'પેટ ખાલી', 'ખાણ સાથે'],
  ta: ['உணவுக்குப் பின்', 'காலை உணவுக்கு முன்', 'உணவுக்கு முன்', 'வயிற்று காலி', 'உணவுடன்'],
  te: ['భోజనం తర్వాత', 'అర్థాన్నికి ముందు', 'భోజనానికి ముందు', 'ఖాలీ పేట', 'భోజనంతో'],
  kn: ['ಊಟದ ನಂತರ', 'ಬೆಳಿಗ್ಗೆ ಊಟಕ್ಕೂ ಮೊದು', 'ಊಟಕ್ಕೂ ಮೊದು', 'ಖಾಲಿ ಹೊಟ್ಟ', 'ಊಟದೊಂದಿಗೆ'],
  ml: ['ഭക്ഷണത്തിനു ശേഷം', 'രാവിലെ ഭക്ഷണത്തിനു മുമ്പ്', 'ഭക്ഷണത്തിനു മുമ്പ്', 'വയറു ശൂന്യം', 'ഭക്ഷണത്തോടൊപ്പം'],
  pa: ['ਖਾਣ ਤੋਂ ਬਾਅਦ', 'ਸਵੇਰ ਤੋਂ ਪਹਿਲਾਂ', 'ਖਾਣ ਤੋਂ ਪਹਿਲਾਂ', 'ਖਾਲੀ ਪੇਟ', 'ਖਾਣ ਨਾਲ'],
  ur: ['کھنے کے بعد', 'ناشتے سے پہلے', 'کھانے سے پہلے', 'بھیجے پیٹ', 'کھانے کے ساتھ'],
};

const instructionTranslations = {
  'After food to avoid gastric irritation': { hi: 'गैस्ट्रिक जलन से बचने के लिए खाने के बाद', mr: 'जठरामाशयीय जलनापासून बचण्यासाठी खाण्यानंतर' },
  'Take with water': { hi: 'पानी के साथ लें', mr: 'पाण्याबरोबर घ्या' },
  'May cause mild drowsiness': { hi: 'हल्की नींद आ सकती है', mr: 'हल्की निंद्रा येऊ शकते' },
  'Take at onset of headache': { hi: 'सिरदर्द की शुरुआत में लें', mr: 'डोकेदुखी सुरू होताच घ्या' },
  'Preventive. Continue for 1 month.': { hi: 'निवारक। 1 महीने तक जारी रखें।', mr: 'प्रतिबंधक। 1 महिन्यासाठी सुरू ठेवा।' },
  'For nausea and vomiting': { hi: 'मतली और उल्टी के लिए', mr: 'मळमळ आणि उलटी साठी' },
};

// Tapering frequency translations for PDF generation
const TAPER_FREQ_TRANSLATIONS = {
  'Once daily':        { hi: 'दिन में एक बार', mr: 'दिवसातून एकदा', gu: 'દિવસમાં એકવાર', bn: 'দিনে একবার', ta: 'நாளில் ஒருமுறை', te: 'రోజుకు ఒకసారి', kn: 'ದಿನಕ್ಕೊಮ್ಮೆ', ml: 'ദിവസം ഒരിക്കൽ', pa: 'ਦਿਨ ਵਿੱਚ ਇੱਕ ਵਾਰ', ur: 'دن میں ایک بار' },
  'Twice daily':       { hi: 'दिन में दो बार', mr: 'दिवसातून दोनदा', gu: 'દિવસมাં બे વาর', bn: 'দিনে দুইবার', ta: 'நாளில் இருமுறை', te: 'రోజుకు రెండుసార్లు', kn: 'ದಿನಕ್ಕೆ ಎರಡು ಬಾರಿ', ml: 'ദിവസം രണ്ടുതവണ', pa: 'ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ', ur: 'دن میں دو بار' },
  'Three times daily': { hi: 'दिन में तीन बार', mr: 'दिवसातून तीनदा', gu: 'દিવસมาં ત્રણ વाર', bn: 'দিনে তিনবার', ta: 'நாளில் மூன்றுமுறை', te: 'రోజుకు మూడుసార్లు', kn: 'ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ', ml: 'ദിവസം മൂന്നുതവണ', pa: 'ਦਿਨ ਵਿੱਚ ਤਿੰਨ ਵਾਰ', ur: 'دن میں تین بار' },
  'Four times daily':  { hi: 'दिन में चार बार', mr: 'दिवसातून चारदा', gu: 'દिवसมาં ચαρ વاร', bn: 'দিনে চারবার', ta: 'நாளில் நான்குமுறை', te: 'రోజుకు నాలుగుసార్లు', kn: 'ದಿನಕ್ಕೆ ನಾಲ್ಕು ಬಾರಿ', ml: 'ദിവസം നാലുതവണ', pa: 'ਦਿਨ ਵਿੱਚ ਚਾਰ ਵਾਰ', ur: 'دن میں چار بار' },
  'Every 8 hours':     { hi: 'हर 8 घंटे', mr: 'दर 8 तासांनी', bn: 'প্রতি ৮ ঘণ্টায়', ta: 'ஒவ்வொரு 8 மணிக்கும்', te: '8 గంటలకు ఒకసారి', kn: 'ಪ್ರತಿ 8 ಗಂಟೆಗೆ', ml: 'ഓരോ 8 മണിക്കൂറിലും', pa: 'ਹਰ 8 ਘੰਟੇ', ur: 'ہر 8 گھنٹے' },
  'Every 12 hours':    { hi: 'हर 12 घंटे', mr: 'दर 12 तासांनी', bn: 'প্রতি ১২ ঘণ্টায়', ta: 'ஒவ்வொரு 12 மணிக்கும்', te: '12 గంటలకు ఒకసారి', kn: 'ಪ್ರತಿ 12 ಗಂಟೆಗೆ', ml: 'ഓരോ 12 മണിക്കൂറിലും', pa: 'ਹਰ 12 ਘੰਟੇ', ur: 'ہر 12 گھنٹے' },
  'Weekly':            { hi: 'साप्ताहिक', mr: 'आठवड्यातून एकदा', bn: 'সাপ্তাহিক', ta: 'வாரம் ஒருமுறை', te: 'వారానికి ఒకసారి', kn: 'ವಾರಕ್ಕೊಮ್ಮೆ', ml: 'ആഴ്ചയിൽ ഒരിക്കൽ', pa: 'ਹਫ਼ਤੇ ਵਿੱਚ ਇੱਕ ਵਾਰ', ur: 'ہفتہ وار' },
};
function translateTaperFreq(freq, lang) {
  if (!freq || !lang || lang === 'en') return freq;
  return (TAPER_FREQ_TRANSLATIONS[freq] && TAPER_FREQ_TRANSLATIONS[freq][lang]) || freq;
}

// Convert any language timing back to English for PDF generation
function timingToEnglish(timingValue) {
  if (!timingValue) return '-';
  if (timingTranslations.en.includes(timingValue)) return timingValue;

  for (const lang of Object.keys(timingTranslations)) {
    const idx = timingTranslations[lang].indexOf(timingValue);
    if (idx !== -1) return timingTranslations.en[idx] || timingValue;
  }

  if (/[^-]/.test(timingValue)) return 'After Meal';
  return timingValue;
}

function instructionToEnglish(instruction) {
  if (!instruction) return '-';
  if (!/[^-]/.test(instruction)) return instruction;

  for (const [enKey, langs] of Object.entries(instructionTranslations)) {
    for (const [, text] of Object.entries(langs)) {
      if (text === instruction) return enKey;
    }
  }

  const reverseMap = {
    'पानी के साथ लें': 'Take with water',
    'पानी के साथ लें, अनुशंसित खुराक से अधिक न लें': 'Take with water, do not exceed recommended dose',
    'डॉक्टर के निर्देशानुसार लें': 'Take as prescribed by doctor',
    'खाने के बाद लें': 'Take after meals',
    'खाने से पहले लें': 'Take before meals',
    'खाली पेट पर लें': 'Take on empty stomach',
    'सोते समय लें': 'Take at bedtime',
    'पूरा कोर्स पूरा करें': 'Complete the full course',
    'कुचलें या चबाएं नहीं': 'Do not crush or chew',
    'शराब से बचें': 'Avoid alcohol',
    'हल्की नींद आ सकती है': 'May cause mild drowsiness',
    'गैस्ट्रिक जलन से बचने के लिए खाने के बाद': 'After food to avoid gastric irritation',
    'खाने से 30 मिनट पहले लें': 'Take 30 min before food',
    'स्थानीय रूप से लगाएं': 'Apply locally',
    'केवल बाहरी उपयोग के लिए': 'For external use only',
    'SOS - जरूरत पड़ने पर ही लें': 'SOS - take only when needed',
    'चिकित्सक के निर्देशानुसार': 'As directed by physician',
    'बुखार और दर्द के लिए': 'For fever and pain',
    'पाण्याबरोबर घ्या': 'Take with water',
    'पाण्याबरोबर घ्या, शिफारस केलेल्या डोसपेक्षा जास्त घेऊ नका': 'Take with water, do not exceed recommended dose',
    'डॉक्टरांच्या सल्ल्यानुसार घ्या': 'Take as prescribed by doctor',
    'जेवणानंतर घ्या': 'Take after meals',
    'जेवणापूर्वी घ्या': 'Take before meals',
    'रिकाम्या पोटी घ्या': 'Take on empty stomach',
    'झोपण्यापूर्वी घ्या': 'Take at bedtime',
    'संपूर्ण कोर्स पूर्ण करा': 'Complete the full course',
    'कुस्करू किंवा चावू नका': 'Do not crush or chew',
    'मद्यपान टाळा': 'Avoid alcohol',
    'हल्की निंद्रा येऊ शकते': 'May cause mild drowsiness',
    'खाण्यापूर्वी 30 मिनिटे आधी घ्या': 'Take 30 min before food',
    'स्थानिकपणे लावा': 'Apply locally',
    'फक्त बाह्य वापरासाठी': 'For external use only',
    'SOS - गरज असेल तेव्हाच घ्या': 'SOS - take only when needed',
    'रक्तचाप नियंत्रण के लिए ACE अवरोधक': 'ACE inhibitor for BP control',
    'दीर्घकालिक ACE अवरोधक': 'Long-acting ACE inhibitor',
    'पेट के लिए सुरक्षात्मक कोटिंग': 'Protective coating for stomach',
    'मतली और उल्टी के लिए': 'For nausea and vomiting',
    'मळमळ आणि उलटी साठी': 'For nausea and vomiting',
    'दीर्घ-कार्यरत ACE प्रतिबंधक': 'Long-acting ACE inhibitor',
    'BP नियंत्रणासाठी ACE प्रतिबंधक': 'ACE inhibitor for BP control',
    'जठरामाशयीय जलनापासून बचण्यासाठी खाण्यानंतर': 'After food to avoid gastric irritation',
    'डोकेदुखी सुरू होताच घ्या': 'Take at onset of headache',
    'प्रतिबंधक। 1 महिन्यासाठी सुरू ठेवा।': 'Preventive. Continue for 1 month.',
    'मळमळीक आणि उल्टीसाठी': 'For nausea and vomiting',
    'पोटासाठी संरक्षक कोटिंग': 'Protective coating for stomach',
    'अचानक दुखापुरठे मदतीसाठी': 'For sudden pain relief',
    'ताप आणि वेदनांसाठी': 'For fever and pain',
    'खोकल्यासाठी': 'For cough',
    'अॅलर्जीसाठी': 'For allergy',
    'अॅसिडिटीसाठी': 'For acidity',
    'डॉक्टरांच्या सल्ल्यानुसार': 'As directed by physician',
    'सिरदर्द की शुरुआत में लें': 'Take at onset of headache',
    'निवारक। 1 महीने तक जारी रखें।': 'Preventive. Continue for 1 month.',
    'अचानक दर्द से राहत के लिए': 'For sudden pain relief',
    'खांसी के लिए': 'For cough',
    'एलर्जी के लिए': 'For allergy',
    'एसिडिटी के लिए': 'For acidity',
    'दीर्घ-कार्यरत ACE अवरोधक': 'Long-acting ACE inhibitor',
  };

  if (reverseMap[instruction]) return reverseMap[instruction];

  for (const [key, val] of Object.entries(reverseMap)) {
    if (instruction.includes(key)) return val;
  }

  return 'As directed by physician';
}

async function generatePrescriptionPDF({ prescriptionId, overrideTemplateId = null, withLetterhead = false, lang = 'en' }) {
  const db = getDb();

  const [prescriptions] = await db.execute(`
      SELECT
        p.id, p.patient_id, p.doctor_id, p.appointment_id, p.visit_id, p.prescribed_date, p.created_at, p.template_id,
        p.chief_complaint, p.advice, p.diagnosis,
        p.follow_up_days, p.follow_up_date,
        p.patient_notes, p.private_notes, p.lab_advice, p.lab_remarks,
        -- Doctor-defined pad fields (e.g. "Negative History") live here as JSON.
        p.custom_fields,
        pa.name as patient_name, pa.phone as patient_phone, pa.patient_id as uhid,
        pa.dob, pa.age_years, pa.gender,
        u.name as doctor_name, d.specialization, d.qualification, d.user_id as doctor_user_id,
        d.license_number, d.medical_council, d.signature_image,
        c.id as clinic_id, c.name as clinic_name, c.phone as clinic_phone, c.address as clinic_address
      FROM prescriptions p
      LEFT JOIN patients pa ON p.patient_id = pa.id
      LEFT JOIN doctors d ON p.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON d.clinic_id = c.id
      WHERE p.id = ?
    `, [prescriptionId]);

  if (prescriptions.length === 0) {
    throw ApiError.notFound('Prescription');
  }

  const prescription = prescriptions[0];

  // Latest vitals for this visit (appointment) if any, else nearest prior reading
  let vitals = null;
  try {
    if (prescription.appointment_id) {
      const [vRows] = await db.execute(
        `SELECT temperature AS temp, height_cm AS height, weight_kg AS weight, bmi, pulse, spo2, blood_pressure
         FROM patient_vitals WHERE appointment_id = ? ORDER BY recorded_at DESC LIMIT 1`,
        [prescription.appointment_id],
      );
      if (vRows.length > 0) vitals = vRows[0];
    }
    if (!vitals) {
      // Compare on calendar day, not timestamp: prescribed_date is a DATE (no
      // time), so `recorded_at <= prescribed_date` resolved to midnight and
      // silently excluded every reading taken later the same day — the visit's
      // own vitals. DATE(recorded_at) <= DATE(?) keeps same-day readings.
      const [vRows] = await db.execute(
        `SELECT temperature AS temp, height_cm AS height, weight_kg AS weight, bmi, pulse, spo2, blood_pressure
         FROM patient_vitals WHERE patient_id = ? AND DATE(recorded_at) <= DATE(?) ORDER BY recorded_at DESC LIMIT 1`,
        [prescription.patient_id, prescription.prescribed_date || new Date()],
      );
      if (vRows.length > 0) vitals = vRows[0];
    }
  } catch (e) { /* vitals are optional on the printout */ }

  // Patient Medical History — the pad shows it (conditions / allergies /
  // surgeries / family history) but it was never carried onto the printout.
  // It's patient-level data, not stored on the prescription, so it's fetched
  // here. Every part is optional: a missing table or column must never take
  // the whole PDF down, so each query fails soft like vitals above.
  const history = { conditions: [], allergies: [], surgeries: [], family: [], positives: [] };
  const softQuery = async (sql, params) => {
    try {
      const [rows] = await db.execute(sql, params);
      return rows;
    } catch (e) {
      return [];
    }
  };
  if (prescription.patient_id) {
    const pid = prescription.patient_id;
    history.conditions = await softQuery(
      `SELECT condition_name, status FROM patient_chronic_conditions
        WHERE patient_id = ? AND status = 'Active' ORDER BY created_at DESC`, [pid]);
    history.allergies = await softQuery(
      `SELECT allergen_name, severity, reaction FROM patient_allergies
        WHERE patient_id = ? AND is_active = 1 ORDER BY severity DESC`, [pid]);
    history.surgeries = await softQuery(
      `SELECT surgery_name, surgery_date FROM patient_surgical_history
        WHERE patient_id = ? ORDER BY surgery_date DESC`, [pid]);
    history.family = await softQuery(
      `SELECT relation, condition_name FROM family_history
        WHERE patient_id = ? ORDER BY created_at DESC`, [pid]);
    // Ticked history options (the checkbox-style list on the pad).
    history.positives = await softQuery(
      `SELECT mho.condition_name, pmh.since_date
         FROM patient_medical_history pmh
         JOIN medical_history_options mho ON mho.id = pmh.option_id
        WHERE pmh.patient_id = ? AND pmh.has_condition = TRUE
        ORDER BY mho.display_order ASC, mho.condition_name ASC`, [pid]);
  }

  // "Refer Doctor" from the pad writes a patient_referrals row (patient-scoped,
  // no prescription link), so match the latest one on/around this Rx's date.
  let referral = null;
  if (prescription.patient_id) {
    // Match the referral made during THIS visit (same calendar day as the Rx),
    // not an unrelated older one that would otherwise print on every future Rx.
    const refRows = await softQuery(
      `SELECT referred_doctor_name, referred_doctor_phone, referred_doctor_specialization,
              hospital_name, reason, priority, notes, referral_date
         FROM patient_referrals
        WHERE patient_id = ?
          AND DATE(referral_date) = DATE(?)
        ORDER BY id DESC LIMIT 1`,
      [prescription.patient_id, prescription.prescribed_date || new Date()],
    );
    if (refRows.length > 0 && (refRows[0].referred_doctor_name || refRows[0].hospital_name)) {
      referral = refRows[0];
    }
  }

  const [items] = await db.execute(`
      SELECT pi.id, pi.medicine_name, pi.dosage, pi.frequency, pi.duration, pi.notes as instructions, pi.timing, pi.quantity, pi.is_tapering,
             COALESCE(m.generic_name, "") as generic_name
      FROM prescription_items pi
      LEFT JOIN medicines m ON pi.medicine_id = m.id
      WHERE pi.prescription_id = ? ORDER BY pi.sort_order ASC, pi.id ASC
    `, [prescriptionId]);

  for (const item of items) {
    if (item.is_tapering) {
      const [steps] = await db.execute(
        `SELECT step_number, dose, frequency, duration_days
           FROM tapering_schedules WHERE prescription_item_id = ? ORDER BY step_number ASC`,
        [item.id],
      );
      item.tapering_schedule = steps;
    }
  }

  // Print layout the doctor configured in Clinical > Rx Template (page margins
  // + blank space for pre-printed letterhead). Stored per USER id, matching the
  // pad_configurations convention used below. When nothing is saved the
  // geometry below stays byte-for-byte what it was before this was wired up.
  let printLayout = null;
  try {
    if (prescription.doctor_user_id) {
      const [layoutRows] = await db.execute(
        `SELECT content FROM rx_template_config
          WHERE doctor_id = ? AND template_type = 'print_layout' AND is_active = 1
          ORDER BY is_default DESC, id DESC LIMIT 1`,
        [prescription.doctor_user_id],
      );
      if (layoutRows.length > 0 && layoutRows[0].content) {
        const parsed = typeof layoutRows[0].content === 'string'
          ? JSON.parse(layoutRows[0].content)
          : layoutRows[0].content;
        if (parsed && typeof parsed === 'object') printLayout = parsed;
      }
    }
  } catch (layoutErr) {
    console.warn('print layout load skipped:', layoutErr.message);
  }

  const layoutMm = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= 200 ? n : fallback;
  };

  const padLeftMm = layoutMm(printLayout?.left, 10);
  const padRightMm = layoutMm(printLayout?.right, 10);
  const marginTopMm = layoutMm(printLayout?.top, 10);
  const marginBottomMm = layoutMm(printLayout?.bottom, 10);
  const contentTopMm = layoutMm(printLayout?.contentTop, 0);
  const contentBottomMm = layoutMm(printLayout?.contentBottom, 0);

  // Total blank band above the content. Printing WITHOUT a letterhead means
  // printing onto pre-printed stationery, so that band must clear the printed
  // header on EVERY page — which is exactly what "all patient names merged into
  // the blue strip" was: the band was fixed and could not be tuned per printer.
  // The Rx Template bands exist to clear a header/footer PRE-PRINTED on the
  // paper, so they only apply when printing WITHOUT a letterhead. With a
  // letterhead the banner is drawn at the very top of the page ourselves —
  // reserving the band as well left an empty strip above the letterhead and
  // pushed the doctor's signature onto a second sheet.
  const topBandMm = withLetterhead
    ? 10
    : (printLayout ? marginTopMm + contentTopMm : BLANK_LETTERHEAD_MM);
  const bottomBandMm = withLetterhead
    ? 0
    : (printLayout ? marginBottomMm + contentBottomMm : 0);

  let letterhead = null;
  if (withLetterhead) {
    try {
      letterhead = await resolvePrescriptionLetterhead(db, prescription, overrideTemplateId);
    } catch (e) {
      console.error('Letterhead fetch error:', e.message);
    }
  }
  const headerImg = letterhead?.header_image || null;
  const footerImg = letterhead?.footer_image || null;

  // ── Build HTML for prescription (Unicode-safe via headless Chrome) ─────────
  const prescDate = prescription.prescribed_date ? new Date(prescription.prescribed_date) : new Date();
  const dateStr = prescDate.toLocaleDateString('en-IN');
  // prescribed_date is a DATE-only column — it has no time-of-day component,
  // so every prescription (regardless of when it was actually written) was
  // showing a flat "12:00 am". created_at is a real timestamp; use that for
  // the time shown, while keeping prescribed_date for the calendar day
  // (which a doctor can intentionally backdate independent of created_at).
  const timeSource = prescription.created_at ? new Date(prescription.created_at) : prescDate;
  const timeStr = timeSource.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Build medication rows (unified — meds + injections in one table)
  const medRows = items.map((item, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? '#fff' : '#f9fafb';
    let remarks = unwrapJsonText(item.instructions) || '';
    if (item.is_tapering && item.tapering_schedule && item.tapering_schedule.length > 0) {
      remarks = item.tapering_schedule
        .map((s, i) => `${i > 0 ? '-> ' : ''}${s.dose} ${translateTaperFreq(s.frequency, lang)} x${s.duration_days}d`)
        .join(' ');
    }
    const freqCell = item.is_tapering ? 'Tapering' : esc(item.frequency || '-');
    const timingText = unwrapJsonText(item.timing);
    const freqFull = timingText ? `${freqCell}<br><span style="font-size:7pt;color:#888">${esc(timingText)}</span>` : freqCell;
    const medNameCell = `<strong style="text-transform:uppercase;font-size:8pt">${esc(item.medicine_name)}</strong>${item.generic_name ? `<div style="font-size:7.5pt;color:#444;margin-top:1px">${esc(item.generic_name)}</div>` : ""}`;
    return `<tr style="background:${rowBg};border-bottom:1px solid #e5e7eb">
      <td style="text-align:center;color:#666;font-size:7.5pt">${idx + 1}</td>
      <td>${medNameCell}</td>
      <td style="text-align:center">${esc(item.dosage || '-')}</td>
      <td style="text-align:center">${freqFull}</td>
      <td style="text-align:center">${esc(item.duration || '-')}</td>
      <td style="color:#374151">${esc(remarks || '-')}</td>
    </tr>`;
  }).join('');

  // The pad stores PER-TEST lab remarks as a JSON header inside lab_remarks:
  //   __TAG_REMARKS__:{"bsl fasting pp":"AFTER 1 MONTH"} then a newline then free text
  // Only the pad knew that encoding, so the PDF printed the raw tag line under
  // "Lab Remarks" and left every test's Remarks column as an em-dash.
  const { labTagRemarks, labFreeRemarks } = (() => {
    const raw = prescription.lab_remarks || '';
    const MARKER = '__TAG_REMARKS__:';
    if (!raw.startsWith(MARKER)) return { labTagRemarks: {}, labFreeRemarks: raw.trim() };
    const nlIdx = raw.indexOf('\n');
    const jsonStr = nlIdx >= 0 ? raw.slice(MARKER.length, nlIdx) : raw.slice(MARKER.length);
    const rest = nlIdx >= 0 ? raw.slice(nlIdx + 1) : '';
    let parsed = {};
    try {
      const obj = JSON.parse(jsonStr);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        // Lower-cased keys so lookup survives casing drift between the tag as
        // typed in lab_advice and the tag the remark was saved against.
        for (const [k, v] of Object.entries(obj)) {
          if (v != null && String(v).trim()) parsed[String(k).trim().toLowerCase()] = String(v).trim();
        }
      }
    } catch { /* malformed header — fall through to free text only */ }
    return { labTagRemarks: parsed, labFreeRemarks: rest.trim() };
  })();

  // Lab investigations table rows
  let labTags = prescription.lab_advice
    ? prescription.lab_advice.replace(/^Investigations?:\s*/i, '').split(',').map(t => t.trim()).filter(Boolean)
    : [];

  // Advice text — always strip Investigations lines
  let adviceText = prescription.advice || '';
  // If lab_advice is empty, extract investigations from advice text
  if (labTags.length === 0 && adviceText) {
    const seen = new Set();
    const matches = adviceText.matchAll(/Investigations?:\s*(.+)/gi);
    for (const m of matches) {
      const tags = m[1].split(',').map(t => t.trim()).filter(Boolean);
      for (const tag of tags) {
        if (!seen.has(tag)) { seen.add(tag); labTags.push(tag); }
      }
    }
  }
  // Always remove all "Investigations:" lines from advice text
  adviceText = adviceText.replace(/\n?Investigations?:[^\n]*/gi, '').trim();
  // One advice point per line (not comma-joined), matching the reference layout
  let adviceLines = adviceText
    .split(/\r?\n+/)
    .map(s => s.trim())
    .filter(Boolean);
  // Historically the Patient Notes text was merged into the `advice` column too,
  // so it printed under BOTH "Advice" and "Notes". Drop any advice line that is
  // just repeating a line of patient_notes (fixes already-saved prescriptions;
  // new ones no longer merge).
  if (prescription.patient_notes) {
    const noteLines = new Set(
      String(prescription.patient_notes).split(/\r?\n+/).map(s => s.trim().toLowerCase()).filter(Boolean),
    );
    adviceLines = adviceLines.filter(l => !noteLines.has(l.trim().toLowerCase()));
  }

  const labRows = labTags.map((tag, i) => {
    const parts = tag.split(':');
    const testName = parts[0].trim();
    const remark = parts.slice(1).join(':').trim()
      || labTagRemarks[testName.toLowerCase()]
      || '';
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="text-align:center;color:#666">${i + 1}</td>
      <td style="font-weight:500">${esc(testName)}</td>
      <td style="color:#555">${esc(remark) || '\u2014'}</td>
    </tr>`;
  }).join('');

  const notesIsInvestigation = prescription.patient_notes && /^investigations?:/i.test(prescription.patient_notes.trim());

  // Extract examination findings from private_notes ([EXAM_FINDINGS] marker)
  let examFindings = '';
  if (prescription.private_notes) {
    const examMatch = prescription.private_notes.match(/\[EXAM_FINDINGS\]\n?([\s\S]*)/);
    if (examMatch) examFindings = examMatch[1].trim();
  }

  const ageGenderPhone = [
    prescription.gender,
    prescription.age_years !== null && prescription.age_years !== undefined ? prescription.age_years + ' Yrs' : '',
    prescription.patient_phone ? 'Ph: ' + prescription.patient_phone : '',
    prescription.uhid ? 'UHID: ' + prescription.uhid : ''
  ].filter(Boolean).join(' | ');
  const docDateTime = `${dateStr} &nbsp; ${timeStr}`;

  // Follow-up: prefer explicit follow_up_date, else prescribed_date + follow_up_days
  let followUpDateStr = '';
  if (prescription.follow_up_date) {
    followUpDateStr = new Date(prescription.follow_up_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } else if (prescription.follow_up_days) {
    const d = new Date(prescDate);
    d.setDate(d.getDate() + parseInt(prescription.follow_up_days, 10));
    followUpDateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Vitals bar
  const vitalsLine = vitals ? [
    vitals.temp && `Temp: ${vitals.temp}°F`,
    vitals.blood_pressure && `BP: ${vitals.blood_pressure}`,
    vitals.pulse && `Pulse: ${vitals.pulse} bpm`,
    vitals.weight && `Wt: ${vitals.weight} kg`,
    vitals.height && `Ht: ${vitals.height} cm`,
    vitals.bmi && `BMI: ${vitals.bmi}`,
    vitals.spo2 && `SpO2: ${vitals.spo2}%`,
  ].filter(Boolean).join('   ') : '';

  // The doctor name/qualification/date/Rx-ID line is gone — date now shows
  // inline with the patient's name, and Rx ID isn't shown at all. Only the
  // divider rule remains, separating the letterhead banner/clinic name from
  // the patient info block below it.
  const headerRuleHTML = `<div class="header-rule"></div>`;

  // ── Patient Medical History block ────────────────────────────────────────
  // One labelled line per populated group; groups with nothing recorded are
  // dropped entirely rather than printing "None recorded" noise on paper.
  const fmtHistDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-IN');
  };
  const historyGroups = [];
  if (history.positives.length) {
    historyGroups.push(['History', history.positives.map((h) => {
      const since = fmtHistDate(h.since_date);
      return h.condition_name + (since ? ` (since ${since})` : '');
    })]);
  }
  if (history.conditions.length) {
    historyGroups.push(['Existing Conditions', history.conditions.map((c) => c.condition_name)]);
  }
  if (history.allergies.length) {
    historyGroups.push(['Allergies', history.allergies.map((a) => {
      const detail = [a.severity, a.reaction].filter(Boolean).join(' - ');
      return a.allergen_name + (detail ? ` (${detail})` : '');
    })]);
  }
  if (history.surgeries.length) {
    historyGroups.push(['Surgical History', history.surgeries.map((s) => {
      const on = fmtHistDate(s.surgery_date);
      return s.surgery_name + (on ? ` (${on})` : '');
    })]);
  }
  if (history.family.length) {
    historyGroups.push(['Family History', history.family.map((f) => `${f.relation}: ${f.condition_name}`)]);
  }
  const historyHTML = historyGroups.length
    ? `<div class="section-title">Patient Medical History</div>` +
      historyGroups.map(([label, values]) =>
        `<div class="info-row"><strong>${esc(label)}:</strong> ${esc(values.filter(Boolean).join(', '))}</div>`,
      ).join('')
    : '';

  // ── Doctor-defined pad fields (Negative History, etc.) ───────────────────
  // Printed under their own headings, in the order the doctor entered them.
  let customFieldsHTML = '';
  try {
    const raw = prescription.custom_fields;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      customFieldsHTML = Object.entries(parsed)
        .filter(([, v]) => v != null && String(v).trim() !== '')
        .map(([label, v]) => {
          // The pad seeds these textareas with the field's own name as the
          // first line ("Negative History\n - qqqq"), which would print the
          // heading twice. Drop that line when it just repeats the heading.
          const lines = String(v).trim().split('\n');
          if (lines.length > 1 && lines[0].trim().toLowerCase() === label.trim().toLowerCase()) {
            lines.shift();
          }
          const body = lines.join('\n').trim();
          if (!body) return '';
          return `<div class="section-title">${esc(label)}</div>` +
            `<div style="font-size:8pt;white-space:pre-wrap;color:#374151">${esc(body)}</div>`;
        })
        .join('');
    }
  } catch (e) { /* malformed custom_fields must not break the printout */ }

  // ── Referred To ─────────────────────────────────────────────────────────────
  let referralHTML = '';
  if (referral) {
    const subParts = [referral.referred_doctor_specialization, referral.hospital_name].filter(Boolean).join(' • ');
    const isUrgent = String(referral.priority || '').toLowerCase() === 'urgent';
    const noteParts = [referral.reason, referral.notes].map((s) => (s || '').trim()).filter(Boolean).join(' | ');
    referralHTML = `<div class="section-title">Referred To</div>
      <div class="info-row"><strong>Dr. ${esc(referral.referred_doctor_name || '')}</strong>${subParts ? ` — ${esc(subParts)}` : ''}${isUrgent ? ' <span style="color:#b91c1c;font-weight:700">(URGENT)</span>' : ''}</div>
      ${referral.referred_doctor_phone ? `<div class="info-row">Contact: ${esc(referral.referred_doctor_phone)}</div>` : ''}
      ${noteParts ? `<div class="info-row" style="color:#4b5563">Note: ${esc(noteParts)}</div>` : ''}`;
  }

  let headerHTML = '';
  if (withLetterhead) {
    if (headerImg) {
      headerHTML += `<div class="lh-img"><img src="${headerImg}"/></div>`;
    }
    if (letterhead?.header_content) {
      headerHTML += `<div class="lh-content">${safeTemplateHtml(letterhead.header_content)}</div>`;
    }
    if (!headerImg && !letterhead?.header_content) {
      headerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5mm">
          <span style="font-size:12pt;font-weight:bold;color:#c62828">${esc(prescription.clinic_name || 'CLINIC')}</span>
        </div>
        ${prescription.clinic_address || prescription.clinic_phone ? `<div style="font-size:7pt;color:#666;margin-bottom:2mm">${esc(prescription.clinic_address || '')}${prescription.clinic_phone ? ' | Ph: ' + esc(prescription.clinic_phone) : ''}</div>` : ''}`;
    }
    headerHTML += headerRuleHTML;
  }

  const footerContentHTML = withLetterhead && letterhead?.footer_content
    ? `<div class="rx-footer-content">${safeTemplateHtml(letterhead.footer_content)}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:8.5pt;color:#111;padding:10mm ${padRightMm}mm 10mm ${padLeftMm}mm}
  .lh-img{margin:-10mm -${padRightMm}mm 2mm -${padLeftMm}mm}
  .lh-img img{width:100%;display:block}
  .lh-content{font-size:8pt;color:#374151;margin-bottom:2mm}
  .header-rule{border-top:1.5px solid #003366;margin:1mm 0 2.5mm 0}
  .rx-footer-content{margin-top:8mm;padding-top:2mm;border-top:1px solid #d1d5db;text-align:center;font-size:8pt;color:#475569;page-break-inside:avoid}
  .patient-block{padding:3px 7px;background:#f0f4ff;border-radius:3px;margin-bottom:2mm}
  .patient-row{display:flex;justify-content:space-between;align-items:baseline}
  .patient-name{font-size:9.75pt;font-weight:700;text-transform:uppercase;letter-spacing:0.2pt}
  .patient-date{font-size:7.5pt;font-weight:700;color:#003366;white-space:nowrap}
  .patient-sub{font-size:7.5pt;color:#555;margin-top:1px}
  .vitals-bar{margin-bottom:2mm;padding:2.5px 7px;background:#f8f9fa;border-radius:3px;font-size:7.5pt;color:#374151}
  .info-row{font-size:8pt;margin-bottom:1mm}
  .info-row strong{color:#003366}
  .section-title{font-weight:700;font-size:8.25pt;color:#003366;border-bottom:1.5px solid #003366;padding-bottom:1.5px;margin:3mm 0 1.5mm 0;letter-spacing:0.3pt;text-transform:uppercase}
  table{width:100%;border-collapse:collapse}
  .rx-head th{background:#003366;color:#fff;font-size:7.5pt;padding:3.5px 5px;text-align:left;border:1px solid #1a4a8a}
  .rx-head th:first-child,.rx-head th:nth-child(3),.rx-head th:nth-child(4),.rx-head th:nth-child(5){text-align:center}
  .lab-head th{background:#e8edf5;color:#003366;font-size:7.5pt;padding:3px 5px;border:1px solid #c5cfe0}
  .lab-head th:first-child{text-align:center}
  td{font-size:7.5pt;padding:3.5px 5px;border:1px solid #94a3b8;vertical-align:middle}
  .lab-body td{border:1px solid #94a3b8}
  .lab-body td:first-child{text-align:center;color:#666}
  .advice-list{font-size:8pt;color:#374151;line-height:1.5}
  .followup-box{margin-top:3mm;padding:3px 10px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;text-align:center;white-space:nowrap}
  .followup-box .fu-title{font-weight:700;font-size:7.5pt;color:#15803d;letter-spacing:0.5pt}
  .followup-box .fu-date{font-size:9pt;font-weight:700;color:#111;margin-left:5px}
  .followup-box .fu-days{font-size:7.5pt;color:#555;margin-left:4px}
  .sig{margin-top:8mm;text-align:right;padding-right:6mm}
  .sig-img{height:14mm;margin-left:auto;display:block}
  .sig-line{border-top:1px solid #333;width:110px;margin-left:auto;margin-bottom:1.5mm}
</style>
</head>
<body>
${headerHTML}
<div class="patient-block">
  <div class="patient-row">
    <span class="patient-name">${esc(prescription.patient_name || 'N/A')}</span>
    <span class="patient-date">${docDateTime}</span>
  </div>
  ${ageGenderPhone ? `<div class="patient-sub">${esc(ageGenderPhone)}</div>` : ''}
</div>
${vitalsLine ? `<div class="vitals-bar"><strong style="color:#003366">VITALS:</strong> ${esc(vitalsLine)}</div>` : ''}
${prescription.chief_complaint ? `<div class="info-row"><strong>C/O:</strong> ${esc(unwrapJsonText(prescription.chief_complaint))}</div>` : ''}
${prescription.diagnosis ? `<div class="info-row"><strong>Dx:</strong> <span style="font-weight:500">${esc(unwrapJsonText(prescription.diagnosis))}</span></div>` : ''}
${examFindings ? `<div class="info-row"><strong>Examination:</strong> ${esc(examFindings)}</div>` : ''}
${historyHTML}
${customFieldsHTML}
<div class="section-title">Rx Prescription</div>
<table>
  <thead class="rx-head"><tr>
    <th style="width:5%">Sr.</th>
    <th style="width:25%">Medications</th>
    <th style="width:10%">Dose</th>
    <th style="width:15%">Frequency</th>
    <th style="width:10%">Duration</th>
    <th style="width:35%">Remarks</th>
  </tr></thead>
  <tbody>${medRows || '<tr><td colspan="6" style="text-align:center;color:#888;padding:6px">No medications prescribed</td></tr>'}</tbody>
</table>
${labRows ? `<div class="section-title">Prescribed Lab Tests</div>
<table><thead class="lab-head"><tr><th style="width:4%">#</th><th style="width:35%">Test Name</th><th>Remarks</th></tr></thead>
<tbody class="lab-body">${labRows}</tbody></table>` : ''}
${adviceLines.length > 0 ? `<div class="section-title">Advice</div><div class="advice-list">${adviceLines.map(l => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
${labFreeRemarks ? `<div class="section-title">Lab Remarks</div><div style="font-size:8pt;color:#374151">${esc(labFreeRemarks)}</div>` : ''}
${prescription.patient_notes && !notesIsInvestigation ? `<div class="section-title">Notes</div><div style="font-size:8pt;white-space:pre-wrap;color:#374151;padding-left:4px;border-left:2px solid #93c5fd">${esc(prescription.patient_notes)}</div>` : ''}
${referralHTML}
${followUpDateStr ? `<div class="followup-box"><span class="fu-title">FOLLOW UP</span><span class="fu-date">${followUpDateStr}</span>${prescription.follow_up_days ? `<span class="fu-days">(After ${esc(String(prescription.follow_up_days))} Day(s))</span>` : ''}</div>` : ''}
<div class="sig">
  ${prescription.signature_image ? `<img class="sig-img" src="${prescription.signature_image.startsWith('data:') ? prescription.signature_image : 'data:image/png;base64,' + prescription.signature_image}"/>` : `<div class="sig-line"></div>`}
  <div style="font-weight:700;font-size:9pt">Dr. ${esc(prescription.doctor_name)}</div>
  ${prescription.qualification ? `<div style="font-size:7.5pt;color:#555">${esc(prescription.qualification)}</div>` : ''}
  ${prescription.license_number ? `<div style="font-size:7pt;color:#777">Reg. No: ${esc(prescription.license_number)}${prescription.medical_council ? ' (' + esc(prescription.medical_council) + ')' : ''}</div>` : ''}
</div>
${footerContentHTML}
${withLetterhead && footerImg ? `<div style="position:fixed;bottom:0;left:0;right:0"><img src="${footerImg}" style="width:100%;display:block"/></div>` : ''}
</body></html>`;

  // ── Render HTML to PDF using puppeteer ────────────────────────────────────
  let browser;
  try {
    // Always use puppeteer's own bundled Chrome — ignore PUPPETEER_EXECUTABLE_PATH env var
    const launchOpts = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    };
    try {
      launchOpts.executablePath = puppeteer.executablePath();
    } catch (e) { /* use default */ }
    browser = await puppeteer.launch(launchOpts);
    const page = await browser.newPage();
    if (withLetterhead) await page.setViewport({ width: 794, height: 1123 }); // A4 @ 96dpi for measuring
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // withLetterhead+footerImg already renders its own fixed-position footer
    // image inside the page content, so leave Puppeteer's own footer blank
    // there. Otherwise show a small branded "Page X / Y" footer instead of
    // letting Chrome print its default URL/date header-footer.
    const useNativeFooter = !(withLetterhead && footerImg);
    // Letterhead prints only: when the Rx overflows the sheet by a little (e.g.
    // just the signature spilling over), shrink slightly to keep it on ONE
    // page. A genuinely long Rx still paginates at normal size. Plain-paper
    // prints are left exactly as they were.
    let scale = 1;
    if (withLetterhead) {
      const marginTop = Math.max(0, topBandMm - 10);
      const marginBottom = Math.max(footerImg ? 25 : (useNativeFooter ? 10 : 0), bottomBandMm);
      const needed = await fitToOnePageScale(page, { marginTopMm: marginTop, marginBottomMm: marginBottom, minScale: 0 });
      if (needed < 1 && needed >= 0.85) scale = needed;
    }
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      scale,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: useNativeFooter
        ? '<div style="width:100%;font-size:7pt;color:#999;text-align:center;font-family:Arial,sans-serif;padding:0 10mm">Generated by Dr Jaju Care &nbsp;&bull;&nbsp; Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
        : '<div></div>',
      margin: {
        // Printing WITHOUT a letterhead means printing onto the clinic's
        // pre-printed letterhead paper — keep that area clear on EVERY page.
        // body's own 10mm padding-top counts toward the band, so only the
        // remainder goes here. With a letterhead the banner image is drawn
        // inline at the top of the page, so the margin stays 0.
        top: `${Math.max(0, topBandMm - 10)}mm`,
        right: '0',
        bottom: `${Math.max(
          withLetterhead && footerImg ? 25 : (useNativeFooter ? 10 : 0),
          bottomBandMm,
        )}mm`,
        left: '0',
      },
    });
    return {
      buffer: Buffer.from(pdfBuffer),
      filename: `prescription_${prescriptionId}.pdf`,
      contentType: 'application/pdf',
    };
  } finally {
    if (browser) await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt / bill letterhead
// ─────────────────────────────────────────────────────────────────────────────

const toImgSrc = (v) => {
  if (!v) return null;
  const s = String(v);
  return s.startsWith('data:') || /^https?:\/\//i.test(s) ? s : `data:image/png;base64,${s}`;
};

// Template header/footer HTML is authored by clinic admins; strip anything
// executable before handing it to the headless renderer.
const safeTemplateHtml = (html) => (html ? String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/javascript:/gi, '') : '');

// Pixel size of a data-URL image (PNG / JPEG / GIF) without extra deps — used
// to size the page's bottom margin so a letterhead footer sits flush at the
// bottom edge of every page instead of floating above an arbitrary gap.
function imageSizeFromDataUrl(src) {
  try {
    const m = /^data:[^;]+;base64,(.*)$/.exec(String(src || ''));
    if (!m) return null;
    const b = Buffer.from(m[1], 'base64');
    if (b.length > 24 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') {
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    }
    if (b.length > 10 && b.toString('ascii', 0, 3) === 'GIF') {
      return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i += 1; continue; }
        const marker = b[i + 1];
        const len = b.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        }
        i += 2 + len;
      }
    }
  } catch { /* unknown format */ }
  return null;
}

/**
 * Decide which letterhead a bill prints with. One rule, shared by the PDF and
 * by GET /api/bills/:id (so the in-app preview and the printout always match):
 *   1. the template picked on the bill (or an explicit override)
 *   2. the clinic's default receipt template
 *   3. the doctor's prescription-pad header/footer
 *   4. plain clinic name/address text
 */
async function resolveBillLetterhead(db, bill, overrideTemplateId = null) {
  const soft = async (sql, params) => {
    try { const [rows] = await db.execute(sql, params); return rows; } catch { return []; }
  };
  const shape = (row, source) => {
    if (!row || !(row.header_image || row.header_content || row.footer_image || row.footer_content)) return null;
    return {
      source,
      template_id: row.id ?? null,
      template_name: row.template_name ?? null,
      header_image: toImgSrc(row.header_image),
      header_content: row.header_content || null,
      footer_image: toImgSrc(row.footer_image),
      footer_content: row.footer_content || null,
    };
  };
  const cols = 'id, template_name, header_image, header_content, footer_image, footer_content';

  const explicitId = overrideTemplateId || bill.template_id;
  if (explicitId) {
    const rows = await soft(`SELECT ${cols} FROM receipt_templates WHERE id = ? LIMIT 1`, [explicitId]);
    const lh = shape(rows[0], 'template');
    if (lh) return lh;
  }

  const defaults = await soft(
    `SELECT ${cols} FROM receipt_templates
      WHERE is_default = 1 AND (clinic_id = ? OR clinic_id IS NULL)
      ORDER BY (clinic_id IS NULL) ASC, created_at DESC, id DESC LIMIT 1`,
    [bill.clinic_id ?? null],
  );
  const defaultLh = shape(defaults[0], 'default_template');
  if (defaultLh) return defaultLh;

  if (bill.doctor_id) {
    const pad = await soft(
      `SELECT pc.header_image, pc.footer_image
         FROM pad_configurations pc JOIN doctors d ON d.user_id = pc.doctor_id
        WHERE d.id = ? LIMIT 1`,
      [bill.doctor_id],
    );
    const padLh = shape(pad[0], 'pad');
    if (padLh) return padLh;
  }

  return {
    source: 'clinic', template_id: null, template_name: null,
    header_image: null, header_content: null, footer_image: null, footer_content: null,
  };
}

/**
 * Resolve the prescription letterhead. The selected/saved template takes
 * priority, followed by the doctor's pad configuration and clinic default.
 * Return text as well as image fields so both HTML and image-only templates
 * print consistently on the generated/shared PDF.
 */
async function resolvePrescriptionLetterhead(db, prescription, overrideTemplateId = null) {
  const soft = async (sql, params) => {
    try { const [rows] = await db.execute(sql, params); return rows; } catch { return []; }
  };
  const shape = (row, source) => {
    if (!row || !(row.header_image || row.header_content || row.footer_image || row.footer_content)) return null;
    return {
      source,
      template_id: row.id ?? null,
      template_name: row.template_name ?? null,
      header_image: toImgSrc(row.header_image),
      header_content: row.header_content || null,
      footer_image: toImgSrc(row.footer_image),
      footer_content: row.footer_content || null,
    };
  };
  const templateColumns = 'id, template_name, header_image, header_content, footer_image, footer_content';
  const selectedTemplateId = overrideTemplateId || prescription?.template_id;

  if (selectedTemplateId) {
    const rows = await soft(
      `SELECT ${templateColumns} FROM receipt_templates WHERE id = ? LIMIT 1`,
      [selectedTemplateId],
    );
    const selected = shape(rows[0], 'template');
    if (selected) return selected;
  }

  if (prescription?.doctor_user_id) {
    const rows = await soft(
      `SELECT header_image, header_content, footer_image, footer_content
         FROM pad_configurations WHERE doctor_id = ? LIMIT 1`,
      [prescription.doctor_user_id],
    );
    const padLetterhead = shape(rows[0], 'pad');
    if (padLetterhead) return padLetterhead;
  }

  const defaults = await soft(
    `SELECT ${templateColumns} FROM receipt_templates
      WHERE is_default = 1 AND (clinic_id = ? OR clinic_id IS NULL)
      ORDER BY (clinic_id IS NULL) ASC, created_at DESC, id DESC LIMIT 1`,
    [prescription?.clinic_id ?? null],
  );
  return shape(defaults[0], 'default_template');
}

// Receipts and certificates are one-sheet documents. When the content spills
// just past the page (long template text, tall letterhead art) shrink it to
// fit ONE sheet instead of printing a near-empty second page. Genuinely long
// content still flows onto more pages once it would need < minScale.
async function fitToOnePageScale(page, { marginTopMm, marginBottomMm, minScale = 0.65 }) {
  await page.evaluate(() => Promise.all(Array.from(document.images).map((img) => (
    img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
  ))));
  const contentPx = await page.evaluate(() => Math.ceil(document.body.getBoundingClientRect().bottom));
  const availablePx = ((297 - marginTopMm - marginBottomMm) * 96) / 25.4;
  if (contentPx <= availablePx) return 1;
  return Math.max(minScale, Math.floor((availablePx / contentPx) * 100) / 100);
}

// Doctor's Clinical > Rx Template print layout (margins + blank band for
// pre-printed stationery), stored per USER id. Null when nothing is saved.
async function loadPrintLayout(db, doctorUserId) {
  if (!doctorUserId) return null;
  try {
    const [rows] = await db.execute(
      `SELECT content FROM rx_template_config
        WHERE doctor_id = ? AND template_type = 'print_layout' AND is_active = 1
        ORDER BY is_default DESC, id DESC LIMIT 1`,
      [doctorUserId],
    );
    if (!rows.length || !rows[0].content) return null;
    const parsed = typeof rows[0].content === 'string' ? JSON.parse(rows[0].content) : rows[0].content;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Letterhead + signing doctor for a medical certificate — "same as the
 * prescription pad". Used by both GET /api/medical-certificates/:id (preview)
 * and the certificate PDF so the two always match. Order:
 *   1. header/footer images uploaded on the certificate itself
 *   2. the doctor's prescription-pad letterhead
 *   3. the clinic's default letterhead template
 *   4. plain clinic name/address text
 */
async function resolveCertificateLetterhead(db, cert) {
  const soft = async (sql, params) => {
    try { const [rows] = await db.execute(sql, params); return rows; } catch { return []; }
  };

  // Certificates store the doctor by NAME (no doctor_id). Match it to a doctor
  // account; fall back to whoever created the certificate.
  const bareName = String(cert.doctor_name || '').replace(/^\s*dr\.?\s*/i, '').trim();
  let doctor = null;
  if (bareName) {
    const rows = await soft(
      `SELECT u.id AS user_id, d.signature_image, d.qualification, d.license_number, d.medical_council
         FROM doctors d JOIN users u ON u.id = d.user_id
        WHERE LOWER(TRIM(u.name)) IN (LOWER(?), LOWER(?))
        ORDER BY (d.clinic_id <=> ?) DESC, d.id ASC LIMIT 1`,
      [bareName, `Dr. ${bareName}`, cert.clinic_id ?? null],
    );
    doctor = rows[0] || null;
  }
  if (!doctor && cert.created_by) {
    const rows = await soft(
      `SELECT u.id AS user_id, d.signature_image, d.qualification, d.license_number, d.medical_council
         FROM users u LEFT JOIN doctors d ON d.user_id = u.id
        WHERE u.id = ? LIMIT 1`,
      [cert.created_by],
    );
    doctor = rows[0] || null;
  }

  const base = {
    doctor_user_id: doctor?.user_id ?? null,
    signature_image: toImgSrc(doctor?.signature_image),
    doctor_license_number: doctor?.license_number || null,
    doctor_medical_council: doctor?.medical_council || null,
  };
  const none = { header_image: null, header_content: null, footer_image: null, footer_content: null, template_name: null };

  if (cert.header_image || cert.footer_image) {
    return { ...base, ...none, source: 'certificate',
      header_image: toImgSrc(cert.header_image), footer_image: toImgSrc(cert.footer_image) };
  }

  if (doctor?.user_id) {
    const pad = await soft('SELECT header_image, footer_image FROM pad_configurations WHERE doctor_id = ? LIMIT 1', [doctor.user_id]);
    if (pad[0] && (pad[0].header_image || pad[0].footer_image)) {
      return { ...base, ...none, source: 'pad',
        header_image: toImgSrc(pad[0].header_image), footer_image: toImgSrc(pad[0].footer_image) };
    }
  }

  const tpl = await soft(
    `SELECT template_name, header_image, header_content, footer_image, footer_content FROM receipt_templates
      WHERE is_default = 1 AND (clinic_id = ? OR clinic_id IS NULL)
      ORDER BY (clinic_id IS NULL) ASC, created_at DESC, id DESC LIMIT 1`,
    [cert.clinic_id ?? null],
  );
  if (tpl[0] && (tpl[0].header_image || tpl[0].header_content || tpl[0].footer_image || tpl[0].footer_content)) {
    return { ...base, source: 'default_template', template_name: tpl[0].template_name,
      header_image: toImgSrc(tpl[0].header_image), header_content: tpl[0].header_content || null,
      footer_image: toImgSrc(tpl[0].footer_image), footer_content: tpl[0].footer_content || null };
  }

  return { ...base, ...none, source: 'clinic' };
}

async function generateBillingPDF({ billId, withLetterhead = false, templateId = null }) {
  const db = getDb();

  const [bills] = await db.execute(`
      SELECT b.*,
        pa.name as patient_name, pa.patient_id as patient_uhid,
        pa.phone as patient_phone, pa.email as patient_email,
        pa.gender as patient_gender, pa.age_years as patient_age,
        u.name as doctor_name, d.specialization as doctor_specialization, d.user_id as doctor_user_id,
        c.name as clinic_name, c.address as clinic_address,
        c.city as clinic_city, c.phone as clinic_phone
      FROM bills b
      LEFT JOIN patients pa ON b.patient_id = pa.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON b.clinic_id = c.id
      WHERE b.id = ?
    `, [billId]);

  if (bills.length === 0) {
    throw ApiError.notFound('Bill');
  }
  const bill = bills[0];

  const [items] = await db.execute(
    'SELECT service_name, quantity, unit_price, discount_amount, total_price FROM bill_items WHERE bill_id = ? ORDER BY sort_order, id',
    [billId],
  );

  const letterhead = withLetterhead ? await resolveBillLetterhead(db, bill, templateId) : null;

  // Same stationery as the prescription: reuse the doctor's Clinical > Rx
  // Template print layout so "without letterhead" clears the pre-printed
  // header on their paper exactly like the Rx does.
  let printLayout = null;
  try {
    if (bill.doctor_user_id) {
      const [layoutRows] = await db.execute(
        `SELECT content FROM rx_template_config
          WHERE doctor_id = ? AND template_type = 'print_layout' AND is_active = 1
          ORDER BY is_default DESC, id DESC LIMIT 1`,
        [bill.doctor_user_id],
      );
      if (layoutRows.length > 0 && layoutRows[0].content) {
        const parsed = typeof layoutRows[0].content === 'string' ? JSON.parse(layoutRows[0].content) : layoutRows[0].content;
        if (parsed && typeof parsed === 'object') printLayout = parsed;
      }
    }
  } catch { /* layout is optional */ }

  const layoutMm = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n <= 200 ? n : fallback;
  };
  const padLeftMm = layoutMm(printLayout?.left, 12);
  const padRightMm = layoutMm(printLayout?.right, 12);
  // The blank bands (Rx layout top/contentTop, bottom/contentBottom) exist to
  // clear the header/footer PRE-PRINTED on the clinic's stationery — so they
  // apply to plain paper only. With a letterhead we draw that header/footer
  // ourselves; reserving the band as well pushed a one-page receipt onto a
  // second sheet.
  const topBandMm = withLetterhead
    ? 10
    : (printLayout ? layoutMm(printLayout.top, 10) + layoutMm(printLayout.contentTop, 0) : BLANK_LETTERHEAD_MM);
  const bottomBandMm = withLetterhead
    ? 0
    : (printLayout ? layoutMm(printLayout.bottom, 10) + layoutMm(printLayout.contentBottom, 0) : 0);

  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const money = (v) => `&#8377;${(parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const displayItems = items.length > 0
    ? items
    : [{ service_name: 'Consultation', quantity: 1, unit_price: bill.total_amount, discount_amount: 0, total_price: bill.total_amount }];

  const totalAmt = parseFloat(bill.total_amount) || 0;
  const itemsSum = displayItems.reduce((s, it) => s + (parseFloat(it.total_price) || 0), 0);
  const subtotal = parseFloat(bill.subtotal) || itemsSum || totalAmt;
  const discountAmt = parseFloat(bill.discount_amount) || 0;
  const taxAmt = parseFloat(bill.tax_amount) || 0;
  const paidAmt = parseFloat(bill.amount_paid) || 0;
  const balanceAmt = bill.balance_due != null ? (parseFloat(bill.balance_due) || 0) : Math.max(0, totalAmt - paidAmt);
  const status = String(bill.payment_status || 'pending').toLowerCase();
  const statusLabel = { paid: 'PAID', completed: 'PAID', partial: 'PARTIALLY PAID', pending: 'PENDING', cancelled: 'CANCELLED', refunded: 'REFUNDED' }[status] || status.toUpperCase();
  const statusColor = ['paid', 'completed'].includes(status) ? '#15803d' : status === 'partial' ? '#1d4ed8' : ['cancelled', 'refunded'].includes(status) ? '#b91c1c' : '#c2410c';

  const receiptNo = `REC${String(bill.id).padStart(4, '0')}`;
  const billDate = new Date(bill.bill_date || bill.created_at || Date.now())
    .toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });
  const ageGender = [bill.patient_age ? `${bill.patient_age} Yrs` : '', bill.patient_gender || ''].filter(Boolean).join(' / ');
  const paymentMethod = String(bill.payment_method || 'cash').replace('+', ' + ').toUpperCase();

  // ── Header / footer ────────────────────────────────────────────────────────
  let headerHTML = '';
  let footerImgHTML = '';
  let footerContentHTML = '';
  if (withLetterhead && letterhead) {
    if (letterhead.header_image) {
      headerHTML += `<div class="lh-img"><img src="${letterhead.header_image}"/></div>`;
    }
    if (letterhead.header_content) {
      headerHTML += `<div class="lh-content">${safeTemplateHtml(letterhead.header_content)}</div>`;
    }
    if (!letterhead.header_image && !letterhead.header_content) {
      const addr = [bill.clinic_address, bill.clinic_city].filter(Boolean).join(', ');
      headerHTML = `<div class="clinic-text">
          <div class="clinic-name">${esc(bill.clinic_name || 'Clinic')}</div>
          ${addr || bill.clinic_phone ? `<div class="clinic-sub">${esc(addr)}${addr && bill.clinic_phone ? ' &nbsp;|&nbsp; ' : ''}${bill.clinic_phone ? 'Ph: ' + esc(bill.clinic_phone) : ''}</div>` : ''}
        </div>`;
    }
    headerHTML += '<div class="header-rule"></div>';
    if (letterhead.footer_content) {
      footerContentHTML = `<div class="footer-content">${safeTemplateHtml(letterhead.footer_content)}</div>`;
    }
    if (letterhead.footer_image) {
      // Rendered through Chrome's own per-page footer (see page.pdf below).
      footerImgHTML = letterhead.footer_image;
    }
  }

  const rowsHTML = displayItems.map((it, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(it.service_name || 'Service')}</td>
      <td class="c">${esc(String(parseFloat(it.quantity) || 1))}</td>
      <td class="r">${money(it.unit_price)}</td>
      <td class="r">${(parseFloat(it.discount_amount) || 0) > 0 ? money(it.discount_amount) : '&mdash;'}</td>
      <td class="r">${money(it.total_price)}</td>
    </tr>`).join('');

  const totalsHTML = [
    (subtotal !== totalAmt || discountAmt > 0 || taxAmt > 0) ? `<tr><td>Sub Total</td><td class="r">${money(subtotal)}</td></tr>` : '',
    discountAmt > 0 ? `<tr><td>Discount</td><td class="r">- ${money(discountAmt)}</td></tr>` : '',
    taxAmt > 0 ? `<tr><td>Tax</td><td class="r">${money(taxAmt)}</td></tr>` : '',
    `<tr class="net"><td>Net Amount</td><td class="r">${money(totalAmt)}</td></tr>`,
    paidAmt > 0 ? `<tr><td>Amount Paid</td><td class="r paid">${money(paidAmt)}</td></tr>` : '',
    balanceAmt > 0 && !['cancelled', 'refunded'].includes(status) ? `<tr><td>Balance Due</td><td class="r due">${money(balanceAmt)}</td></tr>` : '',
  ].join('');

  // Receipts saved before the template fix had the template's footer/header
  // text copied into Notes/Remarks — skip those so it doesn't print twice.
  const plain = (v) => String(v || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const templateTexts = new Set([plain(letterhead?.footer_content), plain(letterhead?.header_content)].filter(Boolean));
  const showNote = (v) => v && !templateTexts.has(plain(v));
  const remarksHTML = [
    showNote(bill.notes) ? `<div class="note"><strong>Notes:</strong> ${esc(bill.notes)}</div>` : '',
    showNote(bill.remarks) ? `<div class="note"><strong>Remarks:</strong> ${esc(bill.remarks)}</div>` : '',
  ].join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,'Helvetica Neue','Noto Sans','DejaVu Sans',sans-serif;font-size:9.5pt;color:#111;padding:10mm ${padRightMm}mm 10mm ${padLeftMm}mm}
  .lh-img{margin:-10mm -${padRightMm}mm 2mm -${padLeftMm}mm}
  .lh-img img{width:100%;display:block}
  .lh-content{font-size:9pt;color:#374151;margin-bottom:2mm}
  .clinic-text{text-align:center;margin-bottom:2mm}
  .clinic-name{font-size:15pt;font-weight:700;color:#003366}
  .clinic-sub{font-size:8.5pt;color:#555;margin-top:1mm}
  .header-rule{border-top:1.5px solid #003366;margin:1mm 0 4mm}
  .title-row{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:3mm}
  .title{font-size:14pt;font-weight:700;letter-spacing:1.5pt;color:#003366}
  .meta{text-align:right;font-size:9pt;line-height:1.5}
  .meta b{color:#003366}
  .party{display:flex;justify-content:space-between;gap:6mm;padding:3mm 4mm;background:#f0f4ff;border-radius:2mm;margin-bottom:4mm}
  .party .lbl{font-size:7.5pt;color:#64748b;text-transform:uppercase;letter-spacing:.5pt}
  .party .name{font-size:10.5pt;font-weight:700;text-transform:uppercase}
  .party .sub{font-size:8.5pt;color:#475569;margin-top:.5mm}
  table.items{width:100%;border-collapse:collapse;margin-bottom:4mm}
  table.items th{background:#003366;color:#fff;font-size:8.5pt;padding:2.2mm 2.5mm;text-align:left}
  table.items td{font-size:9pt;padding:2.2mm 2.5mm;border-bottom:1px solid #e2e8f0}
  table.items tr:nth-child(even) td{background:#f8fafc}
  .c{text-align:center!important}.r{text-align:right!important}
  .bottom{display:flex;justify-content:space-between;align-items:flex-start;gap:8mm}
  .pay{font-size:9pt;line-height:1.8}
  .badge{display:inline-block;padding:.6mm 2.5mm;border-radius:10mm;font-size:8pt;font-weight:700;color:#fff;background:${statusColor}}
  table.totals{min-width:70mm;border-collapse:collapse}
  table.totals td{padding:1.2mm 0;font-size:9.5pt}
  table.totals td.r{padding-left:10mm}
  table.totals tr.net td{border-top:1.5px solid #111;font-size:12pt;font-weight:700;padding-top:2mm}
  .paid{color:#15803d}.due{color:#b91c1c;font-weight:700}
  .note{font-size:8.5pt;color:#374151;margin-top:3mm}
  .footer-content{margin-top:6mm;padding-top:3mm;border-top:1px solid #e2e8f0;text-align:center;font-size:9pt;color:#475569}
  .thanks{margin-top:6mm;text-align:center;font-size:8pt;color:#94a3b8}
</style></head><body>
${headerHTML}
<div class="title-row">
  <div class="title">RECEIPT</div>
  <div class="meta"><div><b>Receipt #:</b> ${esc(receiptNo)}</div><div><b>Date:</b> ${esc(billDate)}</div></div>
</div>
<div class="party">
  <div>
    <div class="lbl">Bill To</div>
    <div class="name">${esc(bill.patient_name || 'N/A')}</div>
    <div class="sub">${[bill.patient_uhid ? 'UHID: ' + esc(bill.patient_uhid) : '', esc(ageGender), bill.patient_phone ? 'Ph: ' + esc(bill.patient_phone) : ''].filter(Boolean).join(' &nbsp;|&nbsp; ')}</div>
  </div>
  ${bill.doctor_name ? `<div style="text-align:right">
    <div class="lbl">Consultant</div>
    <div class="name" style="text-transform:none">Dr. ${esc(bill.doctor_name)}</div>
    ${bill.doctor_specialization ? `<div class="sub">${esc(bill.doctor_specialization)}</div>` : ''}
  </div>` : ''}
</div>
<table class="items">
  <thead><tr><th class="c" style="width:7%">#</th><th>Service</th><th class="c" style="width:8%">Qty</th><th class="r" style="width:16%">Rate</th><th class="r" style="width:13%">Disc.</th><th class="r" style="width:17%">Amount</th></tr></thead>
  <tbody>${rowsHTML}</tbody>
</table>
<div class="bottom">
  <div class="pay">
    <div><strong>Payment Mode:</strong> ${esc(paymentMethod)}</div>
    ${bill.payment_reference ? `<div><strong>Ref:</strong> ${esc(bill.payment_reference)}</div>` : ''}
    <div><strong>Status:</strong> <span class="badge">${esc(statusLabel)}</span></div>
  </div>
  <table class="totals">${totalsHTML}</table>
</div>
${remarksHTML}
${footerContentHTML || (withLetterhead ? '<div class="thanks">This is a computer generated receipt.</div>' : '')}
</body></html>`;

  let browser;
  try {
    const launchOpts = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    };
    try { launchOpts.executablePath = puppeteer.executablePath(); } catch { /* use default */ }
    browser = await puppeteer.launch(launchOpts);
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 }); // A4 @ 96dpi, so measuring matches print
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const hasFooterImg = Boolean(footerImgHTML);
    // Footer image height on an A4-wide page, capped so a tall image can't eat
    // the whole sheet. Unknown formats fall back to a typical banner height.
    const footerSize = hasFooterImg ? imageSizeFromDataUrl(footerImgHTML) : null;
    const footerMm = hasFooterImg
      ? Math.min(40, footerSize && footerSize.w > 0 ? (210 * footerSize.h) / footerSize.w : 25)
      : 0;
    const marginTopMm = Math.max(0, topBandMm - 10);
    const marginBottomMm = Math.max(hasFooterImg ? footerMm : 10, bottomBandMm);
    const scale = await fitToOnePageScale(page, { marginTopMm, marginBottomMm });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      scale,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: hasFooterImg
        ? `<div style="width:100%;margin:0;padding:0;-webkit-print-color-adjust:exact"><img src="${footerImgHTML}" style="width:100%;height:${footerMm.toFixed(2)}mm;display:block;object-fit:fill"/></div>`
        : '<div style="width:100%;font-size:7pt;color:#999;text-align:center;font-family:Arial,sans-serif;padding:0 10mm">Generated by Dr Jaju Care &nbsp;&bull;&nbsp; Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: {
        // Plain paper: keep the pre-printed header band clear (body padding
        // supplies 10mm of it).
        top: `${marginTopMm.toFixed(2)}mm`,
        right: '0',
        bottom: `${marginBottomMm.toFixed(2)}mm`,
        left: '0',
      },
    });
    return {
      buffer: Buffer.from(pdfBuffer),
      filename: `receipt_${receiptNo}.pdf`,
      contentType: 'application/pdf',
    };
  } catch (err) {
    console.warn('Receipt HTML render failed, falling back to basic PDF:', err.message);
    return generateBillingPDFLegacy({ billId, withLetterhead });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// Previous jsPDF renderer — kept only as a fallback if headless Chrome is
// unavailable, so a receipt can always be produced.
async function generateBillingPDFLegacy({ billId, withLetterhead = false }) {
  const db = getDb();

  const [bills] = await db.execute(`
      SELECT b.*,
        pa.name as patient_name, pa.patient_id as patient_uhid,
        pa.phone as patient_phone, pa.email as patient_email,
        pa.gender as patient_gender, pa.age_years as patient_age,
        u.name as doctor_name, d.specialization as doctor_specialization,
        c.name as clinic_name, c.address as clinic_address,
        c.city as clinic_city, c.phone as clinic_phone
      FROM bills b
      LEFT JOIN patients pa ON b.patient_id = pa.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON b.clinic_id = c.id
      WHERE b.id = ?
    `, [billId]);

  if (bills.length === 0) {
    throw ApiError.notFound('Bill');
  }

  const bill = bills[0];

  const [items] = await db.execute(
    'SELECT service_name, quantity, unit_price, discount_amount, total_price FROM bill_items WHERE bill_id = ? ORDER BY sort_order, id',
    [billId],
  );

  const displayItems = items.length > 0
    ? items
    : [
        {
          service_name: 'Consultation',
          quantity: 1,
          unit_price: parseFloat(bill.total_amount) || 0,
          discount_amount: 0,
          total_price: parseFloat(bill.total_amount) || 0,
        },
      ];

  const doc = new jsPDF('p', 'mm', 'A4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15;

  if (withLetterhead) {
    doc.setFontSize(18);
    doc.setTextColor(0, 51, 102);
    doc.setFont(undefined, 'bold');
    doc.text(bill.clinic_name || 'Hospital', pageWidth / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.setFont(undefined, 'normal');
    const clinicAddr = [bill.clinic_address, bill.clinic_city].filter(Boolean).join(', ');
    if (clinicAddr) {
      doc.text(clinicAddr, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
    if (bill.clinic_phone) {
      doc.text('Phone: ' + bill.clinic_phone, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.5);
    doc.line(15, y, pageWidth - 15, y);
  }

  y += 10;
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'bold');
  doc.text('INVOICE / BILL', pageWidth / 2, y, { align: 'center' });

  y += 10;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('Bill #: ' + (bill.bill_number || bill.id), 15, y);
  doc.text(
    'Date: ' + (bill.bill_date ? new Date(bill.bill_date).toLocaleDateString('en-IN') : 'N/A'),
    pageWidth - 15,
    y,
    { align: 'right' },
  );

  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(15, y, pageWidth - 15, y);
  y += 7;
  doc.setFont(undefined, 'bold');
  doc.text('Bill To:', 15, y);
  y += 6;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(bill.patient_name || 'N/A', 15, y);
  if (bill.patient_uhid) doc.text('UHID: ' + bill.patient_uhid, 110, y);
  y += 5;
  const ageGender = [bill.patient_age ? bill.patient_age + ' yrs' : '', bill.patient_gender || '']
    .filter(Boolean)
    .join(' / ');
  if (ageGender) doc.text(ageGender, 15, y);
  if (bill.patient_phone) doc.text('Phone: ' + bill.patient_phone, 110, y);
  y += 5;
  if (bill.patient_email) doc.text('Email: ' + bill.patient_email, 15, y);
  if (bill.doctor_name) {
    y += 5;
    doc.text(
      'Doctor: Dr. ' + bill.doctor_name + (bill.doctor_specialization ? ' (' + bill.doctor_specialization + ')' : ''),
      15,
      y,
    );
  }

  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, pageWidth - 15, y);
  y += 3;

  const tableHeaders = ['#', 'Service', 'Qty', 'Rate (Rs.)', 'Disc.', 'Amount (Rs.)'];
  const tableData = displayItems.map((item, idx) => [
    String(idx + 1),
    item.service_name || 'Service',
    String(parseFloat(item.quantity) || 1),
    (parseFloat(item.unit_price) || 0).toFixed(2),
    (parseFloat(item.discount_amount) || 0).toFixed(2),
    (parseFloat(item.total_price) || 0).toFixed(2),
  ]);

  if (typeof doc.autoTable === 'function') {
    doc.autoTable({
      head: [tableHeaders],
      body: tableData,
      startY: y,
      margin: { left: 15, right: 15 },
      theme: 'striped',
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 3 },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 65 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    tableData.forEach((row) => {
      doc.text(row[0] + '. ' + row[1] + '  x' + row[2] + '  Rs.' + row[3] + '  = Rs.' + row[5], 15, y);
      y += 6;
    });
  }

  const totalAmt = parseFloat(bill.total_amount) || 0;
  const subtotal = parseFloat(bill.subtotal) || totalAmt;
  const discountAmt = parseFloat(bill.discount_amount) || 0;
  const taxAmt = parseFloat(bill.tax_amount) || 0;
  const rightCol = pageWidth - 15;
  const labelX = pageWidth - 75;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);

  if (subtotal !== totalAmt || discountAmt > 0 || taxAmt > 0) {
    doc.text('Sub Total:', labelX, y);
    doc.text('Rs.' + subtotal.toFixed(2), rightCol, y, { align: 'right' });
    y += 6;
  }
  if (discountAmt > 0) {
    doc.text('Discount:', labelX, y);
    doc.text('-Rs.' + discountAmt.toFixed(2), rightCol, y, { align: 'right' });
    y += 6;
  }
  if (taxAmt > 0) {
    doc.text('Tax:', labelX, y);
    doc.text('Rs.' + taxAmt.toFixed(2), rightCol, y, { align: 'right' });
    y += 6;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(labelX, y - 2, rightCol, y - 2);
  y += 3;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(12);
  doc.text('Net Amount:', labelX, y);
  doc.text('Rs.' + totalAmt.toFixed(2), rightCol, y, { align: 'right' });

  y += 10;
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Payment: ' + (bill.payment_method || 'cash').replace('+', ' + ').toUpperCase(), 15, y);
  const paymentStatus = bill.payment_status || 'pending';
  doc.setTextColor(paymentStatus === 'paid' ? 0 : 220, paymentStatus === 'paid' ? 128 : 50, paymentStatus === 'paid' ? 0 : 50);
  doc.setFont(undefined, 'bold');
  doc.text('Status: ' + paymentStatus.toUpperCase(), rightCol, y, { align: 'right' });

  if (bill.notes) {
    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.text('Notes:', 15, y);
    y += 5;
    doc.setFont(undefined, 'normal');
    const splitNotes = doc.splitTextToSize(bill.notes, pageWidth - 30);
    doc.text(splitNotes, 15, y);
  }

  if (withLetterhead) {
    doc.setFont(undefined, 'italic');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('This is a computer-generated invoice.', pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  const pdfData = doc.output('arraybuffer');

  return {
    buffer: Buffer.from(pdfData),
    filename: `invoice_${billId}.pdf`,
    contentType: 'application/pdf',
  };
}

async function generateCertificatePDF({ certificateId }) {
  const db = getDb();

  const [certificates] = await db.execute(`
      SELECT
        c.id,
        c.patient_id,
        c.certificate_type,
        c.issue_date,
        c.valid_from,
        c.valid_to,
        c.content,
        c.remarks,
        pa.name as patient_name,
        pa.phone as patient_phone,
        u.name as doctor_name,
        d.specialization,
        cl.name as clinic_name,
        cl.address as clinic_address
      FROM medical_certificates c
      JOIN patients pa ON c.patient_id = pa.id
      JOIN doctors d ON c.doctor_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      JOIN clinics cl ON c.clinic_id = cl.id
      WHERE c.id = ?
    `, [certificateId]);

  if (certificates.length === 0) {
    throw ApiError.notFound('Certificate');
  }

  const certificate = certificates[0];

  const doc = new jsPDF('p', 'mm', 'A4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 30;

  doc.setFontSize(14);
  doc.setTextColor(0, 51, 102);
  doc.text(certificate.clinic_name, pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(certificate.clinic_address, pageWidth / 2, 22, { align: 'center' });

  yPosition += 10;
  doc.setFontSize(16);
  doc.setTextColor(0, 51, 102);
  doc.setFont(undefined, 'bold');
  doc.text('MEDICAL CERTIFICATE', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 12;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Type: ${certificate.certificate_type}`, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 16;
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  const splitContent = doc.splitTextToSize(certificate.content, pageWidth - 40);
  doc.text(splitContent, 20, yPosition);

  yPosition = yPosition + splitContent.length * 5 + 12;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Patient Details:', 20, yPosition);

  yPosition += 7;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(`Name: ${certificate.patient_name}`, 25, yPosition);
  doc.text(`Phone: ${certificate.patient_phone}`, 25, yPosition + 6);

  yPosition = pageHeight - 50;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.text('Authorized By:', 20, yPosition);

  yPosition += 8;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(`Dr. ${certificate.doctor_name}`, 20, yPosition);
  doc.text(`(${certificate.specialization})`, 20, yPosition + 5);

  yPosition += 15;
  doc.line(20, yPosition, 60, yPosition);
  doc.setFontSize(8);
  doc.text('Signature', 20, yPosition + 3);

  doc.text(`Date: ${new Date(certificate.issue_date).toLocaleDateString()}`, pageWidth - 60, yPosition);

  yPosition = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Valid from: ${new Date(certificate.valid_from).toLocaleDateString()} to ${new Date(certificate.valid_to).toLocaleDateString()}`,
    20,
    yPosition,
  );

  const pdfData = doc.output('arraybuffer');

  return {
    buffer: Buffer.from(pdfData),
    filename: `certificate_${certificateId}.pdf`,
    contentType: 'application/pdf',
  };
}

async function generateReferralPDF({ referralId }) {
  const db = getDb();

  const [referrals] = await db.execute(`
      SELECT 
        r.id,
        r.patient_id,
        r.referred_by_doctor,
        r.referred_to_doctor,
        r.referral_date,
        r.reason,
        r.notes,
        r.urgency_level,
        pa.name as patient_name,
        pa.phone as patient_phone,
        pa.age,
        pa.gender,
        CONCAT(u1.first_name, ' ', u1.last_name) as from_doctor,
        CONCAT(u2.first_name, ' ', u2.last_name) as to_doctor,
        c1.name as from_clinic,
        c2.name as to_clinic
      FROM patient_referrals r
      JOIN patients pa ON r.patient_id = pa.id
      JOIN doctors d1 ON r.referred_by_doctor = d1.id
      LEFT JOIN users u1 ON d1.user_id = u1.id
      LEFT JOIN doctors d2 ON r.referred_to_doctor = d2.id
      LEFT JOIN users u2 ON d2.user_id = u2.id
      JOIN clinics c1 ON d1.clinic_id = c1.id
      LEFT JOIN clinics c2 ON d2.clinic_id = c2.id
      WHERE r.id = ?
    `, [referralId]);

  if (referrals.length === 0) {
    throw ApiError.notFound('Referral');
  }

  const referral = referrals[0];

  const doc = new jsPDF('p', 'mm', 'A4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  doc.setFontSize(14);
  doc.setTextColor(0, 51, 102);
  doc.text(referral.from_clinic, pageWidth / 2, yPosition, { align: 'center' });
  doc.setFont(undefined, 'bold');

  yPosition += 15;
  doc.setFontSize(14);
  doc.text('REFERRAL LETTER', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 12;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Date: ${new Date(referral.referral_date).toLocaleDateString()}`, 15, yPosition);

  const urgencyColor = referral.urgency_level === 'emergency'
    ? [255, 0, 0]
    : referral.urgency_level === 'urgent'
        ? [255, 165, 0]
        : [0, 128, 0];
  doc.setTextColor(...urgencyColor);
  doc.setFont(undefined, 'bold');
  doc.text(`Urgency: ${referral.urgency_level.toUpperCase()}`, pageWidth - 60, yPosition);

  yPosition += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'bold');
  doc.text('Patient Information:', 15, yPosition);

  yPosition += 6;
  doc.setFont(undefined, 'normal');
  doc.text(`Name: ${referral.patient_name}`, 20, yPosition);
  doc.text(`Age: ${referral.age} years | Gender: ${referral.gender}`, 20, yPosition + 6);
  doc.text(`Phone: ${referral.patient_phone}`, 20, yPosition + 12);

  yPosition += 22;
  doc.setFont(undefined, 'bold');
  doc.text('Referred From:', 15, yPosition);
  yPosition += 5;
  doc.setFont(undefined, 'normal');
  doc.text(`Dr. ${referral.from_doctor}`, 20, yPosition);

  yPosition += 10;
  doc.setFont(undefined, 'bold');
  doc.text('Referred To:', 15, yPosition);
  yPosition += 5;
  doc.setFont(undefined, 'normal');
  if (referral.to_doctor) {
    doc.text(`Dr. ${referral.to_doctor}`, 20, yPosition);
    doc.text(`${referral.to_clinic}`, 20, yPosition + 6);
  } else {
    doc.text('To be determined by patient', 20, yPosition);
  }

  yPosition += 16;
  doc.setFont(undefined, 'bold');
  doc.text('Reason for Referral:', 15, yPosition);

  yPosition += 6;
  doc.setFont(undefined, 'normal');
  const splitReason = doc.splitTextToSize(referral.reason, pageWidth - 30);
  doc.text(splitReason, 20, yPosition);

  if (referral.notes) {
    yPosition += splitReason.length * 5 + 6;
    doc.setFont(undefined, 'bold');
    doc.text('Additional Notes:', 15, yPosition);

    yPosition += 6;
    doc.setFont(undefined, 'normal');
    const splitNotes = doc.splitTextToSize(referral.notes, pageWidth - 30);
    doc.text(splitNotes, 20, yPosition);
  }

  yPosition = 240;
  doc.setFont(undefined, 'normal');
  doc.line(15, yPosition, 70, yPosition);
  doc.setFontSize(9);
  doc.text('Dr. Signature', 20, yPosition + 5);

  const pdfData = doc.output('arraybuffer');

  return {
    buffer: Buffer.from(pdfData),
    filename: `referral_${referralId}.pdf`,
    contentType: 'application/pdf',
  };
}

async function generateLabReportPDF({ patientId, report_group = null }) {
  const db = getDb();

  const [patients] = await db.execute(`
      SELECT
        p.id, p.name as patient_name, p.phone as patient_phone,
        p.email as patient_email, p.age_years, p.gender, p.patient_id as uhid,
        c.name as clinic_name, c.address as clinic_address, c.phone as clinic_phone,
        u.name as doctor_name, d.specialization, d.user_id as doctor_user_id
      FROM patients p
      LEFT JOIN doctors d ON d.clinic_id = p.clinic_id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN clinics c ON p.clinic_id = c.id
      WHERE p.id = ?
      LIMIT 1
    `, [patientId]);

  if (patients.length === 0) {
    throw ApiError.notFound('Patient');
  }

  const patientData = patients[0];

  let padConfig = null;
  if (patientData.doctor_user_id) {
    const [configs] = await db.execute(
      'SELECT header_image, footer_image FROM pad_configurations WHERE doctor_id = ? LIMIT 1',
      [patientData.doctor_user_id],
    );
    if (configs.length > 0) padConfig = configs[0];
  }

  if (!padConfig || (!padConfig.header_image && !padConfig.footer_image)) {
    const [templates] = await db.execute(
      'SELECT header_image, footer_image FROM receipt_templates WHERE is_default = 1 LIMIT 1',
    );
    if (templates.length > 0 && (templates[0].header_image || templates[0].footer_image)) {
      padConfig = templates[0];
    }
  }

  let labQuery = `
      SELECT test_name as name, result_value as reading, result_unit as unit,
             result_date as date, report_group, reference_range, test_category
      FROM lab_investigations
      WHERE patient_id = ? AND status = 'completed'
    `;
  const labParams = [patientId];

  if (report_group) {
    labQuery += ' AND report_group = ?';
    labParams.push(report_group);
  }

  labQuery += ' ORDER BY result_date DESC, report_group, id';

  const [labs] = await db.execute(labQuery, labParams);

  if (labs.length === 0) {
    throw ApiError.notFound('Lab results');
  }

  const grouped = {};
  const ungrouped = [];
  labs.forEach((l) => {
    if (l.report_group) {
      if (!grouped[l.report_group]) {
        grouped[l.report_group] = {
          category: l.test_category || l.report_group.split('-')[0],
          date: l.date,
          items: [],
        };
      }
      grouped[l.report_group].items.push(l);
    } else {
      ungrouped.push(l);
    }
  });

  const doc = new jsPDF('p', 'mm', 'A4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 10;

  if (padConfig && padConfig.header_image) {
    try {
      const imgData = padConfig.header_image;
      const imgFormat = imgData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(imgData, imgFormat, 5, 5, pageWidth - 10, 35);
      yPosition = 45;
    } catch (imgErr) {
      console.warn('Header image error, falling back to text:', imgErr.message);
      yPosition = 20;
      doc.setFontSize(16);
      doc.setTextColor(0, 51, 102);
      doc.text(patientData.clinic_name || 'Clinic', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${patientData.clinic_address || ''}`, pageWidth / 2, yPosition, { align: 'center' });
      doc.text(`Phone: ${patientData.clinic_phone || 'N/A'}`, pageWidth / 2, yPosition + 5, { align: 'center' });
      yPosition += 15;
    }
  } else {
    yPosition = 20;
    doc.setFontSize(16);
    doc.setTextColor(0, 51, 102);
    doc.text(patientData.clinic_name || 'Clinic', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`${patientData.clinic_address || ''}`, pageWidth / 2, yPosition, { align: 'center' });
    doc.text(`Phone: ${patientData.clinic_phone || 'N/A'}`, pageWidth / 2, yPosition + 5, { align: 'center' });
    yPosition += 15;
  }

  doc.setDrawColor(0, 51, 102);
  doc.line(15, yPosition, pageWidth - 15, yPosition);

  yPosition += 10;
  doc.setFontSize(14);
  doc.setTextColor(0, 51, 102);
  doc.setFont(undefined, 'bold');
  doc.text('LABORATORY REPORT', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 12;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.text(`Patient: ${patientData.patient_name || 'N/A'}`, 15, yPosition);
  doc.text(
    `Date: ${labs[0].date ? new Date(labs[0].date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`,
    pageWidth - 60,
    yPosition,
  );

  yPosition += 6;
  const displayAge = patientData.age_years !== null && patientData.age_years !== undefined ? patientData.age_years : 'N/A';
  doc.text(`Age: ${displayAge} yrs | Gender: ${patientData.gender || 'N/A'}`, 15, yPosition);
  if (patientData.uhid) {
    doc.text(`UHID: ${patientData.uhid}`, pageWidth - 60, yPosition);
  }

  yPosition += 6;
  doc.text(`Phone: ${patientData.patient_phone || 'N/A'}`, 15, yPosition);

  yPosition += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPosition, pageWidth - 15, yPosition);

  const groupKeys = Object.keys(grouped);
  for (const gk of groupKeys) {
    const group = grouped[gk];

    yPosition += 10;
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(0, 51, 102);
    doc.setFont(undefined, 'bold');
    doc.text(group.category, 15, yPosition);

    yPosition += 2;

    const tableHeaders = ['Parameter', 'Result', 'Unit', 'Normal Range'];
    const tableData = group.items.map((item) => [
      item.name,
      item.reading || '-',
      item.unit || '-',
      item.reference_range || '-',
    ]);

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        head: [tableHeaders],
        body: tableData,
        startY: yPosition,
        margin: { left: 15, right: 15 },
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 35 }, 2: { cellWidth: 35 }, 3: { cellWidth: 40 } },
      });
      yPosition = doc.lastAutoTable.finalY + 5;
    } else {
      yPosition += 6;
      tableData.forEach((row) => {
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(`${row[0]}: ${row[1]} ${row[2]} (${row[3]})`, 20, yPosition);
        yPosition += 5;
      });
    }
  }

  if (ungrouped.length > 0) {
    yPosition += 10;
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(0, 51, 102);
    doc.setFont(undefined, 'bold');
    doc.text('Other Tests', 15, yPosition);

    yPosition += 2;

    const tableHeaders = ['Test Name', 'Result', 'Unit', 'Date'];
    const tableData = ungrouped.map((item) => [
      item.name,
      item.reading || '-',
      item.unit || '-',
      item.date ? new Date(item.date).toLocaleDateString('en-IN') : '-',
    ]);

    if (typeof doc.autoTable === 'function') {
      doc.autoTable({
        head: [tableHeaders],
        body: tableData,
        startY: yPosition,
        margin: { left: 15, right: 15 },
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      });
      yPosition = doc.lastAutoTable.finalY + 5;
    }
  }

  if (patientData.doctor_name) {
    yPosition += 10;
    if (yPosition > pageHeight - 30) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Doctor: Dr. ${patientData.doctor_name}`, 15, yPosition);
    if (patientData.specialization) {
      doc.text(`(${patientData.specialization})`, 15 + doc.getTextWidth(`Doctor: Dr. ${patientData.doctor_name}  `), yPosition);
    }
  }

  if (padConfig && padConfig.footer_image) {
    try {
      const imgData = padConfig.footer_image;
      const imgFormat = imgData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(imgData, imgFormat, 5, pageHeight - 30, pageWidth - 10, 25);
    } catch (imgErr) {
      console.warn('Footer image error, falling back to text:', imgErr.message);
      doc.setFont(undefined, 'italic');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Generated by Patient Management System', pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
  } else {
    doc.setFont(undefined, 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Patient Management System', pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  const pdfData = doc.output('arraybuffer');

  return {
    buffer: Buffer.from(pdfData),
    filename: `lab_report_${patientId}.pdf`,
    contentType: 'application/pdf',
  };
}

module.exports = {
  BLANK_LETTERHEAD_MM,
  generatePrescriptionPDF,
  generateBillingPDF,
  resolveBillLetterhead,
  resolvePrescriptionLetterhead,
  resolveCertificateLetterhead,
  loadPrintLayout,
  fitToOnePageScale,
  imageSizeFromDataUrl,
  safeTemplateHtml,
  generateCertificatePDF,
  generateReferralPDF,
  generateLabReportPDF,
};
