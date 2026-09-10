// Shared visit de-duplication rule — SINGLE SOURCE OF TRUTH.
//
// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS RULE (confirmed by clinic owner, 2026-07-18 — NOT a temporary fix):
//   One patient = ONE countable visit per calendar day per channel
//   (offline/online). Same-day repeat entries for a patient are, per the
//   clinic's actual workflow, virtually always double data entry (e.g.
//   reception created an appointment AND a separate walk-in queue row for
//   the same physical visit) — genuine twice-in-one-day visits are rare
//   enough that the clinic chose to count them as one.
//   NOTE: the booking API deliberately still ALLOWS two appointments for the
//   same patient on one day (different times); this rule only governs how
//   dashboards COUNT and LIST them. If the clinic's workflow ever changes
//   (e.g. same-day emergency revisits become common), revisit this rule —
//   here, in this file, nowhere else.
// ═══════════════════════════════════════════════════════════════════════════
//
// Used by the Queue dashboard (Queue.jsx: list + card counts) and the Doctor
// dashboard (DoctorDashboard.jsx) so their counts can never disagree. The
// backend mirrors the same (patient, channel) distinct rule in
// QueueService.getDashboardStats — keep them in sync if this changes.
// When duplicate rows exist, the "better" row wins: the one with the later
// check-in/appointment time, then the one with a bill, then the higher id.
//
// If you change this rule, change it HERE — do not fork a local copy in a page.

/** Calendar day (YYYY-MM-DD) for a visit row, from a Date or a date-ish string. */
export function normVisitDay(raw, fallbackDay) {
  if (raw == null || raw === '') return fallbackDay || '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const d = raw;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return String(raw).split('T')[0].split(' ')[0].slice(0, 10);
}

/** Sortable ms timestamp for a visit: check-in time if present, else appointment date+time. */
export function visitSortTimeMs(item, fallbackDay) {
  if (item.check_in_time) {
    const t = new Date(item.check_in_time).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  const d = normVisitDay(item.appointment_date, fallbackDay);
  const tm = (item.appointment_time || '00:00').substring(0, 5);
  const t = new Date(`${d}T${tm}:00`).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Of two rows representing the same visit, keep the more authoritative one. */
export function pickBetterVisitRow(a, b, fallbackDay) {
  const ta = visitSortTimeMs(a, fallbackDay);
  const tb = visitSortTimeMs(b, fallbackDay);
  if (ta !== tb) return ta >= tb ? a : b;
  const ba = a.bill_id ? 1 : 0;
  const bb = b.bill_id ? 1 : 0;
  if (ba !== bb) return ba > bb ? a : b;
  const ida = Number(a.queue_id || a.id) || 0;
  const idb = Number(b.queue_id || b.id) || 0;
  return ida >= idb ? a : b;
}

/** Visit channel: 'online' or 'offline'. */
export function visitChannel(item) {
  return (item?.appointment_type || (item?.arrival_type === 'online' ? 'online' : 'offline') || 'offline').toLowerCase();
}

/**
 * Combine two rows KNOWN to describe the same visit (same appointment_id).
 * The better row (see pickBetterVisitRow) wins every field it actually has;
 * the other only backfills what's missing — so an appointment-sourced row
 * keeps its bill_* fields while still picking up queue_id/check_in_time/
 * is_vip from the queue-sourced row, and vice versa.
 */
function mergeSameVisitRows(a, b, fallbackDay) {
  const winner = pickBetterVisitRow(a, b, fallbackDay);
  const loser = winner === a ? b : a;
  const out = { ...winner };
  for (const key of Object.keys(loser)) {
    if (out[key] == null || out[key] === '') out[key] = loser[key];
  }
  return out;
}

/**
 * De-duplicate a combined list of appointment + queue rows.
 *
 * Pass 1 — rows carrying the SAME appointment_id are the same physical visit
 * by definition (typically the appointment row and its linked queue row), so
 * they collapse regardless of what their day/channel fields say. This is the
 * safety net: the queue-sourced row rewrites appointment_date to the
 * COMPLETION day and carries no appointment_type, so the patient|day|channel
 * key below can differ for what is provably one visit — which is exactly how
 * duplicate cards reached the Queue list.
 *
 * Pass 2 — the business rule: key patient_id | day | channel. Rows without a
 * patient_id are kept as-is.
 *
 * Returns a new array (noPatientId rows first, then winning rows in key order).
 */
export function dedupeVisits(rows, fallbackDay) {
  const byAppointment = new Map();
  const noAppointmentIdRows = [];
  for (const item of rows) {
    const aid = item?.appointment_id;
    if (aid == null || aid === '') {
      noAppointmentIdRows.push(item);
      continue;
    }
    const key = String(aid);
    const prev = byAppointment.get(key);
    if (!prev) byAppointment.set(key, item);
    else byAppointment.set(key, mergeSameVisitRows(prev, item, fallbackDay));
  }
  const visitRows = [...noAppointmentIdRows, ...byAppointment.values()];

  const visitDedupe = new Map();
  const noPatientIdRows = [];
  for (const item of visitRows) {
    const pid = item?.patient_id;
    if (pid == null || pid === '') {
      noPatientIdRows.push(item);
      continue;
    }
    const day = normVisitDay(item.appointment_date, fallbackDay);
    const key = `${pid}|${day}|${visitChannel(item)}`;
    const prev = visitDedupe.get(key);
    if (!prev) visitDedupe.set(key, item);
    else visitDedupe.set(key, pickBetterVisitRow(prev, item, fallbackDay));
  }
  return [...noPatientIdRows, ...visitDedupe.values()];
}
