import { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    // Common
    'save': 'Save',
    'cancel': 'Cancel',
    'delete': 'Delete',
    'edit': 'Edit',
    'add': 'Add',
    'search': 'Search',
    'loading': 'Loading...',
    'error': 'Error',
    'success': 'Success',

    // Navigation
    'patients': 'Patients',
    'analytics': 'Analytics',
    'prescriptions': 'Prescriptions',
    'lab_investigations': 'Lab Investigations',
    'queue': 'Queue',
    'payments': 'Payments',
    'receipts': 'Receipts',

    // Patient Management
    'patient_management': 'Patient Management',
    'add_patient': 'Add Patient',
    'edit_patient': 'Edit Patient',
    'patient_details': 'Patient Details',
    'medical_history': 'Medical History',
    'merge_profiles': 'Merge Profiles',

    // Analytics
    'analytics_dashboard': 'Analytics Dashboard',
    'diagnosis_trends': 'Diagnosis Trends',
    'medication_usage': 'Medication Usage',
    'lab_test_analysis': 'Lab Test Analysis',

    // Prescription
    'create_prescription': 'Create Prescription',
    'prescription_preview': 'Prescription Preview',
    'medications': 'Medications',
    'instructions': 'Instructions',
    'delivery_pincode': 'Delivery Pincode',

    // Lab Investigations
    'lab_tests': 'Lab Tests',
    'test_name': 'Test Name',
    'test_date': 'Test Date',
    'remarks': 'Remarks'
  },
  hi: {
    // Common
    'save': 'सहेजें',
    'cancel': 'रद्द करें',
    'delete': 'मिटाएं',
    'edit': 'संपादित करें',
    'add': 'जोड़ें',
    'search': 'खोजें',
    'loading': 'लोड हो रहा है...',
    'error': 'त्रुटि',
    'success': 'सफलता',

    // Navigation
    'patients': 'मरीज़',
    'analytics': 'विश्लेषण',
    'prescriptions': 'नुस्खे',
    'lab_investigations': 'लैब जांच',
    'queue': 'कतार',
    'payments': 'भुगतान',
    'receipts': 'रसीदें',

    // Patient Management
    'patient_management': 'मरीज़ प्रबंधन',
    'add_patient': 'मरीज़ जोड़ें',
    'edit_patient': 'मरीज़ संपादित करें',
    'patient_details': 'मरीज़ विवरण',
    'medical_history': 'मेडिकल इतिहास',
    'merge_profiles': 'प्रोफाइल विलय करें',

    // Analytics
    'analytics_dashboard': 'विश्लेषण डैशबोर्ड',
    'diagnosis_trends': 'निदान प्रवृत्तियां',
    'medication_usage': 'दवा उपयोग',
    'lab_test_analysis': 'लैब टेस्ट विश्लेषण',

    // Prescription
    'create_prescription': 'नुस्खा बनाएं',
    'prescription_preview': 'नुस्खा पूर्वावलोकन',
    'medications': 'दवाएं',
    'instructions': 'निर्देश',
    'delivery_pincode': 'डिलीवरी पिनकोड',

    // Lab Investigations
    'lab_tests': 'लैब टेस्ट',
    'test_name': 'टेस्ट नाम',
    'test_date': 'टेस्ट तारीख',
    'remarks': 'टिप्पणियां'
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('language');
    const supported = ['en', 'hi', 'mr', 'bn', 'gu', 'ta', 'te', 'kn', 'ml', 'pa', 'ur'];
    return (savedLanguage && supported.includes(savedLanguage)) ? savedLanguage : 'en';
  });

  // Save language preference to localStorage
  const changeLanguage = (newLanguage) => {
    const supported = ['en', 'hi', 'mr', 'bn', 'gu', 'ta', 'te', 'kn', 'ml', 'pa', 'ur'];
    if (supported.includes(newLanguage)) {
      setLanguage(newLanguage);
      localStorage.setItem('language', newLanguage);
    }
  };

  const t = (key) => {
    return translations[language]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return context;
}