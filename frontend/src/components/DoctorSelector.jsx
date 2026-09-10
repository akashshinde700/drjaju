import { useState, useEffect, useRef, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Module-level cache to persist across component remounts
let doctorsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function DoctorSelector() {
  const api = useApiClient();
  const { user } = useAuth();
  const [doctors, setDoctors] = useState(doctorsCache || []);
  const [selectedDoctor, setSelectedDoctor] = useState(() => {
    const saved = localStorage.getItem('selectedDoctor');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors');
      const list = res.data.doctors || [];
      doctorsCache = list;
      cacheTimestamp = Date.now();
      setDoctors(list);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    // Only fetch if cache is stale and we haven't fetched this mount
    if (!fetchedRef.current && (!doctorsCache || Date.now() - cacheTimestamp > CACHE_TTL)) {
      fetchedRef.current = true;
      fetchDoctors();
    }
  }, [fetchDoctors]);

  const handleDoctorChange = useCallback((e) => {
    const doctorId = e.target.value;
    const doctor = (doctorsCache || []).find(d => d.id === parseInt(doctorId));
    if (!doctor) return;

    setSelectedDoctor(doctor);
    localStorage.setItem('selectedDoctorId', doctor.id);
    localStorage.setItem('selectedDoctor', JSON.stringify(doctor));
    window.location.reload();
  }, []);

  // Only show for admin users
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            👨‍⚕️ Select Doctor:
          </label>
          <select
            value={selectedDoctor?.id || ''}
            onChange={handleDoctorChange}
            disabled={loading}
            className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Select a doctor --</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {doctor.name} {doctor.specialization ? `(${doctor.specialization})` : ''}
              </option>
            ))}
          </select>

          {selectedDoctor && (
            <div className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-md">
              <span className="font-medium">Selected:</span> Dr. {selectedDoctor.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
