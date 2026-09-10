import { useEffect, useState, useCallback } from 'react';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import HeaderBar from '../components/HeaderBar';

export default function DoctorQRCode() {
  const api = useApiClient();
  const { addToast } = useToast();

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [_shareMethod, _setShareMethod] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Fetch doctors
  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/doctors');
      setDoctors(res.data.doctors || []);
    } catch (err) {
      addToast('Failed to fetch doctors', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, addToast]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Generate QR Code
  const handleGenerateQR = async (doctor) => {
    try {
      setLoading(true);
      const res = await api.post('/api/qr-code/doctor', {
        doctorId: doctor.id,
        doctorName: doctor.name,
        clinicId: doctor.clinic_id,
        clinicName: doctor.clinic_name
      });

      if (res.data.success) {
        setQrCode(res.data.data);
        setSelectedDoctor(doctor);
        setShowQRModal(true);
        addToast('QR code generated successfully', 'success');
      }
    } catch (err) {
      addToast('Failed to generate QR code', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Share via WhatsApp
  const handleShareWhatsApp = async () => {
    try {
      setLoading(true);
      const res = await api.post('/api/qr-code/whatsapp', {
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        clinicName: selectedDoctor.clinic_name
      });

      if (res.data.success) {
        const { whatsappLink } = res.data.data;
        window.open(whatsappLink, '_blank');
        addToast('Opening WhatsApp...', 'success');
      }
    } catch (err) {
      addToast('Failed to share via WhatsApp', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Share via Email
  const handleShareEmail = async () => {
    try {
      setLoading(true);
      const res = await api.post('/api/qr-code/email', {
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        clinicName: selectedDoctor.clinic_name
      });

      if (res.data.success) {
        const { emailSubject, emailBody } = res.data.data;
        const mailtoLink = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        window.location.href = mailtoLink;
        addToast('Opening email client...', 'success');
      }
    } catch (err) {
      addToast('Failed to share via email', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Copy Link
  const handleCopyLink = () => {
    if (qrCode?.bookingLink) {
      navigator.clipboard.writeText(qrCode.bookingLink);
      setCopySuccess(true);
      addToast('Link copied to clipboard', 'success');
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Download QR Code
  const handleDownloadQR = async () => {
    try {
      if (qrCode?.qrCodeUrl) {
        const link = document.createElement('a');
        link.href = qrCode.qrCodeUrl;
        link.download = `${selectedDoctor.name}_booking_qr.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast('QR code downloaded', 'success');
      }
    } catch (err) {
      addToast('Failed to download QR code', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <HeaderBar title="Doctor QR Code Management" />

      {/* Doctors List */}
      <div className="bg-white rounded shadow-sm border p-4">
        <h2 className="text-lg font-semibold mb-4">Doctors</h2>

        {loading && !doctors.length ? (
          <div className="text-center py-8 text-slate-500">Loading doctors...</div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No doctors found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map((doctor) => (
              <div key={doctor.id} className="border rounded-lg p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">Dr. {doctor.name}</h3>
                    <p className="text-sm text-slate-600">{doctor.specialization || 'General'}</p>
                    {doctor.clinic_name && (
                      <p className="text-xs text-slate-500 mt-1">📍 {doctor.clinic_name}</p>
                    )}
                  </div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg">
                    👨‍⚕️
                  </div>
                </div>

                <button
                  onClick={() => handleGenerateQR(doctor)}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50 text-sm font-medium"
                >
                  {loading ? 'Generating...' : 'Generate QR Code'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && qrCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Dr. {selectedDoctor.name} - Booking QR Code</h2>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* QR Code Display */}
              <div className="flex justify-center">
                <img
                  src={qrCode.qrCodeUrl}
                  alt="Doctor Booking QR Code"
                  className="w-64 h-64 border-2 border-slate-200 rounded"
                />
              </div>

              {/* Booking Link */}
              <div className="bg-slate-50 p-3 rounded">
                <p className="text-xs text-slate-600 mb-2">Booking Link:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={qrCode.bookingLink}
                    readOnly
                    className="flex-1 px-3 py-2 border rounded text-xs bg-white"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`px-3 py-2 rounded text-xs font-medium transition ${
                      copySuccess
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {copySuccess ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Share Options */}
              <div className="space-y-2">
                <button
                  onClick={handleShareWhatsApp}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Share via WhatsApp
                </button>

                <button
                  onClick={handleShareEmail}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Share via Email
                </button>

                <button
                  onClick={handleDownloadQR}
                  className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition text-sm font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download QR Code
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowQRModal(false)}
                className="w-full px-4 py-2 border rounded hover:bg-slate-50 transition text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
