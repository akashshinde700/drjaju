import { useState } from 'react';
import Modal from './Modal';

const patientFields = [
  'Mail ID',
  'Blood Group',
  'Referred By',
  "Referred Doctor's Number",
  'Marital Status',
  'Name of Informant',
  'Channel',
  "Patient's Occupation",
  'Tag',
  'Patient Address',
  'City',
  'Pincode'
];

const historyFields = [
  'Alcohol',
  'Tobacco',
  'Allergies',
  'Asthma',
  'Cancer',
  'Diabetes',
  'Hypertension'
];

export default function ConfigurePatientModal({ open, onClose, onSave }) {
  const [tab, setTab] = useState('patient');
  const [selectedPatient, setSelectedPatient] = useState({});
  const [selectedHistory, setSelectedHistory] = useState({});

  const toggle = (group, setter) => (field) => {
    setter((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = () => {
    onSave({ patientFields: selectedPatient, historyFields: selectedHistory });
    onClose();
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Configure Add Patient">
      <div className="flex gap-2 mb-3">
        <button
          className={`px-3 py-2 text-sm rounded ${tab === 'patient' ? 'bg-primary text-white' : 'border'}`}
          onClick={() => setTab('patient')}
        >
          Patient
        </button>
        <button
          className={`px-3 py-2 text-sm rounded ${tab === 'history' ? 'bg-primary text-white' : 'border'}`}
          onClick={() => setTab('history')}
        >
          Medical History
        </button>
      </div>

      {tab === 'patient' && (
        <div className="grid md:grid-cols-2 gap-2">
          {patientFields.map((field) => (
            <label key={field} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!selectedPatient[field]}
                onChange={() => toggle('patient', setSelectedPatient)(field)}
              />
              {field}
            </label>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="grid md:grid-cols-2 gap-2">
          {historyFields.map((field) => (
            <label key={field} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!selectedHistory[field]}
                onChange={() => toggle('history', setSelectedHistory)(field)}
              />
              {field}
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button className="px-3 py-2 text-sm border rounded" onClick={onClose}>
          Cancel
        </button>
        <button className="px-3 py-2 text-sm bg-primary text-white rounded" onClick={handleSave}>
          Save
        </button>
      </div>
    </Modal>
  );
}

