import { useEffect, useState, useCallback, Fragment, useRef } from 'react';
import DOMPurify from 'dompurify';
import Modal from '../components/Modal';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiSend, FiPrinter, FiTrash2, FiEye, FiDownload } from 'react-icons/fi';
import { openWhatsApp } from '../utils/whatsapp';
import { pickArray } from '../utils/apiResponse';
import { getLocalDateString } from '../utils/localDate';

const paymentMethods = [
  { label: 'Cash',                value: 'cash'          },
  { label: 'UPI / GPay',          value: 'upi'           },
  { label: 'Debit Card',          value: 'debit_card'    },
  { label: 'Credit Card',         value: 'credit_card'   },
  { label: 'Bank Transfer',       value: 'bank_transfer' },
  { label: 'Cash + UPI (Split)',  value: 'cash+upi'      },
  { label: 'Cash + Card (Split)', value: 'cash+card'     },
];

const TABS = [
  { key: 'pending', label: 'Pending', badge: 'bg-orange-100 text-orange-700' },
  { key: 'partial', label: 'Partial',  badge: 'bg-yellow-100 text-yellow-700' },
  { key: 'paid',    label: 'Paid',     badge: 'bg-green-100 text-green-700'  },
];

const getStatusBadge = (status) => {
  const map = {
    paid:      { label: 'Paid',      cls: 'bg-green-100 text-green-800' },
    completed: { label: 'Paid',      cls: 'bg-green-100 text-green-800' },
    partial:   { label: 'Partial',   cls: 'bg-yellow-100 text-yellow-800' },
    pending:   { label: 'Pending',   cls: 'bg-orange-100 text-orange-800' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-800' },
    overdue:   { label: 'Overdue',   cls: 'bg-red-100 text-red-800' },
  };
  return map[status] || { label: status || 'Pending', cls: 'bg-orange-100 text-orange-800' };
};

export default function Payments() {
  const api      = useApiClient();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [payments,      setPayments]      = useState([]);
  const [activeTab,     setActiveTab]     = useState('pending');
  const [tabCounts,     setTabCounts]     = useState({ paid: 0, partial: 0, pending: 0 });
  const [summary, setSummary] = useState({
    total: 0,
    paid: { count: 0, total: 0 },
    pending: { count: 0, total: 0 },
    partial: { count: 0, total: 0 },
    today: { count: 0, collected: 0, total: 0, paid: { count: 0, amount: 0 }, pending: { count: 0, amount: 0 }, partial: { count: 0, amount: 0 } },
    methods: { cash: 0, upi: 0, card: 0, bank: 0, other: 0 },
  });
  const [loading,       setLoading]       = useState(false);
  const [search,        setSearch]        = useState('');
  const [pagination,    setPagination]    = useState({ page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false });
  const [filters,       setFilters]       = useState({ service: '', dateRange: 'all' });
  const [customDate,    setCustomDate]    = useState({ start: '', end: '' });
  const [editingPayment,   setEditingPayment]   = useState(null);
  const [viewingReceipt,   setViewingReceipt]   = useState(null);
  // Letterhead toggle for bill print/download (default: false = no header/footer)
  const [billPrintLetterhead, setBillPrintLetterhead] = useState(false);
  const amountPaidRef = useRef(null);
  const [quickPayLoading, setQuickPayLoading] = useState(null); // bill id being processed
  const [partialInputs, setPartialInputs] = useState({}); // bill id → amount string

  /* ─── helpers ─────────────────────────────────────────────────── */
  const buildDateParams = (params) => {
    const { dateRange } = filters;
    if (dateRange === 'today') {
      const today = getLocalDateString();
      params.append('start_date', today);
      params.append('end_date', today);
    } else if (dateRange === 'last7days') {
      const end   = new Date();
      const start = new Date(); start.setDate(start.getDate() - 7);
      params.append('start_date', getLocalDateString(start));
      params.append('end_date',   getLocalDateString(end));
    } else if (dateRange === 'thisweek') {
      const now = new Date(); const day = now.getDay();
      const start = new Date(now); start.setDate(now.getDate() - day);
      const end   = new Date(now); end.setDate(now.getDate() - day + 6);
      params.append('start_date', getLocalDateString(start));
      params.append('end_date',   getLocalDateString(end));
    } else if (dateRange === 'thismonth') {
      const now = new Date();
      params.append('start_date', getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)));
      params.append('end_date',   getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (dateRange === 'custom' && customDate.start && customDate.end) {
      params.append('start_date', customDate.start);
      params.append('end_date',   customDate.end);
    }
  };

  /* ─── fetch ────────────────────────────────────────────────────── */
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page',           pagination.page);
      params.append('limit',          pagination.limit);
      params.append('payment_status', activeTab);
      params.append('_t',             Date.now());
      if (search)          params.append('search',  search);
      if (filters.service) params.append('service', filters.service);
      buildDateParams(params);

      const res   = await api.get(`/api/bills?${params}`);
      const bills = pickArray(res, ['data.data.bills', 'data.bills', 'bills']);
      setPayments(bills.map(b => ({ ...b, status: b.payment_status || b.status })));

      const pag = res?.data?.data?.pagination || res?.data?.pagination;
      if (pag) {
        const totalPages = pag.totalPages || pag.pages || 1;
        const pageNum    = pag.page || 1;
        setPagination(prev => ({
          ...prev,
          ...pag,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1,
        }));
      }
    } catch {
      addToast('Failed to load payments', 'error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, search, filters, customDate, activeTab, pagination.page, pagination.limit, addToast]);

  const fetchSummary = useCallback(async () => {
    try {
      // Scope the day cards to the SAME date the user selected (defaults to today).
      const dp = new URLSearchParams();
      buildDateParams(dp);
      const qp = new URLSearchParams({ _t: String(Date.now()) });
      if (dp.get('start_date')) qp.append('day_start', dp.get('start_date'));
      if (dp.get('end_date'))   qp.append('day_end',   dp.get('end_date'));
      const res = await api.get(`/api/bills/summary?${qp.toString()}`);
      const d   = res.data || {};
      const n   = (v) => parseFloat(v) || 0;
      setSummary({
        total: n(d.total_bills),
        paid:    { count: n(d.paid_count),    total: n(d.paid_amount)    },
        pending: { count: n(d.pending_count), total: n(d.pending_amount) },
        partial: { count: n(d.partial_count), total: n(d.partial_balance)},
        today: {
          count:     n(d.today_count),
          collected: n(d.today_collected),
          total:     n(d.today_total),
          paid:    { count: n(d.today_paid_count),    amount: n(d.today_paid_amount)    },
          pending: { count: n(d.today_pending_count), amount: n(d.today_pending_amount) },
          partial: { count: n(d.today_partial_count), amount: n(d.today_partial_balance)},
        },
        methods: {
          cash:  n(d.cash_amount),
          upi:   n(d.upi_amount),
          card:  n(d.card_amount),
          bank:  n(d.bank_amount),
          other: n(d.other_amount),
        },
      });
      setTabCounts({
        paid:    n(d.paid_count),
        partial: n(d.partial_count),
        pending: n(d.pending_count),
      });
    } catch { /* silent */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, filters, customDate]);

  useEffect(() => { fetchPayments(); fetchSummary(); }, [fetchPayments, fetchSummary]);

  /* ─── quick pay ──────────────────────────────────────────────── */
  const handleQuickPay = useCallback(async (bill, newStatus, partialAmt) => {
    const total = parseFloat(bill.total_amount || 0);
    const amtPaid = newStatus === 'paid' ? total
      : newStatus === 'partial' ? (parseFloat(partialAmt) || 0)
      : 0;
    setQuickPayLoading(bill.id);
    try {
      await api.patch(`/api/bills/${bill.id}/status`, {
        payment_status: newStatus,
        amount_paid: amtPaid,
      });
      setPartialInputs(prev => { const n = { ...prev }; delete n[bill.id]; return n; });
      addToast(newStatus === 'paid' ? `₹${total.toFixed(0)} marked as Paid` : newStatus === 'partial' ? `Partial ₹${amtPaid.toFixed(0)} recorded` : 'Set to Pending', 'success');
      fetchPayments();
      fetchSummary();
    } catch {
      addToast('Failed to update payment status', 'error');
    } finally {
      setQuickPayLoading(null);
    }
  }, [api, addToast, fetchPayments, fetchSummary]);

  /* ─── handlers ─────────────────────────────────────────────────── */
  const handleTabChange = (key) => {
    setActiveTab(key);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleViewReceipt = async (payment) => {
    try {
      const res     = await api.get(`/api/bills/${payment.id}`);
      const billData = res.data?.bill || res.data;
      setViewingReceipt(billData);
    } catch {
      addToast('Failed to view receipt', 'error');
    }
  };

  const _handleEditReceipt = (payment) => {
    navigate(`/receipts?edit=true&billId=${payment.id}`);
  };

  const handlePrintReceipt = async (payment, withLetterhead = false) => {
    try {
      const qs = withLetterhead ? '?with_letterhead=1' : '';
      const response = await api.get(`/api/pdf/bill/${payment.id}${qs}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url  = window.URL.createObjectURL(blob);
      const win  = window.open(url, '_blank');
      if (win) win.onload = () => win.print();
    } catch {
      addToast('Failed to print receipt', 'error');
    }
  };

  const handleSendReceipt = async (payment) => {
    if (!payment.patient_phone) { addToast('Patient phone number not available', 'error'); return; }
    try {
      const res = await api.get(`/api/bills/${payment.id}/whatsapp`);
      if (res.data?.success) {
        const phone   = (res.data.patient_phone || payment.patient_phone || '').replace(/\D/g, '');
        const message = res.data.whatsapp_message || `Hello ${payment.patient_name || ''}, here is your receipt. ${res.data.pdf_url || ''}`;
        openWhatsApp(phone, message);
        addToast('Opening WhatsApp...', 'success');
      } else {
        addToast('Failed to prepare WhatsApp message', 'error');
      }
    } catch {
      addToast('Failed to send receipt', 'error');
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this bill?')) return;
    try {
      await api.delete(`/api/bills/${paymentId}`);
      addToast('Bill deleted', 'success');
      fetchPayments(); fetchSummary();
    } catch {
      addToast('Failed to delete bill', 'error');
    }
  };

  const isSplitMethod = (m) => m === 'cash+upi' || m === 'cash+card';

  const handleSaveEdit = async () => {
    if (!editingPayment) return;
    try {
      const amountPaid = parseFloat(editingPayment.amount_paid) || 0;
      const totalAmt   = parseFloat(editingPayment.total_amount) || 0;
      const balanceDue = Math.max(0, totalAmt - amountPaid);
      const method     = editingPayment.payment_method;

      // Validate split amounts
      if (isSplitMethod(method)) {
        const cashSplit  = parseFloat(editingPayment.cash_split)  || 0;
        const otherSplit = parseFloat(editingPayment.other_split) || 0;
        if (cashSplit + otherSplit !== amountPaid) {
          addToast(`Cash (₹${cashSplit}) + ${method === 'cash+upi' ? 'UPI' : 'Card'} (₹${otherSplit}) must equal Amount Paid (₹${amountPaid})`, 'error');
          return;
        }
      }

      // Auto-derive status if not manually changed
      let status = editingPayment.payment_status;
      if (!status) {
        if (amountPaid >= totalAmt && totalAmt > 0) status = 'paid';
        else if (amountPaid > 0) status = 'partial';
        else status = 'pending';
      }

      const payload = {
        payment_status: status,
        payment_method: method,
        amount_paid:    amountPaid,
        balance_due:    balanceDue,
        total_amount:   totalAmt,
      };

      // Include split components for proper breakdown tracking
      if (isSplitMethod(method)) {
        payload.cash_component  = parseFloat(editingPayment.cash_split)  || 0;
        payload.other_component = parseFloat(editingPayment.other_split) || 0;
      }

      await api.put(`/api/bills/${editingPayment.id}`, payload);
      addToast('Bill updated successfully', 'success');
      setEditingPayment(null);
      fetchPayments(); fetchSummary();
    } catch {
      addToast('Failed to update bill', 'error');
    }
  };

  const handleDownloadReport = () => {
    addToast('Download report functionality coming soon', 'info');
  };

  /* ─── pagination helpers ────────────────────────────────────────── */
  const currentPage   = pagination.page;
  const totalPages    = pagination.totalPages || 1;

  return (
    <div className="space-y-4 pt-2">

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded shadow-sm border">
        <div className="flex border-b">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              {tab.label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${tab.badge}`}>
                {tabCounts[tab.key] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Today's Summary ──────────────────────────────────────── */}
      <section>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">{filters.dateRange === 'today' || filters.dateRange === 'all' ? 'Today' : (filters.dateRange === 'custom' && customDate.start ? (customDate.start === customDate.end ? customDate.start : `${customDate.start} → ${customDate.end}`) : 'Selected period')}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-white rounded shadow-sm border border-l-4 border-l-green-400">
            <p className="text-xs text-slate-500">Paid Today</p>
            <p className="text-xl font-bold text-green-600">₹{summary.today.paid.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-slate-400 mt-0.5">{summary.today.paid.count} bill{summary.today.paid.count !== 1 ? 's' : ''}</p>
          </div>
          <div className="p-3 bg-white rounded shadow-sm border border-l-4 border-l-orange-400">
            <p className="text-xs text-slate-500">Pending Today</p>
            <p className="text-xl font-bold text-orange-600">₹{summary.today.pending.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-slate-400 mt-0.5">{summary.today.pending.count} bill{summary.today.pending.count !== 1 ? 's' : ''}</p>
          </div>
          <div className="p-3 bg-white rounded shadow-sm border border-l-4 border-l-yellow-400">
            <p className="text-xs text-slate-500">Partial Today</p>
            <p className="text-xl font-bold text-yellow-600">₹{summary.today.partial.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-slate-400 mt-0.5">{summary.today.partial.count} bill{summary.today.partial.count !== 1 ? 's' : ''}</p>
          </div>
          <div className="p-3 bg-white rounded shadow-sm border border-l-4 border-l-blue-400">
            <p className="text-xs text-slate-500">Day Total (billed)</p>
            <p className="text-xl font-bold text-blue-600">₹{summary.today.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-slate-400 mt-0.5">{summary.today.count} bill{summary.today.count !== 1 ? 's' : ''} · ₹{summary.today.collected.toLocaleString('en-IN', { maximumFractionDigits: 0 })} collected</p>
          </div>
        </div>
      </section>

      {/* Overall summary cards removed as requested */}


      {/* ── Search & Filters ─────────────────────────────────────── */}
      <section className="bg-white rounded shadow-sm border p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by Name / Phone / UHID"
            className="flex-1 px-3 py-2 border rounded"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchPayments()}
            autoComplete="off"
          />
          <select
            className="px-3 py-2 border rounded"
            value={filters.dateRange}
            onChange={e => setFilters(f => ({ ...f, dateRange: e.target.value }))}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="last7days">Last 7 Days</option>
            <option value="thisweek">This Week</option>
            <option value="thismonth">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
          {/* Letterhead toggle for print */}
          <label className="flex items-center gap-1.5 px-3 py-2 border rounded bg-slate-50 cursor-pointer text-sm text-slate-700 select-none whitespace-nowrap" title="Include clinic header & footer when printing bill">
            <input
              type="checkbox"
              checked={billPrintLetterhead}
              onChange={e => setBillPrintLetterhead(e.target.checked)}
              className="cursor-pointer"
            />
            With Letterhead
          </label>
          <button
            onClick={handleDownloadReport}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 flex items-center gap-2"
          >
            <FiDownload /> Download
          </button>
        </div>
        {filters.dateRange === 'custom' && (
          <div className="flex gap-3">
            <input type="date" className="px-3 py-2 border rounded" value={customDate.start}
              onChange={e => setCustomDate(d => ({ ...d, start: e.target.value }))} />
            <input type="date" className="px-3 py-2 border rounded" value={customDate.end}
              onChange={e => setCustomDate(d => ({ ...d, end: e.target.value }))} />
          </div>
        )}
      </section>

      {/* ── Table ────────────────────────────────────────────────── */}
      <section className="bg-white rounded shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 w-12">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">PATIENT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">SERVICE</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">TOTAL</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">PAID</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">BALANCE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">DATE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">STATUS</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">QUICK PAY</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-4 py-10 text-center text-slate-400">Loading...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-10 text-center text-slate-400">
                    No {activeTab} bills found
                  </td>
                </tr>
              ) : (
                payments.map((p, idx) => {
                  const total   = parseFloat(p.total_amount || 0);
                  const paid    = parseFloat(p.amount_paid  || 0);
                  const balance = Math.max(0, total - paid);
                  const badge   = getStatusBadge(p.payment_status);
                  return (
                    <Fragment key={p.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {(pagination.page - 1) * pagination.limit + idx + 1}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-slate-800">{p.patient_name || 'N/A'}</div>
                          <div className="text-xs text-slate-400">{p.patient_uhid || p.patient_id || ''}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {p.service_name || 'Consultation'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-700">
                          ₹{paid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${balance > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                          ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {p.bill_date
                            ? new Date(p.bill_date).toLocaleDateString('en-IN')
                            : p.created_at
                              ? new Date(p.created_at).toLocaleDateString('en-IN')
                              : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        {/* Quick pay buttons */}
                        <td className="px-3 py-2">
                          {quickPayLoading === p.id ? (
                            <span className="text-xs text-slate-400">Saving…</span>
                          ) : p.payment_status === 'paid' ? (
                            <button
                              onClick={() => handleQuickPay(p, 'pending')}
                              className="px-2 py-1 text-xs text-slate-500 border border-slate-200 rounded hover:bg-slate-50"
                              title="Undo paid"
                            >Undo</button>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleQuickPay(p, 'paid')}
                                  className="px-2 py-1 text-xs font-semibold bg-green-50 border border-green-300 text-green-700 rounded hover:bg-green-100"
                                >✓ Full Paid</button>
                                <button
                                  onClick={() => setPartialInputs(prev => prev[p.id] !== undefined ? (({ [p.id]: _, ...rest }) => rest)(prev) : { ...prev, [p.id]: '' })}
                                  className="px-2 py-1 text-xs font-semibold bg-blue-50 border border-blue-300 text-blue-700 rounded hover:bg-blue-100"
                                >{partialInputs[p.id] !== undefined ? '✕' : 'Partial'}</button>
                              </div>
                              {partialInputs[p.id] !== undefined && (
                                <div className="flex gap-1 items-center">
                                  <input
                                    type="number"
                                    autoFocus
                                    placeholder={`of ₹${total.toFixed(0)}`}
                                    value={partialInputs[p.id]}
                                    onChange={e => setPartialInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleQuickPay(p, 'partial', partialInputs[p.id]);
                                      if (e.key === 'Escape') setPartialInputs(prev => (({ [p.id]: _, ...rest }) => rest)(prev));
                                    }}
                                    className="w-24 px-2 py-1 text-xs border rounded"
                                    min="0" max={total} step="1"
                                  />
                                  <button
                                    onClick={() => handleQuickPay(p, 'partial', partialInputs[p.id])}
                                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >Save</button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleViewReceipt(p)}
                              title="View"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <FiEye size={15} />
                            </button>
                            <button
                              onClick={() => setEditingPayment({
                                ...p,
                                amount_paid:    p.amount_paid    ?? '',
                                payment_status: p.payment_status ?? 'pending',
                                payment_method: p.payment_method ?? 'cash',
                              })}
                              title="Edit"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            >
                              <FiEdit2 size={15} />
                            </button>
                            <button
                              onClick={() => handlePrintReceipt(p, billPrintLetterhead)}
                              title={billPrintLetterhead ? 'Print with header/footer' : 'Print without header/footer'}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            >
                              <FiPrinter size={15} />
                            </button>
                            <button
                              onClick={() => handleSendReceipt(p)}
                              title="Send WhatsApp"
                              className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded"
                            >
                              <FiSend size={15} />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              title="Delete"
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ──────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t bg-slate-50 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">
                {(currentPage - 1) * pagination.limit + 1}–
                {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total}
              </span>
              <select
                value={pagination.limit}
                onChange={e => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
                className="px-2 py-1 border rounded text-xs"
              >
                {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={!pagination.hasPrev}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                className={`px-3 py-1 rounded border text-xs ${pagination.hasPrev ? 'hover:bg-slate-100' : 'opacity-40 cursor-not-allowed'}`}
              >
                Prev
              </button>
              <span className="px-2 text-slate-600">Page {currentPage} / {totalPages}</span>
              <button
                disabled={!pagination.hasNext}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                className={`px-3 py-1 rounded border text-xs ${pagination.hasNext ? 'hover:bg-slate-100' : 'opacity-40 cursor-not-allowed'}`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Edit Bill Modal ──────────────────────────────────────── */}
      {editingPayment && (
        <Modal
          isOpen={!!editingPayment}
          onClose={() => setEditingPayment(null)}
          title="Edit Bill"
        >
          <div className="space-y-4">
            {/* Patient info */}
            <div className="bg-slate-50 rounded p-3 text-sm">
              <p className="font-medium text-slate-800">{editingPayment.patient_name}</p>
              <p className="text-slate-500 text-xs">{editingPayment.patient_uhid || editingPayment.patient_id}</p>
              <p className="text-slate-500 text-xs mt-1">Service: {editingPayment.service_name || 'Consultation'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount (₹)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border rounded"
                value={editingPayment.total_amount || ''}
                onChange={e => setEditingPayment(ep => ({ ...ep, total_amount: e.target.value }))}
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount Paid (₹)</label>
              <input
                ref={amountPaidRef}
                type="number"
                className="w-full px-3 py-2 border rounded"
                value={editingPayment.amount_paid ?? ''}
                onChange={e => {
                  const paid  = parseFloat(e.target.value) || 0;
                  const total = parseFloat(editingPayment.total_amount) || 0;
                  let autoStatus = editingPayment.payment_status;
                  if (paid >= total && total > 0) autoStatus = 'paid';
                  else if (paid > 0) autoStatus = 'partial';
                  else autoStatus = 'pending';
                  setEditingPayment(ep => ({ ...ep, amount_paid: e.target.value, payment_status: autoStatus }));
                }}
                min="0"
                step="0.01"
              />
              {editingPayment.amount_paid !== '' && editingPayment.total_amount && (
                <p className="text-xs text-slate-500 mt-1">
                  Balance:{' '}
                  <span className="text-orange-600 font-medium">
                    ₹{Math.max(0, (parseFloat(editingPayment.total_amount) || 0) - (parseFloat(editingPayment.amount_paid) || 0)).toFixed(2)}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={editingPayment.payment_status || 'pending'}
                onChange={e => {
                  const val = e.target.value;
                  setEditingPayment(ep => {
                    const total = parseFloat(ep.total_amount) || 0;
                    let newAmt = parseFloat(ep.amount_paid) || 0;
                    if (val === 'paid') newAmt = total;
                    // keep partial as-is (user will enter amount in Amount Paid)
                    if (val === 'pending') newAmt = 0;
                    return { ...ep, payment_status: val, amount_paid: newAmt };
                  });
                  if (val === 'partial') {
                    // focus Amount Paid input so user can type the partial amount
                    setTimeout(() => amountPaidRef.current?.focus(), 0);
                  }
                }}
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
              <select
                className="w-full px-3 py-2 border rounded"
                value={editingPayment.payment_method || 'cash'}
                onChange={e => {
                  const method = e.target.value;
                  setEditingPayment(ep => {
                    const total = parseFloat(ep.total_amount) || 0;
                    let newAmountPaid = parseFloat(ep.amount_paid) || 0;
                    let cash_split = '';
                    let other_split = '';

                    // If method implies full payment, auto-mark paid and set amount_paid to total
                    const fullyPaidMethods = ['cash', 'upi', 'card', 'bank_transfer', 'insurance'];
                    if (fullyPaidMethods.includes(method)) {
                      newAmountPaid = total;
                    }

                    // For split methods, set defaults to half of paid/total
                    if (method === 'cash+upi' || method === 'cash+card' || method === 'cash+bank') {
                      const paid = newAmountPaid || total;
                      const half = +(paid / 2).toFixed(2);
                      cash_split = String(half);
                      other_split = String(+(paid - half).toFixed(2));
                      // if paid equals total, mark paid
                      if (paid >= total && total > 0) newAmountPaid = total;
                    }

                    // Decide new status based on newAmountPaid
                    let newStatus = ep.payment_status;
                    if (newAmountPaid >= total && total > 0) newStatus = 'paid';
                    else if (newAmountPaid > 0) newStatus = 'partial';
                    else newStatus = 'pending';

                    return { ...ep, payment_method: method, amount_paid: newAmountPaid, payment_status: newStatus, cash_split, other_split };
                  });
                }}
              >
                {paymentMethods.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Split amount fields for Cash+UPI / Cash+Card */}
            {isSplitMethod(editingPayment.payment_method) && (
              <div className="bg-slate-50 rounded p-3 space-y-3 border">
                <p className="text-xs text-slate-500 font-medium">
                  Enter split amounts (must total ₹{parseFloat(editingPayment.amount_paid) || 0})
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Cash Amount (₹)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="0"
                      value={editingPayment.cash_split ?? ''}
                      onChange={e => {
                        const cash = parseFloat(e.target.value) || 0;
                        const other = parseFloat(editingPayment.other_split) || 0;
                        const totalPaid = +(cash + other).toFixed(2);
                        setEditingPayment(ep => ({ ...ep, cash_split: e.target.value, amount_paid: totalPaid.toString() }));
                      }}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {editingPayment.payment_method === 'cash+upi' ? 'UPI Amount (₹)' : 'Card Amount (₹)'}
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="0"
                      value={editingPayment.other_split ?? ''}
                      onChange={e => {
                        const other = parseFloat(e.target.value) || 0;
                        const cash = parseFloat(editingPayment.cash_split) || 0;
                        const totalPaid = +(cash + other).toFixed(2);
                        setEditingPayment(ep => ({ ...ep, other_split: e.target.value, amount_paid: totalPaid.toString() }));
                      }}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                {editingPayment.cash_split !== '' && editingPayment.other_split !== '' && (
                  (() => {
                    const cash = parseFloat(editingPayment.cash_split) || 0;
                    const other = parseFloat(editingPayment.other_split) || 0;
                    const paid = parseFloat(editingPayment.amount_paid) || 0;
                    const sum = +(cash + other).toFixed(2);
                    const ok = Math.abs(sum - paid) < 0.01;
                    return (
                      <div>
                        <p className={`text-xs font-medium ${ok ? 'text-green-600' : 'text-red-600'}`}>
                          Total: ₹{sum.toFixed(2)}{' / '}Paid: ₹{paid.toFixed(2)}
                        </p>
                        {!ok && (
                          <p className="text-xs text-red-600 mt-1">Split amounts must equal Amount Paid.</p>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditingPayment(null)}
                className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={(() => {
                  if (!editingPayment) return true;
                  if (isSplitMethod(editingPayment.payment_method)) {
                    const cash = parseFloat(editingPayment.cash_split) || 0;
                    const other = parseFloat(editingPayment.other_split) || 0;
                    const paid = parseFloat(editingPayment.amount_paid) || 0;
                    return Math.abs((cash + other) - paid) >= 0.01;
                  }
                  return false;
                })()}
                className={`flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium ${
                  (isSplitMethod(editingPayment.payment_method) && Math.abs(((parseFloat(editingPayment.cash_split) || 0) + (parseFloat(editingPayment.other_split) || 0)) - (parseFloat(editingPayment.amount_paid) || 0)) >= 0.01)
                    ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── View Receipt Modal ───────────────────────────────────── */}
      {viewingReceipt && (
        <Modal
          isOpen={!!viewingReceipt}
          onClose={() => setViewingReceipt(null)}
          title="Receipt Preview"
        >
          <div className="space-y-5">
            {/* Clinic Header */}
            <div className="text-center border-b pb-4">
              {viewingReceipt.clinic_logo && (
                <img src={viewingReceipt.clinic_logo} alt="Clinic Logo" className="h-14 mx-auto mb-2" />
              )}
              <h2 className="text-lg font-bold">{viewingReceipt.clinic_name || 'Clinic'}</h2>
              <p className="text-xs text-slate-500">
                {[viewingReceipt.clinic_address, viewingReceipt.clinic_city, viewingReceipt.clinic_state, viewingReceipt.clinic_pincode]
                  .filter(Boolean).join(', ')}
              </p>
              <p className="text-xs text-slate-500">
                {viewingReceipt.clinic_phone && `Phone: ${viewingReceipt.clinic_phone}`}
                {viewingReceipt.clinic_email && ` | Email: ${viewingReceipt.clinic_email}`}
              </p>
            </div>

            {/* Patient & Receipt Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-slate-400 text-xs">Receipt No</p><p className="font-medium">#{viewingReceipt.id}</p></div>
              <div><p className="text-slate-400 text-xs">Date</p><p className="font-medium">{new Date(viewingReceipt.created_at || viewingReceipt.bill_date).toLocaleDateString('en-IN')}</p></div>
              <div><p className="text-slate-400 text-xs">Patient</p><p className="font-medium">{viewingReceipt.patient_name}</p></div>
              <div><p className="text-slate-400 text-xs">UHID</p><p className="font-medium">{viewingReceipt.patient_uhid || '—'}</p></div>
              {viewingReceipt.patient_phone && <div><p className="text-slate-400 text-xs">Phone</p><p className="font-medium">{viewingReceipt.patient_phone}</p></div>}
              {viewingReceipt.doctor_name   && <div><p className="text-slate-400 text-xs">Doctor</p><p className="font-medium">{viewingReceipt.doctor_name}</p></div>}
            </div>

            {/* Items */}
            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm mb-2">Payment Details</h3>
              {viewingReceipt.items?.length > 0 ? (
                <table className="w-full text-sm mb-3">
                  <thead>
                    <tr className="border-b text-slate-500 text-left">
                      <th className="py-1">Service</th>
                      <th className="py-1 text-center w-12">Qty</th>
                      <th className="py-1 text-right w-20">Rate</th>
                      <th className="py-1 text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingReceipt.items.map((item, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-1.5">{item.service_name || item.item_name || 'Service'}</td>
                        <td className="py-1.5 text-center">{item.quantity || 1}</td>
                        <td className="py-1.5 text-right">₹{Number(item.unit_price || 0).toFixed(2)}</td>
                        <td className="py-1.5 text-right">₹{Number(item.total_price || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">Service</span>
                  <span>{viewingReceipt.service_name || 'Consultation'}</span>
                </div>
              )}

              <div className="space-y-2 text-sm">
                {parseFloat(viewingReceipt.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-₹{Number(viewingReceipt.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                {parseFloat(viewingReceipt.tax_amount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>₹{Number(viewingReceipt.tax_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base border-t pt-2">
                  <span>Total</span>
                  <span>₹{Number(viewingReceipt.total_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid</span>
                  <span className="text-green-700 font-medium">₹{Number(viewingReceipt.amount_paid || 0).toFixed(2)}</span>
                </div>
                {parseFloat(viewingReceipt.balance_due || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Balance Due</span>
                    <span className="text-red-600 font-medium">₹{Number(viewingReceipt.balance_due).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Payment Method</span>
                  <span className="capitalize">{viewingReceipt.payment_method?.replace('_', ' ') || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Status</span>
                  <span className={`capitalize px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(viewingReceipt.payment_status).cls}`}>
                    {getStatusBadge(viewingReceipt.payment_status).label}
                  </span>
                </div>
              </div>
            </div>

            {(viewingReceipt.template_footer || viewingReceipt.notes) && (
              <div className="border-t pt-3 text-xs text-slate-500">
                {viewingReceipt.template_footer && <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewingReceipt.template_footer) }} />}
                {viewingReceipt.notes && <p>Notes: {viewingReceipt.notes}</p>}
              </div>
            )}

            <div className="flex gap-3 pt-3 border-t">
              <button onClick={() => handlePrintReceipt(viewingReceipt, billPrintLetterhead)}
                className="flex-1 px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 flex items-center justify-center gap-2 text-sm">
                <FiPrinter /> Print
              </button>
              <button onClick={() => handleSendReceipt(viewingReceipt)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2 text-sm">
                <FiSend /> Send
              </button>
              <button onClick={() => setViewingReceipt(null)}
                className="flex-1 px-4 py-2 border rounded hover:bg-slate-50 text-sm">
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
