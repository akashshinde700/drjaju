import React, { useState } from 'react';
import { FiHeart, FiActivity, FiAlertCircle } from 'react-icons/fi';

const CardiologyModule = ({ onDataChange }) => {
  const [cardiologyData, setCardiologyData] = useState({
    ecg: '',
    echo: '',
    bloodPressure: { systolic: '', diastolic: '' },
    heartRate: '',
    cholesterol: { total: '', ldl: '', hdl: '', triglycerides: '' },
    ejectionFraction: '',
    nyhaClass: '',
    medications: {
      betaBlocker: false,
      aceInhibitor: false,
      statin: false,
      antiplatelet: false,
      diuretic: false
    },
    riskFactors: {
      smoking: false,
      diabetes: false,
      hypertension: false,
      familyHistory: false,
      obesity: false
    },
    symptoms: [],
    notes: ''
  });

  const nyhaClassOptions = [
    { value: 'I', label: 'Class I - No limitation' },
    { value: 'II', label: 'Class II - Slight limitation' },
    { value: 'III', label: 'Class III - Marked limitation' },
    { value: 'IV', label: 'Class IV - Unable to carry on activity' }
  ];

  const commonSymptoms = [
    'Chest Pain', 'Dyspnea', 'Palpitations', 'Syncope',
    'Edema', 'Orthopnea', 'Fatigue', 'Dizziness'
  ];

  const handleChange = (field, value) => {
    const updated = { ...cardiologyData, [field]: value };
    setCardiologyData(updated);
    onDataChange && onDataChange(updated);
  };

  const toggleSymptom = (symptom) => {
    const symptoms = cardiologyData.symptoms.includes(symptom)
      ? cardiologyData.symptoms.filter(s => s !== symptom)
      : [...cardiologyData.symptoms, symptom];
    handleChange('symptoms', symptoms);
  };

  const toggleMedication = (med) => {
    handleChange('medications', {
      ...cardiologyData.medications,
      [med]: !cardiologyData.medications[med]
    });
  };

  const toggleRiskFactor = (factor) => {
    handleChange('riskFactors', {
      ...cardiologyData.riskFactors,
      [factor]: !cardiologyData.riskFactors[factor]
    });
  };

  const calculateFraminghamScore = () => {
    // Simplified Framingham risk calculation
    let score = 0;
    if (cardiologyData.riskFactors.smoking) score += 2;
    if (cardiologyData.riskFactors.diabetes) score += 2;
    if (cardiologyData.riskFactors.hypertension) score += 1;
    if (cardiologyData.riskFactors.familyHistory) score += 1;
    if (cardiologyData.riskFactors.obesity) score += 1;

    if (score === 0) return { level: 'Low', color: 'green' };
    if (score <= 3) return { level: 'Moderate', color: 'yellow' };
    return { level: 'High', color: 'red' };
  };

  const riskAssessment = calculateFraminghamScore();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="flex items-center gap-2 border-b pb-4">
        <FiHeart className="text-2xl text-red-500" />
        <h2 className="text-2xl font-bold text-gray-800">Cardiology Assessment</h2>
      </div>

      {/* Vital Signs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Blood Pressure (mmHg)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Systolic"
              value={cardiologyData.bloodPressure.systolic}
              onChange={(e) => handleChange('bloodPressure', {
                ...cardiologyData.bloodPressure,
                systolic: e.target.value
              })}
              className="w-1/2 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <span className="flex items-center">/</span>
            <input
              type="number"
              placeholder="Diastolic"
              value={cardiologyData.bloodPressure.diastolic}
              onChange={(e) => handleChange('bloodPressure', {
                ...cardiologyData.bloodPressure,
                diastolic: e.target.value
              })}
              className="w-1/2 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Heart Rate (bpm)
          </label>
          <input
            type="number"
            value={cardiologyData.heartRate}
            onChange={(e) => handleChange('heartRate', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ejection Fraction (%)
          </label>
          <input
            type="number"
            value={cardiologyData.ejectionFraction}
            onChange={(e) => handleChange('ejectionFraction', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Lipid Profile */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FiActivity className="text-blue-500" />
          Lipid Profile (mg/dL)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Total Cholesterol</label>
            <input
              type="number"
              value={cardiologyData.cholesterol.total}
              onChange={(e) => handleChange('cholesterol', {
                ...cardiologyData.cholesterol,
                total: e.target.value
              })}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">LDL</label>
            <input
              type="number"
              value={cardiologyData.cholesterol.ldl}
              onChange={(e) => handleChange('cholesterol', {
                ...cardiologyData.cholesterol,
                ldl: e.target.value
              })}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">HDL</label>
            <input
              type="number"
              value={cardiologyData.cholesterol.hdl}
              onChange={(e) => handleChange('cholesterol', {
                ...cardiologyData.cholesterol,
                hdl: e.target.value
              })}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Triglycerides</label>
            <input
              type="number"
              value={cardiologyData.cholesterol.triglycerides}
              onChange={(e) => handleChange('cholesterol', {
                ...cardiologyData.cholesterol,
                triglycerides: e.target.value
              })}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Symptoms */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Symptoms</h3>
        <div className="flex flex-wrap gap-2">
          {commonSymptoms.map(symptom => (
            <button
              key={symptom}
              onClick={() => toggleSymptom(symptom)}
              className={`px-4 py-2 rounded-full transition-colors ${
                cardiologyData.symptoms.includes(symptom)
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {symptom}
            </button>
          ))}
        </div>
      </div>

      {/* NYHA Classification */}
      <div>
        <h3 className="text-lg font-semibold mb-3">NYHA Functional Classification</h3>
        <select
          value={cardiologyData.nyhaClass}
          onChange={(e) => handleChange('nyhaClass', e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select NYHA Class</option>
          {nyhaClassOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Risk Factors */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FiAlertCircle className="text-orange-500" />
          Risk Factors
          <span className={`ml-auto px-3 py-1 rounded-full text-sm font-semibold bg-${riskAssessment.color}-100 text-${riskAssessment.color}-800`}>
            {riskAssessment.level} Risk
          </span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.keys(cardiologyData.riskFactors).map(factor => (
            <label key={factor} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cardiologyData.riskFactors[factor]}
                onChange={() => toggleRiskFactor(factor)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="capitalize">{factor.replace(/([A-Z])/g, ' $1').trim()}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Current Medications */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Current Cardiac Medications</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.keys(cardiologyData.medications).map(med => (
            <label key={med} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cardiologyData.medications[med]}
                onChange={() => toggleMedication(med)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="capitalize">{med.replace(/([A-Z])/g, ' $1').trim()}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Investigations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ECG Findings
          </label>
          <textarea
            value={cardiologyData.ecg}
            onChange={(e) => handleChange('ecg', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Normal sinus rhythm, HR 72 bpm..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ECHO Findings
          </label>
          <textarea
            value={cardiologyData.echo}
            onChange={(e) => handleChange('echo', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="LV function, valve status..."
          />
        </div>
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Clinical Notes
        </label>
        <textarea
          value={cardiologyData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Additional observations, treatment plan, follow-up recommendations..."
        />
      </div>
    </div>
  );
};

export default CardiologyModule;
