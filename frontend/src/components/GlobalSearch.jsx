import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApiClient } from '../api/client';
import { useTranslation } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { cleanReasonForVisit } from '../utils/reasonForVisit';

/**
 * GlobalSearch modal panel
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 */
export default function GlobalSearch({ open, onClose }) {
  const api = useApiClient();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [types, setTypes] = useState({ patients: true, appointments: true, labs: true, prescriptions: true });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Debounced search with cancellation
  const { query: q, setQuery, isSearching: _searchLoading, error: _searchError } = useDebouncedSearch(
    useCallback(async () => {
      // Trigger fetchResults via effect below
    }, []),
    300
  );

  const selectedTypes = useMemo(() => Object.keys(types).filter(k => types[k]), [types]);

  const primaryType = useMemo(() => selectedTypes[0] || 'patients', [selectedTypes]);
  const selectedTypesKey = selectedTypes.join(',');

  const resetPagination = () => setPage(1);

  // Reset page when query or filters change
  useEffect(() => { resetPagination(); }, [q, from, to, patientId, doctorId, selectedTypesKey]);

  const fetchResults = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError('');
    try {
      const params = {
        q: q || '',
        types: selectedTypes.join(','),
        page,
        limit,
      };
      if (from) params.from = from;
      if (to) params.to = to;
      if (patientId) params.patientId = patientId;
      if (doctorId) params.doctorId = doctorId;

      const res = await api.get('/api/search', { params });
      // Unwrap ApiResponse wrapper: { data: { results: {...} } } → use inner data
      setData(res.data?.data !== undefined ? res.data.data : res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch search results');
    } finally {
      setLoading(false);
    }
  }, [api, open, q, selectedTypes, page, limit, from, to, patientId, doctorId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
      // Ctrl/Cmd+K to focus search input
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const el = document.getElementById('global-search-input');
        if (el) el.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Auto-fetch when dependencies change
  useEffect(() => {
    if (open) fetchResults();
  }, [open, fetchResults]);

  if (!open) return null;

  const navigateTo = (type, item) => {
    switch (type) {
      case 'patients':
        navigate(`/patient-overview/${item.id || item.patient_id || ''}`);
        break;
      case 'appointments':
        navigate(`/orders/${item.patient_id}`);
        break;
      case 'labs':
        navigate(`/patient-overview/${item.patient_id}`);
        break;
      case 'prescriptions':
        navigate(`/prescription-preview/${item.patient_id}`);
        break;
      default:
        break;
    }
    onClose?.();
  };

  const summaryCount = (tkey) => data?.results?.[tkey]?.total || 0;
  const items = (tkey) => data?.results?.[tkey]?.items || [];
  const totalPages = Math.max(1, Math.ceil(((data?.results?.[primaryType]?.total) || 0) / limit));

  const overlay = (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 top-10 mx-auto max-w-4xl bg-white rounded-lg shadow-xl border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">{t('search')}</h2>
          <button onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900">{t('close')}</button>
        </div>
        <div className="p-4 space-y-3">
          {/* Query */}
          <div className="flex gap-2">
            <input
              id="global-search-input"
              autoComplete="off"
              className="flex-1 px-3 py-2 border rounded"
              placeholder={t('search') + '...'}
              value={q}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              onClick={() => { setPage(1); fetchResults(); }}
              className="px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90"
            >
              {t('search')}
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="col-span-1 flex flex-wrap gap-2 items-center">
              {['patients','appointments','labs','prescriptions'].map((k) => (
                <label key={k} className={`px-2 py-1 text-xs rounded border cursor-pointer ${types[k] ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50'}`}>
                  <input
                    type="checkbox"
                    id={`search-type-${k}`}
                    name={`search_type_${k}`}
                    className="mr-1 align-middle"
                    checked={types[k]}
                    onChange={(e) => setTypes({ ...types, [k]: e.target.checked })}
                  />
                  {t(k)}
                </label>
              ))}
            </div>
            <input type="date" id="search-from-date" name="search_from_date" className="px-3 py-2 border rounded" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={t('from')} />
            <input type="date" id="search-to-date" name="search_to_date" className="px-3 py-2 border rounded" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('to')} />
            <div className="grid grid-cols-2 gap-2">
              <input id="search-patient-id" name="search_patient_id" className="px-3 py-2 border rounded" placeholder="patientId" value={patientId} onChange={(e) => setPatientId(e.target.value)} />
              <input id="search-doctor-id" name="search_doctor_id" className="px-3 py-2 border rounded" placeholder="doctorId" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} />
            </div>
          </div>

          {loading && <div className="text-sm text-slate-600">{t('loading') || 'Loading...'}</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}

          {/* Summary */}
          {data && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span>{t('results')}:</span>
              <span>{t('patients')}: {summaryCount('patients')}</span>
              <span>{t('appointments')}: {summaryCount('appointments')}</span>
              <span>{t('labs')}: {summaryCount('labs')}</span>
              <span>{t('prescriptions')}: {summaryCount('prescriptions')}</span>
            </div>
          )}

          {/* Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Patients */}
            {types.patients && (
              <div className="border rounded">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-50 border-b">{t('patients')} ({summaryCount('patients')})</div>
                <div className="divide-y max-h-64 overflow-auto">
                  {items('patients').length === 0 && <div className="p-3 text-xs text-slate-500">{t('no_results') || 'No results'}</div>}
                  {items('patients').map((p) => (
                    <div key={`p-${p.id}`} className="p-3 text-sm flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-slate-600">{p.patient_id} • {p.phone || '-'} • {p.gender || ''}</div>
                      </div>
                      <button className="text-xs text-blue-600 hover:text-blue-800" onClick={() => navigateTo('patients', p)}>{t('open_overview') || 'Open Overview'}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Appointments */}
            {types.appointments && (
              <div className="border rounded">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-50 border-b">{t('appointments')} ({summaryCount('appointments')})</div>
                <div className="divide-y max-h-64 overflow-auto">
                  {items('appointments').length === 0 && <div className="p-3 text-xs text-slate-500">{t('no_results') || 'No results'}</div>}
                  {items('appointments').map((a) => (
                    <div key={`a-${a.id}`} className="p-3 text-sm flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-medium">{cleanReasonForVisit(a.reason_for_visit) || '-'}</div>
                        <div className="text-xs text-slate-600">{a.status} • {new Date(a.appointment_date).toLocaleString()}</div>
                      </div>
                      <button className="text-xs text-blue-600 hover:text-blue-800" onClick={() => navigateTo('appointments', a)}>{t('open') || 'Open'}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Labs */}
            {types.labs && (
              <div className="border rounded">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-50 border-b">{t('labs')} ({summaryCount('labs')})</div>
                <div className="divide-y max-h-64 overflow-auto">
                  {items('labs').length === 0 && <div className="p-3 text-xs text-slate-500">{t('no_results') || 'No results'}</div>}
                  {items('labs').map((l) => (
                    <div key={`l-${l.id}`} className="p-3 text-sm flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-medium">{l.test_name}</div>
                        <div className="text-xs text-slate-600">{l.result || '-'} • {l.units || ''} • {new Date(l.test_date).toLocaleDateString()}</div>
                      </div>
                      <button className="text-xs text-blue-600 hover:text-blue-800" onClick={() => navigateTo('labs', l)}>{t('open_labs') || 'Open Labs'}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prescriptions */}
            {types.prescriptions && (
              <div className="border rounded">
                <div className="px-3 py-2 text-xs font-semibold bg-slate-50 border-b">{t('prescriptions')} ({summaryCount('prescriptions')})</div>
                <div className="divide-y max-h-64 overflow-auto">
                  {items('prescriptions').length === 0 && <div className="p-3 text-xs text-slate-500">{t('no_results') || 'No results'}</div>}
                  {items('prescriptions').map((r) => (
                    <div key={`r-${r.id}`} className="p-3 text-sm flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-medium">{r.diagnosis || '-'}</div>
                        <div className="text-xs text-slate-600">{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                      <button className="text-xs text-blue-600 hover:text-blue-800" onClick={() => navigateTo('prescriptions', r)}>{t('open_prescription') || 'Open Prescription'}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pagination for primary type */}
          <div className="flex items-center justify-between mt-3 text-sm text-slate-600">
            <div>
              {t('results')}: {data?.results?.[primaryType]?.total || 0}
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
              <span>Page {page} / {totalPages}</span>
              <button className="px-3 py-1 border rounded disabled:opacity-50" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
              <select className="px-2 py-1 border rounded" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                {[5,10,20,50].map(n => <option key={n} value={n}>{n}/page</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
