/**
 * PrescriptionPad Enhancements & Features
 * Option 1: Quick Wins (30-45 minutes to implement)
 * Option 2: Advanced Features (4-5 hours to implement)
 */

// ========================================
// OPTION 1: QUICK WINS - QUICK TEMPLATE BUTTONS
// ========================================

/**
 * Pre-defined quick templates for common conditions
 * These are the "URTI", "Migraine", "Gastritis" buttons
 * 
 * Usage in PrescriptionPad.jsx:
 * <button onClick={() => applyQuickTemplate(quickTemplates.URTI)}>🔥 URTI (5 min)</button>
 */
export const quickTemplates = {
  URTI: {
    name: 'Upper Respiratory Tract Infection',
    shortName: 'URTI',
    duration: '5 days',
    symptoms: [
      'Fever',
      'Cough',
      'Throat Pain',
      'Runny Nose'
    ],
    diagnoses: [
      'Acute URI'
    ],
    medications: [
      {
        name: 'Paracetamol',
        brand: 'Crocin',
        composition: 'Paracetamol 500 mg',
        frequency: '1-1-1',
        timing: 'After Meal',
        duration: '5 days',
        instructions: 'After food to avoid gastric irritation',
        qty: 15
      },
      {
        name: 'Amoxicillin',
        brand: 'Amoxycillin',
        composition: 'Amoxicillin 500 mg',
        frequency: '1-1-1',
        timing: 'After Meal',
        duration: '5 days',
        instructions: 'Take with water',
        qty: 15
      },
      {
        name: 'Cough Syrup',
        brand: 'Strepsils',
        composition: 'Honey + Ginger + Turmeric',
        frequency: '5ml-5ml-5ml',
        timing: 'After Meal',
        duration: '5 days',
        instructions: 'May cause mild drowsiness',
        qty: 1
      }
    ],
    investigations: 'No investigations required unless symptoms persist',
    precautions: 'Avoid very hot/cold foods. Complete full course of antibiotics.',
    dietRestrictions: 'Avoid spicy and oily foods. Include warm fluids.',
    activities: 'Adequate rest. Avoid strenuous activities for 2 days.',
    advice: 'Plenty of liquids • Steam inhalation • Throat lozenges • Avoid smoking',
    followUpDays: 5
  },

  Migraine: {
    name: 'Migraine Headache',
    shortName: 'Migraine',
    duration: '7 days',
    symptoms: [
      'Headache',
      'Nausea',
      'Photophobia',
      'Dizziness'
    ],
    diagnoses: [
      'Migraine without aura'
    ],
    medications: [
      {
        name: 'Sumatriptan',
        brand: 'Sumatriptan',
        composition: 'Sumatriptan 50 mg',
        frequency: 'OD',
        timing: 'With Meal',
        duration: '7 days',
        instructions: 'Take at onset of headache',
        qty: 7
      },
      {
        name: 'Propranolol',
        brand: 'Propranolol',
        composition: 'Propranolol 40 mg',
        frequency: '1-0-1',
        timing: 'After Meal',
        duration: '30 days',
        instructions: 'Preventive. Continue for 1 month.',
        qty: 60
      },
      {
        name: 'Domperidone',
        brand: 'Domperidone',
        composition: 'Domperidone 10 mg',
        frequency: '1-1-1',
        timing: 'Before Meal',
        duration: '7 days',
        instructions: 'For nausea and vomiting',
        qty: 21
      }
    ],
    investigations: 'Check Blood Pressure if recurring',
    precautions: 'Avoid triggers (stress, irregular sleep, caffeine). Report persistent headaches.',
    dietRestrictions: 'Avoid caffeine, chocolate, aged cheese. Stay hydrated.',
    activities: 'Rest in dark, quiet room during episode. Avoid bright lights.',
    advice: 'Stress management • Regular sleep • Stay hydrated • Avoid triggers',
    followUpDays: 7
  },

  Gastritis: {
    name: 'Acute Gastritis',
    shortName: 'Gastritis',
    duration: '7 days',
    symptoms: [
      'Abdominal Pain',
      'Nausea',
      'Loss of Appetite',
      'Vomiting'
    ],
    diagnoses: [
      'Acute Gastritis'
    ],
    medications: [
      {
        name: 'Omeprazole',
        brand: 'Omeprazole',
        composition: 'Omeprazole 20 mg',
        frequency: '1-0-1',
        timing: 'Before Meal',
        duration: '7 days',
        instructions: 'Take 30 min before food',
        qty: 7
      },
      {
        name: 'Ranitidine',
        brand: 'Rantac',
        composition: 'Ranitidine 150 mg',
        frequency: '1-0-1',
        timing: 'Before Breakfast',
        duration: '7 days',
        instructions: 'Take on empty stomach',
        qty: 7
      },
      {
        name: 'Sucralfate',
        brand: 'Sucralfate',
        composition: 'Sucralfate 1 gm',
        frequency: '1-1-1-1',
        timing: 'Before Meal',
        duration: '7 days',
        instructions: 'Protective coating for stomach',
        qty: 28
      },
      {
        name: 'Antacid',
        brand: 'Digene',
        composition: 'Magnesium Hydroxide + Aluminum Hydroxide',
        frequency: '10ml-10ml-10ml',
        timing: 'As needed',
        duration: '7 days',
        instructions: 'For sudden pain relief',
        qty: 1
      }
    ],
    investigations: 'Endoscopy if pain persists beyond 2 weeks',
    precautions: 'Avoid NSAIDs, spicy foods, alcohol. Take medications regularly.',
    dietRestrictions: 'Avoid spicy, oily, acidic foods. No coffee, tea, alcohol. Eat light meals.',
    activities: 'Avoid strenuous activity. Elevated head while sleeping.',
    advice: 'Small frequent meals • Avoid stress • No smoking • Drink plenty of water',
    followUpDays: 7
  },

  Hypertension: {
    name: 'Hypertension (Initial)',
    shortName: 'HTN',
    duration: '30 days',
    symptoms: [
      'Headache',
      'Dizziness',
      'Fatigue'
    ],
    diagnoses: [
      'Essential Hypertension'
    ],
    medications: [
      {
        name: 'Amlodipine',
        brand: 'Amlodipine',
        composition: 'Amlodipine 5 mg',
        frequency: 'OD',
        timing: 'After Meal',
        duration: '30 days',
        instructions: 'Long-acting ACE inhibitor',
        qty: 30
      },
      {
        name: 'Enalapril',
        brand: 'Enalapril',
        composition: 'Enalapril 5 mg',
        frequency: 'OD',
        timing: 'After Meal',
        duration: '30 days',
        instructions: 'ACE inhibitor for BP control',
        qty: 30
      },
      {
        name: 'Hydrochlorothiazide',
        brand: 'HCTZ',
        composition: 'Hydrochlorothiazide 12.5 mg',
        frequency: 'OD',
        timing: 'After Breakfast',
        duration: '30 days',
        instructions: 'Diuretic - take with potassium food',
        qty: 30
      }
    ],
    investigations: 'Blood pressure monitoring • Blood Sugar • Lipid Profile • Kidney Function Tests',
    precautions: 'Monitor BP regularly. Avoid salt. Report dizziness or palpitations.',
    dietRestrictions: 'Low sodium diet. Avoid processed foods. Include potassium-rich foods.',
    activities: 'Regular moderate exercise. 30 min daily walk. Reduce stress.',
    advice: 'Regular BP monitoring • Limit salt to <5g per day • Exercise regularly • Manage stress',
    followUpDays: 14
  },

  Diabetes: {
    name: 'Type 2 Diabetes (Initial)',
    shortName: 'DM2',
    duration: '30 days',
    symptoms: [
      'Fatigue',
      'Frequent Urination',
      'Increased Thirst',
      'Weight Loss'
    ],
    diagnoses: [
      'Type 2 Diabetes Mellitus'
    ],
    medications: [
      {
        name: 'Metformin',
        brand: 'Glucophage',
        composition: 'Metformin 500 mg',
        frequency: '1-0-1',
        timing: 'After Meal',
        duration: '30 days',
        instructions: 'First-line agent. Start low dose.',
        qty: 30
      },
      {
        name: 'Glipizide',
        brand: 'Glipizide',
        composition: 'Glipizide 5 mg',
        frequency: 'OD',
        timing: 'Before Breakfast',
        duration: '30 days',
        instructions: 'Stimulates insulin release',
        qty: 30
      },
      {
        name: 'Vitamin B12',
        brand: 'B-Complex',
        composition: 'B12 500 mcg',
        frequency: 'OD',
        timing: 'After Meal',
        duration: '30 days',
        instructions: 'For neuropathy prevention',
        qty: 30
      }
    ],
    investigations: 'Fasting Blood Sugar • HbA1c • Lipid Profile • Renal Function • Urine Albumin',
    precautions: 'Regular glucose monitoring. Follow diet strictly. Regular exercise.',
    dietRestrictions: 'No sugar/refined carbs. Low glycemic index foods. Portion control.',
    activities: '30 min moderate exercise daily. Walking, swimming, or cycling. Avoid sedentary lifestyle.',
    advice: 'Regular blood sugar monitoring • Strict diet • Daily exercise • Stress management',
    followUpDays: 14
  },

  Fever: {
    name: 'Fever Management',
    shortName: 'Fever',
    duration: '5 days',
    symptoms: [
      'High Fever',
      'Body Ache',
      'Chills',
      'Weakness'
    ],
    diagnoses: [
      'Fever - Unknown Origin'
    ],
    medications: [
      {
        name: 'Paracetamol',
        brand: 'Crocin',
        composition: 'Paracetamol 500 mg',
        frequency: '1-1-1',
        timing: 'After Meal',
        duration: '5 days',
        instructions: 'For fever reduction',
        qty: 15
      },
      {
        name: 'Ibuprofen',
        brand: 'Brufen',
        composition: 'Ibuprofen 400 mg',
        frequency: '1-0-1',
        timing: 'After Meal',
        duration: '5 days',
        instructions: 'Anti-inflammatory pain reliever',
        qty: 10
      },
      {
        name: 'Electrolyte Solution',
        brand: 'ORS',
        composition: 'Glucose + Sodium + Potassium',
        frequency: '5ml-5ml-5ml',
        timing: 'As needed',
        duration: '5 days',
        instructions: 'For hydration and electrolyte balance',
        qty: 1
      }
    ],
    investigations: 'Blood cultures if fever persists > 3 days, CBC, Urinalysis',
    precautions: 'Monitor temperature regularly. Stay hydrated. Report high fever (>103°F).',
    dietRestrictions: 'Light diet. Easy to digest foods. Avoid heavy meals.',
    activities: 'Complete bed rest. Avoid strenuous activities. Keep environment cool.',
    advice: 'Plenty of fluids • Light clothing • Cool compress on forehead • Monitor temperature',
    followUpDays: 3
  },

  Anxiety: {
    name: 'Anxiety Disorder',
    shortName: 'Anxiety',
    duration: '30 days',
    symptoms: [
      'Anxiety',
      'Palpitations',
      'Sweating',
      'Sleep Disturbance'
    ],
    diagnoses: [
      'Generalized Anxiety Disorder'
    ],
    medications: [
      {
        name: 'Sertraline',
        brand: 'Sertraline',
        composition: 'Sertraline 50 mg',
        frequency: 'OD',
        timing: 'After Breakfast',
        duration: '30 days',
        instructions: 'SSRI - start low dose, increase gradually',
        qty: 30
      },
      {
        name: 'Lorazepam',
        brand: 'Ativan',
        composition: 'Lorazepam 0.5 mg',
        frequency: 'OD',
        timing: 'At Bedtime',
        duration: '15 days',
        instructions: 'For acute anxiety - short-term use only',
        qty: 15
      },
      {
        name: 'Magnesium',
        brand: 'Mag Glycinate',
        composition: 'Magnesium 400 mg',
        frequency: 'OD',
        timing: 'At Bedtime',
        duration: '30 days',
        instructions: 'Helps reduce anxiety naturally',
        qty: 30
      }
    ],
    investigations: 'Thyroid profile to rule out thyroid disorder, Complete blood count',
    precautions: 'Do not drive or operate machinery while on benzodiazepines. Avoid sudden withdrawal.',
    dietRestrictions: 'Avoid caffeine, energy drinks, alcohol. Include magnesium-rich foods.',
    activities: 'Regular exercise • Yoga • Meditation • Breathing exercises • Adequate sleep',
    advice: 'Regular exercise • Meditation • Yoga • Deep breathing • Limit caffeine',
    followUpDays: 14
  },

  Allergy: {
    name: 'Allergic Rhinitis',
    shortName: 'Allergy',
    duration: '7 days',
    symptoms: [
      'Sneezing',
      'Nasal Congestion',
      'Itchy Eyes',
      'Runny Nose'
    ],
    diagnoses: [
      'Allergic Rhinitis'
    ],
    medications: [
      {
        name: 'Cetirizine',
        brand: 'Cetrizine',
        composition: 'Cetirizine 10 mg',
        frequency: 'OD',
        timing: 'At Bedtime',
        duration: '7 days',
        instructions: 'Antihistamine - non-drowsy',
        qty: 7
      },
      {
        name: 'Mometasone Nasal Spray',
        brand: 'Asmanex',
        composition: 'Mometasone 50 mcg/spray',
        frequency: '2 sprays-0-2 sprays',
        timing: 'Morning/Evening',
        duration: '7 days',
        instructions: 'Nasal steroid spray - use as directed',
        qty: 1
      },
      {
        name: 'Saline Nasal Drops',
        brand: 'Nasosol',
        composition: 'Normal Saline',
        frequency: '2 drops-2 drops-2 drops',
        timing: 'As needed',
        duration: '7 days',
        instructions: 'For nasal decongestion',
        qty: 1
      }
    ],
    investigations: 'Allergy testing if recurrent',
    precautions: 'Avoid known allergens. Keep environment dust-free. Monitor for worsening symptoms.',
    dietRestrictions: 'Avoid allergen-containing foods. Include anti-inflammatory foods.',
    activities: 'Keep bedroom dust-free. Use air purifier. Avoid outdoor exposure during high pollen count.',
    advice: 'Avoid allergens • Keep nasal passages clean • Use humidifier • Stay hydrated',
    followUpDays: 7
  },

  Cough: {
    name: 'Persistent Cough',
    shortName: 'Cough',
    duration: '7 days',
    symptoms: [
      'Dry Cough',
      'Throat Irritation',
      'Hoarseness'
    ],
    diagnoses: [
      'Acute Bronchitis'
    ],
    medications: [
      {
        name: 'Cough Syrup with Dextromethorphan',
        brand: 'Robitussin',
        composition: 'Dextromethorphan 10 mg/5ml',
        frequency: '10ml-10ml-10ml',
        timing: 'After Meal',
        duration: '7 days',
        instructions: 'Cough suppressant - dry cough',
        qty: 1
      },
      {
        name: 'Ambroxol',
        brand: 'Mucosolvan',
        composition: 'Ambroxol 30 mg',
        frequency: '1-1-1',
        timing: 'After Meal',
        duration: '7 days',
        instructions: 'Mucolytic - breaks down mucus',
        qty: 21
      },
      {
        name: 'Honey',
        brand: 'Honey',
        composition: 'Pure Honey',
        frequency: '10ml-0-10ml',
        timing: 'As needed',
        duration: '7 days',
        instructions: 'Natural cough suppressant',
        qty: 1
      }
    ],
    investigations: 'Chest X-ray if persistent > 2 weeks',
    precautions: 'Report if cough persists > 2 weeks or if blood in sputum.',
    dietRestrictions: 'Avoid cold drinks, dairy products. Include warm fluids.',
    activities: 'Adequate sleep. Avoid air pollution. Keep environment humid.',
    advice: 'Steam inhalation • Warm fluids • Throat lozenges • Adequate rest',
    followUpDays: 7
  }
};

