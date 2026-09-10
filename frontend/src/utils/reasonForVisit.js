// Some legacy appointments have reason_for_visit stored as JSON-stringified
// (possibly multiple times over) picker output, e.g. '[{"label":"URI"}]' or
// worse, '["[{\"label\":\"URI\"}]"]'. The backend now sanitizes new writes,
// but old rows and any write path we haven't caught still need a safe
// display fallback rather than showing raw escaped JSON to staff.
export function cleanReasonForVisit(value, depth = 0) {
  if (value == null || depth > 10) return '';
  if (typeof value !== 'string') {
    if (Array.isArray(value)) {
      return value
        .map((item) => (item && typeof item === 'object' && item.label ? String(item.label) : cleanReasonForVisit(item, depth + 1)))
        .filter(Boolean)
        .join(', ');
    }
    if (typeof value === 'object' && value.label) return String(value.label);
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed[0] !== '[' && trimmed[0] !== '"') return trimmed;

  try {
    return cleanReasonForVisit(JSON.parse(trimmed), depth + 1);
  } catch (e) {
    return trimmed;
  }
}
