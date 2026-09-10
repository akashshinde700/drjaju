// Regression tests for the CANONICAL visit-counting business rule.
// Cases mirror KPI_AUDIT_RCA.md §6. If any of these fail after an edit to
// visitDedupe.js, you are changing the clinic's confirmed business rule —
// stop and re-read the header of that file.
import { describe, it, expect } from 'vitest';
import { dedupeVisits, visitChannel, pickBetterVisitRow, normVisitDay } from './visitDedupe';

const DAY = '2026-07-18';

const apt = (over = {}) => ({
  id: 1,
  patient_id: 101,
  appointment_date: DAY,
  appointment_time: '10:00:00',
  appointment_type: 'offline',
  status: 'scheduled',
  ...over,
});

describe('normVisitDay', () => {
  it('slices date-ish strings', () => {
    expect(normVisitDay('2026-07-18T09:30:00Z', DAY)).toBe('2026-07-18');
    expect(normVisitDay('2026-07-18 09:30:00', DAY)).toBe('2026-07-18');
  });
  it('uses local calendar day for Date objects', () => {
    expect(normVisitDay(new Date(2026, 6, 18, 23, 30), DAY)).toBe('2026-07-18');
  });
  it('falls back when empty', () => {
    expect(normVisitDay(null, DAY)).toBe(DAY);
  });
});

describe('visitChannel', () => {
  it('appointment_type wins', () => {
    expect(visitChannel({ appointment_type: 'online' })).toBe('online');
  });
  it('falls back to arrival_type, default offline', () => {
    expect(visitChannel({ arrival_type: 'online' })).toBe('online');
    expect(visitChannel({})).toBe('offline');
  });
});

describe('dedupeVisits — RCA §6 cases', () => {
  it('case 3: appointment + duplicate unlinked walk-in row → ONE card', () => {
    const rows = [
      apt({ id: 1, status: 'scheduled' }),
      apt({ id: 900, queue_id: 900, status: 'completed', check_in_time: `${DAY}T11:00:00` }),
    ];
    const out = dedupeVisits(rows, DAY);
    expect(out).toHaveLength(1);
    // later check-in wins → completed row's status is what gets counted
    expect(out[0].status).toBe('completed');
  });

  it('case 4: same patient online + offline same day → TWO', () => {
    const rows = [
      apt({ id: 1, appointment_type: 'offline' }),
      apt({ id: 2, appointment_type: 'online', appointment_time: '15:00:00' }),
    ];
    expect(dedupeVisits(rows, DAY)).toHaveLength(2);
  });

  it('case 5 (confirmed business rule): two offline appointments same day → ONE, later wins', () => {
    const rows = [
      apt({ id: 1, appointment_time: '10:00:00' }),
      apt({ id: 2, appointment_time: '17:00:00' }),
    ];
    const out = dedupeVisits(rows, DAY);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(2);
  });

  it('different days never merge', () => {
    const rows = [apt({ id: 1 }), apt({ id: 2, appointment_date: '2026-07-17' })];
    expect(dedupeVisits(rows, DAY)).toHaveLength(2);
  });

  it('different patients never merge', () => {
    const rows = [apt({ id: 1 }), apt({ id: 2, patient_id: 202 })];
    expect(dedupeVisits(rows, DAY)).toHaveLength(2);
  });

  it('rows without patient_id are kept as-is (never merged)', () => {
    const rows = [apt({ id: 1, patient_id: null }), apt({ id: 2, patient_id: null })];
    expect(dedupeVisits(rows, DAY)).toHaveLength(2);
  });

  // Regression: a completed visit reached the Queue list twice — once from the
  // appointments payload, once from its linked queue row folded in by the
  // completed-rows path. The queue row rewrites appointment_date to the
  // COMPLETION day and carries no appointment_type, so the
  // patient|day|channel key differed and both cards rendered (with the same
  // React key, since both use the appointment id as `id`).
  it('same appointment_id → ONE card even when day/channel fields disagree', () => {
    const rows = [
      apt({ id: 7, appointment_id: 7, appointment_type: 'walk-in', status: 'completed', bill_id: 55 }),
      apt({
        id: 7,
        appointment_id: 7,
        appointment_type: undefined,
        appointment_date: '2026-07-19',
        status: 'completed',
        queue_id: 900,
        is_vip: 0,
        check_in_time: `${DAY}T12:13:00`,
      }),
    ];
    const out = dedupeVisits(rows, DAY);
    expect(out).toHaveLength(1);
    // Fields from BOTH sources survive the merge.
    expect(out[0].bill_id).toBe(55);
    expect(out[0].queue_id).toBe(900);
  });

  it('different appointment_ids for one patient still follow the day/channel rule', () => {
    const rows = [
      apt({ id: 1, appointment_id: 1, appointment_time: '10:00:00' }),
      apt({ id: 2, appointment_id: 2, appointment_time: '17:00:00' }),
    ];
    expect(dedupeVisits(rows, DAY)).toHaveLength(1);
  });
});

describe('pickBetterVisitRow tie-breaks', () => {
  it('later visit time wins', () => {
    const a = apt({ id: 1, check_in_time: `${DAY}T09:00:00` });
    const b = apt({ id: 2, check_in_time: `${DAY}T10:00:00` });
    expect(pickBetterVisitRow(a, b, DAY).id).toBe(2);
  });
  it('same time: bill wins', () => {
    const a = apt({ id: 1, check_in_time: `${DAY}T09:00:00` });
    const b = apt({ id: 2, check_in_time: `${DAY}T09:00:00`, bill_id: 55 });
    expect(pickBetterVisitRow(a, b, DAY).id).toBe(2);
  });
  it('same time, no bills: higher id wins', () => {
    const a = apt({ id: 3, check_in_time: `${DAY}T09:00:00` });
    const b = apt({ id: 7, check_in_time: `${DAY}T09:00:00` });
    expect(pickBetterVisitRow(a, b, DAY).id).toBe(7);
  });
});
