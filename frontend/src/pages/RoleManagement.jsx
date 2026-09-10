import React, { useEffect, useState, useCallback } from 'react';
import HeaderBar from '../components/HeaderBar';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import RequireRole from '../components/RequireRole';
import { SPECIALIZATIONS } from '../utils/specializations';

export default function RoleManagement() {

  const api = useApiClient();
  const { addToast } = useToast();
  const [permissions, setPermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorCount, setDoctorCount] = useState(0);
  const [maxDoctors, setMaxDoctors] = useState(10);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    email: '',
    specialization: '',
    consultation_fee: '',
    qualification: '',
    experience_years: ''
  });
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Move fetch functions above useEffect to avoid temporal dead zone
  // (Removed duplicate fetchPermissions and fetchUserPermissions)
    const fetchPermissions = React.useCallback(async () => {
      try {
        const res = await api.get('/api/permissions');
        setPermissions(res.data.permissions || []);
      } catch (err) {
        console.error('Failed to fetch permissions:', err);
      }
    }, [api]);

    const fetchUserPermissions = React.useCallback(async () => {
      try {
        const res = await api.get('/api/permissions/me');
        setUserPermissions(res.data.permissions || []);
      } catch (err) {
        console.error('Failed to fetch user permissions:', err);
      }
    }, [api]);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        await fetchPermissions();
        await fetchUserPermissions();
      } catch (err) {
        console.error(err);
      }
    };
    loadPermissions();
  }, [api, fetchPermissions, fetchUserPermissions]);

  // ...existing code...
  // (fetchPermissions and fetchUserPermissions are already declared above, remove any duplicate below)

  const getPermissionCategory = (permission) => {
    return permission.split('.')[0];
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    const category = getPermissionCategory(perm.permission);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(perm);
    return acc;
  }, {});

  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    try {
      const [allRes, countRes] = await Promise.all([
        api.get('/api/doctors/all'),
        api.get('/api/doctors/count')
      ]);
      setDoctors(allRes.data.doctors || []);
      setDoctorCount(countRes.data.count || 0);
      setMaxDoctors(countRes.data.limit || 10);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to fetch doctors', 'error');
    } finally {
      setLoadingDoctors(false);
    }
  }, [api, addToast]);

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!doctorForm.name || !doctorForm.email || !doctorForm.specialization) {
      addToast('Please fill all required fields', 'warning');
      return;
    }

    try {
      await api.post('/api/doctors', doctorForm);
      addToast('Doctor added successfully', 'success');
      setShowAddDoctorModal(false);
      setDoctorForm({
        name: '',
        email: '',
        specialization: '',
        consultation_fee: '',
        qualification: '',
        experience_years: ''
      });
      fetchDoctors();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to add doctor', 'error');
    }
  };

  const handleDeleteDoctor = async (doctorId) => {
    if (window.confirm('Are you sure you want to delete this doctor?')) {
      try {
        await api.delete(`/api/doctors/${doctorId}`);
        addToast('Doctor deleted successfully', 'success');
        fetchDoctors();
      } catch (err) {
        addToast(err.response?.data?.error || 'Failed to delete doctor', 'error');
      }
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  return (
    <RequireRole allowed={['admin']}>
      <div className="min-h-screen bg-gray-50">
        <HeaderBar title="Role & Permissions" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Role & Permissions</h1>
            <p className="text-gray-600 mt-1">View and manage system permissions and doctors</p>
          </div>

          {/* User Permissions Card */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Your Permissions</h2>
            <div className="flex flex-wrap gap-2">
              {userPermissions.length > 0 ? (
                userPermissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {perm}
                  </span>
                ))
              ) : (
                <p className="text-gray-500">No permissions assigned</p>
              )}
            </div>
          </div>

          {/* All Permissions by Category */}
          <div className="space-y-6 mb-8">
            {Object.entries(groupedPermissions).map(([category, perms]) => (
              <div key={category} className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 capitalize">{category}</h3>
                <div className="space-y-3">
                  {perms.map((perm) => (
                    <div key={perm.permission} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{perm.permission}</p>
                        <p className="text-sm text-gray-500">
                          Allowed roles: {perm.allowedRoles.join(', ')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {perm.allowedRoles.map((role) => (
                          <span
                            key={role}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Doctor Management Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold">Doctor Management</h2>
                <p className="text-gray-600 mt-1">Manage doctors ({doctorCount}/{maxDoctors})</p>
              </div>
              <button
                onClick={() => setShowAddDoctorModal(true)}
                disabled={doctorCount >= maxDoctors}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add Doctor
              </button>
            </div>

            {loadingDoctors ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Loading doctors...</p>
              </div>
            ) : doctors.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No doctors added yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specialization</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Experience</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {doctors.map((doctor) => (
                      <tr key={doctor.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{doctor.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{doctor.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{doctor.specialization}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">₹{doctor.consultation_fee}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{doctor.experience_years} years</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            doctor.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {doctor.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleDeleteDoctor(doctor.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Doctor Modal */}
          {showAddDoctorModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-md w-full">
                <div className="p-6 border-b">
                  <h2 className="text-2xl font-semibold">Add New Doctor</h2>
                </div>
                <form onSubmit={handleAddDoctor} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      required
                      value={doctorForm.name}
                      onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      value={doctorForm.email}
                      onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Specialization *</label>
                    <input
                      type="text"
                      list="specializations"
                      required
                      value={doctorForm.specialization}
                      onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                      placeholder="e.g., Cardiology, Neurology"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <datalist id="specializations">
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Consultation Fee</label>
                    <input
                      type="number"
                      value={doctorForm.consultation_fee}
                      onChange={(e) => setDoctorForm({ ...doctorForm, consultation_fee: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Qualification</label>
                    <input
                      type="text"
                      value={doctorForm.qualification}
                      onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                      placeholder="e.g., MBBS, MD"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Experience (Years)</label>
                    <input
                      type="number"
                      value={doctorForm.experience_years}
                      onChange={(e) => setDoctorForm({ ...doctorForm, experience_years: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddDoctorModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add Doctor
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </RequireRole>
  );
}

