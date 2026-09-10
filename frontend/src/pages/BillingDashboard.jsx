import React, { useState, useEffect, useCallback } from 'react';
import { FiDollarSign, FiFileText, FiTrendingUp, FiClock, FiCheckCircle, FiAlertCircle, FiSearch, FiFilter, FiDownload } from 'react-icons/fi';
import { useApiClient } from '../api/client';
import { openWhatsApp } from '../utils/whatsapp';
import { getLocalDateString } from '../utils/localDate';

// Convert the dashboard's `dateRange` dropdown value into concrete
// start_date/end_date params that the backend (GET /api/bills) understands.
const computeDateRange = (range) => {
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const today = new Date();
  switch (range) {
    case 'today':
      return { start: fmt(today), end: fmt(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: fmt(y), end: fmt(y) };
    }
    case 'week': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start: fmt(start), end: fmt(today) };
    }
    case 'month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmt(start), end: fmt(today) };
    }
    case 'year': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { start: fmt(start), end: fmt(today) };
    }
    default:
      return { start: '', end: '' };
  }
};

const BillingDashboard = () => {
  const api = useApiClient();
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    paymentMethod: '',
    dateRange: 'today',
    search: ''
  });
  const [selectedBill, setSelectedBill] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'cash',
    amount_paid: ''
  });
  // GET /api/bills defaults to 50 rows with no pagination control here — a
  // week/month range easily has 100+ bills, so the table was silently
  // truncating while the summary cards (unpaginated) showed the real total,
  // making it look like the date filter was broken.
  const [page, setPage] = useState(1);
  const [billsPagination, setBillsPagination] = useState({ page: 1, pages: 1, total: 0, limit: 50 });

  // Debounced search: without this every keystroke fired TWO api calls
  // (bills + summary), hammering the backend and racing responses.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  // Fetch bills
  const fetchBills = useCallback(async () => {
    try {
      // Map the dashboard filters to the params the backend actually supports.
      // - status dropdown uses 'completed' in the UI, but the DB stores 'paid'
      // - dateRange is expressed via start_date/end_date
      // - payment method is now filtered server-side (passed to both endpoints)
      const params = new URLSearchParams();
      if (filters.status) {
        const statusParam = filters.status === 'completed' ? 'paid' : filters.status;
        params.append('payment_status', statusParam);
      }
      const range = computeDateRange(filters.dateRange);
      if (range.start) params.append('start_date', range.start);
      if (range.end) params.append('end_date', range.end);
      if (filters.paymentMethod) params.append('payment_method', filters.paymentMethod);
      if (debouncedSearch) params.append('search', debouncedSearch);
      params.append('page', page);
      params.append('limit', 50);

      // Bills list + stats come from two different endpoints, but both now
      // receive the same filters so the cards stay in sync with the table.
      const [billsRes, summaryRes] = await Promise.all([
        api.get(`/api/bills?${params}`),
        api.get(`/api/bills/summary?${params}`).catch(() => null)
      ]);

      if (billsRes.data?.success) {
        const list = billsRes.data?.data?.bills || [];
        setBills(list);
        const p = billsRes.data?.data?.pagination;
        if (p) {
          setBillsPagination({ page: p.page || 1, pages: p.pages || p.totalPages || 1, total: p.total || 0, limit: p.limit || 50 });
        }
      }

      // The summary endpoint returns its fields at the top level (not under data).
      // It is now scoped by clinic + the same filters as the table, so every
      // card reflects exactly the dataset shown below.
      const s = summaryRes?.data || {};
      setStats({
        totalRevenue: Math.round(Number(s.total_revenue || 0)),
        collected: Math.round(Number(s.total_collected || 0)),
        pendingPayments: Math.round(Number(s.total_outstanding ?? s.pending_amount ?? 0)),
        totalBills: Number(s.total_bills || 0)
      });
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  }, [api, filters.status, filters.paymentMethod, filters.dateRange, debouncedSearch, page]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Any filter change invalidates the current page of results.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const updatePaymentStatus = async (billId, status, paymentData = {}) => {
    try {
      const res = await api.patch(`/api/bills/${billId}/status`, {
        payment_status: status,
        ...paymentData
      });

      if (res.data?.success) {
        await fetchBills();
        setShowPaymentModal(false);
        setSelectedBill(null);
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  // Export the currently shown bills to a CSV file (built client-side).
  const exportCSV = () => {
    if (!bills.length) return;
    const headers = ['Bill ID', 'Patient', 'Phone', 'Doctor', 'Total', 'Paid', 'Status', 'Method', 'Date'];
    const rows = bills.map(b => [
      b.bill_number || b.id,
      b.patient_name || '',
      b.patient_phone || '',
      b.doctor_name || '',
      b.total_amount ?? 0,
      b.amount_paid ?? 0,
      b.payment_status || '',
      b.payment_method || '',
      b.created_at ? new Date(b.created_at).toLocaleString() : ''
    ]);
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bills_${getLocalDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate PDF
  const generatePDF = async (billId) => {
    try {
      window.open(`/api/pdf/bill/${billId}`, '_blank');
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  // Send bill via WhatsApp: the backend prepares the message + patient phone;
  // actually open WhatsApp with it (this used to fetch the message and then
  // silently discard it, so the button did nothing).
  const sendWhatsApp = async (billId) => {
    try {
      const res = await api.get(`/api/bills/${billId}/whatsapp`);
      const phone = res.data?.patient_phone;
      const message = res.data?.whatsapp_message;
      if (!phone || !message) {
        alert('Could not prepare WhatsApp message: patient phone or message missing');
        return;
      }
      openWhatsApp(phone, message);
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      alert(error.response?.data?.error || 'Failed to prepare WhatsApp message');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-amber-100 text-amber-800';
      case 'cancelled':
      case 'refunded': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Human-friendly label for the selected date range, used on the cards so
  // it's clear the figures are scoped to the chosen period.
  const rangeLabel = {
    today: 'Today',
    yesterday: 'Yesterday',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
    all: 'All Time'
  }[filters.dateRange] || 'Selected Period';

  const getPaymentMethodColor = (method) => {
    switch (method) {
      case 'cash': return 'bg-green-100 text-green-800';
      case 'card': return 'bg-blue-100 text-blue-800';
      case 'upi': return 'bg-purple-100 text-purple-800';
      case 'insurance': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Dashboard</h1>
          <p className="text-gray-600">Manage payments and billing</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            type="button"
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition active:scale-[0.98]"
          >
            <FiDownload />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Revenue ({rangeLabel})</p>
              <p className="text-2xl font-bold text-gray-900">₹{stats.totalRevenue || 0}</p>
            </div>
            <FiDollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Collected ({rangeLabel})</p>
              <p className="text-2xl font-bold text-gray-900">₹{stats.collected || 0}</p>
            </div>
            <FiCheckCircle className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Payments</p>
              <p className="text-2xl font-bold text-gray-900">₹{stats.pendingPayments || 0}</p>
            </div>
            <FiClock className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalBills || 0}</p>
            </div>
            <FiFileText className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={() => setFilters({ status: '', paymentMethod: '', dateRange: 'today', search: '' })}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Reset filters
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Search by patient name or bill ID..."
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="partial">Partial</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="insurance">Insurance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Bills</h2>
          <p className="text-sm text-gray-600">Showing {bills.length} bills</p>
        </div>
        
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full">
            {/* sticky header keeps column labels visible on long lists */}
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium">{bill.bill_number || `#${String(bill.id ?? '').slice(-8) || '-'}`}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{bill.patient_name}</p>
                      <div className="text-sm text-gray-500">{bill.patient_phone}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">{bill.doctor_name ? `Dr. ${bill.doctor_name}` : '—'}</div>
                      <div className="text-sm text-gray-500">{bill.specialization || ''}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium">₹{bill.total_amount}</div>
                      {bill.amount_paid && bill.amount_paid < bill.total_amount && (
                        <div className="text-sm text-gray-500">Paid: ₹{bill.amount_paid}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(bill.payment_status)}`}>
                      {bill.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${getPaymentMethodColor(bill.payment_method)}`}>
                      {bill.payment_method || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div>{new Date(bill.created_at).toLocaleDateString()}</div>
                      <div className="text-gray-500">{new Date(bill.created_at).toLocaleTimeString()}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => generatePDF(bill.id)}
                        type="button"
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition active:scale-[0.98]"
                        title="Download PDF"
                      >
                        <FiDownload />
                      </button>
                      <button
                        onClick={() => sendWhatsApp(bill.id)}
                        type="button"
                        className="p-1 text-green-600 hover:bg-green-50 rounded transition active:scale-[0.98]"
                        title="Send WhatsApp"
                      >
                        <FiTrendingUp />
                      </button>
                      {(bill.payment_status === 'pending' || bill.payment_status === 'partial') && (
                        <button
                          onClick={() => {
                            setSelectedBill(bill);
                            setPaymentForm({
                              payment_method: bill.payment_method || 'cash',
                              amount_paid: String(bill.total_amount - (bill.amount_paid || 0))
                            });
                            setShowPaymentModal(true);
                          }}
                          type="button"
                          className="p-1 text-orange-600 hover:bg-orange-50 rounded transition active:scale-[0.98]"
                          title="Update Payment"
                        >
                          <FiDollarSign />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {bills.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No bills found
            </div>
          )}

          {billsPagination.total > billsPagination.limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <span className="text-gray-500">
                Showing {(billsPagination.page - 1) * billsPagination.limit + 1}
                –{Math.min(billsPagination.page * billsPagination.limit, billsPagination.total)} of {billsPagination.total} bills
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={billsPagination.page <= 1}
                  className={`px-3 py-1.5 rounded border ${billsPagination.page <= 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`}
                >
                  Prev
                </button>
                <span className="text-gray-500">Page {billsPagination.page} of {billsPagination.pages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(billsPagination.pages, p + 1))}
                  disabled={billsPagination.page >= billsPagination.pages}
                  className={`px-3 py-1.5 rounded border ${billsPagination.page >= billsPagination.pages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Update Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                type="button"
                className="p-1 hover:bg-gray-100 rounded transition active:scale-[0.98]"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bill Amount:</span>
                  <span className="font-bold">₹{selectedBill.total_amount}</span>
                </div>
                {selectedBill.amount_paid && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Already Paid:</span>
                    <span>₹{selectedBill.amount_paid}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Remaining:</span>
                  <span className="font-bold text-orange-600">
                    ₹{selectedBill.total_amount - (selectedBill.amount_paid || 0)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="insurance">Insurance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received</label>
                <input
                  type="number"
                  value={paymentForm.amount_paid}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount_paid: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Enter amount received"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowPaymentModal(false)}
                type="button"
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const amountNum = Number(paymentForm.amount_paid);
                  updatePaymentStatus(selectedBill.id, 'paid', {
                    amount_paid: Number.isFinite(amountNum) ? amountNum : (selectedBill.total_amount - (selectedBill.amount_paid || 0)),
                    payment_method: paymentForm.payment_method
                  });
                }}
                type="button"
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition active:scale-[0.98]"
              >
                Complete Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingDashboard;
