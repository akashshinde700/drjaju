import { useEffect, useState, useCallback } from 'react';
import HeaderBar from '../components/HeaderBar';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';

export default function AppointmentIntents() {
  const api = useApiClient();
  const { addToast } = useToast();
  const [intents, setIntents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIntent, setSelectedIntent] = useState(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [searchPatient, setSearchPatient] = useState('');
  const [appointmentForm, setAppointmentForm] = useState({
    patient_id: '',
    doctor_id: '',
    appointment_date: '',
    appointment_time: '',
    reason_for_visit: ''
  });

  const fetchIntents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const res = await api.get('/api/appointment-intents', { params });
      setIntents(res.data?.data?.intents || res.data?.intents || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load appointment intents');
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter]);

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/api/doctors');
      setDoctors(res.data.doctors || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  }, [api]);

  useEffect(() => {
    fetchIntents();
    fetchDoctors();
  }, [fetchIntents, fetchDoctors]);

  const fetchPatients = async (search = '') => {
    try {
      const params = search ? { search, limit: 20 } : { limit: 20 };
      const res = await api.get('/api/patients', { params });
      setPatients(res.data?.data?.data || res.data?.patients || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.patch(`/api/appointment-intents/${id}/status`, { status });
      addToast('Status updated successfully', 'success');
      fetchIntents();
      setShowStatusModal(false);
      setSelectedIntent(null);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  const handleConvertToAppointment = async () => {
    if (!appointmentForm.patient_id || !appointmentForm.doctor_id || !appointmentForm.appointment_date || !appointmentForm.appointment_time) {
      addToast('Please fill all required fields', 'error');
      return;
    }

    try {
      await api.post(`/api/appointment-intents/${selectedIntent.id}/convert`, appointmentForm);
      addToast('Appointment created successfully', 'success');
      setShowConvertModal(false);
      setSelectedIntent(null);
      setAppointmentForm({
        patient_id: '',
        doctor_id: '',
        appointment_date: '',
        appointment_time: '',
        reason_for_visit: ''
      });
      fetchIntents();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to create appointment', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this appointment intent?')) {
      return;
    }

    try {
      await api.delete(`/api/appointment-intents/${id}`);
      addToast('Appointment intent deleted successfully', 'success');
      fetchIntents();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete intent', 'error');
    }
  };

  const openConvertModal = (intent) => {
    setSelectedIntent(intent);
    setAppointmentForm({
      patient_id: '',
      doctor_id: '',
      appointment_date: intent.preferred_date || '',
      appointment_time: '',
      reason_for_visit: intent.message || ''
    });
    fetchPatients();
    setShowConvertModal(true);
  };

  const openStatusModal = (intent) => {
    setSelectedIntent(intent);
    setShowStatusModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'scheduled': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Appointment Requests</h1>
            <p className="text-gray-600 mt-1">Manage appointment intents and convert them to appointments</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-4 items-center">
            <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={fetchIntents}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Intents List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-lg text-gray-600">Loading appointment intents...</div>
          </div>
        ) : intents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600">No appointment intents found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speciality</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preferred Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {intents.map((intent) => (
                    <tr key={intent.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{intent.full_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{intent.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{intent.speciality || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {intent.preferred_date ? new Date(intent.preferred_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(intent.status)}`}>
                          {intent.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(intent.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openConvertModal(intent)}
                            className="text-blue-600 hover:text-blue-900"
                            disabled={intent.status === 'scheduled'}
                          >
                            Convert
                          </button>
                          <button
                            onClick={() => openStatusModal(intent)}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            Update Status
                          </button>
                          <button
                            onClick={() => handleDelete(intent.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Convert to Appointment Modal */}
        {showConvertModal && selectedIntent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h2 className="text-2xl font-semibold">Convert to Appointment</h2>
                <p className="text-gray-600 mt-1">Create an appointment from this request</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Patient *</label>
                  <input
                    type="text"
                    placeholder="Search patient by name or phone..."
                    value={searchPatient}
                    onChange={(e) => {
                      setSearchPatient(e.target.value);
                      fetchPatients(e.target.value);
                    }}
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchPatient && patients.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                      {patients.map((patient) => (
                        <div
                          key={patient.id}
                          onClick={() => {
                            setAppointmentForm({ ...appointmentForm, patient_id: patient.id });
                            setSearchPatient(patient.name);
                            setPatients([]);
                          }}
                          className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                          <div className="font-medium">{patient.name}</div>
                          <div className="text-sm text-gray-600">{patient.phone} • {patient.patient_id}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {appointmentForm.patient_id && (
                    <div className="mt-2 text-sm text-green-600">Patient selected</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Doctor *</label>
                  <select
                    value={appointmentForm.doctor_id}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, doctor_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a doctor...</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name} {doctor.specialization ? `- ${doctor.specialization}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Appointment Date *</label>
                  <input
                    type="date"
                    value={appointmentForm.appointment_date}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Appointment Time *</label>
                  <input
                    type="time"
                    value={appointmentForm.appointment_time}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Visit</label>
                  <textarea
                    value={appointmentForm.reason_for_visit}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, reason_for_visit: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="p-6 border-t flex gap-3">
                <button
                  onClick={() => {
                    setShowConvertModal(false);
                    setSelectedIntent(null);
                    setSearchPatient('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvertToAppointment}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Appointment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Status Modal */}
        {showStatusModal && selectedIntent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6 border-b">
                <h2 className="text-2xl font-semibold">Update Status</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={selectedIntent.status}
                    onChange={(e) => setSelectedIntent({ ...selectedIntent, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t flex gap-3">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setSelectedIntent(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleStatusUpdate(selectedIntent.id, selectedIntent.status)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

