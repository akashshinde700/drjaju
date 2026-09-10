const { getDb } = require('../config/db');

exports.getLatest = async (req, res) => {
  try {
    const { patientId, appointmentId } = req.query;
    if (!patientId) return res.status(400).json({ success: false, error: 'patientId required' });
    const db = getDb();

    if (appointmentId) {
      const [rows] = await db.execute(
        `SELECT advice, follow_up_days, next_visit_date, special_instructions
         FROM visit_advice
         WHERE appointment_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [appointmentId]
      );
      if (rows.length) return res.json({ success: true, data: rows[0] });
    }

    const [rows2] = await db.execute(
      `SELECT advice, follow_up_days, next_visit_date, special_instructions
       FROM visit_advice
       WHERE patient_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [patientId]
    );
    res.json({ success: true, data: rows2[0] || null });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch advice' });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const { language = 'en', limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const db = getDb();

    let templates = [];
    try {
      // Try to fetch from advice_templates table with language filter
      const [rows] = await db.execute(
        `SELECT advice_text, category, priority
         FROM advice_templates
         WHERE language_code = ? OR language_code IS NULL
         ORDER BY priority ASC, advice_text ASC
         LIMIT ?`,
        [language, limitNum]
      );
      templates = rows.map(r => ({ text: r.advice_text, category: r.category, priority: r.priority }));
    } catch (e) {
      // Fallback: return hardcoded templates for common languages
      const fallbacks = {
        en: [
          'Plenty of liquids',
          'Steaming gargling',
          'Rest well',
          'Avoid spicy food',
          'Take medicines on time',
          'Follow up if symptoms persist'
        ],
        hi: [
          'खूब सारे तरल पदार्थ लें',
          'भाप और गरारे करें',
          'अच्छे से आराम करें',
          'मसालेदार भोजन से बचें',
          'समय पर दवाई लें',
          'लक्षण बने रहने पर फॉलो-अप करें'
        ],
        mr: [
          'भरपूर द्रव पदार्थ घ्या',
          'वाफ आणि गरारे करा',
          'चांगली विश्रांती घ्या',
          'मसालेदार अन्न टाळा',
          'वेळेवर औषध घ्या',
          'लक्षणे कायम राहिल्यास फॉलो-अप करा'
        ],
        bn: [
          'প্রচুর তরল গ্রহণ করুন',
          'বাষ্প এবং গড়গড় করুন',
          'ভালোভাবে বিশ্রাম নিন',
          'ঝালযুক্ত খাবার এড়িয়ে চলুন',
          'সময়মতো ওষুধ সেবন করুন',
          'উপসর্গ থাকলে ফলো-আপ করুন'
        ],
        gu: [
          'પૂરતી પ્રવાહી પદાર્થ લો',
          'વરાળ અને ગરારા કરો',
          'સારી રીતે આરામ કરો',
          'તીખું ખાવાનો ટાળો',
          'સમયે દવા લો',
          'લક્ષણો રહેલા હોય તો ફોલો-અપ કરો'
        ],
        ta: [
          'நிறைய திரவங்களை எடுக்கவும்',
          'நீராவிப்பு மற்றும் கரகரக்க செய்யவும்',
          'நன்கு ஓய்வெடுக்கவும்',
          'காரமான உணவைத் தவிர்க்கவும்',
          'சரியான நேரத்தில் மருந்துகளை எடுக்கவும்',
          'அறிகுறிகள் தொடர்ந்தால் பின்தொடர்வு செய்யவும்'
        ],
        te: [
          'సమృద్ధిగా ద్రవాలు తీసుకోండి',
          'ఆవిరం మరియు గారగారాలు చేయండి',
          'బాగా విశ్రాంతి తీసుకోండి',
          'మసాలా ఆహారాన్ని నివారించండి',
          'సమయానికి మందులు తీసుకోండి',
          'లక్షణాలు కొనసాగితే ఫాలో-అప్ చేయండి'
        ],
        kn: [
          'ಹೆಚ್ಚಿನ ದ್ರವಗಳನ್ನು ಸೇವಿಸಿ',
          'ಆವಿ ಮತ್ತು ಗರಗರನೆ ಮಾಡಿ',
          'ಚೆನ್ನಾಗಿ ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ',
          'ಖಾರದ ಆಹಾರವನ್ನು ತಡೆಹಿಡಿರಿ',
          'ಸಮಯಕ್ಕೆ ಔಷಧಿಗಳನ್ನು ಸೇವಿಸಿ',
          'ರೋಗಲಕ್ಷಣಗಳು ಮುಂದುವರಿದರೆ ಫಾಲೋ-ಅಪ್ ಮಾಡಿ'
        ],
        ml: [
          'ധാരാളം ദ്രാവകങ്ങൾ കഴിക്കുക',
          'ആവിയും ഗാർഗാറും ചെയ്യുക',
          'നന്നായി വിശ്രമിക്കുക',
          'മസാല ഭക്ഷണം ഒഴിവാക്കുക',
          'സമയത്ത് മരുന്നുകൾ കഴിക്കുക',
          'ലക്ഷണങ്ങൾ തുടരുന്നെങ്കിൽ ഫോളോ-അപ്പ് െയ്യുക'
        ],
        pa: [
          'ਬਹੁਤ ਸਾਰੇ ਤਰਲ ਪਦਾਰਥ ਲਓ',
          'ਭਾਫ ਅਤੇ ਗਰਾਰੇ ਕਰੋ',
          'ਚੰਗੀ ਤਰ੍ਹਾਂ ਆਰਾਮ ਕਰੋ',
          'ਮਸਾਲੇਦਾਰ ਖਾਣਾ ਤੋਂ ਬਚੋ',
          'ਸਮੇਂ ਤੇ ਦਵਾਈ ਲਓ',
          'ਲੱਛਣ ਰਹਿਤਾਂ ਫਾਲੋ-ਅਪ ਕਰੋ'
        ],
        ur: [
          'بہت سارے مائعات لیں',
          'بھاپ اور غرارے کریں',
          'اچھی طرح آرام کریں',
          'مصالحے دار کھانا سے بچیں',
          'وقت پر دوا لیں',
          'علامات رہنے پر فالو اپ کریں'
        ]
      };
      templates = (fallbacks[language] || fallbacks.en).slice(0, limitNum).map(text => ({ text, category: 'general', priority: 1 }));
    }

    res.json({ success: true, data: templates });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch advice templates' });
  }
};
