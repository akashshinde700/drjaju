import { useEffect, useState, useCallback, useRef } from 'react';
import HeaderBar from '../components/HeaderBar';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import RequireRole from '../components/RequireRole';

export default function LabTemplates() {
  const api = useApiClient();
  const { addToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState({
    test_name: '',
    test_code: '',
    description: '',
    sample_type: '',
    category: '',
    unit: '',
    reference_range: '',
    special_instructions: '',
    is_active: true
  });
  const searchTimeoutRef = useRef(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      params.is_active = true;

      const res = await api.get('/api/lab-templates', { params });
      setTemplates(res.data.templates || []);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to load lab templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast, search, categoryFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearch(searchInput);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInput]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await api.put(`/api/lab-templates/${editingTemplate.id}`, form);
        addToast('Lab template updated successfully', 'success');
      } else {
        await api.post('/api/lab-templates', form);
        addToast('Lab template created successfully', 'success');
      }
      setShowModal(false);
      setEditingTemplate(null);
      setForm({
        test_name: '',
        test_code: '',
        description: '',
        sample_type: '',
        category: '',
        unit: '',
        reference_range: '',
        special_instructions: '',
        is_active: true
      });
      fetchTemplates();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save lab template', 'error');
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setForm({
      test_name: template.test_name,
      test_code: template.test_code || '',
      description: template.description || '',
      sample_type: template.sample_type || '',
      category: template.category || '',
      unit: template.unit || '',
      reference_range: template.reference_range || '',
      special_instructions: template.special_instructions || '',
      is_active: template.is_active === 1
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lab template?')) {
      return;
    }

    try {
      await api.delete(`/api/lab-templates/${id}`);
      addToast('Lab template deleted successfully', 'success');
      fetchTemplates();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete lab template', 'error');
    }
  };

  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];

  return (
    <RequireRole allowed={['admin', 'doctor']}>
      <div className="min-h-screen bg-gray-50">
        <HeaderBar title="Lab Templates" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Lab Test Templates</h1>
              <p className="text-gray-600 mt-1">Manage standardized lab test templates</p>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setForm({
                  test_name: '',
                  test_code: '',
                  description: '',
                  sample_type: '',
                  category: '',
                  unit: '',
                  reference_range: '',
                  special_instructions: '',
                  is_active: true
                });
                setShowModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Template
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex gap-4 items-center mb-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {searchInput && (
                  <button
                    onClick={() => {
                      setSearchInput('');
                      setSearch('');
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {(searchInput || categoryFilter) && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setCategoryFilter('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              )}
            </div>
            {!loading && (
              <div className="text-sm text-gray-600">
                {templates.length} {templates.length === 1 ? 'template' : 'templates'} found
                {(search || categoryFilter) && (
                  <span className="ml-1">
                    {search && categoryFilter
                      ? ` matching "${search}" in category "${categoryFilter}"`
                      : search
                      ? ` matching "${search}"`
                      : ` in category "${categoryFilter}"`}
                  </span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div className="text-lg text-gray-600 mt-4">Loading templates...</div>
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-600">
                {search || categoryFilter ? 'No lab templates found matching your filters' : 'No lab templates found'}
              </p>
              {(search || categoryFilter) && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setCategoryFilter('');
                  }}
                  className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear filters to see all templates
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div key={template.id} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{template.test_name}</h3>
                      {template.test_code && (
                        <p className="text-sm text-gray-500">Code: {template.test_code}</p>
                      )}
                    </div>
                    {template.category && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {template.category}
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    {template.sample_type && (
                      <p><span className="font-medium">Sample:</span> {template.sample_type}</p>
                    )}
                    {template.unit && (
                      <p><span className="font-medium">Unit:</span> {template.unit}</p>
                    )}
                    {template.reference_range && (
                      <p><span className="font-medium">Reference:</span> {template.reference_range}</p>
                    )}
                  </div>
                  {template.special_instructions && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded text-xs text-gray-700">
                      <strong>Note:</strong> {template.special_instructions}
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleEdit(template)}
                      className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b">
                  <h2 className="text-2xl font-semibold">
                    {editingTemplate ? 'Edit Lab Template' : 'Create Lab Template'}
                  </h2>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Test Name *</label>
                      <input
                        type="text"
                        required
                        value={form.test_name}
                        onChange={(e) => setForm({ ...form, test_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Test Code</label>
                      <input
                        type="text"
                        value={form.test_code}
                        onChange={(e) => setForm({ ...form, test_code: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sample Type</label>
                      <input
                        type="text"
                        value={form.sample_type}
                        onChange={(e) => setForm({ ...form, sample_type: e.target.value })}
                        placeholder="e.g., Blood, Urine, Stool"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <input
                        type="text"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        placeholder="e.g., Hematology, Biochemistry"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                      <input
                        type="text"
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        placeholder="e.g., mg/dL, g/L"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reference Range</label>
                      <input
                        type="text"
                        value={form.reference_range}
                        onChange={(e) => setForm({ ...form, reference_range: e.target.value })}
                        placeholder="e.g., 70-100 mg/dL"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
                    <textarea
                      value={form.special_instructions}
                      onChange={(e) => setForm({ ...form, special_instructions: e.target.value })}
                      rows={3}
                      placeholder="Fasting required, special handling, etc."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm text-gray-700">Active</label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setEditingTemplate(null);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {editingTemplate ? 'Update' : 'Create'} Template
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

