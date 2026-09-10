import { useEffect, useState, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import HeaderBar from '../components/HeaderBar';

export default function VIPPatients() {
  const api = useApiClient();
  const { addToast } = useToast();

  const [vipPatients, setVipPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showVIPForm, setShowVIPForm] = useState(false);
  const [showAccessControl, setShowAccessControl] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [filterTier, setFilterTier] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [vipForm, setVipForm] = useState({
    patient_id: '',
    vip_tier: 'gold',
    preferred_doctor_id: '',
    room_preference: '',
    special_notes: '',
    allergies_special: '',
    communication_preference: 'WhatsApp',
    dedicated_contact_person: '',
    dedicated_contact_phone: '',
    dedicated_contact_email: '',
    priority_level: 1,
    anonymous_queue_display: false,
    restricted_access: false
  });

  const [accessForm, setAccessForm] = useState({
    authorized_user_id: '',
    access_level: 'view_only',
    record_types: [],
    expires_at: ''
  });

  const [activityLogs, setActivityLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Fetch VIP patients
  const fetchVIPPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit,
        offset: (page - 1) * limit
      };
      if (filterTier) params.vip_tier = filterTier;

      const res = await api.get('/api/vip-patients', { params });
      const data = res.data?.data || res.data;
      setVipPatients(data.vip_patients || []);
      setPagination(data.pagination || {});
    } catch (err) {
      addToast('Failed to fetch VIP patients', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast, limit, page, filterTier]);

  useEffect(() => {
    fetchVIPPatients();
  }, [fetchVIPPatients]);

  // Create VIP patient
  const handleCreateVIP = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/vip-patients', vipForm);
      addToast('Patient marked as VIP successfully', 'success');
      setShowVIPForm(false);
      setVipForm({
        patient_id: '',
        vip_tier: 'gold',
        preferred_doctor_id: '',
        room_preference: '',
        special_notes: '',
        allergies_special: '',
        communication_preference: 'WhatsApp',
        dedicated_contact_person: '',
        dedicated_contact_phone: '',
        dedicated_contact_email: '',
        priority_level: 1,
        anonymous_queue_display: false,
        restricted_access: false
      });
      fetchVIPPatients();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to create VIP patient', 'error');
    }
  };

  // Update VIP patient
  const handleUpdateVIP = async () => {
    try {
      await api.patch(`/api/vip-patients/${selectedPatient.patient_id}`, {
        vip_tier: selectedPatient.vip_tier,
        room_preference: selectedPatient.room_preference,
        special_notes: selectedPatient.special_notes,
        allergies_special: selectedPatient.allergies_special,
        communication_preference: selectedPatient.communication_preference,
        dedicated_contact_person: selectedPatient.dedicated_contact_person,
        dedicated_contact_phone: selectedPatient.dedicated_contact_phone,
        dedicated_contact_email: selectedPatient.dedicated_contact_email,
        priority_level: selectedPatient.priority_level,
        anonymous_queue_display: selectedPatient.anonymous_queue_display,
        restricted_access: selectedPatient.restricted_access
      });
      addToast('VIP patient updated successfully', 'success');
      fetchVIPPatients();
    } catch (err) {
      addToast('Failed to update VIP patient', 'error');
    }
  };

  // Remove VIP status
  const handleRemoveVIP = async (patientId) => {
    if (!window.confirm('Remove VIP status from this patient?')) return;

    try {
      await api.delete(`/api/vip-patients/${patientId}`);
      addToast('VIP status removed successfully', 'success');
      fetchVIPPatients();
    } catch (err) {
      addToast('Failed to remove VIP status', 'error');
    }
  };

  // Grant access
  const handleGrantAccess = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/api/vip-patients/${selectedPatient.patient_id}/access-control`, accessForm);
      addToast('Access granted successfully', 'success');
      setShowAccessControl(false);
      setAccessForm({
        authorized_user_id: '',
        access_level: 'view_only',
        record_types: [],
        expires_at: ''
      });
    } catch (err) {
      addToast('Failed to grant access', 'error');
    }
  };

  // Fetch activity logs
  const handleViewActivityLogs = async (patientId) => {
    try {
      const res = await api.get(`/api/vip-patients/${patientId}/activity-logs`);
      const data = res.data?.data || res.data;
      setActivityLogs(data.activity_logs || []);
      setShowActivityLog(true);
    } catch (err) {
      addToast('Failed to fetch activity logs', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <HeaderBar title="VIP Patient Management" />

      {/* Filters and Actions */}
      <div className="bg-white rounded shadow-sm border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <select
            className="px-3 py-2 border rounded"
            value={filterTier}
            onChange={(e) => {
              setFilterTier(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Tiers</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
            <option value="diamond">Diamond</option>
          </select>

          <button
            onClick={() => setShowVIPForm(true)}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition"
          >
            Mark Patient as VIP
          </button>
        </div>
      </div>

      {/* VIP Patients Table */}
      <div className="bg-white rounded shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Patient Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">UHID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Tier</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Priority</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Contact</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-4 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : vipPatients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-4 text-center text-slate-500">
                    No VIP patients found
                  </td>
                </tr>
              ) : (
                vipPatients.map((vip) => (
                  <tr key={vip.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium">{vip.name}</td>
                    <td className="px-4 py-3 text-sm">{vip.uhid}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        vip.vip_tier === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                        vip.vip_tier === 'platinum' ? 'bg-gray-100 text-gray-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {vip.vip_tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{vip.priority_level}</td>
                    <td className="px-4 py-3 text-sm">{vip.phone || '-'}</td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button
                        onClick={() => {
                          setSelectedPatient(vip);
                          setShowVIPForm(true);
                        }}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPatient(vip);
                          setShowAccessControl(true);
                        }}
                        className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        Access
                      </button>
                      <button
                        onClick={() => handleViewActivityLogs(vip.patient_id)}
                        className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                      >
                        Logs
                      </button>
                      <button
                        onClick={() => handleRemoveVIP(vip.patient_id)}
                        className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Page {page} of {pagination.pages || 1} • Total {pagination.total || 0}
          </span>
          <div className="space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(pagination.pages || 1, page + 1))}
              disabled={page >= (pagination.pages || 1)}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Mark as VIP Modal */}
      {showVIPForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {selectedPatient ? 'Edit VIP Patient' : 'Mark Patient as VIP'}
              </h2>
              <button
                onClick={() => {
                  setShowVIPForm(false);
                  setSelectedPatient(null);
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={selectedPatient ? (e) => {
              e.preventDefault();
              handleUpdateVIP();
            } : handleCreateVIP} className="p-6 space-y-4">
              {!selectedPatient && (
                <div>
                  <label className="block text-sm font-medium mb-1">Patient ID *</label>
                  <input
                    type="text"
                    placeholder="Enter patient ID"
                    value={vipForm.patient_id}
                    onChange={(e) => setVipForm({ ...vipForm, patient_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">VIP Tier</label>
                  <select
                    value={selectedPatient ? selectedPatient.vip_tier : vipForm.vip_tier}
                    onChange={(e) => selectedPatient
                      ? setSelectedPatient({ ...selectedPatient, vip_tier: e.target.value })
                      : setVipForm({ ...vipForm, vip_tier: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="gold">Gold</option>
                    <option value="platinum">Platinum</option>
                    <option value="diamond">Diamond</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Priority Level</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={selectedPatient ? selectedPatient.priority_level : vipForm.priority_level}
                    onChange={(e) => selectedPatient
                      ? setSelectedPatient({ ...selectedPatient, priority_level: parseInt(e.target.value) })
                      : setVipForm({ ...vipForm, priority_level: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Room Preference</label>
                <input
                  type="text"
                  placeholder="e.g., Private Room, AC Room"
                  value={selectedPatient ? selectedPatient.room_preference : vipForm.room_preference}
                  onChange={(e) => selectedPatient
                    ? setSelectedPatient({ ...selectedPatient, room_preference: e.target.value })
                    : setVipForm({ ...vipForm, room_preference: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Special Notes</label>
                <textarea
                  placeholder="Any special notes or preferences"
                  value={selectedPatient ? selectedPatient.special_notes : vipForm.special_notes}
                  onChange={(e) => selectedPatient
                    ? setSelectedPatient({ ...selectedPatient, special_notes: e.target.value })
                    : setVipForm({ ...vipForm, special_notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Special Allergies</label>
                <textarea
                  placeholder="VIP-specific allergies or medical concerns"
                  value={selectedPatient ? selectedPatient.allergies_special : vipForm.allergies_special}
                  onChange={(e) => selectedPatient
                    ? setSelectedPatient({ ...selectedPatient, allergies_special: e.target.value })
                    : setVipForm({ ...vipForm, allergies_special: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  rows="2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Communication Preference</label>
                  <select
                    value={selectedPatient ? selectedPatient.communication_preference : vipForm.communication_preference}
                    onChange={(e) => selectedPatient
                      ? setSelectedPatient({ ...selectedPatient, communication_preference: e.target.value })
                      : setVipForm({ ...vipForm, communication_preference: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="Phone">Phone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Dedicated Contact Person</label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={selectedPatient ? selectedPatient.dedicated_contact_person : vipForm.dedicated_contact_person}
                    onChange={(e) => selectedPatient
                      ? setSelectedPatient({ ...selectedPatient, dedicated_contact_person: e.target.value })
                      : setVipForm({ ...vipForm, dedicated_contact_person: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={selectedPatient ? selectedPatient.dedicated_contact_phone : vipForm.dedicated_contact_phone}
                    onChange={(e) => selectedPatient
                      ? setSelectedPatient({ ...selectedPatient, dedicated_contact_phone: e.target.value })
                      : setVipForm({ ...vipForm, dedicated_contact_phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Contact Email</label>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={selectedPatient ? selectedPatient.dedicated_contact_email : vipForm.dedicated_contact_email}
                    onChange={(e) => selectedPatient
                      ? setSelectedPatient({ ...selectedPatient, dedicated_contact_email: e.target.value })
                      : setVipForm({ ...vipForm, dedicated_contact_email: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPatient ? selectedPatient.anonymous_queue_display : vipForm.anonymous_queue_display}
                    onChange={(e) => selectedPatient
                      ? setSelectedPatient({ ...selectedPatient, anonymous_queue_display: e.target.checked })
                      : setVipForm({ ...vipForm, anonymous_queue_display: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Anonymous Queue Display (Hide full name)</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPatient ? selectedPatient.restricted_access : vipForm.restricted_access}
                    onChange={(e) => selectedPatient
                      ? setSelectedPatient({ ...selectedPatient, restricted_access: e.target.checked })
                      : setVipForm({ ...vipForm, restricted_access: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Restrict Record Access</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition"
                >
                  {selectedPatient ? 'Update' : 'Mark as VIP'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowVIPForm(false);
                    setSelectedPatient(null);
                  }}
                  className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access Control Modal */}
      {showAccessControl && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Grant Record Access</h2>
              <button
                onClick={() => setShowAccessControl(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGrantAccess} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Staff Member ID *</label>
                <input
                  type="text"
                  placeholder="Enter user ID"
                  value={accessForm.authorized_user_id}
                  onChange={(e) => setAccessForm({ ...accessForm, authorized_user_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Access Level</label>
                <select
                  value={accessForm.access_level}
                  onChange={(e) => setAccessForm({ ...accessForm, access_level: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="view_only">View Only</option>
                  <option value="edit">Edit</option>
                  <option value="full_access">Full Access</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  value={accessForm.expires_at}
                  onChange={(e) => setAccessForm({ ...accessForm, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition"
                >
                  Grant Access
                </button>
                <button
                  type="button"
                  onClick={() => setShowAccessControl(false)}
                  className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity Logs Modal */}
      {showActivityLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Activity Logs</h2>
              <button
                onClick={() => setShowActivityLog(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {activityLogs.length === 0 ? (
                <p className="text-center text-slate-500">No activity logs found</p>
              ) : (
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="border rounded p-3 bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{log.action_type}</p>
                          <p className="text-xs text-slate-600">{log.action_description}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded ${
                          log.status === 'success' ? 'bg-green-100 text-green-800' :
                          log.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
