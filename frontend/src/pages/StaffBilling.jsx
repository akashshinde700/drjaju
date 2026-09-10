import React, { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function StaffBilling() {
  const api = useApiClient();
  const { user: _user } = useAuth();
  const { addToast } = useToast();
  
  const [completedVisits, setCompletedVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateBillModal, setShowCreateBillModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [services, setServices] = useState([{ service_name: '', quantity: 1, unit_price: 0, total: 0 }]);
  const [_templates, setTemplates] = useState([]);

  const fetchCompletedVisits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/staff-billing/completed-visits');
      setCompletedVisits(res.data.visits || []);
    } catch (error) {
      console.error('Failed to fetch completed visits:', error);
      addToast('Failed to fetch completed visits', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/api/receipt-templates');
      setTemplates(res.data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  }, [api]);

  useEffect(() => {
    fetchCompletedVisits();
    fetchTemplates();
  }, [fetchCompletedVisits, fetchTemplates]);

  const handleCreateBill = (visit) => {
    setSelectedVisit(visit);
    setShowCreateBillModal(true);
    setServices([{
      service_name: 'Consultation',
      quantity: 1,
      unit_price: visit.consultation_fee || 500,
      total: visit.consultation_fee || 500
    }]);
  };

  const handleServiceChange = (index, field, value) => {
    const updatedServices = [...services];
    updatedServices[index][field] = value;
    
    // Calculate total
    if (field === 'quantity' || field === 'unit_price') {
      updatedServices[index].total = (updatedServices[index].quantity || 0) * (updatedServices[index].unit_price || 0);
    }
    
    setServices(updatedServices);
  };

  const addService = () => {
    setServices([...services, { service_name: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeService = (index) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return services.reduce((sum, service) => sum + (service.total || 0), 0);
  };

  const handleSaveBill = async () => {
    try {
      const _res = await api.post('/api/staff-billing/create-bill', {
        queue_id: selectedVisit.queue_id,
        services: services
      });
      
      addToast('Bill created successfully', 'success');
      setShowCreateBillModal(false);
      setSelectedVisit(null);
      fetchCompletedVisits();
    } catch (error) {
      console.error('Failed to create bill:', error);
      addToast('Failed to create bill', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded shadow-sm p-6">
        <h2 className="text-2xl font-bold mb-6">Staff Billing Dashboard</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Completed Visits - Ready for Billing</h3>
          
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : completedVisits.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No completed visits found for billing
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-3 text-left">Patient</th>
                    <th className="border p-3 text-left">UHID</th>
                    <th className="border p-3 text-left">Phone</th>
                    <th className="border p-3 text-left">Doctor</th>
                    <th className="border p-3 text-left">Completed At</th>
                    <th className="border p-3 text-left">Consultation Fee</th>
                    <th className="border p-3 text-left">Priority Status</th>
                    <th className="border p-3 text-left">Wait Time</th>
                    <th className="border p-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {completedVisits.map((visit) => (
                    <tr key={visit.queue_id} className="hover:bg-gray-50">
                      <td className="border p-3">{visit.patient_name}</td>
                      <td className="border p-3">{visit.uhid}</td>
                      <td className="border p-3">{visit.phone}</td>
                      <td className="border p-3">{visit.doctor_name}</td>
                      <td className="border p-3">
                        {new Date(visit.completed_at).toLocaleString()}
                      </td>
                      <td className="border p-3">₹{visit.consultation_fee || 0}</td>
                      <td className="border p-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          visit.priority_status?.includes('Priority') 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {visit.priority_status}
                        </span>
                      </td>
                      <td className="border p-3">
                        {visit.wait_time_minutes} min
                      </td>
                      <td className="border p-3">
                        <button
                          onClick={() => handleCreateBill(visit)}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Create Bill
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Bill Modal */}
      {showCreateBillModal && selectedVisit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create Bill</h3>
            
            <div className="mb-4 p-4 bg-gray-50 rounded">
              <h4 className="font-semibold">Patient Details</h4>
              <p>Name: {selectedVisit.patient_name}</p>
              <p>UHID: {selectedVisit.uhid}</p>
              <p>Doctor: {selectedVisit.doctor_name}</p>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold mb-2">Services</h4>
              {services.map((service, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Service Name"
                    className="flex-1 px-3 py-2 border rounded"
                    value={service.service_name}
                    onChange={(e) => handleServiceChange(index, 'service_name', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    className="w-20 px-3 py-2 border rounded"
                    value={service.quantity}
                    onChange={(e) => handleServiceChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    className="w-24 px-3 py-2 border rounded"
                    value={service.unit_price}
                    onChange={(e) => handleServiceChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  />
                  <input
                    type="number"
                    placeholder="Total"
                    className="w-24 px-3 py-2 border rounded bg-gray-100"
                    value={service.total}
                    readOnly
                  />
                  {services.length > 1 && (
                    <button
                      onClick={() => removeService(index)}
                      className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addService}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Add Service
              </button>
            </div>

            <div className="mb-4 text-right">
              <h4 className="font-semibold">Total: ₹{calculateTotal()}</h4>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreateBillModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBill}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
