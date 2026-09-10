import React, { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import HeaderBar from '../components/HeaderBar';
import { FiPlus, FiEdit, FiTrash2, FiX } from 'react-icons/fi';
import { SPECIALIZATIONS } from '../utils/specializations';

/** Admin panel: max doctors per clinic deployment; staff pool scales with doctor count */
const MAX_DOCTORS = 10;
const STAFF_PER_DOCTOR = 5;

/** Active rows from /api/doctor-staff list (shared cap for admin + doctor adds) */
function countActiveStaffMappings(staffRows) {
  return staffRows.filter((r) => Number(r.is_active) === 1).length;
}

export default function UserManagement({ showStaffOnly = false }) {
  const api = useApiClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [doctorProfiles, setDoctorProfiles] = useState([]);
  const [staffCountByDoctor, setStaffCountByDoctor] = useState({});
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'doctor', 'staff'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: '',
    // Doctor specific
    specialization: '',
    qualification: '',
    registration_number: '',
    consultation_fee: '',
    assigned_doctor_id: ''
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      if (showStaffOnly && user?.role === 'doctor') {
        // Doctors use the doctor-staff API — no /api/users needed
        const doctorId = user?.doctor_id;
        if (!doctorId) { setUsers([]); return; }
        const res = await api.get(`/api/doctor-staff/${doctorId}`);
        const staff = res.data?.data?.staff || [];
        // Normalise shape to match table expectations
        const normalised = staff.map(s => ({
          id: s.id,           // doctor_staff row id (used for delete)
          user_id: s.user_id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          role: s.role || 'staff',
          is_active: s.is_active,
        }));
        setUsers(normalised);
      } else {
        const res = await api.get('/api/users');
        setUsers(res.data?.data?.data || res.data?.data?.users || []);

        if (user?.role === 'admin') {
          const doctorsRes = await api.get('/api/doctors');
          const doctors = doctorsRes.data?.doctors || [];
          setDoctorProfiles(doctors);

          const staffEntries = await Promise.all(
            doctors.map(async (doc) => {
              try {
                const staffRes = await api.get(`/api/doctor-staff/${doc.id}`);
                const count = staffRes.data?.data?.staff?.filter((s) => Number(s.is_active) === 1).length || 0;
                return [doc.id, count];
              } catch (e) {
                return [doc.id, 0];
              }
            })
          );
          setStaffCountByDoctor(Object.fromEntries(staffEntries));
        }
      }
    } catch (error) {
      if (error.response?.status !== 403) {
        console.error('Error fetching users:', error);
        addToast('Failed to load users', 'error');
      } else {
        setUsers([]);
        addToast('User Management requires Admin privileges', 'info');
      }
    } finally {
      setLoading(false);
    }
  }, [api, addToast, showStaffOnly, user?.role, user?.doctor_id]);

  useEffect(() => {
    if (user?.role === 'admin' || (showStaffOnly && user?.role === 'doctor')) {
      fetchUsers();
    } else {
      setUsers([]);
    }
  }, [user?.id, user?.role, showStaffOnly, fetchUsers]);

  const handleOpenModal = (type) => {
    // Check role limits
    const doctorCount = users.filter(u => u.role === 'doctor').length;

    let staffLimit;
    let staffCount;
    if (showStaffOnly && user?.role === 'doctor') {
      // Per-doctor cap: same 5 slots whether staff were added by admin or this doctor
      staffLimit = STAFF_PER_DOCTOR;
      staffCount = countActiveStaffMappings(users);
    } else if (!showStaffOnly && user?.role === 'admin') {
      staffLimit = Math.max(STAFF_PER_DOCTOR * doctorCount, STAFF_PER_DOCTOR);
      staffCount = Object.values(staffCountByDoctor).reduce((sum, n) => sum + Number(n || 0), 0);
    } else {
      staffLimit = Math.max(STAFF_PER_DOCTOR * doctorCount, STAFF_PER_DOCTOR);
      staffCount = users.filter(u => u.role === 'staff').length;
    }

    if (type === 'doctor' && doctorCount >= MAX_DOCTORS) {
      addToast(`Cannot add more than ${MAX_DOCTORS} doctors. Maximum limit reached.`, 'error');
      return;
    }

    if (type === 'staff' && staffCount >= staffLimit) {
      const hint = showStaffOnly && user?.role === 'doctor'
        ? ` (max ${STAFF_PER_DOCTOR} per doctor, including staff added by admin)`
        : ` (${STAFF_PER_DOCTOR} per doctor)`;
      addToast(`Maximum ${staffLimit} staff allowed${hint}. Limit reached.`, 'error');
      return;
    }

    setModalType(type);
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: type === 'doctor' ? 'doctor' : 'staff',
      specialization: '',
      qualification: '',
      registration_number: '',
      consultation_fee: '',
      assigned_doctor_id: ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalType('');
    setFormData({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (showStaffOnly && user?.role === 'doctor') {
        const activeForThisDoctor = countActiveStaffMappings(users);
        if (activeForThisDoctor >= STAFF_PER_DOCTOR) {
          throw new Error(
            `Maximum ${STAFF_PER_DOCTOR} staff allowed for your account (including staff added by admin).`
          );
        }
        // Step 1: Register the staff user with email+password so they can login
        const userRes = await api.post('/api/auth/register', {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: 'staff',
          clinic_id: user?.clinic_id || null,
        });
        const newUserId = userRes.data.data?.user?.id || userRes.data.user?.id || userRes.data.id;
        if (!newUserId) {
          const msg = userRes.data?.error || userRes.data?.message || 'Registration failed. This email may already be in use.';
          throw new Error(msg);
        }
        // Step 2: Link staff to this doctor
        await api.post('/api/doctor-staff', {
          doctor_id: user.doctor_id,
          staff_user_id: newUserId,
          is_active: 1,
        });
        addToast('Staff added successfully', 'success');
        handleCloseModal();
        fetchUsers();
      } else if (modalType === 'doctor') {
        const userRes = await api.post('/api/auth/register', {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: 'doctor',
          clinic_id: user?.clinic_id || null
        });
        const newDoctorUserId = userRes.data?.data?.user?.id || userRes.data?.user?.id || userRes.data?.id;
        if (!newDoctorUserId) {
          const msg = userRes.data?.error || userRes.data?.message || 'Doctor registration failed';
          throw new Error(msg);
        }
        try {
          await api.post('/api/doctors', {
            user_id: newDoctorUserId,
            clinic_id: user?.clinic_id || null,
            specialization: formData.specialization,
            qualification: formData.qualification,
            license_number: formData.registration_number,
            consultation_fee: formData.consultation_fee
          });
        } catch (doctorErr) {
          // Rollback: delete orphaned user account so retry works
          try { await api.delete(`/api/users/${newDoctorUserId}`); } catch (_err) { /* Rollback silent fail */ }
          throw doctorErr;
        }
        addToast('Doctor created successfully', 'success');
        handleCloseModal();
        fetchUsers();
      } else {
        if (!showStaffOnly && user?.role === 'admin') {
          const selectedDoctorId = parseInt(formData.assigned_doctor_id, 10);
          if (!selectedDoctorId) {
            throw new Error('Please select a doctor for this staff member');
          }

          const selectedDoctorStaffCount = staffCountByDoctor[selectedDoctorId] || 0;
          if (selectedDoctorStaffCount >= STAFF_PER_DOCTOR) {
            throw new Error(`Selected doctor already has ${STAFF_PER_DOCTOR} staff members`);
          }
        }

        const registerRes = await api.post('/api/auth/register', {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: formData.role,
          clinic_id: user?.clinic_id || null
        });

        if (!showStaffOnly && user?.role === 'admin') {
          const selectedDoctorId = parseInt(formData.assigned_doctor_id, 10);
          const newStaffUserId = registerRes.data?.data?.user?.id || registerRes.data?.user?.id || registerRes.data?.id;
          if (!newStaffUserId) {
            throw new Error('Staff user created but ID not found');
          }
          await api.post('/api/doctor-staff', {
            doctor_id: selectedDoctorId,
            staff_user_id: newStaffUserId,
            is_active: 1,
          });
        }

        addToast('Staff created successfully', 'success');
        handleCloseModal();
        fetchUsers();
      }
    } catch (error) {
      console.error('Error creating user:', error);
      const apiData = error.response?.data;
      const msg =
        apiData?.message ||
        apiData?.error ||
        (typeof apiData === 'string' ? apiData : null) ||
        (typeof error.message === 'string' ? error.message : null) ||
        'Failed to create user';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      if (showStaffOnly && user?.role === 'doctor') {
        // id here is the doctor_staff row id
        await api.delete(`/api/doctor-staff/${id}`);
      } else {
        await api.delete(`/api/users/${id}`);
      }
      addToast('Deleted successfully', 'success');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting:', error);
      addToast('Failed to delete', 'error');
    }
  };

  // Access control: Admin can access everything, Doctors can only access staff management
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-lg text-gray-600">Access Denied. Please log in.</p>
      </div>
    );
  }

  // If showStaffOnly is true, allow doctors to access (for their staff management)
  // Otherwise, only admin can access (for full user management)
  if (user.role !== 'admin' && (!showStaffOnly || user.role !== 'doctor')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-lg text-gray-600">Access Denied. Admin only.</p>
      </div>
    );
  }

  const doctorCount = users.filter(u => u.role === 'doctor').length;
  const totalMappedStaff = Object.values(staffCountByDoctor).reduce((sum, count) => sum + Number(count || 0), 0);
  // showStaffOnly: list is doctor_staff mappings; count active only (same pool admin + doctor use)
  const staffCount = showStaffOnly
    ? countActiveStaffMappings(users)
    : (user?.role === 'admin' ? totalMappedStaff : users.filter(u => u.role === 'staff').length);
  const staffLimit = showStaffOnly ? STAFF_PER_DOCTOR : Math.max(STAFF_PER_DOCTOR * doctorCount, STAFF_PER_DOCTOR);

  const displayedUsers = showStaffOnly ? users : users;

  // Only show the admin-only info box when this isn't the staff-only view
  if (user?.role !== 'admin' && !showStaffOnly) {
    return (
      <div className="space-y-4">
        <HeaderBar title="User Management" />
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 font-medium">User Management requires Admin privileges</p>
          <p className="text-yellow-700 text-sm mt-2">Please contact your administrator to manage users</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!showStaffOnly && <HeaderBar title="User Management" />}
      {showStaffOnly && <h2 className="text-2xl font-semibold text-gray-900">Staff Management</h2>}

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-3 flex-wrap">
          {!showStaffOnly && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleOpenModal('doctor')}
                disabled={doctorCount >= MAX_DOCTORS}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <FiPlus /> Add Doctor
              </button>
              <span className={`text-xs ${doctorCount >= MAX_DOCTORS ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                {doctorCount}/{MAX_DOCTORS} Doctors
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleOpenModal('staff')}
              disabled={staffCount >= staffLimit}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <FiPlus /> Add Staff
            </button>
            <span className={`text-xs ${staffCount >= staffLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
              {staffCount}/{staffLimit} Staff
            </span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedUsers.map((u) => (
              <tr key={u.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{u.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{u.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    u.role === 'admin' ? 'bg-red-100 text-red-800' :
                    u.role === 'doctor' ? 'bg-blue-100 text-blue-800' :
                    u.role === 'sub_admin' ? 'bg-purple-100 text-purple-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {u.phone}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    u.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="text-red-600 hover:text-red-900"
                    disabled={u.role === 'admin'}
                  >
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                Add {modalType === 'doctor' ? 'Doctor' : 'Staff'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Common Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    autoComplete="off"
                    placeholder="e.g. 9876543210"
                    pattern="[0-9]{10}"
                    title="Please enter a valid 10-digit phone number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Doctor Specific Fields */}
              {modalType === 'doctor' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Specialization *
                    </label>
                    <input
                      type="text"
                      list="specializations"
                      required
                      value={formData.specialization}
                      onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <datalist id="specializations">
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Qualification
                    </label>
                    <input
                      type="text"
                      value={formData.qualification}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={formData.registration_number}
                      onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Consultation Fee
                    </label>
                    <input
                      type="number"
                      value={formData.consultation_fee}
                      onChange={(e) => setFormData({ ...formData, consultation_fee: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {modalType === 'staff' && !showStaffOnly && user?.role === 'admin' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assign Doctor *
                    </label>
                    <select
                      required
                      value={formData.assigned_doctor_id}
                      onChange={(e) => setFormData({ ...formData, assigned_doctor_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select doctor</option>
                      {doctorProfiles.map((doc) => {
                        const assignedCount = staffCountByDoctor[doc.id] || 0;
                        return (
                          <option key={doc.id} value={doc.id} disabled={assignedCount >= STAFF_PER_DOCTOR}>
                            {doc.name} ({assignedCount}/{STAFF_PER_DOCTOR})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}


              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
