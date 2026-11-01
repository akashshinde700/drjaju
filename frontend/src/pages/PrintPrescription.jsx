import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { FiPrinter, FiDownload, FiShare2, FiMail, FiLink, FiX, FiCheck, FiCopy } from 'react-icons/fi';
import { FaWhatsapp, FaQrcode } from 'react-icons/fa';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';

const apiBase = (import.meta.env && import.meta.env.VITE_API_URL) || '';

const PrintPrescription = () => {
  const api = useApiClient();
  const { addToast } = useToast();
  const { prescriptionId } = useParams();
  const location = useLocation();
  const billId = new URLSearchParams(location.search).get('billId');

  const [prescription, setPrescription] = useState(null);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [shareOptions, setShareOptions] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [qrCodeModal, setQrCodeModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);

  // Fetch prescription and bill details
  const fetchData = useCallback(async () => {
    try {
      const [presRes, billRes] = await Promise.all([
        api.get(`/api/prescriptions/detail/${prescriptionId}`),
        billId ? api.get(`/api/bills/${billId}`) : Promise.resolve({ data: null })
      ]);

      if (presRes.data?.success || presRes.data?.prescription) {
        setPrescription(presRes.data.data || presRes.data.prescription);
      }
      if (billRes.data?.success) {
        setBill(billRes.data.data || billRes.data.bill);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [prescriptionId, billId]);

  // Print prescription
  const handlePrint = () => {
    setPrinting(true);
    window.print();
    setTimeout(() => setPrinting(false), 1000);
  };

  // Download PDF
  const downloadPDF = async () => {
    try {
      const params = new URLSearchParams({ with_letterhead: '1' });
      if (prescription?.template_id) params.set('template_id', String(prescription.template_id));
      const response = await api.get(`/api/pdf/prescription/${prescriptionId}?${params.toString()}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prescription_${prescriptionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      addToast('Failed to download PDF', 'error');
    }
  };

  // Share via WhatsApp. Reserve the popup synchronously so the follow-up API
  // request does not trigger the browser's popup blocker.
  const shareWhatsApp = async () => {
    const whatsAppWindow = window.open('', '_blank');
    if (!whatsAppWindow) {
      addToast('Allow pop-ups to open WhatsApp', 'error');
      return;
    }
    whatsAppWindow.opener = null;

    try {
      setSharing(true);
      const res = await api.post(`/api/prescriptions/${prescriptionId}/share`, {
        method: 'whatsapp',
        billId
      });
      if (res.data?.shareUrl) {
        whatsAppWindow.location.href = res.data.shareUrl;
      } else {
        whatsAppWindow.close();
      }
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      // Fallback - share the public PDF endpoint directly, with the saved letterhead.
      const params = new URLSearchParams({ with_letterhead: '1' });
      if (prescription?.template_id) params.set('template_id', String(prescription.template_id));
      const pdfUrl = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${encodeURIComponent(prescriptionId)}?${params.toString()}`;
      const message = encodeURIComponent(`View or download your prescription PDF with clinic letterhead: ${pdfUrl}`);
      whatsAppWindow.location.href = `https://wa.me/?text=${message}`;
    } finally {
      setSharing(false);
    }
  };

  // Email prescription
  const emailPrescription = async () => {
    try {
      const email = prompt('Enter email address:');
      if (email) {
        setSharing(true);
        const res = await api.post(`/api/prescriptions/${prescriptionId}/share`, {
          method: 'email',
          email,
          billId
        });
        if (res.data?.success) {
          addToast('Prescription sent successfully!', 'success');
        }
      }
    } catch (error) {
      console.error('Error emailing prescription:', error);
      addToast('Failed to send email. Please try again.', 'error');
    } finally {
      setSharing(false);
    }
  };

  // Copy link to clipboard
  const copyShareLink = async () => {
    try {
      const params = new URLSearchParams({ with_letterhead: '1' });
      if (prescription?.template_id) params.set('template_id', String(prescription.template_id));
      const shareLink = `${apiBase.replace(/\/$/, '')}/api/pdf/prescription/${encodeURIComponent(prescriptionId)}?${params.toString()}`;
      await navigator.clipboard.writeText(shareLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
      addToast('Failed to copy link', 'error');
    }
  };

  // Generate QR Code
  const showQRCode = async () => {
    try {
      setSharing(true);
      const res = await api.post(`/api/prescriptions/${prescriptionId}/share`, {
        method: 'qrcode'
      });
      if (res.data?.success) {
        setQrCodeData(res.data);
        setQrCodeModal(true);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      addToast('Failed to generate QR code', 'error');
    } finally {
      setSharing(false);
    }
  };

  // Get all share options
  const _openShareModal = async () => {
    try {
      setSharing(true);
      const res = await api.get(`/api/prescriptions/${prescriptionId}/share-options`);
      if (res.data?.success) {
        setShareOptions(res.data);
        setShareModal(true);
      }
    } catch (error) {
      console.error('Error fetching share options:', error);
      addToast('Failed to load sharing options', 'error');
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Prescription not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print Actions */}
      <div className="no-print bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h1 className="text-lg font-semibold">Prescription & Bill</h1>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePrint}
                disabled={printing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                <FiPrinter />
                {printing ? 'Printing...' : 'Print'}
              </button>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                <FiDownload />
                PDF
              </button>
              <button
                onClick={shareWhatsApp}
                disabled={sharing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                <FaWhatsapp />
                WhatsApp
              </button>
              <button
                onClick={emailPrescription}
                disabled={sharing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
              >
                <FiMail />
                Email
              </button>
              <button
                onClick={copyShareLink}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                {copySuccess ? <FiCheck /> : <FiCopy />}
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={showQRCode}
                disabled={sharing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
              >
                <FaQrcode />
                QR Code
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none print:rounded-none">
          {/* Header */}
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{prescription.clinic_name || 'Clinic'}</h1>
                <p className="text-gray-600">{prescription.clinic_address || '123 Medical Complex, Main Road'}</p>
                <p className="text-gray-600">Phone: {prescription.clinic_phone || '+91 1234567890'}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">
                  <p>Date: {new Date(prescription.prescribed_date || prescription.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  <p>Time: {new Date(prescription.prescribed_date || prescription.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                  <p className="text-xs mt-1">Rx #{prescriptionId}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Patient & Doctor Info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">PATIENT DETAILS</h3>
              <div className="space-y-1">
                <p><span className="font-medium">Name:</span> {prescription.patient_name || prescription.patient?.name}</p>
                <p><span className="font-medium">Age/Gender:</span> {prescription.age_years ?? prescription.patient?.age ?? 'N/A'}y, {prescription.gender || prescription.patient?.gender}</p>
                <p><span className="font-medium">Phone:</span> {prescription.patient_phone || prescription.patient?.phone}</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">DOCTOR DETAILS</h3>
              <div className="space-y-1">
                <p><span className="font-medium">Name:</span> Dr. {prescription.doctor_name || prescription.doctor?.name}</p>
                <p><span className="font-medium">Specialization:</span> {prescription.specialization || prescription.doctor?.specialization}</p>
                <p><span className="font-medium">Reg. No:</span> {prescription.registration_number || prescription.doctor?.registration_number}</p>
              </div>
            </div>
          </div>

          {/* Vitals */}
          {prescription.vitals && Object.keys(prescription.vitals).length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">VITALS</h3>
              <div className="grid grid-cols-4 gap-4 bg-gray-50 p-3 rounded">
                {prescription.vitals.temp && (
                  <div>
                    <span className="text-sm text-gray-600">Temperature:</span>
                    <span className="ml-2 font-medium">{prescription.vitals.temp}°F</span>
                  </div>
                )}
                {prescription.vitals.blood_pressure && (
                  <div>
                    <span className="text-sm text-gray-600">BP:</span>
                    <span className="ml-2 font-medium">{prescription.vitals.blood_pressure}</span>
                  </div>
                )}
                {prescription.vitals.pulse && (
                  <div>
                    <span className="text-sm text-gray-600">Pulse:</span>
                    <span className="ml-2 font-medium">{prescription.vitals.pulse}</span>
                  </div>
                )}
                {prescription.vitals.weight && (
                  <div>
                    <span className="text-sm text-gray-600">Weight:</span>
                    <span className="ml-2 font-medium">{prescription.vitals.weight}kg</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Symptoms */}
          {prescription.symptoms && prescription.symptoms.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">SYMPTOMS</h3>
              <div className="bg-gray-50 p-3 rounded">
                {Array.isArray(prescription.symptoms) ? prescription.symptoms.map((symptom, index) => (
                  <p key={index} className="mb-1">• {typeof symptom === 'string' ? symptom : symptom.name}</p>
                )) : <p>{prescription.symptoms}</p>}
              </div>
            </div>
          )}

          {/* Diagnosis */}
          {(prescription.diagnoses || prescription.diagnosis) && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">DIAGNOSIS</h3>
              <div className="bg-gray-50 p-3 rounded">
                {Array.isArray(prescription.diagnoses) ? prescription.diagnoses.map((diagnosis, index) => (
                  <p key={index} className="mb-1">• {typeof diagnosis === 'string' ? diagnosis : diagnosis.name || diagnosis.diagnosis_name}</p>
                )) : <p>{prescription.diagnosis}</p>}
              </div>
            </div>
          )}

          {/* Medicines */}
          {prescription.medicines && prescription.medicines.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">PRESCRIPTION (Rx)</h3>
              <div className="border border-gray-300 rounded">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">#</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Medicine</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Dosage</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Frequency</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescription.medicines.map((med, index) => (
                      <React.Fragment key={index}>
                        <tr className="border-t">
                          <td className="px-4 py-2 text-sm">{index + 1}</td>
                          <td className="px-4 py-2 text-sm font-medium">{med.name || med.brand || med.medicine_name}</td>
                          <td className="px-4 py-2 text-sm">{med.dosage || '-'}</td>
                          <td className="px-4 py-2 text-sm">{med.is_tapering ? 'Tapering' : (med.frequency || '-')}</td>
                          <td className="px-4 py-2 text-sm">{med.duration || '-'}</td>
                        </tr>
                        {med.is_tapering && med.tapering_schedule && med.tapering_schedule.length > 0 && (
                          <tr className="border-t bg-purple-50">
                            <td></td>
                            <td colSpan="4" className="px-4 py-1 text-xs text-purple-800">
                              <span className="font-semibold">Tapering: </span>
                              {med.tapering_schedule.map((step, si) => (
                                <span key={si}>
                                  {si > 0 && ' -> '}
                                  {step.dose} {step.frequency} for {step.duration_days} day{step.duration_days !== 1 ? 's' : ''}
                                </span>
                              ))}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Advice */}
          {prescription.advice && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">ADVICE</h3>
              <div className="bg-gray-50 p-3 rounded">
                <p>
                  {String(prescription.advice)
                    .split(/\r?\n+/)
                    .map(s => s.trim())
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            </div>
          )}

          {/* Follow-up */}
          {prescription.follow_up && (prescription.follow_up.days || prescription.follow_up.date) && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">FOLLOW-UP</h3>
              <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                {prescription.follow_up.days && (
                  <p className="font-medium">After {prescription.follow_up.days} days</p>
                )}
                {prescription.follow_up.date && (
                  <p>Date: {new Date(prescription.follow_up.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                )}
              </div>
            </div>
          )}

          {/* Bill Section */}
          {bill && (
            <div className="border-t-2 border-gray-800 pt-6 mt-6">
              <h3 className="font-semibold text-gray-900 mb-4">BILL DETAILS</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Consultation Fee:</span>
                  <span>₹{bill.consultation_fee || 0}</span>
                </div>
                {bill.medicine_total > 0 && (
                  <div className="flex justify-between">
                    <span>Medicine Charges:</span>
                    <span>₹{bill.medicine_total}</span>
                  </div>
                )}
                {bill.procedure_total > 0 && (
                  <div className="flex justify-between">
                    <span>Procedure Charges:</span>
                    <span>₹{bill.procedure_total}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total Amount:</span>
                  <span>₹{bill.total_amount || bill.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Status:</span>
                  <span className={`px-2 py-1 text-xs rounded ${
                    bill.payment_status === 'completed' || bill.payment_status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {bill.payment_status?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-center text-sm text-gray-600">
            <p>This is a computer-generated prescription.</p>
            <p>For any queries, please contact the hospital.</p>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {qrCodeModal && qrCodeData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Scan to View Prescription</h3>
              <button onClick={() => setQrCodeModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>
            <div className="flex flex-col items-center">
              <img src={qrCodeData.qrCode} alt="Prescription QR Code" className="w-64 h-64" />
              <p className="text-sm text-gray-500 mt-4 text-center">
                Scan this QR code to view the prescription on any device
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.download = `prescription-${prescriptionId}-qr.png`;
                    link.href = qrCodeData.qrCode;
                    link.click();
                  }}
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 flex items-center gap-2"
                >
                  <FiDownload /> Download QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && shareOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Share Prescription</h3>
              <button onClick={() => setShareModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>
            <div className="space-y-4">
              {/* WhatsApp */}
              <button
                onClick={() => window.open(shareOptions.sharing?.whatsapp?.url, '_blank')}
                className="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200"
              >
                <FaWhatsapp className="text-green-600 text-xl" />
                <span>Share via WhatsApp</span>
              </button>

              {/* Email */}
              <button
                onClick={emailPrescription}
                className="w-full flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200"
              >
                <FiMail className="text-purple-600 text-xl" />
                <span>Send via Email</span>
              </button>

              {/* Copy Link */}
              <button
                onClick={copyShareLink}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200"
              >
                <FiLink className="text-gray-600 text-xl" />
                <span>{copySuccess ? 'Link Copied!' : 'Copy Share Link'}</span>
              </button>

              {/* QR Code */}
              {shareOptions.sharing?.qrCode && (
                <div className="flex flex-col items-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <img src={shareOptions.sharing.qrCode} alt="QR Code" className="w-32 h-32" />
                  <p className="text-sm text-gray-500 mt-2">Scan to view prescription</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

export default PrintPrescription;
