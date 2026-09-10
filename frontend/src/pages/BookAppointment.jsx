import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import HeaderBar from '../components/HeaderBar';
import { FiCheckCircle } from 'react-icons/fi';
import { getLocalDateString } from '../utils/localDate';

export default function BookAppointment() {
  const [searchParams] = useSearchParams();
  const api = useApiClient();
  const { addToast } = useToast();
  
  const [bookingData, setBookingData] = useState({
    name: '',
    email: '',
    phone: '',
    preferred_date: '',
    appointment_time: '',
    appointment_type: 'online' // Default to online
  });
  
  const [existingPatient, setExistingPatient] = useState(null);
  const [checkingPatient, setCheckingPatient] = useState(false);
  const patientCheckTimeout = useRef(null);

  const [allTimeSlots, setAllTimeSlots] = useState([]);
  const [doctorAvailability, setDoctorAvailability] = useState([]);
  const [loadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const doctorParam = searchParams.get('doctor') || 1;

  const checkExistingPatient = useCallback(async (phone, name) => {
    if (!phone || phone.length < 10) {
      setExistingPatient(null);
      return;
    }
    setCheckingPatient(true);
    try {
      const res = await api.get('/api/qr/check-patient', {
        params: { phone, name: name || undefined }
      });
      setExistingPatient(res.data?.data?.found ? res.data.data : null);
    } catch {
      setExistingPatient(null);
    } finally {
      setCheckingPatient(false);
    }
  }, [api]);

  const handleBookingFieldChange = (field, value) => {
    const updated = { ...bookingData, [field]: value };
    setBookingData(updated);
    if (field === 'phone' || field === 'name') {
      clearTimeout(patientCheckTimeout.current);
      patientCheckTimeout.current = setTimeout(() => {
        checkExistingPatient(
          field === 'phone' ? value : updated.phone,
          field === 'name' ? value : updated.name
        );
      }, 600);
    }
  };

  // Fetch doctor slots when appointment type or date changes
  useEffect(() => {
    const fetchDoctorSettings = async () => {
      try {
        // Build query params
        const slotsParams = {
          appointment_type: bookingData.appointment_type
        };

        // If date is selected, include it to get only available slots
        if (bookingData.preferred_date) {
          slotsParams.date = bookingData.preferred_date;
        }

        const [slotsRes, availRes] = await Promise.all([
          api.get(`/api/doctor-availability/${doctorParam}/slots`, { params: slotsParams }),
          api.get(`/api/doctor-availability/${doctorParam}/availability`)
        ]);

        const slots = (slotsRes.data.slots || [])
          .filter(slot => slot.is_active)
          .map(slot => ({
            dbTime: slot.slot_time.substring(0, 5),
            displayTime: slot.display_time
          }));
        setAllTimeSlots(slots);
        setDoctorAvailability(availRes.data.availability || []);
      } catch (error) {
        console.error('Error fetching doctor settings:', error);
        // Fallback slots
        setAllTimeSlots([
          { dbTime: '12:15', displayTime: '12:15 PM' },
          { dbTime: '12:30', displayTime: '12:30 PM' },
          { dbTime: '12:45', displayTime: '12:45 PM' },
          { dbTime: '13:00', displayTime: '01:00 PM' },
          { dbTime: '18:00', displayTime: '06:00 PM' },
          { dbTime: '18:30', displayTime: '06:30 PM' },
          { dbTime: '19:00', displayTime: '07:00 PM' },
          { dbTime: '19:30', displayTime: '07:30 PM' },
          { dbTime: '20:00', displayTime: '08:00 PM' },
        ]);
      }
    };

    fetchDoctorSettings();
  }, [doctorParam, bookingData.appointment_type, bookingData.preferred_date, api]);

  // Note: Booked slots are now filtered by the backend API when fetching slots
  // No need for separate booked slots fetching

  const handleBookingSubmit = async (e) => {
    e.preventDefault();

    if (!bookingData.appointment_time) {
      addToast('Please select an appointment time', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/api/appointment-intents', {
        full_name: bookingData.name,
        phone: bookingData.phone,
        email: bookingData.email,
        speciality: 'Consultation',
        preferred_date: bookingData.preferred_date,
        preferred_time: bookingData.appointment_time,
        doctor_id: doctorParam,
        arrival_type: bookingData.appointment_type, // Send as arrival_type to backend
        appointment_type: bookingData.appointment_type,
        message: `${bookingData.appointment_type === 'online' ? 'Online' : 'Offline'} appointment request on ${bookingData.preferred_date} at ${bookingData.appointment_time}`,
        auto_create: true
      });
      
      addToast('Appointment booked successfully! You will receive a confirmation shortly.', 'success');
      setSubmitSuccess(true);
      
      // Clear form after 2 seconds
      setTimeout(() => {
        setBookingData({
          name: '',
          email: '',
          phone: '',
          preferred_date: '',
          appointment_time: '',
          appointment_type: 'online'
        });
        setSubmitSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Booking error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to book appointment';
      addToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Book an Appointment</h1>
          <p className="text-gray-600">Fill in your details and choose your preferred time slot</p>
        </div>

        {/* Success Message */}
        {submitSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-semibold">✅ Appointment booked successfully!</p>
            <p className="text-green-700 text-sm mt-1">Check your phone for confirmation details.</p>
          </div>
        )}

        {/* Booking Form */}
        <form onSubmit={handleBookingSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Existing Patient Banner */}
          {!checkingPatient && existingPatient?.found && (
            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-300 rounded-xl">
              <FiCheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-green-800">Existing Patient Found</p>
                <p className="text-green-700">{existingPatient.patient.name} • {existingPatient.patient.patient_id}</p>
                <p className="text-green-600 text-xs mt-0.5">Your existing record will be used — no duplicate will be created.</p>
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              required
              value={bookingData.name}
              onChange={e => handleBookingFieldChange('name', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition"
              placeholder="Enter your full name"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
            <input
              type="tel"
              required
              value={bookingData.phone}
              onChange={e => handleBookingFieldChange('phone', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition"
              placeholder="Enter your phone number"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email (optional)</label>
            <input
              type="email"
              value={bookingData.email}
              onChange={e => setBookingData({ ...bookingData, email: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition"
              placeholder="Enter your email"
            />
          </div>

          {/* Appointment Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Appointment Type *</label>
            <div className="flex gap-4">
              <label className="flex-1 relative">
                <input
                  type="radio"
                  name="appointment_type"
                  value="offline"
                  checked={bookingData.appointment_type === 'offline'}
                  onChange={e => setBookingData({
                    ...bookingData,
                    appointment_type: e.target.value,
                    appointment_time: '' // Reset time when type changes
                  })}
                  className="peer sr-only"
                />
                <div className="flex items-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl cursor-pointer transition peer-checked:border-blue-600 peer-checked:bg-blue-50">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 peer-checked:border-blue-600 peer-checked:bg-blue-600 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Offline</div>
                    <div className="text-xs text-gray-600">Visit clinic in person</div>
                  </div>
                </div>
              </label>

              <label className="flex-1 relative">
                <input
                  type="radio"
                  name="appointment_type"
                  value="online"
                  checked={bookingData.appointment_type === 'online'}
                  onChange={e => setBookingData({
                    ...bookingData,
                    appointment_type: e.target.value,
                    appointment_time: '' // Reset time when type changes
                  })}
                  className="peer sr-only"
                />
                <div className="flex items-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-xl cursor-pointer transition peer-checked:border-blue-600 peer-checked:bg-blue-50">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 peer-checked:border-blue-600 peer-checked:bg-blue-600 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Online</div>
                    <div className="text-xs text-gray-600">Video consultation</div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Preferred Date *</label>
            <input
              type="date"
              required
              min={getLocalDateString()}
              value={bookingData.preferred_date}
              onChange={(e) => {
                const selectedDate = new Date(e.target.value + 'T00:00:00');
                const dayOfWeek = selectedDate.getDay();
                const dayAvailability = doctorAvailability.find(d => d.day_of_week === dayOfWeek);
                
                if (dayAvailability && !dayAvailability.is_available) {
                  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
                  addToast(`Clinic is closed on ${dayName}s. Please select another date.`, 'error');
                  return;
                }
                
                setBookingData({ ...bookingData, preferred_date: e.target.value, appointment_time: '' });
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition"
            />
            <p className="text-xs text-gray-500 mt-1">Clinic is closed on Sundays</p>
          </div>

          {/* Time Slots */}
          {bookingData.preferred_date && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Time Slot *
                {loadingSlots && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
              </label>
              {allTimeSlots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl p-3">
                  {allTimeSlots.map((slot) => {
                    const isSelected = bookingData.appointment_time === slot.dbTime;

                    return (
                      <button
                        key={slot.dbTime}
                        type="button"
                        onClick={() => setBookingData({ ...bookingData, appointment_time: slot.dbTime })}
                        className={`
                          px-3 py-2 text-sm rounded-lg font-medium transition-all
                          ${isSelected
                            ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                            : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                          }
                        `}
                      >
                        {slot.displayTime}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-gray-200 rounded-xl">
                  <p className="text-gray-500">No available slots for this date.</p>
                  <p className="text-sm text-gray-400 mt-1">Please select a different date.</p>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-600 text-sm">
            Questions? Call us at <span className="font-semibold">+91 85303 45858</span>
          </p>
        </div>
      </div>
    </div>
  );
}
