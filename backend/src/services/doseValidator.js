/**
 * Medication Dosage Validator
 * Validates prescriptions against safety guidelines
 */

const DOSE_LIMITS = {
  'paracetamol': { 
    max_single: 1000, 
    max_daily: 4000,
    pediatric_min_age: 2,
    pediatric_dose: (age, weight) => Math.min(15 * weight, 500)
  },
  'ibuprofen': {
    max_single: 400,
    max_daily: 3200,
    pediatric_min_age: 6,
    pediatric_dose: (age, weight) => Math.min(10 * weight, 400)
  },
  'amoxicillin': {
    max_single: 500,
    max_daily: 1500,
    pediatric_min_age: 1,
    pediatric_dose: (age, weight) => Math.min(25 * weight, 500)
  },
  'cetirizine': {
    max_single: 10,
    max_daily: 20,
    pediatric_min_age: 2,
    pediatric_dose: (age, weight) => age < 6 ? 2.5 : 5
  },
  'omeprazole': {
    max_single: 40,
    max_daily: 40,
    pediatric_min_age: 1,
    pediatric_dose: (age, weight) => Math.min(0.5 * weight, 20)
  }
};

const FREQUENCY_MULTIPLIERS = {
  'once daily': 1,
  'twice daily': 2,
  'thrice daily': 3,
  'four times daily': 4,
  'every 6 hours': 4,
  'every 8 hours': 3,
  'every 12 hours': 2,
  'as needed': 1
};

class DoseValidator {
  /**
   * Validate a single medication dose
   * Tests expect: validateDose(medication, dose, patient)
   */
  static validateDose(medication, dose, patient) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Handle different input formats from tests
    const medName = medication.name?.toLowerCase() || medication.medication_name?.toLowerCase() || '';
    const dosage = dose?.dose || medication.dosage || 0;
    const frequency = dose?.frequency || medication.frequency || 'once daily';
    const duration = dose?.duration || medication.duration;
    const unit = dose?.unit || 'mg';

    // If dosage is empty/not provided, skip validation but still check for medicine in database
    if (!dosage || dosage === '' || dosage === '0') {
      // Only warn if medicine is not in our database
      if (!DOSE_LIMITS[medName]) {
        result.warnings.push(`No dose limit database for ${medication.name || medication.medication_name}. Manual verification recommended.`);
      }
      return result;
    }

    // Check if medication is in database
    if (!DOSE_LIMITS[medName]) {
      result.warnings.push(`No dose limit database for ${medication.name || medication.medication_name}. Manual verification recommended.`);
      return result;
    }

    const limits = DOSE_LIMITS[medName];

    // Parse numeric portion — handles "1 tab", "500mg", "5ml", plain numbers
    const numericDosage = parseFloat(String(dosage));
    if (isNaN(numericDosage) || numericDosage <= 0) {
      // Non-numeric dosage (e.g. "as needed") — skip limit check
      return result;
    }

    // Check single dose limit
    if (numericDosage > limits.max_single) {
      result.valid = false;
      result.errors.push(
        `Single dose (${dosage}${unit}) exceeds maximum (${limits.max_single}${unit})`
      );
    }

    // Check daily dose limit
    let multiplier = 1;
    if (typeof frequency === 'string' && frequency.includes('-')) {
      // Handle "1-0-1", "1-1-1", etc.
      multiplier = frequency.split('-').reduce((sum, val) => {
        // Handle fractions like "1/2"
        if (val.includes('/')) {
          const [n, d] = val.split('/').map(Number);
          return sum + (d ? n / d : 0);
        }
        return sum + (parseFloat(val) || 0);
      }, 0);
    } else {
      multiplier = FREQUENCY_MULTIPLIERS[frequency?.toLowerCase()] || 1;
    }
    
    const dailyDose = numericDosage * multiplier;
    if (dailyDose > limits.max_daily) {
      result.valid = false;
      result.errors.push(
        `Daily dose (${dailyDose}${unit}) exceeds maximum (${limits.max_daily}${unit})`
      );
    }

    // Age-based validation
    if (patient && patient.age !== undefined) {
      if (patient.age < limits.pediatric_min_age) {
        result.valid = false;
        result.errors.push(
          `${medication.name || medication.medication_name} has minimum age restriction of ${limits.pediatric_min_age} years`
        );
      }

      if (patient.age < 18 && patient.weight) {
        const recommendedPediatricDose = limits.pediatric_dose(patient.age, patient.weight);
        if (numericDosage > recommendedPediatricDose) {
          result.valid = false;
          result.errors.push(
            `Pediatric dose ${numericDosage}${unit} exceeds recommended ${recommendedPediatricDose}${unit} (${patient.weight}kg)`
          );
        }
      }
    }

    // Check duration validity - any positive number is valid
    if (duration !== undefined && duration !== null && duration !== '') {
      const numericDuration = parseInt(String(duration));
      if (!isNaN(numericDuration) && numericDuration <= 0) {
        result.valid = false;
        result.errors.push(`Invalid duration: ${duration}. Duration must be a positive number.`);
      }
    }

    return result;
  }

  /**
   * Calculate age from date of birth
   */
  static calculateAge(dob) {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Validate entire prescription
   */
  static validatePrescription(medications, patient) {
    const results = {
      valid: true,
      medications: [],
      errors: [],
      warnings: []
    };

    medications.forEach(med => {
      const validation = this.validateDose(med, med, patient);
      
      results.medications.push({
        medication_name: med.name || med.medication_name,
        ...validation
      });

      if (!validation.valid) {
        results.valid = false;
        results.errors.push(...validation.errors);
      }

      results.warnings.push(...validation.warnings);
    });

    // Check for drug-drug interactions
    const drugInteractions = this.checkDrugInteractions(medications);
    if (drugInteractions.interactions && drugInteractions.interactions.length > 0) {
      results.warnings.push(...drugInteractions.interactions);
    }

    return results;
  }

  /**
   * Check for common drug interactions
   */
  static checkDrugInteractions(medications) {
    const interactions = [];
    const medNames = medications.map(m => {
      const name = m.medication_name || m.name || '';
      return name.toLowerCase();
    });

    // Define dangerous and warning interactions
    const interactionPatterns = [
      {
        drugs: ['warfarin', 'aspirin'],
        message: 'WARNING: Warfarin + Aspirin can increase bleeding risk'
      },
      {
        drugs: ['warfarin', 'ibuprofen'],
        message: 'WARNING: Warfarin + Ibuprofen can increase bleeding risk'
      },
      {
        drugs: ['methotrexate', 'ibuprofen'],
        message: 'WARNING: Methotrexate + Ibuprofen reduces effectiveness'
      },
      {
        drugs: ['methotrexate', 'aspirin'],
        message: 'WARNING: Methotrexate + Aspirin reduces effectiveness'
      },
      {
        drugs: ['ibuprofen', 'aspirin'],
        message: 'WARNING: Avoid combining NSAIDs (Ibuprofen + Aspirin)'
      },
      {
        drugs: ['paracetamol', 'ibuprofen'],
        message: 'WARNING: Do not combine paracetamol and ibuprofen'
      }
    ];

    interactionPatterns.forEach(pattern => {
      const found = pattern.drugs.filter(drug => 
        medNames.some(m => m.includes(drug.toLowerCase()))
      );
      if (found.length === pattern.drugs.length) {
        interactions.push(pattern.message);
      }
    });

    return { interactions };
  }
}

module.exports = DoseValidator;
