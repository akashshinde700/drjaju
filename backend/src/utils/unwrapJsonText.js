// Several pickers across the app (diagnosis, reason-for-visit, symptom tags)
// store their selection as an array of {label} option objects. At least one
// save path JSON.stringifies that array instead of extracting the labels,
// and re-editing a record that already has stringified text compounds it —
// live data has been seen nested up to 4 levels deep. This recursively
// unwraps back down to plain, human-readable text.
function unwrapJsonText(value, depth = 0) {
  if (value == null || depth > 10) return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          return item.label || item.name || item.icd_title || item.title || item.type || unwrapJsonText(item, depth + 1);
        }
        return unwrapJsonText(item, depth + 1);
      })
      .filter(Boolean)
      .join(', ');
  }

  if (typeof value === 'object') {
    // .type covers the medication-timing picker shape ({type, time}); the
    // rest cover diagnosis/reason/symptom picker option objects.
    return value.label || value.name || value.icd_title || value.title || value.type || null;
  }

  if (typeof value !== 'string') return value;

  let trimmed = value.trim();

  // A string that has already been JSON.stringified several times shows up as
  // escape residue: leading backslashes, \" , \\ , bracket pairs. When a parse
  // fails partway down we used to hand that residue straight back — printing
  // things like  "\"\\\"[]\\\"\"  on the prescription. Peel the escaping off
  // and, if nothing human-readable is left, drop it.
  if (/^[\\"[\]{}\s,]*$/.test(trimmed)) return '';
  trimmed = trimmed.replace(/^[\\"\s]+/, '').replace(/[\\"\s]+$/, '');
  if (/^[\\"[\]{}\s,]*$/.test(trimmed)) return '';

  if (!trimmed || (trimmed[0] !== '[' && trimmed[0] !== '"' && trimmed[0] !== '{')) {
    // Might still be an escaped fragment like  \"Hypertension\"  — unescape once
    // more and see if a clean value falls out.
    if (trimmed.includes('\\"') || trimmed.includes('\\\\')) {
      const unescaped = trimmed.replace(/\\(["\\/])/g, '$1');
      if (unescaped !== trimmed) return unwrapJsonText(unescaped, depth + 1);
    }
    return trimmed;
  }

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    // Not valid JSON as-is; strip one escaping layer and retry once.
    const unescaped = trimmed.replace(/\\(["\\/])/g, '$1').replace(/\\n/g, ' ');
    if (unescaped !== trimmed) return unwrapJsonText(unescaped, depth + 1);
    return trimmed;
  }
  return unwrapJsonText(parsed, depth + 1);
}

module.exports = { unwrapJsonText };
