import React, { useState } from 'react';
import { FiCopy, FiCheck, FiRefreshCw } from 'react-icons/fi';
import { useToast } from '../hooks/useToast';
import { useApiClient } from '../api/client';

const RepeatPrescriptionButton = ({ patientId, onRepeatSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastPrescription, setLastPrescription] = useState(null);
  const { addToast } = useToast();
  const api = useApiClient();

  const fetchLastPrescription = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/api/prescriptions/patient/${patientId}/last`);
      const payload = response.data;
      const rx = Array.isArray(payload)
        ? payload[0]
        : (payload?.prescription || payload?.data?.prescription || null);

      if (rx) {
        setLastPrescription(rx);
        setShowConfirm(true);
      } else {
        addToast('No previous prescription found for this patient', 'warning');
      }
    } catch (error) {
      console.error('Error fetching last prescription:', error);
      if (error.response?.status === 404) {
        addToast(error.response?.data?.message || 'No previous prescription found for this patient', 'warning');
      } else {
        addToast('Failed to fetch last prescription', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const repeatPrescription = async () => {
    if (!lastPrescription) return;

    setIsLoading(true);
    try {
      // Load last prescription into the current pad for editing.
      // Saving is handled by the main PrescriptionPad "Save" action.
      if (onRepeatSuccess) {
        onRepeatSuccess({ prescription: lastPrescription });
      }

      addToast('Last prescription loaded! Review and modify as needed.', 'success');
      setShowConfirm(false);
    } catch (error) {
      console.error('Error repeating prescription:', error);
      addToast('Failed to load last prescription', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const _calculateNextVisit = (previousNextVisit) => {
    // Calculate next visit based on the previous interval
    if (!previousNextVisit) return '';

    const prevDate = new Date(previousNextVisit);
    const today = new Date();
    const daysDiff = Math.round((prevDate - today) / (1000 * 60 * 60 * 24));

    // Use the same interval for the next visit
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + Math.abs(daysDiff));
    return nextDate.toISOString().split('T')[0];
  };

  return (
    <>
      <button
        onClick={fetchLastPrescription}
        disabled={isLoading || !patientId}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
          isLoading || !patientId
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-md hover:shadow-lg'
        }`}
        title="One-click repeat prescription from last visit"
      >
        {isLoading ? (
          <>
            <FiRefreshCw className="animate-spin" />
            <span>Loading...</span>
          </>
        ) : (
          <>
            <FiCopy />
            <span>Repeat Last Rx</span>
          </>
        )}
      </button>

      {/* Confirmation Modal */}
      {showConfirm && lastPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <FiCopy className="text-purple-600" />
                Repeat Last Prescription
              </h2>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Last prescription date:</strong>{' '}
                  {new Date(lastPrescription.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>

              {/* Preview of prescription to be repeated */}
              <div className="space-y-4 mb-6">
                {lastPrescription.symptoms && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Symptoms</h3>
                    <p className="text-sm bg-gray-50 p-3 rounded-md">
                      {Array.isArray(lastPrescription.symptoms)
                        ? lastPrescription.symptoms.map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean).join(', ')
                        : lastPrescription.symptoms}
                    </p>
                  </div>
                )}

                {lastPrescription.diagnosis && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Diagnosis</h3>
                    <p className="text-sm bg-gray-50 p-3 rounded-md">
                      {Array.isArray(lastPrescription.diagnosis)
                        ? lastPrescription.diagnosis.filter(Boolean).join(', ')
                        : lastPrescription.diagnosis}
                    </p>
                  </div>
                )}

                {lastPrescription.medications && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Medications</h3>
                    <div className="bg-gray-50 p-3 rounded-md">
                      {Array.isArray(lastPrescription.medications) ? (
                        <ul className="text-sm space-y-1">
                          {lastPrescription.medications.map((med, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <FiCheck className="text-green-600 mt-1 flex-shrink-0" />
                              <span>
                                {med.name} - {med.dosage} {med.frequency && `(${med.frequency})`}
                                {med.duration && ` - ${med.duration}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm">{lastPrescription.medications}</p>
                      )}
                    </div>
                  </div>
                )}

                {lastPrescription.lab_tests && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Lab Tests</h3>
                    <p className="text-sm bg-gray-50 p-3 rounded-md">{lastPrescription.lab_tests}</p>
                  </div>
                )}

                {lastPrescription.advice && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Advice</h3>
                    <p className="text-sm bg-gray-50 p-3 rounded-md">{lastPrescription.advice}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={repeatPrescription}
                  disabled={isLoading}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <FiRefreshCw className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <FiCheck />
                      <span>Confirm & Create</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RepeatPrescriptionButton;
