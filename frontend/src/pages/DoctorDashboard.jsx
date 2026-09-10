import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import StatCard from '../components/StatCard';
import { dedupeVisits } from '../utils/visitDedupe';

// Memoized patient row component for waiting/in-progress
const PatientRowWaiting = memo(({ patient, index, isInProgress, onPatientClick, onRemove }) => {
  const initials = patient.name ? patient.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() : '?';
  const waitColor = patient.waiting_time === undefined ? '' :
    patient.waiting_time < 15 ? 'text-emerald-600 bg-emerald-100' :
    patient.waiting_time < 30 ? 'text-amber-600 bg-amber-100' :
    'text-red-600 bg-red-100';

  return (
    <div
      key={patient.id}
      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 group hover:shadow-md ${
        isInProgress
          ? 'border-amber-300 bg-amber-50/60 hover:bg-amber-100 hover:border-amber-400'
          : 'border-blue-200 bg-blue-50/40 hover:border-blue-400 hover:bg-blue-100'
      }`}
    >
      {/* rank */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center shadow-sm ${
        isInProgress ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'
      }`}>
        {index + 1}
      </div>
      {/* avatar */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-md bg-gradient-to-br ${
        isInProgress ? 'from-amber-400 to-orange-500' : 'from-blue-500 to-indigo-600'
      }`}>
        {initials}
      </div>
      {/* info — clickable area */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPatientClick(patient)}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shadow-sm ${
            isInProgress ? 'text-amber-700 bg-amber-200' : 'text-blue-600 bg-blue-200'
          }`}>{patient.token_number}</span>
          <span className="font-semibold text-gray-900 text-sm truncate">{patient.name}</span>
          {isInProgress && (
            <span className="text-xs font-semibold text-white bg-amber-500 px-2.5 py-0.5 rounded-full">Active</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {patient.age ? `${patient.age}y` : ''}{patient.age && patient.gender ? ' · ' : ''}{patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : patient.gender || ''}
          {patient.chief_complaint ? ` · ${patient.chief_complaint}` : ''}
        </p>
      </div>
      {/* wait badge */}
      {patient.waiting_time !== undefined && waitColor && (
        <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm ${waitColor}`}>
          {patient.waiting_time}m
        </span>
      )}
      {/* remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(patient); }}
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        title="Remove from queue"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  );
});
PatientRowWaiting.displayName = 'PatientRowWaiting';

// Memoized patient row component for completed
const PatientRowCompleted = memo(({ patient, onPatientClick, onRemove }) => {
  const initials = patient.name ? patient.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() : '?';

  return (
    <div
      key={patient.id}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-emerald-50/60 transition-all duration-200 group border-b border-gray-50 last:border-b-0"
    >
      {/* check */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shadow-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" className="w-4 h-4">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      {/* avatar */}
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
        {initials}
      </div>
      {/* info — clickable */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPatientClick(patient)}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{patient.token_number}</span>
          <span className="font-semibold text-gray-900 text-sm truncate">{patient.name}</span>
        </div>
        {patient.chief_complaint && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{patient.chief_complaint}</p>
        )}
      </div>
      {/* remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(patient); }}
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
        title="Remove from completed"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  );
});
PatientRowCompleted.displayName = 'PatientRowCompleted';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const api = useApiClient();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState({ scheduled: [], waiting: [], in_progress: [], completed: [] });
  const [stats, setStats] = useState({ today_total: 0, scheduled: 0, waiting: 0, in_progress: 0, completed: 0, avg_wait_time: 0 });
  const [pendingBills, setPendingBills] = useState({ count: 0, revenue: 0 });
  const refreshInterval = 30000;

  const mapStatus = useCallback((s) => {
    if (!s) return 'waiting';
    if (s === 'completed') return 'completed';
    if (s === 'in-progress' || s === 'in_progress') return 'in_progress';
    return 'waiting';
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      // doctor_id is explicit here rather than relying solely on the backend's
      // own-doctor fallback — /api/queue/today previously had no scoping at
      // all, so this dashboard's Waiting/Completed counts were silently
      // summing every doctor's patients together.
      const [apptRes, queueRes, billsRes] = await Promise.all([
        api.get(`/api/appointments?date=${today}&limit=200${user?.doctor_id ? `&doctor_id=${user.doctor_id}` : ''}`),
        // limit=500: the backend defaults to 50 rows — on a busy day rows past
        // 50 silently vanish, so completed/waiting counts undercount.
        api.get(`/api/queue/today?limit=500${user?.doctor_id ? `&doctor_id=${user.doctor_id}` : ''}`),
        api.get(`/api/bills/pending${user?.doctor_id ? `?doctor_id=${user.doctor_id}` : ''}`).catch(() => ({ data: { count: 0, revenue: 0 } })),
      ]);

      const billsData = billsRes.data || {};
      setPendingBills({ count: billsData.count || 0, revenue: billsData.revenue || 0 });

      const apptPayload = apptRes.data?.data || apptRes.data;
      const appts = apptPayload?.data || apptPayload?.appointments || (Array.isArray(apptPayload) ? apptPayload : []);

      const queuePayload = queueRes.data?.data || queueRes.data;
      const queueRows =
        Array.isArray(queuePayload)
          ? queuePayload
          : (Array.isArray(queuePayload?.data)
              ? queuePayload.data
              : (queuePayload?.data?.data && Array.isArray(queuePayload.data.data)
                  ? queuePayload.data.data
                  : []));

      const mappedFromAppointments = appts
        .filter(a => !['cancelled', 'no-show', 'no_show'].includes(a.status))
        .map((a) => {
        const qEntry = queueRows.find(q => q.appointment_id === a.id);
        return {
          id: a.id,
          appointment_id: a.id,
          queue_id: qEntry?.queue_id || qEntry?.id || null,
          is_walkin: false,
          patient_id: a.patient_id,
          token_number: a.appointment_time ? a.appointment_time.slice(0, 5) : `${appts.indexOf(a) + 1}`,
          // The QUEUE row is the source of truth for consultation progress: when a
          // doctor completes a visit the queue row becomes 'completed' even if the
          // appointment row still says 'scheduled'/'checked-in'. Prefer the queue
          // status so this dashboard matches the Queue Dashboard's counts.
          //
          // A scheduled appointment with NO queue row means the patient hasn't
          // actually checked in yet — mapStatus()'s fallback used to bucket
          // that into 'waiting' too, so every not-yet-arrived appointment
          // inflated the Waiting stat (and Today, since Today = Waiting +
          // In Progress + Completed) well past what the physical queue
          // (and the Queue Dashboard) actually showed. Keep those as
          // 'scheduled' so they're excluded from all three stat buckets.
          status: qEntry ? mapStatus(qEntry.status) : (a.status === 'completed' ? 'completed' : 'scheduled'),
          name: a.patient_name || '—',
          age: a.patient_age,
          gender: a.patient_gender,
          // /api/appointments is served by AppointmentService, which sends the
          // phone as patient_phone. `contact` is the alias used by the DEAD
          // appointmentController.js, so this was always blank here.
          phone: a.patient_phone || a.contact,
          chief_complaint: a.reason_for_visit,
          appointment_time: a.appointment_time,
          // Fields the shared dedupeVisits rule keys on (utils/visitDedupe.js)
          appointment_date: a.appointment_date,
          appointment_type: a.appointment_type,
          arrival_type: a.arrival_type,
          check_in_time: qEntry?.check_in_time || a.checked_in_at || null,
          bill_id: a.bill_id || null,
          waiting_time: a.checked_in_at
            ? Math.max(0, Math.round((Date.now() - new Date(a.checked_in_at).getTime()) / 60000))
            : undefined,
        };
      });

      // Include walk-ins and queue entries whose appointment doesn't exist in today's list.
      //
      // Key on the appointments that were actually MAPPED, not on every row the
      // API returned: cancelled/no-show appointments are filtered out above, so
      // keying on all of them meant a queue row whose appointment had been
      // cancelled was suppressed here *and* absent there — a visit the doctor
      // had already COMPLETED then vanished from the dashboard altogether.
      const apptIds = new Set(mappedFromAppointments.map(a => a.appointment_id));
      const mappedFromQueue = queueRows
        .filter((q) => !['cancelled', 'no-show', 'no_show'].includes(q.status))
        .filter((q) => !q.appointment_id || !apptIds.has(q.appointment_id))
        .map((q, idx) => ({
          id: q.queue_id || q.id,
          appointment_id: q.appointment_id || null,
          queue_id: q.queue_id || q.id,
          is_walkin: true,
          patient_id: q.patient_id,
          token_number: q.token_number || `${idx + 1}`,
          status: mapStatus(q.status),
          name: q.name || q.patient_name || '—',
          // /api/queue/today aliases these as patient_* to match the
          // appointments payload; keep the bare names as fallbacks.
          age: q.patient_age ?? q.age,
          gender: q.patient_gender || q.gender,
          phone: q.phone || q.patient_phone,
          chief_complaint: q.chief_complaint || 'Walk-in',
          appointment_time: q.appointment_time,
          waiting_time: undefined,
          // Fields the shared dedupeVisits rule keys on (utils/visitDedupe.js)
          appointment_date: q.appointment_date || null,
          appointment_type: q.appointment_type,
          arrival_type: q.arrival_type,
          check_in_time: q.check_in_time || null,
          bill_id: q.bill_id || null,
        }));

      // De-duplicate with the EXACT same rule the Queue dashboard uses
      // (utils/visitDedupe.js: one visit per patient per day per channel,
      // better row wins). Sharing the implementation — instead of a local
      // patient_id-only approximation — is what guarantees this dashboard's
      // Today/Pending/Completed always equal the Queue page's KPI counts.
      const mapped = dedupeVisits([...mappedFromAppointments, ...mappedFromQueue], today);

      const organized = {
        // 'scheduled' = booked but not checked in yet. These ARE part of
        // today's pending workload (the Queue page's Total/Pending KPIs count
        // them), so they belong in the pending panel — previously they were
        // silently dropped from every bucket, which made this dashboard's
        // Today/Pending disagree with the Queue page for the same day.
        scheduled:   mapped.filter(p => p.status === 'scheduled'),
        waiting:     mapped.filter(p => p.status === 'waiting'),
        in_progress: mapped.filter(p => p.status === 'in_progress'),
        completed:   mapped.filter(p => p.status === 'completed'),
      };

      setQueue(organized);

      // Derive all card counts from the SAME de-duplicated `organized` buckets
      // so the validation rule ALWAYS holds:
      //     Today = Pending (scheduled + waiting + in-progress) + Completed
      // — matching the Queue page's KPI definitions exactly.
      const scheduledCount  = organized.scheduled.length;
      const waitingCount    = organized.waiting.length;
      const inProgressCount = organized.in_progress.length;
      const completedCount  = organized.completed.length;
      setStats({
        today_total:   scheduledCount + waitingCount + inProgressCount + completedCount,
        scheduled:     scheduledCount,
        waiting:       waitingCount,
        in_progress:   inProgressCount,
        completed:     completedCount,
        avg_wait_time: 0,
      });
      setLoading(false);
    } catch (error) {
      // Silence benign 404s (optional/missing endpoints); only log real errors.
      if (error?.response?.status !== 404) console.error('Failed to fetch appointments:', error);
      if (typeof showToast === 'function') showToast('Failed to load dashboard data', 'error');
      setLoading(false);
    }
  }, [api, mapStatus, showToast, user]);

  useEffect(() => {
    // Initial fetch immediately on mount, then auto-refresh on an interval.
    // fetchQueue is useCallback-memoized on [api, mapStatus, showToast], so this
    // only re-runs when the API client changes — no render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQueue();
    const interval = setInterval(fetchQueue, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchQueue, refreshInterval]);

  const handlePatientClick = useCallback((patient) => {
    navigate(`/patient-overview/${patient.patient_id}`);
  }, [navigate]);

  const handleRemove = useCallback(async (patient) => {
    if (!window.confirm(`Remove ${patient.name} from queue?`)) return;

    // Cancel BOTH the queue entry and the linked appointment (whichever exist)
    // so nothing lingers in the DB and resurfaces on the dashboard later.
    const ops = [];
    if (patient.queue_id) ops.push(api.delete(`/api/queue/${patient.queue_id}`));
    if (patient.appointment_id) ops.push(api.delete(`/api/appointments/${patient.appointment_id}`));

    if (ops.length === 0) {
      showToast('Unable to remove — no ID found', 'error');
      return;
    }

    // allSettled (not .catch(()=>{})) so failures are NEVER swallowed: we only
    // report success when a delete actually succeeded (or the row was already
    // gone — a 404), and surface the real error otherwise.
    const results = await Promise.allSettled(ops);
    const anySuccess = results.some(r => r.status === 'fulfilled');
    const allGoneOrOk = results.every(r =>
      r.status === 'fulfilled' || r.reason?.response?.status === 404
    );

    if (!anySuccess && !allGoneOrOk) {
      const firstErr = results.find(r => r.status === 'rejected');
      const msg = firstErr?.reason?.response?.data?.error || 'Failed to remove from queue';
      showToast(msg, 'error');
      return;
    }

    showToast(`${patient.name} removed from queue`, 'success');
    fetchQueue();
  }, [api, fetchQueue, showToast]);

  const getGreeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const formatDate = useCallback(() =>
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    []
  );

  // Memoized combined pending list: in-progress first, then waiting (checked
  // in), then scheduled (booked, not yet arrived) — same population as the
  // Pending card so the panel count always equals the card.
  const allWaiting = useMemo(
    () => [...queue.in_progress, ...queue.waiting, ...(queue.scheduled || [])],
    [queue.in_progress, queue.waiting, queue.scheduled]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-medium">Loading dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Modern Header ──────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-50 via-blue-50 to-indigo-50 border-b-2 border-blue-200/50 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-blue-500 text-xs font-bold uppercase tracking-widest mb-2 opacity-80">{getGreeting()}</p>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
                Dr. {user?.name || 'Doctor'}
              </h1>
              <p className="text-gray-600 text-sm mt-2 font-medium">{formatDate()}</p>
            </div>
            <button
              onClick={fetchQueue}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-b from-blue-50/30 via-white to-white min-h-screen px-4 py-5 md:px-6 md:py-8">
        <div className="max-w-7xl mx-auto space-y-5 md:space-y-8">

          {/* ── Stats ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
            {/* INVARIANT (must always hold): Today = Pending + Completed.
                "Pending" = scheduled + waiting + in-progress — the same set
                shown in the "Pending / In Progress" panel below, so the three
                cards always add up, match the lists under them, AND match the
                Queue page's Total/Pending/Completed KPIs. */}
            <StatCard iconType="total"     label="Today"      value={stats.today_total}                                     color="blue"   />
            <StatCard iconType="waiting"   label="Pending"    value={(stats.scheduled || 0) + stats.waiting + stats.in_progress} color="orange" />
            <StatCard iconType="completed" label="Completed"  value={stats.completed}                                       color="green"  />
          </div>

          {/* ── Pending Payments ─────────────────────────────────── */}
          {pendingBills.count > 0 && (
            <div
              className="bg-gradient-to-br from-amber-50 to-orange-50/30 rounded-2xl shadow-md border-2 border-amber-100/60 overflow-hidden cursor-pointer hover:shadow-lg hover:border-amber-200 transition-all duration-300"
              onClick={() => navigate('/billing')}
            >
              <div className="flex items-center justify-between px-4 py-4 md:px-6 md:py-6 border-b border-amber-100/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-6 h-6">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-base">Pending Payments</p>
                    <p className="text-xs text-gray-600 mt-0.5">Click to view billing details</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl md:text-4xl font-black text-amber-600">{pendingBills.count}</p>
                  <p className="text-xs text-gray-600 mt-1 font-medium">bills pending</p>
                </div>
              </div>
              {pendingBills.revenue > 0 && (
                <div className="px-4 py-3 md:px-6 md:py-4 bg-gradient-to-r from-white to-amber-50/20 border-t border-amber-100/50">
                  <p className="text-xs text-gray-700">Today collected: <span className="font-black text-emerald-600">₹{pendingBills.revenue.toLocaleString('en-IN')}</span></p>
                </div>
              )}
            </div>
          )}

          {/* ── Queue Board ──────────────────────────────────────── */}
          <div>
            <div className="mb-6">
              <h2 className="text-xl md:text-2xl font-black text-gray-900">Today's Queue</h2>
              <p className="text-sm text-gray-600 mt-2 font-medium">Auto-refreshes every 30 seconds</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

              {/* ── WAITING / IN-PROGRESS ── */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-50/30 rounded-2xl shadow-md border-2 border-blue-100/60 overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all duration-300">
                <div className="flex items-center justify-between px-4 py-4 md:px-6 md:py-6 bg-gradient-to-r from-blue-100/50 to-indigo-100/30 border-b border-blue-100">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-base">Pending / In Progress</p>
                      <p className="text-xs text-gray-600 mt-0.5 font-medium">Queue management</p>
                    </div>
                  </div>
                  <span className="text-3xl md:text-5xl font-black text-blue-600">{allWaiting.length}</span>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto max-h-96">
                  {allWaiting.length === 0 ? (
                    <div className="flex flex-col items-center py-14 text-gray-400">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-14 h-14 mb-3 opacity-50">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <p className="text-sm font-semibold">No pending appointments</p>
                    </div>
                  ) : allWaiting.map((p, idx) => (
                    <PatientRowWaiting
                      key={`waiting-${p.id}`}
                      patient={p}
                      index={idx}
                      isInProgress={p.status === 'in_progress'}
                      onPatientClick={handlePatientClick}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </div>

              {/* ── COMPLETED ── */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-50/30 rounded-2xl shadow-md border-2 border-emerald-100/60 overflow-hidden hover:shadow-lg hover:border-emerald-200 transition-all duration-300">
                <div className="flex items-center justify-between px-4 py-4 md:px-6 md:py-6 bg-gradient-to-r from-emerald-100/50 to-teal-100/30 border-b border-emerald-100">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-base">Completed</p>
                      <p className="text-xs text-gray-600 mt-0.5 font-medium">Finished today</p>
                    </div>
                  </div>
                  <span className="text-3xl md:text-5xl font-black text-emerald-600">{queue.completed.length}</span>
                </div>
                <div className="divide-y divide-emerald-50 overflow-y-auto max-h-96">
                  {queue.completed.length === 0 ? (
                    <div className="flex flex-col items-center py-14 text-gray-400">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-14 h-14 mb-3 opacity-50">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <p className="text-sm font-semibold">No completed appointments</p>
                    </div>
                  ) : queue.completed.map((p) => (
                    <PatientRowCompleted
                      key={`completed-${p.id}`}
                      patient={p}
                      onPatientClick={handlePatientClick}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

    </>
  );
}
// KPI definitions here intentionally mirror frontend/src/pages/Queue.jsx (kpiPredicates).