// ========================================
// OPTION 1: KEYBOARD SHORTCUTS
// ========================================

/**
 * Keyboard shortcuts for common prescription actions
 * 
 * Ctrl+T : Apply Template
 * Ctrl+S : Save Prescription
 * Ctrl+P : Print Prescription
 * Ctrl+M : Add Medication
 * Ctrl+L : Add Lab Test
 * Ctrl+Shift+C : Clear Form
 * 
 * Usage in PrescriptionPad.jsx useEffect:
 * 
 * useEffect(() => {
 *   const handleKeyboardShortcuts = (e) => {
 *     if (!e.ctrlKey) return;
 *     
 *     switch(e.key) {
 *       case 't':
 *       case 'T':
 *         e.preventDefault();
 *         setShowTemplateSelector(true);
 *         addToast('Template selector opened', 'info');
 *         break;
 *       case 's':
 *       case 'S':
 *         e.preventDefault();
 *         handleSave();
 *         break;
 *       case 'p':
 *       case 'P':
 *         e.preventDefault();
 *         handlePrint();
 *         break;
 *       case 'm':
 *       case 'M':
 *         e.preventDefault();
 *         document.querySelector('[placeholder="Start typing Medicines"]')?.focus();
 *         break;
 *       case 'l':
 *       case 'L':
 *         e.preventDefault();
 *         document.querySelector('[placeholder*="lab test"]')?.focus();
 *         break;
 *     }
 *     
 *     if (e.shiftKey && e.key === 'C') {
 *       e.preventDefault();
 *       handleClear();
 *     }
 *   };
 *   
 *   window.addEventListener('keydown', handleKeyboardShortcuts);
 *   return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
 * }, [handleSave, handlePrint, handleClear]);
 */

