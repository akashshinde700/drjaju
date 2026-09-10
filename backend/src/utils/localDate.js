// `new Date().toISOString().split('T')[0]` is always UTC — it ignores the
// process TZ entirely. This server's OS/Node process runs in UTC (confirmed
// via `timedatectl` + PM2 env — no TZ=Asia/Kolkata is actually set, despite
// an earlier comment here claiming otherwise), so `getFullYear/getMonth/
// getDate()` are ALSO UTC-based, not IST. Every "today" computed either way
// was silently wrong for ~5.5 hours a night (12:00am-5:30am IST) — the same
// bug independently found and fixed on the frontend, but rooted here for the
// backend since 21 files derive "today" from this one function.
// Asia/Kolkata is named explicitly so this is correct regardless of the
// server process's own TZ setting, rather than depending on it being
// configured (and staying configured) correctly at the infra layer.
function getLocalDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return `${y}-${m}-${d}`;
}

module.exports = { getLocalDateString };
