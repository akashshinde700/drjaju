import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiDollarSign } from 'react-icons/fi';
import HeaderBar from '../components/HeaderBar';
import AddPatientModal from '../components/AddPatientModal';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { StatCard, Badge, EmptyState, Button } from '../components/ui';
import { SkeletonTable } from '../components/LoadingSpinner';

export default function StaffDashboard() {
  const api = useApiClient();
  const { addToast } = useToast();
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayPatients: 0,
    inQueue: 0,
    completedToday: 0,
    avgWaitTime: 0,
    currentlyServing: 0
  });
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all'); // all, waiting, serving, completed
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPatientForPayment, setSelectedPatientForPayment] = useState(null);

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/staff-dashboard/stats');
      if (res.data) {
        setStats(res.data?.data || res.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [api]);

  // Fetch patients in queue
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      
      const res = await api.get(`/api/staff-dashboard/queue?${params}`);
      setPatients(res.data?.data?.patients || res.data?.patients || []);
    } catch (error) {
      console.error('Failed to fetch patients:', error);
    } finally {
      setLoading(false);
    }
  }, [api, filterStatus]);

  // Fetch doctors for assignment
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/api/doctors');
      setDoctors(res.data.doctors || []);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    }
  }, [api]);

  // Update patient status
  const updatePatientStatus = async (patientId, status) => {
    try {
      await api.put(`/api/staff-dashboard/patients/${patientId}/queue-status`, { status });
      fetchPatients();
      fetchStats();
    } catch (error) {
      console.error('Failed to update patient status:', error);
    }
  };

  // Handle patient payment
  const handlePatientPayment = (patient) => {
    setSelectedPatientForPayment(patient);
    setShowPaymentModal(true);
  };

  // Process payment
  const processPayment = async (paymentData) => {
    try {
      await api.post('/api/bills', {
        patient_id: selectedPatientForPayment.id,
        ...paymentData
      });
      setShowPaymentModal(false);
      setSelectedPatientForPayment(null);
      fetchPatients();
      fetchStats();
      addToast('Payment processed', 'success');
    } catch (error) {
      console.error('Failed to process payment:', error);
      addToast('Failed to process payment', 'error');
    }
  };

  // Handle new patient creation
  const handleNewPatient = () => {
    setShowAddPatientModal(true);
  };

  // Handle patient created
  const handlePatientCreated = (_newPatient) => {
    setShowAddPatientModal(false);
    fetchPatients();
    fetchStats();
    addToast('Patient added', 'success');
  };

  // Assign patient to doctor
  const assignToDoctor = async () => {
    if (!selectedPatient || !selectedDoctor) return;
    
    try {
      await api.put(`/api/staff-dashboard/patients/${selectedPatient.id}/assign-doctor`, { 
        doctor_id: selectedDoctor 
      });
      setShowAssignModal(false);
      setSelectedPatient(null);
      setSelectedDoctor('');
      fetchPatients();
      fetchStats();
    } catch (error) {
      console.error('Failed to assign doctor:', error);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchStats();
    fetchPatients();
    fetchDoctors();
    
    const interval = setInterval(() => {
      fetchStats();
      fetchPatients();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchStats, fetchPatients, fetchDoctors]);

  // Calculate wait time
  const calculateWaitTime = (checkInTime) => {
    if (!checkInTime) return '0 min';
    const now = new Date();
    const checkIn = new Date(checkInTime);
    const diffMs = now - checkIn;
    const diffMins = Math.floor(diffMs / 60000);
    return `${diffMins} min`;
  };

  return (
    <div className="space-y-6">
      <HeaderBar title="Staff Dashboard" />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Patients Today" value={stats.totalPatients} color="blue" iconType="total" />
        <StatCard label="In Queue" value={stats.inQueue} color="orange" iconType="waiting" />
        <StatCard label="Currently Serving" value={stats.currentlyServing} color="blue" iconType="time" />
      </div>

      {/* Patient Queue Management */}
      <div className="bg-white border rounded shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Patient Queue</h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {/* Add New Patient Button */}
              <button
                onClick={handleNewPatient}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-2"
              >
                <FiPlus />
                Add New Patient
              </button>
              
              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="all">All Patients</option>
                <option value="waiting">Waiting</option>
                <option value="serving">Being Served</option>
                <option value="completed">Completed</option>
                <option value="no-show">No Show</option>
              </select>
              
              <button
                onClick={() => {
                  fetchPatients();
                  fetchStats();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Patients Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4"><SkeletonTable rows={5} /></div>
          ) : patients.length === 0 ? (
            <EmptyState title="No patients in queue" description="New walk-ins and checked-in patients will appear here." />
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Queue No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wait Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Doctor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {patients.map((patient, index) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                        <div className="text-sm text-gray-500">UHID: {patient.patient_id}</div>
                        <div className="text-sm text-gray-500">Phone: {patient.phone || '-'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {patient.check_in_time ? new Date(patient.check_in_time).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`font-medium ${
                        parseInt(calculateWaitTime(patient.check_in_time)) > 30 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {calculateWaitTime(patient.check_in_time)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge status={patient.queue_status || 'waiting'} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {patient.assigned_doctor_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {patient.queue_status === 'completed' ? (
                        <button
                          onClick={() => handlePatientPayment(patient)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1"
                        >
                          <FiDollarSign />
                          Payment
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        {patient.queue_status === 'waiting' && (
                          <button
                            onClick={() => {
                              setSelectedPatient(patient);
                              setShowAssignModal(true);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >
                            Assign Doctor
                          </button>
                        )}
                        
                        {patient.queue_status === 'waiting' && (
                          <button
                            onClick={() => updatePatientStatus(patient.id, 'serving')}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            Start Serving
                          </button>
                        )}
                        
                        {patient.queue_status === 'serving' && (
                          <button
                            onClick={() => updatePatientStatus(patient.id, 'completed')}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            Complete
                          </button>
                        )}
                        
                        <button
                          onClick={() => updatePatientStatus(patient.id, 'no-show')}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        >
                          No Show
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Assign Doctor Modal */}
      {showAssignModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Assign Doctor</h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Patient: <strong>{selectedPatient.name}</strong></p>
              <p className="text-sm text-gray-600">UHID: {selectedPatient.patient_id}</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Doctor</label>
              <select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a doctor...</option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedPatient(null);
                  setSelectedDoctor('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={assignToDoctor}
                disabled={!selectedDoctor}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Patient Modal */}
      <AddPatientModal
        isOpen={showAddPatientModal}
        onClose={() => setShowAddPatientModal(false)}
        onSuccess={handlePatientCreated}
      />

      {/* Payment Modal */}
      {showPaymentModal && selectedPatientForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Process Payment</h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Patient: <strong>{selectedPatientForPayment.name}</strong></p>
              <p className="text-sm text-gray-600">UHID: {selectedPatientForPayment.patient_id}</p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹)</label>
              <input
                type="number"
                id="paymentAmount"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select
                id="paymentMethod"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="online">Online Transfer</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                id="paymentNotes"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Optional notes..."
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedPatientForPayment(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const amount = document.getElementById('paymentAmount').value;
                  const method = document.getElementById('paymentMethod').value;
                  const notes = document.getElementById('paymentNotes').value;
                  
                  if (!amount || amount <= 0) {
                    alert('Please enter a valid amount');
                    return;
                  }
                  
                  processPayment({
                    amount: parseFloat(amount),
                    payment_method: method,
                    notes: notes
                  });
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Process Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
