import { useState, useEffect, useCallback, useRef } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Drops', 'Inhaler', 'Cream', 'Ointment', 'Gel', 'Sachet', 'Powder', 'Spray', 'Lotion', 'Patch'];
const FREQUENCIES = ['1-0-0', '0-0-1', '1-0-1', '1-1-0', '1-1-1', 'once daily', 'twice daily', 'thrice daily', 'SOS', 'once weekly', 'once monthly'];
const TIMINGS = ['After Food', 'Before Food', 'With Food', 'Empty Stomach', 'Bedtime', 'Any Time'];
const DURATIONS = ['1 day', '3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '3 months', 'Continue', 'As directed'];

const EMPTY_FORM = {
  name: '',
  generic_name: '',
  composition: '',
  strength: '',
  dosage_form: 'Tablet',
  manufacturer: '',
  default_frequency: '',
  default_timing: '',
  default_duration: '',
  default_instructions: '',
  notes: '',
};

const MedicineMaster = () => {
  const api = useApiClient();
  const { addToast } = useToast();

  const [medicines, setMedicines] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef(null);

  const fetchMedicines = useCallback(async (pageNum = 1, searchVal = '') => {
    setLoading(true);
    try {
      const res = await api.get('/api/medicines/master', {
        params: { page: pageNum, limit: 20, search: searchVal }
      });
      const data = res.data?.data || res.data || {};
      setMedicines(data.medicines || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      addToast('Failed to load medicines', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  useEffect(() => {
    fetchMedicines(1, '');
  }, [fetchMedicines]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchMedicines(1, val);
    }, 350);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchMedicines(newPage, search);
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Medicine name required';
    if (!formData.generic_name.trim()) errs.generic_name = 'Generic name required';
    return errs;
  };

  const openAdd = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (med) => {
    setEditingId(med.id);
    setFormData({
      name: med.name || '',
      generic_name: med.generic_name || '',
      composition: med.composition || '',
      strength: med.strength || '',
      dosage_form: med.dosage_form || 'Tablet',
      manufacturer: med.manufacturer || '',
      default_frequency: med.default_frequency || '',
      default_timing: med.default_timing || '',
      default_duration: med.default_duration || '',
      default_instructions: med.default_instructions || '',
      notes: med.notes || '',
    });
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/medicines/${editingId}`, formData);
        addToast('Medicine updated', 'success');
      } else {
        await api.post('/api/medicines', formData);
        addToast('Medicine added', 'success');
      }
      closeModal();
      fetchMedicines(page, search);
    } catch (err) {
      // 409 = duplicate, 400 = validation error
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save medicine';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/api/medicines/${id}`);
      addToast('Medicine deleted', 'success');
      fetchMedicines(page, search);
    } catch {
      addToast('Failed to delete', 'error');
    }
  };

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Medicine Master</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} medicine{total !== 1 ? 's' : ''} · Added medicines appear in Prescription Pad search
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow"
        >
          <FiPlus className="w-4 h-4" />
          Add Medicine
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name, generic name, composition..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : medicines.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <div className="text-4xl mb-2">💊</div>
          <p className="text-gray-500 mb-3">
            {search ? 'No medicines match your search' : 'No medicines added yet'}
          </p>
          {!search && (
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Add First Medicine
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Medicine Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Generic Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Strength</th>
                  <th className="px-4 py-3 text-left font-semibold">Form</th>
                  <th className="px-4 py-3 text-left font-semibold">Frequency</th>
                  <th className="px-4 py-3 text-left font-semibold">Duration</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {medicines.map(med => (
                  <tr key={med.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {med.name}
                      {med.manufacturer && (
                        <div className="text-xs text-gray-400 font-normal">{med.manufacturer}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{med.generic_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{med.strength || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                        {med.dosage_form || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{med.default_frequency || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{med.default_duration || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(med)}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(med.id, med.name)}
                          className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>Page {page} of {totalPages} ({total} total)</span>
              <div className="flex gap-1">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FiChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? 'Edit Medicine' : 'Add New Medicine'}
              </h3>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Required fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Medicine Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder="e.g., Crocin 500mg"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Generic Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.generic_name}
                    onChange={e => handleChange('generic_name', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none ${errors.generic_name ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder="e.g., Paracetamol"
                  />
                  {errors.generic_name && <p className="text-xs text-red-500 mt-1">{errors.generic_name}</p>}
                </div>
              </div>

              {/* Composition */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Composition</label>
                <input
                  type="text"
                  value={formData.composition}
                  onChange={e => handleChange('composition', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  placeholder="e.g., Paracetamol 500mg"
                />
              </div>

              {/* Strength + Form + Manufacturer */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Strength</label>
                  <input
                    type="text"
                    value={formData.strength}
                    onChange={e => handleChange('strength', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                    placeholder="e.g., 500mg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Dosage Form</label>
                  <select
                    value={formData.dosage_form}
                    onChange={e => handleChange('dosage_form', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                  >
                    {DOSAGE_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={e => handleChange('manufacturer', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                    placeholder="e.g., GSK"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Default Prescription Settings</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Default Frequency</label>
                    <input
                      type="text"
                      list="frequency-options"
                      value={formData.default_frequency}
                      onChange={e => handleChange('default_frequency', e.target.value)}
                      placeholder="e.g., 1-0-1"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                    />
                    <datalist id="frequency-options">
                      {FREQUENCIES.map(f => <option key={f} value={f} />)}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Default Timing</label>
                    <input
                      type="text"
                      list="timing-options"
                      value={formData.default_timing}
                      onChange={e => handleChange('default_timing', e.target.value)}
                      placeholder="e.g., After Food"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                    />
                    <datalist id="timing-options">
                      {TIMINGS.map(t => <option key={t} value={t} />)}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Default Duration</label>
                    <input
                      type="text"
                      list="duration-options"
                      value={formData.default_duration}
                      onChange={e => handleChange('default_duration', e.target.value)}
                      placeholder="e.g., 7 days"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white"
                    />
                    <datalist id="duration-options">
                      {DURATIONS.map(d => <option key={d} value={d} />)}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Instructions + Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Default Instructions</label>
                  <textarea
                    value={formData.default_instructions}
                    onChange={e => handleChange('default_instructions', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none resize-none"
                    placeholder="e.g., Take with water"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => handleChange('notes', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none resize-none"
                    placeholder="Internal notes"
                  />
                </div>
              </div>

              {/* Form actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editingId ? 'Update Medicine' : 'Add Medicine'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 border border-gray-300 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
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
};

export default MedicineMaster;
