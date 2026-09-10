import { useState, useEffect, useCallback, useRef } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { FiPlus, FiEdit, FiTrash2, FiX } from 'react-icons/fi';

const DiagnosisTemplates = () => {
  const api = useApiClient();
  const { addToast } = useToast();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    diagnoses: ['']
  });
  const [diagnosisSuggestions, setDiagnosisSuggestions] = useState([]);
  const [activeDiagnosisIndex, setActiveDiagnosisIndex] = useState(null);
  const diagnosisDebounceRef = useRef(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/diagnosis-templates');
      setTemplates(res.data.templates || []);
    } catch (error) {
      console.error('Error fetching diagnosis templates:', error);
      addToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        category: template.category || '',
        description: template.description || '',
        diagnoses: Array.isArray(template.diagnoses) ? template.diagnoses : []
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        category: '',
        description: '',
        diagnoses: ['']
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      category: '',
      description: '',
      diagnoses: ['']
    });
  };

  const handleAddDiagnosis = () => {
    setFormData(prev => ({
      ...prev,
      diagnoses: [...prev.diagnoses, '']
    }));
  };

  const handleRemoveDiagnosis = (index) => {
    setFormData(prev => ({
      ...prev,
      diagnoses: prev.diagnoses.filter((_, i) => i !== index)
    }));
  };

  const handleDiagnosisChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      diagnoses: prev.diagnoses.map((d, i) => i === index ? value : d)
    }));
    setActiveDiagnosisIndex(index);
    if (diagnosisDebounceRef.current) clearTimeout(diagnosisDebounceRef.current);
    if (!value.trim() || value.length < 2) {
      setDiagnosisSuggestions([]);
      return;
    }
    diagnosisDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/diagnoses/search?q=${encodeURIComponent(value)}&limit=20&version=icd10`);
        const items = res.data?.data?.diagnoses || res.data?.diagnoses || [];
        setDiagnosisSuggestions(items);
      } catch {
        setDiagnosisSuggestions([]);
      }
    }, 300);
  };

  const handleSelectDiagnosisSuggestion = (suggestion) => {
    const value = suggestion.diagnosis_name || suggestion.disease_name || suggestion.name || String(suggestion);
    if (activeDiagnosisIndex !== null) {
      setFormData(prev => ({
        ...prev,
        diagnoses: prev.diagnoses.map((d, i) => i === activeDiagnosisIndex ? value : d)
      }));
    }
    setDiagnosisSuggestions([]);
    setActiveDiagnosisIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      addToast('Template name is required', 'error');
      return;
    }

    const filteredDiagnoses = formData.diagnoses.filter(d => d.trim() !== '');
    if (filteredDiagnoses.length === 0) {
      addToast('At least one diagnosis is required', 'error');
      return;
    }

    try {
      const payload = {
        ...formData,
        diagnoses: filteredDiagnoses
      };

      if (editingTemplate) {
        await api.put(`/api/diagnosis-templates/${editingTemplate.id}`, payload);
        addToast('Template updated successfully', 'success');
      } else {
        await api.post('/api/diagnosis-templates', payload);
        addToast('Template created successfully', 'success');
      }

      fetchTemplates();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving template:', error);
      addToast(error.response?.data?.error || 'Failed to save template', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/api/diagnosis-templates/${id}`);
      addToast('Template deleted successfully', 'success');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      addToast('Failed to delete template', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading templates...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Diagnosis Templates</h2>
          <p className="text-gray-600 mt-1">Manage your diagnosis templates for quick prescription</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <FiPlus className="w-5 h-5" />
          Add Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">No templates created yet</p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <div key={template.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  {template.category && (
                    <span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                      {template.category}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(template)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <FiEdit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {template.description && (
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              )}

              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-700">Diagnoses ({template.diagnoses?.length || 0}):</p>
                <div className="flex flex-wrap gap-1">
                  {(template.diagnoses || []).slice(0, 3).map((diagnosis, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                      {diagnosis}
                    </span>
                  ))}
                  {template.diagnoses?.length > 3 && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">
                      +{template.diagnoses.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Hypertension Diagnosis"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Cardiovascular, Respiratory"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows="2"
                    placeholder="Brief description of this template"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Diagnoses *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddDiagnosis}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      + Add Diagnosis
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.diagnoses.map((diagnosis, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={diagnosis}
                            onChange={(e) => handleDiagnosisChange(index, e.target.value)}
                            onBlur={() => setTimeout(() => { setDiagnosisSuggestions([]); setActiveDiagnosisIndex(null); }, 150)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Type to search diagnosis"
                          />
                          {activeDiagnosisIndex === index && diagnosisSuggestions.length > 0 && (
                            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {diagnosisSuggestions.map((s, i) => (
                                <li
                                  key={i}
                                  onMouseDown={(e) => { e.preventDefault(); handleSelectDiagnosisSuggestion(s); }}
                                  className="px-3 py-2 text-sm cursor-pointer hover:bg-purple-50"
                                >
                                  <span className="font-medium">{s.diagnosis_name || s.disease_name || s.name || ''}</span>
                                  {(s.code || s.icd_code) && <span className="ml-2 text-xs text-gray-400">{s.code || s.icd_code}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {formData.diagnoses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDiagnosis(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <FiX className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
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
  );
};

export default DiagnosisTemplates;
