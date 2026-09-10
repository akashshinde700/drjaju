/**
 * Convert a 0-based doctor index to Excel-style column letters.
 * 0→A, 1→B, ... 25→Z, 26→AA, 27→AB, ... 51→AZ, 52→BA, etc.
 */
function indexToLetters(index) {
  let letters = '';
  let n = index;
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

/**
 * Generate a UHID prefix like DRA, DRB, ... DRZ, DRAA, DRAB, etc.
 * based on the doctor's position (0-indexed) in the doctors table.
 */
async function generateUHID(db, doctorId) {
  let letters = 'A';
  if (doctorId) {
    const [allDoctors] = await db.execute('SELECT id FROM doctors ORDER BY id ASC');
    const doctorIndex = allDoctors.findIndex(d => d.id === doctorId);
    if (doctorIndex >= 0) {
      letters = indexToLetters(doctorIndex);
    }
  }
  const prefix = 'DR' + letters;
  const [maxRows] = await db.execute(
    "SELECT patient_id FROM patients WHERE patient_id LIKE ? ORDER BY CAST(SUBSTRING(patient_id, ?) AS UNSIGNED) DESC LIMIT 1",
    [prefix + '%', prefix.length + 1]
  );
  let nextNum = 1;
  if (maxRows.length > 0) {
    const numPart = maxRows[0].patient_id.substring(prefix.length);
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }
  return prefix + nextNum;
}

module.exports = { indexToLetters, generateUHID };
