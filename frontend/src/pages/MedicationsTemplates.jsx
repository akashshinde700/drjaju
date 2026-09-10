import { useState, useEffect, useCallback, useRef } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { FiPlus, FiEdit, FiTrash2, FiX } from 'react-icons/fi';

const MedicationsTemplates = () => {
  const api = useApiClient();
  const { addToast } = useToast();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [medSuggestions, setMedSuggestions] = useState([]);
  const [activeMedIndex, setActiveMedIndex] = useState(null);
  const medDebounceRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    medications: [{
      name: '',
      brand: '',
      composition: '',
      dosage: '',
      frequency: '1-0-1',
      timing: { type: 'AFTER_MEAL', time: null },
      duration: '7 days',
      qty: 7
    }]
  });

  // Quick add helpers
  const handleQuickAddInjection = async () => {
    try {
      const payload = {
        name: 'Injection Template',
        category: 'Injection',
        description: 'Common injection order with default instructions',
        medications: [
          {
            name: 'Tetanus Toxoid 0.5 ml IM',
            brand: 'TT 0.5 ml',
            composition: 'Tetanus Toxoid',
            dosage: '0.5 ml',
            frequency: 'once',
            timing: 'With Food',
            duration: 'Once',
            qty: 1,
            instructions: 'To be given intramuscularly in deltoid'
          }
        ]
      };
      await api.post('/api/medications-templates', payload);
      addToast('Injection template created', 'success');
      fetchTemplates();
    } catch (err) {
      console.error(err);
      addToast('Failed to create injection template', 'error');
    }
  };

  const handleQuickAddGeneral = async () => {
    try {
      const payload = {
        name: 'General Prescription Template',
        category: 'General',
        description: 'Common fever/acid-peptic management',
        medications: [
          {
            name: 'Paracetamol 500mg',
            brand: 'Paracetamol 500mg',
            composition: 'Paracetamol',
            dosage: '500 mg',
            frequency: '1-1-1',
            timing: 'After Meal',
            duration: '3 days',
            qty: 9,
            instructions: 'If fever >101°F add cold sponging'
          },
          {
            name: 'Omeprazole 20mg',
            brand: 'Omeprazole 20mg',
            composition: 'Omeprazole',
            dosage: '20 mg',
            frequency: '1-0-1',
            timing: 'Before Breakfast',
            duration: '5 days',
            qty: 10,
            instructions: 'Avoid spicy/oily food'
          }
        ]
      };
      await api.post('/api/medications-templates', payload);
      addToast('General template created', 'success');
      fetchTemplates();
    } catch (err) {
      console.error(err);
      addToast('Failed to create general template', 'error');
    }
  };

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/medications-templates');
      setTemplates(res.data.templates || []);
    } catch (error) {
      console.error('Error fetching medications templates:', error);
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
        medications: Array.isArray(template.medications) ? template.medications : []
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        category: '',
        description: '',
        medications: [{
          name: '',
          brand: '',
          composition: '',
          dosage: '',
          frequency: '1-0-1',
          timing: { type: 'AFTER_MEAL', time: null },
          duration: '7 days',
          qty: 7
        }]
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
  };

  const handleAddMedication = () => {
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, {
        name: '',
        brand: '',
        composition: '',
        dosage: '',
        frequency: '1-0-1',
        timing: 'After Meal',
        duration: '7 days',
        qty: 7
      }]
    }));
  };

  const handleRemoveMedication = (index) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  const handleMedicationChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.map((med, i) =>
        i === index ? { ...med, [field]: value } : med
      )
    }));
    if (field === 'name') {
      setActiveMedIndex(index);
      if (medDebounceRef.current) clearTimeout(medDebounceRef.current);
      if (!value.trim() || value.length < 2) {
        setMedSuggestions([]);
        return;
      }
      medDebounceRef.current = setTimeout(async () => {
        try {
          const res = await api.get(`/api/snomed-local/drugs?q=${encodeURIComponent(value)}&limit=15`);
          setMedSuggestions(res.data.items || []);
        } catch {
          setMedSuggestions([]);
        }
      }, 300);
    }
  };

  const handleSelectMedSuggestion = (suggestion) => {
    if (activeMedIndex === null) return;
    const comp = [suggestion.short_composition1, suggestion.short_composition2].filter(Boolean).join(' + ');
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.map((med, i) =>
        i === activeMedIndex ? {
          ...med,
          name: suggestion.brand_name || suggestion.name || '',
          composition: comp || med.composition,
          dosage_form: suggestion.dosage_form || med.dosage_form || ''
        } : med
      )
    }));
    setMedSuggestions([]);
    setActiveMedIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      addToast('Template name is required', 'error');
      return;
    }

    const filteredMedications = formData.medications.filter(m => m.name.trim() !== '');
    if (filteredMedications.length === 0) {
      addToast('At least one medication is required', 'error');
      return;
    }

    try {
      const payload = {
        ...formData,
        medications: filteredMedications
      };

      if (editingTemplate) {
        await api.put(`/api/medications-templates/${editingTemplate.id}`, payload);
        addToast('Template updated successfully', 'success');
      } else {
        await api.post('/api/medications-templates', payload);
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
      await api.delete(`/api/medications-templates/${id}`);
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
          <h2 className="text-2xl font-bold text-gray-900">Medications Templates</h2>
          <p className="text-gray-600 mt-1">Manage your medication templates for quick prescription</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickAddInjection}
            className="px-3 py-2 text-sm border rounded hover:bg-slate-50"
            title="Create Injection quick template"
          >
            Quick add: Injection
          </button>
          <button
            onClick={handleQuickAddGeneral}
            className="px-3 py-2 text-sm border rounded hover:bg-slate-50"
            title="Create General quick template"
          >
            Quick add: General
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
          >
            <FiPlus className="w-5 h-5" />
            Add Template
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">No templates created yet</p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
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
                    <span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-pink-100 text-pink-800 rounded">
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
                <p className="text-xs font-medium text-gray-700">Medications ({template.medications?.length || 0}):</p>
                <div className="space-y-1">
                  {(template.medications || []).slice(0, 2).map((med, idx) => (
                    <div key={idx} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      <div className="font-medium">{med.name || med.medication_name}</div>
                      <div className="text-gray-500">
                        {med.frequency} • {med.duration}
                      </div>
                    </div>
                  ))}
                  {template.medications?.length > 2 && (
                    <div className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded text-center">
                      +{template.medications.length - 2} more medications
                    </div>
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
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      placeholder="e.g., Common Cold Treatment"
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
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      placeholder="e.g., Respiratory"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    rows="2"
                    placeholder="Brief description of this template"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Medications *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddMedication}
                      className="text-sm text-pink-600 hover:text-pink-700 font-medium"
                    >
                      + Add Medication
                    </button>
                  </div>
                  <div className="space-y-4">
                    {formData.medications.map((med, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">
                            Medication #{index + 1}
                          </span>
                          {formData.medications.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMedication(index)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <FiX className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Medicine Name *
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={med.name}
                                onChange={(e) => handleMedicationChange(index, 'name', e.target.value)}
                                onBlur={() => setTimeout(() => { setMedSuggestions([]); setActiveMedIndex(null); }, 150)}
                                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-pink-500"
                                placeholder="Type to search medicine"
                              />
                              {activeMedIndex === index && medSuggestions.length > 0 && (
                                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                  {medSuggestions.map((s, i) => (
                                    <li
                                      key={i}
                                      onMouseDown={(e) => { e.preventDefault(); handleSelectMedSuggestion(s); }}
                                      className="px-3 py-2 text-sm cursor-pointer hover:bg-pink-50"
                                    >
                                      <div className="font-medium">{s.brand_name || s.name}</div>
                                      {(s.short_composition1 || s.short_composition2) && (
                                        <div className="text-xs text-gray-400">{[s.short_composition1, s.short_composition2].filter(Boolean).join(' + ')}</div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Brand Name
                            </label>
                            <input
                              type="text"
                              value={med.brand}
                              onChange={(e) => handleMedicationChange(index, 'brand', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-pink-500"
                              placeholder="e.g., Crocin"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Composition
                            </label>
                            <input
                              type="text"
                              value={med.composition}
                              onChange={(e) => handleMedicationChange(index, 'composition', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-pink-500"
                              placeholder="e.g., Paracetamol"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Dosage
                            </label>
                            <input
                              type="text"
                              value={med.dosage}
                              onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-pink-500"
                              placeholder="e.g., 500mg"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Frequency
                            </label>
                            <input
                              type="text"
                              value={med.frequency}
                              onChange={(e) => handleMedicationChange(index, 'frequency', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-pink-500"
                              placeholder="e.g., 1-0-1"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Timing
                            </label>
                            <div className="flex flex-col gap-2">
                              <select
                                value={med.timing?.type || med.timing || 'AFTER_MEAL'}
                                onChange={(e) => {
                                  const type = e.target.value;
                                  handleMedicationChange(index, 'timing', { 
                                    type, 
                                    time: type === 'FIXED_TIME' ? (med.timing?.time || '09:00') : null 
                                  });
                                }}
                                className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-pink-500"
                              >
                                <option value="AFTER_MEAL">After Meal</option>
                                <option value="BEFORE_MEAL">Before Meal</option>
                                <option value="DURING_MEAL">During Meal</option>
                                <option value="FIXED_TIME">Fixed Time</option>
                                <option value="AFTER_BREAKFAST_LUNCH">After Breakfast & Lunch</option>
                                <option value="BEFORE_LUNCH_DINNER">Before Lunch & Dinner</option>
                                <option value="AFTER_LUNCH_DINNER">After Lunch & Dinner</option>
                                <option value="AFTER_B_L_D">After Breakfast, Lunch & Dinner</option>
                                <option value="BEFORE_B_D">Before Breakfast & Dinner</option>
                                <option value="AFTER_B_D">After Breakfast & Dinner</option>
                                <option value="BEFORE_B_L">Before Breakfast & Lunch</option>
                                <option value="Empty Stomach">Empty Stomach</option>
                                <option value="With Food">With Food</option>
                              </select>
                              {(med.timing?.type === 'FIXED_TIME' || med.timing === 'FIXED_TIME') && (
                                <input
                                  type="time"
                                  value={med.timing?.time || '09:00'}
                                  onChange={(e) => handleMedicationChange(index, 'timing', { ...med.timing, time: e.target.value })}
                                  className="w-full px-2 py-1.5 text-sm border rounded"
                                />
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Duration
                            </label>
                            <input
                              type="text"
                              value={med.duration}
                              onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-pink-500"
                              placeholder="e.g., 7 days"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Quantity
                            </label>
                            <input
                              type="number"
                              value={med.qty}
                              onChange={(e) => handleMedicationChange(index, 'qty', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-pink-500"
                              placeholder="e.g., 7"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
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

export default MedicationsTemplates;