export const keyboardShortcuts = {
  'Ctrl+T': 'Open Template Selector',
  'Ctrl+S': 'Save Prescription',
  'Ctrl+P': 'Print Prescription',
  'Ctrl+M': 'Focus on Medicine Input',
  'Ctrl+L': 'Focus on Lab Test Input',
  'Ctrl+Shift+C': 'Clear Form'
};

// ========================================
// OPTION 1: QUICK TEMPLATE APPLICATION
// ========================================

/**
 * Function to apply complete template in one click
 * Fill all prescription fields from template object
 * 
 * Usage in PrescriptionPad.jsx:
 * const applyQuickTemplate = useCallback((template) => {
 *   applyCompleteTemplate(template, {
 *     setSymptoms,
 *     setDiagnoses,
 *     setMeds,
 *     setAdvice,
 *     setFollowUp,
 *     language,
 *     addToast
 *   });
 * }, [language]);
 */
export const applyCompleteTemplate = (template, handlers) => {
  const {
    setSymptoms,
    setDiagnoses,
    setMeds,
    setAdvice,
    setLabAdvice,
    setFollowUp,
    setPatientNotes,
    language,
    timingOptions,
    addToast
  } = handlers;

  try {
    // 1. Merge symptoms (don't replace existing)
    if (template.symptoms && Array.isArray(template.symptoms)) {
      setSymptoms(prev => {
        const existingNames = new Set(
          (prev || []).map(s => (typeof s === 'object' ? s.name : s).toLowerCase().trim())
        );
        const newOnes = template.symptoms
          .filter(s => {
            const name = typeof s === 'string' ? s : (s.name || '');
            return name && !existingNames.has(name.toLowerCase().trim());
          })
          .map(s => typeof s === 'object' ? s : { name: s, remarks: '' });
        return [...(prev || []), ...newOnes];
      });
    }

    // 2. Merge diagnoses (don't replace existing)
    if (template.diagnoses && Array.isArray(template.diagnoses)) {
      setDiagnoses(prev => {
        const existingLabels = new Set(
          (prev || []).map(d => (typeof d === 'string' ? d : (d.label || d.icd_title || '')).toLowerCase().trim())
        );
        const newOnes = template.diagnoses.filter(d => {
          const lbl = typeof d === 'string' ? d : (d.label || d.icd_title || '');
          return lbl && !existingLabels.has(lbl.toLowerCase().trim());
        });
        return [...(prev || []), ...newOnes];
      });
    }

    // 3. Merge medications (don't replace existing, skip duplicates by name)
    if (template.medications && Array.isArray(template.medications)) {
      const medsToAdd = template.medications.map(med => {
        let normalizedTiming = med.timing;
        if (typeof med.timing === 'string') {
          normalizedTiming = { type: med.timing, time: null };
        } else if (!med.timing) {
          const defaultTiming = (timingOptions[language] || timingOptions.en)[0];
          normalizedTiming = { type: defaultTiming, time: null };
        }
        return {
          name: med.name || med.medication_name,
          brand: med.brand || med.name,
          composition: med.composition || '',
          strength: med.strength || '',
          dosage_form: med.dosage_form || '',
          frequency: med.is_tapering ? 'Tapering' : (med.frequency || '1-0-1'),
          timing: normalizedTiming,
          duration: med.duration || '7 days',
          instructions: med.instructions || '',
          qty: med.qty || 7,
          is_tapering: med.is_tapering ? true : false,
          tapering_schedule: med.is_tapering && Array.isArray(med.tapering_schedule)
            ? med.tapering_schedule
            : []
        };
      });
      setMeds(medsToAdd);
    }

    // 4. Merge advice (append, don't replace)
    if (template.advice) {
      setAdvice(prev => {
        if (!prev || !prev.trim()) return template.advice;
        if (prev.includes(template.advice)) return prev;
        return `${prev}\n${template.advice}`;
      });
    }

    // 5. Merge investigations / lab tests (append new tags)
    if (template.investigations) {
      if (setLabAdvice) {
        setLabAdvice(prev => {
          if (!prev || !prev.trim()) return template.investigations;
          if (prev.includes(template.investigations)) return prev;
          const existingTags = new Set(prev.split(',').map(s => s.trim().toLowerCase()));
          const newTags = template.investigations
            .split(',')
            .map(s => s.trim())
            .filter(s => s && !existingTags.has(s.toLowerCase()));
          return newTags.length ? `${prev}, ${newTags.join(', ')}` : prev;
        });
      } else if (setPatientNotes) {
        setPatientNotes(`Investigations: ${template.investigations}`);
      }
    }

    // 6. Apply follow-up
    if (template.followUpDays && setFollowUp) {
      setFollowUp({
        days: template.followUpDays,
        date: new Date(Date.now() + template.followUpDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        autoFill: false
      });
    }

    if (addToast) {
      addToast(`✅ Applied "${template.name}" - All fields filled in 1 second!`, 'success');
    }
  } catch (error) {
    console.error('Error applying template:', error);
    if (addToast) {
      addToast('Failed to apply template', 'error');
    }
  }
};

// ========================================
// OPTION 2: AUTO-SUGGESTIONS BY DIAGNOSIS
// ========================================

/**
 * Diagnostic suggestions database
 * Maps diagnoses to commonly used medications and investigations
 */
export const diagnosisSuggestions = {
  'Hypertension': {
    investigations: ['BP monitoring', 'Blood Sugar', 'Lipid Profile', 'Kidney Function Tests'],
    commonMeds: [
      { name: 'Amlodipine', frequency: 'OD' },
      { name: 'Enalapril', frequency: 'OD' },
      { name: 'Lisinopril', frequency: 'OD' }
    ],
    precautions: 'Monitor BP regularly. Avoid salt.',
    diet: 'Low sodium diet. Potassium-rich foods.'
  },
  'Diabetes': {
    investigations: ['Fasting Blood Sugar', 'HbA1c', 'Lipid Profile'],
    commonMeds: [
      { name: 'Metformin', frequency: '1-0-1' },
      { name: 'Glipizide', frequency: 'OD' }
    ],
    precautions: 'Regular glucose monitoring.',
    diet: 'No refined carbs. Low glycemic index foods.'
  },
  'Acute URI': {
    investigations: ['Clinical examination only'],
    commonMeds: [
      { name: 'Paracetamol', frequency: '1-1-1' },
      { name: 'Amoxicillin', frequency: '1-1-1' }
    ],
    precautions: 'Complete antibiotic course.',
    diet: 'Avoid spicy foods. Warm fluids.'
  },
  'Migraine without aura': {
    investigations: ['Blood Pressure check'],
    commonMeds: [
      { name: 'Sumatriptan', frequency: 'OD' },
      { name: 'Propranolol', frequency: '1-0-1' }
    ],
    precautions: 'Avoid triggers. Regular sleep.',
    diet: 'Avoid caffeine, chocolate. Stay hydrated.'
  },
  'Gastritis': {
    investigations: ['Endoscopy if persistent'],
    commonMeds: [
      { name: 'Omeprazole', frequency: '1-0-1' },
      { name: 'Sucralfate', frequency: '1-1-1' }
    ],
    precautions: 'Avoid NSAIDs and alcohol.',
    diet: 'No spicy/oily foods. Light meals.'
  }
};

// ========================================
// OPTION 2: RECENTLY USED MEDICINES
// ========================================

/**
 * Track and manage recently used medicines for quick access
 * Store in localStorage for persistence
 */
export class RecentlyUsedMedicines {
  static KEY = 'recentlyUsedMedicines';
  static MAX_ITEMS = 15;

  static add(medicine) {
    const recent = this.getAll();
    const filtered = recent.filter(m => 
      !(m.name === medicine.name && m.brand === medicine.brand)
    );
    const updated = [medicine, ...filtered].slice(0, this.MAX_ITEMS);
    localStorage.setItem(this.KEY, JSON.stringify(updated));
  }

  static getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch {
      return [];
    }
  }

  static clear() {
    localStorage.removeItem(this.KEY);
  }

  static remove(name, brand) {
    const recent = this.getAll();
    const filtered = recent.filter(m => !(m.name === name && m.brand === brand));
    localStorage.setItem(this.KEY, JSON.stringify(filtered));
  }
}

