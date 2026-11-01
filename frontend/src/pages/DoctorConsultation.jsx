import React, { useState, useEffect, useCallback } from 'react';
import { FiUser, FiCalendar, FiClock, FiDollarSign, FiFileText, FiCheck, FiPrinter, FiShare2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';

const apiBase = (import.meta.env && import.meta.env.VITE_API_URL) || '';

const DoctorConsultation = ({ visitId }) => {
  const api = useApiClient();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);
  const [prescriptionData, setPrescriptionData] = useState({
    symptoms: [],
    diagnoses: [],
    medicines: [],
    advice: '',
    followUp: { days: '', date: '', autoFill: false },
    vitals: {},
    procedures: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [bill, setBill] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: 'cash',
    amountPaid: 0
  });

  // Fetch visit details
  const fetchVisitDetails = useCallback(async () => {
    try {
      const res = await api.get(`/api/opd/visit/${visitId}`);
      if (res.data?.success) {
        setVisit(res.data.data?.visit || null);
        setPatient(res.data.data?.patient || null);
      }
    } catch (error) {
      console.error('Error fetching visit details:', error);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    fetchVisitDetails();
  }, [fetchVisitDetails]);

  // Handle completing consultation and generating bill
  const handleCompleteConsultation = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/api/opd/complete-consultation/${visitId}`, {
        ...prescriptionData,
        consultationFee: 500 // Default consultation fee
      });

      if (res.data?.success) {
        const billData = res.data.data || {};
        setBill({
          billId: billData.billId,
          prescriptionId: billData.prescriptionId,
          consultationFee: billData.consultationFee,
          medicineTotal: billData.medicineTotal,
          procedureTotal: billData.procedureTotal,
          totalAmount: billData.totalAmount,
          status: 'pending_payment'
        });
        setPaymentForm(prev => ({ ...prev, amountPaid: billData.totalAmount || 0 }));
        setShowBillModal(true);
        addToast('Consultation completed successfully!', 'success');
      }
    } catch (error) {
      console.error('Error completing consultation:', error);
      addToast('Failed to complete consultation', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Update payment
  const updatePayment = async () => {
    try {
      const res = await api.put(`/api/opd/update-payment/${bill.billId}`, {
        paymentStatus: 'completed',
        paymentMethod: paymentForm.paymentMethod,
        amountPaid: paymentForm.amountPaid
      });

      if (res.data?.success) {
        addToast('Payment completed successfully!', 'success');
        setShowBillModal(false);
        // Navigate to print view
        navigate(`/print-prescription/${bill.prescriptionId}?billId=${bill.billId}`);
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      addToast('Failed to update payment', 'error');
    }
  };

  // Print prescription
  const printPrescription = () => {
    if (bill?.prescriptionId) {
      window.open(`/print-prescription/${bill.prescriptionId}?billId=${bill.billId}`, '_blank');
    }
  };

  // Share the public PDF link so the patient receives the saved clinic letterhead.
  const sharePrescription = () => {
    if (!bill?.prescriptionId) return;
    if (!patient?.phone) {
      addToast('Patient phone number not available', 'error');
      return;
    }

    const pdfUrl = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${encodeURIComponent(bill.prescriptionId)}?with_letterhead=1`;
    const message = `Your prescription is ready. View or download the PDF with clinic letterhead: ${pdfUrl}`;
    const phone = String(patient.phone).replace(/\D/g, '');
    const formattedPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  useEffect(() => {
    fetchVisitDetails();
  }, [fetchVisitDetails]);

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
      <div className="bg-white rounded-lg shadow border p-6 mb-6">
        <div className="flex justify-between items-start">
          <div className="flex gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FiUser className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{patient?.name}</h1>
                <p className="text-gray-600">{patient?.age} years, {patient?.gender}</p>
                <p className="text-sm text-gray-500">{patient?.phone}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <FiCalendar className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Token Number</p>
                <p className="text-xl font-bold">#{visit?.token_number}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <FiClock className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Waiting Time</p>
                <p className="text-xl font-bold">{visit?.waiting_time || 0} min</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleCompleteConsultation}
            disabled={saving}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
          >
            <FiCheck />
            {saving ? 'Saving...' : 'Complete Consultation'}
          </button>
        </div>
      </div>

      {/* Consultation Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Medical Details */}
        <div className="space-y-6">
          {/* Vitals */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-lg font-semibold mb-4">Vitals</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (F)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={prescriptionData.vitals.temp || ''}
                  onChange={(e) => setPrescriptionData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, temp: e.target.value }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={prescriptionData.vitals.blood_pressure || ''}
                  onChange={(e) => setPrescriptionData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, blood_pressure: e.target.value }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pulse</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={prescriptionData.vitals.pulse || ''}
                  onChange={(e) => setPrescriptionData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, pulse: e.target.value }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={prescriptionData.vitals.weight || ''}
                  onChange={(e) => setPrescriptionData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, weight: e.target.value }
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Symptoms */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-lg font-semibold mb-4">Symptoms</h2>
            <textarea
              className="w-full px-3 py-2 border rounded-lg"
              rows={4}
              value={prescriptionData.symptoms.join('\n')}
              onChange={(e) => setPrescriptionData(prev => ({
                ...prev,
                symptoms: e.target.value.split('\n').filter(s => s.trim())
              }))}
              placeholder="Enter symptoms (one per line)"
            />
          </div>

          {/* Diagnosis */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-lg font-semibold mb-4">Diagnosis</h2>
            <textarea
              className="w-full px-3 py-2 border rounded-lg"
              rows={4}
              value={prescriptionData.diagnoses.join('\n')}
              onChange={(e) => setPrescriptionData(prev => ({
                ...prev,
                diagnoses: e.target.value.split('\n').filter(d => d.trim())
              }))}
              placeholder="Enter diagnosis (one per line)"
            />
          </div>
        </div>

        {/* Right Column - Treatment */}
        <div className="space-y-6">
          {/* Medicines */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-lg font-semibold mb-4">Medicines</h2>
            <textarea
              className="w-full px-3 py-2 border rounded-lg"
              rows={6}
              value={(prescriptionData.medicines || []).map(m => `${m.name} - ${m.dosage || ''} - ${m.frequency || ''} - ${m.duration || ''}`).join('\n')}
              onChange={(e) => {
                const lines = e.target.value.split('\n').filter(line => line.trim());
                const medicines = lines.map(line => {
                  const parts = line.split(' - ');
                  return {
                    name: parts[0] || '',
                    dosage: parts[1] || '',
                    frequency: parts[2] || '',
                    duration: parts[3] || ''
                  };
                });
                setPrescriptionData(prev => ({ ...prev, medicines }));
              }}
              placeholder="Enter medicines (one per line): Medicine Name - Dosage - Frequency - Duration"
            />
          </div>

          {/* Advice */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-lg font-semibold mb-4">Advice</h2>
            <textarea
              className="w-full px-3 py-2 border rounded-lg"
              rows={4}
              value={prescriptionData.advice}
              onChange={(e) => setPrescriptionData(prev => ({
                ...prev,
                advice: e.target.value
              }))}
              placeholder="Enter advice for patient"
            />
          </div>

          {/* Follow-up */}
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-lg font-semibold mb-4">Follow-up</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">After Days</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={prescriptionData.followUp.days}
                  onChange={(e) => setPrescriptionData(prev => ({
                    ...prev,
                    followUp: { ...prev.followUp, days: e.target.value }
                  }))}
                  placeholder="7"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={prescriptionData.followUp.date}
                  onChange={(e) => setPrescriptionData(prev => ({
                    ...prev,
                    followUp: { ...prev.followUp, date: e.target.value }
                  }))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bill Modal */}
      {showBillModal && bill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Bill Details</h2>
              <button
                onClick={() => setShowBillModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Consultation Fee:</span>
                  <span className="font-medium">₹{bill.consultationFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Medicines:</span>
                  <span className="font-medium">₹{bill.medicineTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Procedures:</span>
                  <span className="font-medium">₹{bill.procedureTotal}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total Amount:</span>
                    <span>₹{bill.totalAmount}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="insurance">Insurance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={paymentForm.amountPaid}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amountPaid: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowBillModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={updatePayment}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Complete Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {bill && (
        <div className="fixed bottom-6 right-6 flex gap-2">
          <button
            onClick={printPrescription}
            className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 shadow-lg"
          >
            <FiPrinter />
            Print
          </button>
          <button
            onClick={sharePrescription}
            className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 shadow-lg"
          >
            <FiShare2 />
            Share
          </button>
        </div>
      )}
    </div>
  );
};

export default DoctorConsultation;
