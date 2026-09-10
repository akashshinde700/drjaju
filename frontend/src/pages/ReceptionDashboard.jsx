import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { FiUsers, FiClock, FiAlertCircle, FiUserPlus, FiSearch } from 'react-icons/fi';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

// Memoized StatCard component
// eslint-disable-next-line no-unused-vars
const StatCard = memo(({ label, value, icon: Icon, color }) => (
  <div className="bg-white p-4 rounded-lg shadow border hover:shadow-md transition">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
      <div className={`w-8 h-8 text-${color}-500`}>
        <Icon className="w-full h-full" />
      </div>
    </div>
  </div>
));
StatCard.displayName = 'StatCard';

// Memoized QueueRow component
const QueueRow = memo(({ patient, onConsultation, onView: _onView }) => {
  const getStatusColor = (status) => {
    const colors = {
      'waiting': 'bg-yellow-100 text-yellow-800',
      'in_consultation': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'urgent': 'bg-red-100 text-red-800',
      'senior_citizen': 'bg-purple-100 text-purple-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  return (
    <tr className="hover:bg-gray-50 transition">
      <td className="px-4 py-3">
        <span className="font-semibold text-lg">#{patient.token_number}</span>
      </td>
      <td className="px-4 py-3">
        <div>
          <div className="font-medium">{patient.patient_name}</div>
          <div className="text-sm text-gray-500">
            {[patient.age ? `${patient.age}y` : null, patient.gender, patient.phone].filter(Boolean).join(' • ') || '—'}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <div className="font-medium">{patient.doctor_name ? `Dr. ${patient.doctor_name}` : '—'}</div>
          {patient.specialization && <div className="text-sm text-gray-500">{patient.specialization}</div>}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(patient.priority)}`}>
          {patient.priority.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(patient.status)}`}>
          {patient.status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm">{patient.waiting_time}m</span>
      </td>
      <td className="px-4 py-3">
        {patient.status === 'waiting' && (
          <button
            onClick={() => onConsultation(patient.visit_id)}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition"
          >
            Start
          </button>
        )}
        {patient.status === 'in_consultation' && (
          <span className="text-sm text-gray-500">In Progress</span>
        )}
        {patient.status === 'completed' && (
          <span className="text-sm text-green-600">✓ Done</span>
        )}
      </td>
    </tr>
  );
});
QueueRow.displayName = 'QueueRow';

