import { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { FiPlus, FiEdit, FiTrash2, FiX } from 'react-icons/fi';
import HeaderBar from '../components/HeaderBar';

const DoctorManagement = () => {
  const api = useApiClient();
  const { addToast } = useToast();

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    name: '',
    email: '',
    phone: '',
    specialization: '',
    consultation_fee: '',
    experience_years: '',
    qualification: '',
    address: '',
    is_active: true
  });

  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/doctors/all');
      setDoctors(res.data.doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      addToast('Failed to load doctors', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleOpenModal = (doctor = null) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setFormData({
        user_id: doctor.user_id || '',
        name: doctor.name || '',
        email: doctor.email || '',
        phone: doctor.phone || '',
        specialization: doctor.specialization || '',
        consultation_fee: doctor.consultation_fee || '',
        experience_years: doctor.experience_years || '',
        qualification: doctor.qualification || '',
        address: doctor.address || '',
        is_active: doctor.is_active !== undefined ? doctor.is_active : true
      });
    } else {
      setEditingDoctor(null);
      setFormData({
        user_id: '',
        name: '',
        email: '',
        phone: '',
        specialization: '',
        consultation_fee: '',
        experience_years: '',
        qualification: '',
        address: '',
        is_active: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDoctor(null);
    setFormData({
      user_id: '',
      name: '',
      email: '',
      phone: '',
      specialization: '',
      consultation_fee: '',
      experience_years: '',
      qualification: '',
      address: '',
      is_active: true
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.specialization) {
      addToast('Name, email, and specialization are required', 'error');
      return;
    }

    try {
      const payload = {
        ...formData,
        consultation_fee: formData.consultation_fee ? parseFloat(formData.consultation_fee) : null,
        experience_years: formData.experience_years ? parseInt(formData.experience_years) : null
      };

      if (editingDoctor) {
        await api.put(`/api/doctors/${editingDoctor.id}`, payload);
        addToast('Doctor updated successfully', 'success');
      } else {
        await api.post('/api/doctors', payload);
        addToast('Doctor added successfully', 'success');
      }

      fetchDoctors();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving doctor:', error);
      addToast(error.response?.data?.error || 'Failed to save doctor', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this doctor?')) return;

    try {
      await api.delete(`/api/doctors/${id}`);
      addToast('Doctor deleted successfully', 'success');
      fetchDoctors();
    } catch (error) {
      console.error('Error deleting doctor:', error);
      addToast('Failed to delete doctor', 'error');
    }
  };

  if (loading) {
    return (
      <div>
        <HeaderBar title="Doctor Management" />
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading doctors...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <HeaderBar title="Doctor Management" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Doctor Management</h2>
            <p className="text-gray-600 mt-1">Manage doctors ({doctors.filter(d => d.is_active).length}/{doctors.length})</p>
          </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiPlus className="w-5 h-5" />
          Add Doctor
        </button>
      </div>

      {doctors.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">No doctors added yet</p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Your First Doctor
          </button>
        </div>
      ) : (
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NAME
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EMAIL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SPECIALIZATION
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  FEE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EXPERIENCE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  STATUS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {doctors.map((doctor) => (
                <tr key={doctor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{doctor.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{doctor.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{doctor.specialization}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      ₹{doctor.consultation_fee ? parseFloat(doctor.consultation_fee).toFixed(2) : '0.00'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {doctor.experience_years ? `${doctor.experience_years} years` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        doctor.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {doctor.is_active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(doctor)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(doctor.id)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingDoctor ? 'Edit Doctor' : 'Add Doctor'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Dr. John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="doctor@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+91 9876543210"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Specialization *
                  </label>
                  <input
                    type="text"
                    value={formData.specialization}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialization: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Internal Medicine, Diabetology & Cardiology"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consultation Fee (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.consultation_fee}
                    onChange={(e) => setFormData(prev => ({ ...prev, consultation_fee: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="700.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Experience (years)
                  </label>
                  <input
                    type="number"
                    value={formData.experience_years}
                    onChange={(e) => setFormData(prev => ({ ...prev, experience_years: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="15"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qualification
                  </label>
                  <input
                    type="text"
                    value={formData.qualification}
                    onChange={(e) => setFormData(prev => ({ ...prev, qualification: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="MBBS, MD"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="2"
                    placeholder="Clinic address"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingDoctor ? 'Update Doctor' : 'Add Doctor'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default DoctorManagement;
