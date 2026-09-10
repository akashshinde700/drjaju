import { useEffect, useState, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import RequireRole from '../components/RequireRole';

export default function ClinicManagement() {
  const api = useApiClient();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(null);

  const fetchClinics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/clinics');
      setClinics(res.data?.data?.clinics || res.data?.clinics || []);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to load clinics', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  useEffect(() => { fetchClinics(); }, [fetchClinics]);

  const handleSwitch = async (clinicId) => {
    setSwitching(clinicId);
    try {
      await api.post('/api/clinics/switch', { clinic_id: clinicId });
      addToast('Clinic switched successfully', 'success');
      if (setUser) setUser({ ...user, clinic_id: clinicId });
      window.location.reload();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to switch clinic', 'error');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <RequireRole allowed={['admin', 'doctor', 'staff']}>
      <div className="min-h-screen bg-gray-50">

        {/* ── Hero Banner ── */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-white">Clinic Management</h1>
            <p className="text-blue-200 text-sm mt-0.5">Manage and switch between your clinics</p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8">

          {/* ── Loading ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-sm">Loading clinics…</p>
            </div>
          )}

          {/* ── Empty State ── */}
          {!loading && clinics.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" className="w-8 h-8">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <h3 className="text-gray-700 font-semibold text-lg mb-1">No clinics found</h3>
              <p className="text-gray-400 text-sm">Contact your administrator to add clinics</p>
            </div>
          )}

          {/* ── Clinic Cards ── */}
          {!loading && clinics.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {clinics.map((clinic) => {
                const isCurrent = user?.clinic_id === clinic.id;
                const initials = clinic.name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'CL';
                return (
                  <div
                    key={clinic.id}
                    className={`bg-white rounded-2xl shadow-sm border-2 transition-all duration-200 overflow-hidden
                      ${isCurrent ? 'border-blue-500 shadow-blue-100 shadow-md' : 'border-gray-100 hover:border-blue-200 hover:shadow-md'}`}
                  >
                    {/* Card Top */}
                    <div className={`px-5 py-4 flex items-center gap-3 ${isCurrent ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-gray-50 to-slate-50'}`}>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0
                        ${isCurrent ? 'bg-white/20 text-white' : 'bg-white text-blue-600 border border-gray-200'}`}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-sm truncate ${isCurrent ? 'text-white' : 'text-gray-800'}`}>
                          {clinic.name}
                        </h3>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-100 font-medium mt-0.5">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Active Clinic
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="px-5 py-4 space-y-2.5">
                      {clinic.address && (
                        <div className="flex items-start gap-2.5 text-sm text-gray-600">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                          <span className="leading-snug">
                            {clinic.address}
                            {(clinic.city || clinic.state) && (
                              <span className="block text-gray-400 text-xs mt-0.5">
                                {[clinic.city, clinic.state, clinic.pincode].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {clinic.phone && (
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 flex-shrink-0 text-gray-400">
                            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .18h3a2 2 0 012 1.72 12.05 12.05 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                          </svg>
                          {clinic.phone}
                        </div>
                      )}
                      {clinic.email && (
                        <div className="flex items-center gap-2.5 text-sm text-gray-600">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 flex-shrink-0 text-gray-400">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                          </svg>
                          <span className="truncate">{clinic.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="px-5 pb-4">
                      {isCurrent ? (
                        <div className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Currently Active
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSwitch(clinic.id)}
                          disabled={switching === clinic.id}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                        >
                          {switching === clinic.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Switching…
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
                              </svg>
                              Switch to this Clinic
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </div>

      </div>
    </RequireRole>
  );
}
