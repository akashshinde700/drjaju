/**
 * Patient duplicate detection using fuzzy name + phone matching
 * Prevents duplicate patient records from public booking forms (QR/Landing)
 */

function levenshteinDistance(str1, str2) {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();

  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix = [];
  for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2[i - 1] === s1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = 1 + Math.min(matrix[i - 1][j - 1], matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }
  return matrix[s2.length][s1.length];
}

function normalizeNamePart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function splitFirstLast(fullName) {
  const normalized = normalizeNamePart(fullName);
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length === 0) return { first: '', last: '', full: '' };
  if (parts.length === 1) return { first: parts[0], last: '', full: parts[0] };
  return {
    first: parts[0],
    last: parts[parts.length - 1],
    full: normalized,
  };
}

function similarityPercent(a, b) {
  const s1 = normalizeNamePart(a);
  const s2 = normalizeNamePart(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 100;
  const maxLen = Math.max(s1.length, s2.length);
  if (!maxLen) return 0;
  const dist = levenshteinDistance(s1, s2);
  const score = (1 - dist / maxLen) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isSimilarName(name1, name2) {
  if (!name1 || !name2) return false;
  const s1 = name1.toLowerCase().trim();
  const s2 = name2.toLowerCase().trim();

  if (s1 === s2) return true;

  // Overall edit distance check
  const maxLen = Math.max(s1.length, s2.length);
  const threshold = maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3;
  if (levenshteinDistance(s1, s2) <= threshold) return true;

  // Word-by-word check: "Ramesh Kumar" vs "Rmesh Kumar" or "Ramesh Kuumar"
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  const isSimilarWord = (w1, w2) => {
    if (!w1 || !w2) return false;
    if (w1 === w2) return true;
    if (w1.length < 3 || w2.length < 3) return false;
    const wMaxLen = Math.max(w1.length, w2.length);
    const wThreshold = wMaxLen <= 5 ? 1 : 2;
    return levenshteinDistance(w1, w2) <= wThreshold;
  };

  // If both have multiple words (first+last, etc.), require the FIRST word to match too.
  // This prevents "Akash Shinde" vs "Prasad Shinde" from being treated as the same person.
  if (words1.length >= 2 && words2.length >= 2) {
    const firstSimilar = isSimilarWord(words1[0], words2[0]);
    if (!firstSimilar) return false;
  }

  let wordMatches = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (isSimilarWord(w1, w2)) {
        wordMatches++;
        break;
      }
    }
  }
  const minWords = Math.min(words1.length, words2.length);
  if (minWords > 0 && wordMatches >= Math.ceil(minWords / 2)) return true;

  return false;
}

function isSimilarFirstLastName(fullName1, fullName2, threshold = 80) {
  const a = splitFirstLast(fullName1);
  const b = splitFirstLast(fullName2);
  if (!a.first || !b.first) return false;

  const firstScore = similarityPercent(a.first, b.first);
  const lastScore = a.last || b.last ? similarityPercent(a.last, b.last) : 100;

  if (firstScore < threshold) return false;
  if (lastScore < threshold) return false;

  return true;
}

function isSimilarFullName(fullName1, fullName2, threshold = 80) {
  const score = similarityPercent(fullName1, fullName2);
  return score >= threshold;
}

/**
 * Find existing patient by phone + fuzzy name matching
 * Priority: phone+name > phone only > name only
 *
 * @param {object} db - MySQL2 database connection
 * @param {string} phone - Patient phone number
 * @param {string} name - Patient name (may have spelling variations)
 * @param {object} options - { clinicId?: number|string, threshold?: number }
 * @returns {object|null} { patient, matchType: 'phone_and_name'|'phone_only'|'name_only' } or null
 */
async function findExistingPatient(db, phone, name, options = {}) {
  const clinicId = options?.clinicId ?? null;
  const threshold = typeof options?.threshold === 'number' ? options.threshold : 80;

  const normalizedPhone = phone ? String(phone).replace(/\D/g, '') : '';
  const last10 = normalizedPhone.length >= 10 ? normalizedPhone.slice(-10) : normalizedPhone;

  // Step 1: Check by exact phone number
  if (normalizedPhone) {
    const [byPhone] = await db.execute(
      clinicId
        ? (
          'SELECT id, patient_id, name, phone, gender, age_years, clinic_id FROM patients ' +
          'WHERE clinic_id = ? AND (phone = ? OR phone LIKE ?) LIMIT 20'
        )
        : (
          'SELECT id, patient_id, name, phone, gender, age_years, clinic_id FROM patients ' +
          'WHERE (phone = ? OR phone LIKE ?) LIMIT 20'
        ),
      clinicId
        ? [clinicId, last10, `%${last10}`]
        : [last10, `%${last10}`]
    );

    if (byPhone.length > 0) {
      // If name provided, check for similar name (same person with spelling error)
      if (name) {
        for (const patient of byPhone) {
          if (isSimilarFirstLastName(patient.name, name, threshold) || isSimilarFullName(patient.name, name, threshold)) {
            return { patient, matchType: 'phone_and_name' };
          }
        }
      }
      // Phone matches but name is different - family member sharing same number
      // Still link to first match (original behavior) to avoid duplicates
      return { patient: byPhone[0], matchType: 'phone_only' };
    }
  }

  // Step 2: No phone match - try fuzzy name search
  // Only do name-only search if name is long enough to be meaningful
  if (name && name.trim().length >= 3) {
    const namePrefix = name.trim().substring(0, 3);
    const params = [];
    let query = 'SELECT id, patient_id, name, phone, gender, age_years, clinic_id FROM patients WHERE 1=1';
    if (clinicId) {
      query += ' AND clinic_id = ?';
      params.push(clinicId);
    }
    query += ' AND name LIKE ? LIMIT 50';
    params.push(`${namePrefix}%`);
    const [byName] = await db.execute(query, params);

    for (const patient of byName) {
      if (isSimilarFirstLastName(patient.name, name, threshold) || isSimilarFullName(patient.name, name, threshold)) {
        return { patient, matchType: 'name_only' };
      }
    }
  }

  return null;
}

module.exports = { levenshteinDistance, isSimilarName, findExistingPatient };
