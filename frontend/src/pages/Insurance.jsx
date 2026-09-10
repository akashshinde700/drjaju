import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';

export default function Insurance() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApiClient();
  const { addToast } = useToast();
  const [policies, setPolicies] = useState([]);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [form, setForm] = useState({
    provider: '',
    policy_number: '',
    coverage_details: '',
    valid_till: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch patient info
      const patientRes = await api.get(`/api/patients/${patientId}`);
      setPatient(patientRes.data?.data || patientRes.data);

      // Fetch insurance policies
      const policiesRes = await api.get(`/api/insurance/patient/${patientId}`);
      setPolicies(policiesRes.data.policies || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load insurance data');
    } finally {
      setLoading(false);
    }
  }, [api, patientId]);

  useEffect(() => {
    if (patientId) {
      fetchData();
    }
  }, [patientId, fetchData]);

  const handleOpenModal = (policy = null) => {
    if (policy) {
      setEditingPolicy(policy);
      setForm({
        provider: policy.provider || '',
        policy_number: policy.policy_number || '',
        coverage_details: policy.coverage_details || '',
        valid_till: policy.valid_till ? policy.valid_till.split('T')[0] : ''
      });
    } else {
      setEditingPolicy(null);
      setForm({
        provider: '',
        policy_number: '',
        coverage_details: '',
        valid_till: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPolicy(null);
    setForm({
      provider: '',
      policy_number: '',
      coverage_details: '',
      valid_till: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingPolicy) {
        await api.put(`/api/insurance/${editingPolicy.id}`, form);
        addToast('Insurance policy updated successfully', 'success');
      } else {
        await api.post('/api/insurance', {
          ...form,
          patient_id: parseInt(patientId)
        });
        addToast('Insurance policy added successfully', 'success');
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save insurance policy', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this insurance policy?')) {
      return;
    }

    try {
      await api.delete(`/api/insurance/${id}`);
      addToast('Insurance policy deleted successfully', 'success');
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete insurance policy', 'error');
    }
  };

  const isPolicyExpired = (validTill) => {
    if (!validTill) return false;
    return new Date(validTill) < new Date();
  };

  const isPolicyExpiringSoon = (validTill) => {
    if (!validTill) return false;
    const expiryDate = new Date(validTill);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Insurance Policies</h1>
              {patient && (
                <p className="text-gray-600 mt-1">
                  {patient.name} • UHID: {patient.patient_id}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(location.state?.returnTo || `/patient-overview/${patientId}`)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Back to Patient
              </button>
              <button
              disabled={true}
                onClick={() => handleOpenModal()}
                className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90"
              >
                + Add Policy
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {loading && !policies.length ? (
          <div className="text-center py-12">
            <div className="text-lg text-gray-600">Loading insurance policies...</div>
          </div>
        ) : policies.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No insurance policies</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding a new insurance policy for this patient.
            </p>
            <div className="mt-6">
              <button
              disabled={true}
                onClick={() => handleOpenModal()}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
              >
                + Add Policy
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {policy.provider || 'Unknown Provider'}
                      </h3>
                      {policy.valid_till && (
                        <>
                          {isPolicyExpired(policy.valid_till) ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              Expired
                            </span>
                          ) : isPolicyExpiringSoon(policy.valid_till) ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Expiring Soon
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {policy.policy_number && (
                        <p>
                          <span className="font-medium">Policy Number:</span> {policy.policy_number}
                        </p>
                      )}
                      {policy.valid_till && (
                        <p>
                          <span className="font-medium">Valid Till:</span>{' '}
                          {new Date(policy.valid_till).toLocaleDateString()}
                        </p>
                      )}
                      {policy.coverage_details && (
                        <p>
                          <span className="font-medium">Coverage:</span> {policy.coverage_details}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Added on {new Date(policy.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleOpenModal(policy)}
                      className="px-3 py-2 text-sm text-primary border border-primary rounded-md hover:bg-primary/5"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(policy.id)}
                      className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingPolicy ? 'Edit Insurance Policy' : 'Add Insurance Policy'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Insurance Provider *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., Blue Cross, Aetna, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Policy Number
                  </label>
                  <input
                    type="text"
                    value={form.policy_number}
                    onChange={(e) => setForm({ ...form, policy_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter policy number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coverage Details
                  </label>
                  <textarea
                    value={form.coverage_details}
                    onChange={(e) => setForm({ ...form, coverage_details: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter coverage details..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid Till
                  </label>
                  <input
                    type="date"
                    value={form.valid_till}
                    onChange={(e) => setForm({ ...form, valid_till: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : editingPolicy ? 'Update' : 'Add'} Policy
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