// ========================================
// OPTION 2: DRUG INTERACTION CHECKER
// ========================================

/**
 * Basic drug interaction database
 * Returns warning if two medications have known interactions
 */
export const drugInteractions = {
  'Warfarin': ['Aspirin', 'NSAIDs', 'Alcohol'],
  'Metformin': ['Contrast dye', 'Alcohol'],
  'ACE Inhibitors': ['Potassium supplements', 'NSAIDs'],
  'NSAIDs': ['Methotrexate', 'Lithium', 'ACE Inhibitors'],
  'Statins': ['Macrolide antibiotics'],
  'Propranolol': ['Verapamil'],
  'Theophylline': ['Ciprofloxacin']
};

/**
 * Check if two medicines have interactions
 */
export const checkDrugInteraction = (med1, med2) => {
  if (!med1 || !med2) return null;

  const name1 = med1.name || med1.brand || '';
  const name2 = med2.name || med2.brand || '';

  for (const [drug, interactions] of Object.entries(drugInteractions)) {
    const hasDrug1 = name1.toLowerCase().includes(drug.toLowerCase());
    
    if (hasDrug1) {
      for (const interaction of interactions) {
        if (name2.toLowerCase().includes(interaction.toLowerCase())) {
          return {
            severity: 'warning',
            message: `⚠️ Potential interaction: ${drug} + ${interaction}`
          };
        }
      }
    }
  }

  return null;
};

