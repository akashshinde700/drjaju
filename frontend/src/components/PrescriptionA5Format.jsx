import React, { forwardRef } from 'react';
import Letterhead from './Letterhead';

/**
 * A5 Prescription Format Component
 * Size: 148mm x 210mm (5.8" x 8.3")
 * Optimized for compact printing while maintaining readability
 */
const PrescriptionA5Format = forwardRef(({ prescriptionData, patientData, doctorData, clinicData }, ref) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div ref={ref} className="bg-white" style={{ width: '148mm', minHeight: '210mm' }}>
      {/* Wrapper with A5 specific styling */}
      <style>{`
        @media print {
          @page {
            size: A5;
            margin: 5mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        .a5-prescription {
          font-family: 'Arial', 'Helvetica', sans-serif;
          font-size: 9pt;
          line-height: 1.3;
        }
        .a5-prescription h1 {
          font-size: 14pt;
          margin-bottom: 2mm;
        }
        .a5-prescription h2 {
          font-size: 11pt;
          margin-bottom: 1.5mm;
          margin-top: 2mm;
        }
        .a5-prescription h3 {
          font-size: 10pt;
          margin-bottom: 1mm;
        }
        .a5-prescription .patient-info {
          font-size: 8.5pt;
        }
        .a5-prescription table {
          font-size: 8.5pt;
        }
      `}</style>

      <div className="a5-prescription p-3">
        {/* Letterhead - Compact version */}
        <div className="border-b-2 border-blue-600 pb-2 mb-2">
          <Letterhead compact={true} />
        </div>

        {/* Date and Prescription Number */}
        <div className="flex justify-between text-xs mb-2">
          <div>
            <strong>Date:</strong> {formatDate(prescriptionData?.date || new Date())}
          </div>
          {prescriptionData?.prescription_id && (
            <div>
              <strong>Rx No:</strong> {prescriptionData.prescription_id}
            </div>
          )}
        </div>

        {/* Patient Information - Compact */}
        <div className="patient-info bg-gray-100 p-2 rounded mb-2 text-xs">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div>
              <strong>Name:</strong> {patientData?.name || 'N/A'}
            </div>
            <div>
              <strong>Age/Sex:</strong> {patientData?.age || 'N/A'}/{patientData?.gender?.[0]?.toUpperCase() || 'N/A'}
            </div>
            <div>
              <strong>Phone:</strong> {patientData?.phone || 'N/A'}
            </div>
            {patientData?.patient_id && (
              <div>
                <strong>ID:</strong> {patientData.patient_id}
              </div>
            )}
          </div>
        </div>

        {/* Vitals - If available */}
        {prescriptionData?.vitals && Object.keys(prescriptionData.vitals).length > 0 && (
          <div className="mb-2 text-xs">
            <div className="flex flex-wrap gap-x-3">
              {prescriptionData.vitals.bp && (
                <span><strong>BP:</strong> {prescriptionData.vitals.bp}</span>
              )}
              {prescriptionData.vitals.pulse && (
                <span><strong>Pulse:</strong> {prescriptionData.vitals.pulse}</span>
              )}
              {prescriptionData.vitals.temp && (
                <span><strong>Temp:</strong> {prescriptionData.vitals.temp}</span>
              )}
              {prescriptionData.vitals.weight && (
                <span><strong>Wt:</strong> {prescriptionData.vitals.weight}</span>
              )}
            </div>
          </div>
        )}

        {/* Symptoms */}
        {prescriptionData?.symptoms && (
          <div className="mb-2">
            <h3 className="font-semibold text-gray-700 mb-1">C/O (Complaints)</h3>
            <p className="text-xs pl-2">{prescriptionData.symptoms}</p>
          </div>
        )}

        {/* Diagnosis */}
        {prescriptionData?.diagnosis && (
          <div className="mb-2">
            <h3 className="font-semibold text-gray-700 mb-1">Diagnosis</h3>
            <p className="text-xs pl-2">{prescriptionData.diagnosis}</p>
          </div>
        )}

        {/* Medications - Compact Table Format */}
        {prescriptionData?.medications && prescriptionData.medications.length > 0 && (
          <div className="mb-2">
            <h3 className="font-semibold text-gray-700 mb-1">Rx (Prescription)</h3>
            <table className="w-full border-collapse text-xs" style={{ border: '1px solid #64748b' }}>
              <thead>
                <tr className="border-b border-gray-500">
                  <th className="text-left py-1 pr-2" style={{ width: '5%' }}>#</th>
                  <th className="text-left py-1 pr-2" style={{ width: '25%' }}>Medicine</th>
                  <th className="text-left py-1 pr-2" style={{ width: '15%' }}>Frequency</th>
                  <th className="text-left py-1 pr-2" style={{ width: '20%' }}>Timing</th>
                  <th className="text-left py-1 pr-2" style={{ width: '15%' }}>Duration</th>
                  <th className="text-left py-1" style={{ width: '10%' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {prescriptionData.medications.map((med, idx) => (
                  <tr key={idx} className="border-b border-gray-400">
                    <td className="py-1 pr-2">{idx + 1}.</td>
                    <td className="py-1 pr-2">
                      <div className="font-medium">{med.name}</div>
                      {med.brand && <div className="text-xs text-gray-600">({med.brand})</div>}
                    </td>
                    <td className="py-1 pr-2">{med.frequency || '-'}</td>
                    <td className="py-1 pr-2">{med.timing || '-'}</td>
                    <td className="py-1 pr-2">{med.duration || '-'}</td>
                    <td className="py-1">{med.qty || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Lab Tests */}
        {prescriptionData?.lab_tests && prescriptionData.lab_tests.length > 0 && (
          <div className="mb-2">
            <h3 className="font-semibold text-gray-700 mb-1">Investigations</h3>
            <ul className="text-xs pl-4 list-disc">
              {(Array.isArray(prescriptionData.lab_tests)
                ? prescriptionData.lab_tests
                : prescriptionData.lab_tests.split(',')
              ).map((test, idx) => (
                <li key={idx}>{typeof test === 'string' ? test.trim() : test.name}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Advice */}
        {prescriptionData?.advice && (
          <div className="mb-2">
            <h3 className="font-semibold text-gray-700 mb-1">Advice</h3>
            <div className="text-xs pl-2">
              {Array.isArray(prescriptionData.advice) ? (
                <ul className="list-disc pl-4">
                  {prescriptionData.advice.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>{prescriptionData.advice}</p>
              )}
            </div>
          </div>
        )}

        {/* Follow-up */}
        {prescriptionData?.next_visit && (
          <div className="mb-2">
            <p className="text-xs">
              <strong>Follow-up:</strong> {formatDate(prescriptionData.next_visit)}
            </p>
          </div>
        )}

        {/* Footer with Doctor Signature */}
        <div className="mt-4 pt-2 border-t border-gray-300">
          <div className="flex justify-between items-end">
            <div className="text-xs text-gray-600">
              {prescriptionData?.notes && (
                <p><em>Note: {prescriptionData.notes}</em></p>
              )}
            </div>
            <div className="text-right">
              <div className="mb-1">
                {doctorData?.signature_url ? (
                  <img
                    src={doctorData.signature_url}
                    alt="Signature"
                    className="h-8 ml-auto"
                  />
                ) : (
                  <div className="h-8"></div>
                )}
              </div>
              <div className="border-t border-gray-400 pt-1">
                <p className="font-semibold text-xs">Dr. {doctorData?.name || 'Doctor Name'}</p>
                {doctorData?.qualifications && (
                  <p className="text-xs text-gray-600">{doctorData.qualifications}</p>
                )}
                {doctorData?.registration_number && (
                  <p className="text-xs text-gray-600">Reg. No: {doctorData.registration_number}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Clinic Footer */}
        {clinicData?.address && (
          <div className="mt-2 pt-2 border-t border-gray-200 text-center text-xs text-gray-600">
            <p>{clinicData.address}</p>
            {clinicData.phone && <p>Phone: {clinicData.phone}</p>}
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-2 text-center text-xs text-gray-500 italic">
          <p>This is a computer-generated prescription</p>
        </div>
      </div>
    </div>
  );
});

PrescriptionA5Format.displayName = 'PrescriptionA5Format';

export default PrescriptionA5Format;
