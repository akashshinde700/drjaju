import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiUser, FiPhone, FiCalendar, FiClock, FiCheckCircle, FiAlertCircle, FiLoader, FiInfo } from 'react-icons/fi';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';

const QRCodeBooking = () => {
  const api = useApiClient();
  const { addToast } = useToast();
  const { doctorId } = useParams();
  const _navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingData, setBookingData] = useState({
    patientName: '',
    patientPhone: '',
    patientAge: '',
    patientGender: 'male',
    symptoms: '',
    preferredTime: ''
  });

  // Patient duplicate detection
  const [existingPatient, setExistingPatient] = useState(null);
  const [checkingPatient, setCheckingPatient] = useState(false);
  const patientCheckTimeout = useRef(null);

  // Fetch doctor info and availability
  const fetchDoctorInfo = useCallback(async () => {
    try {
      const [doctorRes, availabilityRes] = await Promise.all([
        api.get(`/api/qr/doctor/${doctorId}`),
        api.get(`/api/qr/availability/${doctorId}`)
      ]);

      if (doctorRes.data?.success && availabilityRes.data?.success) {
        setDoctor(doctorRes.data.data);
        setAvailability(availabilityRes.data.data);
      }
    } catch (error) {
      console.error('Error loading doctor info:', error);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  // Check for existing patient by phone + name (debounced)
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
  }, []);

  const handlePhoneOrNameChange = (field, value) => {
    setBookingData(prev => {
      const updated = { ...prev, [field]: value };
      // Debounce the patient check
      clearTimeout(patientCheckTimeout.current);
      patientCheckTimeout.current = setTimeout(() => {
        checkExistingPatient(updated.patientPhone, updated.patientName);
      }, 600);
      return updated;
    });
  };

  // Handle booking
  const handleBooking = async (e) => {
    e.preventDefault();
    setBooking(true);

    try {
      const symptoms = bookingData.symptoms.split(',').map(s => s.trim()).filter(s => s);

      const res = await api.post(`/api/qr/book/${doctorId}`, {
        ...bookingData,
        patientAge: parseInt(bookingData.patientAge),
        symptoms
      });

      if (res.data?.success) {
        setBookingSuccess(true);
        setBookingData(res.data.data);
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      addToast('Failed to book appointment. Please try again.', 'error');
    } finally {
      setBooking(false);
    }
  };

  useEffect(() => {
    fetchDoctorInfo();
  }, [fetchDoctorInfo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading doctor information...</p>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <FiAlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Doctor Not Found</h2>
          <p className="text-gray-600">The doctor you're looking for is not available.</p>
        </div>
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle className="w-10 h-10 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
          <p className="text-gray-600 mb-6">Your appointment has been successfully booked.</p>
          
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="text-2xl font-bold text-blue-900 mb-2">Token #{bookingData.tokenNumber}</div>
            <div className="text-sm text-blue-700">Please save this token number</div>
          </div>
          
          <div className="space-y-3 text-left bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-600">Patient:</span>
              <span className="font-medium">{bookingData.patientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Doctor:</span>
              <span className="font-medium">Dr. {bookingData.doctorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Specialization:</span>
              <span className="font-medium">{bookingData.specialization}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Est. Wait Time:</span>
              <span className="font-medium">{bookingData.estimatedWaitTime} mins</span>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            <p>Please arrive 10 minutes before your turn.</p>
            <p>Show this token number at the reception.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Quick Appointment Booking</h1>
            <div className="text-sm text-gray-600">
              Quick Booking System
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Doctor Info Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-4">
              <div className="text-center mb-4">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FiUser className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Dr. {doctor.name}</h2>
                <p className="text-gray-600">{doctor.specialization}</p>
              </div>

              {availability && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-green-700">Status</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      availability.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {availability.isAvailable ? 'Available' : 'Not Available'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-700">Today's Queue</span>
                    <span className="font-medium">{availability.todayQueueCount} patients</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="text-sm text-orange-700">Est. Wait Time</span>
                    <span className="font-medium">{availability.estimatedWaitTime} mins</span>
                  </div>
                </div>
              )}

              {!availability?.isAvailable && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-700">Doctor is not available for booking right now.</p>
                </div>
              )}
            </div>
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Book Your Appointment</h3>

              {/* Existing patient found banner */}
              {checkingPatient && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 mb-4">
                  <FiLoader className="w-4 h-4 animate-spin" />
                  Checking patient records...
                </div>
              )}
              {!checkingPatient && existingPatient?.found && (
                <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-300 rounded-lg mb-4">
                  <FiCheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-green-800">Existing Patient Found</p>
                    <p className="text-green-700">
                      {existingPatient.patient.name} &bull; {existingPatient.patient.patient_id}
                    </p>
                    <p className="text-green-600 text-xs mt-0.5">Your existing record will be used — no duplicate will be created.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleBooking} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FiUser className="inline w-4 h-4 mr-1" />
                      Patient Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={bookingData.patientName}
                      onChange={(e) => handlePhoneOrNameChange('patientName', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter patient name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FiPhone className="inline w-4 h-4 mr-1" />
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={bookingData.patientPhone}
                      onChange={(e) => handlePhoneOrNameChange('patientPhone', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Age *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="120"
                      value={bookingData.patientAge}
                      onChange={(e) => setBookingData(prev => ({ ...prev, patientAge: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter age"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender *
                    </label>
                    <select
                      required
                      value={bookingData.patientGender}
                      onChange={(e) => setBookingData(prev => ({ ...prev, patientGender: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Symptoms (comma separated)
                  </label>
                  <textarea
                    value={bookingData.symptoms}
                    onChange={(e) => setBookingData(prev => ({ ...prev, symptoms: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="e.g., fever, cough, headache"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiClock className="inline w-4 h-4 mr-1" />
                    Preferred Time (optional)
                  </label>
                  <input
                    type="time"
                    value={bookingData.preferredTime}
                    onChange={(e) => setBookingData(prev => ({ ...prev, preferredTime: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Important Information:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• You will receive a token number after booking</li>
                    <li>• Please arrive 10 minutes before your turn</li>
                    <li>• Bring your ID proof for verification</li>
                    <li>• Show your token number at the reception</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={booking || !availability?.isAvailable}
                  className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center"
                >
                  {booking ? (
                    <>
                      <FiLoader className="w-5 h-5 animate-spin mr-2" />
                      Booking...
                    </>
                  ) : (
                    'Book Appointment'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeBooking;
