/**
 * Public Prescription View Page
 * Accessible via shared links - no authentication required
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FiDownload, FiPrinter, FiPhone, FiMail, FiMapPin } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

const PrescriptionView = () => {
  const { prescriptionId } = useParams();
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPrescription = async () => {
      try {
        const response = await fetch(`/api/prescriptions/view/${prescriptionId}`);
        const data = await response.json();

        if (data.success) {
          setPrescription(data.prescription);
        } else {
          setError(data.error || 'Failed to load prescription');
        }
      } catch (err) {
        console.error('Error fetching prescription:', err);
        setError('Unable to load prescription. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPrescription();
  }, [prescriptionId]);

  const handlePrint = () => {
    window.print();
  };

  const downloadPDF = () => {
    window.open(`/api/pdf/prescription/${prescriptionId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading prescription...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <div className="text-red-500 text-6xl mb-4">!</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Prescription Not Found</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Action Bar */}
      <div className="no-print bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-800">
              Prescription
            </h1>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <FiPrinter /> Print
              </button>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                <FiDownload /> Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Prescription Content */}
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden print:shadow-none">
          {/* Clinic Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 print:bg-blue-600">
            <h1 className="text-2xl font-bold">{prescription.clinic_name || 'Medical Clinic'}</h1>
            <div className="mt-2 space-y-1 text-blue-100">
              {prescription.clinic_address && (
                <p className="flex items-center gap-2">
                  <FiMapPin size={14} /> {prescription.clinic_address}
                </p>
              )}
              {prescription.clinic_phone && (
                <p className="flex items-center gap-2">
                  <FiPhone size={14} /> {prescription.clinic_phone}
                </p>
              )}
              {prescription.clinic_email && (
                <p className="flex items-center gap-2">
                  <FiMail size={14} /> {prescription.clinic_email}
                </p>
              )}
            </div>
          </div>

          <div className="p-6">
            {/* Prescription Info */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b">
              <div>
                <p className="text-sm text-gray-500">Prescription #</p>
                <p className="font-mono font-bold text-lg">{prescriptionId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium">
                  {new Date(prescription.prescribed_date || prescription.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Patient & Doctor Details */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-3">Patient Details</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-600">Name:</span> <span className="font-medium">{prescription.patient_name}</span></p>
                  <p><span className="text-gray-600">Age/Gender:</span> <span className="font-medium">{prescription.age_years} years, {prescription.gender}</span></p>
                  {prescription.patient_phone && (
                    <p><span className="text-gray-600">Phone:</span> <span className="font-medium">{prescription.patient_phone}</span></p>
                  )}
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-3">Doctor Details</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-600">Name:</span> <span className="font-medium">Dr. {prescription.doctor_name}</span></p>
                  <p><span className="text-gray-600">Specialization:</span> <span className="font-medium">{prescription.specialization || 'General'}</span></p>
                  {prescription.registration_number && (
                    <p><span className="text-gray-600">Reg. No:</span> <span className="font-medium">{prescription.registration_number}</span></p>
                  )}
                </div>
              </div>
            </div>

            {/* Vitals */}
            {prescription.vitals && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Vitals</h3>
                <div className="flex flex-wrap gap-4">
                  {prescription.vitals.temp && (
                    <div className="bg-red-50 px-4 py-2 rounded-lg">
                      <p className="text-xs text-gray-500">Temperature</p>
                      <p className="font-bold text-red-600">{prescription.vitals.temp}°F</p>
                    </div>
                  )}
                  {prescription.vitals.blood_pressure && (
                    <div className="bg-purple-50 px-4 py-2 rounded-lg">
                      <p className="text-xs text-gray-500">Blood Pressure</p>
                      <p className="font-bold text-purple-600">{prescription.vitals.blood_pressure}</p>
                    </div>
                  )}
                  {prescription.vitals.pulse && (
                    <div className="bg-pink-50 px-4 py-2 rounded-lg">
                      <p className="text-xs text-gray-500">Pulse</p>
                      <p className="font-bold text-pink-600">{prescription.vitals.pulse} bpm</p>
                    </div>
                  )}
                  {prescription.vitals.weight && (
                    <div className="bg-orange-50 px-4 py-2 rounded-lg">
                      <p className="text-xs text-gray-500">Weight</p>
                      <p className="font-bold text-orange-600">{prescription.vitals.weight} kg</p>
                    </div>
                  )}
                  {prescription.vitals.spo2 && (
                    <div className="bg-cyan-50 px-4 py-2 rounded-lg">
                      <p className="text-xs text-gray-500">SpO2</p>
                      <p className="font-bold text-cyan-600">{prescription.vitals.spo2}%</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Diagnosis */}
            {prescription.diagnosis && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Diagnosis</h3>
                <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                  <p>{prescription.diagnosis}</p>
                </div>
              </div>
            )}

            {/* Medicines */}
            {prescription.medicines && prescription.medicines.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-2xl">℞</span> Medicines
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">#</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Medicine</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Dosage</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Frequency</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {prescription.medicines.map((med, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{index + 1}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{med.medicine_name || med.name}</p>
                            {med.generic_name && (
                              <p className="text-xs text-gray-500">{med.generic_name}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">{med.dosage || '-'}</td>
                          <td className="px-4 py-3 text-sm">{med.frequency || '-'}</td>
                          <td className="px-4 py-3 text-sm">{med.duration || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Advice */}
            {prescription.advice && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Doctor's Advice</h3>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="whitespace-pre-line">{prescription.advice}</p>
                </div>
              </div>
            )}

            {/* Follow-up */}
            {prescription.follow_up_date && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Follow-up</h3>
                <div className="bg-amber-50 p-4 rounded-lg border-l-4 border-amber-400">
                  <p className="font-medium">
                    {new Date(prescription.follow_up_date).toLocaleDateString('en-IN', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
              <p>This is a digitally generated prescription.</p>
              <p className="mt-1">For any queries, please contact the clinic.</p>
            </div>
          </div>
        </div>

        {/* Quick Contact */}
        {prescription.clinic_phone && (
          <div className="mt-4 flex justify-center gap-4 no-print">
            <a
              href={`tel:${prescription.clinic_phone}`}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              <FiPhone /> Call Clinic
            </a>
            <a
              href={`https://wa.me/${prescription.clinic_phone?.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              <FaWhatsapp /> WhatsApp
            </a>
          </div>
        )}
      </div>

      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PrescriptionView;
