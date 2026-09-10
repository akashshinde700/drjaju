import { useState, useEffect, useCallback } from 'react';
import HeaderBar from '../components/HeaderBar';
import BookAppointmentModal from '../components/appointments/BookAppointmentModal';
import EditAppointmentModal from '../components/appointments/EditAppointmentModal';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { FiPlus, FiCalendar, FiUser, FiClock, FiRepeat, FiSend, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { openWhatsApp } from '../utils/whatsapp';
import { cleanReasonForVisit } from '../utils/reasonForVisit';
import { getLocalDateString } from '../utils/localDate';

function formatTime(timeStr) {
  if (!timeStr) return '';
  const str = String(timeStr);
  const parts = str.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return str;

  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function Appointments() {
  const api = useApiClient();
  const { addToast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointments, setSelectedAppointments] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState('all'); // 'all', 'offline', or 'online'
  const [search, setSearch] = useState(''); // client-side filter over the loaded page
  const [page, setPage] = useState(1);
  // 100, not 20 — with the default (today onward, all statuses) filter, 20
  // was routinely eaten up entirely by today's own appointments, burying
  // anything booked for the next few days on page 2+ where it looked "missing".
  const [limit] = useState(100);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 100 });

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch appointments and show pending (not started) even if they are old/overdue
      const todayStr = getLocalDateString();
      // NOTE: the online/offline tabs are filtered CLIENT-side by `arrival_type`
      // (the source of truth). Passing `appointment_type` to the server here as
      // well filtered on a DIFFERENT column, so rows whose two type fields
      // disagreed were silently excluded before the client filter even ran.
      const res = await api.get(`/api/appointments?limit=${limit}&page=${page}&start_date=${todayStr}`);
      const allAppointments = res.data?.data?.data || res.data?.data?.appointments || res.data?.appointments || [];
      const serverPagination = res.data?.data?.pagination;
      if (serverPagination) {
        // Backend returns `totalPages`, not `pages` — reading the wrong key
        // silently fell back to 1 every time, so Prev/Next always looked maxed
        // out regardless of how many pages of appointments actually existed.
        setPagination({ ...serverPagination, pages: serverPagination.totalPages || serverPagination.pages || 1 });
      } else {
        setPagination({ page, pages: 1, total: Array.isArray(allAppointments) ? allAppointments.length : 0, limit });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pending = allAppointments
        .filter((apt) => {
          const status = (apt.status || '').toLowerCase();
          const started = Boolean(apt.visit_started_at);
          const ended = Boolean(apt.visit_ended_at);
          if (ended) return false;
          if (status === 'completed' || status === 'cancelled' || status === 'no-show') return false;
          if (started) return false;
          return status === 'scheduled' || status === 'confirmed' || status === 'in-progress';
        })
        .sort((a, b) => {
          const aDate = new Date(a.appointment_date);
          const bDate = new Date(b.appointment_date);
          aDate.setHours(0, 0, 0, 0);
          bDate.setHours(0, 0, 0, 0);

          const aGroup = aDate < today ? 0 : aDate > today ? 2 : 1;
          const bGroup = bDate < today ? 0 : bDate > today ? 2 : 1;
          if (aGroup !== bGroup) return aGroup - bGroup;

          const dateCompare = aDate - bDate;
          if (dateCompare !== 0) return dateCompare;

          const aTime = (a.appointment_time || '').split(':');
          const bTime = (b.appointment_time || '').split(':');
          const aMinutes = (parseInt(aTime[0]) || 0) * 60 + (parseInt(aTime[1]) || 0);
          const bMinutes = (parseInt(bTime[0]) || 0) * 60 + (parseInt(bTime[1]) || 0);
          return aMinutes - bMinutes;
        });

      setAppointments(pending);
      // Reset selection when appointments change
      setSelectedAppointments([]);
      setSelectAll(false);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    } finally {
      setLoading(false);
    }
  }, [api, limit, page]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Reset to page 1 ONLY when the type filter changes. Doing this inside the
  // fetch effect above broke pagination entirely: fetchAppointments depends on
  // `page`, so clicking Next re-ran that effect, which snapped page back to 1
  // before the user ever saw page 2.
  useEffect(() => {
    setPage(1);
  }, [appointmentTypeFilter]);

  const handleEditAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowEditModal(true);
  };

  // Handle individual appointment selection
  const handleSelectAppointment = (appointmentId) => {
    setSelectedAppointments(prev => 
      prev.includes(appointmentId) 
        ? prev.filter(id => id !== appointmentId)
        : [...prev, appointmentId]
    );
  };

  // Handle select all appointments
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedAppointments([]);
    } else {
      setSelectedAppointments(appointments.map(a => a.id));
    }
    setSelectAll(!selectAll);
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedAppointments.length === 0) {
      addToast('No appointments selected', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedAppointments.length} appointment(s)?`)) {
      return;
    }

    try {
      // Delete all selected appointments
      await Promise.all(
        selectedAppointments.map(id => api.delete(`/api/appointments/${id}`))
      );
      
      addToast(`Successfully deleted ${selectedAppointments.length} appointment(s)`, 'success');
      setSelectedAppointments([]);
      setSelectAll(false);
      fetchAppointments();
    } catch (error) {
      console.error('Failed to delete appointments:', error);
      addToast('Failed to delete some appointments', 'error');
    }
  };

  // Handle single appointment delete
  const handleDeleteAppointment = async (appointment) => {
    if (!window.confirm(`Are you sure you want to delete appointment for ${appointment.patient_name || 'this patient'}?`)) {
      return;
    }

    try {
      await api.delete(`/api/appointments/${appointment.id}`);
      addToast('Appointment deleted successfully', 'success');
      fetchAppointments();
    } catch (error) {
      console.error('Failed to delete appointment:', error);
      addToast('Failed to delete appointment: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  // Type filter (arrival_type is the source of truth) + text search, applied
  // client-side over the loaded page. Single definition used by both the list
  // rendering and CSV export so they can never disagree.
  const getType = (apt) => (apt.arrival_type === 'online' ? 'online' : 'offline');
  const visibleAppointments = appointments.filter((apt) => {
    if (appointmentTypeFilter !== 'all' && getType(apt) !== appointmentTypeFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (apt.patient_name || '').toLowerCase().includes(q) ||
      String(apt.patient_phone || apt.contact || '').includes(search.trim()) ||
      (apt.doctor_name || '').toLowerCase().includes(q) ||
      (apt.reason_for_visit || '').toLowerCase().includes(q)
    );
  });

  // Export the currently visible (filtered) appointments as CSV.
  const exportCSV = () => {
    if (!visibleAppointments.length) {
      addToast('Nothing to export', 'error');
      return;
    }
    const headers = ['Date', 'Time', 'Patient', 'Phone', 'Doctor', 'Type', 'Status', 'Reason'];
    const rows = visibleAppointments.map((a) => [
      a.appointment_date ? String(a.appointment_date).split('T')[0] : '',
      a.appointment_time || '',
      a.patient_name || '',
      a.patient_phone || a.contact || '',
      a.doctor_name || '',
      getType(a),
      a.status || '',
      cleanReasonForVisit(a.reason_for_visit) || ''
    ]);
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appointments_${getLocalDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendWhatsAppAppointment = (appointment) => {
    const phone = appointment.patient_phone || appointment.contact;
    if (!phone) {
      addToast('Patient phone number not available', 'error');
      return;
    }

    const appointmentDate = new Date(appointment.appointment_date);
    const formattedDate = appointmentDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const time = formatTime(appointment.appointment_time || appointment.slot_time);

    const message = `Hello ${appointment.patient_name},\n\nThis is a reminder about your appointment scheduled for:\n\n📅 Date: ${formattedDate}\n⏰ Time: ${time}\n👨‍⚕️ Doctor: Dr. ${appointment.doctor_name}\n\nPlease arrive 10 minutes early. If you need to reschedule, please contact us.\n\nThank you!\nOm Clinic And Diagnostic Center`;

    openWhatsApp(phone, message);
  };

  const _sendWhatsAppFollowUp = (patient) => {
    const phone = patient.contact || patient.phone || patient.patient_phone;
    if (!phone) {
      addToast('Patient phone number not available', 'error');
      return;
    }

    const followUpDate = new Date(patient.followup_date);
    const formattedFollowUpDate = followUpDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const message = `Hello ${patient.patient_name},\n\nThis is a reminder about your follow-up appointment scheduled for ${formattedFollowUpDate} with Dr. ${patient.doctor_name}.\n\nPlease confirm your availability or let us know if you need to reschedule.\n\nThank you!`;

    openWhatsApp(phone, message);
  };

  return (
    <div className="space-y-6">
      <HeaderBar title="Appointments" />

      <div className="bg-white border rounded shadow-sm p-3 sm:p-4 md:p-6">
        <>
            <div className="flex items-center justify-end gap-2 mb-3 flex-wrap">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patient, phone, doctor..."
                  autoComplete="off"
                  className="flex-1 min-w-[180px] max-w-xs px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition"
                  title="Export visible appointments to CSV"
                >
                  Export CSV
                </button>
                {selectedAppointments.length > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                    <span className="text-sm text-blue-800">
                      {selectedAppointments.length} selected
                    </span>
                    <button
                      onClick={handleBulkDelete}
                      className="px-2 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAppointments([]);
                        setSelectAll(false);
                      }}
                      className="px-2 py-1 bg-slate-600 text-white text-sm rounded hover:bg-slate-700"
                    >
                      Clear
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setShowBookModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-medium rounded-md shadow-sm hover:bg-primary/90 active:scale-[0.99] transition focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <FiPlus className="-ml-0.5" />
                  Book
                </button>
            </div>

            {/* Appointment Type Filter Tabs */}
            <div className="flex gap-2 mb-6 border-b">
              <button
                onClick={() => setAppointmentTypeFilter('all')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  appointmentTypeFilter === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                All Appointments
              </button>
              <button
                onClick={() => setAppointmentTypeFilter('offline')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  appointmentTypeFilter === 'offline'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Offline
              </button>
              <button
                onClick={() => setAppointmentTypeFilter('online')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  appointmentTypeFilter === 'online'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Online
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-slate-500">
                Showing page {pagination.page || page} of {pagination.pages || 1}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={(pagination.page || page) <= 1 || loading}
                  className={`px-3 py-1.5 text-xs rounded border transition ${
                    (pagination.page || page) <= 1 || loading
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min((pagination.pages || p + 1), p + 1))}
                  disabled={(pagination.page || page) >= (pagination.pages || 1) || loading}
                  className={`px-3 py-1.5 text-xs rounded border transition ${
                    (pagination.page || page) >= (pagination.pages || 1) || loading
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>

            {loading ? (
              <div className="px-4 py-8 text-center text-slate-500">
                Loading appointments...
              </div>
            ) : (() => {
                // Filtering (type + search) lives in visibleAppointments above,
                // shared with the CSV export.
                const filteredAppointments = visibleAppointments;

                return filteredAppointments.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-500">
                    {appointmentTypeFilter === 'all'
                      ? 'No upcoming appointments. Click "Book Appointment" to add one.'
                      : `No ${appointmentTypeFilter} appointments found.`}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      // Group appointments by date
                      const groupedByDate = filteredAppointments.reduce((groups, appointment) => {
                    const date = appointment.appointment_date;
                    if (!groups[date]) {
                      groups[date] = [];
                    }
                    groups[date].push(appointment);
                    return groups;
                  }, {});

                  return Object.entries(groupedByDate).map(([date, dateAppointments]) => {
                    const dateObj = new Date(date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);

                    let dateLabel;
                    if (dateObj.toDateString() === today.toDateString()) {
                      dateLabel = 'Today';
                    } else if (dateObj.toDateString() === tomorrow.toDateString()) {
                      dateLabel = 'Tomorrow';
                    } else {
                      dateLabel = dateObj.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });
                    }

                    return (
                      <div key={date} className="border rounded-lg overflow-hidden">
                        <div className="bg-primary/10 px-4 py-3 border-b">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectAll}
                              onChange={handleSelectAll}
                              className="rounded border-slate-300"
                            />
                            <FiCalendar className="text-primary" />
                            <h3 className="font-semibold text-primary">{dateLabel}</h3>
                            <span className="ml-auto text-sm text-slate-600">
                              {dateAppointments.length} appointment{dateAppointments.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-200">
                          {dateAppointments.map((appointment) => (
                            <div key={appointment.id} className="px-4 py-4 hover:bg-slate-50 transition">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedAppointments.includes(appointment.id)}
                                    onChange={() => handleSelectAppointment(appointment.id)}
                                    className="rounded border-slate-300 mt-1"
                                  />
                                </div>
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">PATIENT</div>
                                    <div className="flex items-center gap-2">
                                      <FiUser className="text-slate-400" size={14} />
                                      <span className="font-medium text-sm">{appointment.patient_name}</span>
                                    </div>
                                    {appointment.patient_phone && (
                                      <div className="text-xs text-slate-500 mt-1 font-mono">
                                        {appointment.patient_phone}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">DOCTOR</div>
                                    <div className="text-sm">Dr. {appointment.doctor_name}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">TIME</div>
                                    <div className="flex items-center gap-2">
                                      <FiClock className="text-slate-400" size={14} />
                                      <span className="text-sm font-medium">
                                        {formatTime(appointment.slot_time || appointment.appointment_time)}
                                      </span>
                                    </div>
                                    {/* Appointment Type Badge */}
                                    {appointment.arrival_type && (
                                      <div className="mt-1">
                                        <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                                          appointment.arrival_type === 'online'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-blue-100 text-blue-700'
                                        }`}>
                                          {appointment.arrival_type === 'online' ? '💻 Online' : '🏥 Offline'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 mb-1">STATUS</div>
                                    <span className={`inline-block px-2 py-1 text-xs rounded ${
                                      appointment.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                      appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                                      appointment.status === 'completed' ? 'bg-slate-100 text-slate-700' :
                                      'bg-orange-100 text-orange-700'
                                    }`}>
                                      {appointment.status}
                                    </span>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditAppointment(appointment)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"
                                    title="Edit Appointment"
                                  >
                                    <FiEdit2 size={12} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => sendWhatsAppAppointment(appointment)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100 transition"
                                    title="Send WhatsApp Reminder"
                                  >
                                    <FiSend size={12} />
                                    WhatsApp
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAppointment(appointment)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition"
                                    title="Delete Appointment"
                                  >
                                    <FiTrash2 size={12} />
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {cleanReasonForVisit(appointment.reason_for_visit) && (
                                <div className="mt-2 text-xs text-slate-600">
                                  Reason: {cleanReasonForVisit(appointment.reason_for_visit)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                    })()}
                  </div>
                );
              })()}
        </>
      </div>

      <BookAppointmentModal
        isOpen={showBookModal}
        onClose={() => setShowBookModal(false)}
        onSuccess={fetchAppointments}
      />

      <EditAppointmentModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
        onSuccess={fetchAppointments}
      />
    </div>
  );
}
