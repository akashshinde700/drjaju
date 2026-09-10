// `new Date().toISOString().split('T')[0]` computes "today" in UTC. In IST
// (UTC+5:30) that's wrong for roughly 5.5 hours every night (~12:30am–5:30am
// IST) — e.g. at 3am on the 12th, UTC time is still ~9:30pm on the 11th, so
// every "today" date filter/default across the app silently pointed at
// yesterday. Use this instead wherever "today" means the clinic's local
// calendar day, not a UTC instant.
export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
