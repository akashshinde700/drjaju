import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { getLocalDateString } from '../utils/localDate';

const DATE_FILTERS = [
  { value: 'today',     label: 'Today'      },
  { value: 'yesterday', label: 'Yesterday'  },
  { value: 'weekly',    label: 'This Week'  },
  { value: 'monthly',   label: 'This Month' },
  { value: 'custom',    label: 'Custom'     },
];

// Circular progress ring
function RingProgress({ pct, size = 120, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="url(#ringGrad)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function ABHADashboard() {
  const api      = useApiClient();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [abhaData, setAbhaData]               = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [dateFilter, setDateFilter]           = useState('today');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: getLocalDateString(),
    endDate:   getLocalDateString(),
  });
  const [hfrId, setHfrId]               = useState('');
  const [editingHfrId, setEditingHfrId] = useState(false);
  const [newHfrId, setNewHfrId]         = useState('');
  const [copied, setCopied]             = useState(false);
  const [refreshTs, setRefreshTs]       = useState(null);
  const [qrInput, setQrInput]           = useState('');
  const [qrCode, setQrCode]             = useState('');
  const [qrLoading, setQrLoading]       = useState(false);

  const fetchABHAData = useCallback(async () => {
    setLoading(true);
    try {
      const params = dateFilter === 'custom'
        ? { startDate: customDateRange.startDate, endDate: customDateRange.endDate }
        : { filter: dateFilter };
      const res = await api.get('/api/abha/dashboard', { params });
      setAbhaData({
        hfr_id:           res.data.hfr_id           || 'Not Set',
        total_patients:   res.data.total_patients   || 0,
        linked_patients:  res.data.linked_patients  || 0,
        consent_requests: res.data.consent_requests || 0,
        pending_uploads:  res.data.pending_uploads  || 0,
        last_updated:     res.data.last_updated     || new Date().toISOString(),
      });
      setHfrId(res.data.hfr_id || '');
      setRefreshTs(new Date());
    } catch {
      addToast('Failed to fetch ABHA data', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, dateFilter, customDateRange, addToast]);

  useEffect(() => { fetchABHAData(); }, [fetchABHAData]);

  const handleUpdateHfrId = async () => {
    if (!newHfrId.trim()) { addToast('Please enter HFR ID', 'warning'); return; }
    try {
      await api.patch('/api/abha/hfr-id', { hfr_id: newHfrId });
      setHfrId(newHfrId);
      setEditingHfrId(false);
      setNewHfrId('');
      addToast('HFR ID updated successfully', 'success');
      fetchABHAData();
    } catch {
      addToast('Failed to update HFR ID', 'error');
    }
  };

  const handleCopyHfrId = () => {
    if (!hfrId) return;
    navigator.clipboard.writeText(hfrId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('HFR ID copied', 'success');
  };

  const handleExportData = () => {
    const content = `ABHA Dashboard Report\nGenerated: ${new Date().toLocaleString('en-IN')}\n\nHFR ID: ${hfrId}\nTotal Patients: ${abhaData?.total_patients || 0}\nLinked Patients: ${abhaData?.linked_patients || 0}\nConsent Requests: ${abhaData?.consent_requests || 0}\nPending Uploads: ${abhaData?.pending_uploads || 0}\nLinking Rate: ${linkingRate}%`;
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
    a.download = `abha_report_${getLocalDateString()}.txt`;
    a.click();
    addToast('Report exported', 'success');
  };

  const handleGenerateQR = async () => {
    if (!qrInput.trim()) {
      addToast('Please enter ABHA address or clinic link', 'warning');
      return;
    }
    setQrLoading(true);
    try {
      // Using qrserver.com free QR code API
      const encodedInput = encodeURIComponent(qrInput);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedInput}`;
      setQrCode(qrUrl);
      addToast('QR code generated successfully', 'success');
    } catch {
      addToast('Failed to generate QR code', 'error');
    } finally {
      setQrLoading(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCode) return;
    const a = document.createElement('a');
    a.href = qrCode;
    a.download = `abha_qr_${getLocalDateString()}.png`;
    a.click();
    addToast('QR code downloaded', 'success');
  };

  const handleCopyQRLink = () => {
    if (!qrInput.trim()) return;
    navigator.clipboard.writeText(qrInput);
    addToast('Link copied to clipboard', 'success');
  };

  const linkingRate = abhaData?.total_patients > 0
    ? parseFloat(((abhaData.linked_patients / abhaData.total_patients) * 100).toFixed(1))
    : 0;

  const unlinked = abhaData ? abhaData.total_patients - abhaData.linked_patients : 0;

  const metrics = abhaData ? [
    {
      label: 'Total Patients',
      value: abhaData.total_patients,
      color: 'blue',
      accent: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-100',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Linked Patients',
      value: abhaData.linked_patients,
      sub: `${linkingRate}% linked`,
      color: 'emerald',
      accent: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
        </svg>
      ),
    },
    {
      label: 'Consent Requests',
      value: abhaData.consent_requests,
      color: 'amber',
      accent: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
    {
      label: 'Pending Uploads',
      value: abhaData.pending_uploads,
      color: 'red',
      accent: 'from-red-500 to-rose-500',
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-100',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
          <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
        </svg>
      ),
    },
  ] : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/40 via-white to-white">

      {/* ── Modern Hero Banner ── */}
      <div className="relative bg-gradient-to-r from-blue-50 via-blue-50 to-indigo-50 border-b-2 border-blue-200/40 px-6 pt-8 pb-8 sticky top-0 z-20 shadow-sm">
        <div className="relative max-w-5xl mx-auto">
          {/* Top row */}
          <div className="flex items-start justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-all hover:gap-3"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchABHAData}
                disabled={loading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-60 hover:scale-105 active:scale-95"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}>
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
                Refresh
              </button>
              <button
                onClick={handleExportData}
                disabled={!abhaData}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md border border-gray-200/50 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-7 h-7">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div>
              <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-1 opacity-70">ABDM INTEGRATION</p>
              <h1 className="text-4xl font-black bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
                ABHA Management
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content Section ── */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── HFR ID Card — Modern Styling ── */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100/60 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300">
          <div className="flex items-center justify-between px-6 py-6 bg-gradient-to-r from-blue-100/50 to-indigo-100/30 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-5 h-5">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-gray-900">ABHA HFR ID</h2>
                <p className="text-xs text-gray-600 mt-0.5 font-medium">Health Facility Registry Identifier</p>
              </div>
            </div>
            <button
              onClick={() => { setEditingHfrId(!editingHfrId); setNewHfrId(hfrId); }}
              className="flex items-center gap-2 text-sm font-bold px-4 py-2 border-2 border-blue-200 hover:bg-blue-50 text-blue-600 rounded-lg transition-all hover:border-blue-300"
            >
              {editingHfrId ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </>
              )}
            </button>
          </div>

          {editingHfrId ? (
            <div className="flex gap-3 p-6">
              <input
                type="text"
                value={newHfrId}
                onChange={(e) => setNewHfrId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateHfrId()}
                placeholder="Enter new HFR ID"
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 font-mono"
                autoFocus
              />
              <button
                onClick={handleUpdateHfrId}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all active:scale-95"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="p-6 flex items-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-50/30">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-6 h-6">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Registered HFR ID</p>
                <p className="text-2xl font-black text-gray-900 font-mono mt-1">{hfrId || '—'}</p>
              </div>
              <button
                onClick={handleCopyHfrId}
                disabled={!hfrId}
                className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-lg text-sm font-bold transition-all shadow-sm disabled:opacity-40 ${
                  copied
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300'
                }`}
              >
                {copied ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ── Date Filter ── */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100/60 p-6">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Filter Period</p>
          <div className="flex flex-wrap gap-2">
            {DATE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setDateFilter(f.value)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  dateFilter === f.value
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105 hover:shadow-xl'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dateFilter === 'custom' && (
            <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t-2 border-gray-100">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Start Date</label>
                <input
                  type="date"
                  value={customDateRange.startDate}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, startDate: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">End Date</label>
                <input
                  type="date"
                  value={customDateRange.endDate}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, endDate: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 font-medium"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── QR Code Generator — Prominent Position ── */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100/60 overflow-hidden hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between px-6 py-6 bg-gradient-to-r from-blue-100/50 to-indigo-100/30 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-6 h-6">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  <path d="M20 14h.01"/><path d="M20 17h.01"/><path d="M20 20h.01"/><path d="M17 20h.01"/>
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-gray-900">QR Code Generator</h2>
                <p className="text-xs text-gray-600 mt-0.5 font-medium">Generate QR codes for ABHA addresses or clinic links</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">Data to Encode</label>
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateQR()}
                placeholder="Enter ABHA address, clinic link, or any text..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder-gray-400"
              />
            </div>

            {qrCode && (
              <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-100/60">
                <img src={qrCode} alt="Generated QR Code" className="w-48 h-48 rounded-lg shadow-md border-2 border-white" />
                <p className="text-xs text-gray-600 font-medium text-center">Scan with any QR code reader</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGenerateQR}
                disabled={qrLoading}
                className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-60 active:scale-95"
              >
                {qrLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    Generate QR
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadQR}
                disabled={!qrCode}
                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold px-6 py-3 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md border-2 border-gray-200 hover:border-gray-300 disabled:opacity-50 active:scale-95"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </button>
              <button
                onClick={handleCopyQRLink}
                disabled={!qrInput.trim()}
                className="flex-1 min-w-[150px] flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold px-6 py-3 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md border-2 border-gray-200 hover:border-gray-300 disabled:opacity-50 active:scale-95"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                </svg>
                Copy Link
              </button>
            </div>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border-2 border-gray-100/60 shadow-md">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-600 font-bold">Loading ABHA data…</p>
          </div>
        )}

        {!loading && abhaData && (
          <>
            {/* ── Metric Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {metrics.map(({ label, value, sub, bg, text, border, accent, icon }) => (
                <div key={label} className={`bg-white rounded-2xl shadow-md border-2 ${border} p-6 relative overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col`}>
                  {/* top accent bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${accent} rounded-t-2xl`} />
                  <div className={`w-12 h-12 rounded-lg ${bg} ${text} flex items-center justify-center mb-4 flex-shrink-0`}>
                    {icon}
                  </div>
                  <p className="text-xs text-gray-600 font-bold uppercase tracking-wide">{label}</p>
                  <p className={`text-4xl font-black mt-3 ${text} leading-none`}>{value.toLocaleString()}</p>
                  {sub && <p className="text-xs text-gray-600 mt-2 font-medium">{sub}</p>}
                </div>
              ))}
            </div>

            {/* ── Linking Progress + Ring ── */}
            <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100/60 p-8">
              <h3 className="text-xl font-black text-gray-900 mb-8">ABHA Linking Progress</h3>
              <div className="flex flex-col lg:flex-row items-center gap-12">
                {/* Ring */}
                <div className="relative flex-shrink-0">
                  <RingProgress pct={linkingRate} size={140} stroke={14} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-gray-800">{linkingRate}%</span>
                    <span className="text-xs font-bold text-gray-600 mt-2">linked</span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 w-full space-y-6">
                  {/* Linked */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold text-gray-700">Linked Patients</span>
                      <span className="text-lg font-black text-emerald-600">{abhaData.linked_patients.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700 shadow-sm"
                        style={{ width: `${linkingRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Unlinked */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold text-gray-700">Unlinked Patients</span>
                      <span className="text-lg font-black text-red-600">{unlinked.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-400 to-rose-400 rounded-full transition-all duration-700 shadow-sm"
                        style={{ width: `${100 - linkingRate}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 font-medium pt-4 border-t border-gray-200">
                    <span className="font-bold text-gray-800">{abhaData.linked_patients}</span> of <span className="font-bold text-gray-800">{abhaData.total_patients}</span> patients linked to ABHA
                  </p>
                </div>
              </div>
            </div>

            {/* ── Quick Actions ── */}
            <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100/60 p-8">
              <h3 className="text-xl font-black text-gray-900 mb-8">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                  {
                    label: 'Link Patients',
                    desc: 'Connect ABHA accounts',
                    color: 'text-blue-600', bg: 'bg-blue-100 hover:bg-blue-200',
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                      </svg>
                    ),
                  },
                  {
                    label: 'Sync Records',
                    desc: 'Upload health records',
                    color: 'text-emerald-600', bg: 'bg-emerald-100 hover:bg-emerald-200',
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                      </svg>
                    ),
                  },
                  {
                    label: 'View Consents',
                    desc: `${abhaData.consent_requests} pending`,
                    color: 'text-amber-600', bg: 'bg-amber-100 hover:bg-amber-200',
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-7 h-7">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                      </svg>
                    ),
                  },
                ].map(({ label, desc, color, bg, icon }) => (
                  <button
                    key={label}
                    className={`flex flex-col items-center gap-4 p-6 rounded-xl ${bg} transition-all duration-300 border-2 border-gray-200 hover:shadow-lg active:scale-95`}
                  >
                    <div className={`${color} flex-shrink-0`}>{icon}</div>
                    <div className="text-center min-w-0">
                      <p className={`text-sm font-bold ${color}`}>{label}</p>
                      <p className="text-xs text-gray-600 truncate mt-1">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Status Summary ── */}
            <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100/60 p-8">
              <h3 className="text-xl font-black text-gray-900 mb-8">Account Status Summary</h3>
              <div className="space-y-7">
                {[
                  { label: 'Active ABHA Accounts', value: abhaData.linked_patients, total: abhaData.total_patients, color: 'bg-emerald-500' },
                  { label: 'Pending Consent Requests', value: abhaData.consent_requests, total: Math.max(abhaData.consent_requests, 1), color: 'bg-amber-400' },
                  { label: 'Pending Record Uploads', value: abhaData.pending_uploads, total: Math.max(abhaData.pending_uploads, 1), color: 'bg-red-400' },
                ].map(({ label, value, total, color }) => {
                  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-bold text-gray-700">{label}</span>
                        <span className="text-lg font-black text-gray-800">{value.toLocaleString()}</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all duration-700 shadow-sm`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Last Updated ── */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 font-medium py-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Last updated: {refreshTs ? refreshTs.toLocaleString('en-IN') : '—'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
