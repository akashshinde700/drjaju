import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { getSelectedDoctorId, isAdmin } from '../utils/doctorUtils';
import ConfigurePatientModal from '../components/ConfigurePatientModal';
import AddPatientModal from '../components/AddPatientModal';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';

const tabs = ['All Patients', 'Patients with ABHA', 'Patients with linked records'];

const GENDER_COLORS = {
  Male:   'bg-blue-100 text-blue-700',
  Female: 'bg-pink-100 text-pink-700',
  Other:  'bg-purple-100 text-purple-700',
};

const BLOOD_COLORS = {
  'A+': 'bg-red-50 text-red-700 border border-red-200',
  'A-': 'bg-red-50 text-red-700 border border-red-200',
  'B+': 'bg-orange-50 text-orange-700 border border-orange-200',
  'B-': 'bg-orange-50 text-orange-700 border border-orange-200',
  'O+': 'bg-amber-50 text-amber-700 border border-amber-200',
  'O-': 'bg-amber-50 text-amber-700 border border-amber-200',
  'AB+': 'bg-purple-50 text-purple-700 border border-purple-200',
  'AB-': 'bg-purple-50 text-purple-700 border border-purple-200',
};

const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
];

function Avatar({ name, size = 'md' }) {
  const initials = name ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';
  const grad = AVATAR_GRADIENTS[(initials.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  return (
    <div className={`flex-shrink-0 ${sz} rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold shadow-sm select-none`}>
      {initials}
    </div>
  );
}

export default function Patients() {
  const api = useApiClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [activeTab, setActiveTab] = useState(0);

  const { query: search, setQuery } = useDebouncedSearch(
    useCallback(async () => {}, []),
    300
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(null);
  const [filterGender, setFilterGender] = useState('');
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [filterBloodGroup, setFilterBloodGroup] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [tabCounts, _setTabCounts] = useState({ 0: 0, 1: 0, 2: 0 });
  const [showConfigure, setShowConfigure] = useState(false);

  const hasActiveFilters = filterGender || filterBloodGroup || filterCity || filterState;

  useEffect(() => { setPage(1); }, [search]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        search, page, limit,
        gender: filterGender || undefined,
        blood_group: filterBloodGroup || undefined,
        city: filterCity || undefined,
        state: filterState || undefined,
        tab: activeTab,
      };
      if (isAdmin(user)) {
        const selectedDoctorId = getSelectedDoctorId();
        if (selectedDoctorId) params.doctor_id = selectedDoctorId;
      } else if (user?.role === 'doctor' && user?.doctor_id) {
        params.doctor_id = user.doctor_id;
      }
      Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);
      const res = await api.get('/api/patients', { params });
      const responseData = res.data?.data || {};
      setPatients(responseData.data || responseData.patients || []);
      if (responseData.pagination) setPagination(responseData.pagination);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load patients');
    } finally {
      setLoading(false);
    }
  }, [api, search, page, limit, filterGender, filterBloodGroup, filterCity, filterState, activeTab, user]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const handlePatientAdded = useCallback(() => { setPage(1); fetchPatients(); }, [fetchPatients]);

  const handlePatientSelect = id =>
    setSelectedPatients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAbhaClick = (p) => {
    try { localStorage.setItem('abha_selected_patient', JSON.stringify(p)); } catch (_error) {
      // Error setting localStorage ignored
    }
    navigate('/abha');
  };

  const handleMerge = async () => {
    if (selectedPatients.length < 2) { addToast('Select at least 2 patients', 'warning'); return; }
    try {
      await api.post('/api/patients/merge', {
        primaryPatientId: selectedPatients[0],
        patientIdsToMerge: selectedPatients.slice(1),
      });
      addToast('Merged successfully', 'success');
      setShowMergeModal(false);
      setSelectedPatients([]);
      fetchPatients();
    } catch { addToast('Merge failed', 'error'); }
  };

  const handleDelete = async (p) => {
    setDropdownOpen(null);
    if (!window.confirm(`Delete patient "${p.name}"?\n\nAll records (appointments, bills, prescriptions) will also be deleted.`)) return;
    try {
      const res = await api.delete(`/api/patients/${p.id}`);
      addToast(res.data.message || 'Patient deleted', 'success');
      setPatients(prev => prev.filter(x => x.id !== p.id));
      await fetchPatients();
    } catch (err) {
      addToast(err.response?.data?.error || 'Delete failed', 'error');
      await fetchPatients();
    }
  };

  const clearFilters = () => {
    setFilterGender(''); setFilterBloodGroup(''); setFilterCity(''); setFilterState('');
    setPage(1); fetchPatients();
  };

  const totalPatients = pagination.total || patients.length;
  const totalPages = pagination.pages || 1;
  const allChecked = patients.length > 0 && patients.every(p => selectedPatients.includes(p.id));

  // Page number range
  const pageNums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pageNums.push(i);

  if (error && patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p className="text-gray-600 font-medium text-center">{error}</p>
        <button onClick={() => { setError(''); fetchPatients(); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-0 pb-20">

      {/* ── Hero Banner (negative margin to reach edges inside MainLayout) ── */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 -mx-4 -mt-4 lg:-mx-6 lg:-mt-6 px-4 lg:px-8 py-5 shadow-lg mb-5">
        <div className="max-w-7xl mx-auto">
          {/* Top row: title + primary actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Patient Registry</h1>
              <p className="text-blue-200 text-xs mt-0.5">
                {totalPatients.toLocaleString()} patients
                {search && ` · "${search}"`}
                {hasActiveFilters && ` · Filtered`}
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              {selectedPatients.length > 0 && (
                <button
                  onClick={() => selectedPatients.length < 2 ? addToast('Select at least 2 patients', 'warning') : setShowMergeModal(true)}
                  className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-amber-900 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M18 2l4 4-4 4M6 22l-4-4 4-4M14 6H2M22 18H10"/>
                  </svg>
                  Merge ({selectedPatients.length})
                </button>
              )}
              <button
                onClick={() => setShowConfigure(true)}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-medium px-3 py-2 rounded-xl transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                </svg>
                <span className="hidden sm:inline">Configure</span>
              </button>
              <button
                onClick={() => setShowAddPatientModal(true)}
                className="flex items-center gap-1.5 bg-white text-blue-700 text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Patient
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {[
              { label: 'Total', value: tabCounts[0] || totalPatients, color: 'text-white' },
              { label: 'With ABHA', value: tabCounts[1] || 0, color: 'text-green-300' },
              { label: 'Linked Records', value: tabCounts[2] || 0, color: 'text-blue-200' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={`text-lg font-bold ${s.color}`}>{s.value.toLocaleString()}</span>
                <span className="text-blue-300 text-xs">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">

        {/* ── Tabs (scrollable on mobile) ── */}
        <div className="overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
          <div className="flex gap-2 min-w-max lg:min-w-0 lg:flex-wrap">
            {tabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(i); setPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === i
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {tab}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === i ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {(tabCounts[i] || 0).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Search & Filter ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          {/* Search row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                autoComplete="off"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                placeholder="Search by name, UHID, phone, email…"
                value={search}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-xl border transition-colors flex-1 sm:flex-none justify-center ${
                  showAdvancedFilters || hasActiveFilters
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Filters
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0"/>}
              </button>
              <button
                onClick={() => { setPage(1); fetchPatients(); }}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex-1 sm:flex-none justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="border-t border-gray-100 pt-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter Options</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <select className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                  <option value="">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                <select className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors" value={filterBloodGroup} onChange={e => setFilterBloodGroup(e.target.value)}>
                  <option value="">All Blood Groups</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g}>{g}</option>)}
                </select>
                <input className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors" placeholder="City" value={filterCity} onChange={e => setFilterCity(e.target.value)} />
                <input className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors" placeholder="State" value={filterState} onChange={e => setFilterState(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={clearFilters} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Clear All
                </button>
                <button onClick={() => { setPage(1); fetchPatients(); setShowAdvancedFilters(false); }} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Patient Table ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* ── Desktop Table Header ── */}
          <div className="hidden md:block bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
            <div className="grid items-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3"
              style={{ gridTemplateColumns: '2.5rem 1fr 10rem 5rem 8rem 6rem 11rem' }}>
              <span>
                <input type="checkbox" checked={allChecked}
                  onChange={e => e.target.checked ? setSelectedPatients(patients.map(p => p.id)) : setSelectedPatients([])}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
              </span>
              <span>Patient</span>
              <span>UHID / Phone</span>
              <span>Blood</span>
              <span>ABHA</span>
              <span>Follow Up</span>
              <span className="text-right">Actions</span>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"/>
              <p className="text-sm text-gray-400 font-medium">Loading patients…</p>
            </div>
          )}

          {/* Error inline */}
          {!loading && error && (
            <div className="flex items-center gap-3 p-5 bg-red-50 border-b border-red-100 text-red-600">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span className="text-sm">{error}</span>
              <button onClick={fetchPatients} className="ml-auto text-xs underline">Retry</button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && patients.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No patients found</p>
              <p className="text-gray-400 text-sm">Try adjusting your search or filters</p>
              <button onClick={() => setShowAddPatientModal(true)} className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add First Patient
              </button>
            </div>
          )}

          {/* ── DESKTOP ROWS ── */}
          {!loading && !error && patients.length > 0 && (
            <div className="hidden md:block divide-y divide-gray-50">
              {patients.map((p, idx) => {
                const isSelected = selectedPatients.includes(p.id);
                const genderLabel = p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : p.gender || '';
                const genderCls = GENDER_COLORS[genderLabel] || 'bg-gray-100 text-gray-600';
                const bloodCls = BLOOD_COLORS[p.blood_group] || 'bg-gray-50 text-gray-500';
                const age = p.age_years ?? (p.dob
                  ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 86400000))
                  : null);

                return (
                  <div
                    key={p.id || idx}
                    onClick={() => navigate(`/patient-overview/${p.id}`)}
                    className={`grid items-center px-5 py-3.5 text-sm transition-colors cursor-pointer group border-l-4 ${
                      isSelected
                        ? 'border-l-blue-500 bg-blue-50/60'
                        : 'border-l-transparent hover:bg-slate-50/80'
                    }`}
                    style={{ gridTemplateColumns: '2.5rem 1fr 10rem 5rem 8rem 6rem 11rem' }}
                  >
                    {/* Checkbox */}
                    <div onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => handlePatientSelect(p.id)}
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                    </div>

                    {/* Patient */}
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <Avatar name={p.name} />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors text-sm">{p.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {genderLabel && <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${genderCls}`}>{genderLabel}</span>}
                          {age !== null && age !== undefined && <span className="text-xs text-gray-400">{age}y</span>}
                        </div>
                      </div>
                    </div>

                    {/* UHID / Phone */}
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-mono font-semibold text-gray-600 truncate">{p.patient_id || '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{p.phone || '—'}</p>
                    </div>

                    {/* Blood group */}
                    <div>
                      {p.blood_group
                        ? <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${bloodCls}`}>{p.blood_group}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </div>

                    {/* ABHA */}
                    <div onClick={e => e.stopPropagation()}>
                      {p.abha_id ? (
                        <button onClick={() => handleAbhaClick(p)}
                          className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                          Linked
                        </button>
                      ) : (
                        <button onClick={() => handleAbhaClick(p)}
                          className="flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-600 text-xs font-medium rounded-lg hover:bg-rose-100 transition-colors border border-rose-200">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Link ABHA
                        </button>
                      )}
                    </div>

                    {/* Follow Up */}
                    <div>
                      {p.follow_up
                        ? <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">{p.follow_up}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      <a href={`/orders/${p.id}`}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                        Visit
                      </a>
                      <a href={`/patient-overview/${p.id}`}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 hover:border-blue-300 hover:text-blue-700 transition-colors">
                        Overview
                      </a>
                      <div className="relative">
                        <button
                          onClick={() => setDropdownOpen(dropdownOpen === p.id ? null : p.id)}
                          className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                        </button>
                        {dropdownOpen === p.id && (
                          <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                            <button onClick={() => handleDelete(p)}
                              className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                              Delete Patient
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── MOBILE CARDS ── */}
          {!loading && !error && patients.length > 0 && (
            <div className="md:hidden divide-y divide-gray-100">
              {patients.map((p, idx) => {
                const genderLabel = p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : p.gender || '';
                const genderCls = GENDER_COLORS[genderLabel] || 'bg-gray-100 text-gray-600';
                const age = p.age_years ?? (p.dob
                  ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 86400000))
                  : null);
                const isSelected = selectedPatients.includes(p.id);

                return (
                  <div key={p.id || idx} className={`p-4 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                    <div className="flex items-start gap-3">
                      {/* Checkbox (mobile) */}
                      <input type="checkbox" checked={isSelected} onChange={() => handlePatientSelect(p.id)}
                        className="mt-1 w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0" />
                      <Avatar name={p.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5 font-mono">{p.patient_id}</p>
                          </div>
                          {p.blood_group && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${BLOOD_COLORS[p.blood_group] || 'bg-gray-50 text-gray-500'}`}>
                              {p.blood_group}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {genderLabel && <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${genderCls}`}>{genderLabel}</span>}
                          {age !== null && age !== undefined && <span className="text-xs text-gray-400">{age}y</span>}
                          {p.phone && <span className="text-xs text-gray-500">{p.phone}</span>}
                        </div>
                        {/* ABHA on mobile */}
                        <div className="mt-2">
                          {p.abha_id ? (
                            <button onClick={() => handleAbhaClick(p)} className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 font-medium">
                              ✓ ABHA Linked
                            </button>
                          ) : (
                            <button onClick={() => handleAbhaClick(p)} className="text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                              Link ABHA
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Action buttons (mobile) */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <a href={`/patient-overview/${p.id}`}
                        className="text-center py-2 border border-gray-200 text-sm text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors">
                        Overview
                      </a>
                      <a href={`/orders/${p.id}`}
                        className="text-center py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                        Start Visit
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Pagination ── */}
          {patients.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500 text-center sm:text-left">
                {(page - 1) * limit + 1}–{Math.min(page * limit, totalPatients)} of {totalPatients.toLocaleString()} patients
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                {pageNums.map(n => (
                  <button key={n} onClick={() => setPage(n)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                      n === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-gray-200 text-gray-600 hover:bg-white hover:border-blue-300'
                    }`}>
                    {n}
                  </button>
                ))}
                <button onClick={() => { if (page < totalPages) setPage(page + 1); }} disabled={page >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>{/* end space-y-4 */}

      {/* FAB (mobile) */}
      <button
        onClick={() => setShowAddPatientModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 hover:scale-110 flex items-center justify-center z-40 transition-all md:hidden"
        title="Add New Patient"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* Modals */}
      <ConfigurePatientModal
        open={showConfigure}
        onClose={() => setShowConfigure(false)}
        onSave={() => { addToast('Configuration saved', 'success'); }}
      />
      <AddPatientModal
        isOpen={showAddPatientModal}
        onClose={() => setShowAddPatientModal(false)}
        onSuccess={handlePatientAdded}
      />

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 2l4 4-4 4M6 22l-4-4 4-4M14 6H2M22 18H10"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Merge Patient Profiles</h3>
                <p className="text-xs text-gray-500">{selectedPatients.length} patients selected</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">The first selected patient becomes the primary profile. All records from others will be merged into it. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowMergeModal(false)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                Cancel
              </button>
              <button onClick={handleMerge} className="flex-1 py-2.5 text-sm bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-bold">
                Merge Profiles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click-outside to close dropdown */}
      {dropdownOpen && <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(null)} />}
    </div>
  );
}