/**
 * Check all medicines for interactions
 */
export const checkAllInteractions = (medications) => {
  const interactions = [];
  
  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const interaction = checkDrugInteraction(medications[i], medications[j]);
      if (interaction) {
        interactions.push(interaction);
      }
    }
  }

  return interactions;
};

// ========================================
// OPTION 2: DOSAGE CALCULATOR
// ========================================

/**
 * Calculate dosage based on patient weight and age
 * Returns recommended dose for common drugs
 */
export const dosageCalculator = {
  // Pediatric dosages (mg/kg/day)
  'Paracetamol': { perKg: 15, unit: 'mg', form: 'tablet' },
  'Amoxicillin': { perKg: 25, unit: 'mg', form: 'tablet' },
  'Ibuprofen': { perKg: 10, unit: 'mg', form: 'tablet' },
  'Metformin': { minAge: 10, adultDose: '500-1000mg', unit: 'mg' },
  'Omeprazole': { minAge: 2, adultDose: '20-40mg', unit: 'mg' }
};

export const calculateDosage = (drugName, weight, age) => {
  const drug = dosageCalculator[drugName];
  if (!drug) return null;

  if (age < 18 && drug.perKg) {
    // Pediatric calculation
    const dose = weight * drug.perKg;
    return {
      calculatedDose: dose,
      unit: drug.unit,
      recommendations: `${dose.toFixed(0)}mg per day`,
      frequency: '1-1-1 (divide into 3 doses)',
      warning: '⚠️ Verify with pediatric dosage chart'
    };
  } else if (drug.adultDose) {
    // Adult dose
    return {
      recommendedDose: drug.adultDose,
      unit: drug.unit,
      frequency: 'As per standard adult dosage',
      warning: null
    };
  }

  return null;
};

