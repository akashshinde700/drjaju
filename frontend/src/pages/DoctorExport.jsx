import { useEffect, useState, useCallback } from 'react';
import HeaderBar from '../components/HeaderBar';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import RequireRole from '../components/RequireRole';

export default function DoctorExport() {
  const api = useApiClient();
  const { addToast } = useToast();

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Date range filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Table selection for exports
  const [selectedTables, setSelectedTables] = useState({
    all: true,
    patients: false,
    appointments: false,
    prescriptions: false,
    lab_investigations: false,
    bills: false,
    medical_records: false
  });

  // Single table export (CSV only)
  const [singleTable, setSingleTable] = useState('appointments');

  // Fetch all doctors
  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctors/all');
      setDoctors(res.data.doctors || []);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to load doctors', 'error');
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Fetch doctor statistics
  const fetchStats = async () => {
    if (!selectedDoctor) {
      addToast('Please select a doctor', 'error');
      return;
    }

    setLoadingStats(true);
    try {
      const params = { doctorId: selectedDoctor };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/api/doctors/export/stats', { params });
      setStats(res.data);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to load statistics', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  // Handle table selection toggle
  const handleTableToggle = (table) => {
    if (table === 'all') {
      setSelectedTables({
        all: !selectedTables.all,
        patients: false,
        appointments: false,
        prescriptions: false,
        lab_investigations: false,
        bills: false,
        medical_records: false
      });
    } else {
      setSelectedTables({
        ...selectedTables,
        all: false,
        [table]: !selectedTables[table]
      });
    }
  };

  // Export as Excel
  const handleExportExcel = async () => {
    if (!selectedDoctor) {
      addToast('Please select a doctor', 'error');
      return;
    }

    setExporting(true);
    try {
      const params = { doctorId: selectedDoctor };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      // Get selected tables
      const tables = [];
      if (selectedTables.all) {
        tables.push('all');
      } else {
        Object.keys(selectedTables).forEach(key => {
          if (key !== 'all' && selectedTables[key]) {
            tables.push(key);
          }
        });
      }
      if (tables.length > 0) {
        params.tables = tables.join(',');
      }

      const res = await api.get('/api/doctors/export/excel', {
        params,
        responseType: 'blob',
        timeout: 60000 // 60 seconds for large exports
      });

      const blob = new Blob([res.data], { type: 'application/vnd.ms-excel' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `doctor-export-${Date.now()}.xls`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      addToast('Excel file exported successfully', 'success');
    } catch (err) {
      console.error('Excel export error:', err);
      let errorMsg = 'Failed to export Excel';
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMsg = 'Export timed out. Please try with a smaller date range or fewer tables.';
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err.message) {
        errorMsg = err.message;
      }
      addToast(errorMsg, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Export as CSV (single table)
  const handleExportCSV = async () => {
    if (!selectedDoctor) {
      addToast('Please select a doctor', 'error');
      return;
    }

    if (!singleTable) {
      addToast('Please select a table', 'error');
      return;
    }

    setExporting(true);
    try {
      const params = {
        doctorId: selectedDoctor,
        table: singleTable
      };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/api/doctors/export/csv', {
        params,
        responseType: 'blob',
        timeout: 60000 // 60 seconds for large exports
      });

      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `doctor-${singleTable}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      addToast('CSV file exported successfully', 'success');
    } catch (err) {
      console.error('CSV export error:', err);
      let errorMsg = 'Failed to export CSV';
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMsg = 'Export timed out. Please try with a smaller date range.';
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err.message) {
        errorMsg = err.message;
      }
      addToast(errorMsg, 'error');
    } finally {
      setExporting(false);
    }
  };

  // Export as SQL
  const handleExportSQL = async () => {
    if (!selectedDoctor) {
      addToast('Please select a doctor', 'error');
      return;
    }

    setExporting(true);
    try {
      const params = { doctorId: selectedDoctor };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/api/doctors/export/sql', {
        params,
        responseType: 'blob',
        timeout: 60000 // 60 seconds for large exports
      });

      const blob = new Blob([res.data], { type: 'application/sql' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `doctor-backup-${Date.now()}.sql`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      addToast('SQL file exported successfully', 'success');
    } catch (err) {
      console.error('SQL export error:', err);
      let errorMsg = 'Failed to export SQL';
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMsg = 'Export timed out. Please try with a smaller date range.';
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err.message) {
        errorMsg = err.message;
      }
      addToast(errorMsg, 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <RequireRole allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50">
        <HeaderBar title="Doctor Data Export" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Doctor Selection */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Select Doctor</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Doctor
                </label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => {
                    setSelectedDoctor(e.target.value);
                    setStats(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="">-- Select Doctor --</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.doctor_name} - {doc.specialization || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="End Date"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={fetchStats}
              disabled={!selectedDoctor || loadingStats}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loadingStats ? 'Loading...' : 'Load Statistics'}
            </button>
          </div>

          {/* Statistics Display */}
          {stats && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Doctor Statistics</h2>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Patients</div>
                  <div className="text-2xl font-bold text-blue-600">{stats.counts.patients}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Appointments</div>
                  <div className="text-2xl font-bold text-green-600">{stats.counts.appointments}</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Prescriptions</div>
                  <div className="text-2xl font-bold text-purple-600">{stats.counts.prescriptions}</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Lab Tests</div>
                  <div className="text-2xl font-bold text-yellow-600">{stats.counts.labInvestigations}</div>
                </div>
                <div className="bg-pink-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Bills</div>
                  <div className="text-2xl font-bold text-pink-600">{stats.counts.bills}</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Records</div>
                  <div className="text-2xl font-bold text-indigo-600">{stats.counts.medicalRecords}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-gray-700">Appointment Status</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Scheduled:</span>
                      <span className="font-medium">{stats.appointmentStats.scheduled}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed:</span>
                      <span className="font-medium">{stats.appointmentStats.completed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cancelled:</span>
                      <span className="font-medium">{stats.appointmentStats.cancelled}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>No-Show:</span>
                      <span className="font-medium">{stats.appointmentStats.noShow}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 text-gray-700">Revenue Summary</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Total Amount:</span>
                      <span className="font-medium">₹{stats.revenue.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid:</span>
                      <span className="font-medium text-green-600">₹{stats.revenue.paidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending:</span>
                      <span className="font-medium text-orange-600">₹{stats.revenue.pendingAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Export Options */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Excel Export */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Export as Excel</h2>

              <div className="space-y-2 mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTables.all}
                    onChange={() => handleTableToggle('all')}
                    className="mr-2"
                  />
                  <span className="text-sm">All Tables</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTables.patients}
                    onChange={() => handleTableToggle('patients')}
                    disabled={selectedTables.all}
                    className="mr-2"
                  />
                  <span className="text-sm">Patients</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTables.appointments}
                    onChange={() => handleTableToggle('appointments')}
                    disabled={selectedTables.all}
                    className="mr-2"
                  />
                  <span className="text-sm">Appointments</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTables.prescriptions}
                    onChange={() => handleTableToggle('prescriptions')}
                    disabled={selectedTables.all}
                    className="mr-2"
                  />
                  <span className="text-sm">Prescriptions</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTables.lab_investigations}
                    onChange={() => handleTableToggle('lab_investigations')}
                    disabled={selectedTables.all}
                    className="mr-2"
                  />
                  <span className="text-sm">Lab Investigations</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTables.bills}
                    onChange={() => handleTableToggle('bills')}
                    disabled={selectedTables.all}
                    className="mr-2"
                  />
                  <span className="text-sm">Bills</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTables.medical_records}
                    onChange={() => handleTableToggle('medical_records')}
                    disabled={selectedTables.all}
                    className="mr-2"
                  />
                  <span className="text-sm">Medical Records</span>
                </label>
              </div>

              <button
                onClick={handleExportExcel}
                disabled={!selectedDoctor || exporting}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {exporting ? 'Exporting...' : 'Export Excel'}
              </button>
            </div>

            {/* CSV Export */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Export as CSV</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Table
                </label>
                <select
                  value={singleTable}
                  onChange={(e) => setSingleTable(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="patients">Patients</option>
                  <option value="appointments">Appointments</option>
                  <option value="prescriptions">Prescriptions</option>
                  <option value="lab_investigations">Lab Investigations</option>
                  <option value="bills">Bills</option>
                  <option value="medical_records">Medical Records</option>
                </select>
              </div>

              <button
                onClick={handleExportCSV}
                disabled={!selectedDoctor || exporting}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>

            {/* SQL Export */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Export as SQL</h2>

              <p className="text-sm text-gray-600 mb-4">
                Export complete doctor data as SQL backup file including all tables and relationships.
              </p>

              <button
                onClick={handleExportSQL}
                disabled={!selectedDoctor || exporting}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {exporting ? 'Exporting...' : 'Export SQL'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </RequireRole>
  );
}