const ReceptionDashboard = () => {
  const api = useApiClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [patients, setPatients] = useState([]);
  const [_selectedPatient, setSelectedPatient] = useState(null);
  const [registerForm, setRegisterForm] = useState({
    patientId: '',
    doctorId: '',
    appointmentType: 'OPD',
    priority: 'normal'
  });
  const [searchTimeout, setSearchTimeout] = useState(null);

  // Fetch queue data from the MAIN queue system (/api/queue/today).
  // This page previously read/wrote a parallel `opd_queue` table that nothing
  // else in the app used — receptionists' check-ins never reached the doctor's
  // queue, and this page always showed 0s. Stats are derived from the SAME
  // rows the table renders, so cards always equal the list.
  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '500'); // backend defaults to 50 rows/page
      if (selectedDoctor) params.append('doctor_id', selectedDoctor);

      const res = await api.get(`/api/queue/today?${params}`);
      const payload = res.data?.data;
      const rows = Array.isArray(payload) ? payload
        : (Array.isArray(payload?.data) ? payload.data : []);

      const normStatus = (s) => {
        const v = String(s || '').toLowerCase();
        if (v === 'completed') return 'completed';
        if (['in-progress', 'in_progress', 'called'].includes(v)) return 'in_consultation';
        return 'waiting';
      };

      const mapped = rows
        .filter((q) => !['cancelled', 'no-show', 'skipped'].includes(String(q.status || '').toLowerCase()))
        .map((q) => ({
          visit_id: q.id, // main queue row id — used for status updates
          token_number: q.token_number,
          patient_name: q.patient_name || '—',
          phone: q.phone,
          age: q.age ?? q.age_years,
          gender: q.gender,
          doctor_name: q.doctor_name,
          specialization: q.specialization,
          priority: Number(q.priority) >= 3 ? 'urgent' : 'normal',
          status: normStatus(q.status),
          waiting_time: q.check_in_time
            ? Math.max(0, Math.round((Date.now() - new Date(q.check_in_time).getTime()) / 60000))
            : 0,
        }));

      setQueue(mapped);
      const waitingRows = mapped.filter((p) => p.status === 'waiting');
      setStats({
        totalWaiting: waitingRows.length,
        inConsultation: mapped.filter((p) => p.status === 'in_consultation').length,
        completed: mapped.filter((p) => p.status === 'completed').length,
        averageWaitTime: waitingRows.length
          ? waitingRows.reduce((acc, p) => acc + p.waiting_time, 0) / waitingRows.length
          : 0,
      });
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctor]);

  // Fetch doctors
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/api/doctors');
      if (res.data?.doctors) {
        setDoctors(res.data.doctors);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  }, []);

  // Debounced patient search
  const searchPatients = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setPatients([]);
      return;
    }

    try {
      const res = await api.get(`/api/patients?search=${query}`);
      setPatients(res.data?.data?.patients || []);
    } catch (error) {
      console.error('Error searching patients:', error);
    }
  }, []);

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (searchTerm.length >= 2) {
      const timer = setTimeout(() => searchPatients(searchTerm), 300);
      setSearchTimeout(timer);
    } else {
      setPatients([]);
    }
    
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  }, [searchTerm, searchPatients]);

  // Register patient into the MAIN queue (same endpoint the Queue page's
  // quick check-in uses), so the doctor's dashboard sees them immediately.
  const registerPatient = async () => {
    if (!registerForm.patientId || !registerForm.doctorId) {
      addToast('Select a patient and a doctor first', 'error');
      return;
    }
    try {
      const res = await api.post('/api/queue', {
        patient_id: Number(registerForm.patientId),
        doctor_id: Number(registerForm.doctorId),
        clinic_id: user?.clinic_id || 2,
        priority: registerForm.priority === 'urgent' ? 3 : 0,
      });
      const q = res.data?.data || res.data;
      addToast(`Patient checked in • Token ${q?.token_number ?? 'N/A'}`, 'success');
      setShowRegisterModal(false);
      setRegisterForm({ patientId: '', doctorId: '', appointmentType: 'OPD', priority: 'normal' });
      setSelectedPatient(null);
      setSearchTerm('');
      fetchQueue();
    } catch (error) {
      console.error('Error registering patient:', error);
      addToast(error.response?.data?.error || 'Failed to check in patient', 'error');
    }
  };

  // Start consultation = main queue status update
  const startConsultation = async (queueId) => {
    try {
      await api.patch(`/api/queue/${queueId}/status`, { status: 'in_progress' });
      fetchQueue();
      addToast('Consultation started', 'success');
    } catch (error) {
      console.error('Error starting consultation:', error);
      addToast(error.response?.data?.error || 'Failed to start consultation', 'error');
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchDoctors();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue, fetchDoctors]);

  // Memoized queue list
  const queueList = useMemo(() => queue, [queue]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reception Hub</h1>
          <p className="text-gray-600 mt-1">Manage queue & patient registrations</p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          <FiUserPlus className="w-4 h-4" />
          Register Patient
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Waiting" value={stats.totalWaiting || 0} icon={FiUsers} color="blue" />
        <StatCard label="In Consultation" value={stats.inConsultation || 0} icon={FiClock} color="green" />
        <StatCard label="Avg Wait Time" value={`${Math.round(stats.averageWaitTime || 0)}m`} icon={FiAlertCircle} color="orange" />
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Doctor</label>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Doctors</option>
              {doctors.map(doctor => (
                <option key={doctor.id} value={doctor.id}>
                  Dr. {doctor.name} - {doctor.specialization}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Current Queue</h2>
          <p className="text-sm text-gray-500">Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
        
        {queueList.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No patients in queue
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Token</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Doctor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Wait</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {queueList.map((patient) => (
                  <QueueRow
                    key={`${patient.visit_id}-${patient.token_number}`}
                    patient={patient}
                    onConsultation={startConsultation}
                    onView={() => {}}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Patient Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Register Patient</h2>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Search Patient */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Patient *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or phone..."
                    autoComplete="off"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {patients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {patients.map((patient) => (
                        <button
                          key={patient.id}
                          onClick={() => {
                            setSelectedPatient(patient);
                            setRegisterForm(prev => ({ ...prev, patientId: patient.id }));
                            setSearchTerm(patient.name);
                            setPatients([]);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b transition"
                        >
                          <div className="font-medium">{patient.name}</div>
                          <div className="text-xs text-gray-500">{patient.phone} • {patient.age}y</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Doctor Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
                <select
                  value={registerForm.doctorId}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, doctorId: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      Dr. {doctor.name} - {doctor.specialization}
                    </option>
                  ))}
                </select>
              </div>

              {/* Appointment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type</label>
                <select
                  value={registerForm.appointmentType}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, appointmentType: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="OPD">OPD</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={registerForm.priority}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="normal">Normal</option>
                  <option value="senior_citizen">Senior Citizen</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-gray-50">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={registerPatient}
                disabled={!registerForm.patientId || !registerForm.doctorId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionDashboard;