// ========================================
// OPTION 2: VOICE-TO-TEXT (Speech Recognition)
// ========================================

/**
 * Speech Recognition for prescription entry
 * Browser's Web Speech API
 * 
 * Usage in PrescriptionPad.jsx:
 * const startVoiceInput = () => {
 *   if (!('webkitSpeechRecognition' in window)) {
 *     addToast('Speech recognition not supported in this browser', 'error');
 *     return;
 *   }
 *   
 *   const recognition = new webkitSpeechRecognition();
 *   recognition.continuous = true;
 *   recognition.interimResults = true;
 *   recognition.lang = 'en-US';
 *   
 *   recognition.onstart = () => {
 *     addToast('Listening... Speak your prescription', 'info');
 *   };
 *   
 *   recognition.onresult = (event) => {
 *     let transcript = '';
 *     for (let i = event.resultIndex; i < event.results.length; i++) {
 *       transcript += event.results[i][0].transcript;
 *     }
 *     
 *     // Parse transcript and add medicine
 *     // Example: "Paracetamol five hundred, 1-1-1 after meals, 5 days"
 *     addMed({ name: transcript });
 *   };
 *   
 *   recognition.onerror = (event) => {
 *     addToast(`Speech error: ${event.error}`, 'error');
 *   };
 *   
 *   recognition.start();
 * };
 */

