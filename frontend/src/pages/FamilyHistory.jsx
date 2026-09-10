import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';

export default function FamilyHistory() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useApiClient();
  const { addToast } = useToast();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    relation: 'other',
    condition: '',
    notes: ''
  });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/family-history/${patientId}`);
      setHistory(res.data?.data?.history || res.data?.history || []);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to load family history', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, patientId, addToast]);

  useEffect(() => {
    if (patientId) {
      fetchHistory();
    }
  }, [patientId, fetchHistory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/api/family-history/${editingItem.id}`, form);
        addToast('Family history updated successfully', 'success');
      } else {
        await api.post(`/api/family-history/${patientId}`, form);
        addToast('Family history added successfully', 'success');
      }
      setShowAddModal(false);
      setEditingItem(null);
      setForm({ relation: 'other', condition: '', notes: '' });
      fetchHistory();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save family history', 'error');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      relation: item.relation,
      condition: item.condition_name || item.condition || '',
      notes: item.notes || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this family history entry?')) {
      return;
    }

    try {
      await api.delete(`/api/family-history/${id}`);
      addToast('Family history deleted successfully', 'success');
      fetchHistory();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete family history', 'error');
    }
  };

  const getRelationLabel = (relation) => {
    const labels = {
      father: 'Father',
      mother: 'Mother',
      brother: 'Brother',
      sister: 'Sister',
      grandparent: 'Grandparent',
      other: 'Other'
    };
    return labels[relation] || relation;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar title="Family History" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Family Medical History</h1>
            <p className="text-gray-600 mt-1">Track family medical conditions and history</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(location.state?.returnTo || `/patient-overview/${patientId}`)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back to Patient
            </button>
            <button
              onClick={() => {
                setEditingItem(null);
                setForm({ relation: 'other', condition: '', notes: '' });
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add History
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-lg text-gray-600">Loading family history...</div>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600 mb-4">No family history recorded</p>
            <button
              onClick={() => {
                setEditingItem(null);
                setForm({ relation: 'other', condition: '', notes: '' });
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add First Entry
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-200">
              {history.map((item) => (
                <div key={item.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {getRelationLabel(item.relation)}
                        </span>
                        <h3 className="text-lg font-semibold text-gray-900">{item.condition_name || item.condition}</h3>
                      </div>
                      {item.notes && (
                        <p className="text-gray-600 mt-2">{item.notes}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-2">
                        Added: {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(item)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full">
              <div className="p-6 border-b">
                <h2 className="text-2xl font-semibold">
                  {editingItem ? 'Edit Family History' : 'Add Family History'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Relation *</label>
                  <select
                    required
                    value={form.relation}
                    onChange={(e) => setForm({ ...form, relation: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="brother">Brother</option>
                    <option value="sister">Sister</option>
                    <option value="grandparent">Grandparent</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Medical Condition *</label>
                  <input
                    type="text"
                    required
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                    placeholder="e.g., Diabetes, Hypertension, Heart Disease"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={4}
                    placeholder="Additional details, age of onset, severity, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingItem(null);
                      setForm({ relation: 'other', condition: '', notes: '' });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingItem ? 'Update' : 'Add'} History
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

