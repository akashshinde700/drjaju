import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import Modal from '../components/Modal';
import { useApiClient } from '../api/client';
import useBillLetterhead, { billPdfQuery } from '../hooks/useBillLetterhead';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import AddPatientModal from '../components/AddPatientModal';
import { openWhatsApp } from '../utils/whatsapp';
import { getSelectedDoctorId, isAdmin } from '../utils/doctorUtils';
import { getLocalDateString } from '../utils/localDate';
import { dedupeVisits, visitSortTimeMs } from '../utils/visitDedupe';

const apiBase = (import.meta.env && import.meta.env.VITE_API_URL) || '';

const summaryCards = [
  { key: 'today', label: 'Today (Active)', count: 0 },
  { key: 'followups', label: 'Follow ups', count: 0 },
  { key: 'completed', label: 'Completed', count: 0 },
  { key: 'upcoming', label: 'Upcoming', count: 0 },
  { key: 'others', label: 'Others', count: 0 }
];

// ─── KPI single source of truth ─────────────────────────────────────────────
// The Total/Pending/Completed/Paid KPI cards and the list shown when a card is
// clicked BOTH use these exact predicates over the SAME fetched dataset, so the
// card number always equals the number of rows displayed. (Previously the cards
// came from GET /api/queue/stats SQL while the list was assembled client-side
// with different rules — the two could never be kept in sync.)
const kpiStatusOf = (apt) => String(apt?.status || '').toLowerCase();
// Effective visit day: completion day (or check-in day) when present, else the
// scheduled appointment date — mirrors the backend's COALESCE(completed_at,
// check_in_time, appointment_date) convention, resolved to the LOCAL calendar day.
const kpiVisitDay = (apt) => {
  const raw = apt?.completed_at || apt?.check_in_time || apt?.appointment_date;
  if (!raw) return '';
  return getLocalDateString(raw instanceof Date ? raw : new Date(raw));
};
const kpiPredicates = {
  // Everyone with a visit on the active day (any status except cancelled/no-show)
  total: (apt, day) =>
    !['cancelled', 'no-show'].includes(kpiStatusOf(apt)) && kpiVisitDay(apt) === day,
  // Not completed yet — scheduled, waiting AND in-progress all count as pending
  pending: (apt, day) =>
    kpiPredicates.total(apt, day) && kpiStatusOf(apt) !== 'completed',
  completed: (apt, day) =>
    kpiStatusOf(apt) === 'completed' && kpiVisitDay(apt) === day,
  // Paid bill on the active day (bill status wins over appointment payment_status)
  paid: (apt, day) =>
    kpiPredicates.total(apt, day) &&
    String(apt?.bill_payment_status || apt?.payment_status || '').toLowerCase() === 'paid',
};

