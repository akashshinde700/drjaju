import React, { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import HeaderBar from '../components/HeaderBar';
import { FiPlus, FiEdit, FiTrash2, FiX, FiSave } from 'react-icons/fi';

export default function InjectionTemplates() {
  const api = useApiClient();
  const { addToast } = useToast();
  const { _user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    template_name: '',
    injection_name: '',
    generic_name: '',
    dose: '',
    route: 'IV',
    infusion_rate: '',
    frequency: '',
    duration: '',
    timing: '',
    instructions: ''
  });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/injection-templates');
      setTemplates(res.data.templates || []);
    } catch (error) {
      console.error('Fetch templates error:', error);
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
        template_name: template.template_name,
        injection_name: template.injection_name,
        generic_name: template.generic_name || '',
        dose: template.dose,
        route: template.route,
        infusion_rate: template.infusion_rate || '',
        frequency: template.frequency,
        duration: template.duration,
        timing: template.timing || '',
        instructions: template.instructions || ''
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        template_name: '',
        injection_name: '',
        generic_name: '',
        dose: '',
        route: 'IV',
        infusion_rate: '',
        frequency: '',
        duration: '',
        timing: '',
        instructions: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormData({
      template_name: '',
      injection_name: '',
      generic_name: '',
      dose: '',
      route: 'IV',
      infusion_rate: '',
      frequency: '',
      duration: '',
      timing: '',
      instructions: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingTemplate) {
        // Update existing template
        await api.put(`/api/injection-templates/${editingTemplate.id}`, formData);
        addToast('Template updated successfully', 'success');
      } else {
        // Create new template
        await api.post('/api/injection-templates', formData);
        addToast('Template created successfully', 'success');
      }

      handleCloseModal();
      fetchTemplates();
    } catch (error) {
      console.error('Save template error:', error);
      addToast(error.response?.data?.error || 'Failed to save template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/api/injection-templates/${id}`);
      addToast('Template deleted successfully', 'success');
      fetchTemplates();
    } catch (error) {
      console.error('Delete template error:', error);
      addToast('Failed to delete template', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <HeaderBar title="Injection Templates" />

      {/* Add Button */}
      <div className="flex justify-end">
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <FiPlus /> Add Injection Template
        </button>
      </div>

      {/* Templates Grid */}
      {loading && !templates.length ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No injection templates found.</p>
          <p className="text-sm text-gray-400 mt-2">Create your first template to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex-1">
                  {template.template_name}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(template)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Edit"
                  >
                    <FiEdit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-gray-700">
                  <strong>Injection:</strong> {template.injection_name}
                </p>
                {template.generic_name && (
                  <p className="text-gray-600 text-xs">
                    <strong>Generic:</strong> {template.generic_name}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <strong>Dose:</strong> {template.dose}
                  </div>
                  <div>
                    <strong>Route:</strong> {template.route}
                  </div>
                  <div>
                    <strong>Frequency:</strong> {template.frequency}
                  </div>
                  <div>
                    <strong>Duration:</strong> {template.duration}
                  </div>
                </div>
                {template.infusion_rate && (
                  <p className="text-xs text-gray-600">
                    <strong>Infusion Rate:</strong> {template.infusion_rate}
                  </p>
                )}
                {template.instructions && (
                  <p className="text-xs text-gray-600 mt-2 pt-2 border-t">
                    {template.instructions}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t mt-2">
                  <span className="text-xs text-gray-500">
                    Used {template.usage_count || 0} times
                  </span>
                  {template.created_by_name && (
                    <span className="text-xs text-gray-500">
                      By: {template.created_by_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-semibold">
                {editingTemplate ? 'Edit' : 'Add'} Injection Template
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.template_name}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  placeholder="e.g., Orofer FCM Template"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Injection Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Injection Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.injection_name}
                  onChange={(e) => setFormData({ ...formData, injection_name: e.target.value })}
                  placeholder="e.g., Orofer FCM 1K Injection"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Generic Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Generic Name
                </label>
                <input
                  type="text"
                  value={formData.generic_name}
                  onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                  placeholder="e.g., Ferric Carboxymaltose (50MG/ML)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Dose */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dose <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.dose}
                    onChange={(e) => setFormData({ ...formData, dose: e.target.value })}
                    placeholder="e.g., 1 ml"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Route */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.route}
                    onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="IV">IV (Intravenous)</option>
                    <option value="IM">IM (Intramuscular)</option>
                    <option value="SC">SC (Subcutaneous)</option>
                    <option value="Intradermal">Intradermal</option>
                    <option value="Intrathecal">Intrathecal</option>
                    <option value="Intra-articular">Intra-articular</option>
                  </select>
                </div>

                {/* Infusion Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Infusion Rate
                  </label>
                  <input
                    type="text"
                    value={formData.infusion_rate}
                    onChange={(e) => setFormData({ ...formData, infusion_rate: e.target.value })}
                    placeholder="e.g., 2 drops/min"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frequency <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    placeholder="e.g., 0-1-0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="e.g., 2 Days"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Timing */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timing
                  </label>
                  <select
                    value={formData.timing}
                    onChange={(e) => setFormData({ ...formData, timing: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select timing</option>
                    <option value="stat">Stat</option>
                    <option value="after meal">After Meal</option>
                    <option value="before meal">Before Meal</option>
                    <option value="empty stomach">Empty Stomach</option>
                    <option value="bedtime">Bedtime</option>
                  </select>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructions
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder="e.g., in 250 ml NS over half hour"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
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
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  <FiSave />
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
