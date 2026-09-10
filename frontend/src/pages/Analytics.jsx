import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../api/client';
import { getLocalDateString } from '../utils/localDate';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const formatToIST = (dateString) => {
  if (!dateString) return dateString;
  if (dateString.includes('T') && dateString.includes('Z')) {
    const date = new Date(dateString);
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    return istDate.toISOString().split('T')[0];
  }
  return dateString;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 border border-gray-200 rounded-xl shadow-lg">
        <p className="font-semibold text-gray-700 mb-2 text-xs">{formatToIST(label)}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-xs font-medium">
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Spinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500 font-medium">Loading data…</p>
    </div>
  </div>
);

const ChartCard = ({ title, icon, children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${className}`}>
    <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const MetricCard = ({ label, value, icon, color, sub }) => {
  const colors = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   icon: 'bg-blue-100 text-blue-600'   },
    green:  { bg: 'bg-emerald-50',text: 'text-emerald-600',icon: 'bg-emerald-100 text-emerald-600'},
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'bg-purple-100 text-purple-600' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  icon: 'bg-amber-100 text-amber-600'  },
    red:    { bg: 'bg-red-50',    text: 'text-red-600',    icon: 'bg-red-100 text-red-600'      },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'bg-indigo-100 text-indigo-600'},
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={`${c.bg} rounded-2xl p-5 flex items-start gap-4 border border-white shadow-sm`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${c.text}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const FilterBar = ({ children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 flex flex-wrap items-end gap-4 mb-6">
    {children}
  </div>
);

const DateInput = ({ label, value, onChange }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    <input
      type="date"
      value={value}
      onChange={onChange}
      className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-400"
    />
  </div>
);

const ApplyBtn = ({ onClick }) => (
  <button
    onClick={onClick}
    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
  >
    Apply
  </button>
);

// ── SVG Icons ──────────────────────────────────────────────────────────────
const IconCalendar = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconUsers = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const IconUserPlus = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
  </svg>
);
const IconCurrency = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
);
const IconClock = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconTrend = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const IconPie = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M21.21 15.89A10 10 0 118 2.83"/><path d="M22 12A10 10 0 0012 2v10z"/>
  </svg>
);
const IconBar = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);
const IconPill = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M10.5 20.5L3.5 13.5a5 5 0 017.07-7.07l7 7a5 5 0 01-7.07 7.07z"/><line x1="8.5" y1="11.5" x2="15.5" y2="4.5"/>
  </svg>
);
const IconHeart = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
  </svg>
);
const IconDoor = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IconRefresh = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
);
const IconMapPin = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconReceipt = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IconStar = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconStethoscope = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6v0a6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3"/>
    <path d="M8 15v1a6 6 0 006 6v0a6 6 0 006-6v-4"/>
    <circle cx="20" cy="10" r="2"/>
  </svg>
);
// ────────────────────────────────────────────────────────────────────────────

// Search input component
const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-48"
    />
  </div>
);

export default function Analytics() {
  const api = useApiClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  // Global doctor filter
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');

  const [overview, setOverview] = useState(null);
  const [period, setPeriod] = useState('month');

  const [visitAnalytics, setVisitAnalytics] = useState(null);
  const [visitGroupBy, setVisitGroupBy] = useState('day');
  const [visitDateRange, setVisitDateRange] = useState({
    start_date: getLocalDateString(new Date(Date.now() - 30 * 86400000)),
    end_date: getLocalDateString()
  });

  const [medicationAnalytics, setMedicationAnalytics] = useState(null);
  const [medDateRange, setMedDateRange] = useState({
    start_date: getLocalDateString(new Date(Date.now() - 30 * 86400000)),
    end_date: getLocalDateString()
  });
  const [medSearch, setMedSearch] = useState('');

  const [symptomsAnalytics, setSymptomsAnalytics] = useState(null);
  const [symptomSearch, setSymptomSearch] = useState('');

  const [paymentAnalytics, setPaymentAnalytics] = useState(null);
  const [paymentDateRange, setPaymentDateRange] = useState({
    start_date: getLocalDateString(new Date(Date.now() - 30 * 86400000)),
    end_date: getLocalDateString()
  });

  const [demographics, setDemographics] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedAppointments, setSelectedAppointments] = useState([]);
  const [selectedLoading, setSelectedLoading] = useState(false);

  // Load doctors list on mount
  useEffect(() => {
    api.get('/api/enhanced-analytics/doctors')
      .then(r => setDoctors(r.data?.data?.doctors || r.data?.doctors || []))
      .catch(() => {});
  }, []);

  const fetchSelectedAppointments = async (status) => {
    try {
      setSelectedLoading(true);
      const res = await api.get('/api/appointments', { params: { status, limit: 100 } });
      setSelectedAppointments(res.data?.data?.data || res.data?.data?.appointments || res.data?.appointments || []);
    } catch { setSelectedAppointments([]); }
    finally { setSelectedLoading(false); }
  };

  const fetchOverview = useCallback(async () => {
    try { setLoading(true); const res = await api.get('/api/enhanced-analytics/dashboard/overview', { params: { period, ...(doctorId && { doctor_id: doctorId }) } }); setOverview(res.data?.data || res.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [period, doctorId]);

  const fetchVisitAnalytics = useCallback(async () => {
    try { setLoading(true); const res = await api.get('/api/enhanced-analytics/visits', { params: { ...visitDateRange, group_by: visitGroupBy, ...(doctorId && { doctor_id: doctorId }) } }); setVisitAnalytics(res.data?.data || res.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [visitDateRange, visitGroupBy, doctorId]);

  const fetchMedicationAnalytics = useCallback(async () => {
    try { setLoading(true); const res = await api.get('/api/enhanced-analytics/medications', { params: { ...medDateRange, ...(doctorId && { doctor_id: doctorId }), ...(medSearch && { search: medSearch }) } }); setMedicationAnalytics(res.data?.data || res.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [medDateRange, doctorId, medSearch]);

  const fetchSymptomsAnalytics = useCallback(async () => {
    try { setLoading(true); const res = await api.get('/api/enhanced-analytics/symptoms', { params: { ...medDateRange, ...(doctorId && { doctor_id: doctorId }), ...(symptomSearch && { search: symptomSearch }) } }); setSymptomsAnalytics(res.data?.data || res.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [medDateRange, doctorId, symptomSearch]);

  const fetchPaymentAnalytics = useCallback(async () => {
    try { setLoading(true); const res = await api.get('/api/enhanced-analytics/payments', { params: paymentDateRange }); setPaymentAnalytics(res.data?.data || res.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, [paymentDateRange]);

  const fetchDemographics = useCallback(async () => {
    try { setLoading(true); const res = await api.get('/api/enhanced-analytics/demographics'); setDemographics(res.data?.data || res.data); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    switch (activeTab) {
      case 'overview': fetchOverview(); break;
      case 'visits': fetchVisitAnalytics(); break;
      case 'medications': fetchMedicationAnalytics(); fetchSymptomsAnalytics(); break;
      case 'payments': fetchPaymentAnalytics(); break;
      case 'demographics': fetchDemographics(); break;
    }
  }, [activeTab, fetchOverview, fetchVisitAnalytics, fetchMedicationAnalytics, fetchSymptomsAnalytics, fetchPaymentAnalytics, fetchDemographics]);

  // ── TABS CONFIG ────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview',     label: 'Overview',     icon: <IconPie /> },
    { id: 'visits',       label: 'Visits',       icon: <IconTrend /> },
    { id: 'medications',  label: 'Medications',  icon: <IconPill /> },
    { id: 'payments',     label: 'Payments',     icon: <IconCurrency /> },
    { id: 'demographics', label: 'Demographics', icon: <IconUsers /> },
  ];

  // ── OVERVIEW ───────────────────────────────────────────────────────────────
  const renderOverview = () => {
    const statusData = overview ? [
      { name: 'Scheduled', value: overview.scheduled_appointments || 0, color: '#3B82F6' },
      { name: 'Completed', value: overview.completed_appointments || 0, color: '#10B981' },
      { name: 'Cancelled', value: overview.cancelled_appointments || 0, color: '#EF4444' },
      { name: 'No-Show',   value: overview.noshow_appointments || 0,    color: '#F59E0B' },
    ] : [];
    const arrivalData = overview ? [
      { name: 'Online',    count: overview.online_arrivals    || 0 },
      { name: 'Walk-in',   count: overview.walkin_arrivals    || 0 },
      { name: 'Referral',  count: overview.referral_arrivals  || 0 },
      { name: 'Emergency', count: overview.emergency_arrivals || 0 },
    ] : [];

    return (
      <div className="space-y-6">
        <FilterBar>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="3months">Last 3 Months</option>
              <option value="year">Last Year</option>
            </select>
          </div>
          {doctors.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Doctor</label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Doctors</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` (${d.specialization})` : ''}</option>)}
              </select>
            </div>
          )}
          <button
            onClick={fetchOverview}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <IconRefresh /> Refresh
          </button>
        </FilterBar>

        {loading ? <Spinner /> : overview ? (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
              <MetricCard label="Total Appointments" value={overview.total_appointments || 0}    icon={<IconCalendar />} color="blue" />
              <MetricCard label="Total Patients"     value={overview.total_patients || 0}        icon={<IconUsers />}    color="green" />
              <MetricCard label="New Patients"       value={overview.new_patients || 0}           icon={<IconUserPlus />} color="purple" />
              <MetricCard label="Total Revenue"      value={`₹${overview.total_revenue || 0}`}   icon={<IconCurrency />} color="amber" />
              <MetricCard label="Avg Wait Time"      value={`${overview.avg_waiting_time || 0}m`} icon={<IconClock />}    color="red" />
              <MetricCard label="Avg Visit Time"     value={`${overview.avg_visit_duration || 0}m`} icon={<IconTrend />} color="indigo" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Appointment Status" icon={<IconPie />}>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%" cy="50%"
                      labelLine={false}
                      label={({ _name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                      outerRadius={95}
                      dataKey="value"
                    >
                      {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[
                    { label: 'Scheduled', val: overview.scheduled_appointments || 0, bg: 'bg-blue-50', text: 'text-blue-600' },
                    { label: 'Completed', val: overview.completed_appointments  || 0, bg: 'bg-emerald-50', text: 'text-emerald-600', clickable: true },
                    { label: 'Cancelled', val: overview.cancelled_appointments  || 0, bg: 'bg-red-50',     text: 'text-red-600'   },
                    { label: 'No-Show',   val: overview.noshow_appointments     || 0, bg: 'bg-amber-50',   text: 'text-amber-600' },
                  ].map(({ label, val, bg, text, clickable }) => (
                    <div
                      key={label}
                      className={`text-center p-3 ${bg} rounded-xl ${clickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                      onClick={clickable ? () => { const next = selectedStatus === 'completed' ? null : 'completed'; setSelectedStatus(next); if (next) fetchSelectedAppointments(next); } : undefined}
                    >
                      <p className="text-xs text-gray-500 font-medium">{label}</p>
                      <p className={`text-xl font-bold ${text}`}>{val}</p>
                    </div>
                  ))}
                </div>
              </ChartCard>

              <ChartCard title="Patient Arrival Type" icon={<IconDoor />}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={arrivalData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Patients">
                      {arrivalData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[
                    { label: 'Online', val: overview.online_arrivals || 0, text: 'text-blue-600' },
                    { label: 'Walk-in', val: overview.walkin_arrivals || 0, text: 'text-emerald-600' },
                    { label: 'Referral', val: overview.referral_arrivals || 0, text: 'text-amber-600' },
                    { label: 'Emergency', val: overview.emergency_arrivals || 0, text: 'text-red-600' },
                  ].map(({ label, val, text }) => (
                    <div key={label} className="text-center p-2 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className={`text-lg font-bold ${text}`}>{val}</p>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>

            {/* Completed Appointments Drill-down */}
            {selectedStatus && (
              <ChartCard title={`${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Appointments`} icon={<IconCalendar />}>
                {selectedLoading ? <Spinner /> : selectedAppointments.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">No appointments found.</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {selectedAppointments.map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-blue-50 transition-colors">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{apt.patient_name || apt.uhid || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{apt.appointment_date} · {apt.appointment_time} · {apt.doctor_name || ''}</p>
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">{apt.payment_status || 'pending'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">No data available</div>
        )}
      </div>
    );
  };

  // ── VISITS ─────────────────────────────────────────────────────────────────
  const renderVisitAnalytics = () => (
    <div className="space-y-6">
      <FilterBar>
        <DateInput label="Start Date" value={visitDateRange.start_date} onChange={(e) => setVisitDateRange({ ...visitDateRange, start_date: e.target.value })} />
        <DateInput label="End Date"   value={visitDateRange.end_date}   onChange={(e) => setVisitDateRange({ ...visitDateRange, end_date:   e.target.value })} />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Group By</label>
          <select
            value={visitGroupBy}
            onChange={(e) => setVisitGroupBy(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        {doctors.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Doctor</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">All Doctors</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <ApplyBtn onClick={fetchVisitAnalytics} />
      </FilterBar>

      {loading ? <Spinner /> : visitAnalytics ? (
        <>
          {/* Visit Trend */}
          <ChartCard title="Visit Trends Over Time" icon={<IconTrend />}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={visitAnalytics.visit_trends || []}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis dataKey="period" tickFormatter={formatToIST} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="total_visits"     stroke="#3B82F6" fill="url(#gTotal)"     strokeWidth={2.5} name="Total Visits" />
                <Area type="monotone" dataKey="completed_visits" stroke="#10B981" fill="url(#gCompleted)" strokeWidth={2.5} name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak Hours */}
            <ChartCard title="Peak Hours" icon={<IconClock />}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={visitAnalytics.peak_hours || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="visit_count" radius={[6, 6, 0, 0]} name="Visits">
                    {(visitAnalytics.peak_hours || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Top Doctors */}
            <ChartCard title="Top Doctors by Visits" icon={<IconStethoscope />}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={(visitAnalytics.top_doctors || []).slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="doctor_name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="visit_count" radius={[0, 6, 6, 0]} name="Visits">
                    {(visitAnalytics.top_doctors || []).slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Visit Detail Table */}
          {visitAnalytics.visit_trends && visitAnalytics.visit_trends.length > 0 && (
            <ChartCard title="Visit Detail" icon={<IconBar />}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Period','Total','Completed','Cancelled','No-Show','Walk-in','Online','Avg Wait'].map(h => (
                        <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visitAnalytics.visit_trends.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-gray-700">{formatToIST(row.period)}</td>
                        <td className="py-2.5 px-3 font-bold text-blue-600">{row.total_visits}</td>
                        <td className="py-2.5 px-3 text-emerald-600">{row.completed_visits}</td>
                        <td className="py-2.5 px-3 text-red-500">{row.cancelled_visits}</td>
                        <td className="py-2.5 px-3 text-amber-600">{row.noshow_visits}</td>
                        <td className="py-2.5 px-3 text-gray-600">{row.walkin_visits}</td>
                        <td className="py-2.5 px-3 text-gray-600">{row.online_visits}</td>
                        <td className="py-2.5 px-3 text-gray-600">{row.avg_waiting_time ? `${Math.round(row.avg_waiting_time)}m` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-gray-400">No data available</div>
      )}
    </div>
  );

  // ── MEDICATIONS ────────────────────────────────────────────────────────────
  const renderMedications = () => (
    <div className="space-y-6">
      <FilterBar>
        <DateInput label="Start Date" value={medDateRange.start_date} onChange={(e) => setMedDateRange({ ...medDateRange, start_date: e.target.value })} />
        <DateInput label="End Date"   value={medDateRange.end_date}   onChange={(e) => setMedDateRange({ ...medDateRange, end_date:   e.target.value })} />
        {doctors.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Doctor</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">All Doctors</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Search Medication</label>
          <SearchInput value={medSearch} onChange={(e) => setMedSearch(e.target.value)} placeholder="e.g. Paracetamol" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Search Symptom</label>
          <SearchInput value={symptomSearch} onChange={(e) => setSymptomSearch(e.target.value)} placeholder="e.g. Fever" />
        </div>
        <ApplyBtn onClick={() => { fetchMedicationAnalytics(); fetchSymptomsAnalytics(); }} />
      </FilterBar>

      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Medications */}
            <ChartCard title="Top Prescribed Medications" icon={<IconPill />}>
              {medicationAnalytics?.top_medications?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={medicationAnalytics.top_medications.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="medicine_name" type="category" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="prescription_count" radius={[0, 6, 6, 0]} name="Prescriptions">
                      {medicationAnalytics.top_medications.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available</div>}
            </ChartCard>

            {/* Medication Categories */}
            <ChartCard title="Medication Categories" icon={<IconPie />}>
              {medicationAnalytics?.medication_categories?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={medicationAnalytics.medication_categories}
                      cx="50%" cy="50%"
                      labelLine={false}
                      label={({ _name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                      outerRadius={110}
                      dataKey="count"
                    >
                      {medicationAnalytics.medication_categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available</div>}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Common Symptoms */}
            <ChartCard title="Common Symptoms" icon={<IconHeart />}>
              {symptomsAnalytics?.top_symptoms?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={symptomsAnalytics.top_symptoms.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="symptom" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="frequency" radius={[6, 6, 0, 0]} name="Frequency">
                      {symptomsAnalytics.top_symptoms.slice(0, 8).map((_item, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available</div>}
            </ChartCard>

            {/* Common Diagnoses */}
            <ChartCard title="Common Diagnoses" icon={<IconStethoscope />}>
              {symptomsAnalytics?.top_diagnoses?.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={symptomsAnalytics.top_diagnoses.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="diagnosis" type="category" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="frequency" radius={[0, 6, 6, 0]} name="Frequency">
                      {symptomsAnalytics.top_diagnoses.slice(0, 10).map((_item, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available</div>}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );

  // ── PAYMENTS ───────────────────────────────────────────────────────────────
  const renderPayments = () => {
    const paymentMethodsData = (paymentAnalytics?.payment_methods || []).map(m => ({
      name: m.payment_method,
      value: parseFloat(m.total_amount || 0)
    }));

    return (
      <div className="space-y-6">
        <FilterBar>
          <DateInput label="Start Date" value={paymentDateRange.start_date} onChange={(e) => setPaymentDateRange({ ...paymentDateRange, start_date: e.target.value })} />
          <DateInput label="End Date"   value={paymentDateRange.end_date}   onChange={(e) => setPaymentDateRange({ ...paymentDateRange, end_date:   e.target.value })} />
          <ApplyBtn onClick={fetchPaymentAnalytics} />
        </FilterBar>

        {loading ? <Spinner /> : paymentAnalytics ? (
          <>
            {/* Revenue Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard label="Total Revenue"    value={`₹${paymentAnalytics.total_revenue || 0}`}    icon={<IconCurrency />} color="green" />
              <MetricCard label="Total Bills"      value={paymentAnalytics.total_bills || 0}             icon={<IconReceipt />}  color="blue" />
              <MetricCard label="Avg Bill Amount"  value={`₹${paymentAnalytics.avg_bill_amount || 0}`}  icon={<IconBar />}      color="purple" />
            </div>

            {/* Revenue Trend */}
            <ChartCard title="Revenue Trend Over Time" icon={<IconTrend />}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={paymentAnalytics.daily_revenue || []}>
                  <defs>
                    <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/></filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="period" tickFormatter={formatToIST} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => `₹${v}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue"      stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} name="Total Revenue" />
                  <Line type="monotone" dataKey="paid_revenue" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4 }} name="Paid Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Methods */}
              <ChartCard title="Payment Methods" icon={<IconPie />}>
                {paymentMethodsData.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={paymentMethodsData} cx="50%" cy="50%" labelLine={false}
                          label={({ _name, percent }) => percent > 0.05 ? `${(percent*100).toFixed(0)}%` : ''}
                          outerRadius={95} dataKey="value"
                        >
                          {paymentMethodsData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `₹${v}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-2">
                      {paymentAnalytics.payment_methods.map((m, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="text-sm font-medium capitalize text-gray-700">{m.payment_method}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-600">₹{m.total_amount}</p>
                            <p className="text-xs text-gray-400">{m.count} bills</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available</div>}
              </ChartCard>

              {/* Top Patients */}
              <ChartCard title="Top Patients by Revenue" icon={<IconStar />}>
                {paymentAnalytics.top_patients?.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={paymentAnalytics.top_patients.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="patient_name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `₹${v}`} />
                      <Bar dataKey="total_spent" radius={[0, 6, 6, 0]} name="Total Spent">
                        {paymentAnalytics.top_patients.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available</div>}
              </ChartCard>
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">No data available</div>
        )}
      </div>
    );
  };

  // ── DEMOGRAPHICS ───────────────────────────────────────────────────────────
  const renderDemographics = () => (
    <div className="space-y-6">
      {loading ? <Spinner /> : demographics ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Age Distribution */}
            <ChartCard title="Age Distribution" icon={<IconUsers />}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={demographics.age_distribution || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="age_group" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="patient_count" radius={[8, 8, 0, 0]} name="Patients">
                    {(demographics.age_distribution || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Gender Distribution */}
            <ChartCard title="Gender Distribution" icon={<IconPie />}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={demographics.gender_distribution || []}
                    cx="50%" cy="50%"
                    labelLine={false}
                    label={({ gender, percentage }) => `${gender}: ${percentage}%`}
                    outerRadius={100}
                    dataKey="patient_count"
                  >
                    {(demographics.gender_distribution || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Blood Group */}
            <ChartCard title="Blood Group Distribution" icon={<IconHeart />}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={demographics.blood_group_distribution || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="blood_group" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="patient_count" radius={[8, 8, 0, 0]} name="Patients">
                    {(demographics.blood_group_distribution || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Patient Source */}
            <ChartCard title="Patient Source" icon={<IconDoor />}>
              {demographics.patient_source?.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={demographics.patient_source}
                      cx="50%" cy="50%"
                      labelLine={false}
                      label={({ source, patient_count }) => `${source || 'Direct'}: ${patient_count}`}
                      outerRadius={100}
                      dataKey="patient_count"
                    >
                      {demographics.patient_source.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available</div>}
            </ChartCard>
          </div>

          {/* Top Cities */}
          <ChartCard title="Top Cities" icon={<IconMapPin />}>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={(demographics.location_distribution || []).slice(0, 15)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="city" type="category" width={130} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="patient_count" radius={[0, 6, 6, 0]} name="Patients">
                  {(demographics.location_distribution || []).slice(0, 15).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      ) : (
        <div className="text-center py-16 text-gray-400">No data available</div>
      )}
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-6 pt-8 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-4 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-blue-200 text-sm mt-1">Comprehensive insights into your clinic's performance</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white">
            <IconPie />
          </div>
        </div>

        {/* Tab Bar inside banner */}
        <div className="flex gap-1 mt-6 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-blue-700 shadow-md'
                  : 'text-blue-100 hover:bg-white/15'
              }`}
            >
              <span className="w-4 h-4">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview'     && renderOverview()}
        {activeTab === 'visits'       && renderVisitAnalytics()}
        {activeTab === 'medications'  && renderMedications()}
        {activeTab === 'payments'     && renderPayments()}
        {activeTab === 'demographics' && renderDemographics()}
      </div>
    </div>
  );
}