// 12-hour AM/PM display for a "HH:MM" time string — module-level so it's
// usable both here and inside the Queue() component's own card renderers.
function formatTime12h(timeString) {
  if (!timeString) return 'N/A';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return 'N/A';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// Age for a queue card. Reception may record EITHER a date of birth OR a plain
// age (the Add Patient form clears one when you fill the other), so both have
// to be handled or half the patients show nothing. Returns '' when neither is
// known, so the caller can drop the chip entirely instead of printing "N/A".
function patientAgeLabel(apt) {
  const dob = apt?.patient_dob || apt?.dob;
  if (dob) {
    const d = new Date(dob);
    if (!Number.isNaN(d.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
      if (age >= 0 && age < 150) return `${age}y`;
    }
  }
  const years = apt?.patient_age ?? apt?.age_years ?? apt?.age;
  if (years !== null && years !== undefined && years !== '' && Number(years) >= 0) {
    return `${Number(years)}y`;
  }
  return '';
}

/** Gender letter (M/F/O) for the card chip, from either payload's field name. */
function patientGenderLabel(apt) {
  const g = String(apt?.patient_gender || apt?.gender || '').trim().toUpperCase();
  if (!g || g === 'U' || g === 'UNKNOWN') return '';
  return g[0];
}

// MEMOIZED Appointment Card - Prevents re-renders of 50+ items when parent updates
// Uses React.memo with custom comparison to only re-render when appointment data actually changes
const AppointmentCardMemo = React.memo(({ apt, isSelected, onSelect, onVisit, onMenu, _menuOpen, _menuPos, _createPortal: _CP }) => {
  return (
    <div 
      key={apt.id} 
      className={`rounded-xl p-4 hover:shadow-xl transition-all duration-200 border ${
        apt.status === 'completed' ? 'bg-gradient-to-br from-green-50 via-white to-emerald-50 border-green-300 shadow-md' : 
        apt.status === 'cancelled' ? 'bg-gradient-to-br from-red-50 via-white to-rose-50 border-red-300 opacity-75 shadow-md' : 
        apt.status === 'in-progress' ? 'bg-gradient-to-br from-blue-50 via-blue-50 to-cyan-50 border-blue-400 shadow-lg' :
        'bg-white border-slate-200 shadow-sm'
      }`}
    >
      {/* TOP SECTION - Patient info */}
      <div className="flex items-start justify-between gap-4 mb-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(apt.id, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300"
          />
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-md ${
            apt.status === 'in-progress' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
            apt.status === 'completed' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
            'bg-gradient-to-br from-indigo-500 to-indigo-600'
          }`}>
            {apt.patient_name ? apt.patient_name[0].toUpperCase() : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base text-slate-900 truncate">{apt.patient_name || 'Unknown'}</p>
            <div className="text-xs text-slate-600">📞 {apt.contact || apt.phone || '-'}</div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVisit(apt);
            }}
            className="px-4 py-1.5 text-[10px] bg-gradient-to-r from-purple-600 via-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-700 hover:via-purple-700 hover:to-indigo-700 active:scale-95 transition-all shadow-md hover:shadow-lg whitespace-nowrap tracking-wide"
          >
            👁️ Visit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenu(apt.id, e);
            }}
            className="p-1 text-slate-400 hover:bg-slate-100 rounded text-sm"
          >
            ⋮
          </button>
        </div>
      </div>
      
      {/* BOTTOM SECTION - Quick info */}
      <div className="text-xs text-slate-600 flex gap-2 flex-wrap">
        <span>📅 {new Date(apt.appointment_date || new Date()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
        <span>⏰ {formatTime12h(apt.appointment_time?.substring(0, 5))}</span>
        <span className="font-semibold text-indigo-600">{apt.status}</span>
      </div>
    </div>
  );
}, (prev, next) => {
  // Custom comparison - return true if props haven't changed (skip re-render)
  return (
    prev.apt?.id === next.apt?.id &&
    prev.apt?.status === next.apt?.status &&
    prev.apt?.check_in_time === next.apt?.check_in_time &&
    prev.isSelected === next.isSelected &&
    prev._menuOpen === next._menuOpen
  );
});

export default function Queue() {
  const api = useApiClient();
  const [billWithLetterhead] = useBillLetterhead();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  
  // State
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointments, setSelectedAppointments] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(''); // Debounced search for filtering
  const [filters, setFilters] = useState({
    dateRange: '',
    visitType: '',
    tags: '',
    paymentStatus: '',
    status: '',
    // Active KPI bucket ('' | 'total' | 'pending' | 'completed' | 'paid').
    // When set, the list is filtered with kpiPredicates — the same predicates
    // used to compute the KPI card numbers — so card count === list count.
    kpi: '',
    isFollowUp: false,
    others: false, // Others card: past pending appointments (last 7 days, not completed/cancelled/no-show)
    month: '',
    year: ''
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(10); // 10 patients per page in the Active Queue
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickAbha, setQuickAbha] = useState('');
  const [_checkInLoadingId, setCheckInLoadingId] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [showQuickRegisterModal, setShowQuickRegisterModal] = useState(false);
  const [quickRegisterForm, setQuickRegisterForm] = useState({
    name: '',
    phone: '',
    consultation_fee: 500
  });
  const [quickSearchResults, setQuickSearchResults] = useState([]);
  const [quickSearchLoading, setQuickSearchLoading] = useState(false);
  const [completedRange, setCompletedRange] = useState('today');
  const [completedMenuOpen, setCompletedMenuOpen] = useState(false);
  const [_stats, setStats] = useState(summaryCards.map(card => ({ ...card, count: 0 })));
  // Date filter for viewing a past day's COMPLETED queue patients (history).
  const [historyDate, setHistoryDate] = useState('');
  // Date filter for viewing a past day's PENDING (not-yet-completed) patients.
  const [pendingDate, setPendingDate] = useState('');

  // Create Bill Modal State
  const [showCreateBillModal, setShowCreateBillModal] = useState(false);
  const [createBillPatient, setCreateBillPatient] = useState(null);
  const [billFormData, setBillFormData] = useState({
    services: [{ service_name: 'Consultation', qty: 1, unit_price: 500, discount: 0, total: 500 }],
    tax: 0,
    discount: 0,
    payment_method: 'cash',
    payment_status: 'pending',
    amount_paid: ''
  });
  const [editingBillId, setEditingBillId] = useState(null);
  const [billCreating, setBillCreating] = useState(false);
  const [billPayPopover, setBillPayPopover] = useState(null); // { id, top, left }
  const [billPayLoading, setBillPayLoading] = useState(null); // apt.id being updated
  const [billPartialInput, setBillPartialInput] = useState({}); // { [apt.id]: amountString } for inline partial entry
  // Service picker for bill modal
  const [groupedServices, setGroupedServices] = useState({});
  const [showBillServicePicker, setShowBillServicePicker] = useState(false);
  const [billServiceSearch, setBillServiceSearch] = useState('');
  const [billServiceCategory, setBillServiceCategory] = useState('');
  const [serviceGroups, setServiceGroups] = useState([]);
  const [billServicePickerTab, setBillServicePickerTab] = useState('services'); // 'services' | 'groups'
  const [openGroupPopover, setOpenGroupPopover] = useState(null); // group id with open popover

  // CACHE: Store appointments API results to avoid redundant calls (24-hour cache with 30s TTL)
  const cacheRef = React.useRef({
    data: null,
    timestamp: 0,
    params: null,
    TTL: 30000 // 30 seconds
  });

  // Auto-refresh throttle for window focus/visibility events
  const lastAutoRefreshRef = React.useRef(0);

  // Remembers the params of the last real fetchAppointments call (e.g. a KPI
  // card click that filtered to status=completed) so the 30s background poll
  // can repeat that same view instead of silently resetting to the today/
  // unfiltered default and making the filtered rows disappear.
  const lastFetchParamsRef = React.useRef({});

  // Cached card totals from the dedicated lightweight count fetch (fetchCardCounts).
  // Each value null = not yet loaded → calculateStats falls back to computing it
  // from the currently displayed array. Once loaded, these stable, dedicated counts
  // are overlaid so the cards don't drift when the list array is replaced by a
  // card click (e.g. Completed/Others) or capped by the main fetch's limit.
  const cardCountsRef = React.useRef({ today: null, followups: null, completed: null, upcoming: null, others: null });

  // Persistent bill data cache: survives tab switches & re-fetches
  // Maps appointment_id → { bill_id, bill_total, bill_payment_status, bill_amount_paid }
  const billCacheRef = React.useRef({});
  // Cache latest prescription id per patient to speed up "View Rx"
  // Maps patient_db_id (string) → rxId
  const rxCacheRef = React.useRef({});
  // Track in-flight prefetch requests so visible cards don't trigger duplicate calls
  const rxPrefetchInFlightRef = React.useRef(new Set());
  const pendingVisitRef = React.useRef(null);
  const pendingVisitHandledRef = React.useRef(false);

  const normalizeCacheParams = useCallback((params = {}) => {
    const sorted = Object.keys(params).sort().reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
    return JSON.stringify(sorted);
  }, []);

  // Helper to check if cache is still valid for the requested params
  const getCachedData = useCallback((params = {}) => {
    const now = Date.now();
    const paramsKey = normalizeCacheParams(params);
    if (
      cacheRef.current?.data &&
      cacheRef.current?.paramsKey === paramsKey &&
      (now - cacheRef.current.timestamp) < cacheRef.current.TTL
    ) {
      return cacheRef.current.data;
    }
    return null;
  }, [normalizeCacheParams]);

  // Helper to invalidate cache (call after mutations)
  const invalidateCache = useCallback(() => {
    cacheRef.current = { data: null, timestamp: 0, paramsKey: null, TTL: 30000 };
  }, []);

  // Fetch billing services for service picker
  const fetchBillingServices = useCallback(async () => {
    try {
      const res = await api.get('/api/bills/services');
      const grouped = res.data.grouped || {};
      if (Object.keys(grouped).length > 0) {
        setGroupedServices(grouped);
      } else {
        const services = res.data.services || [];
        const g = {};
        services.forEach(s => {
          const cat = s.category || 'Other';
          if (!g[cat]) g[cat] = [];
          g[cat].push(s);
        });
        setGroupedServices(g);
      }
    } catch (_) { /* services optional */ }
  }, [api]);

  const fetchServiceGroups = useCallback(async () => {
    try {
      const res = await api.get('/api/bills/service-groups');
      setServiceGroups(res.data.groups || []);
    } catch (_) { /* optional */ }
  }, [api]);

  // Bill form helpers
  const billCalcTotals = useCallback(() => {
    const subtotal = billFormData.services.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
    const taxAmt = (subtotal * parseFloat(billFormData.tax || 0)) / 100;
    const total = subtotal + taxAmt - parseFloat(billFormData.discount || 0);
    return { subtotal, taxAmt, total: Math.max(0, total) };
  }, [billFormData]);

  const billHandleServiceChange = useCallback((index, field, value) => {
    setBillFormData(prev => {
      const updated = prev.services.map((s, i) => {
        if (i !== index) return s;
        const newS = { ...s, [field]: value };
        if (['qty', 'unit_price', 'discount'].includes(field)) {
          const qty = parseFloat(field === 'qty' ? value : newS.qty) || 1;
          const up = parseFloat(field === 'unit_price' ? value : newS.unit_price) || 0;
          const disc = parseFloat(field === 'discount' ? value : newS.discount) || 0;
          newS.total = qty * up - disc;
        }
        return newS;
      });
      return { ...prev, services: updated };
    });
  }, []);

  // Close completed menu when clicking outside the card
  useEffect(() => {
    function handleDocClick(e) {
      if (!completedMenuOpen) return;
      if (e.target.closest('[data-completed-card]')) return; // inside card, ignore
      setCompletedMenuOpen(false);
    }
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [completedMenuOpen]);

  // Debounce search input (300ms delay) - prevents filter recalculation on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Safely resolve patient DB primary key from multiple possible fields
  const resolvePatientDbId = useCallback((apt) => {
    const candidate = apt?.patient_db_id || apt?.patient_table_id || apt?.patientId || apt?.patient_id || null;
    return candidate != null ? String(candidate) : null;
  }, []);

  // Calculate statistics (must be defined BEFORE fetchAppointments which calls it)
  const calculateStats = useCallback((appointmentsData) => {
    const today = getLocalDateString();
    const newStats = summaryCards.map(card => ({ ...card, count: 0 }));

    appointmentsData.forEach(apt => {
      // Normalize appointment_date to a plain YYYY-MM-DD string so comparisons with
      // `today` are correct. The raw value may be a Date object or a full datetime
      // string (e.g. "2026-06-22T00:00:00.000Z"), which breaks ===/>/< comparisons
      // and causes today's appointments to be miscounted as "Upcoming".
      const rawAptDate = apt?.appointment_date;
      const aptDate = rawAptDate ? getLocalDateString(rawAptDate instanceof Date ? rawAptDate : new Date(rawAptDate)) : '';
      const status = apt?.status;

      // Today's ACTIVE appointments (exclude completed/cancelled/no-show so this
      // card reflects who is still in the queue today; Completed is its own card).
      if (aptDate === today && status !== 'completed' && status !== 'cancelled' && status !== 'no-show') {
        newStats[0].count++;
      }

      // Follow-ups (REMAINING only — exclude completed/cancelled/no-show)
      const isFollowApt = apt?.is_follow_up || apt?.reason_for_visit?.toLowerCase?.().includes('follow');
      if (isFollowApt && status !== 'completed' && status !== 'cancelled' && status !== 'no-show') {
        newStats[1].count++;
      }

      // Completed
      if (status === 'completed') {
        newStats[2].count++;
      }

      // Upcoming (future dates)
      if (aptDate > today && status !== 'completed' && status !== 'cancelled') {
        newStats[3].count++;
      }

      // Others (past dates, not completed)
      if (aptDate < today && status !== 'completed') {
        newStats[4].count++;
      }
    });

    // Overlay ALL cards from the dedicated lightweight count fetch (fetchCardCounts).
    // The displayed `appointments` array changes when a card is clicked (Completed,
    // Others, etc.) and is capped by the main fetch's limit, so recomputing these
    // from it would make the counts unstable/undercounted. Re-applying the cached
    // dedicated values here keeps every card correct across refreshes and clicks.
    // (null = not yet loaded → keep the value computed above as a first-paint fallback.)
    if (cardCountsRef.current.today != null) newStats[0].count = cardCountsRef.current.today;
    if (cardCountsRef.current.followups != null) newStats[1].count = cardCountsRef.current.followups;
    if (cardCountsRef.current.completed != null) newStats[2].count = cardCountsRef.current.completed;
    if (cardCountsRef.current.upcoming != null) newStats[3].count = cardCountsRef.current.upcoming;
    if (cardCountsRef.current.others != null) newStats[4].count = cardCountsRef.current.others;

    setStats(newStats);
  }, []);

  // Fetch appointments from API - AGGRESSIVELY OPTIMIZED for speed with caching
  const fetchAppointments = useCallback(async (extraParams = {}, skipCache = false) => {
    // Guard: if this was wired directly as an event handler (onClick={fetchAppointments})
    // the first arg is a React SyntheticEvent. Spreading an event into the axios
    // params and JSON.stringify-ing it for the cache key throws on its circular
    // DOM references, which crashed the whole fetch with "Unable to load
    // appointments" and poisoned lastFetchParamsRef for every later poll.
    if (!extraParams || typeof extraParams !== 'object' || typeof extraParams.preventDefault === 'function' || extraParams.nativeEvent) {
      extraParams = {};
    }
    lastFetchParamsRef.current = extraParams;
    setLoading(true);
    setError('');
    try {
      // Build query params - OPTIMIZED for speed
      const params = {
        _t: Date.now(),
        fields: 'id,patient_id,patient_name,appointment_date,appointment_time,status,doctor_id,doctor_name,clinic_id,reason_for_visit,payment_status,is_vip,check_in_time,queue_id,bill_id,appointment_type,arrival_type'
      };

      const cacheKeyParams = { ...params, ...extraParams };
      delete cacheKeyParams._t;

      // Check cache first (unless explicitly skipped)
      if (!skipCache) {
        const cachedData = getCachedData(cacheKeyParams);
        if (cachedData) {
          setAppointments(cachedData);
          calculateStats(cachedData);
          setLoading(false);
          return; // Use cached data, skip API call
        }
      }

      // Default to fetching only TODAY's appointments (reduce payload)
      const todayStr = getLocalDateString();
      const isDateFiltered = Boolean(extraParams?.date || extraParams?.start_date || extraParams?.end_date);
      const isStatusFiltered = Boolean(extraParams?.status);
      if (!extraParams?.date && !extraParams?.start_date && !extraParams?.end_date) {
        params.date = todayStr;
      }

      // Use a large payload everywhere: the KPI cards are computed client-side
      // from this dataset, so a low default limit would silently truncate the
      // counts (isDateFiltered/isStatusFiltered kept for readability of intent).
      if (!extraParams?.limit) {
        params.limit = isDateFiltered || isStatusFiltered ? 500 : 500;
      }

      // If admin user and has selected a doctor, filter by that doctor's appointments
      if (isAdmin(user)) {
        const selectedDoctorId = getSelectedDoctorId();
        if (selectedDoctorId) {
          params.doctor_id = selectedDoctorId;
        }
      } else if (user?.role === 'doctor' && user?.doctor_id) {
        params.doctor_id = user.doctor_id;
      }

      // PARALLEL fetch with improved error handling
      const [appointmentsRes, queueRes] = await Promise.all([
        api.get('/api/appointments', { 
          params: { ...params, ...extraParams },
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 5000 // 5 second timeout
        }).catch((_err) => {
          return { data: { data: { data: [], appointments: [] }, success: false } };
        }),
        api.get('/api/queue/today', {
          params: {
            // limit=500: backend defaults to 50 rows/page — without this, on a
            // 50+ patient day the extra queue rows silently vanish and every
            // client-computed KPI count comes out low ("aadha data").
            limit: 500,
            ...(params.doctor_id ? { doctor_id: params.doctor_id } : {}),
            ...(extraParams?.status && extraParams.status !== 'pending' ? { status: extraParams.status } : {}),
            // Without this, the queue's waiting/in_progress state (the only
            // place "pending" actually lives) was always fetched for TODAY
            // regardless of which date was picked in "View pending/completed
            // patients on", so past-date views could never show it.
            ...((extraParams?.start_date || extraParams?.date) ? { date: extraParams.start_date || extraParams.date } : {})
          },
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 5000
        }).catch((_err) => {
          return { data: [] };
        })
      ]);
      
      const appointmentsData = appointmentsRes?.data?.data?.data || appointmentsRes?.data?.data?.appointments || [];
      const today = todayStr;
      // ApiResponse.paginated → res.data.data = { data: [...], pagination: {} }
      const queuePayload = queueRes?.data?.data || queueRes?.data;
      const queueData =
        Array.isArray(queuePayload)
          ? queuePayload
          : (Array.isArray(queuePayload?.data) ? queuePayload.data : []);

      const normalizeId = (val) => (val === null || val === undefined ? null : String(val));
      const mapStatus = (s) => {
        const normalized = String(s || '').toLowerCase();
        if (normalized === 'completed') return 'completed';
        if (['in-progress', 'in_progress', 'called'].includes(normalized)) return 'in_progress';
        return 'waiting';
      };
      const queueByAppointmentId = new Map();
      queueData.forEach((q) => {
        const key = normalizeId(q?.appointment_id);
        if (key) {
          queueByAppointmentId.set(key, q);
        }
      });
      
      // Combine appointments and queue entries (OPTIMIZED)
      const combinedData = [];

      // Track appointment ids already emitted so the queue loop below doesn't
      // duplicate them. Used by the completed-status path which folds in
      // completed queue rows (incl. appointment-linked ones) so visits that were
      // completed today but scheduled on an EARLIER date (and therefore absent
      // from the today-scoped /api/appointments payload) still appear in the list.
      const addedAppointmentIds = new Set();

      // Add appointments
      appointmentsData.forEach(apt => {
        const qRow = queueByAppointmentId.get(normalizeId(apt.id));
        const inQueue = Boolean(qRow);
        const effectiveStatus = mapStatus(qRow?.status || apt?.status);
        const rawAptDate = apt.appointment_date;
        const aptDate = rawAptDate
          ? getLocalDateString(rawAptDate instanceof Date ? rawAptDate : new Date(rawAptDate))
          : (apt.check_in_time ? getLocalDateString(new Date(apt.check_in_time)) : null);

        // If caller requested completed status, include completed rows based on the
        // authoritative effective status (queue status wins when present).
        if (extraParams && extraParams.status === 'completed') {
          if (effectiveStatus === 'completed') {
            addedAppointmentIds.add(normalizeId(apt.id));
            combinedData.push({
              ...apt,
              source: 'appointment',
              // /api/appointments returns the appointment as `id`; state it as
              // appointment_id too so this row and its queue-sourced twin share
              // a visit identity that dedupeVisits can collapse on. Matches the
              // `apt.appointment_id || (source !== 'walkin' ? apt.id : null)`
              // fallback the action handlers already use.
              appointment_id: apt.appointment_id || apt.id,
              in_queue: inQueue,
              ...(qRow
                  ? {
                      queue_id: qRow.queue_id || qRow.id,
                      check_in_time: qRow.check_in_time || apt.check_in_time,
                      completed_at: qRow.completed_at || apt.completed_at,
                      status: mapStatus(qRow.status || apt.status),
                    }
                  : {}),
            });
          }
          return;
        }

        // Default: include today's appointments (scheduled-only rows too, even if
        // not yet checked into the queue) so the Active Queue list matches the
        // TODAY summary card. Walk-ins/checked-in rows from other days still show
        // via inQueue. When a specific date OR a date range (start_date/end_date,
        // e.g. the Others card, or the Paid KPI card viewing a past date) is
        // requested, include those rows too so the list isn't empty for
        // past-date views.
        const rangeRequested = Boolean(extraParams?.date || extraParams?.start_date || extraParams?.end_date);

        // Default queue view: hide cancelled/no-show so "Remove" reflects immediately
        if (['cancelled', 'no-show'].includes(effectiveStatus)) {
          return;
        }
        // Include today's completed appointments for stats counting, skip older
        // completed — but only in the truly-default view. When a specific
        // date/range was explicitly requested (rangeRequested), a completed
        // visit from THAT date must not be discarded just because it isn't
        // today — this used to silently empty out the Paid KPI card's list
        // for any past date, since its fetch has no `status` extraParam and
        // so never took the dedicated completed-status branch above.
        if (effectiveStatus === 'completed' && aptDate !== today && !rangeRequested) {
          return;
        }

        if (inQueue || aptDate === today || rangeRequested) {
          // Record the id here too — NOT just in the completed-status branch
          // above. The queue loop below deliberately folds in COMPLETED
          // appointment-linked queue rows even in the default view (so visits
          // scheduled earlier but completed today still show). With this set
          // left empty, its "already emitted" guard never fired and every
          // visit that is completed today AND has both an appointment row and
          // a queue row was pushed twice — two identical cards, same
          // appointment id, so even the React `key` collided.
          addedAppointmentIds.add(normalizeId(apt.id));
          combinedData.push({
            ...apt,
            source: 'appointment',
            // See note in the completed branch above — gives this row the same
            // visit identity as its queue-sourced twin so dedupeVisits can
            // collapse them even if their day/channel fields disagree.
            appointment_id: apt.appointment_id || apt.id,
            in_queue: inQueue,
            // If it exists in queue, attach queue metadata so actions can target queue endpoints correctly
            ...(qRow
              ? {
                  queue_id: qRow.queue_id || qRow.id,
                  check_in_time: qRow.check_in_time || apt.check_in_time,
                  completed_at: qRow.completed_at || apt.completed_at,
                  // Queue status is authoritative for live queue state
                  status: qRow.status || apt.status,
                }
              : {})
          });
        }
      });
      
      // Add queue rows that aren't already represented by an appointment row above.
      //
      // Normally only walk-ins (queue rows with NO appointment_id) are folded in.
      // For the COMPLETED view we additionally fold in appointment-LINKED completed
      // queue rows whose appointment wasn't in the (today-scoped) appointments
      // payload — i.e. visits scheduled on an earlier date but completed today.
      // Without this, those rows silently vanish and the Completed list shows far
      // fewer than the Completed card count.
      const isCompletedView = Boolean(extraParams && extraParams.status === 'completed');
      queueData.forEach(queueItem => {
        const qStatus = String(queueItem?.status || '').toLowerCase();
        const hasAppointment = Boolean(queueItem.appointment_id);

        // Skip appointment-linked rows that were already emitted from the
        // appointments loop (avoids duplicate cards for the same visit).
        if (hasAppointment && addedAppointmentIds.has(normalizeId(queueItem.appointment_id))) {
          return;
        }

        // In the default (non-completed) view, walk-ins are folded in here, and
        // appointment-linked rows are normally handled by the appointments loop
        // above. EXCEPTION: appointment-linked rows that are COMPLETED today but
        // whose appointment was scheduled on an EARLIER date are absent from the
        // today-scoped /api/appointments payload, so fold them in here too —
        // otherwise the default "Completed (n)" section undercounts vs the card
        // (which the backend computes via DATE(COALESCE(completed_at,...))=TODAY).
        if (!isCompletedView && hasAppointment && qStatus !== 'completed') {
          return;
        }

        if (isCompletedView) {
          if (qStatus !== 'completed') return;
          // /api/queue/today only ever returns TODAY's queue rows, regardless
          // of what date the "View completed patients on" picker requested.
          // Without this check, picking e.g. 9 July still showed today's
          // completed visits because they got folded in unconditionally.
          const requestedStart = extraParams?.start_date || extraParams?.date;
          const requestedEnd = extraParams?.end_date || extraParams?.date;
          if (requestedStart || requestedEnd) {
            // completed_at/check_in_time come back as UTC ISO strings — slicing
            // the string directly extracts the UTC calendar date, not the local
            // (IST) one. For ~5.5 hours every night (UTC midnight to IST
            // midnight) that's the wrong day, so a walk-in checked in just
            // after midnight IST got silently filed under "yesterday" and
            // vanished from today's Active Queue list.
            const rawQDay = queueItem.completed_at || queueItem.check_in_time;
            const qDate = rawQDay ? getLocalDateString(new Date(rawQDay)) : today;
            if (requestedStart && qDate < requestedStart) return;
            if (requestedEnd && qDate > requestedEnd) return;
          }
        } else {
          if (['cancelled', 'no-show'].includes(qStatus)) {
            return;
          }
          // Include completed rows for the REQUESTED day (today by default) even
          // if checked in earlier, by basing the day check on the completion day
          // (completed_at) and falling back to check-in day. Comparing against
          // the requested date (not always `today`) keeps a past date's completed
          // walk-ins visible in the "View completed/pending patients on" views.
          const requestedDay = extraParams?.start_date || extraParams?.date || today;
          const rawQDay = queueItem.completed_at || queueItem.check_in_time;
          const qDate = rawQDay ? getLocalDateString(new Date(rawQDay)) : today;
          if (qStatus === 'completed' && qDate !== requestedDay) {
            return;
          }
        }
        // Use queue_id or id - whichever is available
        const queueId = queueItem.queue_id || queueItem.id;
        // Prefer the completion day for completed rows (and check-in day otherwise)
        // so the day-based completed filter keeps these rows even when the original
        // appointment_date was an earlier day. See UTC-vs-local note above.
        const rawQueueDay = queueItem.completed_at || queueItem.check_in_time;
        const queueDay = rawQueueDay ? getLocalDateString(new Date(rawQueueDay)) : getLocalDateString();
        combinedData.push({
          ...queueItem,
          source: hasAppointment ? 'appointment' : 'walkin',
          // Keep `id` consistent with how the appointments loop emits rows:
          // appointment-linked rows use the appointment id as `id` (so Visit/
          // bill actions that read apt.id resolve the right entity); walk-ins
          // (no appointment) use the queue id.
          id: hasAppointment ? queueItem.appointment_id : queueId,
          queue_id: queueId,
          appointment_id: queueItem.appointment_id || null,
          patient_id: queueItem.patient_id,
          patient_name: queueItem.name || queueItem.patient_name,
          // Queue API uses patient_id = patients.id (int); real UHID is patient_identifier
          uhid: queueItem.patient_identifier || queueItem.uhid,
          phone: queueItem.phone,
          // Mirror the appointments payload's field names so the card reads the
          // same keys whichever source a row came from: /api/appointments sends
          // the phone as `contact`, and age/gender/dob as patient_*.
          contact: queueItem.phone,
          patient_age: queueItem.patient_age ?? queueItem.age_years ?? queueItem.age,
          patient_dob: queueItem.patient_dob || queueItem.dob || null,
          patient_gender: queueItem.patient_gender || queueItem.gender || null,
          appointment_date: queueDay,
          // check_in_time is a UTC ISO timestamp — slicing the raw string gave
          // the UTC clock time (e.g. "08:15" for a 1:45 PM IST check-in), a
          // 5:30 offset that showed up as a wrong time on the queue card.
          // Parsing into a Date and reading local hours/minutes uses the
          // browser's timezone (IST for this clinic) instead.
          appointment_time: queueItem.check_in_time
            ? (() => { const d = new Date(queueItem.check_in_time); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; })()
            : new Date().toTimeString().split(' ')[0].substring(0, 5),
          status: mapStatus(queueItem.status || 'waiting'),
          reason_for_visit: queueItem.reason_for_visit || (hasAppointment ? 'Consultation' : 'Walk-in'),
          in_queue: true
        });
      });
      
      // Sort: who needs attention NOW — in-progress, then waiting (checked
      // in), then scheduled/not-yet-arrived (earliest appointment_time
      // first), completed/cancelled last. Mirrors filteredAppointmentsData's
      // own sort below (the one that actually governs render order) so the
      // `appointments` state itself isn't left in a contradictory order.
      // Previously 'scheduled' got priority 0 unconditionally — any new
      // same-day booking, however late in the evening, jumped to the top —
      // and the time tie-break built `${appointment_date} ${appointment_time}`
      // from a raw ISO datetime string, producing an Invalid Date (NaN
      // comparisons) whenever appointment_date wasn't a plain YYYY-MM-DD.
      const getStatusPriority = (apt) => {
        const status = (apt?.status || '').toLowerCase();
        if (status === 'completed' || status === 'cancelled') return 3;
        if (status === 'in_progress' || status === 'in-progress') return 0;
        if (status === 'waiting') return 1;
        return 2;
      };
      const statusThenTime = (a, b) => {
        const p = getStatusPriority(a) - getStatusPriority(b);
        return p !== 0 ? p : visitSortTimeMs(a, today) - visitSortTimeMs(b, today);
      };

      combinedData.sort(statusThenTime);

      // One card per patient per calendar day per visit channel (offline/online).
      // The rule lives in utils/visitDedupe.js and is SHARED with
      // DoctorDashboard so both dashboards count identically by construction.
      let deduped = dedupeVisits(combinedData, todayStr);

      deduped.sort(statusThenTime);
      
      // Merge persistent bill cache: if API didn't return bill_id but we cached it earlier, restore it
      let merged = deduped.map(apt => {
        if (!apt.bill_id) {
          const cached = billCacheRef.current[apt.id];
          if (cached?.bill_id) return { ...apt, ...cached };
        } else {
          // Update cache with latest from API
          billCacheRef.current[apt.id] = {
            bill_id: apt.bill_id,
            bill_total: apt.bill_total,
            bill_payment_status: apt.bill_payment_status,
            bill_amount_paid: apt.bill_amount_paid
          };
        }
        return apt;
      });

      // If any appointments still have no bill_id, fetch recent bills and match by appointment_id or patient_id
      // Note: no end_date filter — DATETIME bill_date comparison with '2026-03-24' fails for bills after midnight
      const needsBillLookup = merged.some(apt => !apt.bill_id);
      if (needsBillLookup) {
        try {
          const billsRes = await api.get('/api/bills', {
            params: { start_date: todayStr, limit: 500 },
            timeout: 5000
          });
          const billsList = Array.isArray(billsRes?.data?.data?.bills)
            ? billsRes.data.data.bills
            : Array.isArray(billsRes?.data?.bills)
            ? billsRes.data.bills
            : [];

          if (billsList.length > 0) {
            // Index bills by appointment_id (primary) and patient_id (fallback)
            const billByApptId = new Map();
            const billByPatientId = new Map();
            billsList.forEach(b => {
              const bid = Number(b.appointment_id);
              if (b.appointment_id && !billByApptId.has(bid)) billByApptId.set(bid, b);
              const pid = Number(b.patient_id);
              // Keep the most recent bill per patient (list ordered bill_date DESC)
              if (b.patient_id && !billByPatientId.has(pid)) billByPatientId.set(pid, b);
            });

            merged = merged.map(apt => {
              if (apt.bill_id) return apt;
              // For walk-ins, apt.id is queue_id (not appointment_id) — use apt.appointment_id instead
              const apptIdForBill = apt.appointment_id != null ? Number(apt.appointment_id) :
                                    (apt.source !== 'walkin' ? Number(apt.id) : null);
              const bill = (apptIdForBill ? billByApptId.get(apptIdForBill) : null) || billByPatientId.get(Number(apt.patient_id));
              if (!bill) return apt;
              const billData = {
                bill_id: bill.id,
                bill_total: parseFloat(bill.total_amount) || 0,
                bill_payment_status: bill.payment_status,
                bill_amount_paid: parseFloat(bill.amount_paid) || 0
              };
              billCacheRef.current[apt.id] = billData;
              return { ...apt, ...billData };
            });
          }
        } catch (_e) {
          // Bills fetch failed silently
        }
      }

      setAppointments(merged);
      calculateStats(merged);

      // CACHE: Store bill-enriched results so tab switches don't lose bill data
      cacheRef.current = {
        data: merged,
        timestamp: Date.now(),
        paramsKey: normalizeCacheParams(cacheKeyParams),
        TTL: 30000
      };
      
      // Reset selection when appointments change
      setSelectedAppointments([]);
      setSelectAll(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load appointments');
    } finally {
      setLoading(false);
    }
  }, [api, user, getCachedData, normalizeCacheParams, calculateStats]);

  // Lightweight, INDEPENDENT fetch for the Upcoming/Others card totals.
  // Runs in parallel with (and never blocks/awaits) the main today-only queue
  // fetch, so it does not slow down the primary load. Counts are computed
  // client-side using the SAME predicate as calculateStats, so the card
  // definitions stay identical — only the data source for these two cards changes.
  const fetchCardCounts = useCallback(async () => {
    const today = getLocalDateString();
    const tomorrow = getLocalDateString(new Date(Date.now() + 86400000));
    const yesterday = getLocalDateString(new Date(Date.now() - 86400000));
    // OTHERS is limited to the last 7 days so very old, never-closed appointments
    // don't inflate the card. Mirrors the backend getDashboardStats window.
    const sevenDaysAgo = getLocalDateString(new Date(Date.now() - 7 * 86400000));

    // Resolve the doctor filter exactly like fetchAppointments does.
    const baseParams = {};
    if (isAdmin(user)) {
      const selectedDoctorId = getSelectedDoctorId();
      if (selectedDoctorId) baseParams.doctor_id = selectedDoctorId;
    } else if (user?.role === 'doctor' && user?.doctor_id) {
      baseParams.doctor_id = user.doctor_id;
    }

    // PRIMARY SOURCE OF TRUTH: a single dedicated backend endpoint that computes
    // all five card counts in SQL across BOTH appointments and queue (deduped
    // per patient/day). This avoids the fragile client-side dedup that had to
    // mirror fetchAppointments and kept drifting. If it succeeds we apply the
    // numbers and return; the legacy multi-fetch logic below remains only as a
    // best-effort fallback when the endpoint is unavailable.
    try {
      const statsRes = await api.get('/api/queue/dashboard-stats', {
        params: baseParams.doctor_id ? { doctor_id: baseParams.doctor_id } : undefined,
        headers: { 'Cache-Control': 'no-cache' },
        timeout: 8000,
      });
      const s = statsRes?.data?.data || statsRes?.data;
      if (s && typeof s === 'object' && (s.today != null || s.completed != null)) {
        const next = {
          today: Number(s.today) || 0,
          followups: Number(s.followups) || 0,
          completed: Number(s.completed) || 0,
          upcoming: Number(s.upcoming) || 0,
          others: Number(s.others) || 0,
        };
        cardCountsRef.current = next;
        setStats(prev => prev.map(card => (
          next[card.key] != null ? { ...card, count: next[card.key] } : card
        )));
        return;
      }
    } catch (_e) {
      // Endpoint unavailable → fall through to legacy client-side computation.
    }

    const normDay = (raw) => {
      if (!raw) return '';
      return getLocalDateString(raw instanceof Date ? raw : new Date(raw));
    };
    const extractList = (res) => {
      const d = res?.data?.data;
      if (Array.isArray(d?.data)) return d.data;
      if (Array.isArray(d?.appointments)) return d.appointments;
      if (Array.isArray(d)) return d;
      return [];
    };

    // Dedupe with the SHARED rule (utils/visitDedupe.js) — same as the list in
    // fetchAppointments and same as DoctorDashboard, so the card counts are
    // numerically consistent with what every view actually displays.
    const dedupeForCount = (list) => dedupeVisits(list, today);

    try {
      // Minimal payload (id,appointment_date,status,...) — counted client-side because
      // the API only supports a single status equality filter and cannot express
      // "not completed/cancelled" server-side. The `today` request additionally needs
      // patient_id/type fields so it can be deduped like the displayed list.
      const [upcomingRes, othersRes, todayRes, queueRes] = await Promise.all([
        api.get('/api/appointments', {
          params: { ...baseParams, start_date: tomorrow, fields: 'id,appointment_date,status', limit: 500, _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 8000,
        }).catch(() => null),
        api.get('/api/appointments', {
          params: { ...baseParams, start_date: sevenDaysAgo, end_date: yesterday, fields: 'id,appointment_date,status', limit: 500, _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 8000,
        }).catch(() => null),
        api.get('/api/appointments', {
          params: { ...baseParams, date: today, fields: 'id,patient_id,appointment_date,appointment_time,check_in_time,status,is_follow_up,reason_for_visit,appointment_type,arrival_type', limit: 500, _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 8000,
        }).catch(() => null),
        // Walk-ins (queue rows without an appointment) are part of today's count in
        // calculateStats, so fetch them here too to keep the cards in parity.
        api.get('/api/queue/today', {
          // limit=500: backend defaults to 50 rows — undercounts cards on busy days
          params: { limit: 500, ...(baseParams.doctor_id ? { doctor_id: baseParams.doctor_id } : {}) },
          headers: { 'Cache-Control': 'no-cache' },
          timeout: 8000,
        }).catch(() => null),
      ]);

      const upcomingList = extractList(upcomingRes);
      const othersList = extractList(othersRes);

      // Fold in today's walk-ins (queue entries with NO appointment_id) so the
      // today/completed/followups cards match what fetchAppointments displays.
      // Mirrors the walk-in handling + cancelled/no-show exclusion in fetchAppointments.
      const queuePayload = queueRes?.data?.data || queueRes?.data;
      const queueList = Array.isArray(queuePayload)
        ? queuePayload
        : (Array.isArray(queuePayload?.data) ? queuePayload.data : []);
      const walkInRows = queueList
        .filter(q => q && !q.appointment_id)
        .filter(q => !['cancelled', 'no-show'].includes(String(q?.status || '').toLowerCase()))
        .map(q => ({
          patient_id: q.patient_id,
          appointment_date: q.check_in_time ? getLocalDateString(new Date(q.check_in_time)) : today,
          check_in_time: q.check_in_time,
          status: q.status || 'waiting',
          is_follow_up: q.is_follow_up,
          reason_for_visit: q.reason_for_visit || 'Walk-in',
          appointment_type: q.appointment_type,
          arrival_type: q.arrival_type,
        }));

      const todayList = dedupeForCount([...extractList(todayRes), ...walkInRows]);

      // Upcoming: future dates, not completed/cancelled (same predicate as calculateStats)
      const upcoming = upcomingList.filter(apt => {
        const d = normDay(apt?.appointment_date);
        const s = apt?.status;
        return d > today && s !== 'completed' && s !== 'cancelled';
      }).length;

      // Others: RECENT past dates (last 7 days), not completed/cancelled/no-show.
      // Matches the backend getDashboardStats window so stale old appointments
      // don't inflate this card.
      const others = othersList.filter(apt => {
        const d = normDay(apt?.appointment_date);
        const s = apt?.status;
        return d < today && d >= sevenDaysAgo && s !== 'completed' && s !== 'cancelled' && s !== 'no-show';
      }).length;

      // Today / Follow ups / Completed — computed from a dedicated today-only fetch
      // (limit 500, deduped) using the SAME predicates as calculateStats, so these
      // cards stay accurate and stable regardless of which card filter is active.
      const todayCount = todayList.filter(apt => {
        const s = String(apt?.status || '').toLowerCase();
        return normDay(apt?.appointment_date) === today && s !== 'completed' && s !== 'cancelled' && s !== 'no-show';
      }).length;
      const followupsCount = todayList.filter(apt => {
        const isFollow = apt?.is_follow_up || apt?.reason_for_visit?.toLowerCase?.().includes('follow');
        const s = String(apt?.status || '').toLowerCase();
        return isFollow && s !== 'completed' && s !== 'cancelled' && s !== 'no-show';
      }).length;
      const completedCount = todayList.filter(apt => apt?.status === 'completed').length;

      cardCountsRef.current = {
        today: todayCount,
        followups: followupsCount,
        completed: completedCount,
        upcoming,
        others,
      };

      // Patch all five cards immediately from the dedicated stable counts.
      setStats(prev => prev.map(card => {
        switch (card.key) {
          case 'today': return { ...card, count: todayCount };
          case 'followups': return { ...card, count: followupsCount };
          case 'completed': return { ...card, count: completedCount };
          case 'upcoming': return { ...card, count: upcoming };
          case 'others': return { ...card, count: others };
          default: return card;
        }
      }));
    } catch (_e) {
      // Counts are best-effort; on failure keep whatever is already shown.
    }
  }, [api, user]);

  // NOTE: the old fetchQueueLiveStats (GET /api/queue/stats) is gone. The KPI
  // cards are now computed client-side (see queueKpis memo) from the exact
  // dataset the list renders, so the numbers can never disagree with the list.

  // Handle individual appointment selection
  const _handleSelectAppointment = (appointmentId) => {
    if (!appointmentId) {
      return;
    }
    
    setSelectedAppointments(prev => 
      prev.includes(appointmentId) 
        ? prev.filter(id => id !== appointmentId)
        : [...prev, appointmentId]
    );
  };

  // Handle select all appointments
  const _handleSelectAll = () => {
    if (selectAll) {
      setSelectedAppointments([]);
    } else {
      const validIds = filteredAppointments
        .map(apt => apt.id || apt.queue_id || apt.appointment_id)
        .filter(id => id);
      setSelectedAppointments(validIds);
    }
    setSelectAll(!selectAll);
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedAppointments.length === 0) {
      addToast('No patients selected', 'warning');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${selectedAppointments.length} patient(s) from the queue?`)) {
      return;
    }

    // Remove ONE selected row: cancel BOTH its queue entry and its linked
    // appointment (whichever exist) so neither side lingers in the DB. Uses
    // allSettled so a single failed delete never hides the others. A row counts
    // as removed if at least one delete succeeded, or every failure was a 404
    // (already gone).
    const removeOnePatient = async (id) => {
      if (!id) return { ok: false };
      const appointment = filteredAppointments.find(a =>
        a.id === id || a.queue_id === id || a.appointment_id === id
      );
      if (!appointment) return { ok: false, reason: 'Row not found' };

      const queueId = appointment.queue_id || (appointment.source === 'walkin' ? appointment.id : null);
      const appointmentId = appointment.appointment_id || (appointment.source !== 'walkin' ? appointment.id : null);

      const ops = [];
      if (queueId) ops.push(api.delete(`/api/queue/${queueId}`));
      if (appointmentId) ops.push(api.delete(`/api/appointments/${appointmentId}`));
      if (ops.length === 0) return { ok: false, reason: 'No ID found' };

      const results = await Promise.allSettled(ops);
      const anySuccess = results.some(r => r.status === 'fulfilled');
      const allGoneOrOk = results.every(r =>
        r.status === 'fulfilled' || r.reason?.response?.status === 404
      );
      if (anySuccess || allGoneOrOk) return { ok: true };
      const firstErr = results.find(r => r.status === 'rejected');
      return { ok: false, reason: firstErr?.reason?.response?.data?.error || 'Delete failed' };
    };

    try {
      const outcomes = await Promise.all(
        selectedAppointments.filter(Boolean).map(removeOnePatient)
      );
      const removed = outcomes.filter(o => o.ok).length;
      const failed = outcomes.length - removed;

      if (removed > 0) {
        addToast(
          failed > 0
            ? `Removed ${removed} patient(s); ${failed} failed`
            : `Successfully removed ${removed} patient(s) from queue`,
          failed > 0 ? 'warning' : 'success'
        );

        // Add a small delay before refreshing to ensure backend processes the deletion
        setTimeout(() => {
          invalidateCache(); // Clear cache after deletion
          fetchAppointments({}, true); // Force fresh fetch, skip cache
          fetchCardCounts(); // Refresh card totals so counts update immediately
        }, 500);
      } else {
        const firstReason = outcomes.find(o => !o.ok && o.reason)?.reason;
        addToast(firstReason ? `Failed to remove: ${firstReason}` : 'Failed to remove selected patient(s)', 'error');
      }

      setSelectedAppointments([]);
      setSelectAll(false);
    } catch (error) {
      addToast(`Failed to remove patients: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  // Update appointment status
  const updateAppointmentStatus = useCallback(async (appointmentId, newStatus, apt) => {
    // Determine the best ID to use
    const effectiveId = appointmentId || apt?.id || apt?.queue_id || apt?.appointment_id;

    // Guard against undefined appointment ID
    if (!effectiveId) {
      console.warn('Cannot update status: no valid ID found', apt);
      addToast('Cannot update status: Invalid appointment ID', 'error');
      return;
    }

    try {
      // Map appointment statuses to what the queue endpoint accepts:
      // - 'in-progress' → 'in_progress' (queue naming)
      // - 'scheduled'   → 'waiting'     (queue has no 'scheduled' state)
      const normalizedQueueStatus =
        newStatus === 'in-progress' ? 'in_progress'
        : newStatus === 'scheduled' ? 'waiting'
        : newStatus;

      // For walk-in patients or queue entries, update queue status
      const isWalkIn = apt?.source === 'walkin' || (apt?.queue_id && !apt?.appointment_id);

      if (isWalkIn) {
        const queueId = apt?.queue_id || effectiveId;
        await api.patch(`/api/queue/${queueId}/status`, { status: normalizedQueueStatus });
      } else {
        // Try appointment update first
        try {
          await api.patch(`/api/appointments/${effectiveId}/status`, { status: newStatus });
        } catch (appointmentError) {
          // If appointment update fails (404/400), try queue update as fallback
          if (appointmentError.response?.status === 404 || appointmentError.response?.status === 400) {
            const queueId = apt?.queue_id || effectiveId;
            await api.patch(`/api/queue/${queueId}/status`, { status: normalizedQueueStatus });
          } else {
            throw appointmentError;
          }
        }
      }

      setAppointments(prev => {
        const updated = prev.map(a =>
          (a.id === effectiveId || a.queue_id === effectiveId || a.appointment_id === effectiveId)
            ? { ...a, status: newStatus }
            : a
        );
        calculateStats(updated);
        return updated;
      });

      addToast(`Status updated to ${newStatus}`, 'success');

      // Refresh queue data AND both stat sources so the cards + KPI row
      // update immediately after a status change (e.g. "✓ Done").
      setTimeout(() => {
        invalidateCache(); // Clear cache after status change
        fetchAppointments({}, true); // Force fresh fetch, skip cache
        fetchCardCounts();
      }, 500);
    } catch (err) {
      console.error('Update status error:', err);
      addToast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  }, [api, addToast, calculateStats, fetchAppointments, invalidateCache, fetchCardCounts]);

  // Update payment status
  const _updatePaymentStatus = useCallback(async (appointmentId, newPaymentStatus) => {
    // Guard against undefined appointment ID
    if (!appointmentId) {
      console.warn('Cannot update payment status: appointment ID is undefined');
      addToast('Cannot update payment: No bill found. Please create a receipt first.', 'error');
      return;
    }

    try {
      // Prefer updating the bill directly if we have a bill_id for the appointment
      const apt = appointments.find(a => a.id === appointmentId) || {};
      if (apt.bill_id) {
        await api.patch(`/api/bills/${apt.bill_id}/status`, { payment_status: newPaymentStatus });
      } else {
        // Try to find latest bill for this patient from today
        let billId = null;
        const patientId = apt.patient_db_id || apt.patient_table_id || apt.patientId || apt.patient_id || null;
        if (patientId) {
          try {
            const billRes = await api.get('/api/bills', {
              params: { patient_id: patientId, limit: 1, sort: 'created_at_desc' }
            });
            const bills = billRes.data?.bills || billRes.data?.data?.bills || [];
            if (bills.length > 0) billId = bills[0].id;
          } catch (_) { /* ignore */ }
        }
        if (billId) {
          await api.patch(`/api/bills/${billId}/status`, { payment_status: newPaymentStatus });
        } else {
          // Use appointment endpoint only for real appointments (not walk-in queue entries)
          const realAppointmentId = apt.appointment_id || (apt.source !== 'walkin' ? appointmentId : null);
          if (realAppointmentId) {
            await api.patch(`/api/appointments/${realAppointmentId}/payment`, { payment_status: newPaymentStatus });
          } else {
            addToast('No receipt found for this patient. Please create a receipt first.', 'error');
            return;
          }
        }
      }

      // Update local state with complete payment info from response
      setAppointments(prev =>
        prev.map(a => {
          if (a.id === appointmentId) {
            // If payment_status is 'paid', ensure amount_paid equals total_amount
            const updatedApt = { ...a, payment_status: newPaymentStatus };
            if (newPaymentStatus === 'paid' && a.bill_total) {
              updatedApt.amount_paid = a.bill_total;
              updatedApt.amount_due = 0;
            }
            return updatedApt;
          }
          return a;
        })
      );

      addToast(`Payment status updated to ${newPaymentStatus}`, 'success');
      
      // Refresh queue data to reflect changes in database
      setTimeout(() => {
        invalidateCache(); // Clear cache after payment change
        fetchAppointments({}, true); // Force fresh fetch, skip cache
        addToast('Queue refreshed', 'info');
      }, 500); // Reduced delay for faster refresh
    } catch (err) {
      console.error('Update payment status error:', err);
      if (err.response?.data?.code === 'NO_BILL_FOUND' || err.response?.data?.error === 'Appointment not found') {
        addToast('No receipt found for this patient. Please create a receipt first.', 'error');
      } else {
        addToast(err.response?.data?.error || 'Failed to update payment status', 'error');
      }
    }
  }, [api, addToast, appointments, fetchAppointments, invalidateCache]);

  // Mark a visit completed (appointment + queue) then switch the view to Completed.
  // NOTE: Defined BEFORE handleSaveBillDirect/handleQuickPayToggle because those
  // useCallbacks list it in their dependency arrays. As block-scoped `const`s,
  // referencing it before initialization (temporal dead zone) throws
  // "Cannot access 'completeVisitAndShowCompleted' before initialization" at
  // render time, crashing the whole Queue page into the error boundary.
  const completeVisitAndShowCompleted = useCallback(async (aptLike) => {
    const appointmentId = aptLike?.appointment_id || (aptLike?.source !== 'walkin' ? aptLike?.id : null) || null;
    const queueId = aptLike?.queue_id || (aptLike?.source === 'walkin' ? aptLike?.id : null) || null;

    if (appointmentId) {
      try {
        await api.patch(`/api/appointments/${appointmentId}/status`, { status: 'completed' });
      } catch (e) {
        // 404 = row already gone; not an error worth logging.
        if (e?.response?.status !== 404) console.error('Failed to mark appointment completed:', e);
      }
    }
    if (queueId) {
      try {
        await api.patch(`/api/queue/${queueId}/status`, { status: 'completed' });
      } catch (e) {
        // 404 = row already gone; not an error worth logging.
        if (e?.response?.status !== 404) console.error('Failed to mark queue completed:', e);
      }
    }

    const todayStr = getLocalDateString();
    setCompletedRange('today');
    // Switch to the Completed KPI view. Fetch the FULL day (not just completed
    // rows) so all four KPI cards keep correct counts after the completion.
    setFilters(prev => ({ ...prev, kpi: 'completed', status: '', dateRange: '', paymentStatus: '', isFollowUp: false, others: false }));
    setCompletedMenuOpen(false);
    setPage(1);
    invalidateCache();
    await fetchAppointments({ start_date: todayStr, end_date: todayStr }, true);
    fetchCardCounts(); // Refresh card totals so Completed/Today counts update immediately
  }, [api, invalidateCache, fetchAppointments, fetchCardCounts]);

  // Create bill directly from Queue (no navigation)
  const handleSaveBillDirect = useCallback(async () => {
    if (!createBillPatient) return;
    const { total } = billCalcTotals();
    const patientId = createBillPatient.patient_db_id || createBillPatient.patient_table_id || createBillPatient.patient_id || createBillPatient.patientId;
    if (!patientId) { addToast('Patient ID not found', 'error'); return; }
    if (!billFormData.services.some(s => s.service_name.trim())) { addToast('Add at least one service', 'error'); return; }
    setBillCreating(true);
    try {
      const amtPaid = parseFloat(billFormData.amount_paid) || 0;
      // Every bill-creation call site in the app was omitting doctor_id
      // entirely, so 100% of bills in the DB ended up with doctor_id = NULL —
      // which silently zeroed out the doctor-scoped Paid KPI no matter how
      // correctly that query was written. Resolve it the same way the rest
      // of this file resolves it for reads (admin's selected doctor, or the
      // logged-in doctor/staff's own doctor_id).
      const billDoctorId = isAdmin(user) ? getSelectedDoctorId() : (user?.doctor_id || null);
      // Derive status from the amount actually being saved rather than
      // trusting the dropdown's last-selected value: picking "Paid" only
      // pre-fills Amount Paid once (onChange), so editing that field
      // afterwards (or editing an existing bill) left payment_status='paid'
      // saved alongside amount_paid=0 — a bill marked Paid with nothing
      // collected. The dropdown options are only pending/paid/partial, all
      // three fully determined by amount vs total, so this is safe to derive.
      const derivedStatus = amtPaid >= total && total > 0 ? 'paid' : amtPaid > 0 ? 'partial' : 'pending';
      const payload = {
        patient_id: patientId,
        doctor_id: billDoctorId,
        appointment_id: createBillPatient.source !== 'walkin' ? createBillPatient.id : null,
        total_amount: parseFloat(total.toFixed(2)),
        amount_paid: amtPaid,
        balance_due: Math.max(0, total - amtPaid),
        payment_status: derivedStatus,
        payment_method: billFormData.payment_method || 'cash',
        tax_percent: parseFloat(billFormData.tax) || 0,
        discount: parseFloat(billFormData.discount) || 0,
        bill_date: getLocalDateString(),
        service_items: billFormData.services.filter(s => s.service_name.trim()).map(s => ({
          service_name: s.service_name,
          qty: parseFloat(s.qty) || 1,
          unit_price: parseFloat(s.unit_price) || 0,
          discount_amount: parseFloat(s.discount) || 0,
          total_price: parseFloat(s.total) || 0
        }))
      };
      let billId = editingBillId;
      let finalStatus = payload.payment_status;
      if (editingBillId) {
        await api.put(`/api/bills/${editingBillId}`, payload);
        billId = editingBillId;
      } else {
        const res = await api.post('/api/bills', payload);
        billId = res.data?.bill_id || res.data?.bill?.id || res.data?.data?.id;
      }
      // Persist to bill cache so it survives tab switches
      billCacheRef.current[createBillPatient.id] = {
        bill_id: billId, bill_total: total, bill_payment_status: finalStatus, bill_amount_paid: amtPaid
      };
      setAppointments(prev => prev.map(a =>
        a.id === createBillPatient.id
          ? { ...a, bill_id: billId, bill_total: total, bill_payment_status: finalStatus, payment_status: finalStatus, bill_amount_paid: amtPaid }
          : a
      ));

      // NOTE (2026-07-16): bill save is OPTIONAL and never completes a visit.
      // The visit is completed by the prescription-send flow itself (or the
      // "✓ Done" status action) — see the pendingVisitCompletion effect below.
      addToast(editingBillId ? 'Bill updated successfully!' : `Bill of ₹${total.toFixed(2)} created!`, 'success');

      setShowCreateBillModal(false);
      setCreateBillPatient(null);
      setEditingBillId(null);
      setBillFormData({ services: [{ service_name: 'Consultation', qty: 1, unit_price: 500, discount: 0, total: 500 }], tax: 0, discount: 0, payment_method: 'cash', payment_status: 'pending', amount_paid: '' });
    } catch (err) {
      addToast(err.response?.data?.error || (editingBillId ? 'Failed to update bill' : 'Failed to create bill'), 'error');
    } finally {
      setBillCreating(false);
    }
  }, [api, addToast, createBillPatient, billFormData, billCalcTotals, editingBillId, user]);

  // Quick pay toggle from badge on card (amountPaid optional — for partial)
  const handleQuickPayToggle = useCallback(async (apt, newStatus, amountPaid) => {
    setBillPayLoading(apt.id);
    const billTotal = parseFloat(apt.bill_total || apt.total_amount || 0);
    const resolvedAmtPaid = newStatus === 'paid'
      ? billTotal
      : newStatus === 'partial'
      ? (parseFloat(amountPaid) || 0)
      : 0;
    try {
      let billId = apt.bill_id;
      if (!billId) {
        const patientId = apt.patient_db_id || apt.patient_table_id || apt.patient_id;
        if (!patientId) throw new Error('No patient ID');
        const billRes = await api.get('/api/bills', { params: { patient_id: patientId, limit: 1, sort: 'created_at_desc' } });
        const payload = billRes.data?.data || billRes.data;
        const bills = payload?.bills || payload?.data || [];
        if (!bills.length) throw new Error('no_bill');
        billId = bills[0].id;
        setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, bill_id: billId } : a));
      }
      const patchRes = await api.patch(`/api/bills/${billId}/status`, {
        payment_status: newStatus,
        amount_paid: resolvedAmtPaid,
        balance_due: Math.max(0, billTotal - resolvedAmtPaid)
      });
      // The backend auto-corrects the status from the amount (e.g. "Partial"
      // with the FULL amount becomes 'paid'; ₹0 becomes 'pending'). Use ITS
      // final status so the badge never disagrees with the DB until refresh.
      const finalStatus = patchRes?.data?.payment_status || newStatus;
      setBillPartialInput(prev => { const n = { ...prev }; delete n[apt.id]; return n; });
      // Update bill cache so payment status survives tab switches
      const existing = billCacheRef.current[apt.id] || {};
      billCacheRef.current[apt.id] = {
        ...existing,
        bill_id: billId,
        bill_payment_status: finalStatus,
        bill_amount_paid: resolvedAmtPaid
      };
      setAppointments(prev => prev.map(a =>
        a.id === apt.id
          ? { ...a, bill_payment_status: finalStatus, payment_status: finalStatus, bill_amount_paid: resolvedAmtPaid }
          : a
      ));

      // PAYMENT NO LONGER COMPLETES THE VISIT (per clinic workflow, 2026-07-15).
      // Marking Paid/Partial only updates the bill badge; the patient STAYS in
      // the Active Queue. A visit is completed ONLY by: (1) the Rx→bill-save
      // flow, (2) the status dropdown "✓ Done", or (3) an explicit status
      // update from any dashboard.
      addToast(
        finalStatus === 'paid'
          ? 'Payment marked as Paid.'
          : finalStatus === 'partial'
          ? `Partial payment saved (₹${resolvedAmtPaid.toFixed(0)}).`
          : 'Payment set to Pending',
        'success'
      );
      invalidateCache();
    } catch (err) {
      if (err.message === 'no_bill') addToast('No bill found. Create a bill first.', 'error');
      else addToast(err.response?.data?.error || 'Failed to update payment', 'error');
    } finally {
      setBillPayLoading(null);
    }
  }, [api, addToast, invalidateCache]);

  // Navigate to patient overview - FIXED to use patient_db_id
  const handleVisitPatient = useCallback((apt) => {
    // Prefer DB primary key id for navigation; fall back to available keys
    let patientDbId = apt.patient_db_id || apt.patient_table_id || apt.patientId || apt.patient_id || null;
    const uhid = apt.uhid || apt.patient_code || apt.patient_uhid || apt.patient_identifier;

    // Normalize to string for storage + navigation
    if (patientDbId && typeof patientDbId !== 'string') {
      patientDbId = String(patientDbId);
    }

    // If still missing, notify but avoid throwing; keep user in context
    if (!patientDbId) {
      addToast('Patient ID missing in appointment. Trying UHID link instead.', 'error');
      console.warn('Missing patient_db_id in appointment; keys:', {
        id: apt?.id,
        patient_db_id: apt?.patient_db_id,
        patient_table_id: apt?.patient_table_id,
        patientId: apt?.patientId,
        patient_id: apt?.patient_id,
        uhid: apt?.uhid
      });
      return;
    }

    // Store appointment context for prescription and other pages
    const appointmentContext = {
      // For walk-ins (source='walkin'), apt.id is the queue_id — don't use as appointment ID
      appointmentId: apt.source === 'walkin' ? null : apt.id,
      queueId: apt.queue_id || (apt.source === 'walkin' ? apt.id : null),
      source: apt.source || 'appointment',
      patientId: patientDbId,
      patientName: apt.patient_name,
      uhid: uhid,
      visitReason: apt.reason_for_visit,
      appointmentDate: apt.appointment_date,
      appointmentTime: apt.appointment_time,
      doctorId: apt.doctor_id,
      doctorName: apt.doctor_name,
      clinicId: apt.clinic_id,
      clinicName: apt.clinic_name,
      status: apt.status
    };

    sessionStorage.setItem('currentAppointment', JSON.stringify(appointmentContext));
    sessionStorage.setItem('selectedPatientId', patientDbId);

    // Navigate to patient overview
    navigate(`/patient-overview/${patientDbId}`);
  }, [navigate, addToast]);

  // Helper function to format date in Indian format
  const formatIndianDate = (dateString) => {
    if (!dateString) return 'TBD';

    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${dayName}, ${day} ${month} ${year}`;
  };

  // Helper function to format time in 12-hour format
  const formatIndianTime = (timeString) => {
    if (!timeString) return 'TBD';

    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Handle WhatsApp click
  const _handleWhatsApp = useCallback((apt) => {
    const phone = apt.contact || apt.phone || apt.patient_phone;

    if (!phone) {
      addToast('Patient phone number not available', 'error');
      return;
    }

    const formattedDate = formatIndianDate(apt.appointment_date);
    const formattedTime = formatIndianTime(apt.appointment_time);

    const message = `Hello ${apt.patient_name},

Your appointment is confirmed.

📅 Date: ${formattedDate}
⏰ Time: ${formattedTime}
${apt.doctor_name ? `👨‍⚕️ Doctor: ${apt.doctor_name}` : ''}
${apt.clinic_name ? `🏥 Clinic: ${apt.clinic_name}` : ''}

Thank you!`;

    openWhatsApp(phone, message);
  }, [addToast]);

  // Send prescription via WhatsApp
  const handleSendRxWhatsApp = useCallback(async (apt) => {
    const phone = apt.contact || apt.phone || apt.patient_phone;
    if (!phone) {
      addToast('Patient phone number not available', 'error');
      return;
    }

    const pid = resolvePatientDbId(apt);
    if (!pid) return;

    const whatsAppWindow = window.open('', '_blank');
    if (!whatsAppWindow) {
      addToast('Allow pop-ups to open WhatsApp', 'error');
      return;
    }
    whatsAppWindow.opener = null;

    try {
      const cachedRxId = rxCacheRef.current?.[String(pid)];
      let rx = cachedRxId ? { id: cachedRxId } : null;
      if (!rx) {
        const res = await api.get(`/api/prescriptions/patient/${pid}/latest-id`, { timeout: 5000 });
        const rxId = res?.data?.data?.id || res?.data?.id || null;
        if (rxId) {
          rx = { id: rxId };
          rxCacheRef.current[String(pid)] = rxId;
        }
      }

      if (rx) {
        const pdfUrl = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${encodeURIComponent(rx.id)}?with_letterhead=1`;
        const message = `Hello ${apt.patient_name},

📋 Your prescription has been attached.

👨‍⚕️ Doctor: ${rx.doctor_name || apt.doctor_name || 'N/A'}
📅 Date: ${formatIndianDate(rx.created_at || apt.appointment_date)}

Please follow the medications as prescribed. If you have any questions, please contact us.

Best regards,
${apt.clinic_name || 'Our Clinic'}

Prescription Link: ${pdfUrl}`;
        const cleanPhone = String(phone).replace(/\D/g, '');
        const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        whatsAppWindow.location.href = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
      } else {
        whatsAppWindow.close();
        addToast('No prescription found for this patient', 'info');
      }
    } catch (error) {
      whatsAppWindow.close();
      addToast('Failed to send prescription', 'error');
      console.error(error);
    }
  }, [addToast, api, resolvePatientDbId]);

  const openLatestRxPdf = useCallback(async (apt) => {
    const pid = resolvePatientDbId(apt);
    if (!pid) return;

    // Open immediately to avoid popup blocking and show instant feedback
    const w = window.open('about:blank', '_blank');
    if (w) {
      try {
        w.document.title = 'Loading Prescription...';
        w.document.body.innerHTML = '<p style="font-family:system-ui;padding:16px">Loading prescription…</p>';
      } catch { /* ignore */ }
    }

    try {
      const cachedRxId = rxCacheRef.current?.[String(pid)];
      if (cachedRxId) {
        const url = `/api/pdf/prescription/${cachedRxId}?with_letterhead=1`;
        if (w) w.location.href = url;
        else window.open(url, '_blank');
        return;
      }

      const res = await api.get(`/api/prescriptions/patient/${pid}/latest-id`, { timeout: 5000 });
      const rxId = res?.data?.data?.id || res?.data?.id || null;
      if (!rxId) {
        if (w) w.close();
        addToast('No prescription found', 'info');
        return;
      }
      rxCacheRef.current[String(pid)] = rxId;
      const url = `/api/pdf/prescription/${rxId}?with_letterhead=1`;
      if (w) w.location.href = url;
      else window.open(url, '_blank');
    } catch (_e) {
      if (w) w.close();
      addToast('Failed to find prescription', 'error');
    }
  }, [api, addToast, resolvePatientDbId]);

  const ensureLatestBillId = useCallback(async (apt) => {
    const pid = resolvePatientDbId(apt);
    if (!pid) return null;

    const direct = apt?.bill_id || apt?.billId || null;
    if (direct) return direct;

    // If we already cached bill id for this appointment card, use it.
    const cached = billCacheRef.current?.[apt?.id];
    if (cached?.bill_id) {
      // Hydrate state so UI doesn't keep offering "Create Bill"
      setAppointments((prev) => prev.map((a) => (a.id === apt.id ? { ...a, bill_id: cached.bill_id } : a)));
      return cached.bill_id;
    }

    try {
      // Scope the lookup to THIS visit — not just "any bill this patient ever
      // had" — otherwise a patient with an older, unrelated bill gets that old
      // bill re-opened in edit mode and new charges silently merge into it
      // instead of a fresh bill being created for today's visit.
      const isWalkin = apt?.source === 'walkin';
      const apptId = !isWalkin ? (apt?.appointment_id || apt?.id) : null;
      const scopedParams = apptId
        ? { patient_id: pid, appointment_id: apptId, limit: 1, sort: 'created_at_desc' }
        : { patient_id: pid, start_date: getLocalDateString(), end_date: getLocalDateString(), limit: 1, sort: 'created_at_desc' };

      const billRes = await api.get('/api/bills', {
        params: scopedParams,
        timeout: 6000,
      });
      const payload = billRes.data?.data || billRes.data;
      const bills = payload?.bills || payload?.data || [];
      const latest = Array.isArray(bills) && bills.length > 0 ? bills[0] : null;
      if (!latest?.id) return null;

      // Save in cache + hydrate state
      billCacheRef.current[apt.id] = {
        ...(billCacheRef.current[apt.id] || {}),
        bill_id: latest.id,
        bill_total: parseFloat(latest.total_amount || 0) || undefined,
        bill_payment_status: latest.payment_status || undefined,
        bill_amount_paid: parseFloat(latest.amount_paid || 0) || undefined,
      };

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === apt.id
            ? {
                ...a,
                bill_id: latest.id,
                bill_total: a.bill_total ?? latest.total_amount,
                bill_payment_status: a.bill_payment_status ?? latest.payment_status,
                bill_amount_paid: a.bill_amount_paid ?? latest.amount_paid,
              }
            : a
        )
      );

      return latest.id;
    } catch (_e) {
      return null;
    }
  }, [api, resolvePatientDbId]);

  const openBillEditorForAppointment = useCallback(async (apt, billIdOverride = null) => {
    const billId = billIdOverride || await ensureLatestBillId(apt);
    if (billId) {
      const detail = await api.get(`/api/bills/${billId}`, { timeout: 8000 });
      const fullBill = detail?.data?.data || detail?.data?.bill || detail?.data || {};
      const items = Array.isArray(fullBill.service_items) ? fullBill.service_items : [];
      setEditingBillId(billId);
      setCreateBillPatient(apt);
      setBillFormData({
        services: (items.length ? items : [{ service_name: 'Consultation', qty: 1, unit_price: apt.consultation_fee || 500, discount: 0, total: apt.consultation_fee || 500 }]).map(it => ({
          service_name: it.service_name || it.name || '',
          qty: parseFloat(it.qty ?? it.quantity ?? 1) || 1,
          unit_price: parseFloat(it.unit_price ?? it.rate ?? 0) || 0,
          discount: parseFloat(it.discount_amount ?? it.discount ?? 0) || 0,
          total: parseFloat(it.total_price ?? it.total ?? 0) || 0
        })),
        tax: parseFloat(fullBill.tax_percent ?? fullBill.tax ?? 0) || 0,
        discount: parseFloat(fullBill.discount ?? 0) || 0,
        payment_method: fullBill.payment_method || 'cash',
        payment_status: fullBill.payment_status || 'pending',
        amount_paid: fullBill.amount_paid != null ? String(fullBill.amount_paid) : ''
      });
      setShowCreateBillModal(true);
      return billId;
    }

    // No existing bill yet: open create mode for this visit.
    setEditingBillId(null);
    setCreateBillPatient(apt);
    setBillFormData({
      services: [{ service_name: 'Consultation', qty: 1, unit_price: apt.consultation_fee || 500, discount: 0, total: apt.consultation_fee || 500 }],
      tax: 0,
      discount: 0,
      payment_method: 'cash',
      payment_status: 'pending',
      amount_paid: ''
    });
    setShowCreateBillModal(true);
    return null;
  }, [api, ensureLatestBillId]);

  // Quick walk-in check-in
  const _handleQuickCheckIn = useCallback(async () => {
    if (!quickName || !quickPhone) {
      addToast('Please enter name and phone', 'error');
      return;
    }

    setCheckInLoadingId(true);
    try {
      let patientId = null;
      
      // 1) First search for existing patient by phone number
      try {
        const searchRes = await api.get(`/api/patients?search=${quickPhone}&limit=1`);
        const existingPatients = searchRes.data?.data?.patients || [];
        
        if (existingPatients.length > 0) {
          patientId = existingPatients[0].id;
        }
      } catch (searchError) {
        // Patient search failed, will create new patient
      }

      // 2) If patient not found, create new patient
      if (!patientId) {
        const createPayload = {
          name: quickName,
          phone: quickPhone,
          abha_number: quickAbha || null,
          gender: 'M', // Default gender
          clinic_id: 2
        };
        const createRes = await api.post('/api/patients', createPayload);
        patientId = createRes?.data?.id || createRes?.data?.patient?.id;

        if (!patientId) {
          throw new Error('Patient creation failed: missing ID');
        }
      }

      // 3) Add patient to queue
      await api.post('/api/queue', {
        patient_id: patientId,
        doctor_id: user?.doctor_id || 2,
        clinic_id: user?.clinic_id || 2,
      });

      addToast('Checked in successfully', 'success');
      setQuickName('');
      setQuickPhone('');
      setQuickAbha('');
      invalidateCache(); // Clear cache after check-in
      fetchAppointments({}, true); // Force fresh fetch, skip cache
      fetchCardCounts(); // Refresh card totals (Today/etc.) so counts update immediately
    } catch (err) {
      console.error('Quick check-in error:', err);
      const details = err.response?.data?.details;
      const msg =
        err.response?.data?.error ||
        (Array.isArray(details) && details.length ? details[0] : null) ||
        err.message ||
        'Failed to check-in';
      addToast(msg, 'error');
    } finally {
      setCheckInLoadingId(false);
    }
  }, [quickName, quickPhone, quickAbha, api, addToast, fetchAppointments, fetchCardCounts, user, invalidateCache]);

  // Handle search result click - directly add to queue
  const handleSearchResultClick = useCallback(async (patient) => {
    setQuickSearchLoading(true);
    try {
      // Add patient directly to queue
      await api.post('/api/queue', {
        patient_id: patient.id,
        doctor_id: user?.doctor_id || 2,
        clinic_id: user?.clinic_id || 2,
      });

      addToast(`${patient.name} added to queue!`, 'success');
      setQuickName('');
      setQuickPhone('');
      setQuickSearchResults([]);
      invalidateCache(); // Clear cache after adding to queue
      fetchAppointments({}, true); // Refresh queue, skip cache
      fetchCardCounts(); // Refresh card totals (Today/etc.) so counts update immediately
    } catch (error) {
      console.error('Queue addition error:', error);
      const details = error.response?.data?.details;
      const msg =
        error.response?.data?.error ||
        (Array.isArray(details) && details.length ? details[0] : null) ||
        error.message ||
        'Failed to add to queue';
      addToast(msg, 'error');
    } finally {
      setQuickSearchLoading(false);
    }
  }, [api, addToast, user, fetchAppointments, fetchCardCounts, invalidateCache]);

  // Real-time patient search for Quick Check-in
  const handleQuickSearch = useCallback(async (searchTerm, _searchType) => {
    if (!searchTerm || searchTerm.length < 2) {
      setQuickSearchResults([]);
      return;
    }

    setQuickSearchLoading(true);
    try {
      const searchRes = await api.get(`/api/patients?search=${searchTerm}&limit=5`);
      const responseData = searchRes.data?.data || {};
      const patients = responseData.data || responseData.patients || [];
      setQuickSearchResults(patients);
    } catch (error) {
      setQuickSearchResults([]);
    } finally {
      setQuickSearchLoading(false);
    }
  }, [api]);

  // Handle input changes for real-time search
  const _handleQuickNameChange = useCallback((e) => {
    const name = e.target.value;
    setQuickName(name);
    handleQuickSearch(name, 'name');
  }, [handleQuickSearch]);

  const _handleQuickPhoneChange = useCallback((e) => {
    const phone = e.target.value;
    setQuickPhone(phone);
    handleQuickSearch(phone, 'phone');
  }, [handleQuickSearch]);

  // Check-in for an existing appointment
  const _checkInForAppointment = useCallback(async (apt) => {
    if (!apt || !apt.id) return;
    setCheckInLoadingId(apt.id);
    try {
      const candidateId = apt.patient_db_id || apt.patient_table_id || apt.patientId || apt.patient_id || null;
      const patientId = typeof candidateId === 'string' ? parseInt(candidateId, 10) : candidateId;
      if (!patientId || Number.isNaN(patientId)) {
        throw new Error('Patient ID not found for check-in');
      }
      await api.post('/api/queue', { appointment_id: apt.id, patient_id: patientId });
      addToast('Appointment checked in', 'success');
      invalidateCache(); // Clear cache after check-in
      fetchAppointments({}, true); // Force fresh fetch, skip cache
      fetchCardCounts(); // Refresh card totals (Today/etc.) so counts update immediately
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to check-in';
      addToast(msg, 'error');
    } finally {
      setCheckInLoadingId(null);
    }
  }, [api, addToast, fetchAppointments, fetchCardCounts, invalidateCache]);

  // Day the KPI cards describe: a picked past date (history/pending picker),
  // else today.
  const activeKpiDay = historyDate || pendingDate || getLocalDateString();

  // KPI card numbers — computed from the SAME `appointments` dataset the list
  // renders, with the SAME predicates the kpi filter branch below applies.
  // Clicking a card therefore always shows exactly `count` rows.
  const queueKpis = useMemo(() => {
    const rows = Array.isArray(appointments) ? appointments : [];
    const counts = { total: 0, pending: 0, completed: 0, paid: 0 };
    rows.forEach((apt) => {
      if (kpiPredicates.total(apt, activeKpiDay)) counts.total++;
      if (kpiPredicates.pending(apt, activeKpiDay)) counts.pending++;
      if (kpiPredicates.completed(apt, activeKpiDay)) counts.completed++;
      if (kpiPredicates.paid(apt, activeKpiDay)) counts.paid++;
    });
    return counts;
  }, [appointments, activeKpiDay]);

  // Apply filters and search
  // OPTIMIZED: Memoize filtered results to prevent recalculation on every render
  const filteredAppointmentsData = useMemo(() => {
    let filtered = Array.isArray(appointments) ? [...appointments] : [];

    // Default filter: show today's appointments + yesterday's remaining (not completed) + today's offline
    const today = getLocalDateString();
    const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

    // Effective visit day for completed-status filtering: prefer the completion
    // day (completed_at) or check-in day (check_in_time) when present, else fall
    // back to appointment_date. This keeps visits completed today but scheduled
    // on an earlier date in the "Today" completed view, matching the card count.
    const effectiveVisitDay = (apt) => {
      const raw = apt?.completed_at || apt?.check_in_time || apt?.appointment_date;
      if (!raw) return '';
      // completed_at/check_in_time are UTC timestamps — slicing the raw ISO
      // string gives the UTC calendar date, not the local (IST) one, which
      // is wrong for ~5.5 hours every night. Route through a real Date and
      // getLocalDateString() so this always matches the local calendar day
      // (same bug class as the check-in-not-showing-in-queue fix).
      return getLocalDateString(raw instanceof Date ? raw : new Date(raw));
    };

    // KPI card view: filter with the exact predicate that produced the card's
    // count (see queueKpis memo) — guarantees list length === card number.
    if (filters?.kpi && kpiPredicates[filters.kpi]) {
      const kpiDay = historyDate || pendingDate || today;
      filtered = filtered.filter(apt => kpiPredicates[filters.kpi](apt, kpiDay));
    }
    // If month/year filter is set, apply that instead of default date filter
    else if (filters?.month && filters?.year) {
      const filterMonth = parseInt(filters.month);
      const filterYear = parseInt(filters.year);
      filtered = filtered.filter(apt => {
        const aptDate = apt?.appointment_date ? new Date(apt.appointment_date) : null;
        return aptDate && aptDate.getMonth() + 1 === filterMonth && aptDate.getFullYear() === filterYear;
      });
    }
    // Others view: past PENDING appointments (last 7 days, before today, not
    // completed/cancelled/no-show). Matches the Others card's count window so
    // the list shown when the card is clicked equals the card number.
    else if (filters?.others) {
      const sevenDaysAgo = getLocalDateString(new Date(Date.now() - 7 * 86400000));
      filtered = filtered.filter(apt => {
        const rawDate = apt?.appointment_date;
        const aptDate = rawDate ? getLocalDateString(rawDate instanceof Date ? rawDate : new Date(rawDate)) : '';
        const status = String(apt?.status || '').toLowerCase();
        return aptDate < today && aptDate >= sevenDaysAgo
          && status !== 'completed' && status !== 'cancelled' && status !== 'no-show';
      });
    }
    // Only apply default date filter if no specific date range, month/year, or status filter is set
    else if (!filters?.dateRange && !filters?.status) {
      filtered = filtered.filter(apt => {
        const rawDate = apt?.appointment_date;
        const aptDate = rawDate ? getLocalDateString(rawDate instanceof Date ? rawDate : new Date(rawDate)) : '';
        const status = apt?.status?.toLowerCase();

        // Today's appointments: include completed too so the list can show
        // remaining on top and a "Completed" section at the bottom (the render
        // layer splits them with a divider). Cancelled/no-show stay hidden.
        if (aptDate === today && status !== 'cancelled' && status !== 'no-show') return true;

        // Yesterday's remaining (not completed/cancelled)
        if (aptDate === yesterday && status !== 'completed' && status !== 'cancelled') return true;

        return false;
      });
    }
    // When status filter is "completed", show today's completed by default.
    // Use the EFFECTIVE visit day (completion/check-in day if present, else
    // appointment_date) so visits completed today but scheduled on an earlier
    // date are still shown — matching the Completed card count.
    // Skipped when historyDate is set ("View completed patients on <date>")
    // — that picker already fetched the right day server-side; hardcoding
    // "today" here on top of it was silently zeroing out every other date.
    else if (filters?.status === 'completed' && !filters?.dateRange && !filters?.month && !historyDate) {
      filtered = filtered.filter(apt => {
        const status = String(apt?.status || '').toLowerCase();
        return effectiveVisitDay(apt) === today && status === 'completed';
      });
    }

    // OPTIMIZED Search filter - pre-cache search term (uses debounced search for 300ms delay)
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase().trim();
      filtered = filtered.filter(apt => {
        return apt?.patient_name?.toLowerCase?.().includes(searchLower) ||
               String(apt?.patient_id || '').toLowerCase().includes(searchLower) ||
               apt?.uhid?.toLowerCase?.().includes(searchLower) ||
               apt?.contact?.includes(debouncedSearch) ||
               apt?.phone?.includes(debouncedSearch) ||
               apt?.reason_for_visit?.toLowerCase?.().includes(searchLower) ||
               apt?.doctor_name?.toLowerCase?.().includes(searchLower) ||
               apt?.name?.toLowerCase?.().includes(searchLower) ||
               apt?.chief_complaint?.toLowerCase?.().includes(searchLower) ||
               apt?.email?.toLowerCase?.().includes(searchLower);
      });
    }

    // Date range filter
    if (filters?.dateRange) {
      if (filters.dateRange.includes(' to ')) {
        const [startDate, endDate] = filters.dateRange.split(' to ');
        if (startDate && endDate) {
          filtered = filtered.filter(apt => {
            const aptDate = apt?.appointment_date;
            const aptDateStr = aptDate ? getLocalDateString(aptDate instanceof Date ? aptDate : new Date(aptDate)) : '';
            return aptDateStr >= startDate && aptDateStr <= endDate;
          });
        }
      } else {
        // Single-date filter. When the selected date is TODAY, mirror the Today
        // summary card's population (appointments ∪ queue for today, excluding
        // cancelled/no-show) so the visible count equals the card count. The card
        // counts in-queue/walk-in rows whose stored appointment_date may not be
        // literally today (e.g. checked-in-earlier completed rows), so keep any
        // in_queue row in addition to exact date matches for the today view.
        const isToday = filters.dateRange === today;
        filtered = filtered.filter(apt => {
          const rawDate = apt?.appointment_date;
          const aptDateStr = rawDate ? getLocalDateString(rawDate instanceof Date ? rawDate : new Date(rawDate)) : '';
          if (aptDateStr === filters.dateRange) return true;
          if (isToday && apt?.in_queue) {
            const status = String(apt?.status || '').toLowerCase();
            return status !== 'cancelled' && status !== 'no-show';
          }
          return false;
        });
      }
    }

    // Visit type filter
    if (filters?.visitType) {
      filtered = filtered.filter(apt =>
        apt?.reason_for_visit?.toLowerCase?.().includes(filters.visitType.toLowerCase?.())
      );
    }

    // Tags filter
    if (filters?.tags) {
      filtered = filtered.filter(apt =>
        apt?.tags?.toLowerCase?.().includes(filters.tags.toLowerCase?.())
      );
    }

    // Payment status filter — restrict to the active picked date (if any) so
    // the Paid KPI card's click-through doesn't silently jump back to today.
    if (filters?.paymentStatus) {
      filtered = filtered.filter(apt => apt?.payment_status === filters.paymentStatus);
      const activeDateForPaid = historyDate || pendingDate;
      if (activeDateForPaid) {
        filtered = filtered.filter(apt => effectiveVisitDay(apt) === activeDateForPaid);
      }
    }

    // Status filter. 'pending' is a synthetic value (not a real status) that
    // means "checked in but not yet completed" — waiting or in_progress.
    if (filters?.status === 'pending') {
      filtered = filtered.filter(apt => {
        const status = String(apt?.status || '').toLowerCase();
        return status === 'waiting' || status === 'in_progress';
      });
      if (pendingDate) {
        filtered = filtered.filter(apt => effectiveVisitDay(apt) === pendingDate);
      }
    } else if (filters?.status) {
      filtered = filtered.filter(apt => apt?.status === filters.status);

      // Non-completed statuses (waiting/in_progress/etc): restrict to the
      // active picked date too, so clicking Waiting/In Progress while
      // viewing a past date's completed/pending list doesn't reset to today.
      if (filters?.status !== 'completed') {
        const activeDateForStatus = historyDate || pendingDate;
        if (activeDateForStatus) {
          filtered = filtered.filter(apt => effectiveVisitDay(apt) === activeDateForStatus);
        }
      }

      // When status is 'completed', apply completedRange filter using the
      // EFFECTIVE visit day (completion/check-in day if present, else
      // appointment_date) so completed-today rows scheduled earlier are kept.
      if (filters?.status === 'completed' && completedRange) {
        const today = getLocalDateString();

        if (completedRange === 'today') {
          // Only today's completed
          filtered = filtered.filter(apt => effectiveVisitDay(apt) === today);
        } else if (completedRange === 'before') {
          // Only before today's completed
          filtered = filtered.filter(apt => effectiveVisitDay(apt) < today);
        }
        // 'all' means no additional filtering, show all completed
      }
    }

    // Follow-up filter — show only REMAINING (pending) follow-ups, completed excluded.
    if (filters?.isFollowUp) {
      filtered = filtered.filter(apt => {
        const isFollow = apt?.is_follow_up || apt?.reason_for_visit?.toLowerCase?.().includes('follow');
        const status = String(apt?.status || '').toLowerCase();
        return isFollow && status !== 'completed' && status !== 'cancelled' && status !== 'no-show';
      });
    }

    // Sort: VIP first, then who needs attention NOW — in-progress, then waiting
    // (physically checked in), then scheduled/not-yet-arrived, completed last.
    // Previously any 'scheduled' row got priority 0 unconditionally, ahead of
    // EVERY checked-in waiting patient — so booking a same-day appointment
    // for hours later (e.g. 7:10 PM booked at 2:43 PM) jumped it to the very
    // top of Active Queue, above people already sitting in the clinic.
    const getQueuePriority = (apt) => {
      const status = (apt?.status || '').toLowerCase();
      if (status === 'completed' || status === 'cancelled') return 3;
      if (status === 'in_progress' || status === 'in-progress') return 0;
      if (status === 'waiting') return 1;
      return 2; // scheduled / not yet checked in — ordered by appointment_time below
    };

    filtered.sort((a, b) => {
      if (!a || !b) return 0;
      const vipCompare = (b?.is_vip ? 1 : 0) - (a?.is_vip ? 1 : 0);
      if (vipCompare !== 0) return vipCompare;

      const priorityCompare = getQueuePriority(a) - getQueuePriority(b);
      if (priorityCompare !== 0) return priorityCompare;

      // Numeric timestamp (shared with visitDedupe's own ordering) instead of
      // a raw string compare on appointment_time — robust to whichever of
      // check_in_time/appointment_date+time is actually populated on a given
      // row, so same-priority rows (e.g. two "scheduled" bookings later
      // today) reliably sort earliest-first regardless of source/shape.
      return visitSortTimeMs(a, today) - visitSortTimeMs(b, today);
    });

    // Pagination
    const total = filtered.length;
    const pages = Math.ceil(total / limit) || 1;

    const startIndex = Math.max(0, (page - 1) * limit);
    const paginatedData = filtered.slice(startIndex, startIndex + limit);

    return { paginatedData, pagination: { total, pages } };
  }, [appointments, debouncedSearch, filters, page, limit, completedRange, pendingDate, historyDate]);

  // Handle quick date filters (Today/Yesterday/Tomorrow/Upcoming)
  // (No longer wired to the KPI cards; kept for potential quick-filter UI.)
  const _handleQuickDateFilter = useCallback((filterType) => {
    let dateFilter = '';
    const today = new Date();

    switch (filterType) {
      case 'today':
        dateFilter = getLocalDateString(today);
        break;
      case 'upcoming':
        // Next 7 days (excluding today)
        {
          const upcomingStart = new Date(today);
          upcomingStart.setDate(upcomingStart.getDate() + 1);
          const upcomingEnd = new Date(today);
          upcomingEnd.setDate(upcomingEnd.getDate() + 7);
          dateFilter = `${getLocalDateString(upcomingStart)} to ${getLocalDateString(upcomingEnd)}`;
        }
        break;
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFilter = getLocalDateString(yesterday);
        break;
      }
      case 'tomorrow': {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateFilter = getLocalDateString(tomorrow);
        break;
      }
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFilter = `${getLocalDateString(weekAgo)} to ${getLocalDateString(today)}`;
        break;
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter = `${getLocalDateString(monthAgo)} to ${getLocalDateString(today)}`;
        break;
      }
      default:
        dateFilter = '';
    }

    setFilters(prev => ({ ...prev, kpi: '', dateRange: dateFilter, status: '' }));
    setPage(1);

    // If the filter is a date range from -> to, also request matching appointments from server
    if (dateFilter.includes(' to ')) {
      const [start, end] = dateFilter.split(' to ');
      fetchAppointments({ start_date: start, end_date: end });
    } else if (dateFilter) {
      // Single-date filter. Use a high limit so the displayed list isn't capped
      // below the (uncapped) Today summary card count.
      fetchAppointments({ date: dateFilter, limit: 500 });
    } else {
      // no filter => default fetch
      fetchAppointments();
    }
  }, [fetchAppointments]);

  // Get status badge styling
  const _getStatusBadgeClass = useCallback((status) => {
    const classes = {
      'scheduled': 'bg-blue-100 text-blue-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'no-show': 'bg-gray-100 text-gray-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  }, []);

  // Get payment status badge styling
  const _getPaymentBadgeClass = useCallback((status) => {
    const classes = {
      'completed': 'bg-green-100 text-green-800',
      'paid': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'failed': 'bg-red-100 text-red-800',
      'refunded': 'bg-purple-100 text-purple-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  }, []);

  // Format date for display
  const _formatDate = useCallback((dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  // Format time for display
  const _formatTime = useCallback((timeString) => {
    if (!timeString) return '-';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }, []);

  // Calculate pending amount
  const _getPendingAmount = (apt) => {
    if (apt.amount_due != null) return parseFloat(apt.amount_due) || 0;
    const totalAmount = parseFloat(apt.total_amount ?? apt.bill_total ?? 0);
    const paidAmount = parseFloat(apt.amount_paid ?? apt.amount ?? 0);
    return Math.max(0, totalAmount - paidAmount);
  };

  // Format currency
  const _formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const handlePatientAdded = useCallback(() => {
    // New patient added (via modal) should reflect immediately; bypass cache.
    invalidateCache();
    fetchAppointments(lastFetchParamsRef.current, true);
    fetchCardCounts(); // Refresh card totals (Today/etc.) so counts update immediately
  }, [fetchAppointments, invalidateCache, fetchCardCounts]);

  // When coming back to the Queue tab/window (after creating a patient elsewhere),
  // refresh automatically so user doesn't need a manual browser refresh.
  useEffect(() => {
    const maybeRefresh = () => {
      const now = Date.now();
      // Avoid spamming network: refresh at most once per 2 seconds on repeated focus events
      if (now - lastAutoRefreshRef.current < 2000) return;
      lastAutoRefreshRef.current = now;
      invalidateCache();
      // Same filtered view the user last opened, not the default — see the
      // 30s poll below for why.
      fetchAppointments(lastFetchParamsRef.current, true);
      fetchCardCounts(); // refresh Upcoming/Others totals independently
    };

    const onFocus = () => maybeRefresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeRefresh();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchAppointments, invalidateCache, fetchCardCounts]);

  // Auto-refresh the queue on a fixed interval so newly added patients and
  // status/payment changes (made by other staff or on other devices) show up
  // without a manual refresh. Polling is paused while the tab is hidden to
  // avoid wasteful background requests; the focus/visibilitychange listener
  // above performs the catch-up refresh as soon as the user returns.
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 30000; // 30 seconds
    const intervalId = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      invalidateCache();
      // Repeat whatever view is currently open (e.g. status=completed from a
      // KPI card click) instead of always refetching the default today/
      // unfiltered list — that used to silently kick the user back to the
      // default view every 30s.
      fetchAppointments(lastFetchParamsRef.current, true);
      fetchCardCounts();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [fetchAppointments, invalidateCache, fetchCardCounts]);

  // Quick Register Handler for Staff
  const handleQuickRegister = useCallback(async () => {
    if (!quickRegisterForm.name || !quickRegisterForm.phone) {
      addToast('Name and phone are required', 'error');
      return;
    }

    setLoading(true);
    try {
      // First create the patient
      const patientResponse = await api.post('/api/patients', {
        name: quickRegisterForm.name,
        phone: quickRegisterForm.phone,
        clinic_id: user?.clinic_id || 2
      });

      // Handle both ApiResponse wrapper {data:{id,...}} and old format {patient:{id,...}}
      const patientData = patientResponse.data;
      const patient = patientData?.data || patientData?.patient || patientData;

      if (!patient?.id) {
        throw new Error('Patient creation failed: missing patient ID in response');
      }

      // Then create an appointment for walk-in (only Joi-allowed fields)
      // appointments.doctor_id is NOT NULL — a non-doctor user (admin/staff)
      // quick-registering here with no doctor_id would otherwise 500.
      const appointmentResponse = await api.post('/api/appointments', {
        patient_id: patient.id,
        doctor_id: user?.doctor_id || 2,
        clinic_id: user?.clinic_id || 2,
        appointment_date: getLocalDateString(),
        appointment_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        arrival_type: 'walk-in'
      });

      // Handle both ApiResponse wrapper {data:{id,...}} and old format {id,...}
      const aptData = appointmentResponse.data;
      const appointmentId = aptData?.data?.id || aptData?.id;

      // NOTE (2026-07-11): no bill is created on registration. The bill is raised
      // explicitly later from the billing/payment screens.

      // This used to stop at creating the appointment, never actually adding
      // the patient to the `queue` table — so they never got a token number
      // and never showed up as "waiting" anywhere that reads queue status
      // (Active Queue's waiting bucket, the "View pending patients on" filter,
      // queue KPI counts). Mirrors AddPatientModal's createAppointmentAndQueue.
      try {
        await api.post('/api/queue', {
          patient_id: patient.id,
          appointment_id: appointmentId,
          doctor_id: user?.doctor_id || 2,
          clinic_id: user?.clinic_id || 2,
          status: 'waiting',
          priority: 0,
        });
      } catch (queueError) {
        console.error('Quick register: queue add failed:', queueError);
        addToast('Patient registered but could not be added to queue. Please add manually.', 'warning');
      }

      addToast('Patient registered successfully', 'success');
      setShowQuickRegisterModal(false);
      setQuickRegisterForm({ name: '', phone: '', consultation_fee: 500 });
      invalidateCache(); // Clear cache after registration
      fetchAppointments({}, true); // Refresh the queue, skip cache
      fetchCardCounts(); // Refresh card totals (Today/etc.) so counts update immediately
    } catch (error) {
      console.error('Quick register error:', error);
      addToast(error.response?.data?.error || 'Failed to register patient', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast, quickRegisterForm, user, fetchAppointments, fetchCardCounts, invalidateCache]);

  // Effects
  useEffect(() => {
    fetchAppointments();
    fetchCardCounts(); // independent, parallel — does not block the today-only fetch
    fetchBillingServices();
    fetchServiceGroups();
  }, [fetchAppointments, fetchCardCounts, fetchBillingServices, fetchServiceGroups]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId !== null) setOpenMenuId(null);
      if (billPayPopover !== null) setBillPayPopover(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId, billPayPopover]);
  useEffect(() => {
    // Apply memoized filtered results
    setFilteredAppointments(filteredAppointmentsData.paginatedData);
    setPagination(filteredAppointmentsData.pagination);
  }, [filteredAppointmentsData]);

  // Clamp the page when the filtered set shrinks (search, KPI click, range
  // change). Not every filter path resets page to 1, so without this a user
  // sitting on page 2 could end up on a page past the end — an empty list
  // with a nonzero total.
  useEffect(() => {
    const maxPages = filteredAppointmentsData.pagination.pages || 1;
    if (page > maxPages) setPage(maxPages);
  }, [filteredAppointmentsData, page]);

  // Capture deferred completion context from PrescriptionPad.
  // Single-use: cleared immediately after reading, regardless of outcome.
  // It used to stay in sessionStorage until a bill was actually saved, so if
  // the doctor closed the modal instead of saving (or it never found a
  // matching appointment on that visit), the stale intent survived — and on
  // any later date-filter change, the "auto-open bill" effect below would
  // find a coincidental match in the newly-fetched appointments and pop the
  // Create Bill modal open again, completely unprompted.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pendingVisitCompletion');
      sessionStorage.removeItem('pendingVisitCompletion');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || (!parsed.patient_id && !parsed.appointment_id && !parsed.queue_id)) return;
      // Ignore stale intents (e.g. tab left open, browser back/forward) —
      // only honor one written in the last 2 minutes.
      if (parsed.created_at && Date.now() - parsed.created_at > 2 * 60 * 1000) return;
      pendingVisitRef.current = parsed;
    } catch {
      pendingVisitRef.current = null;
    }
  }, []);

  // Post-prescription flow: the visit is completed by prescription send itself
  // (PrescriptionPad PATCHes the statuses before navigating here, or we finish
  // it below as a fallback when the Pad had no ids). The bill editor still
  // auto-opens as a CONVENIENCE — saving the bill is optional and no longer
  // gates visit completion.
  useEffect(() => {
    const pending = pendingVisitRef.current;
    if (!pending || pendingVisitHandledRef.current) return;
    if (!Array.isArray(appointments) || appointments.length === 0) return;

    const target = appointments.find((a) => {
      const byQueue = pending.queue_id && String(a.queue_id || a.id || '') === String(pending.queue_id);
      const byAppointment = pending.appointment_id && String(a.appointment_id || (a.source !== 'walkin' ? a.id : '')) === String(pending.appointment_id);
      const byPatient = pending.patient_id && String(resolvePatientDbId(a) || '') === String(pending.patient_id);
      return byQueue || byAppointment || byPatient;
    });

    if (!target) return;

    pendingVisitHandledRef.current = true;

    (async () => {
      // Fallback: if PrescriptionPad couldn't complete the visit (no ids in its
      // context), finish it here — WITHOUT requiring a bill save.
      if (pending.visit_completed !== true && String(target.status || '').toLowerCase() !== 'completed') {
        await completeVisitAndShowCompleted({
          ...target,
          appointment_id: pending.appointment_id || target.appointment_id || (target.source !== 'walkin' ? target.id : null),
          queue_id: pending.queue_id || target.queue_id || (target.source === 'walkin' ? target.id : null)
        });
      }
      pendingVisitRef.current = null;
      try {
        await openBillEditorForAppointment(target);
        addToast('Visit completed. Bill save is optional.', 'info');
      } catch {
        addToast('Visit completed. (Bill editor could not be opened — you can create the bill later.)', 'info');
      }
    })();
  }, [appointments, openBillEditorForAppointment, resolvePatientDbId, addToast, completeVisitAndShowCompleted]);

  // Prefetch latest Rx id for currently visible queue cards.
  // This keeps "View Rx" fast while still always opening the latest prescription.
  useEffect(() => {
    const visiblePatients = (filteredAppointments || [])
      .map((apt) => resolvePatientDbId(apt))
      .filter(Boolean)
      .slice(0, 12);

    if (!visiblePatients.length) return;

    visiblePatients.forEach((pid) => {
      const key = String(pid);
      if (rxCacheRef.current[key] || rxPrefetchInFlightRef.current.has(key)) return;

      rxPrefetchInFlightRef.current.add(key);
      api.get(`/api/prescriptions/patient/${key}/latest-id`, { timeout: 4000 })
        .then((res) => {
          const rxId = res?.data?.data?.id || res?.data?.id || null;
          if (rxId) rxCacheRef.current[key] = rxId;
        })
        .catch(() => {
          // Ignore missing/no-Rx or transient failures; on-demand open will retry.
        })
        .finally(() => {
          rxPrefetchInFlightRef.current.delete(key);
        });
    });
  }, [api, filteredAppointments, resolvePatientDbId]);

  // Reset page when filters change (uses debouncedSearch to avoid excessive resets)
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  return (
    <div className="space-y-4">
      <HeaderBar title="Queue" />

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">📱 Share Appointment Link</h3>
              <button 
                type="button"
                onClick={() => setShowQRModal(false)} 
                className="text-gray-400 hover:text-gray-600 text-2xl transition active:scale-[0.98]"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4 text-center">
              {(() => {
                // Direct link to booking page with doctor param
                const doctorId = user?.id || 1;
                const link = `${window.location.origin}/book-appointment?doctor=${doctorId}`;
                const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(link)}`;
                return (
                  <>
                    <p className="text-sm text-gray-600 mb-4">Patients can scan this QR code to book an appointment</p>
                    <img src={qrSrc} alt="Booking QR" className="mx-auto border rounded-lg" />
                    <p className="text-xs text-gray-500 break-all mt-3">{link}</p>
                    <div className="grid grid-cols-3 gap-2 pt-4">
                      <button
                        type="button"
                        onClick={async () => { 
                          await navigator.clipboard.writeText(link); 
                          addToast('Link copied!', 'success'); 
                        }}
                        className="px-3 py-2 text-sm border rounded-lg hover:bg-blue-50 font-medium flex flex-col items-center gap-1 transition active:scale-[0.98]"
                      >
                        <span className="text-lg">📋</span>
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const msg = `Book your appointment using this link: ${link}`;
                          const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                          window.open(wa, '_blank');
                        }}
                        className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex flex-col items-center gap-1 transition active:scale-[0.98]"
                      >
                        <span className="text-lg">💬</span>
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const canvas = document.querySelector('img[alt="Booking QR"]');
                          if (canvas) {
                            const link = document.createElement('a');
                            link.href = canvas.src;
                            link.download = 'appointment_qr.png';
                            link.click();
                            addToast('QR code downloaded!', 'success');
                          }
                        }}
                        className="px-3 py-2 text-sm border rounded-lg hover:bg-purple-50 font-medium flex flex-col items-center gap-1 transition active:scale-[0.98]"
                      >
                        <span className="text-lg">⬇️</span>
                        Download
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Today's queue KPIs. Counts come from the queueKpis memo, which uses
          the SAME rows + predicates as the list shown when a card is clicked —
          the card number always equals the number of rows below. */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div
          className="p-4 bg-white rounded-xl shadow-sm border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
          onClick={() => {
            setPendingDate('');
            setHistoryDate('');
            setCompletedRange('today');
            const todayStr = getLocalDateString();
            setFilters(prev => ({ ...prev, kpi: 'total', dateRange: '', status: '', paymentStatus: '', isFollowUp: false, others: false }));
            fetchAppointments({ start_date: todayStr, end_date: todayStr }, true);
            setPage(1);
          }}
          title="Click to view all of today's patients"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Today</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{queueKpis.total}</p>
          <p className="text-xs text-gray-400 mt-0.5">Appointments + walk-ins</p>
        </div>
        <div
          className="p-4 bg-white rounded-xl shadow-sm border-l-4 border-l-rose-500 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
          onClick={() => {
            // Stay on whichever date is currently active (View completed/pending
            // patients on <date>) instead of jumping back to today — clicking a
            // KPI card while browsing history shouldn't discard that context.
            const activeDate = activeKpiDay;
            setFilters(prev => ({ ...prev, kpi: 'pending', dateRange: '', status: '', paymentStatus: '', isFollowUp: false, others: false }));
            fetchAppointments({ start_date: activeDate, end_date: activeDate }, true);
            setPage(1);
          }}
          title="Click to view patients not completed yet"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{queueKpis.pending}</p>
          <p className="text-xs text-gray-400 mt-0.5">Not completed yet</p>
        </div>
        <div
          className="relative p-4 bg-white rounded-xl shadow-sm border-l-4 border-l-emerald-500 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
          onClick={() => {
            const activeDate = activeKpiDay;
            setCompletedRange('all');
            setFilters(prev => ({ ...prev, kpi: 'completed', dateRange: '', status: '', paymentStatus: '', isFollowUp: false, others: false }));
            fetchAppointments({ start_date: activeDate, end_date: activeDate }, true);
            setPage(1);
          }}
          title="Click to view completed visits for the active date"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{queueKpis.completed}</p>
          <p className="text-xs text-gray-400 mt-0.5">Visit finished today</p>
        </div>
        <div
          className="p-4 bg-white rounded-xl shadow-sm border-l-4 border-l-violet-500 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
          onClick={() => {
            const activeDate = activeKpiDay;
            setFilters(prev => ({ ...prev, kpi: 'paid', dateRange: '', status: '', paymentStatus: '', isFollowUp: false, others: false }));
            fetchAppointments({ start_date: activeDate, end_date: activeDate }, true);
            setPage(1);
          }}
          title="Click to view paid bills for the active date"
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</p>
          <p className="mt-1 text-2xl font-bold text-violet-600">{queueKpis.paid}</p>
          <p className="text-xs text-gray-400 mt-0.5">Bills paid today</p>
        </div>
      </section>

      {/* Past-day history: load completed queue patients for any chosen date */}
      <section className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <span className="text-gray-600 font-medium">📅 View completed patients on:</span>
        <input
          type="date"
          value={historyDate}
          max={getLocalDateString()}
          onChange={(e) => {
            const d = e.target.value;
            setHistoryDate(d);
            if (d) {
              setPendingDate('');
              setCompletedRange('all');
              // Fetch the FULL day (no status param) so the KPI cards can
              // compute all four counts for the picked date, then show only
              // the completed rows via the shared kpi predicate.
              setFilters(prev => ({ ...prev, kpi: 'completed', dateRange: '', status: '', paymentStatus: '', isFollowUp: false, others: false }));
              fetchAppointments({ start_date: d, end_date: d }, true);
              setPage(1);
              addToast(`Showing completed patients for ${d}`, 'info');
            }
          }}
          className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
        />
        {historyDate && (
          <button
            type="button"
            onClick={() => {
              setHistoryDate('');
              setFilters(prev => ({ ...prev, kpi: '', status: '', dateRange: '', paymentStatus: '' }));
              fetchAppointments({}, true);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            Clear · back to today
          </button>
        )}
        <span className="text-xs text-gray-400">Tip: click the Completed card above to jump to today's finished visits.</span>
      </section>

      {/* Past-day history: load pending (not-yet-completed) queue patients for any chosen date */}
      <section className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <span className="text-gray-600 font-medium">📅 View pending patients on:</span>
        <input
          type="date"
          value={pendingDate}
          max={getLocalDateString()}
          onChange={(e) => {
            const d = e.target.value;
            setPendingDate(d);
            if (d) {
              setHistoryDate('');
              setFilters(prev => ({ ...prev, kpi: 'pending', dateRange: '', status: '', paymentStatus: '', isFollowUp: false, others: false }));
              fetchAppointments({ start_date: d, end_date: d }, true);
              setPage(1);
              addToast(`Showing pending patients for ${d}`, 'info');
            }
          }}
          className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
        />
        {pendingDate && (
          <button
            type="button"
            onClick={() => {
              setPendingDate('');
              setFilters(prev => ({ ...prev, kpi: '', status: '', dateRange: '', paymentStatus: '' }));
              fetchAppointments({}, true);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            Clear · back to today
          </button>
        )}
      </section>

      {/* Main Content */}
      <section className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        {/* Queue Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-md border-2 border-gray-100/60 overflow-hidden">
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-blue-50 via-blue-50 to-indigo-50 border-b-2 border-blue-200/40 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">Active Queue</h2>
                <p className="text-slate-600 text-xs mt-1 font-medium">
                  {pagination.total > 0 ? `${pagination.total} appointments` : `${filteredAppointments.length} appointments`}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    invalidateCache();
                    fetchAppointments(lastFetchParamsRef.current, true);
                    fetchCardCounts();
                  }}
                  disabled={loading}
                  className="px-4 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg flex items-center gap-2 disabled:opacity-60 transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddPatientModal(true)}
                  className="px-4 py-2.5 text-sm bg-white hover:bg-gray-50 text-blue-700 font-bold rounded-lg flex items-center gap-2 transition-all shadow-md hover:shadow-lg border-2 border-blue-200 hover:border-blue-300 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Patient
                </button>
              </div>
            </div>
          </div>

          <div className="p-4">

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <input
                id="queue-search"
                name="queue-search"
                type="text"
                autoComplete="off"
                placeholder="Search by patient name, UHID, phone, doctor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedAppointments.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-blue-800">
                {selectedAppointments.length} patient{selectedAppointments.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
                >
                  Remove Selected
                </button>
                <button
                  onClick={() => {
                    setSelectedAppointments([]);
                    setSelectAll(false);
                  }}
                  className="px-3 py-1 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 transition"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Compact Card View - Always Shown */}
          <div className="space-y-2">
            {/* Full spinner only on the very first load. On KPI clicks /
                filter changes the data is refiltered client-side instantly,
                so blanking the whole list to a spinner while the background
                refetch runs made every click look like a full page refresh. */}
            {loading && filteredAppointments.length === 0 && (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-slate-500 mt-3">Loading...</p>
              </div>
            )}

            {error && !loading && (
              <div className="p-6 text-center bg-red-50 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
                <button onClick={() => fetchAppointments(lastFetchParamsRef.current, true)} className="mt-2 text-sm underline">Retry</button>
              </div>
            )}
            
            {!error && (!loading || filteredAppointments.length > 0) && (
              <>
                {filteredAppointments.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed rounded-lg">
                    <p className="text-slate-500">No appointments found</p>
                  </div>
                ) : (
                  (() => {
                    const isCompletedRow = (a) => String(a?.status || '').toLowerCase() === 'completed';
                    // Render EVERY row on the current page: active/remaining on
                    // top, completed under a divider. Never drop rows here —
                    // the old code hid completed rows unless filters.status ===
                    // 'completed', but the KPI cards set filters.kpi (with
                    // status ''), so Completed/Paid KPI clicks showed "No
                    // appointments found" and later pagination pages (where
                    // sorting places completed rows) rendered empty while the
                    // pagination total still counted the hidden rows.
                    const remainingRows = filteredAppointments.filter((a) => !isCompletedRow(a));
                    const completedRows = filteredAppointments.filter(isCompletedRow);
                    const renderApptCard = (apt) => (
                    <div 
                      key={apt.id} 
                      className={`rounded-xl p-4 hover:shadow-xl transition-all duration-200 border ${
                        apt.status === 'completed' ? 'bg-gradient-to-br from-green-50 via-white to-emerald-50 border-green-300 shadow-md' : 
                        apt.status === 'cancelled' ? 'bg-gradient-to-br from-red-50 via-white to-rose-50 border-red-300 opacity-75 shadow-md' : 
                        apt.status === 'in-progress' ? 'bg-gradient-to-br from-blue-50 via-blue-50 to-cyan-50 border-blue-400 shadow-lg' :
                        'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      {/* Top Section: Patient info + Date/Time/Visit */}
                      <div className="flex items-start justify-between gap-4 mb-3 pb-3 border-b border-slate-100 flex-wrap">
                        {/* Patient Header - Left */}
                        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-md ${
                            apt.status === 'in-progress' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                            apt.status === 'completed' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                            'bg-gradient-to-br from-indigo-500 to-indigo-600'
                          }`}>
                            {apt.patient_name ? apt.patient_name[0].toUpperCase() : '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="font-bold text-base text-slate-900 truncate">{apt.patient_name || 'Unknown'}</p>
                              {/* Ternary, not `&&`: is_vip comes back from the
                              queue API as the NUMBER 0 for non-VIP patients, and
                              React renders a literal 0 — that's the stray "0"
                              that appeared after the patient's name. */}
                              {apt.is_vip ? <span className="px-1.5 py-0.5 text-[9px] bg-yellow-200 text-yellow-900 rounded-full whitespace-nowrap flex-shrink-0 font-semibold">👑</span> : null}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                              {/* patient_phone is the third spelling of this
                              field (AppointmentService/QueueService.getById);
                              accept all three so the number never blanks out
                              just because the row came from another source. */}
                              <span>📞 {apt.contact || apt.phone || apt.patient_phone || '-'}</span>
                              {(() => {
                                const age = patientAgeLabel(apt);
                                const sex = patientGenderLabel(apt);
                                const label = [age, sex].filter(Boolean).join(' · ');
                                if (!label) return null;
                                return (
                                  <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded font-semibold text-[11px]">{label}</span>
                                );
                              })()}
                              <span className="px-2 py-0.5 bg-blue-100 border border-blue-300 text-blue-900 rounded font-semibold text-[11px]">🆔 UHID: {apt.uhid || apt.patient_identifier || '-'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Date/Time/Walk + Menu — wraps onto its
                        own row(s) instead of squeezing the patient name (left,
                        flex-1) down to nothing on narrower viewports (small
                        laptop windows, tablets, phones). */}
                        <div className="flex gap-2 items-end flex-wrap justify-end">
                          {/* Date, Time, Walk-in on Right */}
                          <div className="flex gap-2 items-center justify-end flex-wrap">
                            <span className="px-3.5 py-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200 text-xs font-bold text-blue-700 whitespace-nowrap shadow-sm hover:shadow-md hover:from-blue-100 hover:to-blue-150 transition-all cursor-default">📅 {new Date(apt.appointment_date || apt.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                            <span className="px-3.5 py-2 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg border-2 border-amber-200 text-xs font-bold text-amber-700 whitespace-nowrap shadow-sm hover:shadow-md hover:from-amber-100 hover:to-amber-150 transition-all cursor-default">⏰ {formatTime12h(apt.appointment_time?.substring(0, 5))}</span>
                            {(() => {
                              const type = (apt?.appointment_type || (apt?.arrival_type === 'online' ? 'online' : 'offline') || 'offline').toLowerCase();
                              const isOnline = type === 'online' || apt?.arrival_type === 'online';
                              if (isOnline) {
                                return (
                                  <span className="px-3.5 py-2 rounded-lg border-2 text-xs font-bold whitespace-nowrap bg-gradient-to-r from-purple-100 to-purple-150 border-purple-300 text-purple-800 shadow-sm hover:shadow-md transition-all cursor-default">
                                    💻 Online
                                  </span>
                                );
                              }
                              return (
                                <span className={`px-3.5 py-2 rounded-lg border-2 text-xs font-bold whitespace-nowrap shadow-sm hover:shadow-md transition-all cursor-default ${apt.source === 'walkin' ? 'bg-gradient-to-r from-orange-100 to-orange-150 border-orange-300 text-orange-800' : 'bg-gradient-to-r from-cyan-100 to-cyan-150 border-cyan-300 text-cyan-800'}`}>
                                  {apt.source === 'walkin' ? '🚶 Walk' : '🏥 Offline'}
                                </span>
                              );
                            })()}
                          </div>

                          <select
                            name={`status-${apt.id}`}
                            value={apt.status || 'scheduled'}
                            onChange={(e) => updateAppointmentStatus(apt.id, e.target.value, apt)}
                            className={`w-fit flex-shrink-0 px-3.5 py-2 text-xs font-bold border-2 rounded-lg cursor-pointer transition shadow-sm hover:shadow-md whitespace-nowrap ${
                              apt.status === 'completed' ? 'bg-gradient-to-r from-green-100 to-emerald-100 border-green-400 text-green-800 hover:from-green-150 hover:to-emerald-150' :
                              apt.status === 'in-progress' ? 'bg-gradient-to-r from-blue-100 to-cyan-100 border-blue-400 text-blue-800 hover:from-blue-150 hover:to-cyan-150' :
                              apt.status === 'cancelled' ? 'bg-gradient-to-r from-red-100 to-rose-100 border-red-400 text-red-800 hover:from-red-150 hover:to-rose-150' :
                              'bg-gradient-to-r from-slate-100 to-gray-100 border-slate-300 text-slate-800 hover:from-slate-150 hover:to-gray-150'
                            }`}
                            title="Status"
                          >
                            <option value="scheduled">📅 Sch</option>
                            <option value="in-progress">🔄 Progress</option>
                            <option value="completed">✓ Done</option>
                            <option value="cancelled">✕ Cancel</option>
                            <option value="no-show">✗ No Show</option>
                          </select>
                          {/* Visit Button - Doctor Only */}
                          {user?.role === 'doctor' && (
                            <button
                              onClick={() => handleVisitPatient(apt)}
                              className="flex-shrink-0 px-5 py-2 text-xs bg-gradient-to-r from-purple-600 via-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-700 hover:via-purple-700 hover:to-indigo-700 active:scale-95 transition-all shadow-md hover:shadow-lg whitespace-nowrap tracking-wide"
                              title="Check-in & Visit Patient"
                            >
                              👁️ Visit
                            </button>
                          )}
                          {/* Menu Button */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openMenuId === apt.id) {
                                  setOpenMenuId(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const spaceBelow = window.innerHeight - rect.bottom;
                                  const menuHeight = 260;
                                  const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4;
                                  const left = Math.min(rect.right - 160, window.innerWidth - 170);
                                  setMenuPos({ top, left });
                                  setOpenMenuId(apt.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition text-base"
                            >
                              ⋮
                            </button>
                            {openMenuId === apt.id && createPortal(
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
                                className="w-40 bg-white border border-slate-200 rounded-lg shadow-xl overflow-y-auto"
                              >
                                <button
                                  onClick={async () => {
                                    setOpenMenuId(null);
                                    const pid = resolvePatientDbId(apt);
                                    if (!pid) {
                                      addToast('Patient ID not found', 'error');
                                      return;
                                    }

                                    const billId = await ensureLatestBillId(apt);
                                    if (billId) {
                                      window.open(`/api/pdf/bill/${billId}${billPdfQuery(billWithLetterhead)}`, '_blank');
                                      return;
                                    }

                                    // No bill found
                                    addToast('No bill found', 'warning');
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 rounded-lg transition-colors"
                                  title="Print Bill"
                                >
                                  <span className="text-base">🧾</span>
                                  <span className="font-medium">Print Bill</span>
                                </button>

                                <button
                                  onClick={async () => {
                                    setOpenMenuId(null);
                                    const billId = await ensureLatestBillId(apt);
                                    if (!billId) {
                                      addToast('No bill found. Please create a bill first.', 'error');
                                      return;
                                    }
                                    try {
                                      await openBillEditorForAppointment(apt, billId);
                                    } catch (_e) {
                                      addToast('Failed to load bill details for edit', 'error');
                                    }
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 rounded-lg transition-colors"
                                  title="Edit Bill / Add Services"
                                >
                                  <span className="text-base">✏️</span>
                                  <span className="font-medium">Edit Bill</span>
                                </button>

                                <button
                                  onClick={async () => {
                                    setOpenMenuId(null);
                                    const pid = resolvePatientDbId(apt);
                                    if (!pid) return;

                                    let billId = apt.bill_id || apt.billId || null;
                                    if (!billId) {
                                      try {
                                        const billRes = await api.get('/api/bills', {
                                          params: { patient_id: pid, limit: 1 }
                                        });
                                        const payload = billRes.data?.data || billRes.data;
                                        const bills = payload?.bills || payload?.data || [];
                                        const latest = Array.isArray(bills) && bills.length > 0 ? bills[0] : null;
                                        billId = latest?.id || null;
                                      } catch (_) {
                                        billId = null;
                                      }
                                    }

                                    if (!billId) {
                                      addToast('No bill found. Please create a bill first.', 'error');
                                      return;
                                    }

                                    try {
                                      const res = await api.get(`/api/bills/${billId}/whatsapp`);
                                      const phone = res.data?.patient_phone || apt.phone || apt.contact;
                                      const msg = res.data?.whatsapp_message;
                                      if (!phone || !msg) {
                                        addToast('Could not prepare WhatsApp message for this bill', 'error');
                                        return;
                                      }
                                      openWhatsApp(phone, msg);
                                    } catch (e) {
                                      addToast(e.response?.data?.error || 'Failed to prepare bill WhatsApp message', 'error');
                                    }
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 rounded-lg transition-colors"
                                  title="Send Bill via WhatsApp"
                                >
                                  <span className="text-base">📤</span>
                                  <span className="font-medium">Send Bill</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleSendRxWhatsApp(apt);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 rounded-lg transition-colors"
                                  title="Send Prescription via WhatsApp"
                                >
                                  <span className="text-base">📄</span>
                                  <span className="font-medium">Send Rx</span>
                                </button>

                                <button
                                  onClick={async () => {
                                    setOpenMenuId(null);
                                    openLatestRxPdf(apt);
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 rounded-lg transition-colors"
                                  title="View Prescription PDF"
                                >
                                  <span className="text-base">📋</span>
                                  <span className="font-medium">View Rx</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    (async () => {
                                      const existingBillId = await ensureLatestBillId(apt);
                                      if (existingBillId) {
                                        addToast('Bill already exists. Use Edit Bill / Print Bill.', 'info');
                                        return;
                                      }
                                      setCreateBillPatient(apt);
                                      setBillFormData({ services: [{ service_name: 'Consultation', qty: 1, unit_price: apt.consultation_fee || 500, discount: 0, total: apt.consultation_fee || 500 }], tax: 0, discount: 0, payment_method: 'cash', payment_status: 'pending', amount_paid: '' });
                                      setShowCreateBillModal(true);
                                    })();
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 rounded-lg transition-colors"
                                  title="Create Bill"
                                >
                                  <span className="text-base">📝</span>
                                  <span className="font-medium">{apt.bill_id ? '✓ Bill Created' : 'Create Bill'}</span>
                                </button>

                                <button
                                  onClick={async () => {
                                    setOpenMenuId(null);
                                    try {
                                      const queueId = apt.queue_id || apt.id || apt.appointment_id;
                                      if (!queueId) {
                                        addToast('Unable to remove from queue', 'error');
                                        return;
                                      }
                                      if (apt.source === 'walkin' || apt.queue_id) {
                                        await api.delete(`/api/queue/${queueId}`);
                                      } else {
                                        await api.delete(`/api/appointments/${apt.id}`);
                                      }
                                      addToast('Removed from queue', 'success');

                                      // Optimistically update UI so user doesn't need manual refresh
                                      setAppointments((prev) => {
                                        const next = (prev || []).filter((a) => {
                                          const aQueueId = a.queue_id || a.id || a.appointment_id;
                                          const aAptId = a.id;
                                          return !(aQueueId === queueId || aAptId === apt.id);
                                        });
                                        calculateStats(next);
                                        return next;
                                      });

                                      // Refresh in background to stay consistent with backend
                                      fetchAppointments({}, true);
                                    } catch (error) {
                                      console.error('Error removing from queue:', error);
                                      addToast('Failed to remove from queue', 'error');
                                    }
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 hover:text-red-700 flex items-center gap-3 rounded-lg transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span className="font-medium">Remove</span>
                                </button>
                              </div>,
                              document.body
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ── BILL STRIP ── always visible below card */}
                      {(() => {
                        const billStatus = apt.bill_payment_status || null;
                        const billTotal  = parseFloat(apt.bill_total || apt.total_amount || 0);
                        const amtPaid    = parseFloat(apt.bill_amount_paid ?? 0);
                        const remaining  = Math.max(0, billTotal - amtPaid);
                        const hasBill    = !!apt.bill_id;
                        const isPaid     = billStatus === 'paid';
                        const isPartial  = billStatus === 'partial';
                        const isLoading  = billPayLoading === apt.id;
                        const showPartialInput = billPartialInput[apt.id] !== undefined;

                        if (!hasBill) {
                          return (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-xs text-slate-400 italic">No bill created</span>
                              <button
                                onClick={() => {
                                  setCreateBillPatient(apt);
                                  setBillFormData({ services: [{ service_name: 'Consultation', qty: 1, unit_price: apt.consultation_fee || 500, discount: 0, total: apt.consultation_fee || 500 }], tax: 0, discount: 0, payment_method: 'cash', payment_status: 'pending', amount_paid: '' });
                                  setShowCreateBillModal(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all active:scale-95"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Create Bill
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className={`mt-2 pt-2 border-t space-y-2 ${isPaid ? 'border-green-200' : isPartial ? 'border-blue-200' : 'border-orange-200'}`}>

                            {/* Row 1: Total + status + amount breakdown */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Total */}
                                <span className="text-sm font-black text-slate-700">₹{billTotal.toFixed(0)}</span>
                                {/* Status badge */}
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${isPaid ? 'bg-green-50 border-green-300 text-green-800' : isPartial ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-orange-50 border-orange-300 text-orange-800'}`}>
                                  {isPaid ? '✅ Paid' : isPartial ? '🔵 Partial' : '💰 Due'}
                                </span>
                                {/* Breakdown for partial */}
                                {isPartial && billTotal > 0 && (
                                  <>
                                    <span className="text-[10px] text-green-700 font-semibold bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                      Paid: ₹{amtPaid.toFixed(0)}
                                    </span>
                                    <span className="text-[10px] text-orange-700 font-semibold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                                      Due: ₹{remaining.toFixed(0)}
                                    </span>
                                  </>
                                )}
                                {/* For fully paid show paid amount */}
                                {isPaid && billTotal > 0 && (
                                  <span className="text-[10px] text-green-700 font-semibold bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                    Paid: ₹{amtPaid > 0 ? amtPaid.toFixed(0) : billTotal.toFixed(0)}
                                  </span>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1.5">
                                {isLoading ? (
                                  <span className="text-xs text-slate-400 animate-pulse">Updating...</span>
                                ) : (
                                  <>
                                    {!isPaid && (
                                      <button onClick={() => handleQuickPayToggle(apt, 'paid')}
                                        className="px-2.5 py-1.5 text-[11px] font-bold bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all active:scale-95 shadow-sm whitespace-nowrap">
                                        ✅ Full Paid
                                      </button>
                                    )}
                                    {!showPartialInput && !isPaid && (
                                      <button
                                        onClick={() => setBillPartialInput(prev => ({ ...prev, [apt.id]: isPartial ? amtPaid.toFixed(0) : '' }))}
                                        className="px-2.5 py-1.5 text-[11px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 rounded-lg transition-all active:scale-95 whitespace-nowrap">
                                        🔵 {isPartial ? 'Edit Partial' : 'Partial'}
                                      </button>
                                    )}
                                    {isPaid && (
                                      <button onClick={() => handleQuickPayToggle(apt, 'pending')}
                                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 rounded-lg transition-all active:scale-95">
                                        Undo
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Partial amount input (shown when "Partial" clicked) */}
                            {showPartialInput && (
                              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                <span className="text-xs text-blue-700 font-semibold whitespace-nowrap">Amount Paid ₹</span>
                                <input
                                  type="number" min="0" max={billTotal} step="1"
                                  autoFocus
                                  className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm font-bold text-blue-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-24"
                                  placeholder={`Max ₹${billTotal.toFixed(0)}`}
                                  value={billPartialInput[apt.id]}
                                  onChange={e => setBillPartialInput(prev => ({ ...prev, [apt.id]: e.target.value }))}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleQuickPayToggle(apt, 'partial', billPartialInput[apt.id]);
                                    if (e.key === 'Escape') setBillPartialInput(prev => { const n = { ...prev }; delete n[apt.id]; return n; });
                                  }}
                                />
                                <span className="text-xs text-slate-500">of ₹{billTotal.toFixed(0)}</span>
                                <button
                                  onClick={() => handleQuickPayToggle(apt, 'partial', billPartialInput[apt.id])}
                                  className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition active:scale-95 whitespace-nowrap">
                                  Save
                                </button>
                                <button
                                  onClick={() => setBillPartialInput(prev => { const n = { ...prev }; delete n[apt.id]; return n; })}
                                  className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    </div>
                    );
                    return (
                      <>
                        {remainingRows.map((apt) => renderApptCard(apt))}
                        {completedRows.length > 0 && (
                          <div className="flex items-center gap-3 py-2 mt-2">
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 whitespace-nowrap">Completed</span>
                            <div className="flex-1 h-px bg-slate-200" />
                          </div>
                        )}
                        {completedRows.map((apt) => renderApptCard(apt))}
                      </>
                    );
                  })()
                )}
              </>
            )}
            
            {/* Pagination */}
            {pagination.total > 0 && (
              <div className="flex items-center justify-between gap-3 pt-4 border-t">
                <span className="text-sm text-slate-600">
                  Page {page} of {pagination.pages} ({pagination.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 text-sm border rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page >= pagination.pages}
                    className="px-3 py-2 text-sm border rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>{/* end space-y-3 compact view */}
          </div>{/* end p-4 wrapper */}
        </div>{/* end lg:col-span-3 queue table */}

        {/* Sidebar */}
        <aside className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-fit">
          {/* Sidebar gradient header */}
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 px-4 py-5">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl shadow-inner">
                👨‍⚕️
              </div>
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-400/30 text-green-100 rounded-full mb-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
                  Online
                </span>
                <p className="font-bold text-white">Dr. {user?.name || 'Doctor'}</p>
                <p className="text-blue-200 text-xs">{user?.role === 'doctor' ? (user?.specialization || 'General Physician') : user?.role}</p>
                {user?.clinic_name && (
                  <p className="text-blue-300 text-xs mt-0.5">📍 {user.clinic_name}</p>
                )}
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
          
          <hr />

          {/* QR Code Share Button */}
          <button
            onClick={() => setShowQRModal(true)}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <span className="text-lg">📱</span>
            Share QR Code
          </button>
          
          {/* Quick Register Button - Only for Staff */}
          {user?.role === 'staff' && (
            <button
              onClick={() => setShowQuickRegisterModal(true)}
              className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              <span className="text-lg">👤</span>
              Quick Register Patient
            </button>
          )}
          
          <hr />
          <div className="space-y-2">
            <p className="text-sm font-medium">Quick Actions</p>
            {/* Quick Check-in for walk-ins */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 mb-3 relative border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Quick Check-in</p>
                  <p className="text-xs text-blue-600">Search & add to queue</p>
                </div>
              </div>
              
              <div className="space-y-3 relative">
                <div className="relative">
                  <input
                    id="quick-name"
                    name="quick-name"
                    type="text"
                    autoComplete="off"
                    placeholder="Patient name or phone"
                    value={quickName}
                    onChange={(e) => {
                      setQuickName(e.target.value);
                      handleQuickSearch(e.target.value, 'name');
                    }}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
                
                {/* Search Results Dropdown */}
                {quickSearchLoading && (
                  <div className="absolute top-full -left-3 -right-3 bg-white border border-blue-200 rounded-lg shadow-xl z-50 p-3 mt-1">
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                      <span className="text-xs text-slate-500">Searching...</span>
                    </div>
                  </div>
                )}
                
                {quickSearchResults.length > 0 && (
                  <div className="absolute top-full -left-3 -right-3 bg-white border border-blue-200 rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto mt-1">
                    <div className="p-2 bg-blue-50 border-b border-blue-200 sticky top-0">
                      <p className="text-xs font-medium text-blue-700">
                        📋 {quickSearchResults.length} found
                      </p>
                    </div>
                    {quickSearchResults.map((patient, index) => (
                      <div
                        key={patient.id}
                        className={`p-2 hover:bg-blue-50 cursor-pointer border-b border-blue-100 last:border-b-0 transition-colors ${
                          index === 0 ? 'border-t-0' : ''
                        }`}
                        onClick={() => handleSearchResultClick(patient)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-medium text-blue-600">
                                  {patient.name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-slate-900">{patient.name}</p>
                            </div>
                            <div className="ml-8 space-y-0.5">
                              <div className="flex items-center gap-2 text-[11px] text-slate-600 flex-wrap">
                                <span>📱 {patient.phone}</span>
                                <span>🆔 {patient.patient_id}</span>
                              </div>
                              {patient.email && (
                                <div className="text-[10px] text-slate-500">
                                  ✉️ {patient.email}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded whitespace-nowrap font-medium">
                              ➕ Add
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Patients */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-slate-500 rounded-lg flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">Recent Patients</p>
                  <p className="text-[10px] text-slate-600">Last 24h</p>
                </div>
              </div>
              
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {appointments.slice(0, 5).map((apt) => (
                  <div key={apt.id} className="p-1.5 bg-white rounded border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-medium text-slate-600">
                          {apt.patient_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-slate-900 truncate">{apt.patient_name}</p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <span>🕐 {formatTime12h(apt.appointment_time?.substring(0, 5))}</span>
                          {apt.status && (
                            <span className={`px-1 py-0.5 rounded text-[9px] font-medium whitespace-nowrap ${
                              apt.status === 'completed' ? 'bg-green-100 text-green-700' :
                              apt.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                              apt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {apt.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {appointments.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-xs text-slate-500">No recent patients</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('/appointments')}
              className="w-full px-4 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Appointment
            </button>

            <button
              onClick={() => {
                navigate('/patients');
                // Small delay to ensure page loads, then scroll to form
                setTimeout(() => {
                  const form = document.getElementById('add-patient-form');
                  if (form) {
                    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    const firstInput = form.querySelector('input');
                    if (firstInput) firstInput.focus();
                  }
                }, 100);
              }}
              className="w-full px-4 py-2.5 text-sm border border-primary text-primary rounded-lg hover:bg-primary/5 transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Register Patient
            </button>
            
            <button 
              onClick={() => navigate('/patients')}
              className="w-full px-4 py-2.5 text-sm border rounded-lg hover:bg-slate-50 transition"
            >
              View All Patients →
            </button>
          </div>
          </div>{/* end sidebar p-4 */}
        </aside>
      </section>

      {/* Add Patient Modal */}
      <AddPatientModal 
        isOpen={showAddPatientModal} 
        onClose={() => setShowAddPatientModal(false)} 
        onSuccess={handlePatientAdded}
      />

      {/* Create Bill Modal */}
      <Modal
        isOpen={showCreateBillModal}
        onClose={() => { setShowCreateBillModal(false); setCreateBillPatient(null); setEditingBillId(null); }}
        title={editingBillId ? 'Edit Receipt / Bill' : 'Create Receipt / Bill'}
      >
        {createBillPatient && (() => {
          const { subtotal, taxAmt, total } = billCalcTotals();
          const amtPaid = parseFloat(billFormData.amount_paid) || 0;
          return (
            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">

              {/* Patient Info */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div><span className="text-blue-600 font-medium">Name: </span>{createBillPatient.patient_name || 'N/A'}</div>
                <div><span className="text-blue-600 font-medium">UHID: </span>{createBillPatient.uhid || createBillPatient.patient_identifier || 'N/A'}</div>
                <div><span className="text-blue-600 font-medium">Phone: </span>{createBillPatient.contact || createBillPatient.phone || 'N/A'}</div>
                <div><span className="text-blue-600 font-medium">Date: </span>{new Date().toLocaleDateString('en-IN')}</div>
              </div>

              {/* Services */}
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-900 text-sm mr-auto">Services</h4>
                  {serviceGroups.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenGroupPopover(openGroupPopover === 'bill' ? null : 'bill')}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition flex items-center gap-1"
                      >
                        Groups
                        <span className="text-xs bg-purple-400 rounded-full px-1.5">{serviceGroups.length}</span>
                      </button>
                      {openGroupPopover === 'bill' && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenGroupPopover(null)} />
                          <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
                            <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-100">
                              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Service Groups</span>
                            </div>
                            <div className="max-h-60 overflow-y-auto py-1">
                              {serviceGroups.map(group => {
                                const svcList = Array.isArray(group.services) ? group.services : [];
                                return (
                                  <button
                                    key={group.id}
                                    type="button"
                                    onClick={() => {
                                      const newItems = svcList.map(s => ({ service_name: s.service_name, qty: 1, unit_price: parseFloat(s.unit_price) || 0, discount: 0, total: parseFloat(s.unit_price) || 0 }));
                                      setBillFormData(prev => {
                                        const existing = [...prev.services];
                                        const hasOnlyEmpty = existing.length === 1 && !existing[0].service_name?.trim();
                                        return { ...prev, services: hasOnlyEmpty ? newItems : [...existing, ...newItems] };
                                      });
                                      setOpenGroupPopover(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center justify-between group transition-colors"
                                  >
                                    <span>{group.group_name}</span>
                                    <span className="text-xs text-gray-400 group-hover:text-purple-400">{svcList.length} svc</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                    <button
                      type="button"
                      onClick={() => { setShowBillServicePicker(true); setBillServiceSearch(''); setBillServiceCategory(''); setBillServicePickerTab('services'); }}
                      className="px-3 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 transition"
                    >
                      + Add from Templates
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillFormData(prev => ({ ...prev, services: [...prev.services, { service_name: '', qty: 1, unit_price: 0, discount: 0, total: 0 }] }))}
                      className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition"
                    >
                      + Add Blank
                    </button>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Amount</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Disc</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {billFormData.services.map((svc, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2">
                            <input type="text" className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400" placeholder="Service name"
                              value={svc.service_name}
                              onChange={e => billHandleServiceChange(idx, 'service_name', e.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" inputMode="numeric" pattern="[0-9]*" className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm text-center focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                              value={svc.qty}
                              onChange={e => billHandleServiceChange(idx, 'qty', e.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" inputMode="decimal" className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                              value={svc.unit_price}
                              onChange={e => billHandleServiceChange(idx, 'unit_price', e.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" inputMode="decimal" className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm text-right focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                              value={svc.discount}
                              onChange={e => billHandleServiceChange(idx, 'discount', e.target.value)} />
                          </td>
                          <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right">₹{(parseFloat(svc.total) || 0).toFixed(0)}</td>
                          <td className="px-2 py-2 text-center">
                            {billFormData.services.length > 1 && (
                              <button type="button" onClick={() => setBillFormData(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== idx) }))}
                                className="text-gray-300 hover:text-red-500 transition-colors text-xl leading-none">×</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tax & Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tax (%)</label>
                  <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border rounded text-sm"
                    value={billFormData.tax}
                    onChange={e => setBillFormData(prev => ({ ...prev, tax: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Discount (₹)</label>
                  <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border rounded text-sm"
                    value={billFormData.discount}
                    onChange={e => setBillFormData(prev => ({ ...prev, discount: e.target.value }))} />
                </div>
              </div>

              {/* Totals */}
              <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-600">Sub-Total:</span><span>₹{subtotal.toFixed(2)}</span></div>
                {taxAmt > 0 && <div className="flex justify-between"><span className="text-slate-600">Tax:</span><span>₹{taxAmt.toFixed(2)}</span></div>}
                {parseFloat(billFormData.discount) > 0 && <div className="flex justify-between"><span className="text-slate-600">Discount:</span><span>-₹{parseFloat(billFormData.discount).toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-1 mt-1">
                  <span>Grand Total:</span><span className="text-blue-600">₹{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                  <select className="w-full px-3 py-2 border rounded text-sm"
                    value={billFormData.payment_method}
                    onChange={e => setBillFormData(prev => ({ ...prev, payment_method: e.target.value }))}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="netbanking">Net Banking</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash+upi">Cash + UPI</option>
                    <option value="cash+card">Cash + Card</option>
                    <option value="insurance">Insurance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Status</label>
                  <select className="w-full px-3 py-2 border rounded text-sm"
                    value={billFormData.payment_status}
                    onChange={e => setBillFormData(prev => ({
                      ...prev,
                      payment_status: e.target.value,
                      amount_paid: e.target.value === 'paid' ? total.toFixed(2) : e.target.value === 'pending' ? '' : prev.amount_paid
                    }))}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount Paid (₹)</label>
                <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border rounded text-sm"
                  value={billFormData.amount_paid}
                  placeholder={`Max: ₹${total.toFixed(2)}`}
                  onChange={e => setBillFormData(prev => ({ ...prev, amount_paid: e.target.value }))} />
                {amtPaid > 0 && amtPaid < total && (
                  <p className="text-xs text-orange-600 mt-1">Remaining: ₹{(total - amtPaid).toFixed(2)}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t sticky bottom-0 bg-white pb-1">
                <button onClick={() => { setShowCreateBillModal(false); setCreateBillPatient(null); }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-gray-50 transition text-sm">
                  Cancel
                </button>
                <button onClick={handleSaveBillDirect} disabled={billCreating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-60 font-semibold text-sm">
                  {billCreating ? (editingBillId ? 'Saving...' : 'Creating...') : (editingBillId ? '✓ Save Changes' : '✓ Create Bill')}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Service Picker Modal for Bill */}
      {showBillServicePicker && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]" onClick={() => setShowBillServicePicker(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg">Select Services</h3>
              <button onClick={() => setShowBillServicePicker(false)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setBillServicePickerTab('services')}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${billServicePickerTab === 'services' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Services
              </button>
              <button
                onClick={() => setBillServicePickerTab('groups')}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${billServicePickerTab === 'groups' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Groups
                {serviceGroups.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">{serviceGroups.length}</span>
                )}
              </button>
            </div>

            {/* Services Tab */}
            {billServicePickerTab === 'services' && <>
              <div className="p-4 border-b">
                <input type="text" placeholder="Search services..."
                  value={billServiceSearch}
                  onChange={e => setBillServiceSearch(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg text-sm focus:outline-none focus:border-purple-500" autoFocus />
              </div>
              <div className="px-4 py-2 border-b flex flex-wrap gap-2">
                <button onClick={() => setBillServiceCategory('')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${billServiceCategory === '' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                  All
                </button>
                {Object.keys(groupedServices).map(cat => (
                  <button key={cat} onClick={() => setBillServiceCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${billServiceCategory === cat ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                    {cat} ({groupedServices[cat]?.length || 0})
                  </button>
                ))}
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-4">
                {(billServiceCategory ? [billServiceCategory] : Object.keys(groupedServices)).map(category => {
                  const svcs = (groupedServices[category] || []).filter(s =>
                    !billServiceSearch || (s.name || s.service_name || '').toLowerCase().includes(billServiceSearch.toLowerCase())
                  );
                  if (svcs.length === 0) return null;
                  return (
                    <div key={category}>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{category}</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {svcs.map((svc, i) => (
                          <button key={i}
                            onClick={() => {
                              setBillFormData(prev => {
                                const newSvc = { service_name: svc.name || svc.service_name, qty: 1, unit_price: parseFloat(svc.price || svc.default_price) || 0, discount: 0, total: parseFloat(svc.price || svc.default_price) || 0 };
                                const existing = [...prev.services];
                                const emptyIdx = existing.findIndex(s => !s.service_name.trim());
                                if (emptyIdx >= 0) { existing[emptyIdx] = newSvc; } else { existing.push(newSvc); }
                                return { ...prev, services: existing };
                              });
                              setShowBillServicePicker(false);
                            }}
                            className="text-left p-2 border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition text-sm">
                            <div className="font-medium text-slate-800 text-xs leading-tight">{svc.name || svc.service_name}</div>
                            <div className="text-purple-600 font-bold text-xs mt-0.5">₹{parseFloat(svc.price || svc.default_price || 0).toFixed(0)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.keys(groupedServices).length === 0 && (
                  <p className="text-center text-slate-400 py-8 text-sm">No services found. Add services from Billing settings.</p>
                )}
              </div>
            </>}

            {/* Groups Tab */}
            {billServicePickerTab === 'groups' && (
              <div className="overflow-y-auto flex-1 p-4">
                {serviceGroups.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <div className="text-3xl mb-2">📦</div>
                    <p className="text-sm">No groups yet.</p>
                    <p className="text-xs mt-1">Create groups from the Billing page → Add from Templates → Groups tab.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {serviceGroups.map(group => {
                      const svcList = Array.isArray(group.services) ? group.services : [];
                      const total = svcList.reduce((sum, s) => sum + (parseFloat(s.unit_price) || 0), 0);
                      return (
                        <button
                          key={group.id}
                          onClick={() => {
                            const newItems = svcList.map(s => ({
                              service_name: s.service_name,
                              qty: 1,
                              unit_price: parseFloat(s.unit_price) || 0,
                              discount: 0,
                              total: parseFloat(s.unit_price) || 0
                            }));
                            setBillFormData(prev => {
                              const existing = [...prev.services];
                              const hasOnlyEmpty = existing.length === 1 && !existing[0].service_name?.trim();
                              return { ...prev, services: hasOnlyEmpty ? newItems : [...existing, ...newItems] };
                            });
                            setShowBillServicePicker(false);
                          }}
                          className="text-left border-2 border-purple-200 rounded-lg p-3 hover:border-purple-500 hover:bg-purple-50 transition"
                        >
                          <div className="font-semibold text-sm text-gray-900 mb-1">{group.group_name}</div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {svcList.slice(0, 4).map((s, i) => (
                              <span key={i} className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{s.service_name}</span>
                            ))}
                            {svcList.length > 4 && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">+{svcList.length - 4} more</span>}
                          </div>
                          <div className="text-xs text-gray-500">{svcList.length} services • <span className="font-medium text-purple-700">₹{total.toFixed(0)}</span></div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setShowBillServicePicker(false)}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition">
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Register Modal for Staff */}
      {showQuickRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Quick Register Patient</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Name *
                </label>
                <input
                  type="text"
                  value={quickRegisterForm.name}
                  onChange={(e) => setQuickRegisterForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Enter patient name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={quickRegisterForm.phone}
                  onChange={(e) => setQuickRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Enter phone number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consultation Fee
                </label>
                <input
                  type="number"
                  value={quickRegisterForm.consultation_fee}
                  onChange={(e) => setQuickRegisterForm(prev => ({ ...prev, consultation_fee: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Consultation fee"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleQuickRegister}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Register & Create Bill'}
              </button>
              <button
                onClick={() => {
                  setShowQuickRegisterModal(false);
                  setQuickRegisterForm({ name: '', phone: '', consultation_fee: 500 });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}