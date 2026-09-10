import { useState, useEffect, useCallback } from 'react';
import HeaderBar from '../components/HeaderBar';
import Modal from '../components/Modal';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';

export default function ReceiptTemplates() {
  const api = useApiClient();
  const { addToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const [templateForm, setTemplateForm] = useState({
    template_name: '',
    header_content: '',
    header_image: '',
    footer_content: '',
    footer_image: '',
    is_default: false
  });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/receipt-templates');
      setTemplates(res.data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setTemplateForm({
      template_name: '',
      header_content: '',
      header_image: '',
      footer_content: '',
      footer_image: '',
      is_default: false
    });
  };

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Please select an image file', 'info');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      addToast('Image size should be less than 2MB', 'info');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'header') {
        setTemplateForm({ ...templateForm, header_image: reader.result });
      } else if (type === 'footer') {
        setTemplateForm({ ...templateForm, footer_image: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Please select an image file', 'info');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      addToast('Image size should be less than 2MB', 'info');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'header') {
        setEditingTemplate({ ...editingTemplate, header_image: reader.result });
      } else if (type === 'footer') {
        setEditingTemplate({ ...editingTemplate, footer_image: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTemplate = async () => {
    if (!templateForm.template_name) {
      addToast('Please enter a template name', 'error');
      return;
    }

    try {
      await api.post('/api/receipt-templates', templateForm);
      setShowCreateModal(false);
      fetchTemplates();
      resetForm();
      addToast('Template created successfully!', 'success');
    } catch (error) {
      console.error('Failed to create template:', error);
      addToast('Failed to create template', 'error');
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate.template_name) {
      addToast('Please enter a template name', 'error');
      return;
    }

    try {
      await api.put(`/api/receipt-templates/${editingTemplate.id}`, {
        template_name: editingTemplate.template_name,
        header_content: editingTemplate.header_content,
        header_image: editingTemplate.header_image,
        footer_content: editingTemplate.footer_content,
        footer_image: editingTemplate.footer_image,
        is_default: editingTemplate.is_default
      });
      setShowEditModal(false);
      fetchTemplates();
      setEditingTemplate(null);
      addToast('Template updated successfully!', 'success');
    } catch (error) {
      console.error('Failed to update template:', error);
      addToast('Failed to update template', 'error');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await api.delete(`/api/receipt-templates/${id}`);
      fetchTemplates();
      addToast('Template deleted successfully!', 'success');
    } catch (error) {
      console.error('Failed to delete template:', error);
      addToast('Failed to delete template', 'error');
    }
  };

  return (
    <div className="space-y-6 pt-2">

      <div className="bg-white border rounded shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Manage Header/Footer Templates</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Create New Template
          </button>
        </div>

        {/* Templates Table */}
        <div className="border rounded overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">NAME</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">HEADER</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">FOOTER</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">DEFAULT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                    No templates found. Create your first template to get started.
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium">{template.template_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {template.header_content ? (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {template.header_content.length} chars
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {template.footer_content ? (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {template.footer_content.length} chars
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {template.is_default ? (
                        <span className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Default
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setPreviewTemplate(template);
                            setShowPreviewModal(true);
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowEditModal(true);
                          }}
                          className="text-primary hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Template Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Create Receipt Template"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Template Name *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded"
              placeholder="e.g., Standard Template, Premium Header/Footer"
              value={templateForm.template_name}
              onChange={(e) => setTemplateForm({ ...templateForm, template_name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Header Content</label>
            <textarea
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows="6"
              placeholder="Enter header text. This will appear at the top of receipts."
              value={templateForm.header_content}
              onChange={(e) => setTemplateForm({ ...templateForm, header_content: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">
              You can add clinic details, registration numbers, or any custom text.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Header Image (Optional)</label>
            <input
              type="file"
              accept="image/*"
              className="w-full px-3 py-2 border rounded"
              onChange={(e) => handleImageUpload(e, 'header')}
            />
            <p className="text-xs text-slate-500 mt-1">
              Upload a logo or image for the header. Max size: 2MB
            </p>
            {templateForm.header_image && (
              <div className="mt-2">
                <img
                  src={templateForm.header_image}
                  alt="Header preview"
                  className="max-h-32 border rounded"
                />
                <button
                  type="button"
                  onClick={() => setTemplateForm({ ...templateForm, header_image: '' })}
                  className="text-xs text-red-600 hover:underline mt-1"
                >
                  Remove image
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Footer Content</label>
            <textarea
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows="4"
              placeholder="Enter footer text. This will appear at the bottom of receipts."
              value={templateForm.footer_content}
              onChange={(e) => setTemplateForm({ ...templateForm, footer_content: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">
              Typically used for terms, conditions, or thank you messages.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Footer Image (Optional)</label>
            <input
              type="file"
              accept="image/*"
              className="w-full px-3 py-2 border rounded"
              onChange={(e) => handleImageUpload(e, 'footer')}
            />
            <p className="text-xs text-slate-500 mt-1">
              Upload an image for the footer. Max size: 2MB
            </p>
            {templateForm.footer_image && (
              <div className="mt-2">
                <img
                  src={templateForm.footer_image}
                  alt="Footer preview"
                  className="max-h-32 border rounded"
                />
                <button
                  type="button"
                  onClick={() => setTemplateForm({ ...templateForm, footer_image: '' })}
                  className="text-xs text-red-600 hover:underline mt-1"
                >
                  Remove image
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="create_is_default"
              className="mr-2"
              checked={templateForm.is_default}
              onChange={(e) => setTemplateForm({ ...templateForm, is_default: e.target.checked })}
            />
            <label htmlFor="create_is_default" className="text-sm">
              Set as default template
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTemplate}
              className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            >
              Create Template
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Template Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingTemplate(null);
        }}
        title="Edit Receipt Template"
      >
        {editingTemplate && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Template Name *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded"
                value={editingTemplate.template_name}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, template_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Header Content</label>
              <textarea
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                rows="6"
                value={editingTemplate.header_content || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, header_content: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Header Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                className="w-full px-3 py-2 border rounded"
                onChange={(e) => handleEditImageUpload(e, 'header')}
              />
              <p className="text-xs text-slate-500 mt-1">
                Upload a logo or image for the header. Max size: 2MB
              </p>
              {editingTemplate.header_image && (
                <div className="mt-2">
                  <img
                    src={editingTemplate.header_image}
                    alt="Header preview"
                    className="max-h-32 border rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingTemplate({ ...editingTemplate, header_image: '' })}
                    className="text-xs text-red-600 hover:underline mt-1"
                  >
                    Remove image
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Footer Content</label>
              <textarea
                className="w-full px-3 py-2 border rounded font-mono text-sm"
                rows="4"
                value={editingTemplate.footer_content || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, footer_content: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Footer Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                className="w-full px-3 py-2 border rounded"
                onChange={(e) => handleEditImageUpload(e, 'footer')}
              />
              <p className="text-xs text-slate-500 mt-1">
                Upload an image for the footer. Max size: 2MB
              </p>
              {editingTemplate.footer_image && (
                <div className="mt-2">
                  <img
                    src={editingTemplate.footer_image}
                    alt="Footer preview"
                    className="max-h-32 border rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingTemplate({ ...editingTemplate, footer_image: '' })}
                    className="text-xs text-red-600 hover:underline mt-1"
                  >
                    Remove image
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="edit_is_default"
                className="mr-2"
                checked={editingTemplate.is_default || false}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, is_default: e.target.checked })}
              />
              <label htmlFor="edit_is_default" className="text-sm">
                Set as default template
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingTemplate(null);
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTemplate}
                className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
              >
                Update Template
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
          setPreviewTemplate(null);
        }}
        title="Template Preview"
        size="lg"
      >
        {previewTemplate && (
          <div className="space-y-6">
            <div className="border rounded p-6 bg-white">
              {/* Header */}
              {(previewTemplate.header_image || previewTemplate.header_content) && (
                <div className="border-b pb-4 mb-4">
                  {previewTemplate.header_image && (
                    <div className="text-center mb-3">
                      <img
                        src={previewTemplate.header_image}
                        alt="Header"
                        className="max-h-32 mx-auto"
                      />
                    </div>
                  )}
                  {previewTemplate.header_content && (
                    <div className="text-sm whitespace-pre-wrap text-slate-700">
                      {previewTemplate.header_content}
                    </div>
                  )}
                </div>
              )}

              {/* Sample Receipt Content */}
              <div className="text-center mb-4">
                <h4 className="text-xl font-bold text-slate-800">Sample Clinic Name</h4>
                <p className="text-sm text-slate-600">123 Sample St, City, State</p>
              </div>

              <div className="my-4">
                <p className="font-semibold text-slate-800">RECEIPT</p>
                <p className="text-sm text-slate-600">Receipt #: REC0001</p>
                <p className="text-sm text-slate-600">Date: {new Date().toLocaleDateString()}</p>
              </div>

              <table className="w-full text-sm mb-4 border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Service</th>
                    <th className="border border-slate-300 px-3 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 px-3 py-2">Consultation</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">₹500.00</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-end mb-4">
                <div className="w-64">
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>₹500.00</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              {(previewTemplate.footer_image || previewTemplate.footer_content) && (
                <div className="border-t pt-4 mt-4">
                  {previewTemplate.footer_content && (
                    <div className="text-sm whitespace-pre-wrap text-slate-600 mb-3">
                      {previewTemplate.footer_content}
                    </div>
                  )}
                  {previewTemplate.footer_image && (
                    <div className="text-center">
                      <img
                        src={previewTemplate.footer_image}
                        alt="Footer"
                        className="max-h-32 mx-auto"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewTemplate(null);
                }}
                className="px-4 py-2 border rounded hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
