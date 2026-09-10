import React, { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function DoctorBilling() {
  const api = useApiClient();
  const { _user } = useAuth();
  const { addToast } = useToast();
  
  const [dashboardData, setDashboardData] = useState({
    unbilledVisits: [],
    billedPayments: [],
    pendingPayments: [],
    summary: {
      totalCollected: 0,
      totalOutstanding: 0,
      unbilledCount: 0,
      billedCount: 0,
      pendingCount: 0
    }
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('unbilled');
  const [showCreateBillModal, setShowCreateBillModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [services, setServices] = useState([{ service_name: '', quantity: 1, unit_price: 0, total: 0 }]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctor-billing/dashboard');
      setDashboardData(res.data.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      addToast('Failed to fetch billing data', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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
      const _res = await api.post('/api/doctor-billing/create-bill', {
        queue_id: selectedVisit.queue_id,
        services: services
      });
      
      addToast('Bill created successfully', 'success');
      setShowCreateBillModal(false);
      setSelectedVisit(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to create bill:', error);
      if (error.response?.status === 409) {
        addToast('Bill already created by another user', 'warning');
      } else {
        addToast('Failed to create bill', 'error');
      }
    }
  };

  const renderUnbilledVisits = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Unbilled Visits</h3>
      {dashboardData.unbilledVisits.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No unbilled visits
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-3 text-left">Patient</th>
                <th className="border p-3 text-left">UHID</th>
                <th className="border p-3 text-left">Phone</th>
                <th className="border p-3 text-left">Completed At</th>
                <th className="border p-3 text-left">Consultation Fee</th>
                <th className="border p-3 text-left">Billing Status</th>
                <th className="border p-3 text-left">Wait Time</th>
                <th className="border p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.unbilledVisits.map((visit) => (
                <tr key={visit.queue_id} className="hover:bg-gray-50">
                  <td className="border p-3">{visit.patient_name}</td>
                  <td className="border p-3">{visit.uhid}</td>
                  <td className="border p-3">{visit.phone}</td>
                  <td className="border p-3">
                    {new Date(visit.completed_at).toLocaleString()}
                  </td>
                  <td className="border p-3">₹{visit.consultation_fee || 0}</td>
                  <td className="border p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      visit.billing_status === 'Pending with Staff' 
                        ? 'bg-orange-100 text-orange-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {visit.billing_status}
                    </span>
                  </td>
                  <td className="border p-3">{visit.wait_time_minutes} min</td>
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
  );

  const renderBilledPayments = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Billed Payments (Completed)</h3>
      {dashboardData.billedPayments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No completed payments
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-3 text-left">Bill #</th>
                <th className="border p-3 text-left">Patient</th>
                <th className="border p-3 text-left">UHID</th>
                <th className="border p-3 text-left">Amount</th>
                <th className="border p-3 text-left">Paid</th>
                <th className="border p-3 text-left">Method</th>
                <th className="border p-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.billedPayments.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="border p-3">{bill.bill_number}</td>
                  <td className="border p-3">{bill.patient_name}</td>
                  <td className="border p-3">{bill.uhid}</td>
                  <td className="border p-3">₹{bill.total_amount}</td>
                  <td className="border p-3 text-green-600 font-semibold">₹{bill.amount_paid}</td>
                  <td className="border p-3">{bill.payment_method}</td>
                  <td className="border p-3">
                    {new Date(bill.bill_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderPendingPayments = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Pending Payments</h3>
      {dashboardData.pendingPayments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No pending payments
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-3 text-left">Bill #</th>
                <th className="border p-3 text-left">Patient</th>
                <th className="border p-3 text-left">UHID</th>
                <th className="border p-3 text-left">Total</th>
                <th className="border p-3 text-left">Paid</th>
                <th className="border p-3 text-left">Balance</th>
                <th className="border p-3 text-left">Status</th>
                <th className="border p-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.pendingPayments.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="border p-3">{bill.bill_number}</td>
                  <td className="border p-3">{bill.patient_name}</td>
                  <td className="border p-3">{bill.uhid}</td>
                  <td className="border p-3">₹{bill.total_amount}</td>
                  <td className="border p-3">₹{bill.amount_paid || 0}</td>
                  <td className="border p-3 text-orange-600 font-semibold">₹{bill.balance_due}</td>
                  <td className="border p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      bill.payment_status === 'partial' 
                        ? 'bg-orange-100 text-orange-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {bill.payment_status}
                    </span>
                  </td>
                  <td className="border p-3">
                    {new Date(bill.bill_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded shadow-sm p-6">
        <h2 className="text-2xl font-bold mb-6">Doctor Billing Dashboard</h2>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-green-800 font-semibold">Total Collected</h3>
            <p className="text-2xl font-bold text-green-600">₹{dashboardData.summary.totalCollected}</p>
            <p className="text-sm text-green-600">{dashboardData.summary.billedCount} payments</p>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="text-orange-800 font-semibold">Outstanding</h3>
            <p className="text-2xl font-bold text-orange-600">₹{dashboardData.summary.totalOutstanding}</p>
            <p className="text-sm text-orange-600">{dashboardData.summary.pendingCount} pending</p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-blue-800 font-semibold">Unbilled Visits</h3>
            <p className="text-2xl font-bold text-blue-600">{dashboardData.summary.unbilledCount}</p>
            <p className="text-sm text-blue-600">Ready for billing</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('unbilled')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'unbilled'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Create Receipt ({dashboardData.summary.unbilledCount})
            </button>
            <button
              onClick={() => setActiveTab('billed')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'billed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Billed Payments ({dashboardData.summary.billedCount})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Payments ({dashboardData.summary.pendingCount})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'unbilled' && renderUnbilledVisits()}
          {activeTab === 'billed' && renderBilledPayments()}
          {activeTab === 'pending' && renderPendingPayments()}
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
              <p>Status: {selectedVisit.billing_status}</p>
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