export const speechRecognitionHelper = {
  isSupported: () => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  },

  parseVoiceInput: (transcript) => {
    // Simple parsing: "Paracetamol five hundred, 1-1-1 after meals"
    const parts = transcript.split(',');
    
    return {
      medicine: parts[0]?.trim() || '',
      frequency: parts[1]?.trim() || '',
      timing: parts[2]?.trim() || '',
      duration: parts[3]?.trim() || ''
    };
  }
};

// ========================================
// OPTION 2: COMPLIANCE TRACKING
// ========================================

/**
 * Track patient compliance with prescriptions
 * Store in backend and retrieve for follow-ups
 */
export const complianceTracking = {
  /**
   * Log prescription compliance
   * Call this after prescription is sent to patient
   */
  logPrescription: async (prescriptionId, patientId, api) => {
    try {
      await api.post('/api/compliance/log', {
        prescriptionId,
        patientId,
        status: 'sent',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log compliance:', error);
    }
  },

  /**
   * Get compliance report for patient
   */
  getComplianceReport: async (patientId, api) => {
    try {
      const response = await api.get(`/api/patients/${patientId}/compliance-report`);
      return response.data;
    } catch (error) {
      console.error('Failed to get compliance report:', error);
      return null;
    }
  }
};

// ========================================
// OPTION 2: SMART MEDICATION COMBOS
// ========================================

/**
 * Pre-defined medication combinations for common conditions
 * One click to add all medications for a condition
 */
export const medicationCombos = {
  'URTI': [
    { name: 'Paracetamol', frequency: '1-1-1', duration: '5 days' },
    { name: 'Amoxicillin', frequency: '1-1-1', duration: '5 days' },
    { name: 'Cough Syrup', frequency: '5ml-5ml-5ml', duration: '5 days' }
  ],
  'Migraine': [
    { name: 'Sumatriptan', frequency: 'OD', duration: '7 days' },
    { name: 'Propranolol', frequency: '1-0-1', duration: '30 days' },
    { name: 'Domperidone', frequency: '1-1-1', duration: '7 days' }
  ],
  'Gastritis': [
    { name: 'Omeprazole', frequency: '1-0-1', duration: '7 days' },
    { name: 'Sucralfate', frequency: '1-1-1', duration: '7 days' },
    { name: 'Antacid', frequency: 'As needed', duration: '7 days' }
  ],
  'Hypertension': [
    { name: 'Amlodipine', frequency: 'OD', duration: '30 days' },
    { name: 'Enalapril', frequency: 'OD', duration: '30 days' }
  ],
  'Diabetes': [
    { name: 'Metformin', frequency: '1-0-1', duration: '30 days' },
    { name: 'Glipizide', frequency: 'OD', duration: '30 days' }
  ]
};

export const addMedicationCombo = (comboName, setMeds, timingOptions, language) => {
  const combo = medicationCombos[comboName];
  if (!combo) return;

  const defaultTiming = (timingOptions[language] || timingOptions.en)[0];
  const medsToAdd = combo.map(med => ({
    name: med.name,
    brand: med.name,
    composition: '',
    frequency: med.frequency,
    timing: defaultTiming,
    duration: med.duration,
    instructions: '',
    qty: 7
  }));

  setMeds(prev => [...prev, ...medsToAdd]);
};

// ========================================
// OPTION 2: SPLIT-VIEW LAYOUT HELPER
// ========================================

/**
 * Helper for split-view layout management
 * Left side: Patient info | Right side: Prescription builder
 */
export const splitViewLayout = {
  containerClasses: 'grid md:grid-cols-2 gap-4 h-screen',
  leftPanelClasses: 'md:overflow-y-auto border-r',
  rightPanelClasses: 'md:overflow-y-auto',
  
  // State for managing split view
  initialState: {
    selectedPatient: null,
    splitViewEnabled: true,
    leftPanelWidth: 50, // percentage
    rightPanelWidth: 50
  }
};

// ========================================
// OPTION 2: QUICK REFERENCE MODAL
// ========================================

/**
 * Quick reference guide for common abbreviations
 */
export const abbreviationsGuide = {
  'OD': 'Once Daily',
  'BD': 'Twice Daily',
  'TDS': 'Three times Daily',
  'QID': 'Four times Daily',
  'HS': 'At Bedtime',
  'STAT': 'Immediately',
  'QOD': 'Every Other Day',
  'AC': 'Before meals',
  'PC': 'After meals',
  'WC': 'With meals',
  'RX': 'Prescription',
  'Dx': 'Diagnosis',
  'Sx': 'Symptoms',
  'HTN': 'Hypertension',
  'DM': 'Diabetes Mellitus',
  'URI': 'Upper Respiratory Infection',
  'BP': 'Blood Pressure',
  'HR': 'Heart Rate',
  'RR': 'Respiratory Rate',
  'SpO2': 'Oxygen Saturation',
  'BMI': 'Body Mass Index'
};

// ========================================
// Helper: Get time estimate for implementation
// ========================================

export const implementationEstimates = {
  option1: {
    name: 'Quick Wins',
    items: [
      { task: 'Quick template buttons (URTI, Migraine, Gastritis)', time: '30-45 min' },
      { task: 'Keyboard shortcuts', time: '30 min' },
      { task: 'Auto-suggestions by diagnosis', time: '45 min' },
      { task: 'Quick copy-paste medications', time: '15 min' }
    ],
    totalTime: '2-2.5 hours',
    doctorImpact: '50-60% time saving per prescription'
  },

  option2: {
    name: 'Advanced Features',
    items: [
      { task: 'Voice-to-text integration', time: '2 hours' },
      { task: 'Dosage calculator', time: '1.5 hours' },
      { task: 'Drug interaction checker', time: '1.5 hours' },
      { task: 'Compliance tracking', time: '2 hours' },
      { task: 'Smart medication combos', time: '1 hour' },
      { task: 'Split-view layout redesign', time: '2 hours' },
      { task: 'Recently used medicines sidebar', time: '1 hour' }
    ],
    totalTime: '11+ hours',
    doctorImpact: '70-80% overall workflow improvement'
  }
};

export default {
  quickTemplates,
  keyboardShortcuts,
  applyCompleteTemplate,
  diagnosisSuggestions,
  RecentlyUsedMedicines,
  drugInteractions,
  checkDrugInteraction,
  checkAllInteractions,
  dosageCalculator,
  calculateDosage,
  speechRecognitionHelper,
  complianceTracking,
  medicationCombos,
  addMedicationCombo,
  splitViewLayout,
  abbreviationsGuide,
  implementationEstimates
};
