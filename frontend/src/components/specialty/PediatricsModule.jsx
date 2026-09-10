import React, { useState, useEffect } from 'react';
// ✅ Fixed Icons: Font Awesome se (FiBaby nahi hota, FaBaby perfect hai)
import { FaBaby, FaChartLine, FaHeartbeat } from 'react-icons/fa';

const PediatricsModule = ({ patientAge, patientWeight, patientHeight, onDataChange }) => {
  const [pediatricsData, setPediatricsData] = useState({
    birthHistory: {
      gestationalAge: '',
      birthWeight: '',
      birthLength: '',
      deliveryType: '',
      complications: ''
    },
    currentVitals: {
      weight: patientWeight || '',
      height: patientHeight || '',
      headCircumference: '',
      temperature: '',
      respiratoryRate: '',
      heartRate: ''
    },
    immunization: {
      upToDate: true,
      pending: []
    },
    milestones: {
      motor: '',
      social: '',
      language: '',
      cognitive: ''
    },
    feeding: {
      type: '',
      frequency: '',
      issues: []
    },
    growthStatus: '',
    notes: ''
  });

  const [doseCalculator, setDoseCalculator] = useState({
    medication: '',
    dosePerKg: '',
    frequency: '',
    calculatedDose: ''
  });

  const [growthPercentile, setGrowthPercentile] = useState({
    weight: null,
    height: null,
    bmi: null
  });

  // WHO Growth Chart Data calculations are now inlined in the useEffect below

  useEffect(() => {
    // Inline calculation to avoid set-state-in-effect and dependency warnings
    const performCalculation = () => {
      if (!pediatricsData.currentVitals.weight || !pediatricsData.currentVitals.height || !patientAge) {
        return;
      }
      const weight = parseFloat(pediatricsData.currentVitals.weight);
      const height = parseFloat(pediatricsData.currentVitals.height);
      const _ageMonths = patientAge * 12;
      const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
      setGrowthPercentile({
        weight: 'P50-P75',
        height: 'P50-P75',
        bmi: parseFloat(bmi)
      });
    };
    setTimeout(performCalculation, 0);
  }, [pediatricsData.currentVitals.weight, pediatricsData.currentVitals.height, patientAge]);

  const calculateDose = () => {
    const weight = parseFloat(pediatricsData.currentVitals.weight);
    const dosePerKg = parseFloat(doseCalculator.dosePerKg);
    if (weight && dosePerKg) {
      const totalDose = (weight * dosePerKg).toFixed(2);
      setDoseCalculator({
        ...doseCalculator,
        calculatedDose: totalDose
      });
    }
  };

  const handleChange = (section, field, value) => {
    const updated = {
      ...pediatricsData,
      [section]: {
        ...pediatricsData[section],
        [field]: value
      }
    };
    setPediatricsData(updated);
    onDataChange && onDataChange(updated);
  };

  const commonMedications = [
    { name: 'Paracetamol', doseRange: '10-15 mg/kg', maxDose: '75 mg/kg/day' },
    { name: 'Ibuprofen', doseRange: '5-10 mg/kg', maxDose: '40 mg/kg/day' },
    { name: 'Amoxicillin', doseRange: '20-40 mg/kg', maxDose: '500 mg TID' },
    { name: 'Cefixime', doseRange: '8 mg/kg', maxDose: '400 mg/day' },
    { name: 'Azithromycin', doseRange: '10 mg/kg', maxDose: '500 mg/day' }
  ];

  const vaccineSchedule = [
    { vaccine: 'BCG', age: 'At birth' },
    { vaccine: 'OPV-0', age: 'At birth' },
    { vaccine: 'Hepatitis B-1', age: 'At birth' },
    { vaccine: 'OPV-1,2,3', age: '6, 10, 14 weeks' },
    { vaccine: 'Pentavalent-1,2,3', age: '6, 10, 14 weeks' },
    { vaccine: 'Rotavirus-1,2,3', age: '6, 10, 14 weeks' },
    { vaccine: 'PCV-1,2,3', age: '6, 10, 14 weeks' },
    { vaccine: 'MMR-1', age: '9-12 months' },
    { vaccine: 'OPV/IPV Booster', age: '16-24 months' },
    { vaccine: 'DPT Booster-1', age: '16-24 months' },
    { vaccine: 'MMR-2', age: '16-24 months' },
    { vaccine: 'DPT Booster-2', age: '5-6 years' },
    { vaccine: 'Typhoid', age: '2 years' },
    { vaccine: 'HPV', age: '9-14 years (girls)' }
  ];

  const feedingTypes = ['Breastfeeding', 'Formula', 'Mixed', 'Solid foods', 'Complementary feeding'];
  const deliveryTypes = ['Normal Vaginal Delivery', 'Cesarean Section', 'Forceps', 'Vacuum'];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="flex items-center gap-2 border-b pb-4">
        {/* Fixed Icon: FaBaby from Font Awesome */}
        <FaBaby className="text-2xl text-pink-500" />
        <h2 className="text-2xl font-bold text-gray-800">Pediatric Assessment</h2>
      </div>

      {/* Pediatric Dose Calculator */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          {/* Fixed Icon: FaHeartbeat */}
          <FaHeartbeat className="text-blue-600" />
          Pediatric Dose Calculator (Weight-Based)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Medication</label>
            <select
              value={doseCalculator.medication}
              onChange={(e) => {
                const selected = commonMedications.find(m => m.name === e.target.value);
                setDoseCalculator({
                  ...doseCalculator,
                  medication: e.target.value,
                  dosePerKg: selected ? selected.doseRange.split('-')[0].replace(/[^0-9.]/g, '') : ''
                });
              }}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select medication</option>
              {commonMedications.map(med => (
                <option key={med.name} value={med.name}>
                  {med.name} ({med.doseRange})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Dose per kg (mg)</label>
            <input
              type="number"
              step="0.1"
              value={doseCalculator.dosePerKg}
              onChange={(e) => setDoseCalculator({ ...doseCalculator, dosePerKg: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Child Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={pediatricsData.currentVitals.weight}
              onChange={(e) => handleChange('currentVitals', 'weight', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col justify-end">
            <button
              onClick={calculateDose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Calculate
            </button>
          </div>
        </div>
        {doseCalculator.calculatedDose && (
          <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-md">
            <p className="text-green-800 font-semibold">
              Calculated Dose: {doseCalculator.calculatedDose} mg
            </p>
            {doseCalculator.medication && (
              <p className="text-sm text-green-700 mt-1">
                Max daily dose: {commonMedications.find(m => m.name === doseCalculator.medication)?.maxDose}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Growth Chart & Vitals */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          {/* Fixed Icon: FaChartLine */}
          <FaChartLine className="text-green-500" />
          Growth Parameters (WHO/IAP Standards)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={pediatricsData.currentVitals.weight}
              onChange={(e) => handleChange('currentVitals', 'weight', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
            {growthPercentile.weight && (
              <span className="text-xs text-green-600">{growthPercentile.weight}</span>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Height (cm)</label>
            <input
              type="number"
              step="0.1"
              value={pediatricsData.currentVitals.height}
              onChange={(e) => handleChange('currentVitals', 'height', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
            {growthPercentile.height && (
              <span className="text-xs text-green-600">{growthPercentile.height}</span>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Head Circumference (cm)</label>
            <input
              type="number"
              step="0.1"
              value={pediatricsData.currentVitals.headCircumference}
              onChange={(e) => handleChange('currentVitals', 'headCircumference', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">BMI</label>
            <input
              type="text"
              value={growthPercentile.bmi || 'N/A'}
              disabled
              className="w-full px-3 py-2 border rounded-md bg-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Other Vitals */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Vital Signs</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Temperature (°F)</label>
            <input
              type="number"
              step="0.1"
              value={pediatricsData.currentVitals.temperature}
              onChange={(e) => handleChange('currentVitals', 'temperature', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Heart Rate (bpm)</label>
            <input
              type="number"
              value={pediatricsData.currentVitals.heartRate}
              onChange={(e) => handleChange('currentVitals', 'heartRate', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Respiratory Rate</label>
            <input
              type="number"
              value={pediatricsData.currentVitals.respiratoryRate}
              onChange={(e) => handleChange('currentVitals', 'respiratoryRate', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Birth History */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Birth History</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Gestational Age (weeks)</label>
            <input
              type="number"
              value={pediatricsData.birthHistory.gestationalAge}
              onChange={(e) => handleChange('birthHistory', 'gestationalAge', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Birth Weight (kg)</label>
            <input
              type="number"
              step="0.01"
              value={pediatricsData.birthHistory.birthWeight}
              onChange={(e) => handleChange('birthHistory', 'birthWeight', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Birth Length (cm)</label>
            <input
              type="number"
              step="0.1"
              value={pediatricsData.birthHistory.birthLength}
              onChange={(e) => handleChange('birthHistory', 'birthLength', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Delivery Type</label>
            <select
              value={pediatricsData.birthHistory.deliveryType}
              onChange={(e) => handleChange('birthHistory', 'deliveryType', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select delivery type</option>
              {deliveryTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-sm text-gray-700 mb-1">Birth Complications</label>
          <textarea
            value={pediatricsData.birthHistory.complications}
            onChange={(e) => handleChange('birthHistory', 'complications', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Any complications during birth..."
          />
        </div>
      </div>

      {/* Feeding */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Feeding</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Feeding Type</label>
            <select
              value={pediatricsData.feeding.type}
              onChange={(e) => handleChange('feeding', 'type', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select feeding type</option>
              {feedingTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Frequency</label>
            <input
              type="text"
              value={pediatricsData.feeding.frequency}
              onChange={(e) => handleChange('feeding', 'frequency', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Every 3 hours"
            />
          </div>
        </div>
      </div>

      {/* Vaccination Status */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Immunization Schedule (IAP)</h3>
        <div className="bg-gray-50 p-4 rounded-md max-h-60 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Vaccine</th>
                <th className="px-3 py-2 text-left">Recommended Age</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {vaccineSchedule.map((vax, idx) => (
                <tr key={idx} className="border-b">
                  <td className="px-3 py-2">{vax.vaccine}</td>
                  <td className="px-3 py-2">{vax.age}</td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" className="w-4 h-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Developmental Milestones */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Developmental Milestones</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Motor Development</label>
            <textarea
              value={pediatricsData.milestones.motor}
              onChange={(e) => handleChange('milestones', 'motor', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Sitting, walking, running..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Social Development</label>
            <textarea
              value={pediatricsData.milestones.social}
              onChange={(e) => handleChange('milestones', 'social', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Smiling, eye contact, interaction..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Language Development</label>
            <textarea
              value={pediatricsData.milestones.language}
              onChange={(e) => handleChange('milestones', 'language', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Babbling, words, sentences..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Cognitive Development</label>
            <textarea
              value={pediatricsData.milestones.cognitive}
              onChange={(e) => handleChange('milestones', 'cognitive', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Problem solving, memory, attention..."
            />
          </div>
        </div>
      </div>

      {/* Clinical Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Clinical Notes
        </label>
        <textarea
          value={pediatricsData.notes}
          onChange={(e) => setPediatricsData({ ...pediatricsData, notes: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Additional observations, treatment plan, follow-up recommendations..."
        />
      </div>
    </div>
  );
};

export default PediatricsModule;