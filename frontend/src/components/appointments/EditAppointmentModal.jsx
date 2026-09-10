import { useState, useEffect, useCallback } from 'react';
import { FiCalendar, FiClock, FiX } from 'react-icons/fi';
import Modal from '../Modal';
import { useApiClient } from '../../api/client';
import { getLocalDateString } from '../../utils/localDate';

export default function EditAppointmentModal({ isOpen, onClose, appointment, onSuccess }) {
  const api = useApiClient();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Define fetchDoctors BEFORE useEffect that calls it
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/api/doctors');
      setDoctors(res?.data?.doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  }, [api]);

  useEffect(() => {
    if (appointment) {
      // Convert date to yyyy-MM-dd format
      const date = appointment?.appointment_date;
      if (date) {
        const dateObj = new Date(date);
        const formattedDate = dateObj.toISOString().split('T')[0];
        setSelectedDate(formattedDate);
      } else {
        setSelectedDate('');
      }

      setSelectedTime(appointment?.appointment_time || appointment?.slot_time || '');
      setReason(appointment?.reason_for_visit || '');
      setSelectedDoctorId(appointment?.doctor_id || '');
    }
  }, [appointment]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedDate || !selectedTime) {
      setError('Please select both date and time');
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        slot_time: selectedTime, // Also set slot_time
        reason_for_visit: reason,
        doctor_id: parseInt(selectedDoctorId, 10)
      };

      // console.log('Updating appointment:', appointment.id, updateData);

      await api.put(`/api/appointments/${appointment.id}`, updateData);

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error('Error updating appointment:', error);
      console.error('Error response:', error.response?.data);
      setError(error.response?.data?.message || error.response?.data?.error || 'Failed to update appointment');
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (!appointment) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Appointment">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        {/* Patient Info (Read-only) */}
        <div className="bg-slate-50 rounded p-4 border">
          <div className="text-xs text-slate-500 mb-1">PATIENT</div>
          <div className="font-medium">{appointment.patient_name}</div>
          <div className="text-sm text-slate-600 mt-1">{appointment.patient_phone}</div>
        </div>

        {/* Doctor Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Doctor
          </label>
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            required
          >
            <option value="">Select Doctor</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {doctor.name} - {doctor.specialty}
              </option>
            ))}
          </select>
        </div>

        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <FiCalendar className="inline mr-2" />
            Appointment Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={getLocalDateString()}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            required
          />
        </div>

        {/* Time Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <FiClock className="inline mr-2" />
            Appointment Time
          </label>
          <select
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            required
          >
            <option value="">Select Time</option>
            {generateTimeSlots().map((slot) => (
              <option key={slot} value={slot}>
                {formatTime(slot)}
              </option>
            ))}
          </select>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Reason for Visit
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
            placeholder="Brief description of the visit purpose"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Appointment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
