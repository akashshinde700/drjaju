import { useEffect, useState, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import HeaderBar from '../components/HeaderBar';

export default function SubscriptionPackages() {
  const api = useApiClient();
  const { addToast } = useToast();

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);

  const [form, setForm] = useState({
    package_name: '',
    treatment_plan: 'General',
    subscription_plan: 'Monthly',
    session_count: 4,
    price_model: 'Advance',
    total_price: 0,
    validity_days: 30,
    family_access: false,
    staff_edit_access: false,
    description: '',
    sessions: []
  });

  const [sessionForm, setSessionForm] = useState({
    session_name: '',
    duration_minutes: 30,
    time: '10:00',
    days: [],
    description: ''
  });

  const treatmentPlans = ['General', 'Cardiology', 'Pediatrics', 'Orthopedics', 'Dermatology', 'Psychiatry'];
  const subscriptionPlans = ['Weekly', 'Monthly', 'Quarterly', 'Yearly'];
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Fetch packages
  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/subscription-packages');
      setPackages(res.data?.data?.packages || res.data?.packages || []);
    } catch (err) {
      addToast('Failed to fetch packages', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Add session
  const handleAddSession = () => {
    if (!sessionForm.session_name || sessionForm.days.length === 0) {
      addToast('Please fill all session details', 'warning');
      return;
    }

    setForm({
      ...form,
      sessions: [...form.sessions, { ...sessionForm, id: Date.now() }]
    });

    setSessionForm({
      session_name: '',
      duration_minutes: 30,
      time: '10:00',
      days: [],
      description: ''
    });

    addToast('Session added', 'success');
  };

  // Remove session
  const handleRemoveSession = (id) => {
    setForm({
      ...form,
      sessions: form.sessions.filter(s => s.id !== id)
    });
  };

  // Save package
  const handleSavePackage = async (e) => {
    e.preventDefault();

    if (form.sessions.length === 0) {
      addToast('Please add at least one session', 'warning');
      return;
    }

    try {
      setLoading(true);

      if (editingPackage) {
        await api.put(`/api/subscription-packages/${editingPackage.id}`, form);
        addToast('Package updated successfully', 'success');
      } else {
        await api.post('/api/subscription-packages', form);
        addToast('Package created successfully', 'success');
      }

      setForm({
        package_name: '',
        treatment_plan: 'General',
        subscription_plan: 'Monthly',
        session_count: 4,
        price_model: 'Advance',
        total_price: 0,
        validity_days: 30,
        family_access: false,
        staff_edit_access: false,
        description: '',
        sessions: []
      });
      setEditingPackage(null);
      setShowForm(false);
      fetchPackages();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save package', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete package
  const handleDeletePackage = async (id) => {
    if (!window.confirm('Delete this package?')) return;

    try {
      await api.delete(`/api/subscription-packages/${id}`);
      addToast('Package deleted successfully', 'success');
      fetchPackages();
    } catch (err) {
      addToast('Failed to delete package', 'error');
    }
  };

  // Edit package
  const handleEditPackage = (pkg) => {
    setEditingPackage(pkg);
    setForm({
      package_name: pkg.package_name,
      treatment_plan: pkg.treatment_plan,
      subscription_plan: pkg.subscription_plan,
      session_count: pkg.session_count,
      price_model: pkg.price_model,
      total_price: pkg.total_price,
      validity_days: pkg.validity_days,
      family_access: pkg.family_access,
      staff_edit_access: pkg.staff_edit_access,
      description: pkg.description,
      sessions: pkg.sessions || []
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <HeaderBar title="Subscription Packages" />

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8 text-slate-500">Loading packages...</div>
        ) : packages.length === 0 ? (
          <div className="col-span-full text-center py-8 text-slate-500">No packages found</div>
        ) : (
          packages.map(pkg => (
            <div key={pkg.id} className="bg-white rounded shadow-sm border p-4 hover:shadow-md transition">
              <div className="mb-3">
                <h3 className="font-semibold text-base">{pkg.package_name}</h3>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                    {pkg.treatment_plan}
                  </span>
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                    {pkg.subscription_plan}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-600 mb-3">
                <div>Sessions: {pkg.session_count}</div>
                <div>Price: ₹{pkg.total_price}</div>
                <div>Valid for: {pkg.validity_days} days</div>
                <div>Model: {pkg.price_model}</div>
              </div>

              {pkg.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{pkg.description}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleEditPackage(pkg)}
                  className="flex-1 px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePackage(pkg.id)}
                  className="flex-1 px-3 py-2 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}

        {/* Add New Package Card */}
        <button
          onClick={() => {
            setEditingPackage(null);
            setForm({
              package_name: '',
              treatment_plan: 'General',
              subscription_plan: 'Monthly',
              session_count: 4,
              price_model: 'Advance',
              total_price: 0,
              validity_days: 30,
              family_access: false,
              staff_edit_access: false,
              description: '',
              sessions: []
            });
            setShowForm(true);
          }}
          className="bg-white rounded shadow-sm border p-4 hover:shadow-md transition flex items-center justify-center min-h-[200px] border-dashed border-2 hover:border-primary"
        >
          <div className="text-center">
            <div className="text-3xl mb-2">+</div>
            <div className="text-sm font-medium">Create New Package</div>
          </div>
        </button>
      </div>

      {/* Package Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingPackage ? 'Edit Package' : 'Create New Package'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePackage} className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Package Name *</label>
                  <input
                    type="text"
                    value={form.package_name}
                    onChange={(e) => setForm({ ...form, package_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Treatment Plan</label>
                  <select
                    value={form.treatment_plan}
                    onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    {treatmentPlans.map(plan => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Subscription Plan</label>
                  <select
                    value={form.subscription_plan}
                    onChange={(e) => setForm({ ...form, subscription_plan: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    {subscriptionPlans.map(plan => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Price Model</label>
                  <select
                    value={form.price_model}
                    onChange={(e) => setForm({ ...form, price_model: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="Advance">Advance</option>
                    <option value="Per Session">Per Session</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Session Count</label>
                  <input
                    type="number"
                    value={form.session_count}
                    onChange={(e) => setForm({ ...form, session_count: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Total Price (₹)</label>
                  <input
                    type="number"
                    value={form.total_price}
                    onChange={(e) => setForm({ ...form, total_price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Validity (days)</label>
                  <input
                    type="number"
                    value={form.validity_days}
                    onChange={(e) => setForm({ ...form, validity_days: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              {/* Access Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.family_access}
                    onChange={(e) => setForm({ ...form, family_access: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Family Member Access</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.staff_edit_access}
                    onChange={(e) => setForm({ ...form, staff_edit_access: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Staff Edit Access</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows="2"
                />
              </div>

              {/* Sessions */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Sessions</h3>

                {/* Add Session Form */}
                <div className="bg-slate-50 p-4 rounded mb-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Session Name</label>
                    <input
                      type="text"
                      value={sessionForm.session_name}
                      onChange={(e) => setSessionForm({ ...sessionForm, session_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="e.g., Yoga Class"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Duration (min)</label>
                      <input
                        type="number"
                        value={sessionForm.duration_minutes}
                        onChange={(e) => setSessionForm({ ...sessionForm, duration_minutes: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Time</label>
                      <input
                        type="time"
                        value={sessionForm.time}
                        onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Days</label>
                      <select
                        multiple
                        value={sessionForm.days}
                        onChange={(e) => setSessionForm({
                          ...sessionForm,
                          days: Array.from(e.target.selectedOptions, option => option.value)
                        })}
                        className="w-full px-3 py-2 border rounded"
                      >
                        {daysOfWeek.map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input
                      type="text"
                      value={sessionForm.description}
                      onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      placeholder="Session details"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSession}
                    className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition text-sm"
                  >
                    Add Session
                  </button>
                </div>

                {/* Sessions List */}
                <div className="space-y-2">
                  {form.sessions.map(session => (
                    <div key={session.id} className="flex items-center justify-between bg-slate-50 p-3 rounded">
                      <div className="text-sm">
                        <p className="font-medium">{session.session_name}</p>
                        <p className="text-xs text-slate-600">
                          {session.time} • {session.duration_minutes}min • {session.days.join(', ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSession(session.id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editingPackage ? 'Update Package' : 'Create Package'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
