import { useState, useEffect, useCallback, useRef } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import HeaderBar from '../components/HeaderBar';
import { FiPlus, FiEdit, FiTrash2, FiX, FiCheck } from 'react-icons/fi';

const CATEGORIES = [
  'Respiratory',
  'Gastrointestinal',
  'Cardiovascular',
  'Neurological',
  'Urological',
  'Endocrine',
  'Immunological',
  'Musculoskeletal',
  'Dermatological',
  'Other'
];

export default function SymptomsTemplates() {
  const api = useApiClient();
  const { addToast } = useToast();
  const { user: _user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Respiratory',
    symptoms: []
  });
  const [symptomInput, setSymptomInput] = useState('');
  const [symptomSuggestions, setSymptomSuggestions] = useState([]);
  const symptomDebounceRef = useRef(null);
  const symptomInputRef = useRef(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/symptoms-templates');
      setTemplates(res.data?.data?.templates || res.data?.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      addToast('Failed to load symptoms templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (symptomDebounceRef.current) clearTimeout(symptomDebounceRef.current);
    if (!symptomInput.trim() || symptomInput.length < 2) {
      setSymptomSuggestions([]);
      return;
    }
    symptomDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/symptoms/search?q=${encodeURIComponent(symptomInput)}&limit=25`);
        setSymptomSuggestions(res.data.symptoms || []);
      } catch {
        setSymptomSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(symptomDebounceRef.current);
  }, [symptomInput, api]);

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        category: template.category || 'Respiratory',
        symptoms: Array.isArray(template.symptoms) ? template.symptoms : JSON.parse(template.symptoms || '[]')
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        category: 'Respiratory',
        symptoms: []
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormData({ name: '', description: '', category: 'Respiratory', symptoms: [] });
    setSymptomInput('');
    setSymptomSuggestions([]);
  };

  const handleSelectSymptomSuggestion = (suggestion) => {
    const value = suggestion.symptom || suggestion;
    if (!formData.symptoms.includes(value)) {
      setFormData(prev => ({ ...prev, symptoms: [...prev.symptoms, value] }));
    }
    setSymptomInput('');
    setSymptomSuggestions([]);
    symptomInputRef.current?.focus();
  };

  const handleAddSymptom = () => {
    if (!symptomInput.trim()) return;
    if (formData.symptoms.includes(symptomInput.trim())) {
      addToast('Symptom already added', 'error');
      return;
    }
    setFormData({
      ...formData,
      symptoms: [...formData.symptoms, symptomInput.trim()]
    });
    setSymptomInput('');
  };

  const handleRemoveSymptom = (symptomToRemove) => {
    setFormData({
      ...formData,
      symptoms: formData.symptoms.filter(s => s !== symptomToRemove)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.symptoms.length === 0) {
      addToast('Please add at least one symptom', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        symptoms: JSON.stringify(formData.symptoms)
      };

      if (editingTemplate) {
        await api.put(`/api/symptoms-templates/${editingTemplate.id}`, payload);
        addToast('Template updated successfully', 'success');
      } else {
        await api.post('/api/symptoms-templates', payload);
        addToast('Template created successfully', 'success');
      }

      handleCloseModal();
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      addToast(error.response?.data?.error || 'Failed to save template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/api/symptoms-templates/${id}`);
      addToast('Template deleted successfully', 'success');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      addToast('Failed to delete template', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <HeaderBar title="Symptoms Templates" />
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
        >
          <FiPlus /> Add Template
        </button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const symptoms = Array.isArray(template.symptoms)
            ? template.symptoms
            : JSON.parse(template.symptoms || '[]');

          return (
            <div key={template.id} className="bg-white rounded-lg shadow border hover:shadow-md transition">
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    {template.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                        {template.category}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(template)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit"
                    >
                      <FiEdit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>

                {template.description && (
                  <p className="text-sm text-gray-600">{template.description}</p>
                )}

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-500 uppercase">Symptoms ({symptoms.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {symptoms.slice(0, 5).map((symptom, idx) => (
                      <span key={idx} className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                        <FiCheck size={12} className="mr-1" /> {symptom}
                      </span>
                    ))}
                    {symptoms.length > 5 && (
                      <span className="inline-flex items-center px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                        +{symptoms.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {templates.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No symptoms templates found. Create your first template!</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editingTemplate ? 'Edit Template' : 'Add Symptoms Template'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Common Cold, Seasonal Flu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this symptom template"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Symptoms *
                </label>
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <input
                      ref={symptomInputRef}
                      type="text"
                      value={symptomInput}
                      onChange={(e) => setSymptomInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSymptom())}
                      placeholder="Type symptom to search or enter manually"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {symptomSuggestions.length > 0 && (
                      <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {symptomSuggestions.map((s, i) => (
                          <li
                            key={i}
                            onMouseDown={(e) => { e.preventDefault(); handleSelectSymptomSuggestion(s); }}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50"
                          >
                            {s.symptom || s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSymptom}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                  >
                    Add
                  </button>
                </div>

                {formData.symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-gray-50">
                    {formData.symptoms.map((symptom, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-white border rounded-full text-sm">
                        {symptom}
                        <button
                          type="button"
                          onClick={() => handleRemoveSymptom(symptom)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <FiX size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {formData.symptoms.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">No symptoms added yet</p>
                )}
              </div>

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
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:bg-gray-400"
                >
                  {loading ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
