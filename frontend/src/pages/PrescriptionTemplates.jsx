import { useEffect, useState, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import HeaderBar from '../components/HeaderBar';

export default function PrescriptionTemplates() {
  const api = useApiClient();
  const { addToast } = useToast();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({
    template_name: '',
    category: 'General',
    symptoms: '',
    diagnosis: '',
    medications: '',
    duration_days: 7,
    advice: '',
    follow_up_days: 7,
    description: '',
    precautions: '',
    diet_restrictions: '',
    activities: '',
    investigations: ''
  });

  const categories = ['General', 'Respiratory', 'Gastrointestinal', 'Cardiovascular', 'Neurological', 'Dermatological', 'Orthopedic', 'Emergency', 'Pediatric', 'Geriatric', 'OB-GYN'];

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/prescription-templates');
      setTemplates(res.data.templates || []);
    } catch (err) {
      addToast('Failed to fetch templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Create/Update template
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      if (editingTemplate) {
        await api.put(`/api/prescription-templates/${editingTemplate.id}`, form);
        addToast('Template updated successfully', 'success');
      } else {
        await api.post('/api/prescription-templates', form);
        addToast('Template created successfully', 'success');
      }

      setForm({
        template_name: '',
        category: 'General',
        symptoms: '',
        diagnosis: '',
        medications: '',
        duration_days: 7,
        advice: '',
        follow_up_days: 7,
        description: '',
        precautions: '',
        diet_restrictions: '',
        activities: '',
        investigations: ''
      });
      setEditingTemplate(null);
      setShowForm(false);
      fetchTemplates();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save template', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;

    try {
      await api.delete(`/api/prescription-templates/${id}`);
      addToast('Template deleted successfully', 'success');
      fetchTemplates();
    } catch (err) {
      addToast('Failed to delete template', 'error');
    }
  };

  // Edit template
  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setForm({
      template_name: template.template_name,
      category: template.category,
      symptoms: template.symptoms || '',
      diagnosis: template.diagnosis || '',
      medications: template.medications || '',
      duration_days: template.duration_days || 7,
      advice: template.advice || '',
      follow_up_days: template.follow_up_days || 7,
      description: template.description || '',
      precautions: template.precautions || '',
      diet_restrictions: template.diet_restrictions || '',
      activities: template.activities || '',
      investigations: template.investigations || ''
    });
    setShowForm(true);
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesCategory = !filterCategory || t.category === filterCategory;
    const matchesSearch = !searchTerm || t.template_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <HeaderBar title="Prescription Templates" />

      {/* Filters and Actions */}
      <div className="bg-white rounded shadow-sm border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            className="flex-1 px-3 py-2 border rounded"
          />

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setEditingTemplate(null);
              setForm({
                template_name: '',
                category: 'General',
                symptoms: '',
                diagnosis: '',
                medications: '',
                duration_days: 7,
                advice: '',
                follow_up_days: 7,
                description: ''
              });
              setShowForm(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition"
          >
            + New Template
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-8 text-slate-500">Loading templates...</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-8 text-slate-500">No templates found</div>
        ) : (
          filteredTemplates.map(template => (
            <div key={template.id} className="bg-white rounded shadow-sm border p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-base">{template.template_name}</h3>
                  <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded mt-1">
                    {template.category}
                  </span>
                </div>
              </div>

              {template.diagnosis && (
                <p className="text-sm text-slate-600 mb-2">
                  <strong>Diagnosis:</strong> {template.diagnosis}
                </p>
              )}

              {template.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{template.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-3">
                <div>Duration: {template.duration_days} days</div>
                <div>Follow-up: {template.follow_up_days} days</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEditTemplate(template)}
                  className="flex-1 px-3 py-2 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="flex-1 px-3 py-2 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Template Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-6 space-y-5">
              {/* Template Info Section */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-base mb-3 text-slate-700">Template Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Template Name *</label>
                    <input
                      type="text"
                      value={form.template_name}
                      onChange={(e) => setForm({ ...form, template_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-3 py-2 border rounded"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded text-sm"
                    rows="2"
                    placeholder="Template purpose and notes"
                  />
                </div>
              </div>

              {/* Clinical Section */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-base mb-3 text-slate-700">Clinical Details</h3>

                <div>
                  <label className="block text-sm font-medium mb-1">Diagnosis *</label>
                  <input
                    type="text"
                    value={form.diagnosis}
                    onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                    className="w-full px-3 py-2 border rounded mb-3"
                    placeholder="e.g., Upper Respiratory Tract Infection"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Symptoms (Comma-separated)</label>
                  <textarea
                    value={form.symptoms}
                    onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    rows="2"
                    placeholder="e.g., Fever, Cough, Sore Throat"
                  />
                </div>
              </div>

              {/* Medications Section */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-base mb-3 text-slate-700">Medications</h3>
                <textarea
                  value={form.medications}
                  onChange={(e) => setForm({ ...form, medications: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows="4"
                  placeholder={'JSON format: [{"name":"Paracetamol","dosage":"500mg","frequency":"1-1-1","route":"Oral","timing":"After Meal","duration":"5 days"}]'}
                />
                <p className="text-xs text-slate-500 mt-2">💡 Tip: Use JSON array format for better structure</p>
              </div>

              {/* Investigations & Tests Section */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-base mb-3 text-slate-700">Investigations & Tests</h3>
                <textarea
                  value={form.investigations}
                  onChange={(e) => setForm({ ...form, investigations: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows="2"
                  placeholder="e.g., CBC, X-Ray Chest, Blood Culture"
                />
              </div>

              {/* Precautions & Restrictions Section */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-base mb-3 text-slate-700">Precautions & Restrictions</h3>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Precautions</label>
                  <textarea
                    value={form.precautions}
                    onChange={(e) => setForm({ ...form, precautions: e.target.value })}
                    className="w-full px-3 py-2 border rounded mb-3"
                    rows="2"
                    placeholder="e.g., Avoid alcohol, No smoking, Keep away from dust"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Diet Restrictions</label>
                  <textarea
                    value={form.diet_restrictions}
                    onChange={(e) => setForm({ ...form, diet_restrictions: e.target.value })}
                    className="w-full px-3 py-2 border rounded mb-3"
                    rows="2"
                    placeholder="e.g., Avoid spicy food, No dairy, Drink plenty of water"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Activities & Lifestyle</label>
                  <textarea
                    value={form.activities}
                    onChange={(e) => setForm({ ...form, activities: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    rows="2"
                    placeholder="e.g., Rest for 3 days, Avoid strenuous activities, Light exercise"
                  />
                </div>
              </div>

              {/* Duration & Follow-up Section */}
              <div className="border-b pb-4">
                <h3 className="font-semibold text-base mb-3 text-slate-700">Duration & Follow-up</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Treatment Duration (days)</label>
                    <input
                      type="number"
                      value={form.duration_days}
                      onChange={(e) => setForm({ ...form, duration_days: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Follow-up After (days)</label>
                    <input
                      type="number"
                      value={form.follow_up_days}
                      onChange={(e) => setForm({ ...form, follow_up_days: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                      min="1"
                    />
                  </div>
                </div>
              </div>

              {/* Medical Advice Section */}
              <div>
                <h3 className="font-semibold text-base mb-3 text-slate-700">Medical Advice</h3>
                <textarea
                  value={form.advice}
                  onChange={(e) => setForm({ ...form, advice: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows="3"
                  placeholder="General medical advice and counseling for patient"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
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
