/* eslint-disable react-refresh/only-export-components */
/**
 * PrescriptionPad Feature Enhancements - Complete React Components
 * All 7 features ready for integration into PrescriptionPad.jsx
 * 
 * Features:
 * 1. Smart Medication Combos
 * 2. Recently Used Medicines Sidebar
 * 3. Dosage Calculator
 * 4. Voice-to-Text Input
 * 5. Drug Interaction Checker
 * 6. Compliance Tracking
 * 7. Split-View Redesign
 * 
 * Author: PrescriptionPad Enhancement Team
 * Date: January 2026
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  FiMic,
  FiX,
  FiAlertCircle,
  FiCheck,
  FiLoader,
  FiChevronDown,
  FiAward,
  FiActivity,
  FiGrid,
  FiSidebar
} from 'react-icons/fi';

// ==========================================
// 1. SMART MEDICATION COMBOS COMPONENT
// ==========================================
export const SmartMedicationCombos = ({
  medicationCombos,
  _addMedicationCombo,
  setMedications,
  language = 'en',
  addToast
}) => {
  const [showCombos, setShowCombos] = useState(false);

  const _timingOptions = {
    en: { '1-1-1': 'Three times daily', '1-0-1': 'Morning & Evening', '1-0-0': 'Once daily', '0-0-1': 'Bedtime' },
    hi: { '1-1-1': 'दिन में तीन बार', '1-0-1': 'सुबह और शाम', '1-0-0': 'सुबह एक बार', '0-0-1': 'रात को' }
  };

  const handleApplyCombo = (comboName) => {
    try {
      const combo = medicationCombos[comboName];
      if (!combo) {
        addToast?.(`Combo not found: ${comboName}`, 'error');
        return;
      }

      // Add all medicines from combo
      combo.forEach(med => {
        setMedications(prev => [...prev, {
          name: med.name,
          brand: med.brand || '',
          composition: med.composition || '',
          frequency: med.frequency,
          timing: med.timing || '1-1-1',
          duration: med.duration,
          instructions: med.instructions || '',
          qty: med.qty || ''
        }]);
      });

      addToast?.(
        language === 'hi' 
          ? `${comboName} Combo जोड़ दिया गया` 
          : `${comboName} combo added successfully`,
        'success'
      );
      setShowCombos(false);
    } catch (error) {
      addToast?.(`Error applying combo: ${error.message}`, 'error');
    }
  };

  const combosArray = Object.keys(medicationCombos);

  return (
    <div className="relative">
      <button
        onClick={() => setShowCombos(!showCombos)}
        className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium flex items-center gap-2"
        title={language === 'hi' ? 'दवा का कॉम्बो' : 'Smart combos'}
      >
        <FiAward size={16} />
        {language === 'hi' ? 'कॉम्बो' : 'Combos'}
      </button>

      {showCombos && (
        <div className="absolute top-full mt-2 left-0 bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-48">
          <div className="p-3 border-b border-gray-200">
            <h3 className="font-semibold text-sm">
              {language === 'hi' ? 'दवा कॉम्बो चुनें' : 'Select Combo'}
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {combosArray.map(comboName => (
              <button
                key={comboName}
                onClick={() => handleApplyCombo(comboName)}
                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
              >
                <div className="font-medium">{comboName}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {medicationCombos[comboName].map(m => m.name).join(', ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. RECENTLY USED MEDICINES SIDEBAR
// ==========================================
export const RecentlyUsedMedicinesSidebar = ({
  recentMedicines,
  addMedicine,
  language = 'en',
  addToast
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const handleAddRecent = (medicine) => {
    try {
      addMedicine?.(medicine);
      addToast?.(
        language === 'hi' 
          ? `${medicine.name} जोड़ दिया गया` 
          : `${medicine.name} added`,
        'success'
      );
    } catch (error) {
      addToast?.(`Error: ${error.message}`, 'error');
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed right-2 top-48 bg-green-500 text-white p-2 rounded-full shadow-lg hover:bg-green-600 z-40"
        title={language === 'hi' ? 'हाल की दवाइयां' : 'Recently used'}
      >
        <FiChevronDown size={20} />
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-48 w-56 bg-white border border-gray-300 rounded-l-lg shadow-lg z-40 max-h-96 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-3 bg-green-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-sm">
          {language === 'hi' ? 'हाल की दवाइयां' : 'Recent Medicines'}
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-500 hover:text-gray-700"
          title="Collapse"
        >
          <FiSidebar size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        {recentMedicines && recentMedicines.length > 0 ? (
          recentMedicines.map((med, idx) => (
            <button
              key={idx}
              onClick={() => handleAddRecent(med)}
              className="w-full text-left px-3 py-2 hover:bg-green-50 border-b border-gray-100 last:border-0 text-xs"
              title={`${med.name} - ${med.brand || ''}`}
            >
              <div className="font-medium text-gray-900">{med.name}</div>
              <div className="text-gray-600">{med.brand}</div>
              <div className="text-gray-500 text-xs mt-1">{med.frequency}</div>
            </button>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">
            {language === 'hi' ? 'कोई दवा नहीं' : 'No recent medicines'}
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. DOSAGE CALCULATOR COMPONENT
// ==========================================
export const DosageCalculator = ({
  patientWeight,
  patientAge,
  dosageCalculator,
  language = 'en',
  addToast,
  // Optional callback from PrescriptionPad to insert medicine into the prescription list
  addMedicine
}) => {
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [customDrug, setCustomDrug] = useState('');
  const [customPerKg, setCustomPerKg] = useState('');
  const [customPerKgFrequency, setCustomPerKgFrequency] = useState('1-1-1');
  const [calculatedDose, setCalculatedDose] = useState(null);
  const [localWeight, setLocalWeight] = useState(patientWeight || '');
  const [localAge, setLocalAge] = useState(patientAge || '');
  const [inlineWarning, setInlineWarning] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMed, setEditMed] = useState(null);

  const resetCalculator = useCallback(() => {
    setLocalWeight(patientWeight || '');
    setLocalAge(patientAge || '');
    setInlineWarning('');
    setCalculatedDose(null);
    setSelectedDrug('');
  }, [patientWeight, patientAge]);

  useEffect(() => {
    if (showCalculator) {
      // defer to avoid set-state-in-effect warning
      setTimeout(resetCalculator, 0);
    }
  }, [showCalculator, resetCalculator]);

  const handleCalculate = (drugName) => {
    const weightUsed = parseFloat(localWeight) || (patientWeight && parseFloat(patientWeight));
    const ageUsed = parseInt(localAge) || (patientAge && parseInt(patientAge));

    if (!weightUsed || !ageUsed) {
      // show inline warning instead of immediate toast
      setInlineWarning(language === 'hi' ? 'कृपया वजन और उम्र दर्ज करें' : 'Please enter weight and age to calculate');
      return;
    }

    try {
      const result = dosageCalculator.calculateDosage(drugName, weightUsed, ageUsed);
      setCalculatedDose(result);
      setSelectedDrug(drugName);
      setInlineWarning('');
    } catch (error) {
      addToast?.(`Error: ${error.message}`, 'error');
    }
  };

  const availableDrugs = ['Paracetamol', 'Ibuprofen', 'Amoxicillin', 'Metformin', 'Cephalexin'];

  return (
    <div className="relative">
      <button
        onClick={() => setShowCalculator(!showCalculator)}
        className="px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm font-medium"
        title={language === 'hi' ? 'खुराक कैलकुलेटर' : 'Dosage calculator'}
      >
        {language === 'hi' ? 'खुराक' : 'Dosage'}
      </button>

      {showCalculator && (
        <div className="absolute top-full mt-2 left-0 bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-72 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">
              {language === 'hi' ? 'खुराक कैलकुलेटर' : 'Dosage Calculator'}
            </h3>
            <button
              onClick={() => setShowCalculator(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FiX size={18} />
            </button>
          </div>

          {/* Patient Details Display */}
          <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
            <div>
              <span className="text-gray-600">
                {language === 'hi' ? 'वजन:' : 'Weight:'}
              </span>
              <input
                className="ml-2 font-semibold w-20 px-2 py-1 border rounded text-sm"
                value={localWeight}
                onChange={(e) => setLocalWeight(e.target.value)}
                placeholder="kg"
              />
            </div>
            <div className="mt-2">
              <span className="text-gray-600">
                {language === 'hi' ? 'उम्र:' : 'Age:'}
              </span>
              <input
                className="ml-2 font-semibold w-20 px-2 py-1 border rounded text-sm"
                value={localAge}
                onChange={(e) => setLocalAge(e.target.value)}
                placeholder="yrs"
              />
            </div>
            {inlineWarning && (
              <div className="text-sm text-yellow-700 mt-2 bg-yellow-50 p-2 rounded">
                ⚠️ {inlineWarning}
              </div>
            )}
          </div>

          {/* Drug Selection */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">
              {language === 'hi' ? 'दवा चुनें' : 'Select Drug'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableDrugs.map(drug => (
                <button
                  key={drug}
                  onClick={() => handleCalculate(drug)}
                  className={`px-2 py-2 rounded text-sm font-medium transition ${
                    selectedDrug === drug
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {drug}
                </button>
              ))}
            </div>

            {/* Manual drug entry */}
            <div className="mt-3">
              <div className="text-xs text-gray-600 mb-1">{language === 'hi' ? 'या मैन्युअल दवा दर्ज करें' : 'Or enter drug manually'}</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={language === 'hi' ? 'दवा का नाम' : 'Drug name'}
                  value={customDrug}
                  onChange={(e) => setCustomDrug(e.target.value)}
                  className="flex-1 px-2 py-2 border rounded text-sm"
                />
                <button
                  onClick={() => {
                    if (!customDrug) return setInlineWarning(language === 'hi' ? 'कृपया दवा का नाम दर्ज करें' : 'Please enter a drug name');
                    // Try to calculate using known mapping first
                    const result = dosageCalculator.calculateDosage(customDrug, parseFloat(localWeight) || parseFloat(patientWeight) || 0, parseInt(localAge) || parseInt(patientAge) || 0);
                    if (result) {
                      setCalculatedDose(result);
                      setSelectedDrug(customDrug);
                      setInlineWarning('');
                    } else {
                      // Ask user for per-kg value if mapping not found
                      setInlineWarning(language === 'hi' ? 'दवा का मान्यता प्राप्त नहीं — कृपया mg/kg दर्ज करें' : 'Drug not found — please enter mg/kg');
                    }
                  }}
                  className="px-3 py-2 bg-indigo-600 text-white rounded text-sm"
                >
                  {language === 'hi' ? 'कैल्कुलेट' : 'Calculate'}
                </button>
              </div>

              {/* If drug unknown allow entering perKg */}
              {inlineWarning && inlineWarning.toLowerCase().includes('mg/kg') && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="mg/kg"
                      value={customPerKg}
                      onChange={(e) => setCustomPerKg(e.target.value)}
                      className="col-span-2 px-2 py-2 border rounded text-sm"
                    />
                    <select
                      value={customPerKgFrequency || '1-1-1'}
                      onChange={(e) => setCustomPerKgFrequency(e.target.value)}
                      className="px-2 py-2 border rounded text-sm"
                    >
                      <option value="1-0-0">Once daily (1-0-0)</option>
                      <option value="1-1-1">Three times (1-1-1)</option>
                      <option value="1-0-1">Morning & Evening (1-0-1)</option>
                      <option value="0-0-1">Night (0-0-1)</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const kg = parseFloat(localWeight) || parseFloat(patientWeight) || 0;
                        const perKg = parseFloat(customPerKg);
                        if (!kg || !perKg) return setInlineWarning(language === 'hi' ? 'कृपया वजन और mg/kg दर्ज करें' : 'Please enter weight and mg/kg');

                        const totalDaily = kg * perKg; // mg/day
                        // Parse frequency string like '1-1-1' to count doses per day
                        const freq = (customPerKgFrequency || '1-1-1').split('-').map(x => parseInt(x) || 0);
                        const dosesPerDay = freq.reduce((s, v) => s + v, 0) || 1;
                        const perDose = totalDaily / dosesPerDay;

                        setCalculatedDose({
                          calculatedDoseTotal: Number(totalDaily.toFixed(0)),
                          perDose: Number(perDose.toFixed(0)),
                          unit: 'mg',
                          frequency: customPerKgFrequency || '1-1-1',
                          warning: null
                        });
                        setSelectedDrug(customDrug || 'Custom');
                        setInlineWarning('');
                      }}
                      className="px-3 py-2 bg-green-600 text-white rounded text-sm"
                    >
                      {language === 'hi' ? 'अप्लाई' : 'Apply'}
                    </button>
                    <button
                      onClick={() => setInlineWarning('')}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm"
                    >
                      {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Calculated Result */}
          {calculatedDose && (
            <div className="bg-purple-50 p-3 rounded mt-4 border border-purple-200">
              <div className="font-semibold text-purple-900 mb-2">
                {language === 'hi' ? 'गणना की गई खुराक:' : 'Calculated Dose:'}
              </div>
              <div className="text-sm space-y-1">
                {calculatedDose.calculatedDoseTotal ? (
                  <>
                    <div>
                      <span className="text-gray-700">{language === 'hi' ? 'कुल दैनिक खुराक:' : 'Total daily dose:'}</span>
                      <span className="ml-2 font-semibold text-purple-700">{calculatedDose.calculatedDoseTotal}{calculatedDose.unit}</span>
                    </div>
                    <div>
                      <span className="text-gray-700">{language === 'hi' ? 'प्रति खुराक:' : 'Per dose:'}</span>
                      <span className="ml-2 font-semibold text-purple-700">{calculatedDose.perDose}{calculatedDose.unit} ({calculatedDose.frequency})</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-gray-700">{language === 'hi' ? 'खुराक:' : 'Dose:'}</span>
                      <span className="ml-2 font-semibold text-purple-700">{calculatedDose.calculatedDose || calculatedDose.calculatedDoseTotal}</span>
                    </div>
                    <div>
                      <span className="text-gray-700">{language === 'hi' ? 'आवृत्ति:' : 'Frequency:'}</span>
                      <span className="ml-2 font-semibold text-purple-700">{calculatedDose.frequency}</span>
                    </div>
                  </>
                )}

              {/* Add to prescription button */}
              <div className="mt-3 flex gap-2 justify-end">
                <button
                  onClick={() => {
                    if (!addMedicine) {
                      addToast?.('Add callback not provided', 'info');
                      return;
                    }

                    // Prepare medicine object
                    const medName = selectedDrug || customDrug || 'Custom Medicine';
                    // Prefer per-dose when available, else use calculatedDose.calculatedDose
                    const qty = calculatedDose.perDose ? `${calculatedDose.perDose}${calculatedDose.unit}` : `${calculatedDose.calculatedDose || calculatedDose.calculatedDoseTotal}${calculatedDose.unit || ''}`;
                    const frequency = calculatedDose.frequency || '1-1-1';
                    const instructions = calculatedDose.warning || '';

                    // Tablet guidance: attempt simple suggestion for 500mg tablet
                    let notes = '';
                    const numericPerDose = Number(calculatedDose.perDose || calculatedDose.calculatedDose || calculatedDose.calculatedDoseTotal) || 0;
                    if (numericPerDose > 0) {
                      const tabletsOf500 = numericPerDose / 500;
                      const rounded = Math.round(tabletsOf500 * 2) / 2; // round to nearest 0.5
                      if (rounded >= 0.5) {
                        notes = `Approx ${rounded} x 500mg tablet per dose`;
                      }
                    }

                    const medToEdit = {
                      name: medName,
                      brand: '',
                      frequency,
                      duration: '5 days',
                      instructions: instructions || notes,
                      qty
                    };

                    // Open edit modal so user can modify before insertion
                    setEditMed(medToEdit);
                    setShowEditModal(true);
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-sm"
                >
                  {language === 'hi' ? 'प्रेस्क्रिप्शन में जोड़ें' : 'Add to prescription'}
                </button>
              </div>
                {calculatedDose.warning && (
                  <div className="text-yellow-700 mt-2 text-xs bg-yellow-50 p-2 rounded">
                    ⚠️ {calculatedDose.warning}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Edit modal for reviewing medicine before adding */}
          {showEditModal && editMed && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold">{language === 'hi' ? 'दवा संपादित करें' : 'Edit Medicine'}</h3>
                  <button onClick={() => setShowEditModal(false)} className="text-gray-500">✕</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-600">{language === 'hi' ? 'नाम' : 'Name'}</label>
                    <input className="w-full px-2 py-2 border rounded" value={editMed.name} onChange={(e) => setEditMed({...editMed, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Brand</label>
                    <input className="w-full px-2 py-2 border rounded" value={editMed.brand} onChange={(e) => setEditMed({...editMed, brand: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">{language === 'hi' ? 'प्रति खुराक' : 'Qty/Per dose'}</label>
                      <input className="w-full px-2 py-2 border rounded" value={editMed.qty} onChange={(e) => setEditMed({...editMed, qty: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">{language === 'hi' ? 'आवृत्ति' : 'Frequency'}</label>
                      <input className="w-full px-2 py-2 border rounded" value={editMed.frequency} onChange={(e) => setEditMed({...editMed, frequency: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">{language === 'hi' ? ' निर्देश' : 'Instructions'}</label>
                    <input className="w-full px-2 py-2 border rounded" value={editMed.instructions} onChange={(e) => setEditMed({...editMed, instructions: e.target.value})} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowEditModal(false)} className="px-3 py-2 bg-gray-200 rounded">{language === 'hi' ? 'रद्द करें' : 'Cancel'}</button>
                    <button onClick={() => {
                      if (!addMedicine) {
                        addToast?.('Add callback not provided', 'info');
                        setShowEditModal(false);
                        return;
                      }
                      addMedicine(editMed);
                      addToast?.(language === 'hi' ? `${editMed.name} prescription में जोड़ा गया` : `${editMed.name} added to prescription`, 'success');
                      setShowEditModal(false);
                      setShowCalculator(false);
                    }} className="px-3 py-2 bg-blue-600 text-white rounded">{language === 'hi' ? 'जोड़ें' : 'Add'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. VOICE-TO-TEXT INPUT COMPONENT
// ==========================================
export const VoiceToTextInput = ({
  addMedicine,
  language = 'en',
  addToast
}) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const parseMedicineVoiceInput = useCallback((text) => {
    const parts = text.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      try {
        const [name, frequency, duration] = parts;
        addMedicine?.({
          name: name.split(' ')[0] || '',
          brand: '',
          frequency: frequency || '1-1-1',
          duration: duration || '5 days',
          timing: 'after food'
        });
        addToast?.(
          language === 'hi' ? `${name} जोड़ दिया गया` : `${name} added`,
          'success'
        );
      } catch (_e) {
        addToast?.('Could not parse voice input', 'warning');
      }
    }
  }, [addMedicine, addToast, language]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          parseMedicineVoiceInput(text);
        }
      }
    };

    recognition.onerror = (event) => {
      addToast?.(`Voice error: ${event.error}`, 'error');
    };

    recognitionRef.current = recognition;
  }, [language, addMedicine, addToast, parseMedicineVoiceInput]);

  const handleVoiceInput = () => {
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    }
  };

  return (
    <button
      onClick={handleVoiceInput}
      className={`px-3 py-2 rounded text-sm font-medium flex items-center gap-2 transition ${
        isListening
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      }`}
      title={language === 'hi' ? 'आवाज़ से दवा जोड़ें' : 'Voice input'}
    >
      <FiMic size={16} />
      {language === 'hi' ? 'आवाज़' : 'Voice'}
    </button>
  );
};

// ==========================================
// 5. DRUG INTERACTION CHECKER COMPONENT
// ==========================================
export const DrugInteractionChecker = ({
  medications,
  drugInteractions,
  language = 'en',
  _addToast
}) => {
  const [interactions, setInteractions] = useState([]);

  useEffect(() => {
    if (!medications || medications.length < 2) {
      setInteractions([]);
      return;
    }

    const foundInteractions = [];
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i].name.toLowerCase();
        const med2 = medications[j].name.toLowerCase();

        // Check drugInteractions database
        Object.entries(drugInteractions).forEach(([drug, interactions]) => {
          const drugLower = drug.toLowerCase();
          if (
            (med1.includes(drugLower) || drugLower.includes(med1)) &&
            interactions.some(int => med2.includes(int.toLowerCase()) || int.toLowerCase().includes(med2))
          ) {
            foundInteractions.push({
              drug1: medications[i].name,
              drug2: medications[j].name,
              severity: 'warning',
              message: `Potential interaction between ${medications[i].name} and ${medications[j].name}`
            });
          }
        });
      }
    }

    if (foundInteractions.length > 0) {
      setInteractions(foundInteractions);
    } else {
      setInteractions([]);
    }
  }, [medications, drugInteractions]);

  if (interactions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 bg-red-50 border border-red-300 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <FiAlertCircle className="text-red-600 mt-1 flex-shrink-0" size={20} />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-2">
            {language === 'hi' ? '⚠️ दवा चेतावनी' : '⚠️ Drug Interaction Alert'}
          </h3>
          <div className="space-y-2">
            {interactions.map((interaction, idx) => (
              <div key={idx} className="text-sm text-red-800 bg-red-100 p-2 rounded">
                <strong>{interaction.drug1}</strong>
                {' + '}
                <strong>{interaction.drug2}</strong>
                <div className="mt-1 text-xs text-red-700">
                  {interaction.message}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-red-700">
            {language === 'hi' 
              ? '👆 इन दवाओं को एक साथ देने से बचें'
              : '👆 Avoid prescribing these combinations'
            }
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 6. COMPLIANCE TRACKING COMPONENT
// ==========================================
export const ComplianceTracker = ({
  prescriptionId,
  patientId,
  language = 'en',
  addToast,
  api
}) => {
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTrackCompliance = async () => {
    setLoading(true);
    try {
      // Log prescription sent to patient
      await api?.post('/api/compliance/log', {
        prescriptionId,
        patientId,
        timestamp: new Date().toISOString()
      });

      setCompliance({
        logged: true,
        timestamp: new Date(),
        status: 'pending'
      });

      addToast?.(
        language === 'hi' ? 'प्रेस्क्रिप्शन ट्रैक किया गया' : 'Prescription tracked',
        'success'
      );
    } catch (error) {
      addToast?.(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleTrackCompliance}
        disabled={loading}
        className={`px-3 py-2 rounded text-sm font-medium flex items-center gap-2 ${
          loading ? 'bg-gray-300 text-gray-600' : 'bg-green-100 text-green-700 hover:bg-green-200'
        }`}
        title={language === 'hi' ? 'अनुपालन ट्रैक करें' : 'Track compliance'}
      >
        {loading ? <FiLoader size={16} className="animate-spin" /> : <FiActivity size={16} />}
        {language === 'hi' ? 'ट्रैक' : 'Track'}
      </button>

      {compliance?.logged && (
        <div className="text-xs text-green-700 flex items-center gap-1">
          <FiCheck size={14} />
          {language === 'hi' ? 'ट्रैक किया गया' : 'Tracked'}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 7. SPLIT-VIEW REDESIGN LAYOUT
// ==========================================
export const SplitViewLayout = ({
  patientInfo,
  prescriptionForm,
  recentMedicines,
  language = 'en'
}) => {
  const [layoutMode, setLayoutMode] = useState('split'); // 'split' or 'full'

  if (layoutMode === 'full') {
    return (
      <div className="w-full">
        <button
          onClick={() => setLayoutMode('split')}
          className="mb-2 px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
        >
          {language === 'hi' ? 'विभाजित दृश्य' : 'Split View'}
        </button>
        <div className="w-full">{prescriptionForm}</div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* Left Panel - Patient Information */}
      <div className="w-1/3 bg-blue-50 p-4 rounded-lg border border-blue-200 overflow-y-auto">
        <h2 className="font-bold text-lg mb-4 text-blue-900">
          {language === 'hi' ? 'मरीज़ की जानकारी' : 'Patient Info'}
        </h2>
        
        {patientInfo ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-600 uppercase tracking-wide">
                {language === 'hi' ? 'नाम' : 'Name'}
              </label>
              <p className="font-semibold text-gray-900">{patientInfo.name}</p>
            </div>
            <div>
              <label className="text-xs text-gray-600 uppercase tracking-wide">
                {language === 'hi' ? 'उम्र' : 'Age'}
              </label>
              <p className="font-semibold text-gray-900">{patientInfo.age} years</p>
            </div>
            <div>
              <label className="text-xs text-gray-600 uppercase tracking-wide">
                {language === 'hi' ? 'वजन' : 'Weight'}
              </label>
              <p className="font-semibold text-gray-900">{patientInfo.weight} kg</p>
            </div>
            <div>
              <label className="text-xs text-gray-600 uppercase tracking-wide">
                {language === 'hi' ? 'एलर्जी' : 'Allergies'}
              </label>
              <p className="font-semibold text-red-700">
                {patientInfo.allergies || (language === 'hi' ? 'कोई नहीं' : 'None')}
              </p>
            </div>
            <div>
              <label className="text-xs text-gray-600 uppercase tracking-wide">
                {language === 'hi' ? 'पिछली दवाइयां' : 'Current Meds'}
              </label>
              <div className="text-sm text-gray-900 mt-2 space-y-1">
                {patientInfo.currentMedications?.map((med, idx) => (
                  <div key={idx} className="bg-white p-2 rounded text-xs">
                    {med.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-600 py-8">
            {language === 'hi' ? 'मरीज़ को चुनें' : 'Select a patient'}
          </div>
        )}

        {/* Recently Used Medicines in Sidebar */}
        <div className="mt-6 pt-6 border-t border-blue-200">
          <h3 className="font-semibold text-sm text-blue-900 mb-3">
            {language === 'hi' ? 'हाल की दवाइयां' : 'Recent Medicines'}
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentMedicines && recentMedicines.length > 0 ? (
              recentMedicines.map((med, idx) => (
                <div
                  key={idx}
                  className="bg-white p-2 rounded text-xs cursor-pointer hover:bg-blue-100 transition"
                  title={`${med.name} - ${med.frequency}`}
                >
                  <div className="font-medium text-gray-900">{med.name}</div>
                  <div className="text-gray-600 text-xs">{med.frequency}</div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-600 italic">
                {language === 'hi' ? 'कोई नहीं' : 'None'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Prescription Form */}
      <div className="w-2/3 bg-white rounded-lg border border-gray-200 p-4 overflow-y-auto">
        <button
          onClick={() => setLayoutMode('full')}
          className="mb-2 px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded float-right"
        >
          {language === 'hi' ? 'पूर्ण दृश्य' : 'Full View'}
        </button>
        <div className="clear-both">{prescriptionForm}</div>
      </div>
    </div>
  );
};

// ==========================================
// INTEGRATION HELPER FUNCTION
// ==========================================
/**
 * Initialize all enhancements in PrescriptionPad component
 * Call this in PrescriptionPad.jsx useEffect or during component init
 */
export const initializePrescriptionEnhancements = () => {
  // console.log('✅ All PrescriptionPad enhancements initialized');
  return {
    smartCombos: true,
    recentlyUsed: true,
    dosageCalc: true,
    voiceInput: true,
    drugInteractions: true,
    complianceTracking: true,
    splitView: true
  };
};

export default {
  SmartMedicationCombos,
  RecentlyUsedMedicinesSidebar,
  DosageCalculator,
  VoiceToTextInput,
  DrugInteractionChecker,
  ComplianceTracker,
  SplitViewLayout,
  initializePrescriptionEnhancements
};
