import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { useApiClient } from '../api/client';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';

const defaultFields = [
  'Patient Medical History',
  'Dental Chart (New/PRO)',
  'Vitals',
  'Symptoms',
  'Examination Findings',
  'Lab Results',
  'Diagnosis',
  'Medications',
  'Notes',
  'Follow Up & Advices'
];

export default function PadConfiguration() {
  const { addToast } = useToast();
  const api = useApiClient();
  const [fields, setFields] = useState(() => {
    try {
      const savedConfig = localStorage.getItem('padConfiguration');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (config.fields) return config.fields;
      }
    } catch (error) {
      console.error('Failed to parse pad configuration:', error);
    }
    return [...defaultFields];
  });

  const [fieldStates, setFieldStates] = useState(() => {
    try {
      const savedConfig = localStorage.getItem('padConfiguration');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (config.fieldStates) return config.fieldStates;
      }
    } catch (error) {
      console.error('Failed to parse pad configuration:', error);
    }
    return defaultFields.reduce((acc, field) => ({
      ...acc,
      [field]: field === 'Patient Medical History'
        ? { enabled: true, autoCopy: false }
        : { enabled: true }
    }), {});
  });

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');

  // Load from backend on mount — overrides stale localStorage after login
  useEffect(() => {
    const loadFromServer = async () => {
      try {
        const res = await api.get('/api/pad-config');
        if (res.data?.success && res.data?.templateConfigs) {
          const layout = res.data.templateConfigs.find(t => t.template_type === 'layout' && !!t.is_default);
          if (layout?.content) {
            const parsed = JSON.parse(layout.content);
            if (Array.isArray(parsed.field_order) && parsed.field_order.length > 0) {
              setFields(parsed.field_order);
            }
            if (parsed.sections && typeof parsed.sections === 'object') {
              setFieldStates(parsed.sections);
            }
          }
        }
      } catch {
        // keep localStorage values on failure
      }
    };
    loadFromServer();
  }, [api]);

  const handleFieldChange = (field, type, value) => {
    setFieldStates(prev => ({
      ...prev,
      [field]: { ...(prev[field] || { enabled: true }), [type]: value }
    }));
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newFields = [...fields];
    const [draggedField] = newFields.splice(draggedIndex, 1);
    newFields.splice(dropIndex, 0, draggedField);

    setFields(newFields);
    setDraggedIndex(null);
    addToast('Field order updated successfully', 'success');
  };

  const handleAddField = () => {
    if (!newFieldName.trim()) {
      addToast('Please enter a field name', 'error');
      return;
    }

    if (fields.includes(newFieldName.trim())) {
      addToast('Field already exists', 'error');
      return;
    }

    const newField = newFieldName.trim();
    setFields([...fields, newField]);
    setFieldStates(prev => ({
      ...prev,
      [newField]: { enabled: true }
    }));
    setNewFieldName('');
    setShowAddModal(false);
    addToast('Field added successfully', 'success');
  };

  const handleDeleteField = (fieldToDelete) => {
    // Prevent deleting default fields
    if (defaultFields.includes(fieldToDelete)) {
      addToast('Cannot delete default fields', 'error');
      return;
    }

    setFields(fields.filter(f => f !== fieldToDelete));
    const newFieldStates = { ...fieldStates };
    delete newFieldStates[fieldToDelete];
    setFieldStates(newFieldStates);
    addToast('Field deleted successfully', 'success');
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    setFields(newFields);
  };

  const handleMoveDown = (index) => {
    if (index === fields.length - 1) return;
    const newFields = [...fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    setFields(newFields);
  };

  const handleSave = async () => {
    const config = { fields, fieldStates };
    localStorage.setItem('padConfiguration', JSON.stringify(config));
    try { window.dispatchEvent(new CustomEvent('padConfigurationUpdated')); } catch { /* ignore */ }

    try {
      await api.post('/api/pad-config/field-order', {
        field_order: fields,
        sections: fieldStates
      });
      addToast('Pad configuration saved successfully', 'success');
    } catch {
      addToast('Saved locally (server sync failed)', 'warning');
    }
  };

  const handleCancel = () => {
    // Reset to default state
    setFieldStates(
      fields.reduce((acc, field) => ({
        ...acc,
        [field]: field === 'Patient Medical History'
          ? { enabled: true, autoCopy: false }
          : { enabled: true }
      }), {})
    );
    addToast('Changes cancelled', 'info');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pad Configuration</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
        >
          <FiPlus /> Add Field
        </button>
      </div>
      <div className="bg-white border rounded shadow-sm p-4">
        <p className="text-xs text-slate-500 mb-3">
          <strong>Auto sync to pad</strong> (Patient Medical History only): tab par wapas aane par server se history dubara load hoti hai.
          Ye sirf <strong>Patient Medical History</strong> section mein dikhti hai — Patient Notes mein nahi jaati.
        </p>
        <div className="grid grid-cols-5 text-xs font-semibold text-slate-600 pb-2 border-b gap-1">
          <span>FIELD</span>
          <span>ENABLE/DISABLE</span>
          <span title="Patient Medical History: refetch on tab focus">AUTO SYNC</span>
          <span>ORDER</span>
          <span>ACTIONS</span>
        </div>
        <div className="divide-y">
          {fields.map((field, index) => (
            <div
              key={field}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className="grid grid-cols-5 items-center py-3 text-sm hover:bg-slate-50 gap-1"
            >
              <div className="flex items-center gap-2">
                <span className="cursor-move text-slate-400">⋮⋮</span>
                <span>{field}</span>
                {field.includes('Dental Chart') && (
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">New</span>
                    <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">PRO</span>
                  </div>
                )}
              </div>
              <input
                type="checkbox"
                checked={fieldStates[field]?.enabled || false}
                onChange={(e) => handleFieldChange(field, 'enabled', e.target.checked)}
                className="h-4 w-4"
              />
              {field === 'Patient Medical History' ? (
                <input
                  type="checkbox"
                  checked={fieldStates[field]?.autoCopy || false}
                  onChange={(e) => handleFieldChange(field, 'autoCopy', e.target.checked)}
                  className="h-4 w-4"
                  title="Focus par / Configure ke baad wapas aane par history server se sync"
                />
              ) : (
                <span className="text-slate-300 text-center text-xs">—</span>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={index + 1}
                  onChange={(e) => {
                    const newOrder = parseInt(e.target.value) - 1;
                    if (newOrder >= 0 && newOrder < fields.length && newOrder !== index) {
                      const newFields = [...fields];
                      const [movedField] = newFields.splice(index, 1);
                      newFields.splice(newOrder, 0, movedField);
                      setFields(newFields);
                    }
                  }}
                  className="w-16 px-2 py-1 text-xs border rounded"
                  min="1"
                  max={fields.length}
                />
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === fields.length - 1}
                  className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              <div>
                {!defaultFields.includes(field) && (
                  <button
                    onClick={() => handleDeleteField(field)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                    title="Delete field"
                  >
                    <FiTrash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-3">
          <button
            onClick={handleCancel}
            className="px-3 py-2 text-sm border rounded hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90"
          >
            Save
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">Drag fields to reorder • Enter order number manually • Add custom fields</p>
      </div>

      {/* Add Field Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add New Field</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewFieldName('');
                }}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Field Name
                </label>
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
                  placeholder="Enter field name"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewFieldName('');
                  }}
                  className="px-4 py-2 text-sm border rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddField}
                  className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90"
                >
                  Add Field
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}