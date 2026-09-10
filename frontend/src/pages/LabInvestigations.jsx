import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { useApiClient } from '../api/client';
import Modal from '../components/Modal';
import HeaderBar from '../components/HeaderBar';
import { getLocalDateString } from '../utils/localDate';

export default function LabInvestigations() {
  const { addToast } = useToast();
  const api = useApiClient();
  const [tests, setTests] = useState([]);
  const [form, setForm] = useState({ name: '', testOn: '', repeatOn: '', remarks: '', bookable: true });
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [showCalendarModal, setShowCalendarModal] = useState(null);
  const [showTPanelModal, setShowTPanelModal] = useState(null);

  
  // Load lab investigations data on component mount
  useEffect(() => {
    const loadLabs = async () => {
      try {
        const response = await api.get('/api/labs');
        let labs = response.data.labs || [];

        // Load saved order from localStorage
        const savedOrder = localStorage.getItem('labTestsOrder');
        if (savedOrder) {
          try {
            const orderData = JSON.parse(savedOrder);
            // Sort labs based on saved order
            labs.sort((a, b) => {
              const aOrder = orderData.find(item => item.id === a.id)?.order ?? 999;
              const bOrder = orderData.find(item => item.id === b.id)?.order ?? 999;
              return aOrder - bOrder;
            });
          } catch (error) {
            console.error('Failed to parse saved order:', error);
          }
        }

        setTests(labs);
      } catch (error) {
        console.error('Failed to load lab investigations:', error);
        addToast('Failed to load lab investigations', 'error');
      }
    };
    loadLabs();
  }, [api, addToast]);

  const formatTestDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 3) return 'After 3 Days';
    if (diffDays > 0) return `After ${diffDays} Days`;
    return date.toLocaleDateString();
  };

  const formatRepeatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 3) return 'After 3 Days';
    if (diffDays > 0) return `After ${diffDays} Days`;
    return date.toLocaleDateString();
  };

  const startEdit = (test) => {
    setEditingId(test.id);
    setForm({
      name: test.name,
      testOn: test.testOn,
      repeatOn: test.repeatOn,
      remarks: test.remarks,
      bookable: test.bookable
    });
  };

  const saveEdit = async () => {
    if (!form.name) return;
    try {
      const res = await api.put(`/api/labs/${editingId}`, form);
      setTests((prev) => prev.map((t) => (t.id === editingId ? res.data : t)));
      setEditingId(null);
      setForm({ name: '', testOn: '', repeatOn: '', remarks: '', bookable: true });
      addToast('Lab test updated', 'success');
    } catch {
      addToast('Failed to update', 'error');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: '', testOn: '', repeatOn: '', remarks: '', bookable: true });
  };

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = draggedItem;
    if (dragIndex === dropIndex) return;

    const newTests = [...tests];
    const draggedTest = newTests[dragIndex];
    newTests.splice(dragIndex, 1);
    newTests.splice(dropIndex, 0, draggedTest);

    setTests(newTests);
    setDraggedItem(null);

    // TODO: Implement backend persistence for order
    // For now, save order to localStorage
    try {
      const orderData = newTests.map((test, index) => ({ id: test.id, order: index }));
      localStorage.setItem('labTestsOrder', JSON.stringify(orderData));
      addToast('Order updated', 'success');
    } catch (error) {
      console.error('Failed to save order:', error);
      addToast('Failed to save order', 'error');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Lab Investigations</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .bookable { background-color: #d4edda; color: #155724; padding: 2px 6px; border-radius: 3px; font-size: 10px; }
          </style>
        </head>
        <body>
          <h1>Lab Investigations Report</h1>
          <table>
            <thead>
              <tr>
                <th>LAB RESULT</th>
                <th>TEST ON</th>
                <th>REPEAT ON</th>
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(t => `
                <tr>
                  <td>${t.name} ${t.bookable ? '<span class="bookable">Bookable</span>' : ''}</td>
                  <td>${formatTestDate(t.testOn)}</td>
                  <td>${formatRepeatDate(t.repeatOn)}</td>
                  <td>${t.remarks || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const addTest = async () => {
    if (!form.name) {
      addToast('Please enter a lab test name', 'warning');
      return;
    }
    try {
      const payload = {
        name: form.name,
        testOn: form.testOn || getLocalDateString(),
        repeatOn: form.repeatOn || null,
        remarks: form.remarks || null,
        bookable: form.bookable
      };
      const res = await api.post('/api/labs', payload);
      setTests((prev) => [...prev, res.data]);
      setForm({ name: '', testOn: '', repeatOn: '', remarks: '', bookable: true });
      addToast('Lab test added successfully', 'success');
    } catch (error) {
      console.error('Add lab error:', error);
      addToast(error.response?.data?.error || 'Failed to add lab test', 'error');
    }
  };

  const removeTest = async (id) => {
    try {
      await api.delete(`/api/labs/${id}`);
      setTests((prev) => prev.filter((t) => t.id !== id));
    } catch {
      addToast('Delete failed', 'error');
    }
  };

  const filtered = tests.filter((t) => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    (t.code && t.code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <HeaderBar title="Lab Investigations" />

      {/* Search Bar */}
      <div className="bg-white border rounded shadow-sm p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <input
              className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search lab tests by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="text-sm text-gray-600">
            {filtered.length} of {tests.length} {filtered.length === 1 ? 'test' : 'tests'}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div></div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 text-sm border rounded hover:bg-slate-50"
            onClick={() => {
              if (!form.name) {
                addToast('Please enter a lab test name', 'warning');
                return;
              }
              editingId ? saveEdit() : addTest();
            }}
          >
            {editingId ? 'Save Edit' : 'Add'}
          </button>
          {editingId && (
            <button
              className="px-4 py-2 text-sm border rounded hover:bg-slate-50"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          )}
          <button
            className="px-4 py-2 text-sm border rounded hover:bg-slate-50"
            onClick={handlePrint}
          >
            Print
          </button>
        </div>
      </div>

      <div className="bg-white border rounded shadow-sm overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[720px] bg-slate-50 text-xs font-semibold text-slate-600 px-3 py-2">
          <span className="col-span-2">LAB RESULT</span>
          <span>TEST ON</span>
          <span>REPEAT ON</span>
          <span className="col-span-2">REMARKS</span>
          <span>ACTIONS</span>
          <span></span>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">
              {search
                ? `No tests found matching "${search}"`
                : 'No lab tests added yet. Add a new test below.'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Clear search to see all tests
              </button>
            )}
          </div>
        )}
        {filtered.map((t, index) => (
          <div
            key={t.id}
            className="grid grid-cols-7 min-w-[720px] items-center px-3 py-2 text-sm border-t"
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className="flex items-center gap-2 col-span-2">
              <div className="cursor-move text-slate-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4h14a1 1 0 010 2H3a1 1 0 010-2zM3 8h14a1 1 0 010 2H3a1 1 0 010-2zM3 12h14a1 1 0 010 2H3a1 1 0 010-2z"/>
                </svg>
              </div>
              <div>
                <span>{t.name}</span>
                {t.bookable && <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded ml-2">Bookable</span>}
              </div>
            </div>
            <span>{formatTestDate(t.testOn)}</span>
            <span>{formatRepeatDate(t.repeatOn)}</span>
            <span className="col-span-2 truncate">{t.remarks || '-'}</span>
            <div className="flex gap-1">
              <button
                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                onClick={() => startEdit(t)}
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                className="p-1 text-slate-600 hover:bg-slate-50 rounded"
                onClick={() => setShowDetailsModal(t)}
                title="Details"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                className="p-1 text-green-600 hover:bg-green-50 rounded"
                onClick={() => setShowCalendarModal(t)}
                title="Calendar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                onClick={() => setShowTPanelModal(t)}
                title="TPanel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
              <button
                className="p-1 text-red-600 hover:bg-red-50 rounded"
                onClick={() => removeTest(t.id)}
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div></div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-6 gap-2 bg-white border rounded shadow-sm p-4 items-end">
        <input
          className="px-3 py-2 border rounded md:col-span-2"
          placeholder="Lab test / Radiology"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="px-3 py-2 border rounded"
          placeholder="Test on"
          type="date"
          value={form.testOn}
          onChange={(e) => setForm({ ...form, testOn: e.target.value })}
        />
        <input
          className="px-3 py-2 border rounded"
          placeholder="Repeat on"
          type="date"
          value={form.repeatOn}
          onChange={(e) => setForm({ ...form, repeatOn: e.target.value })}
        />
        <input
          className="px-3 py-2 border rounded md:col-span-2"
          placeholder="Remarks"
          value={form.remarks}
          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
        />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.bookable}
              onChange={(e) => setForm({ ...form, bookable: e.target.checked })}
            />
            Bookable
          </label>
        </div>
        <button className="px-3 py-2 text-sm bg-primary text-white rounded" onClick={editingId ? saveEdit : addTest}>
          {editingId ? 'Update Test' : 'Add Row'}
        </button>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={!!showDetailsModal}
        onClose={() => setShowDetailsModal(null)}
        title="Lab Test Details"
      >
        {showDetailsModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-sm text-slate-600">LAB TEST</h3>
                <p className="text-lg font-medium">{showDetailsModal.name}</p>
                {showDetailsModal.bookable && (
                  <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded mt-1 inline-block">
                    Bookable
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-medium text-sm text-slate-600">STATUS</h3>
                <p className="text-sm">Active</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-sm text-slate-600">TEST ON</h3>
                <p>{formatTestDate(showDetailsModal.testOn)}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-slate-600">REPEAT ON</h3>
                <p>{formatRepeatDate(showDetailsModal.repeatOn)}</p>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-sm text-slate-600">REMARKS</h3>
              <p className="text-sm bg-slate-50 p-3 rounded border">
                {showDetailsModal.remarks || 'No remarks provided'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-sm text-slate-600">CREATED</h3>
                <p className="text-sm">
                  {showDetailsModal.created_at ? new Date(showDetailsModal.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-slate-600">LAST UPDATED</h3>
                <p className="text-sm">
                  {showDetailsModal.updated_at ? new Date(showDetailsModal.updated_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                className="px-4 py-2 border rounded hover:bg-slate-50"
                onClick={() => setShowDetailsModal(null)}
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
                onClick={() => {
                  startEdit(showDetailsModal);
                  setShowDetailsModal(null);
                }}
              >
                Edit Test
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Calendar Modal */}
      <Modal
        isOpen={!!showCalendarModal}
        onClose={() => setShowCalendarModal(null)}
        title="Schedule Lab Test"
      >
        {showCalendarModal && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-sm text-slate-600">LAB TEST</h3>
              <p className="text-lg font-medium">{showCalendarModal.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-sm text-slate-600">CURRENT TEST DATE</h3>
                <p>{formatTestDate(showCalendarModal.testOn)}</p>
              </div>
              <div>
                <h3 className="font-medium text-sm text-slate-600">CURRENT REPEAT DATE</h3>
                <p>{formatRepeatDate(showCalendarModal.repeatOn)}</p>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                Calendar functionality for scheduling lab tests would be implemented here.
                This could integrate with a calendar system to schedule appointments or set reminders.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                className="px-4 py-2 border rounded hover:bg-slate-50"
                onClick={() => setShowCalendarModal(null)}
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => {
                  addToast('Calendar integration coming soon', 'info');
                  setShowCalendarModal(null);
                }}
              >
                Schedule
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* TPanel Modal */}
      <Modal
        isOpen={!!showTPanelModal}
        onClose={() => setShowTPanelModal(null)}
        title="Test Panel Details"
      >
        {showTPanelModal && (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-sm text-slate-600">LAB TEST</h3>
              <p className="text-lg font-medium">{showTPanelModal.name}</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Test Panel Information</h4>
              <div className="space-y-2 text-sm text-blue-700">
                <p><strong>Status:</strong> {showTPanelModal.bookable ? 'Bookable' : 'Not Bookable'}</p>
                <p><strong>Test Date:</strong> {formatTestDate(showTPanelModal.testOn)}</p>
                <p><strong>Repeat Date:</strong> {formatRepeatDate(showTPanelModal.repeatOn)}</p>
                <p><strong>Remarks:</strong> {showTPanelModal.remarks || 'No remarks'}</p>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-800">
                TPanel functionality for viewing detailed test results and panel information would be implemented here.
                This could show historical results, reference ranges, and test interpretations.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                className="px-4 py-2 border rounded hover:bg-slate-50"
                onClick={() => setShowTPanelModal(null)}
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                onClick={() => {
                  addToast('TPanel integration coming soon', 'info');
                  setShowTPanelModal(null);
                }}
              >
                View Results
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

