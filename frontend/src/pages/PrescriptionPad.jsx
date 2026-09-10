/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { FiEdit3, FiVideo, FiLink2, FiCopy, FiSettings, FiX, FiDownload, FiBookmark, FiEye } from 'react-icons/fi';
import { useToast } from '../hooks/useToast';
import { useApiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';  // Make sure this exists
import { useTranslation } from '../context/LanguageContext';
import { lazyWithRetry as lazy } from '../utils/lazyWithRetry';
const Letterhead = lazy(() => import('../components/Letterhead'));
const SpecialtySelector = lazy(() => import('../components/specialty/SpecialtySelector'));
const RepeatPrescriptionButton = lazy(() => import('../components/RepeatPrescriptionButton'));
const PrescriptionA5Format = lazy(() => import('../components/PrescriptionA5Format'));
import { downloadPrescriptionPDF } from '../services/pdfService';
import { TIMING_TRANSLATIONS } from '../utils/medicationTimingTranslations';
import { cleanReasonForVisit } from '../utils/reasonForVisit';
import { getLocalDateString } from '../utils/localDate';

// PHASE 1: Import Quick Wins utilities
import {
  applyCompleteTemplate,
  RecentlyUsedMedicines
} from '../utils/prescriptionEnhancements';

// PHASE 2: Import Advanced Features
import {
  SmartMedicationCombos,
  RecentlyUsedMedicinesSidebar,
  DosageCalculator,
  VoiceToTextInput,
  DrugInteractionChecker,
  ComplianceTracker,
  SplitViewLayout
} from '../utils/PrescriptionPadEnhancements';

const symptomSuggestions = ['Fever', 'Cough', 'Headache', 'Fatigue', 'Nausea', 'Dizziness', 'Pain', 'Weakness'];
const diagnosisSuggestions = ['Hypertension', 'Diabetes', 'URI', 'Migraine', 'Gastritis', 'Anemia', 'Asthma'];

const predefinedAdvice = {
  en: [
    'avoid spicy and oily food',
    'REST FOR 3 DAYS',
    'Drink plenty of water',
    'TAKE HIGH PROTEIN DIET  : - MILK, PANEER, SOYABEAN OR SOYA MILK, SPROUTS, DAL ESPECIALLY GREEN MOOG DAL, EGGS, CHICKEN SOUP, CHICKEN BREAST ETC.',
    'PATIENT MAY REQUIRE HOSPITAL ADMISSION IF CONDITION WORSENS',
    'FOR BP - restrict salt intake avoid pickels,chips and papad  and avoid packaged outside foods',
    'TAKE SOFT DIET LIKE RICE WITH CURD, KHICHADI, UPAMA, YOGHURT, YAKULT MILK. TAKE PLENTY OF WATER AT LEAST 2L/DAY OR ELECTRAL POWDER OR ORS. AVOID OILY FOOD OR MILK OR FRUIT JUICES',
    'FOR DIABETES - AVOID SUGAR, RICE, POTATO, JAGGHARY, HONEY AND FRUIT JUICES . WHOLE FRUITS CAN BE  EATEN. Hypoglycemic symptoms if appear take sugar chocolate or any sweet immediately and contact me . Hypoglycemic symptoms are sweating giddiness palpitations shivering shaking of hands',
    'Avoid exercise or heavy weight lifting of any kind',
    'FOR VITAMIN D - Egg Yolks , Fatty Fish (Sardines, Mackerel , Salmon , Tuna ), Milk and Milk products , Yogurt',
    'THYROID - Avoid raw Cauliflower, Cabbage, Broccoli, also avoid soybeans, soyabean oil and soy-based foods. CLOSE BOTTLE OF MEDICINE AS SOON AS YOU REMOVE 1 TABLET FROM IT AND KEEP BOTTLE IN CUPBOARD ONLY BECAUSE MOISTURE IN AIR AND SUNLIGHT CAN REDUCE EFFICACY OF TABLETS .',
    'FOR VITAMIN B12 - Milk, yogurt, paneer, fortified cereals, nutritional yeast; and fish, eggs, chicken, mutton, seafood.',
    'PATIENT CAN BE POSTED FOR SURGERY WITH MILD RISK',
    'FLU AND PNEUMOCOCCAL VACCINE',
    'DO IN CLINIC CONSULTATION IF NOT RELIVED',
    'KIDNEY STONES   - Drink 8-12 glass of water per day, Restrict salt and meat intake. Limit intake of tea, coffee, chocolate, spinach, strawberry, beets and nuts.',
    'ADMIT IN HOSPITAL',
    'BASED ON ABOVE CLINICAL EXAMINATION  I CERTIFY THAT HE IS FIT TO JOIN JOB',
    'This prescription is for travel / parcel purpose only',
    'DO YOGA AND PRANAYAM',
    'STOP TAB _________________________  FOR 3 DAYS PRIOR TO SURGERY AND RESTART IT 3 DAYS AFTER SURGERY OR AS PER SURGEON OPINION',
    'rest for 5 days',
    'To increase platelets Increase fruits intake like - Kiwi, Dragon fruit, or Papaya . And water intake And Watch for bleeding from anywhere like nose mouth urine or stool and inform immediately if bleeding is there.',
    'BASED ON ABOVE CLINICAL EXAMINATION  I CERTIFY THAT HE/SHE IS FIT FOR ROUTINE PHYSICAL ACTIVITIES AND SCHOOL ADMISSION',
    'DONT SLEEP FLAT, SLEEP IN SEMI-RECLINIG POSITION "\\___"',
    'PATIENT CAN BE POSTED FOR CATARACT SURGERY WITH MILD RISK',
    'USE DOCTORS CHAPPAL OR SOFT SOLE SHOES OR SILICON IN SOLES AND DO EXERCISE',
    'BASED ON ABOVE CLINICAL EXAMINATION  I CERTIFY THAT HE/SHE IS MENTALLY AND PHYSICALLY FIT TO TAKE ADOPTION OF CHILD',
  ],
  hi: [
    'मसालेदार और तैलीय भोजन से बचें',
    '3 दिन आराम करें',
    'खूब सारा पानी पीओ',
    'प्रोटीन डाइट लें:- दूध, पनीर, सोयाबीन या सोया मिल्क, अंकुरित अनाज, दाल खासकर हरी मूंग दाल, अंडे, चिकन सूप, चिकन ब्रेस्ट आदि।',
    'हालत बिगड़ने पर मरीज को अस्पताल में भर्ती कराने की आवश्यकता पड़ सकती है',
    'बीपी के लिए - नमक का सेवन सीमित करें, अचार, चिप्स और पापड़ से बचें और बाहर के डिब्बाबंद खाद्य पदार्थों से बचें',
    'दही चावल, खिचड़ी, उपमा, दही, याकूल्ट दूध जैसे नरम आहार लें। कम से कम 2 लीटर/दिन पानी का भरपूर सेवन करें I तैलीय भोजन या दूध या फलों के रस से परहेज करें I',
    'डायबेटिस के लिए - चीनी, चावल, आलू, गुड़, शहद और फलों के रस से बचें I पूरे फल खाए जा सकते हैं I शुगर कम लक्षण दिखाई दें तो तुरंत शुगर चॉकलेट या कोई मिठाई खालें और मुझसे संपर्क करें I शुगर कम लक्षण हैं पसीना आना, घबराहट होना, चक्कर आना, कंपकंपी, हाथ कांपना I',
    'किसी भी प्रकार के व्यायाम या भारी वजन उठाने से बचें।',
    'विटामिन डी के लिए - अंडे की जर्दी, वसायुक्त मछली (सार्डिन, मैकेरल, सामन, टूना), दूध और दूध उत्पाद, दही',
    'थायरॉइड - कच्ची फूलगोभी, पत्तागोभी और ब्रोकली खाने से बचें, साथ ही सोयाबीन, सोयाबीन का तेल और सोया से बने खाद्य पदार्थों से भी बचें। दवा की बोतल में से 1 गोली निकालते ही उसे बंद कर दें और बोतल को अलमारी में रख दें, क्योंकि हवा में नमी और सूरज की रोशनी गोलियों की प्रभावशीलता को कम कर सकती है।',
    'विटामिन बी12 के लिए - दूध, दही, पनीर, फोर्टिफाइड अनाज, पोषण खमीर; तथा मछली, अंडे, चिकन, मटन, समुद्री भोजन।',
    'PATIENT CAN BE POSTED FOR SURGERY WITH MILD RISK',
    'FLU AND PNEUMOCOCCAL VACCINE',
    'DO IN CLINIC CONSULTATION IF NOT RELIVED',
    'पथरी - प्रतिदिन 8-12 गिलास पानी पिएं I नमक और मांस का सेवन सीमित करें I चाय, कॉफी, चॉकलेट, पालक, स्ट्रॉबेरी, चुकंदर और नट्स का सेवन सीमित करें',
    'अस्पताल में भर्ती करें',
    'BASED ON ABOVE CLINICAL EXAMINATION  I CERTIFY THAT HE IS FIT TO JOIN JOB',
    'This prescription is for travel / parcel purpose only',
    'योग और प्राणायाम करें',
    'सर्जरी से 3 दिन पहले ________________________ इस टैबलेट का सेवन बंद कर दें और सर्जरी के 3 दिन बाद या सर्जन की राय के अनुसार इसे फिर से शुरू करें।',
    '5 दिन आराम करें',
    'प्लेटलेट्स बढ़ाने के लिए कीवी, ड्रैगन फ्रूट या पपीता जैसे फलों का सेवन बढ़ाएं। साथ ही पानी का सेवन भी बढ़ाएं। नाक, मुंह, मूत्र या मल से किसी भी प्रकार के रक्तस्राव पर ध्यान दें और रक्तस्राव होने पर तुरंत सूचित करें।',
    'BASED ON ABOVE CLINICAL EXAMINATION  I CERTIFY THAT HE/SHE IS FIT FOR ROUTINE PHYSICAL ACTIVITIES AND SCHOOL ADMISSION',
    'सपाट न सोएं, अर्ध-लेटी हुई स्थिति में सोएं "\\___"',
    'PATIENT CAN BE POSTED FOR CATARACT SURGERY WITH MILD RISK',
    'डॉक्टर चप्पल या मुलायम तलवों वाले जूते या तलवों में सिलिकॉन का उपयोग करें और व्यायाम करें',
    'BASED ON ABOVE CLINICAL EXAMINATION  I CERTIFY THAT HE/SHE IS MENTALLY AND PHYSICALLY FIT TO TAKE ADOPTION OF CHILD',
  ],
  mr: [
    'मसालेदार आणि तेलकट अन्न टाळा',
    '३ दिवस विश्रांती घ्या',
    'भरपूर पाणी प्या',
    'प्रोटीन आहार घ्या :- दूध, पनीर, सोयाबीन किंवा सोया दूध, अंकुरलेले धान्य, डाळ, विशेषतः हिरवी मूग डाळ, अंडी, चिकन सूप, चिकन ब्रेस्ट इ.',
    'प्रकृती बिघडल्यास रुग्णाला रुग्णालयात दाखल करण्याची आवश्यकता असू शकते',
    'बीपी साठी - मीठाचे सेवन मर्यादित करा लोणचे, चिप्स आणि पापड टाळा आणि बाहेरचे पॅक केलेले पदार्थ टाळा',
    'दही भात, खिचडी, उपमा, दही, याकुल्ट मिल्क सारखा सॉफ्ट डाएट घ्या. कमीत कमी 2L/दिवस भरपूर पाणी घ्या. तेलकट अन्न किंवा दूध किंवा फळांचे रस टाळा.',
    'डायबेटिस साठी - साखर, तांदूळ, बटाटा, गुळ, मध आणि फळांचे रस टाळा . संपूर्ण फळे खाऊ शकतात. साखर कमी झाल्याची लक्षणे दिसल्यास ताबडतोब साखर चॉकलेट किंवा कोणतेही गोड पदार्थ घ्या आणि माझ्याशी संपर्क साधा. साखर कमी झाल्याची लक्षणे : - घाम येणे, चक्कर येणे, धडधडणे, थरथर हात कापणे .',
    'कोणत्याही प्रकारचा व्यायाम किंवा जड वजन उचलणे टाळा.',
    'व्हिटॅमिन डी साठी - अंड्यातील पिवळ बलक, फॅटी फिश (सार्डिन, मॅकरेल, सॅल्मन, टूना), दूध आणि दुग्धजन्य पदार्थ, दही',
    'थायरॉइड - कच्ची फुलकोबी, कोबी, ब्रोकोली खाणे टाळा, तसेच सोयाबीन, सोयाबीन तेल आणि सोया-आधारित पदार्थही टाळा. तुम्ही 1 टॅब्लेट काढताच औषधाची बाटली बंद करा आणि बाटली कपाटातच ठेवा कारण हवेतील ओलावा आणि सूर्यप्रकाश गोळ्यांची परिणामकारकता कमी करू शकतो',
    'व्हिटॅमिन बी१२ साठी - दूध, दही, पनीर, फोर्टिफाइड  धान्य, पौष्टिक यीस्ट; आणि मासे, अंडी, चिकन, मटण, सीफूड.',
    'PATIENT CAN BE POSTED FOR SURGERY WITH MILD RISK',
    'FLU AND PNEUMOCOCCAL VACCINE',
    'DO IN CLINIC CONSULTATION IF NOT RELIVED',
    'मूतखडे - दररोज 8-12 ग्लास पाणी प्या.  मीठ आणि मांसाचे सेवन मर्यादित करा.  चहा, कॉफी, चॉकलेट, पालक, स्ट्रॉबेरी, बीट्स आणि नट्सचे सेवन मर्यादित करा',
    'रुग्णालयात भर्ती करा',
    'BASED ON ABOVE CLINICAL EXAMINATION  I CERTIFY THAT HE IS FIT TO JOIN JOB',
    'This prescription is for travel / parcel purpose only',
    'योग आणि प्राणायाम करा',
    'शस्त्रक्रियेच्या ३ दिवस आधी _____________________ही गोळी घेणे थांबवा आणि शस्त्रक्रियेनंतर ३ दिवसांनी किंवा सर्जनच्या सल्ल्यानुसार पुन्हा सुरू करा.',
    '५ दिवस विश्रांती घ्या',
    'प्लेटलेट्स वाढवण्यासाठी किवी, ड्रॅगन फ्रूट किंवा पपई यांसारख्या फळांचे सेवन वाढवा. तसेच भरपूर पाणी प्या. नाक, तोंड, लघवी किंवा शौचावाटे कुठूनही रक्तस्त्राव होत आहे का यावर लक्ष ठेवा आणि रक्तस्त्राव होत असल्यास तात्काळ कळवा.',
    'BASED ON ABOVE CLINICAL EXAMINATION  I CERTIFY THAT HE/SHE IS FIT FOR ROUTINE PHYSICAL ACTIVITIES AND SCHOOL ADMISSION',
    'सपाट झोपू नका, सेमी-रिक्लिनिंग स्थितीत झोपा "\\___"',
    'PATIENT CAN BE POSTED FOR CATARACT SURGERY WITH MILD RISK',
    'डॉक्टर चप्पल किंवा सॉफ्ट सोल शूज किंवा सोलमध्ये सिलिकॉन वापरा आणि व्यायाम करा',
    'BASED ON ABOVE CLINICAL EXAMINATION  I CERTIFY THAT HE/SHE IS MENTALLY AND PHYSICALLY FIT TO TAKE ADOPTION OF CHILD',
  ]
};

const instructionLanguages = [
  { code: 'hi', name: 'हिंदी - Hindi' },
  { code: 'en', name: 'English' },
  { code: 'mr', name: 'मराठी - Marathi' },
  { code: 'bn', name: 'বাংলা - Bengali' },
  { code: 'gu', name: 'ગુજરાતી - Gujarati' },
  { code: 'ta', name: 'தமிழ் - Tamil' },
  { code: 'te', name: 'తెలుగు - Telugu' },
  { code: 'kn', name: 'ಕನ್ನಡ - Kannada' },
  { code: 'ml', name: 'മലയാളം - Malayalam' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ - Punjabi' },
  { code: 'ur', name: 'اردو - Urdu' }
];

const timingOptions = {
  en: [
    'Before Breakfast', 'After Breakfast', 'Before Lunch', 'After Lunch', 'Before Dinner', 'After Dinner',
    'Before Breakfast And Lunch', 'After Breakfast And Lunch', 'Before Lunch And Dinner', 'After Lunch And Dinner', 
    'Before Breakfast And Dinner', 'After Breakfast And Dinner', 'Before Breakfast, Lunch And Dinner', 'After Breakfast, Lunch And Dinner',
    'Before Meal', 'After Meal', 'During Meal', 'With Meal', 'Empty Stomach', 'With Food', 'Without Food',
    'AT FIXED TIME', 'At fixed time (no relation with food)', 'At fixed time',
    'AT 6-7 AM', 'AT 7-8 AM', 'AT 8-9 AM', 'AT 12-1 PM', 'AT 2-3 PM', 'AT 6-7 PM', 'AT 7-8 PM', 'AT 8-9 PM',
    'At 6 AM', 'At 8 AM', 'At 10 AM', 'At 2 PM', 'At 6 PM', 'At 9 PM',
    'Before 8 PM', 'Before Sleep', 'After Waking Up', 'Morning', 'Afternoon', 'Evening', 'Night',
    'After Heavy Meal', 'Before Meal (30 mins)', 'After Meal (15 mins)', 'With Milk', 'With Water', 
    'Avoid With Food', 'With Plenty Of Water', 'AT FIXED DIET', 'With Specific Diet', 'After Food Only', 'Before Food Only'
  ],
  hi: [
    'नाश्ते से पहले', 'नाश्ते के बाद', 'दोपहर के भोजन से पहले', 'दोपहर के भोजन के बाद', 'रात के खाने से पहले', 'रात के खाने के बाद',
    'नाश्ते और दोपहर के भोजन से पहले', 'नाश्ते और दोपहर के भोजन के बाद', 'दोपहर और रात के खाने से पहले', 'दोपहर और रात के खाने के बाद',
    'नाश्ते और रात के खाने से पहले', 'नाश्ते और रात के खाने के बाद', 'नाश्ते, दोपहर और रात के खाने से पहले', 'नाश्ते, दोपहर और रात के खाने के बाद',
    'भोजन से पहले', 'भोजन के बाद', 'भोजन के दौरान', 'भोजन के साथ', 'खाली पेट', 'भोजन के साथ', 'बिना भोजन के',
    'निश्चित समय पर', 'निश्चित समय पर (भोजन से कोई संबंध नहीं)', 'निश्चित समय पर',
    'सुबह 6-7 बजे', 'सुबह 7-8 बजे', 'सुबह 8-9 बजे', 'दोपहर 12-1 बजे', 'दोपहर 2-3 बजे', 'शाम 6-7 बजे', 'रात 7-8 बजे', 'रात 8-9 बजे',
    'सुबह 6 बजे', 'सुबह 8 बजे', 'सुबह 10 बजे', 'दोपहर 2 बजे', 'शाम 6 बजे', 'रात 9 बजे',
    'रात 8 बजे से पहले', 'सोने से पहले', 'जागने के बाद', 'सुबह', 'दोपहर', 'शाम', 'रात',
    'भारी भोजन के बाद', 'भोजन से पहले (30 मिनट)', 'भोजन के बाद (15 मिनट)', 'दूध के साथ', 'पानी के साथ',
    'भोजन के साथ न लें', 'भरपूर पानी के साथ', 'निश्चित आहार पर', 'विशेष आहार के साथ', 'केवल भोजन के बाद', 'केवल भोजन से पहले'
  ],
  mr: [
    'नाश्त्यापूर्वी', 'नाश्त्यानंतर', 'दुपारच्या जेवणापूर्वी', 'दुपारच्या जेवणानंतर', 'रात्रीच्या जेवणापूर्वी', 'रात्रीच्या जेवणानंतर',
    'नाश्ता आणि दुपारच्या जेवणापूर्वी', 'नाश्ता आणि दुपारच्या जेवणानंतर', 'दुपारच्या आणि रात्रीच्या जेवणापूर्वी', 'दुपारच्या आणि रात्रीच्या जेवणानंतर',
    'नाश्ता आणि रात्रीच्या जेवणापूर्वी', 'नाश्ता आणि रात्रीच्या जेवणानंतर', 'नाश्ता, दुपार आणि रात्रीच्या जेवणापूर्वी', 'नाश्ता, दुपार आणि रात्रीच्या जेवणानंतर',
    'जेवणापूर्वी', 'जेवणानंतर', 'जेवण दरम्यान', 'जेवणासोबत', 'रिकाम्या पोटी', 'जेवणासोबत', 'जेवणाशिवाय',
    'ठराविक वेळी', 'ठराविक वेळी (जेवणाशी संबंध नाही)', 'ठराविक वेळी',
    'सकाळी 6-7 वाजता', 'सकाळी 7-8 वाजता', 'सकाळी 8-9 वाजता', 'दुपारी 12-1 वाजता', 'दुपारी 2-3 वाजता', 'संध्याकाळी 6-7 वाजता', 'रात्री 7-8 वाजता', 'रात्री 8-9 वाजता',
    'सकाळी 6 वाजता', 'सकाळी 8 वाजता', 'सकाळी 10 वाजता', 'दुपारी 2 वाजता', 'संध्याकाळी 6 वाजता', 'रात्री 9 वाजता',
    'रात्री 8 वाजेपूर्वी', 'झोपण्यापूर्वी', 'झोपेतून उठल्यावर', 'सकाळी', 'दुपारी', 'संध्याकाळी', 'रात्री',
    'भरपेट जेवणानंतर', 'जेवणापूर्वी (30 मिनिटे)', 'जेवणानंतर (15 मिनिटे)', 'दुधासोबत', 'पाण्यासोबत',
    'जेवणासोबत घेऊ नका', 'भरपूर पाण्यासोबत', 'ठराविक आहारावर', 'विशिष्ट आहारासह', 'फक्त जेवणानंतर', 'फक्त जेवणापूर्वी'
  ],
  bn: [
    'খাওয়ার পরে',
    'সকালের খাবারের আগে',
    'খাবারের আগে',
    'পেট খালি',
    'খাবারের সাথে'
  ],
  gu: [
    'ખાણ પછી',
    'નાસ્તા પહેલાં',
    'ખાણ પહેલાં',
    'પેટ ખાલી',
    'ખાણ સાથે'
  ],
  ta: [
    'உணவுக்குப் பின்',
    'காலை உணவுக்கு முன்',
    'உணவுக்கு முன்',
    'வயிற்று காலி',
    'உணவுடன்'
  ],
  te: [
    'భోజనం తర్వాత',
    'అర్థాన్నికి ముందు',
    'భోజనానికి ముందు',
    'ఖాలీ పేట',
    'భోజనంతో'
  ],
  kn: [
    'ಊಟದ ನಂತರ',
    'ಬೆಳಿಗ್ಗೆ ಊಟಕ್ಕೂ ಮೊದು',
    'ಊಟಕ್ಕೂ ಮೊದು',
    'ಖಾಲಿ ಹೊಟ್ಟ',
    'ಊಟದೊಂದಿಗೆ'
  ],
  ml: [
    'ഭക്ഷണത്തിനു ശേഷം',
    'രാവിലെ ഭക്ഷണത്തിനു മുമ്പ്',
    'ഭക്ഷണത്തിനു മുമ്പ്',
    'വയറു ശൂന്യം',
    'ഭക്ഷണത്തോടൊപ്പം'
  ],
  pa: [
    'ਖਾਣ ਤੋਂ ਬਾਅਦ',
    'ਸਵੇਰ ਤੋਂ ਪਹਿਲਾਂ',
    'ਖਾਣ ਤੋਂ ਪਹਿਲਾਂ',
    'ਖਾਲੀ ਪੇਟ',
    'ਖਾਣ ਨਾਲ'
  ],
  ur: [
    'کھنے کے بعد',
    'ناشتے سے پہلے',
    'کھانے سے پہلے',
    'بھیجے پیٹ',
    'کھانے کے ساتھ'
  ]
};

// Slot shapes for the numeric FREQ presets (1 = dose taken in that slot, 0 = skipped).
// The actual digit shown is filled in dynamically from the medicine's Dose field
// (e.g. Dose "1/2" -> "1/2-0-1/2", Dose "1" -> "1-0-1") so FREQ always matches DOSE.
const FREQ_SLOT_SHAPES = [
  [1, 0, 1], [1, 1, 1], [0, 0, 1], [1, 0, 0], [0, 1, 0],
  [1, 1, 1, 1], [0, 0, 0, 1], [1, 0, 0, 0], [1, 0, 1, 0], [0, 1, 0, 1]
];
const NAMED_FREQ_PRESETS = [
  'SOS', 'Once daily', 'Twice daily', 'Three times daily', 'Four times daily',
  'Every 8 hours', 'Every 12 hours', 'Weekly', 'Stat'
];
const getDoseUnit = (doseStr) => {
  const m = String(doseStr || '').trim().match(/^(\d+\/\d+|\d+(?:\.\d+)?)/);
  return m ? m[1] : '1';
};
const getFrequencyPresets = (doseStr) => {
  const unit = getDoseUnit(doseStr);
  const slotPresets = FREQ_SLOT_SHAPES.map(shape => shape.map(v => (v ? unit : '0')).join('-'));
  return [...slotPresets, ...NAMED_FREQ_PRESETS];
};
// Doctor-typed custom pad field names (Pad Configuration) come through in
// whatever case the doctor used — often all-caps, which reads as shouting
// next to the other title-case section headers ("Symptoms", "Vitals"...).
// Display-only normalization; the raw fieldName still keys the state object.
const toTitleCase = (str) => (str || '')
  .toLowerCase()
  .replace(/\b\w/g, (c) => c.toUpperCase());
// Diagnosis entries sometimes arrive as a JSON-encoded array/object string
// (e.g. copied from a past visit whose diagnosis field was stringified before
// storage). Unwrap those so a chip shows just the label instead of raw JSON.
const normalizeDiagnosisList = (raw) => {
  if (!raw) return [];
  // Plain comma-separated string (legacy CSV-style diagnosis field), not JSON.
  if (typeof raw === 'string' && !raw.trim().startsWith('[') && !raw.trim().startsWith('{')) {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  const arr = Array.isArray(raw) ? raw : [raw];
  const out = [];
  arr.forEach((item) => {
    if (typeof item === 'string' && (item.trim().startsWith('[') || item.trim().startsWith('{'))) {
      try {
        const parsed = JSON.parse(item);
        if (Array.isArray(parsed)) { out.push(...parsed); return; }
        out.push(parsed);
        return;
      } catch { /* not JSON, keep as plain string */ }
    }
    out.push(item);
  });
  return out;
};
const TAPER_FREQ_TRANSLATIONS = {
  'Once daily':        { hi: 'दिन में एक बार', mr: 'दिवसातून एकदा', gu: 'દિવસમાં એકવાર', bn: 'দিনে একবার', ta: 'நாளில் ஒருமுறை', te: 'రోజుకు ఒకసారి', kn: 'ದಿನಕ್ಕೊಮ್ಮೆ', ml: 'ദിവസം ഒരിക്കൽ', pa: 'ਦਿਨ ਵਿੱਚ ਇੱਕ ਵਾਰ', ur: 'دن میں ایک بار' },
  'Twice daily':       { hi: 'दिन में दो बार', mr: 'दिवसातून दोनदा', gu: 'દિવસમાં બે વાર', bn: 'দিনে দুইবার', ta: 'நாளில் இருமுறை', te: 'రోజుకు రెండుసార్లు', kn: 'ದಿನಕ್ಕೆ ಎರಡು ಬಾರಿ', ml: 'ദിവസം രണ്ടുതവണ', pa: 'ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ', ur: 'دن میں دو بار' },
  'Three times daily': { hi: 'दिन में तीन बार', mr: 'दिवसातून तीनदा', gu: 'દિવસમાં ત્રણ વાર', bn: 'দিনে তিনবার', ta: 'நாளில் மூன்றுமுறை', te: 'రోజుకు మూడుసార్లు', kn: 'ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ', ml: 'ദിവസം മൂന്നുതവണ', pa: 'ਦਿਨ ਵਿੱਚ ਤਿੰਨ ਵਾਰ', ur: 'دن میں تین بار' },
  'Four times daily':  { hi: 'दिन में चार बार', mr: 'दिवसातून चारदा', gu: 'દિવસમાં ચાર વાર', bn: 'দিনে চারবার', ta: 'நாளில் நான்குமுறை', te: 'రోజుకు నాలుగుసార్లు', kn: 'ದಿನಕ್ಕೆ ನಾಲ್ಕು ಬಾರಿ', ml: 'ദിവസം നാലുതവണ', pa: 'ਦਿਨ ਵਿੱਚ ਚਾਰ ਵਾਰ', ur: 'دن میں چار بار' },
  'Every 8 hours':     { hi: 'हर 8 घंटे', mr: 'दर 8 तासांनी', gu: 'દર 8 કલાક', bn: 'প্রতি ৮ ঘণ্টায়', ta: 'ஒவ்வொரு 8 மணிக்கும்', te: '8 గంటలకు ఒకసారి', kn: 'ಪ್ರತಿ 8 ಗಂಟೆಗೆ', ml: 'ഓരോ 8 മണിക്കൂറിലും', pa: 'ਹਰ 8 ਘੰਟੇ', ur: 'ہر 8 گھنٹے' },
  'Every 12 hours':    { hi: 'हर 12 घंटे', mr: 'दर 12 तासांनी', gu: 'દર 12 કલાક', bn: 'প্রতি ১২ ঘণ্টায়', ta: 'ஒவ்வொரு 12 மணிக்கும்', te: '12 గంటలకు ఒకసారి', kn: 'ಪ್ರತಿ 12 ಗಂಟೆಗೆ', ml: 'ഓരോ 12 മണിക്കൂറിലും', pa: 'ਹਰ 12 ਘੰਟੇ', ur: 'ہر 12 گھنٹے' },
  'Weekly':            { hi: 'साप्ताहिक', mr: 'आठवड्यातून एकदा', gu: 'સાપ્તાહિક', bn: 'সাপ্তাহিক', ta: 'வாரம் ஒருமுறை', te: 'వారానికి ఒకసారి', kn: 'ವಾರಕ್ಕೊಮ್ಮೆ', ml: 'ആഴ്ചയിൽ ഒരിക്കൽ', pa: 'ਹਫ਼ਤੇ ਵਿੱਚ ਇੱਕ ਵਾਰ', ur: 'ہفتہ وار' },
};
function translateTaperFreq(freq, lang) {
  if (!freq || !lang || lang === 'en') return freq;
  return (TAPER_FREQ_TRANSLATIONS[freq] && TAPER_FREQ_TRANSLATIONS[freq][lang]) || freq;
}

const _frequencyOptions = {
  en: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'SOS'],
  hi: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'ज़रूरत पर'],
  mr: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'गरजेनुसार'],
  bn: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'প্রয়োজনে'],
  gu: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'જરૂરીયાત'],
  ta: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'தேவைப்படி'],
  te: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'అవసరానుగుణంగా'],
  kn: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'ಅಗತ್ಯಾನುಸಾರ'],
  ml: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'ആവശ്യമെന്ന്'],
  pa: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'ਲੋੜ ਪਈਂ'],
  ur: ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', 'ضرورت پڑ']
};
// Instruction translations for all supported languages
const INSTRUCTION_TRANSLATIONS = {
      // Cream / Topical
      'Apply on affected area': {
        en: 'Apply on affected area', hi: 'प्रभावित क्षेत्र पर लगाएं', mr: 'प्रभावित भागावर लावा',
        gu: 'અસરગ્રસ્ત વિસ્તારે લગાવો', bn: 'আক্রান্ত স্থানে লাগান', ta: 'பாதிக்கப்பட்ட பகுதியில் தடவுங்கள்',
        te: 'ప్రభావిత ప్రదేశంపై పూయండి', kn: 'ಪ್ರಭಾವಿತ ಪ್ರದೇಶಕ್ಕೆ ಹಚ್ಚಿ', ml: 'ബാധിത ഭാഗത്ത് പുരട്ടുക',
        pa: 'ਪ੍ਰਭਾਵਿਤ ਖੇਤਰ ਤੇ ਲਗਾਓ', ur: 'متاثرہ جگہ پر لگائیں'
      },
      'Apply thin layer': {
        en: 'Apply thin layer', hi: 'पतली परत लगाएं', mr: 'पातळ थर लावा',
        gu: 'પાતળો થર લગાવો', bn: 'পাতলা স্তর লাগান', ta: 'மெல்லிய படலம் தடவுங்கள்',
        te: 'సన్నని పొర పూయండి', kn: 'ತೆಳುಗೆ ಲೇಪ ಹಚ್ಚಿ', ml: 'നേർത്ത പ്രതലം പുരട്ടുക',
        pa: 'ਪਤਲੀ ਪਰਤ ਲਗਾਓ', ur: 'پتلی تہہ لگائیں'
      },
      'Apply after cleaning the area': {
        en: 'Apply after cleaning the area', hi: 'क्षेत्र साफ करने के बाद लगाएं', mr: 'जागा स्वच्छ केल्यानंतर लावा',
        gu: 'વિસ્તાર સાફ કર્યા પછી', bn: 'জায়গা পরিষ্কার করে লাগান', ta: 'பகுதி சுத்தப்படுத்திய பின்',
        te: 'ప్రదేశం శుభ్రం చేసిన తర్వాత', kn: 'ಪ್ರದೇಶ ಸ್ವಚ್ಛ ಮಾಡಿ ಹಚ್ಚಿ', ml: 'ഭാഗം വൃത്തിയാക്കി പുരട്ടുക',
        pa: 'ਖੇਤਰ ਸਾਫ਼ ਕਰਕੇ ਲਗਾਓ', ur: 'جگہ صاف کر کے لگائیں'
      },
      'Wash hands after application': {
        en: 'Wash hands after application', hi: 'लगाने के बाद हाथ धोएं', mr: 'लावल्यानंतर हात धुवा',
        gu: 'લગાવ્યા પછી હાથ ધોવો', bn: 'লাগানোর পর হাত ধুন', ta: 'தடவிய பின் கைகளை கழுவுங்கள்',
        te: 'పూసిన తర్వాత చేతులు కడుక్కోండి', kn: 'ಹಚ್ಚಿದ ನಂತರ ಕೈ ತೊಳೆಯಿರಿ', ml: 'പുരട്ടിയ ശേഷം കൈ കഴുകുക',
        pa: 'ਲਗਾਉਣ ਤੋਂ ਬਾਅਦ ਹੱਥ ਧੋਵੋ', ur: 'لگانے کے بعد ہاتھ دھوئیں'
      },
      'Avoid contact with eyes': {
        en: 'Avoid contact with eyes', hi: 'आंखों से संपर्क से बचें', mr: 'डोळ्यांशी संपर्क टाळा',
        gu: 'આંખો સાથે સ્પર્શ ટાળો', bn: 'চোখে লাগাবেন না', ta: 'கண்களில் படாமல் இருங்கள்',
        te: 'కళ్ళతో తాకించకండి', kn: 'ಕಣ್ಣಿಗೆ ತಗಲದಿರಲಿ', ml: 'കണ്ണുകളിൽ ഏൽക്കരുത്',
        pa: 'ਅੱਖਾਂ ਨਾਲ ਸੰਪਰਕ ਤੋਂ ਬਚੋ', ur: 'آنکھوں سے دور رکھیں'
      },
      'For external use only': {
        en: 'For external use only', hi: 'केवल बाहरी उपयोग के लिए', mr: 'फक्त बाह्य वापरासाठी',
        gu: 'ફક્ત બાહ્ય ઉપયોગ', bn: 'শুধু বাহ্যিক ব্যবহারের জন্য', ta: 'வெளிப்புற பயன்பாட்டிற்கு மட்டும்',
        te: 'బాహ్య వినియోగానికి మాత్రమే', kn: 'ಬಾಹ್ಯ ಬಳಕೆಗೆ ಮಾತ್ರ', ml: 'ബാഹ്യ ഉപയോഗത്തിന് മാത്രം',
        pa: 'ਸਿਰਫ਼ ਬਾਹਰੀ ਵਰਤੋਂ ਲਈ', ur: 'صرف بیرونی استعمال کے لیے'
      },
      'Do not cover with tight bandage': {
        en: 'Do not cover with tight bandage', hi: 'तंग पट्टी से न ढकें', mr: 'घट्ट पट्टीने झाकू नका',
        gu: 'ચુસ્ત પટ્ટીથી ઢાંકો નહીં', bn: 'শক্ত ব্যান্ডেজে ঢাকবেন না', ta: 'இறுக்கமான கட்டு போடாதீர்கள்',
        te: 'గట్టి కట్టుతో కప్పవద్దు', kn: 'ಬಿಗಿ ಬ್ಯಾಂಡೇಜ್ ಮಾಡಬೇಡಿ', ml: 'മുറുക്കിയ ബാൻഡേജ് ഇടരുത്',
        pa: 'ਕੱਸੀ ਪੱਟੀ ਨਾਲ ਨਾ ਢੱਕੋ', ur: 'تنگ پٹی سے نہ ڈھانپیں'
      },
      // Injection
      'IM - Intramuscular injection': {
        en: 'IM - Intramuscular injection', hi: 'IM - इंट्रामस्क्युलर इंजेक्शन', mr: 'IM - इंट्रामस्क्युलर इंजेक्शन',
        gu: 'IM - ઇન્ટ્રામસ્ક્યુલર', bn: 'IM - ইন্ট্রামাসকুলার ইনজেকশন', ta: 'IM - தசைக்குள் ஊசி',
        te: 'IM - కండర చర్మంలో ఇంజెక్షన్', kn: 'IM - ಸ್ನಾಯು ಚುಚ್ಚುಮದ್ದು', ml: 'IM - ഇൻട്രാമസ്കുലർ കുത്തിവയ്പ്',
        pa: 'IM - ਮਾਸਪੇਸ਼ੀ ਵਿੱਚ ਟੀਕਾ', ur: 'IM - عضلاتی انجیکشن'
      },
      'IV - Intravenous injection': {
        en: 'IV - Intravenous injection', hi: 'IV - इंट्रावेनस इंजेक्शन', mr: 'IV - इंट्राव्हेनस इंजेक्शन',
        gu: 'IV - ઇન્ટ્રાવેનસ', bn: 'IV - শিরাভ্যন্তর ইনজেকশন', ta: 'IV - நரம்பு ஊசி',
        te: 'IV - సిర ద్వారా ఇంజెక్షన్', kn: 'IV - ಅಭಿಧಮನಿ ಚುಚ್ಚುಮದ್ದು', ml: 'IV - ഇൻട്രാവെനസ് കുത്തിവയ്പ്',
        pa: 'IV - ਨਾੜੀ ਵਿੱਚ ਟੀਕਾ', ur: 'IV - وریدی انجیکشن'
      },
      'SC - Subcutaneous injection': {
        en: 'SC - Subcutaneous injection', hi: 'SC - सबक्यूटेनियस इंजेक्शन', mr: 'SC - सबक्यूटेनियस इंजेक्शन',
        gu: 'SC - ત્વચાની નીચે', bn: 'SC - চামড়ার নিচে ইনজেকশন', ta: 'SC - தோலுக்கு கீழ் ஊசி',
        te: 'SC - చర్మం కింద ఇంజెక్షన్', kn: 'SC - ಚರ್ಮದ ಕೆಳಗೆ ಚುಚ್ಚುಮದ್ದು', ml: 'SC - ത്വക്കിനടിയിൽ കുത്തിവയ്പ്',
        pa: 'SC - ਚਮੜੀ ਦੇ ਹੇਠਾਂ ਟੀਕਾ', ur: 'SC - جلد کے نیچے انجیکشن'
      },
      'Administer under doctor supervision': {
        en: 'Administer under doctor supervision', hi: 'डॉक्टर की निगरानी में दें', mr: 'डॉक्टरांच्या देखरेखीखाली द्या',
        gu: 'ડૉક્ટરની દેખરેખ હેઠળ', bn: 'চিকিৎসকের তত্ত্বাবধানে দিন', ta: 'மருத்துவர் கண்காணிப்பில் கொடுங்கள்',
        te: 'డాక్టర్ పర్యవేక్షణలో ఇవ్వండి', kn: 'ವೈದ್ಯರ ನಿಗಾದಲ್ಲಿ ನೀಡಿ', ml: 'ഡോക്ടർ മേൽനോട്ടത്തിൽ നൽകുക',
        pa: 'ਡਾਕਟਰ ਦੀ ਨਿਗਰਾਨੀ ਹੇਠ ਦਿਓ', ur: 'ڈاکٹر کی نگرانی میں دیں'
      },
      'Do not self-administer': {
        en: 'Do not self-administer', hi: 'खुद से न दें', mr: 'स्वतः देऊ नका',
        gu: 'જાતે ન આપો', bn: 'নিজে দেবেন না', ta: 'தானாக கொடுக்காதீர்கள்',
        te: 'స్వయంగా ఇవ్వకండి', kn: 'ಸ್ವಯಂ ನೀಡಬೇಡಿ', ml: 'സ്വയം കൊടുക്കരുത്',
        pa: 'ਆਪਣੇ ਆਪ ਨਾ ਦਿਓ', ur: 'خود انجیکشن نہ لگائیں'
      },
      // Inhaler
      'Inhale as directed': {
        en: 'Inhale as directed', hi: 'निर्देशानुसार श्वास लें', mr: 'निर्देशाप्रमाणे श्वास घ्या',
        gu: 'નિર્દેશ મુજબ શ્વાસ લો', bn: 'নির্দেশমতো শ্বাস নিন', ta: 'வழிகாட்டல்படி சுவாசிக்கவும்',
        te: 'నిర్దేశాల ప్రకారం శ్వాసించండి', kn: 'ನಿರ್ದೇಶನದಂತೆ ಉಸಿರಾಡಿ', ml: 'നിർദ്ദേശ പ്രകാരം ശ്വസിക്കുക',
        pa: 'ਨਿਰਦੇਸ਼ ਅਨੁਸਾਰ ਸਾਹ ਲਓ', ur: 'ہدایت کے مطابق سانس لیں'
      },
      'Rinse mouth after use': {
        en: 'Rinse mouth after use', hi: 'उपयोग के बाद मुंह धोएं', mr: 'वापरल्यानंतर तोंड धुवा',
        gu: 'ઉપયોગ પછી મોં ધોવો', bn: 'ব্যবহারের পর মুখ ধুন', ta: 'பயன்படுத்திய பின் வாய் கொப்பளிக்கவும்',
        te: 'ఉపయోగించిన తర్వాత నోరు పుక్కిలించండి', kn: 'ಬಳಸಿದ ನಂತರ ಬಾಯಿ ತೊಳೆಯಿರಿ', ml: 'ഉപയോഗ ശേഷം വായ കഴുകുക',
        pa: 'ਵਰਤੋਂ ਤੋਂ ਬਾਅਦ ਮੂੰਹ ਧੋਵੋ', ur: 'استعمال کے بعد منہ دھوئیں'
      },
      // Powder / Sachet
      'Mix with water before use': {
        en: 'Mix with water before use', hi: 'उपयोग से पहले पानी में मिलाएं', mr: 'वापरण्यापूर्वी पाण्यात मिसळा',
        gu: 'ઉપયોગ પહેલાં પાણીમાં ભેળવો', bn: 'ব্যবহারের আগে পানিতে মেশান', ta: 'பயன்படுத்தும் முன் தண்ணீரில் கலக்கவும்',
        te: 'వాడే ముందు నీళ్ళలో కలపండి', kn: 'ಬಳಕೆ ಮೊದಲು ನೀರಿನಲ್ಲಿ ಬೆರೆಸಿ', ml: 'ഉപയോഗിക്കുന്നതിന് മുൻപ് വെള്ളത്തിൽ കലക്കുക',
        pa: 'ਵਰਤੋਂ ਤੋਂ ਪਹਿਲਾਂ ਪਾਣੀ ਵਿੱਚ ਮਿਲਾਓ', ur: 'استعمال سے پہلے پانی میں ملائیں'
      },
      'Mix in 1 glass of water': {
        en: 'Mix in 1 glass of water', hi: '1 गिलास पानी में मिलाएं', mr: '1 ग्लास पाण्यात मिसळा',
        gu: '1 ગ્લાસ પાણીમાં ભેળવો', bn: '১ গ্লাস পানিতে মেশান', ta: '1 கிளாஸ் தண்ணீரில் கலக்கவும்',
        te: '1 గ్లాసు నీళ్ళలో కలపండి', kn: '1 ಗ್ಲಾಸ್ ನೀರಿನಲ್ಲಿ ಬೆರೆಸಿ', ml: '1 ഗ്ലാസ് വെള്ളത്തിൽ കലക്കുക',
        pa: '1 ਗਿਲਾਸ ਪਾਣੀ ਵਿੱਚ ਮਿਲਾਓ', ur: '1 گلاس پانی میں ملائیں'
      },
      // Syrup
      'Shake well before use': {
        en: 'Shake well before use', hi: 'उपयोग से पहले अच्छी तरह हिलाएं', mr: 'वापरण्यापूर्वी चांगले हलवा',
        gu: 'ઉપયોગ પહેલાં બરાબર હલાવો', bn: 'ব্যবহারের আগে ভালো করে ঝাঁকান', ta: 'பயன்படுத்தும் முன் நன்றாக குலுக்கவும்',
        te: 'వాడే ముందు బాగా కుదపండి', kn: 'ಬಳಕೆ ಮೊದಲು ಚೆನ್ನಾಗಿ ಅಲ್ಲಾಡಿಸಿ', ml: 'ഉപയോഗിക്കുന്നതിന് മുൻപ് നന്നായി കുലുക്കുക',
        pa: 'ਵਰਤੋਂ ਤੋਂ ਪਹਿਲਾਂ ਚੰਗੀ ਤਰ੍ਹਾਂ ਹਿਲਾਓ', ur: 'استعمال سے پہلے اچھی طرح ہلائیں'
      },
      'Use measuring spoon/cup': {
        en: 'Use measuring spoon/cup', hi: 'नापने वाले चम्मच/कप का उपयोग करें', mr: 'मापाचा चमचा/कप वापरा',
        gu: 'માપવાળો ચમચો/કપ ઉપયોગ કરો', bn: 'মাপার চামচ/কাপ ব্যবহার করুন', ta: 'அளவு கரண்டி/கப் பயன்படுத்துங்கள்',
        te: 'కొలత చెంచా/కప్పు వాడండి', kn: 'ಮಾಪನ ಚಮಚ/ಕಪ್ ಬಳಸಿ', ml: 'അളക്കുന്ന കരണ്ടി/കപ്പ് ഉപയോഗിക്കുക',
        pa: 'ਮਾਪਣ ਵਾਲਾ ਚਮਚ/ਕੱਪ ਵਰਤੋ', ur: 'پیمائش چمچ/کپ استعمال کریں'
      },
      'Refrigerate after opening': {
        en: 'Refrigerate after opening', hi: 'खोलने के बाद फ्रिज में रखें', mr: 'उघडल्यानंतर फ्रिजमध्ये ठेवा',
        gu: 'ખોલ્યા પછી ફ્રિઝ', bn: 'খোলার পর ফ্রিজে রাখুন', ta: 'திறந்த பிறகு குளிர்விக்கவும்',
        te: 'తెరిచిన తర్వాత రిఫ్రిజిరేటర్లో ఉంచండి', kn: 'ತೆರೆದ ನಂತರ ಫ್ರಿಜ್ ಮಾಡಿ', ml: 'തുറന്ന ശേഷം ഫ്രിഡ്ജിൽ സൂക്ഷിക്കുക',
        pa: 'ਖੋਲ੍ਹਣ ਤੋਂ ਬਾਅਦ ਫ੍ਰਿੱਜ਼ ਵਿੱਚ ਰੱਖੋ', ur: 'کھولنے کے بعد فریج میں رکھیں'
      },
      'After food to avoid gastric irritation': {
        en: 'After food to avoid gastric irritation',
        hi: 'गैस्ट्रिक जलन से बचने के लिए खाने के बाद',
        mr: 'जठरामाशयीय जलनापासून बचण्यासाठी खाण्यानंतर', gu: 'ગેસ્ટ્રિક બળતરા ટાળવા ખાણ પછી', bn: 'গ্যাস্ট্রিক জ্বালা এড়াতে খাবার পরে', ta: 'வயிற்று எரிச்சல் தவிர்க்க', te: 'గ్యాస్ట్రిక్ జ్వలన నివారణకు', kn: 'ಜಠರ ಉರಿ ತಪ್ಪಿಸಲು', ml: 'ഗ്യാസ്ട്രിക് ഒഴിവാക്കാൻ', pa: 'ਗੈਸਟ੍ਰਿਕ ਜਲਨ ਤੋਂ ਬਚੋ', ur: 'گیسٹرک جلن سے بچیں'
      },
      'Take with water': {
        en: 'Take with water',
        hi: 'पानी के साथ लें',
        mr: 'पाण्याबरोबर घ्या', gu: 'પાણી સાથે લો', bn: 'পানি দিয়ে নিন', ta: 'தண்ணீருடன் எடுக்கவும்', te: 'నీటితో తీసుకోండి', kn: 'ನೀರಿನೊಂದಿಗೆ', ml: 'വെള്ളത്തോടൊപ്പം', pa: 'ਪਾਣੀ ਨਾਲ ਲਓ', ur: 'پانی کے ساتھ لیں'
      },
      'May cause mild drowsiness': {
        en: 'May cause mild drowsiness',
        hi: 'हल्की नींद आ सकती है',
        mr: 'हल्की निंद्रा येऊ शकते', gu: 'હળવી ઊંઘ આવી શકે', bn: 'হালকা ঘুম আসতে পারে', ta: 'லேசான தூக்கம் வரலாம்', te: 'తేలికపాటి నిద్ర రావచ్చు', kn: 'ಸ್ವಲ್ಪ ಮಂಪರು ಬರಬಹುದು', ml: 'ലഘുവായ ഉറക്കം വരാം', pa: 'ਹਲਕੀ ਨੀਂਦ ਆ ਸਕਦੀ ਹੈ', ur: 'ہلکی نیند آ سکتی ہے'
      },
      'Take at onset of headache': {
        en: 'Take at onset of headache',
        hi: 'सिरदर्द की शुरुआत में लें',
        mr: 'डोकेदुखी सुरू होताच घ्या', gu: 'માથાનો દુ:ખાવો શરૂ થાય ત્યારે', bn: 'মাথাব্যথা শুরুতে নিন', ta: 'தலைவலி ஆரம்பத்தில்', te: 'తలనొప్పి మొదలైనప్పుడు', kn: 'ತಲೆನೋವು ಪ್ರಾರಂಭದಲ್ಲಿ', ml: 'തലവേദന തുടങ്ങുമ്പോൾ', pa: 'ਸਿਰਦਰਦ ਸ਼ੁਰੂ ਹੋਣ ਤੇ', ur: 'سردرد شروع ہونے پر'
      },
      'Preventive. Continue for 1 month.': {
        en: 'Preventive. Continue for 1 month.',
        hi: 'निवारक। 1 महीने तक जारी रखें।',
        mr: 'प्रতिबंधक। 1 महिन्यासाठी सुरू ठेवा।'
      },
      'For nausea and vomiting': {
        en: 'For nausea and vomiting',
        hi: 'मतली और उल्टी के लिए',
        mr: 'मळमळीक आणि उल्टीसाठी', gu: 'ઉલ્ટી અને ઉબકા માટે', bn: 'বমিভাব ও বমির জন্য', ta: 'குமட்டல் மற்றும் வாந்திக்கு', te: 'వికారం మరియు వాంతికి', kn: 'ವಾಕರಿಕೆ ಮತ್ತು ವಾಂತಿಗಾಗಿ', ml: 'ഓക്കാനം, ഛർദ്ദിക്ക്', pa: 'ਮਤਲੀ ਅਤੇ ਉਲਟੀ ਲਈ', ur: 'متلی اور الٹی کے لیے'
      },
      'Take 30 min before food': {
        en: 'Take 30 min before food',
        hi: 'खाने से 30 मिनट पहले लें',
        mr: 'खाण्यापूर्वी 30 मिनिटे आधी घ्या', gu: 'ખાણ પહેલાં ૩૦ મિ.ના.', bn: 'খাবার ৩০ মিনিট আগে', ta: 'உணவுக்கு 30 நிமிடம் முன்', te: 'భోజనానికి 30 నిముషాల ముందు', kn: 'ಊಟಕ್ಕಿಂತ 30 ನಿಮಿಷ ಮೊದಲು', ml: 'ഭക്ഷണത്തിന് 30 മിനിറ്റ് മുമ്പ്', pa: 'ਖਾਣੇ ਤੋਂ 30 ਮਿੰਟ ਪਹਿਲਾਂ', ur: 'کھانے سے 30 منٹ پہلے'
      },
      'Take on empty stomach': {
        en: 'Take on empty stomach',
        hi: 'खाली पेट पर लें',
        mr: 'रिकाम्या पोटी घ्या', gu: 'ખાલી પેટ લો', bn: 'খালি পেটে নিন', ta: 'வெறும் வயிற்றில்', te: 'ఖాళీ కడుపుతో', kn: 'ಖಾಲಿ ಹೊಟ್ಟೆಯಲ್ಲಿ', ml: 'വെറും വയറ്റിൽ', pa: 'ਖਾਲੀ ਪੇਟ ਲਓ', ur: 'خالی پیٹ لیں'
      },
      'Protective coating for stomach': {
        en: 'Protective coating for stomach',
        hi: 'पेट के लिए सुरक्षात्मक कोटिंग',
        mr: 'पोटासाठी संरक्षक कोटिंग', gu: 'પેટ માટે સંરક્ષણ', bn: 'পেটের সুরক্ষা', ta: 'வயிற்று பாதுகாப்புக்கு', te: 'కడుపు రక్షణకు', kn: 'ಹೊಟ್ಟೆ ರಕ್ಷಣೆಗಾಗಿ', ml: '胃 സംരക്ഷണത്തിന്', pa: 'ਪੇਟ ਦੀ ਸੁਰੱਖਿਆ', ur: 'پیٹ کی حفاظت'
      },
      'For sudden pain relief': {
        en: 'For sudden pain relief',
        hi: 'अचानक दर्द से राहत के लिए',
        mr: 'अचानक दुखापुरठे मदतीसाठी', gu: 'અચાનક દર્દ માટે', bn: 'হঠাৎ ব্যথা উপশমে', ta: 'திடீர் வலி நிவாரணத்திற்கு', te: 'హఠాత్తు నొప్పి నివారణకు', kn: 'ಇದ್ದಕ್ಕಿದ್ದಂತೆ ನೋವು ನಿವಾರಣೆ', ml: 'പെട്ടെന്നുള്ള വേദന ശമനം', pa: 'ਅਚਾਨਕ ਦਰਦ ਰਾਹਤ', ur: 'اچانک درد کے لیے'
      },
      'Long-acting ACE inhibitor': {
        en: 'Long-acting ACE inhibitor',
        hi: 'दीर्घकालिक ACE अवरोधक',
        mr: 'दीर्घ-कार्यरत ACE प्रतिबंधक', gu: 'દીર્ઘ-ક્રિયાશીલ ACE અવરોધક', bn: 'দীর্ঘ-কার্যকর ACE ইনহিবিটর', ta: 'நீண்ட ACE தடுப்பி', te: 'దీర్ఘ-చర్య ACE నిరోధకం', kn: 'ದೀರ್ಘ-ಕ್ರಿಯೆ ACE', ml: 'ദീർഘ-ക്രിയ ACE', pa: 'ਲੰਮੇ ACE', ur: 'طویل عمل ACE'
      },
      'ACE inhibitor for BP control': {
        en: 'ACE inhibitor for BP control',
        hi: 'रक्तचाप नियंत्रण के लिए ACE अवरोधक',
        mr: 'BP नियंत्रणासाठी ACE प्रतिबंधक', gu: 'BP નિયંત્રણ માટે ACE', bn: 'BP নিয়ন্ত্রণে ACE', ta: 'BP கட்டுப்பாட்டுக்கு ACE', te: 'BP నియంత్రణకు ACE', kn: 'BP ನಿಯಂತ್ರಣಕ್ಕೆ ACE', ml: 'BP നിയന്ത്രണത്തിന് ACE', pa: 'BP ਕੰਟਰੋਲ ACE', ur: 'BP کنٹرول ACE'
      },
      'Take with water, do not exceed recommended dose': {
        en: 'Take with water, do not exceed recommended dose',
        hi: 'पानी के साथ लें, अनुशंसित खुराक से अधिक न लें',
        mr: 'पाण्याबरोबर घ्या, शिफारस केलेल्या डोसपेक्षा जास्त घेऊ नका', gu: 'પાણી સાથે, ભલામણ ડોઝ ન વધારો', bn: 'পানিসহ, প্রস্তাবিত মাত্রা নয়', ta: 'தண்ணீருடன், அளவு மீறாதீர்கள்', te: 'నీటితో, సిఫారసు మోతాదు మించవద్దు', kn: 'ನೀರಿನೊಂದಿಗೆ, ಶಿಫಾರಸು ಮಾತ್ರೆ ಮೀರಬೇಡಿ', ml: 'വെള്ളത്തോടൊപ്പം, ശിപാർശ ഡോസ് കവിക്കരുത്', pa: 'ਪਾਣੀ ਨਾਲ, ਸਿਫਾਰਸ਼ ਖੁਰਾਕ ਨਾ ਵਧਾਓ', ur: 'پانی کے ساتھ، تجویز خوراک نہ بڑھائیں'
      },
      'Take as prescribed by doctor': {
        en: 'Take as prescribed by doctor',
        hi: 'डॉक्टर के निर्देशानुसार लें',
        mr: 'डॉक्टरांच्या सल्ल्यानुसार घ्या',
        gu: 'ડૉક્ટરના સૂચન મુજબ લો', bn: 'ডাক্তারের পরামর্শ মতো নিন', ta: 'மருத்துவர் அறிவுரைப்படி', te: 'డాక్టర్ సూచన ప్రకారం', kn: 'ವೈದ್ಯರ ಸಲಹೆಯಂತೆ', ml: 'ഡോക്ടറുടെ നിർദ്ദേശ പ്രകാരം', pa: 'ਡਾਕਟਰ ਦੇ ਨਿਰਦੇਸ਼ਾਂ ਅਨੁਸਾਰ', ur: 'ڈاکٹر کی ہدایت کے مطابق'
      },
      'As directed by physician': {
        en: 'As directed by physician',
        hi: 'चिकित्सक के निर्देशानुसार',
        mr: 'डॉक्टरांच्या सल्ल्यानुसार', gu: 'ડૉક્ટરના નિર્દેશ મુજબ', bn: 'চিকিৎসকের নির্দেশ মতো', ta: 'மருத்துவர் கட்டளைப்படி', te: 'వైద్యుని నిర్దేశం ప్రకారం', kn: 'ವೈದ್ಯರ ನಿರ್ದೇಶನದಂತೆ', ml: 'ഡോക്ടർ നിർദ്ദേശ പ്രകാരം', pa: 'ਡਾਕਟਰ ਦੀ ਹਿਦਾਇਤ ਅਨੁਸਾਰ', ur: 'معالج کی ہدایت کے مطابق'
      },
      'Take after meals': {
        en: 'Take after meals',
        hi: 'खाने के बाद लें',
        mr: 'जेवणानंतर घ्या', gu: 'ભોજન પછી', bn: 'খাবার পরে নিন', ta: 'உணவுக்குப் பிறகு', te: 'భోజనం తర్వాత', kn: 'ಊಟದ ನಂತರ', ml: 'ഭക്ഷണത്തിനു ശേഷം', pa: 'ਖਾਣੇ ਤੋਂ ਬਾਅਦ', ur: 'کھانے کے بعد لیں'
      },
      'Take before meals': {
        en: 'Take before meals',
        hi: 'खाने से पहले लें',
        mr: 'जेवणापूर्वी घ्या', gu: 'ભોજન પહેલાં', bn: 'খাবার আগে নিন', ta: 'உணவுக்கு முன்', te: 'భోజనానికి ముందు', kn: 'ಊಟಕ್ಕಿಂತ ಮೊದಲು', ml: 'ഭക്ഷണത്തിനു മുമ്പ്', pa: 'ਖਾਣੇ ਤੋਂ ਪਹਿਲਾਂ', ur: 'کھانے سے پہلے لیں'
      },
      'Do not crush or chew': {
        en: 'Do not crush or chew',
        hi: 'कुचलें या चबाएं नहीं',
        mr: 'कुस्करू किंवा चावू नका', gu: 'ચૂર્ણ કે ચાવવું નહીં', bn: 'চূর্ণ বা চিবাবেন না', ta: 'நசுக்கவோ மெல்லவோ வேண்டாம்', te: 'పిండి చేయవద్దు', kn: 'ಪುಡಿ ಮಾಡಬೇಡಿ', ml: 'പൊടിക്കരുത്', pa: 'ਕੁਚਲੋ ਜਾਂ ਚਬਾਓ ਨਾ', ur: 'پیسیں یا چبائیں نہیں'
      },
      'Avoid alcohol': {
        en: 'Avoid alcohol',
        hi: 'शराब से बचें',
        mr: 'मद्यपान टाळा', gu: 'દારૂ ટાળો', bn: 'মদ এড়িয়ে চলুন', ta: 'மது தவிர்க்கவும்', te: 'మద్యం నివారించండి', kn: 'ಮದ್ಯ ತ್ಯಜಿಸಿ', ml: 'മദ്യം ഒഴിവാക്കുക', pa: 'ਸ਼ਰਾਬ ਤੋਂ ਬਚੋ', ur: 'شراب سے پرہیز'
      },
      'Take at bedtime': {
        en: 'Take at bedtime',
        hi: 'सोते समय लें',
        mr: 'झोपण्यापूर्वी घ्या', gu: 'સૂતી વખતે', bn: 'শোওয়ার আগে', ta: 'தூங்குவதற்கு முன்', te: 'పడుకోవడానికి ముందు', kn: 'ಮಲಗುವ ಮೊದಲು', ml: 'ഉറങ്ങുന്നതിന് മുൻപ്', pa: 'ਸੌਣ ਵੇਲੇ', ur: 'سونے سے پہلے'
      },
      'Complete the full course': {
        en: 'Complete the full course',
        hi: 'पूरा कोर्स पूरा करें',
        mr: 'संपूर्ण कोर्स पूर्ण करा', gu: 'પૂરો કોર્સ પૂર્ણ કરો', bn: 'সম্পূর্ণ কোর্স শেষ করুন', ta: 'முழு கோர்ஸ் முடிக்கவும்', te: 'పూర్తి కోర్సు పూర్తి చేయండి', kn: 'ಸಂಪೂರ್ಣ ಕೋರ್ಸ್ ಮುಗಿಸಿ', ml: 'പൂർണ കോഴ്സ് പൂർത്തിയാക്കുക', pa: 'ਪੂਰਾ ਕੋਰਸ ਕਰੋ', ur: 'پورا کورس مکمل کریں'
      },
      'For fever and pain': {
        en: 'For fever and pain',
        hi: 'बुखार और दर्द के लिए',
        mr: 'ताप आणि वेदनांसाठी', gu: 'તાવ અને દર્દ માટે', bn: 'জ্বর ও ব্যথার জন্য', ta: 'காய்ச்சல் மற்றும் வலிக்கு', te: 'జ్వరం మరియు నొప్పికి', kn: 'ಜ್ವರ ಮತ್ತು ನೋವಿಗೆ', ml: 'പനി, വേദനയ്ക്ക്', pa: 'ਬੁਖ਼ਾਰ ਅਤੇ ਦਰਦ ਲਈ', ur: 'بخار اور درد کے لیے'
      },
      'For cough': {
        en: 'For cough',
        hi: 'खांसी के लिए',
        mr: 'खोकल्यासाठी', gu: 'ઉધરસ માટે', bn: 'কাশির জন্য', ta: 'இருமலுக்கு', te: 'దగ్గుకు', kn: 'ಕೆಮ್ಮಿಗೆ', ml: 'ചുമക്ക്', pa: 'ਖੰਘ ਲਈ', ur: 'کھانسی کے لیے'
      },
      'For allergy': {
        en: 'For allergy',
        hi: 'एलर्जी के लिए',
        mr: 'अॅलर्जीसाठी', gu: 'એલર્જી માટે', bn: 'অ্যালার্জির জন্য', ta: 'ஒவ்வாமைக்கு', te: 'అలెర్జీకి', kn: 'ಅಲರ್ಜಿಗೆ', ml: 'അലർജിക്ക്', pa: 'ਐਲਰਜੀ ਲਈ', ur: 'الرجی کے لیے'
      },
      'For acidity': {
        en: 'For acidity',
        hi: 'एसिडिटी के लिए',
        mr: 'अॅसिडिटीसाठी', gu: 'એસિડિટી માટે', bn: 'অ্যাসিডিটির জন্য', ta: 'அமிலத்தன்மைக்கு', te: 'యాసిడిటీకి', kn: 'ಆಮ್ಲೀಯತೆಗೆ', ml: 'അസിഡിറ്റിക്ക്', pa: 'ਐਸੀਡਿਟੀ ਲਈ', ur: 'تیزابیت کے لیے'
      },
      'SOS - take only when needed': {
        en: 'SOS - take only when needed',
        hi: 'SOS - जरूरत पड़ने पर ही लें',
        mr: 'SOS - गरज असेल तेव्हाच घ्या', gu: 'SOS - જ્યારે જરૂર હોય ત્યારે', bn: 'SOS - প্রয়োজনে নিন', ta: 'SOS - தேவைப்படும்போது', te: 'SOS - అవసరమైనప్పుడు', kn: 'SOS - ಅಗತ್ಯ ಇದ್ದಾಗ ಮಾತ್ರ', ml: 'SOS - ആവശ്യമെങ്കിൽ', pa: 'SOS - ਲੋੜ ਪੈਣ ਤੇ', ur: 'SOS - ضرورت پر ہی'
      },
      'Apply locally': {
        en: 'Apply locally',
        hi: 'स्थानीय रूप से लगाएं',
        mr: 'स्थानिकपणे लावा', gu: 'સ્થાનિક રૂપે લગાવો', bn: 'স্থানীয়ভাবে লাগান', ta: 'உள்ளூரில் தடவுங்கள்', te: 'స్థానికంగా వేయండి', kn: 'ಸ್ಥಳೀಯವಾಗಿ ಲೇಪಿಸಿ', ml: 'പ്രാദേശികമായി പ്രയോഗിക്കുക', pa: 'ਸਥਾਨਕ ਤੌਰ ਤੇ ਲਗਾਓ', ur: 'مقامی طور پر لگائیں'
      },
      'After food': { en: 'After food', hi: 'खाने के बाद', mr: 'जेवणानंतर', bn: 'খাবারের পরে', gu: 'ખાણ પછી', ta: 'உணவுக்குப் பின்', te: 'భోజనం తర్వాత', kn: 'ನುಡಪಾ ನಂತರ', ml: 'ഭക്ഷണത്തിനു ശേഷം', pa: 'ਖਾਣ ਤੋਂ ਬਾਅਦ', ur: 'کھانے کے بعد' },
  'Before food': { en: 'Before food', hi: 'खाने से पहले', mr: 'जेवणापूर्वी', bn: 'খাবারের আগে', gu: 'ખાણ પહેલાં', ta: 'உணவுக்கு முன்', te: 'భోజనానికి ముందు', kn: 'ನುಡೆಕ್ಕೂ ಮೊದಲು', ml: 'ഭക്ഷണത്തിനു മുമ്പ്', pa: 'ਖਾਣ ਤੋਂ ਪਹਿਲਾਂ', ur: 'کھانے سے پہلے' },
  'For fever reduction': { en: 'For fever reduction', hi: 'बुखार कम करने के लिए', mr: 'ताप कमी करण्यासाठी', bn: 'জ্বর কমাতে', gu: 'તાવ ઘટાડવા માટે', ta: 'காய்ச்சலை குறைக்க', te: 'జ్వరం తగ్గించడానికి', kn: 'ಜ್ವರ ಕಡಿಮೆ ಮಾಡಲು', ml: 'പനി കുറയ്ക്കാന്', pa: 'ਬੁਖ਼ਾਰ ਘਟਾਉਣ ਲਈ', ur: 'بخار کم کرنے کے لیے' },
  'Anti-inflammatory': { en: 'Anti-inflammatory', hi: 'सूजन-रोधी', mr: 'दाहशामक', bn: 'প্রদাহ-বিরোধী', gu: 'સોજા-વિરોધી', ta: 'அழற்சி எதிர்ப்பு', te: 'వాపు నిరోధక', kn: 'ಉರಿಯೂತ ನಿರೋಧಕ', ml: 'വേദനാ-ജ്വലന-വിരുദ്ധ', pa: 'ਸੋਜ਼ਸ਼-ਵਿਰੋਧੀ', ur: 'سوزش مخالف' },
  'For hydration': { en: 'For hydration', hi: 'हाइड्रेशन के लिए', mr: 'हायड्रेशनसाठी', bn: 'হাইড্রেশনের জন্য', gu: 'હાઇડ્રેશન માટે', ta: 'நீரேற்றத்திற்கு', te: 'హైడ్రేషన్ కోసం', kn: 'ಹೈಡ್ರೇಷನ್ ಗಾಗಿ', ml: 'ജലാംശ നൽകാന്', pa: 'ਪਾਣੀ ਦੀ ਮਾਤਰਾ ਲਈ', ur: 'پانی کی کمی پوری کرنے کے لیے' },
  'For hydration and electrolytes': { en: 'For hydration and electrolytes', hi: 'हाइड्रेशन और इलेक्ट्रोलाइट के लिए', mr: 'हायड्रेशन व इलेक्ट्रोलाइटसाठी', bn: 'হাইড্রেশন ও ইলেকট্রোলাইটের জন্য', gu: 'હાઇડ્રેશન અને ઇલેક્ટ્રોલાઇટ માટે', ta: 'நீரேற்றம் மற்றும் எலெக்ட்ரோலைட்டிற்கு', te: 'హైడ్రేషన్ మరియు ఎలక్ట్రోలైట్ కోసం', kn: 'ಹೈಡ್ರೇಷನ್ ಮತ್ತು ಎಲೆಕ್ಟ್ರೋಲೈಟ್ ಗಾಗಿ', ml: 'ജലാംശത്തിനും ഇലക്ട്രോലൈറ്റിനും', pa: 'ਪਾਣੀ ਅਤੇ ਇਲੈਕਟ੍ਰੋਲਾਈਟ ਲਈ', ur: 'پانی اور الیکٹرولائٹ کے لیے' },
  'For pain relief': { en: 'For pain relief', hi: 'दर्द से राहत के लिए', mr: 'वेदना कमी करण्यासाठी', bn: 'ব্যথা উপশমের জন্য', gu: 'ਦર્દ રાહાત માટે', ta: 'வலி நிவாரணத்திற்கு', te: 'నొప్పి నివారణకు', kn: 'ನೋವು ಪರಿಹಾರಕ್ಕೆ', ml: 'വേദന ശമനത്തിന്', pa: 'ਦਰਦ ਰਾਹਤ ਲਈ', ur: 'درد سے آرام کے لیے' },
  'For infection': { en: 'For infection', hi: 'संक्रमण के लिए', mr: 'संसर्गासाठी', bn: 'सংক্রমণের জন্য', gu: 'ચેપ માટે', ta: 'தொற்றுக்கு', te: 'ఇన్ఫెక్షన్ కోసం', kn: 'ಸೋಂಕಿಗೆ', ml: 'അണുബാധയ്ക്ക്', pa: 'ਇਨਫੈਕਸ਼ਨ ਲਈ', ur: 'انفیکشن کے لیے' },
  'For diabetes': { en: 'For diabetes', hi: 'मधुमेह के लिए', mr: 'मधुमेहासाठी', bn: 'ডায়াবেটিসের জন্য', gu: 'ડાયાબિટિઝ માટે', ta: 'நீரிழிவுக்கு', te: 'మధుమేహానికి', kn: 'ಮಧುಮೇಹಕ್ಕೆ', ml: 'പ്രമേഹത്തിന്', pa: 'ਸ਼ੂਗਰ ਲਈ', ur: 'ذیابطیس کے لیے' },
  'For blood pressure': { en: 'For blood pressure', hi: 'रक्तचाप के लिए', mr: 'रक्तदाबासाठी', bn: 'রক্তচাপের জন্য', gu: 'BP માટે', ta: 'இரத்த அழுத்தத்திற்கு', te: 'రక్తపోటుకు', kn: 'ರಕ್ತದ ಒತ್ತಡಕ್ಕೆ', ml: 'രക്തസമ്മര്ദ്ദത്തിന്', pa: 'ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ ਲਈ', ur: 'بلڈ پریشر کے لیے' },
};


// Parse frequency string to doses per day
function parseDosesPerDay(freq) {
  if (!freq) return 0;
  const f = freq.trim().toLowerCase();
  // Handle dash-separated: "1-0-1", "1/2-1/2-1/2", "1-1-1-1"
  if (/^[\d/]+(-[\d/]+)+$/.test(f)) {
    return f.split('-').reduce((sum, part) => {
      if (part.includes('/')) {
        const [num, den] = part.split('/').map(Number);
        return sum + (den ? num / den : 0);
      }
      return sum + (parseFloat(part) || 0);
    }, 0);
  }
  // Named frequencies
  if (f === 'once daily' || f === 'od') return 1;
  if (f === 'twice daily' || f === 'bd' || f === 'bid') return 2;
  if (f === 'three times daily' || f === 'tds' || f === 'tid') return 3;
  if (f === 'four times daily' || f === 'qid') return 4;
  if (f === 'every 8 hours') return 3;
  if (f === 'every 12 hours') return 2;
  if (f === 'weekly') return 1 / 7;
  if (f === 'sos' || f === 'stat') return 1;
  return 0;
}

// Parse duration string to number of days
function parseDurationDays(dur) {
  if (!dur) return 0;
  const d = dur.trim().toLowerCase();
  // "3-5 days" → use max (5)
  let match = d.match(/(\d+)\s*[-–]\s*(\d+)\s*(day|week|month)/i);
  if (match) {
    const max = parseInt(match[2]);
    if (match[3].startsWith('week')) return max * 7;
    if (match[3].startsWith('month')) return max * 30;
    return max;
  }
  // "7 days", "2 weeks", "1 month"
  match = d.match(/(\d+)\s*(day|week|month)/i);
  if (match) {
    const num = parseInt(match[1]);
    if (match[2].startsWith('week')) return num * 7;
    if (match[2].startsWith('month')) return num * 30;
    return num;
  }
  // Just a number
  const num = parseInt(d);
  return isNaN(num) ? 0 : num;
}

function calcQty(frequency, duration) {
  const perDay = parseDosesPerDay(frequency);
  const days = parseDurationDays(duration);
  if (perDay > 0 && days > 0) return Math.ceil(perDay * days);
  return 0;
}

function localizeDoseParts(lang) {
  const l = lang || 'en';
  const map = {
    en: {
      morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
      before: 'Before', after: 'After', with: 'With', meal: 'Meal',
      breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner',
      emptyStomach: 'Empty Stomach', plus: ' + ',
      take: 'Take', and: ' and ', localNumerals: false,
      forms: { tablet: 'Tablet', capsule: 'Capsule', syrup: 'Syrup', injection: 'Injection', drops: 'Drops', inhaler: 'Inhaler' },
      timesPerDay: { 1: 'once daily', 2: 'twice daily', 3: 'three times daily', 4: 'four times daily' },
      afterMeals: { breakfast: 'after breakfast', lunch: 'after lunch', dinner: 'after dinner', meal: 'after meal' },
      beforeMeals: { breakfast: 'before breakfast', lunch: 'before lunch', dinner: 'before dinner', meal: 'before meal' },
      withMeals: { breakfast: 'with breakfast', lunch: 'with lunch', dinner: 'with dinner', meal: 'with meal' },
    },
    hi: {
      morning: 'सुबह', afternoon: 'दोपहर', evening: 'रात', before: 'पहले', after: 'बाद', with: 'साथ',
      meal: 'खाना', breakfast: 'नाश्ता', lunch: 'दोपहर का खाना', dinner: 'रात का खाना',
      emptyStomach: 'खाली पेट', plus: ' और ',
      take: 'लें', and: ' और ', localNumerals: true,
      doseOrder: 'timing-first', durationSep: ', ', sentenceEnd: '.', preferSlotFormat: true,
      forms: { tablet: 'गोली', capsule: 'कैप्सूल', syrup: 'सिरप', injection: 'इंजेक्शन', drops: 'बूंदें', inhaler: 'इनहेलर' },
      timesPerDay: { 1: 'दिन में एक बार', 2: 'दिन में दो बार', 3: 'दिन में तीन बार', 4: 'दिन में चार बार' },
      afterMeals: { breakfast: 'नाश्ते के बाद', lunch: 'दोपहर के खाने के बाद', dinner: 'रात के खाने के बाद', meal: 'खाने के बाद' },
      beforeMeals: { breakfast: 'नाश्ते से पहले', lunch: 'दोपहर के खाने से पहले', dinner: 'रात के खाने से पहले', meal: 'खाने से पहले' },
      withMeals: { breakfast: 'नाश्ते के साथ', lunch: 'दोपहर के खाने के साथ', dinner: 'रात के खाने के साथ', meal: 'खाने के साथ' },
    },
    mr: {
      morning: 'सकाळी', afternoon: 'दुपारी', evening: 'रात्री', before: 'आधी', after: 'नंतर', with: 'सोबत',
      meal: 'जेवण', breakfast: 'नाश्ता', lunch: 'दुपारचे जेवण', dinner: 'रात्रीचे जेवण',
      emptyStomach: 'रिकाम्या पोटी', plus: ' व ',
      take: 'घ्यावी', and: ' व ', localNumerals: true,
      doseOrder: 'timing-first', durationSep: ', ', sentenceEnd: '.', preferSlotFormat: true,
      forms: { tablet: 'गोळी', capsule: 'कॅप्सूल', syrup: 'सिरप', injection: 'इंजेक्शन', drops: 'थेंब', inhaler: 'इनहेलर' },
      timesPerDay: { 1: 'दिवसातून एकदा', 2: 'दिवसातून दोनदा', 3: 'दिवसातून तीनदा', 4: 'दिवसातून चारदा' },
      afterMeals: { breakfast: 'नाश्यानंतर', lunch: 'दुपारच्या जेवणानंतर', dinner: 'रात्रीच्या जेवणानंतर', meal: 'जेवणानंतर' },
      beforeMeals: { breakfast: 'नाश्याआधी', lunch: 'दुपारच्या जेवणाआधी', dinner: 'रात्रीच्या जेवणाआधी', meal: 'जेवणाआधी' },
      withMeals: { breakfast: 'नाश्यासोबत', lunch: 'दुपारच्या जेवणासोबत', dinner: 'रात्रीच्या जेवणासोबत', meal: 'जेवणासोबत' },
    },
    bn: {
      morning: 'সকালে', afternoon: 'দুপুরে', evening: 'রাতে', before: 'আগে', after: 'পরে', with: 'সাথে',
      meal: 'খাবার', breakfast: 'সকালের খাবার', lunch: 'দুপুরের খাবার', dinner: 'রাতের খাবার',
      emptyStomach: 'খালি পেটে', plus: ' এবং ',
      take: 'নিন', and: ' এবং ', localNumerals: false,
      doseOrder: 'timing-first', durationSep: ', ', sentenceEnd: '.', preferSlotFormat: true,
      forms: { tablet: 'ট্যাবলেট', capsule: 'ক্যাপসুল', syrup: 'সিরাপ', injection: 'ইনজেকশন', drops: 'ড্রপ', inhaler: 'ইনহেলার' },
      timesPerDay: { 1: 'দিনে একবার', 2: 'দিনে দুইবার', 3: 'দিনে তিনবার', 4: 'দিনে চারবার' },
      afterMeals: { breakfast: 'সকালের খাবারের পরে', lunch: 'দুপুরের খাবারের পরে', dinner: 'রাতের খাবারের পরে', meal: 'খাবারের পরে' },
      beforeMeals: { breakfast: 'সকালের খাবারের আগে', lunch: 'দুপুরের খাবারের আগে', dinner: 'রাতের খাবারের আগে', meal: 'খাবারের আগে' },
      withMeals: { breakfast: 'সকালের খাবারের সাথে', lunch: 'দুপুরের খাবারের সাথে', dinner: 'রাতের খাবারের সাথে', meal: 'খাবারের সাথে' },
    },
    gu: {
      morning: 'સવારે', afternoon: 'બપોરે', evening: 'રાત્રે', before: 'પહેલા', after: 'પછી', with: 'સાથે',
      meal: 'જમવાનું', breakfast: 'નાસ્તો', lunch: 'બપોરનું જમવાનું', dinner: 'રાત્રિનું જમવાનું',
      emptyStomach: 'ખાલી પેટે', plus: ' અને ',
      take: 'લો', and: ' અને ', localNumerals: false,
      doseOrder: 'timing-first', durationSep: ', ', sentenceEnd: '.', preferSlotFormat: true,
      forms: { tablet: 'ટેબ્લેટ', capsule: 'કેપ્સ્યૂલ', syrup: 'સીરપ', injection: 'ઇન્જેક્શન', drops: 'ટીપાં', inhaler: 'ઇન્હેલર' },
      timesPerDay: { 1: 'દિવસમાં એકવાર', 2: 'દિવસમાં બે વખત', 3: 'દિવસમાં ત્રણ વખત', 4: 'દિવસમાં ચાર વખત' },
      afterMeals: { breakfast: 'નાસ્તા પછી', lunch: 'બપોરના જમ્યા પછી', dinner: 'રાત્રિના જમ્યા પછી', meal: 'જમ્યા પછી' },
      beforeMeals: { breakfast: 'નાસ્તા પહેલા', lunch: 'બપોરના જમ્યા પહેલા', dinner: 'રાત્રિના જમ્યા પહેલા', meal: 'જમ્યા પહેલા' },
      withMeals: { breakfast: 'નાસ્તા સાથે', lunch: 'બપોરના જમવા સાથે', dinner: 'રાત્રિના જમવા સાથે', meal: 'જમવા સાથે' },
    },
    ta: {
      morning: 'காலையில்', afternoon: 'மதியம்', evening: 'இரவில்', before: 'முன்பு', after: 'பிறகு', with: 'உடன்',
      meal: 'உணவு', breakfast: 'காலை உணவு', lunch: 'மதிய உணவு', dinner: 'இரவு உணவு',
      emptyStomach: 'வெறும் வயிற்றில்', plus: ' மற்றும் ',
      take: 'எடுக்கவும்', and: ' மற்றும் ', localNumerals: false,
      doseOrder: 'timing-first', durationSep: ', ', sentenceEnd: '.', preferSlotFormat: true,
      forms: { tablet: 'மாத்திரை', capsule: 'கேப்சூல்', syrup: 'சிரப்', injection: 'ஊசி', drops: 'சொட்டுகள்', inhaler: 'இன்ஹேலர்' },
      timesPerDay: { 1: 'நாளில் ஒரு முறை', 2: 'நாளில் இரண்டு முறை', 3: 'நாளில் மூன்று முறை', 4: 'நாளில் நான்கு முறை' },
      afterMeals: { breakfast: 'காலை உணவிற்கு பிறகு', lunch: 'மதிய உணவிற்கு பிறகு', dinner: 'இரவு உணவிற்கு பிறகு', meal: 'உணவிற்கு பிறகு' },
      beforeMeals: { breakfast: 'காலை உணவிற்கு முன்பு', lunch: 'மதிய உணவிற்கு முன்பு', dinner: 'இரவு உணவிற்கு முன்பு', meal: 'உணவிற்கு முன்பு' },
      withMeals: { breakfast: 'காலை உணவுடன்', lunch: 'மதிய உணவுடன்', dinner: 'இரவு உணவுடன்', meal: 'உணவுடன்' },
    },
    te: {
      morning: 'ఉదయం', afternoon: 'మధ్యాహ్నం', evening: 'రాత్రి', before: 'ముందు', after: 'తర్వాత', with: 'తో',
      meal: 'భోజనం', breakfast: 'అల్పాహారం', lunch: 'మధ్యాహ్న భోజనం', dinner: 'రాత్రి భోజనం',
      emptyStomach: 'ఖాళీ కడుపుతో', plus: ' మరియు ',
      take: 'తీసుకోండి', and: ' మరియు ', localNumerals: false,
      doseOrder: 'timing-first', durationSep: ', ', sentenceEnd: '.', preferSlotFormat: true,
      forms: { tablet: 'టాబ్లెట్', capsule: 'క్యాప్సూల్', syrup: 'సిరప్', injection: 'ఇంజెక్షన్', drops: 'చుక్కలు', inhaler: 'ఇన్హేలర్' },
      timesPerDay: { 1: 'రోజుకు ఒకసారి', 2: 'రోజుకు రెండుసార్లు', 3: 'రోజుకు మూడుసార్లు', 4: 'రోజుకు నాలుగుసార్లు' },
      afterMeals: { breakfast: 'అల్పాహారం తర్వాత', lunch: 'మధ్యాహ్న భోజనం తర్వాత', dinner: 'రాత్రి భోజనం తర్వాత', meal: 'భోజనం తర్వాత' },
      beforeMeals: { breakfast: 'అల్పాహారం ముందు', lunch: 'మధ్యాహ్న భోజనం ముందు', dinner: 'రాత్రి భోజనం ముందు', meal: 'భోజనం ముందు' },
      withMeals: { breakfast: 'అల్పాహారంతో', lunch: 'మధ్యాహ్న భోజనంతో', dinner: 'రాత్రి భోజనంతో', meal: 'భోజనంతో' },
    },
    kn: {
      morning: 'ಬೆಳಿಗ್ಗೆ', afternoon: 'ಮಧ್ಯಾಹ್ನ', evening: 'ರಾತ್ರಿ', before: 'ಮೊದಲು', after: 'ನಂತರ', with: 'ಜೊತೆಗೆ',
      meal: 'ಊಟ', breakfast: 'ತಿಂಡಿ', lunch: 'ಮಧ್ಯಾಹ್ನದ ಊಟ', dinner: 'ರಾತ್ರಿಯ ಊಟ',
      emptyStomach: 'ಖಾಲಿ ಹೊಟ್ಟೆಯಲ್ಲಿ', plus: ' ಮತ್ತು ',
      take: 'ತೆಗೆದುಕೊಳ್ಳಿ', and: ' ಮತ್ತು ', localNumerals: false,
      doseOrder: 'timing-first', durationSep: ', ', sentenceEnd: '.', preferSlotFormat: true,
      forms: { tablet: 'ಮಾತ್ರೆ', capsule: 'ಕ್ಯಾಪ್ಸೂಲ್', syrup: 'ಸಿರಪ್', injection: 'ಚುಚ್ಚುಮದ್ದು', drops: 'ಹನಿಗಳು', inhaler: 'ಇನ್ಹೇಲರ್' },
      timesPerDay: { 1: 'ದಿನಕ್ಕೊಮ್ಮೆ', 2: 'ದಿನಕ್ಕೆ ಎರಡು ಬಾರಿ', 3: 'ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ', 4: 'ದಿನಕ್ಕೆ ನಾಲ್ಕು ಬಾರಿ' },
      afterMeals: { breakfast: 'ತಿಂಡಿಯ ನಂತರ', lunch: 'ಮಧ್ಯಾಹ್ನದ ಊಟದ ನಂತರ', dinner: 'ರಾತ್ರಿಯ ಊಟದ ನಂತರ', meal: 'ಊಟದ ನಂತರ' },
      beforeMeals: { breakfast: 'ತಿಂಡಿಯ ಮೊದಲು', lunch: 'ಮಧ್ಯಾಹ್ನದ ಊಟದ ಮೊದಲು', dinner: 'ರಾತ್ರಿಯ ಊಟದ ಮೊದಲು', meal: 'ಊಟದ ಮೊದಲು' },
      withMeals: { breakfast: 'ತಿಂಡಿಯ ಜೊತೆಗೆ', lunch: 'ಮಧ್ಯಾಹ್ನದ ಊಟದ ಜೊತೆಗೆ', dinner: 'ರಾತ್ರಿಯ ಊಟದ ಜೊತೆಗೆ', meal: 'ಊಟದ ಜೊತೆಗೆ' },
    },
    ml: {
      morning: 'രാവിലെ', afternoon: 'ഉച്ചയ്ക്ക്', evening: 'രാത്രി', before: 'മുൻപ്', after: 'ശേഷം', with: 'കൂടെ',
      meal: 'ഭക്ഷണം', breakfast: 'പ്രഭാതഭക്ഷണം', lunch: 'ഉച്ചഭക്ഷണം', dinner: 'അത്താഴം',
      emptyStomach: 'വെറും വയറ്റിൽ', plus: ' ',
      take: 'കഴിക്കുക', and: ' ', localNumerals: false,
      doseOrder: 'timing-first', durationSep: ', ', sentenceEnd: '.', preferSlotFormat: true,
      forms: { tablet: 'ഗുളിക', capsule: 'കാപ്സ്യൂൾ', syrup: 'സിറപ്പ്', injection: 'കുത്തിവയ്പ്', drops: 'തുള്ളി', inhaler: 'ഇൻഹേലർ' },
      timesPerDay: { 1: 'ദിവസം ഒരു തവണ', 2: 'ദിവസം രണ്ട് തവണ', 3: 'ദിവസം മൂന്ന് തവണ', 4: 'ദിവസം നാല് തവണ' },
      afterMeals: { breakfast: 'പ്രഭാതഭക്ഷണത്തിന് ശേഷം', lunch: 'ഉച്ചഭക്ഷണത്തിന് ശേഷം', dinner: 'അത്താഴത്തിന് ശേഷം', meal: 'ഭക്ഷണത്തിന് ശേഷം' },
      beforeMeals: { breakfast: 'പ്രഭാതഭക്ഷണത്തിന് മുൻപ്', lunch: 'ഉച്ചഭക്ഷണത്തിന് മുൻപ്', dinner: 'അത്താഴത്തിന് മുൻപ്', meal: 'ഭക്ഷണത്തിന് മുൻപ്' },
      withMeals: { breakfast: 'പ്രഭാതഭക്ഷണത്തിനൊപ്പം', lunch: 'ഉച്ചഭക്ഷണത്തിനൊപ്പം', dinner: 'അത്താഴത്തിനൊപ്പം', meal: 'ഭക്ഷണത്തിനൊപ്പം' },
    },
    pa: {
      morning: 'ਸਵੇਰੇ', afternoon: 'ਦੁਪਹਿਰੇ', evening: 'ਰਾਤ ਨੂੰ', before: 'ਤੋਂ ਪਹਿਲਾਂ', after: 'ਤੋਂ ਬਾਅਦ', with: 'ਨਾਲ',
      meal: 'ਭੋਜਨ', breakfast: 'ਨਾਸ਼ਤਾ', lunch: 'ਦੁਪਹਿਰ ਦਾ ਖਾਣਾ', dinner: 'ਰਾਤ ਦਾ ਖਾਣਾ',
      emptyStomach: 'ਖਾਲੀ ਪੇਟ', plus: ' ਅਤੇ ',
      take: 'ਲਓ', and: ' ਅਤੇ ', localNumerals: false,
      doseOrder: 'timing-first', durationSep: ', ', sentenceEnd: '.', preferSlotFormat: true,
      forms: { tablet: 'ਗੋਲੀ', capsule: 'ਕੈਪਸੂਲ', syrup: 'ਸ਼ਰਬਤ', injection: 'ਟੀਕਾ', drops: 'ਤੁਪਕੇ', inhaler: 'ਇਨਹੇਲਰ' },
      timesPerDay: { 1: 'ਦਿਨ ਵਿੱਚ ਇੱਕ ਵਾਰ', 2: 'ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ', 3: 'ਦਿਨ ਵਿੱਚ ਤਿੰਨ ਵਾਰ', 4: 'ਦਿਨ ਵਿੱਚ ਚਾਰ ਵਾਰ' },
      afterMeals: { breakfast: 'ਨਾਸ਼ਤੇ ਤੋਂ ਬਾਅਦ', lunch: 'ਦੁਪਹਿਰ ਦੇ ਖਾਣੇ ਤੋਂ ਬਾਅਦ', dinner: 'ਰਾਤ ਦੇ ਖਾਣੇ ਤੋਂ ਬਾਅਦ', meal: 'ਭੋਜਨ ਤੋਂ ਬਾਅਦ' },
      beforeMeals: { breakfast: 'ਨਾਸ਼ਤੇ ਤੋਂ ਪਹਿਲਾਂ', lunch: 'ਦੁਪਹਿਰ ਦੇ ਖਾਣੇ ਤੋਂ ਪਹਿਲਾਂ', dinner: 'ਰਾਤ ਦੇ ਖਾਣੇ ਤੋਂ ਪਹਿਲਾਂ', meal: 'ਭੋਜਨ ਤੋਂ ਪਹਿਲਾਂ' },
      withMeals: { breakfast: 'ਨਾਸ਼ਤੇ ਨਾਲ', lunch: 'ਦੁਪਹਿਰ ਦੇ ਖਾਣੇ ਨਾਲ', dinner: 'ਰਾਤ ਦੇ ਖਾਣੇ ਨਾਲ', meal: 'ਭੋਜਨ ਨਾਲ' },
    },
    ur: {
      morning: 'صبح', afternoon: 'دوپہر', evening: 'رات', before: 'سے پہلے', after: 'کے بعد', with: 'کے ساتھ',
      meal: 'کھانا', breakfast: 'ناشتہ', lunch: 'دوپہر کا کھانا', dinner: 'رات کا کھانا',
      emptyStomach: 'خالی پیٹ', plus: ' اور ',
      take: 'لیں', and: ' اور ', localNumerals: false,
      doseOrder: 'timing-first', durationSep: ', ', sentenceEnd: '.', preferSlotFormat: true,
      forms: { tablet: 'گولی', capsule: 'کیپسول', syrup: 'شربت', injection: 'انجیکشن', drops: 'قطرے', inhaler: 'انہیلر' },
      timesPerDay: { 1: 'دن میں ایک بار', 2: 'دن میں دو بار', 3: 'دن میں تین بار', 4: 'دن میں چار بار' },
      afterMeals: { breakfast: 'ناشتے کے بعد', lunch: 'دوپہر کے کھانے کے بعد', dinner: 'رات کے کھانے کے بعد', meal: 'کھانے کے بعد' },
      beforeMeals: { breakfast: 'ناشتے سے پہلے', lunch: 'دوپہر کے کھانے سے پہلے', dinner: 'رات کے کھانے سے پہلے', meal: 'کھانے سے پہلے' },
      withMeals: { breakfast: 'ناشتے کے ساتھ', lunch: 'دوپہر کے کھانے کے ساتھ', dinner: 'رات کے کھانے کے ساتھ', meal: 'کھانے کے ساتھ' },
    },
  };
  return map[l] || map.en;
}

function normalizeTimingToEnglish(timing, translateTimingFn) {
  if (!timing) return '';
  const raw = typeof timing === 'object' ? timing.type : String(timing);
  if (!raw) return '';
  try {
    const t = translateTimingFn ? translateTimingFn(raw, 'en') : raw;
    return String(t || raw);
  } catch {
    return String(raw);
  }
}

function parseTimingSegments(enTiming) {
  if (!enTiming) return [];
  const t = String(enTiming).trim();
  if (!t) return [];

  if (/empty\s*stomach/i.test(t)) return [{ kind: 'emptyStomach' }];
  const after = /after/i.test(t);
  const before = /before/i.test(t);
  const withFood = /with\s*food/i.test(t) || /with\s*meal/i.test(t);

  const meals = [];
  if (/breakfast/i.test(t)) meals.push('breakfast');
  if (/lunch/i.test(t)) meals.push('lunch');
  if (/dinner/i.test(t)) meals.push('dinner');

  const rel = before ? 'before' : after ? 'after' : withFood ? 'with' : null;

  if (meals.length > 0) return meals.map(m => ({ kind: 'meal', rel, meal: m }));
  if (/meal/i.test(t) || rel) return [{ kind: 'meal', rel, meal: null }];
  return [{ kind: 'raw', text: t }];
}

function formatTimingSegment(seg, parts) {
  if (!seg) return '';
  if (seg.kind === 'emptyStomach') return parts.emptyStomach;
  if (seg.kind === 'raw') return seg.text || '';
  if (seg.kind === 'meal') {
    const rel = seg.rel === 'before' ? parts.before : seg.rel === 'after' ? parts.after : seg.rel === 'with' ? parts.with : '';
    const meal = seg.meal === 'breakfast' ? parts.breakfast : seg.meal === 'lunch' ? parts.lunch : seg.meal === 'dinner' ? parts.dinner : parts.meal;
    return [rel, meal].filter(Boolean).join(' ').trim();
  }
  return '';
}

function buildTimingForDoseSlot(segments, slotIndex, nonZeroSlotIndex, parts) {
  if (!segments || segments.length === 0) return '';

  // Use meal maps (afterMeals/beforeMeals/withMeals) for correct language-specific compound words
  function timingFromMaps(seg) {
    if (!seg || seg.kind !== 'meal') return formatTimingSegment(seg, parts);
    const mealMap = seg.rel === 'before' ? parts.beforeMeals : seg.rel === 'with' ? parts.withMeals : parts.afterMeals;
    if (!mealMap) return formatTimingSegment(seg, parts);
    const key = seg.meal || 'meal';
    return mealMap[key] || formatTimingSegment(seg, parts);
  }

  // If the timing contains specific meals, map them to the correct day slot:
  // Morning -> Breakfast, Afternoon -> Lunch, Evening -> Dinner
  const hasMealSegments = segments.some(s => s && s.kind === 'meal' && s.meal);
  if (hasMealSegments) {
    const desiredMeal = slotIndex === 0 ? 'breakfast' : slotIndex === 1 ? 'lunch' : 'dinner';
    const exact = segments.find(s => s.kind === 'meal' && s.meal === desiredMeal);
    if (exact) return timingFromMaps(exact);

    // If a meal isn't provided for this slot, fall back to a generic meal timing if present
    const genericMeal = segments.find(s => s.kind === 'meal' && !s.meal);
    if (genericMeal) return timingFromMaps(genericMeal);

    // Otherwise use the first provided segment (last resort)
    return timingFromMaps(segments[0]);
  }

  if (segments.length === 1) return timingFromMaps(segments[0]);
  if (segments.length === 3) return timingFromMaps(segments[slotIndex] || segments[0]);
  return timingFromMaps(segments[nonZeroSlotIndex] || segments[0]);
}

function toCanonicalDoseSlots(frequency) {
  let morning = 0, afternoon = 0, evening = 0;
  let hasDashes = false;
  let freqParts = [];

  if (frequency && typeof frequency === 'string') {
    if (frequency.includes('-')) {
      hasDashes = true;
      freqParts = frequency.split('-').map(p => p.trim());
      const parts = freqParts.map(p => {
        if (p.includes('/')) {
          const [num, den] = p.split('/').map(Number);
          return den ? num / den : 0;
        }
        const num = parseFloat(p);
        return isNaN(num) ? 0 : num;
      });
      if (parts.length >= 3) {
        morning = parts[0];
        afternoon = parts[1];
        evening = parts[2];
      } else if (parts.length === 2) {
        morning = parts[0];
        evening = parts[1];
      } else if (parts.length === 1) {
        morning = parts[0];
      }
    }
  }
  return { morning, afternoon, evening, hasDashes, freqParts };
}

function localizeDurationSuffix(duration, lang = 'en') {
  const days = parseDurationDays(duration);
  if (!days) return '';

  const l = lang || 'en';
  const phrases = {
    en: (d) => `for ${d} days`,
    hi: (d) => `${d} दिन लें`,
    mr: (d) => `${d} दिवस घ्यावी`,
    bn: (d) => `${d} দিন নিন`,
    gu: (d) => `${d} દિવસ લો`,
    ta: (d) => `${d} நாட்கள் எடுக்கவும்`,
    te: (d) => `${d} రోజులు తీసుకోండి`,
    kn: (d) => `${d} ದಿನ ತೆಗೆದುಕೊಳ್ಳಿ`,
    ml: (d) => `${d} ദിവസം കഴിക്കുക`,
    pa: (d) => `${d} ਦਿਨ ਲਓ`,
    ur: (d) => `${d} دن لیں`
  };

  const fn = phrases[l] || phrases.en;
  return fn(days);
}

function toLocalDevanagari(str) {
  const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(str).replace(/\d/g, d => digits[parseInt(d)]);
}

function parseDosageText(dosage, dosageForm, parts) {
  const ds = String(dosage || '').trim();
  const df = String(dosageForm || '').trim().toLowerCase();
  if (!ds && !df) return '';

  const hasFormWord = /tablet|tab|capsule|cap|syrup|suspension|injection|inj|drop|inhaler|ml|mg/i.test(ds);
  let num = '';
  let form = '';

  if (hasFormWord) {
    const m = ds.match(/^([\d/.]+)\s*(.+)$/i);
    if (m) { num = m[1]; form = m[2].trim().toLowerCase(); }
    else return ds;
  } else {
    num = ds;
    form = df;
  }

  const localNum = parts.localNumerals ? toLocalDevanagari(num) : num;
  const formKey = /tablet|tab/.test(form) ? 'tablet'
    : /capsule|cap/.test(form) ? 'capsule'
    : /syrup|suspension/.test(form) ? 'syrup'
    : /injection|inj/.test(form) ? 'injection'
    : /drop/.test(form) ? 'drops'
    : /inhaler/.test(form) ? 'inhaler'
    : null;
  const localForm = formKey && parts.forms?.[formKey] ? parts.forms[formKey] : (form || '');

  return [localNum, localForm].filter(Boolean).join(' ');
}

function buildNaturalTimingPhrase(timingSegments, activeSlots, parts) {
  if (!timingSegments || timingSegments.length === 0) return '';
  const seg0 = timingSegments[0];
  if (seg0?.kind === 'emptyStomach') return parts.emptyStomach || '';
  if (seg0?.kind === 'raw') return seg0.text || '';

  const rel = seg0?.rel || 'after';
  const mealMap = rel === 'before' ? parts.beforeMeals
    : rel === 'with' ? parts.withMeals
    : parts.afterMeals;

  if (!mealMap) return formatTimingSegment(seg0, parts);

  const slotMeals = { 0: 'breakfast', 1: 'lunch', 2: 'dinner' };
  const phrases = activeSlots.map(slot => mealMap[slotMeals[slot]] || mealMap.meal);

  if (phrases.length === 0) return '';
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return phrases[0] + (parts.and || ' and ') + phrases[1];
  return phrases.slice(0, -1).join(', ') + (parts.and || ' and ') + phrases[phrases.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// FREQUENCY → INSTRUCTION MAP (multilingual, after-meal default)
// ─────────────────────────────────────────────────────────────────────────────
const instructionsMap = {
  '1-0-0': {
    en: 'Take 1 in the morning after meal',
    hi: 'सुबह भोजन के बाद 1 लें',
    mr: 'सकाळी जेवणानंतर 1 घ्या',
    bn: 'সকালে খাবারের পর ১টি নিন',
    gu: 'સવારે ભોજન પછી ૧ લો',
    ta: 'காலை உணவுக்குப் பிறகு 1 எடுத்துக்கொள்ளவும்',
    te: 'ఉదయం భోజనం తర్వాత 1 తీసుకోండి',
    kn: 'ಬೆಳಿಗ್ಗೆ ಊಟದ ನಂತರ 1 ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'രാവിലെ ഭക്ഷണത്തിനു ശേഷം 1 കഴിക്കുക',
    pa: 'ਸਵੇਰੇ ਖਾਣੇ ਤੋਂ ਬਾਅਦ 1 ਲਵੋ',
    ur: 'صبح کھانے کے بعد 1 لیں',
  },
  '0-1-0': {
    en: 'Take 1 in the afternoon after meal',
    hi: 'दोपहर भोजन के बाद 1 लें',
    mr: 'दुपारी जेवणानंतर 1 घ्या',
    bn: 'দুপুরে খাবারের পর ১টি নিন',
    gu: 'બપોરે ભોજન પછી ૧ લો',
    ta: 'மதியம் உணவுக்குப் பிறகு 1 எடுத்துக்கொள்ளவும்',
    te: 'మధ్యాహ్నం భోజనం తర్వాత 1 తీసుకోండి',
    kn: 'ಮಧ್ಯಾಹ್ನ ಊಟದ ನಂತರ 1 ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'ഉച്ചയ്ക്ക് ഭക്ഷണത്തിനു ശേഷം 1 കഴിക്കുക',
    pa: 'ਦੁਪਹਿਰ ਖਾਣੇ ਤੋਂ ਬਾਅਦ 1 ਲਵੋ',
    ur: 'دوپہر کھانے کے بعد 1 لیں',
  },
  '0-0-1': {
    en: 'Take 1 in the evening after meal',
    hi: 'शाम भोजन के बाद 1 लें',
    mr: 'संध्याकाळी जेवणानंतर 1 घ्या',
    bn: 'সন্ধ্যায় খাবারের পর ১টি নিন',
    gu: 'સાંજે ભોજન પછી ૧ લો',
    ta: 'மாலை உணவுக்குப் பிறகு 1 எடுத்துக்கொள்ளவும்',
    te: 'సాయంత్రం భోజనం తర్వాత 1 తీసుకోండి',
    kn: 'ಸಂಜೆ ಊಟದ ನಂತರ 1 ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'വൈകുന്നേരം ഭക്ഷണത്തിനു ശേഷം 1 കഴിക്കുക',
    pa: 'ਸ਼ਾਮ ਖਾਣੇ ਤੋਂ ਬਾਅਦ 1 ਲਵੋ',
    ur: 'شام کھانے کے بعد 1 لیں',
  },
  '1-0-1': {
    en: 'Take 1 in morning and evening after meal',
    hi: 'सुबह और शाम भोजन के बाद 1 लें',
    mr: 'सकाळी आणि संध्याकाळी जेवणानंतर 1 घ्या',
    bn: 'সকাল ও সন্ধ্যায় খাবারের পর ১টি নিন',
    gu: 'સવારે અને સાંજે ભોજન પછી ૧ લો',
    ta: 'காலை மற்றும் மாலை உணவுக்குப் பிறகு 1 எடுத்துக்கொள்ளவும்',
    te: 'ఉదయం మరియు సాయంత్రం భోజనం తర్వాత 1 తీసుకోండి',
    kn: 'ಬೆಳಿಗ್ಗೆ ಮತ್ತು ಸಂಜೆ ಊಟದ ನಂತರ 1 ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'രാവിലും വൈകുന്നേരവും ഭക്ഷണത്തിനു ശേഷം 1 കഴിക്കുക',
    pa: 'ਸਵੇਰੇ ਅਤੇ ਸ਼ਾਮ ਖਾਣੇ ਤੋਂ ਬਾਅਦ 1 ਲਵੋ',
    ur: 'صبح اور شام کھانے کے بعد 1 لیں',
  },
  '1-1-0': {
    en: 'Take 1 in morning and afternoon after meal',
    hi: 'सुबह और दोपहर भोजन के बाद 1 लें',
    mr: 'सकाळी आणि दुपारी जेवणानंतर 1 घ्या',
    bn: 'সকাল ও দুপুরে খাবারের পর ১টি নিন',
    gu: 'સવારે અને બપોરે ભોજન પછી ૧ લો',
    ta: 'காலை மற்றும் மதியம் உணவுக்குப் பிறகு 1 எடுத்துக்கொள்ளவும்',
    te: 'ఉదయం మరియు మధ్యాహ్నం భోజనం తర్వాత 1 తీసుకోండి',
    kn: 'ಬೆಳಿಗ್ಗೆ ಮತ್ತು ಮಧ್ಯಾಹ್ನ ಊಟದ ನಂತರ 1 ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'രാവിലെയും ഉച്ചയ്ക്കും ഭക്ഷണത്തിനു ശേഷം 1 കഴിക്കുക',
    pa: 'ਸਵੇਰੇ ਅਤੇ ਦੁਪਹਿਰ ਖਾਣੇ ਤੋਂ ਬਾਅਦ 1 ਲਵੋ',
    ur: 'صبح اور دوپہر کھانے کے بعد 1 لیں',
  },
  '0-1-1': {
    en: 'Take 1 in afternoon and evening after meal',
    hi: 'दोपहर और शाम भोजन के बाद 1 लें',
    mr: 'दुपारी आणि संध्याकाळी जेवणानंतर 1 घ्या',
    bn: 'দুপুর ও সন্ধ্যায় খাবারের পর ১টি নিন',
    gu: 'બપોરે અને સાંજે ભોજન પછી ૧ લો',
    ta: 'மதியம் மற்றும் மாலை உணவுக்குப் பிறகு 1 எடுத்துக்கொள்ளவும்',
    te: 'మధ్యాహ్నం మరియు సాయంత్రం భోజనం తర్వాత 1 తీసుకోండి',
    kn: 'ಮಧ್ಯಾಹ್ನ ಮತ್ತು ಸಂಜೆ ಊಟದ ನಂತರ 1 ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'ഉച്ചയ്ക്കും വൈകുന്നേരവും ഭക്ഷണത്തിനു ശേഷം 1 കഴിക്കുക',
    pa: 'ਦੁਪਹਿਰ ਅਤੇ ਸ਼ਾਮ ਖਾਣੇ ਤੋਂ ਬਾਅਦ 1 ਲਵੋ',
    ur: 'دوپہر اور شام کھانے کے بعد 1 لیں',
  },
  '1-1-1': {
    en: 'Take 1 in morning, afternoon and evening after meal',
    hi: 'सुबह, दोपहर और शाम भोजन के बाद 1 लें',
    mr: 'सकाळी, दुपारी आणि संध्याकाळी जेवणानंतर 1 घ्या',
    bn: 'সকাল, দুপুর ও সন্ধ্যায় খাবারের পর ১টি নিন',
    gu: 'સવારે, બપોરે અને સાંજે ભોજન પછી ૧ લો',
    ta: 'காலை, மதியம் மற்றும் மாலை உணவுக்குப் பிறகு 1 எடுத்துக்கொள்ளவும்',
    te: 'ఉదయం, మధ్యాహ్నం మరియు సాయంత్రం భోజనం తర్వాత 1 తీసుకోండి',
    kn: 'ಬೆಳಿಗ್ಗೆ, ಮಧ್ಯಾಹ್ನ ಮತ್ತು ಸಂಜೆ ಊಟದ ನಂತರ 1 ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'രാവിലെ, ഉച്ചയ്ക്ക്, വൈകുന്നേരം ഭക്ഷണത്തിനു ശേഷം 1 കഴിക്കുക',
    pa: 'ਸਵੇਰੇ, ਦੁਪਹਿਰ ਅਤੇ ਸ਼ਾਮ ਖਾਣੇ ਤੋਂ ਬਾਅਦ 1 ਲਵੋ',
    ur: 'صبح، دوپہر اور شام کھانے کے بعد 1 لیں',
  },
  '1-1-1-1': {
    en: 'Take 1 four times a day after meal',
    hi: 'दिन में चार बार भोजन के बाद 1 लें',
    mr: 'दिवसातून चार वेळा जेवणानंतर 1 घ्या',
    bn: 'দিনে চারবার খাবারের পর ১টি নিন',
    gu: 'દિવસમાં ચાર વખત ભોજન પછી ૧ લો',
    ta: 'நாளில் நான்கு முறை உணவுக்குப் பிறகு 1 எடுத்துக்கொள்ளவும்',
    te: 'రోజుకు నాలుగుసార్లు భోజనం తర్వాత 1 తీసుకోండి',
    kn: 'ದಿನಕ್ಕೆ ನಾಲ್ಕು ಬಾರಿ ಊಟದ ನಂತರ 1 ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'ദിവസം നാലുതവണ ഭക്ഷണത്തിനു ശേഷം 1 കഴിക്കുക',
    pa: 'ਦਿਨ ਵਿੱਚ ਚਾਰ ਵਾਰ ਖਾਣੇ ਤੋਂ ਬਾਅਦ 1 ਲਵੋ',
    ur: 'دن میں چار بار کھانے کے بعد 1 لیں',
  },
  'SOS': {
    en: 'Take only when needed',
    hi: 'जरूरत पड़ने पर ही लें',
    mr: 'गरज असेल तेव्हाच घ्या',
    bn: 'প্রয়োজনে নিন',
    gu: 'જ્યારે જરૂર હોય ત્યારે લો',
    ta: 'தேவைப்படும்போது மட்டும் எடுத்துக்கொள்ளவும்',
    te: 'అవసరమైనప్పుడు మాత్రమే తీసుకోండి',
    kn: 'ಅಗತ್ಯ ಇದ್ದಾಗ ಮಾತ್ರ ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'ആവശ്യമുള്ളപ്പോൾ മാത്രം കഴിക്കുക',
    pa: 'ਲੋੜ ਪੈਣ ਤੇ ਹੀ ਲਵੋ',
    ur: 'ضرورت پر ہی لیں',
  },
  'Once daily': {
    en: 'Take once daily after meal',
    hi: 'दिन में एक बार भोजन के बाद लें',
    mr: 'दिवसातून एकदा जेवणानंतर घ्या',
    bn: 'দিনে একবার খাবারের পর নিন',
    gu: 'દિવસમાં એકવાર ભોજન પછી લો',
    ta: 'நாளில் ஒருமுறை உணவுக்குப் பிறகு எடுத்துக்கொள்ளவும்',
    te: 'రోజుకు ఒకసారి భోజనం తర్వాత తీసుకోండి',
    kn: 'ದಿನಕ್ಕೊಮ್ಮೆ ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'ദിവസം ഒരിക്കൽ ഭക്ഷണത്തിനു ശേഷം കഴിക്കുക',
    pa: 'ਦਿਨ ਵਿੱਚ ਇੱਕ ਵਾਰ ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ',
    ur: 'دن میں ایک بار کھانے کے بعد لیں',
  },
  'Twice daily': {
    en: 'Take twice daily after meal',
    hi: 'दिन में दो बार भोजन के बाद लें',
    mr: 'दिवसातून दोनदा जेवणानंतर घ्या',
    bn: 'দিনে দুইবার খাবারের পর নিন',
    gu: 'દિવસમાં બે વાર ભોજન પછી લો',
    ta: 'நாளில் இருமுறை உணவுக்குப் பிறகு எடுத்துக்கொள்ளவும்',
    te: 'రోజుకు రెండుసార్లు భోజనం తర్వాత తీసుకోండి',
    kn: 'ದಿನಕ್ಕೆ ಎರಡು ಬಾರಿ ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'ദിവസം രണ്ടുതവണ ഭക്ഷണത്തിനു ശേഷം കഴിക്കുക',
    pa: 'ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ',
    ur: 'دن میں دو بار کھانے کے بعد لیں',
  },
  'Three times daily': {
    en: 'Take three times daily after meal',
    hi: 'दिन में तीन बार भोजन के बाद लें',
    mr: 'दिवसातून तीन वेळा जेवणानंतर घ्या',
    bn: 'দিনে তিনবার খাবারের পর নিন',
    gu: 'દિવસમાં ત્રણ વાર ભોજન પછી લો',
    ta: 'நாளில் மூன்று முறை உணவுக்குப் பிறகு எடுத்துக்கொள்ளவும்',
    te: 'రోజుకు మూడుసార్లు భోజనం తర్వాత తీసుకోండి',
    kn: 'ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'ദിവസം മൂന്നുതവണ ഭക്ഷണത്തിനു ശേഷം കഴിക്കുക',
    pa: 'ਦਿਨ ਵਿੱਚ ਤਿੰਨ ਵਾਰ ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ',
    ur: 'دن میں تین بار کھانے کے بعد لیں',
  },
  '1/2-0-0': {
    en: 'Take half tablet in the morning after meal',
    hi: 'सुबह आधी गोली भोजन के बाद लें',
    mr: 'सकाळी अर्धी गोळी जेवणानंतर घ्या',
    bn: 'সকালে আধা ট্যাবলেট খাবারের পর নিন',
    gu: 'સવારે અડધી ગોળી ભોજન પછી લો',
    ta: 'காலை அரை மாத்திரை உணவுக்குப் பிறகு எடுத்துக் கொள்ளவும்',
    te: 'ఉదయం అర టాబ్లెట్ భోజనం తర్వాత తీసుకోండి',
    kn: 'ಬೆಳಿಗ್ಗೆ ಅರ್ಧ ಗುಳಿ ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'രാവിലെ അര ഗുളിക ഭക്ഷണത്തിന് ശേഷം കഴിക്കുക',
    pa: 'ਸਵੇਰੇ ਅੱਧੀ ਗੋਲੀ ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ',
    ur: 'صبح آدھی گولی کھانے کے بعد لیں',
  },
  '0-1/2-0': {
    en: 'Take half tablet in the afternoon after meal',
    hi: 'दोपहर आधी गोली भोजन के बाद लें',
    mr: 'दुपारी अर्धी गोळी जेवणानंतर घ्या',
    bn: 'দুপুরে আধা ট্যাবলেট খাবারের পর নিন',
    gu: 'બપોरे અڈधी ગોળી ভোজন পছী લो',
    ta: 'மதியம் அரை மாத்திரை உணவுக்குப் பிறகு எடுத்துக் கொள்ளவும்',
    te: 'మధ్యాహ్నం అర టాబ్లెట్ భోజనం తర్వాత తీసుకోండి',
    kn: 'ಮಧ್ಯಾಹ್ನ ಅರ್ಧ ಗುಳಿ ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'ഉച്ചയ്ക്ക് അര ഗുളിക ഭക്ഷണത്തിന് ശേഷം കഴിക്കുക',
    pa: 'ਦੁਪਹਿਰ ਅੱਧੀ ਗੋਲੀ ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ',
    ur: 'دوپہر آدھی گولی کھانے کے بعد لیں',
  },
  '0-0-1/2': {
    en: 'Take half tablet in the evening after meal',
    hi: 'शाम आधी गोली भोजन के बाद लें',
    mr: 'संध्याकाळी अर्धी गोळी जेवणानंतर घ्या',
    bn: 'সন্ধ্যায় আধা ট্যাবলেট খাবারের পর নিন',
    gu: 'સांजे અڈधी ગોળी ভोजन পछী লо',
    ta: 'மாலை அரை மாத்திரை உணவுக்குப் பிறகு எடுத்துக் கொள்ளவும்',
    te: 'సాయంత్రం అర టాబ్లెట్ భోజనం తర్వాత తీసుకోండి',
    kn: 'ಸಂಜೆ ಅರ್ಧ ಗುಳಿ ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'വൈകുന്നേരം അര ഗുളിക ഭക്ഷണത്തിന് ശേഷം കഴിക്കുക',
    pa: 'ਸ਼ਾਮ ਅੱਧੀ ਗੋਲੀ ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ',
    ur: 'شام آدھی گولی کھانے کے بعد لیں',
  },
  '1/2-0-1/2': {
    en: 'Take half tablet in morning and evening after meal',
    hi: 'सुबह और शाम आधी गोली भोजन के बाद लें',
    mr: 'सकाळी आणि संध्याकाळी अर्धी गोळी जेवणानंतर घ्या',
    bn: 'সকাল ও সন্ধ্যায় আধা ট্যাবলেট খাবারের পর নিন',
    gu: 'સवारे अने सांजे अडधी गोळी ভোজन पছী लो',
    ta: 'காலை மற்றும் மாலை அரை மாத்திரை உணவுக்குப் பிறகு எடுத்துக் கொள்ளவும்',
    te: 'ఉదయం మరియు సాయంత్రం అర టాబ్లెట్ భోజనం తర్వాత తీసుకోండి',
    kn: 'ಬೆಳಿಗ್ಗೆ ಮತ್ತು ಸಂಜೆ ಅರ್ಧ ಗುಳಿ ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'രാവിലും വൈകുന്നേരവും അര ഗുളിക ഭക്ഷണത്തിന് ശേഷം കഴിക്കുക',
    pa: 'ਸਵੇਰੇ ਅਤੇ ਸ਼ਾਮ ਅੱਧੀ ਗੋਲੀ ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ',
    ur: 'صبح اور شام آدھی گولی کھانے کے بعد لیں',
  },
  '1-1/2-1': {
    en: 'Take full tablet in morning and evening, half in afternoon after meal',
    hi: 'सुबह और शाम पूरी, दोपहर आधी गोली भोजन के बाद लें',
    mr: 'सकाळी आणि संध्याकाळी पूर्ण, दुपारी अर्धी गोळी जेवणानंतर घ्या',
    bn: 'সকাল ও সন্ধ্যায় পুরো এবং দুপুরে আধা ট্যাবলেট খাবারের পর নিন',
    gu: 'સवारे अने सांजे पूर्ण अने बपोरे अडधी गोळी ভোজन পছী লо',
    ta: 'காலை மற்றும் மாலை முழு மாத்திரை, மதியம் அரை மாத்திரை உணவுக்குப் பிறகு எடுத்துக் கொள்ளவும்',
    te: 'ఉదయం మరియు సాయంత్రం పూర్తి, మధ్యాహ్నం అర టాబ్లెట్ భోజనం తర్వాత తీసుకోండి',
    kn: 'ಬೆಳಿಗ್ಗೆ ಮತ್ತು ಸಂಜೆ ಪೂರ್ಣ, ಮಧ್ಯಾಹ್ನ ಅರ್ಧ ಗುಳಿ ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ',
    ml: 'രാവിലും വൈകുന്നേരവും പൂർണ്ണ, ഉച്ചയ്ക്ക് അര ഗുളിക ഭക്ഷണത്തിന് ശേഷം കഴിക്കുക',
    pa: 'ਸਵੇਰੇ ਅਤੇ ਸ਼ਾਮ ਪੂਰੀ, ਦੁਪਹਿਰ ਅੱਧੀ ਗੋਲੀ ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ',
    ur: 'صبح اور شام پوری، دوپہر آدھی گولی کھانے کے بعد لیں',
  },
};

// Dose value labels per language (for dynamic instruction generation)
const doseValueLabels = {
  '1/2': { en:'half tablet',    hi:'आधी गोली',        mr:'अर्धी गोळी',      bn:'আধা ট্যাবলেট',    gu:'અડધી ગોળી',   ta:'அரை மாத்திரை',     te:'అర టాబ్లెట్',      kn:'ಅರ್ಧ ಗುಳಿ',     ml:'അര ഗുളിക',        pa:'ਅੱਧੀ ਗੋਲੀ',  ur:'آدھی گولی'  },
  '1':   { en:'full tablet',    hi:'पूरी गोली',        mr:'पूर्ण गोळी',      bn:'পূর্ণ ট্যাবলেট',  gu:'સંपूર्ण ગोળી', ta:'முழு மாத்திரை',     te:'పూర్తి టాబ్లెట్',  kn:'ಪೂರ್ಣ ಗುಳಿ',    ml:'പൂർണ്ണ ഗുളിക',   pa:'ਪੂਰੀ ਗੋਲੀ',  ur:'پوری گولی'  },
  '2':   { en:'2 tablets',      hi:'2 गोलियां',        mr:'2 गोळ्या',        bn:'2টি ট্যাবলেট',    gu:'2 ગोળી',    ta:'2 மாத்திரைகள்',    te:'2 టాబ్లెట్లు',     kn:'2 ಗುಳಿಗೆಗಳು',   ml:'2 ഗുളിക',        pa:'2 ਗੋਲੀਆਂ',   ur:'2 گولیاں'   },
  '1/4': { en:'quarter tablet', hi:'चौथाई गोली',       mr:'पाव गोळी',        bn:'পাউ ট্যাবলেট',    gu:'चೈથाई ગोળી', ta:'கால் மாத்திரை',    te:'పావు టాబ్లెట్',    kn:'ಕಾಲು ಗುಳಿ',     ml:'കാල് ഗുളിക',      pa:'ਚੌਥਾਈ ਗੋਲੀ', ur:'چوتھائی گولی'},
  '3/4': { en:'3/4 tablet',     hi:'तीन-चौथाई गोली',  mr:'तीन-चतुर्थांश गोळी', bn:'3/4 ট্যাবলেট', gu:'3/4 ગोળી',   ta:'3/4 மாத்திரை',    te:'3/4 టాబ్లెట్',    kn:'3/4 ಗುಳಿ',      ml:'3/4 ഗുളിക',      pa:'3/4 ਗੋਲੀ',   ur:'3/4 گولی'   },
};

const slotTimeLabels = {
  M: { en:'morning',   hi:'सुबह',   mr:'सकाळी',       bn:'সকালে',     gu:'सवारे',  ta:'காலை',    te:'ఉదయం',      kn:'బೆಳಿಗ್ಗೆ',  ml:'രാവിലെ',       pa:'ਸਵੇਰੇ',   ur:'صبح'   },
  A: { en:'afternoon', hi:'दोपहर',  mr:'दुपारी',      bn:'দুপুরে',    gu:'बपोरे',  ta:'மதியம்',  te:'మధ్యాహ్నం', kn:'ಮಧ್ಯಾಹ್ನ', ml:'ഉച്ചയ്ക്ക്',   pa:'ਦੁਪਹਿਰ',  ur:'دوپہر' },
  E: { en:'evening',   hi:'शाम',    mr:'संध्याकाळी',  bn:'সন্ধ্যায়',  gu:'सांजे',  ta:'மாலை',    te:'సాయంత్రం',  kn:'ಸಂಜೆ',      ml:'വൈകുന്നേരം',   pa:'ਸ਼ਾਮ',    ur:'شام'   },
  N: { en:'night',     hi:'रात',    mr:'रात्री',      bn:'রাতে',      gu:'रात्रे', ta:'இரவு',    te:'రాత్రి',    kn:'ರಾತ್ರಿ',    ml:'രാത്രി',       pa:'ਰਾਤ',     ur:'رات'   },
};

const afterMealSuffix = {
  en: 'after meal',
  hi: 'भोजन के बाद लें',
  mr: 'जेवणानंतर घ्या',
  bn: 'খাবারের পর নিন',
  gu: 'भोजन पछी लो',
  ta: 'உணவுக்குப் பிறகு எடுத்துக் கொள்ளவும்',
  te: 'భోజనం తర్వాత తీసుకోండి',
  kn: 'ನಂಟವಂಜರ తೆಗೆದುకೊಳ್ಳಿ',
  ml: 'ഭക്ഷണത്തിന് ശേഷം കഴിക്കുക',
  pa: 'ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ',
  ur: 'کھانے کے بعد لیں',
};

function parseFrac(val) {
  if (!val) return 0;
  if (String(val).includes('/')) {
    const [n, d] = String(val).split('/').map(Number);
    return d ? n / d : 0;
  }
  return parseFloat(val) || 0;
}

// Dynamically generate instruction for any M-A-E(-N) pattern (handles fractions + mixed doses)
function generateInstruction(freq, lang = 'en') {
  const parts = freq?.trim().split('-');
  if (!parts || (parts.length !== 3 && parts.length !== 4)) return '';
  const validVal = /^(0|[0-9]+(\.[0-9]+)?|[0-9]+\/[0-9]+)$/;
  if (!parts.every(p => validVal.test(p))) return '';

  const slotKeys = ['M', 'A', 'E', 'N'];
  const activeSlots = parts
    .map((qty, i) => ({ slot: slotKeys[i], qty }))
    .filter(s => parseFrac(s.qty) > 0);
  if (activeSlots.length === 0) return '';

  const after = afterMealSuffix[lang] || afterMealSuffix['en'];
  const slotParts = activeSlots.map(s => {
    const doseLabel = doseValueLabels[s.qty]?.[lang] || doseValueLabels[s.qty]?.['en'] || s.qty;
    const timeLabel = slotTimeLabels[s.slot]?.[lang] || s.slot;
    return `${timeLabel} ${doseLabel}`;
  });
  const slotsStr = slotParts.join(', ');
  if (lang === 'en') return `Take ${slotsStr} ${after}`;
  return `${slotsStr} ${after}`;
}

// Returns the first active slot qty value (e.g. '1/2' from '1/2-0-1/2')
function slotDoseQty(frequency) {
  const parts = frequency?.trim().split('-');
  if (!parts || (parts.length !== 3 && parts.length !== 4)) return null;
  const validVal = /^(0|[0-9]+(\.[0-9]+)?|[0-9]+\/[0-9]+)$/;
  if (!parts.every(p => validVal.test(p))) return null;
  const active = parts.filter(p => parseFrac(p) > 0);
  return active.length > 0 ? active[0] : null;
}

// Main: static map lookup -> dynamic generation fallback
function getAutoInstruction(frequency, lang = 'en') {
  const key = frequency?.trim();
  if (!key) return '';
  if (instructionsMap[key]) {
    return instructionsMap[key][lang] || instructionsMap[key]['en'] || '';
  }
  return generateInstruction(key, lang);
}

// Enhanced auto-generate instructions from frequency and timing - creates detailed dosage schedule
function generateAutoInstructions(frequency, timing, lang = 'en', translateTimingFn, duration, dosage = '', dosageForm = '') {
  if (!frequency && !timing) return '';

  // Handle special case - if frequency is "Tapering", don't override
  if (frequency === 'Tapering' || frequency?.toLowerCase?.().includes('taper')) {
    return '';
  }

  // For non-oral forms, return simple localized instruction instead of meal-timing slots
  const dfLower = (dosageForm || '').toLowerCase();
  const isTopical = /cream|ointment|gel|lotion|paste|topical/.test(dfLower);
  const isInjection = /injection|inj|^iv$|^im$|^sc$|intravenous|intramuscular|subcutaneous/.test(dfLower);
  const isInhaler = /inhaler|inhale|nebulizer|spray/.test(dfLower);
  const _isPowder = /powder|sachet|granule/.test(dfLower);

  if (isTopical || isInjection || isInhaler) {
    // Return a simple "as prescribed" — doctor/nurse will handle specifics
    const asDirected = {
      en: 'As directed by physician',
      hi: 'चिकित्सक के निर्देशानुसार',
      mr: 'डॉक्टरांच्या सल्ल्यानुसार',
      gu: 'ડૉક્ટરના નિર્દેશ મુજબ',
      bn: 'চিকিৎসকের নির্দেশ মতো',
      ta: 'மருத்துவர் கட்டளைப்படி',
      te: 'వైద్యుని నిర్దేశం ప్రకారం',
      kn: 'ವೈದ್ಯರ ನಿರ್ದೇಶನದಂತೆ',
      ml: 'ഡോക്ടർ നിർദ്ദേശ പ്രകാരം',
      pa: 'ਡਾਕਟਰ ਦੀ ਹਿਦਾਇਤ ਅਨੁਸਾਰ',
      ur: 'معالج کی ہدایت کے مطابق',
    };
    return asDirected[lang] || asDirected.en;
  }

  const parts = localizeDoseParts(lang);
  const enTiming = normalizeTimingToEnglish(timing, translateTimingFn);
  const timingSegments = parseTimingSegments(enTiming);
  const { morning, afternoon, evening, hasDashes, freqParts } = toCanonicalDoseSlots(frequency);

  if (hasDashes) {
    const activeSlots = [];
    if (morning > 0) activeSlots.push(0);
    if (afternoon > 0) activeSlots.push(1);
    if (evening > 0) activeSlots.push(2);

    const durationSuffix = localizeDurationSuffix(duration, lang);

    // Natural language format when dosage is provided (skip for languages preferring slot format)
    if ((dosage || dosageForm) && parts.timesPerDay && !parts.preferSlotFormat) {
      const dosageText = parseDosageText(dosage, dosageForm, parts);
      const freqText = parts.timesPerDay[activeSlots.length] || `${activeSlots.length}x`;
      const timingPhrase = buildNaturalTimingPhrase(timingSegments, activeSlots, parts);
      const takePrefix = dosageText && parts.take ? `${dosageText} ${parts.take}` : '';
      const middleParts = [freqText];
      if (timingPhrase) middleParts.push(timingPhrase);
      if (durationSuffix) middleParts.push(durationSuffix);
      const middle = middleParts.join(', ');
      return takePrefix ? `${takePrefix} - ${middle}.` : `${middle}.`;
    }

    // Per-slot format (no dosage or unsupported lang)
    const formatDose = (dose, originalStr) => {
      if (dose === parseInt(dose)) return dose.toString();
      if (originalStr && originalStr.includes('/')) return originalStr.trim();
      return dose.toFixed(1);
    };

    const formWord = dosageForm ? (parts.forms?.[dosageForm.toLowerCase()] || '') : '';
    const buildSlotPhrase = (baseNum, slotLabel, timingPhrase) => {
      const localNum = parts.localNumerals ? toLocalDevanagari(baseNum) : baseNum;
      const doseStr = [localNum, formWord].filter(Boolean).join(' ');
      if (parts.doseOrder === 'timing-first') {
        return [slotLabel, timingPhrase, doseStr].filter(Boolean).join(' ');
      }
      return [doseStr, slotLabel, timingPhrase].filter(Boolean).join(' ');
    };

    let instructions = [];
    let nonZeroIndex = 0;
    if (morning > 0) {
      const t = buildTimingForDoseSlot(timingSegments, 0, nonZeroIndex, parts);
      instructions.push(buildSlotPhrase(formatDose(morning, freqParts[0]), parts.morning, t));
      nonZeroIndex += 1;
    }
    if (afternoon > 0) {
      const t = buildTimingForDoseSlot(timingSegments, 1, nonZeroIndex, parts);
      instructions.push(buildSlotPhrase(formatDose(afternoon, freqParts[1]), parts.afternoon, t));
      nonZeroIndex += 1;
    }
    if (evening > 0) {
      const t = buildTimingForDoseSlot(timingSegments, 2, nonZeroIndex, parts);
      instructions.push(buildSlotPhrase(formatDose(evening, freqParts[2]), parts.evening, t));
      nonZeroIndex += 1;
    }

    if (instructions.length === 0 && frequency) {
      return enTiming ? `${frequency} ${enTiming}` : frequency;
    }

    const base = instructions.join(parts.plus);
    if (durationSuffix) {
      const sep = parts.durationSep || ' ';
      const end = parts.sentenceEnd || '';
      return `${base}${sep}${durationSuffix}${end}`;
    }
    return base;
  } else {
    // For named frequencies like "Once daily", "Twice daily", etc.
    if (enTiming) {
      const base = `${frequency} ${enTiming}`;
      const suffix = localizeDurationSuffix(duration, lang);
      return suffix ? `${base} ${suffix}` : base;
    }
    const suffix = localizeDurationSuffix(duration, lang);
    return suffix ? `${frequency} ${suffix}` : frequency;
  }
}

const uiLabels = {
  en: {
    medicines: 'Medicines',
    diagnosis: 'Diagnosis',
    advice: 'Advice / Instructions',
    followUp: 'Follow Up',
    patientNotes: 'Patient Notes',
    privateNotes: 'Private Notes',
    symptoms: 'Symptoms',
    labTests: 'Lab Tests',
    procedures: 'Procedures',
    dosage: 'Dosage',
    frequency: 'Frequency',
    duration: 'Duration',
    quantity: 'Quantity',
    instructions: 'Instructions',
    add: 'Add',
    remove: 'Remove',
    save: 'Save',
    cancel: 'Cancel',
    selectLanguage: 'Select Language'
  },
  hi: {
    medicines: 'दवाएँ',
    diagnosis: 'निदान',
    advice: 'सलाह / निर्देश',
    followUp: 'फॉलो-अप',
    patientNotes: 'रोगी नोट्स',
    privateNotes: 'निजी नोट्स',
    symptoms: 'लक्षण',
    labTests: 'लैब टेस्ट',
    procedures: 'प्रक्रियाएँ',
    dosage: 'खुराक',
    frequency: 'आवृत्ति',
    duration: 'अवधि',
    quantity: 'मात्रा',
    instructions: 'निर्देश',
    add: 'जोड़ें',
    remove: 'हटाएं',
    save: 'सेव करें',
    cancel: 'रद्द करें',
    selectLanguage: 'भाषा चुनें'
  },
  mr: {
    medicines: 'औषधे',
    diagnosis: 'निदान',
    advice: 'सल्ला / सूचना',
    followUp: 'फॉलो-अप',
    patientNotes: 'रुग्ण नोट्स',
    privateNotes: 'वैयक्तिक नोट्स',
    symptoms: 'लक्षणे',
    labTests: 'लॅब चाचण्या',
    procedures: 'प्रक्रिया',
    dosage: 'डोस',
    frequency: 'वारंवार',
    duration: 'कालावधी',
    quantity: 'प्रमाण',
    instructions: 'सूचना',
    add: 'जोडा',
    remove: 'काढा',
    save: 'जतन करा',
    cancel: 'रद्द करा',
    selectLanguage: 'भाषा निवडा'
  },
  bn: {
    medicines: 'ওষুধ',
    diagnosis: 'রোগ নির্ণয',
    advice: 'পরামর্শ / নির্দেশ',
    followUp: 'ফলো-আপ',
    patientNotes: 'রোগীর নোট',
    privateNotes: 'ব্যক্তিগত নোট',
    symptoms: 'উপসর্গ',
    labTests: 'ল্যাব পরীক্ষা',
    procedures: 'পদ্ধতি',
    dosage: 'ডোজ',
    frequency: 'ফ্রিকোয়েন্সি',
    duration: 'সময়কাল',
    quantity: 'পরিমাণ',
    instructions: 'নির্দেশ',
    add: 'যোগ করুন',
    remove: 'সরান',
    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    selectLanguage: 'ভাষা নির্বাচন করুন'
  },
  gu: {
    medicines: 'દવાઓ',
    diagnosis: 'નિદાન',
    advice: 'સલાહ / સૂચના',
    followUp: 'ફોલો-અપ',
    patientNotes: 'દર્દી નોટ્સ',
    privateNotes: 'ખાનગી નોટ્સ',
    symptoms: 'લક્ષણો',
    labTests: 'લેબ ટેસ્ટ',
    procedures: 'પ્રક્રિયાઓ',
    dosage: 'ડોઝ',
    frequency: 'આવર્તિ',
    duration: 'સમયગાળો',
    quantity: 'જથ્થો',
    instructions: 'સૂચના',
    add: 'ઉમેરો',
    remove: 'દૂર કરો',
    save: 'સાચવો',
    cancel: 'રદ કરો',
    selectLanguage: 'ભાષા પસંદ કરો'
  },
  ta: {
    medicines: 'மருந்துகள்',
    diagnosis: 'நோய் கண்டறி',
    advice: 'ஆலோசனை / வழிமுறைகள்',
    followUp: 'பின் தொடர்வு',
    patientNotes: 'நோயாளி குறிப்புகள்',
    privateNotes: 'தனிப்பட்ட குறிப்புகள்',
    symptoms: 'அறிகுறிகள்',
    labTests: 'ஆய்வகூட சோதனைகள்',
    procedures: 'செயல்முறைகள்',
    dosage: 'அளவு',
    frequency: 'அதிர்வதி',
    duration: 'காலம்',
    quantity: 'அளவு',
    instructions: 'வழிமுறைகள்',
    add: 'சேர்க்கவும்',
    remove: 'அகற்று',
    save: 'சேமிக்கவும்',
    cancel: 'ரத்து',
    selectLanguage: 'மொழியைத் தேர்ந்தெடுக்கவும்'
  },
  te: {
    medicines: 'మందులు',
    diagnosis: 'రోగ నిర్ధారణ',
    advice: 'సలహా / సూచనలు',
    followUp: 'అనుసరించండి',
    patientNotes: 'రోగి గమనలు',
    privateNotes: 'వ్యక్తిగత గమనలు',
    symptoms: 'లక్షణాలు',
    labTests: 'ప్రయోగశాల పరీక్షలు',
    procedures: 'విధానాలు',
    dosage: 'డోసేజ్',
    frequency: 'తరచు',
    duration: 'వ్యవధి',
    quantity: 'పరిమాణం',
    instructions: 'సూచనలు',
    add: 'జోడించండి',
    remove: 'తీసివేయండి',
    save: 'సేవ్ చేయండి',
    cancel: 'రద్దు చేయండి',
    selectLanguage: 'భాషను ఎంచుకోండి'
  },
  kn: {
    medicines: 'ಔಷಧಿಗಳು',
    diagnosis: 'ರೋಗ ನಿರ್ಣಯ',
    advice: 'ಸಲಹೆ / ಸೂಚನೆಗಳು',
    followUp: 'ಅನುಸರಿಸಿ',
    patientNotes: 'ರೋಗಿ ಟಿಪ್ಪಣಿಗಳು',
    privateNotes: 'ಖಾಸಗಿ ಟಿಪ್ಪಣಿಗಳು',
    symptoms: 'ಲಕ್ಷಣಗಳು',
    labTests: 'ಪ್ರಯೋಗಶಾಲೆ ಪರೀಕ್ಷೆಗಳು',
    procedures: 'ವಿಧಾನಗಳು',
    dosage: 'ಡೋಸ್',
    frequency: 'ಆವರ್ತಿ',
    duration: 'ಅವಧಿ',
    quantity: 'ಪ್ರಮಾಣ',
    instructions: 'ಸೂಚನೆಗಳು',
    add: 'ಸೇರಿ',
    remove: 'ತೆಗೆದುಹಾಕಿ',
    save: 'ಉಳಿಸಿ',
    cancel: 'ರದ್ದುಮಾಡಿ',
    selectLanguage: 'ಭಾಷೆಯನ್ನು ಆಯ್ಕಲಿಸಿ'
  },
  ml: {
    medicines: 'മരുന്നുകൾ',
    diagnosis: 'രോഗനിർണയം',
    advice: 'ഉപദേശം / നിർദേശങ്ങൾ',
    followUp: 'പിന്തുടർന്ന്',
    patientNotes: 'രോഗിക്കുറിപ്പുകൾ',
    privateNotes: 'സ്വകാര്യക്കുറിപ്പുകൾ',
    symptoms: 'ലക്ഷണങ്ങൾ',
    labTests: 'ലാബ് ടെസ്റ്റുകൾ',
    procedures: 'നടപടികൾ',
    dosage: 'ഡോസ്',
    frequency: 'ആവർത്തി',
    duration: 'കാലയളവ്',
    quantity: 'അളവ്',
    instructions: 'നിർദേശങ്ങൾ',
    add: 'ചേർക്കുക',
    remove: 'നീക്കംചെയ്യുക',
    save: 'സേവ് ചെയ്യുക',
    cancel: 'റദ്ദാക്കുക',
    selectLanguage: 'ഭാഷ തിരഞ്ഞെടുക്കുക'
  },
  pa: {
    medicines: 'ਦਵਾਈਆਂ',
    diagnosis: 'ਨਿਦਾਨ',
    advice: 'ਸਲਾਹ / ਹਦਾਇਤ',
    followUp: 'ਫਾਲੋ-ਅਪ',
    patientNotes: 'ਮਰੀਜ਼ ਨੋਟ',
    privateNotes: 'ਨਿੱਜੀ ਨੋਟ',
    symptoms: 'ਲੱਛਣ',
    labTests: 'ਲੈਬ ਟੈਸਟ',
    procedures: 'ਕਾਰਵਾਈਆਂ',
    dosage: 'ਡੋਜ਼',
    frequency: 'ਫ੍ਰੀਕਵੈਂਸੀ',
    duration: 'ਮਿਆਦ',
    quantity: 'ਮਾਤਰਾ',
    instructions: 'ਹਦਾਇਤ',
    add: 'ਸ਼ਾਮਲ',
    remove: 'ਹਟਾਓ',
    save: 'ਸੇਵ ਕਰੋ',
    cancel: 'ਰੱਦ ਕਰੋ',
    selectLanguage: 'ਭਾਸ਼ਾ ਚੁਣੋ'
  },
  ur: {
    medicines: 'دوائیں',
    diagnosis: 'تشخیص',
    advice: 'مشورہ / ہدایات',
    followUp: 'فالو اپ',
    patientNotes: 'مریض نوٹس',
    privateNotes: 'ذاتی نوٹس',
    symptoms: 'علامات',
    labTests: 'لیب ٹیسٹ',
    procedures: 'عمل',
    dosage: 'ڈوز',
    frequency: 'فریکوئینسی',
    duration: 'مدت',
    quantity: 'مقدار',
    instructions: 'ہدایات',
    add: 'شامل کریں',
    remove: 'ہٹائیں',
    save: 'محفوظ کریں',
    cancel: 'منسوخ کریں',
    selectLanguage: 'زبان منتخب کریں'
  }
};

// Strip a leading salutation that CONTRADICTS the recorded gender before
// printing (legacy data: the Add-Patient form's default 'Mr.' got saved onto
// female patients' names, printing "MR. <female name>" on prescriptions).
// A title that matches the gender — or a neutral one — is left untouched.
function printableName(patient) {
  const name = String(patient?.name || '').trim();
  const g = String(patient?.gender || '').toUpperCase().charAt(0); // 'M' / 'F'
  const m = name.match(/^(mr|mrs|ms|miss|master)\.?\s+(.+)$/i);
  if (!m || !g) return name;
  const title = m[1].toLowerCase();
  const maleTitle = title === 'mr' || title === 'master';
  const femaleTitle = title === 'mrs' || title === 'ms' || title === 'miss';
  if ((g === 'F' && maleTitle) || (g === 'M' && femaleTitle)) return m[2];
  return name;
}

export default function PrescriptionPad() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const api = useApiClient();
  const apiBase = (import.meta.env && import.meta.env.VITE_API_URL) || '';
  const { user } = useAuth();  // Get logged in user
  const { language, changeLanguage } = useTranslation();
  
  const printRef = useRef(null);
  const getPrintPageStyle = () => {
    let pageMargin = '0mm';
    try {
      const m = JSON.parse(localStorage.getItem('rxTemplateMargins') || '{}');
      if (m.top != null || m.right != null || m.bottom != null || m.left != null) {
        pageMargin = `${m.top ?? 0}mm ${m.right ?? 0}mm ${m.bottom ?? 0}mm ${m.left ?? 0}mm`;
      }
    } catch (e) { /* ignore */ }
    return `
      @page { size: A4; margin: ${pageMargin}; }
      html, body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      /* Preserve table header backgrounds */
      thead th {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    `;
  };
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: getPrintPageStyle,
  });
  const adviceEditorRef = useRef(null);

  // State
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('prescription');
  const [_showVitalsConfig, _setShowVitalsConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const savingInProgress = useRef(false); // prevent concurrent saves on rapid clicks
  const pmhSectionWasHiddenRef = useRef(false);

  // Pad configuration state
  const [padFields, setPadFields] = useState(() => {
    try {
      const saved = localStorage.getItem('padConfiguration');
      if (saved) {
        const config = JSON.parse(saved);
        if (config.fields) return config.fields;
      }
    } catch (e) { /* ignore */ }
    return [
      'Patient Medical History',
      'Dental Chart (New/PRO)',
      'Vitals',
      'Symptoms',
      'Examination Findings',
      'Lab Results',
      'Diagnosis',
      'Medications',
      'Notes',
      'Follow Up & Advices'
    ];
  });
  const [fieldStates, setFieldStates] = useState(() => {
    try {
      const saved = localStorage.getItem('padConfiguration');
      if (saved) {
        const config = JSON.parse(saved);
        if (config.fieldStates) return config.fieldStates;
      }
    } catch (e) { /* ignore */ }
    return {
      'Patient Medical History': { enabled: true, autoCopy: false },
    };
  });

  // Meta state with doctor_id, date and time
  const [meta, setMeta] = useState({
    patient_id: patientId || '',
    doctor_id: '',
    appointment_id: '',
    prescription_date: getLocalDateString(), // YYYY-MM-DD
    prescription_time: (() => { const d = new Date(); const h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'); return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`; })()
  });
  
  const [vitals, setVitals] = useState({
    temp: '',
    height: '',
    bmi: '',
    weight: '',
    pulse: '',
    blood_pressure: '',
    spo2: ''
  });
  const [savingVitals, setSavingVitals] = useState(false);

  // Medical History State (dr.eka.care style)
  const [medicalHistoryData, setMedicalHistoryData] = useState({
    medicalHistory: [],      // Y/N toggle conditions
    existingConditions: [],  // Chronic conditions
    surgicalHistory: [],     // Past surgeries
    allergies: [],           // Drug allergies
    familyHistory: []        // Family history
  });
  const emptyMedicalHistoryData = useCallback(() => ({
    medicalHistory: [],
    existingConditions: [],
    surgicalHistory: [],
    allergies: [],
    familyHistory: []
  }), []);
  const [medicalHistoryLoading, setMedicalHistoryLoading] = useState(false);
  const [showAddConditionModal, setShowAddConditionModal] = useState(false);
  const [showAddSurgeryModal, setShowAddSurgeryModal] = useState(false);
  const [newCondition, setNewCondition] = useState({ condition_name: '', icd_code: '', start_date: '', notes: '' });
  const [newSurgery, setNewSurgery] = useState({ surgery_name: '', surgery_date: '', hospital: '', surgeon: '', complications: '' });

  // Function to render sections dynamically based on pad configuration
  const renderDynamicSections = () => {
    return padFields.map(fieldName => {
      const isEnabled = fieldStates[fieldName]?.enabled !== false;

      if (!isEnabled) return null;

      switch (fieldName) {
        case 'Patient Medical History':
          return (
            <div key="patient-medical-history" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">H</span>
                Patient Medical History
                {medicalHistoryLoading && <span className="text-xs text-slate-400 font-normal">Loading...</span>}
              </h2>

              {/* Existing Conditions */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Existing Conditions</span>
                  <button type="button" onClick={() => setShowAddConditionModal(true)} className="text-xs text-blue-600 hover:underline">+ Add</button>
                </div>
                {medicalHistoryData.existingConditions?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {medicalHistoryData.existingConditions.map((c) => (
                      <span key={c.id} className="flex items-center gap-1 px-2 py-1 bg-orange-50 border border-orange-200 text-orange-800 rounded text-xs">
                        {c.condition_name}
                        {c.status && <span className="text-orange-500 text-[10px]">({c.status})</span>}
                        <button type="button" onClick={() => deleteExistingCondition(c.id)} className="ml-1 text-orange-400 hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">None recorded</p>
                )}
              </div>

              {/* Allergies */}
              {medicalHistoryData.allergies?.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-slate-700">Allergies</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {medicalHistoryData.allergies.map((a, i) => (
                      <span key={i} className="px-2 py-1 bg-red-50 border border-red-200 text-red-800 rounded text-xs">
                        {a.allergen || a.allergy_name || a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Surgical History */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700">Surgical History</span>
                  <button type="button" onClick={() => setShowAddSurgeryModal(true)} className="text-xs text-blue-600 hover:underline">+ Add</button>
                </div>
                {medicalHistoryData.surgicalHistory?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {medicalHistoryData.surgicalHistory.map((s) => (
                      <span key={s.id} className="flex items-center gap-1 px-2 py-1 bg-purple-50 border border-purple-200 text-purple-800 rounded text-xs">
                        {s.surgery_name}
                        {s.surgery_date && <span className="text-purple-400 text-[10px]">({s.surgery_date})</span>}
                        <button type="button" onClick={() => deleteSurgicalProcedure(s.id)} className="ml-1 text-purple-400 hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">None recorded</p>
                )}
              </div>

              {/* Family History */}
              {medicalHistoryData.familyHistory?.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-slate-700">Family History</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {medicalHistoryData.familyHistory.map((f, i) => (
                      <span key={i} className="px-2 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded text-xs">
                        {f.relation}: {f.condition}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );

        case 'Dental Chart (New/PRO)':
          return (
            <div key="dental-chart" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0">🦷</span>
              <h2 className="text-sm font-semibold shrink-0">Dental Chart</h2>
              <span className="text-xs text-gray-400">— coming soon, will allow dental examination and charting here.</span>
            </div>
          );

        case 'Vitals':
          return (
            <div key="vitals" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">V</span>
                Vitals
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Temp (°F)</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    placeholder="98.6"
                    value={vitals.temp}
                    onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Height (cm)</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    placeholder="170"
                    value={vitals.height}
                    onChange={(e) => {
                      const newHeight = e.target.value;
                      const newWeight = vitals.weight;
                      let bmi = '';

                      if (newHeight && newWeight) {
                        const heightInMeters = parseFloat(newHeight) / 100;
                        bmi = (parseFloat(newWeight) / (heightInMeters * heightInMeters)).toFixed(2);
                      }

                      setVitals({ ...vitals, height: newHeight, bmi });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Weight (kg)</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    placeholder="70"
                    value={vitals.weight}
                    onChange={(e) => {
                      const newWeight = e.target.value;
                      const newHeight = vitals.height;
                      let bmi = '';

                      if (newHeight && newWeight) {
                        const heightInMeters = parseFloat(newHeight) / 100;
                        bmi = (parseFloat(newWeight) / (heightInMeters * heightInMeters)).toFixed(2);
                      }

                      setVitals({ ...vitals, weight: newWeight, bmi });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">BMI</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-600"
                    placeholder="24.2"
                    value={vitals.bmi}
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pulse</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    placeholder="72"
                    value={vitals.pulse}
                    onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">BP</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    placeholder="120/80"
                    value={vitals.blood_pressure}
                    onChange={(e) => setVitals({ ...vitals, blood_pressure: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SpO2 (%)</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    placeholder="98"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={async () => {
                      if (!vitals.temp && !vitals.height && !vitals.weight && !vitals.pulse && !vitals.blood_pressure && !vitals.spo2) {
                        addToast('Please enter at least one vital value', 'error');
                        return;
                      }
                      setSavingVitals(true);
                      try {
                        await api.post(`/api/patient-data/vitals/${patientId}`, {
                          appointment_id: meta.appointment_id ? parseInt(meta.appointment_id) : null,
                          temp: vitals.temp || null,
                          height: vitals.height || null,
                          weight: vitals.weight || null,
                          pulse: vitals.pulse || null,
                          spo2: vitals.spo2 || null,
                          blood_pressure: vitals.blood_pressure || null
                        });
                        addToast('Vitals saved', 'success');
                      } catch (err) {
                        addToast(err.response?.data?.error || 'Failed to save vitals', 'error');
                      } finally {
                        setSavingVitals(false);
                      }
                    }}
                    disabled={savingVitals}
                    className="w-full px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition"
                  >
                    {savingVitals ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          );

        case 'Symptoms':
          return (
            <div key="symptoms" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">Sx</span>
                  {uiLabels['en']?.symptoms || 'Symptoms'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTemplateSelector(true)}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition"
                  title="Use Symptoms Template"
                >
                  📋 Use Template
                </button>
              </div>
              <div className="relative">
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  placeholder="Start typing Symptoms / Chief Complaints"
                  value={symptomInput}
                  onChange={(e) => {
                    setSymptomInput(e.target.value);
                    setSymptomDropdown(true);
                  }}
                  onFocus={() => { setSymptomDropdown(true); setSymptomFocusTick(t => t + 1); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && symptomInput) {
                      e.preventDefault();
                      addSymptom(symptomInput);
                    }
                  }}
                  onBlur={() => setTimeout(() => setSymptomDropdown(false), 200)}
                />
                {symptomDropdown && filteredSymptoms.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                    {filteredSymptoms.map((s) => (
                      <button
                        key={s.term}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addSymptom(s.term)}
                      >
                        <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">Sx</span>
                        <span className="flex-1 text-gray-800 text-sm">{s.term}</span>
                        {s.icd_code && (
                          <span className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded flex-shrink-0">{s.icd_code}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {symptoms.map((s, idx) => {
                  const symptomName = typeof s === 'object' ? s.name : s;
                  const symptomRemarks = typeof s === 'object' ? s.remarks || '' : '';
                  return (
                    <div key={idx} className="flex items-center gap-1 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                      <span>{symptomName}</span>
                      <input
                        type="text"
                        placeholder="remarks..."
                        value={symptomRemarks}
                        onChange={(e) => {
                          const updated = [...symptoms];
                          updated[idx] = { name: symptomName, remarks: e.target.value };
                          setSymptoms(updated);
                        }}
                        className="ml-1 px-2 py-0.5 text-xs border border-blue-200 rounded bg-white w-24 focus:w-40 transition-all focus:outline-none focus:ring-1 focus:ring-blue-300"
                      />
                      <button
                        type="button"
                        onClick={() => setSymptoms(symptoms.filter((_, i) => i !== idx))}
                        className="text-blue-500 hover:text-blue-700 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1">
                {symptomSuggestions.slice(0, 8).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={() => addSymptom(s)}
                    className="px-2.5 py-1 text-xs bg-gray-100 border border-gray-200 rounded-full hover:bg-gray-200 hover:border-gray-300 transition"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          );

        case 'Examination Findings':
          return (
            <div key="examination-findings" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">🔍</span>
                  Examination Findings
                </h2>
                <button
                  type="button"
                  onClick={() => setShowExaminationTemplateModal(true)}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition"
                  title="Use Examination Template"
                >
                  📋 Use Template
                </button>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Start typing findings..."
                    value={examFindingInput}
                    onChange={(e) => {
                      setExamFindingInput(e.target.value);
                      setExamFindingDropdown(true);
                    }}
                    onFocus={() => setExamFindingDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addExamFinding(examFindingInput);
                      }
                      if (e.key === 'Escape') {
                        setExamFindingDropdown(false);
                      }
                    }}
                    onBlur={() => setTimeout(() => setExamFindingDropdown(false), 200)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  />

                  {examFindingDropdown && (frequentExamFindings.length > 0 || examFindingInput.trim()) && (
                    <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                      <div className="px-3 py-2 text-[11px] font-semibold text-slate-600 bg-slate-50 border-b">
                        FREQUENTLY <span className="font-normal text-slate-400">seen by you</span>
                      </div>
                      {frequentExamFindings
                        .filter((x) => {
                          const q = examFindingInput.trim().toLowerCase();
                          if (!q) return true;
                          return (x?.text || '').toLowerCase().includes(q);
                        })
                        .slice(0, 10)
                        .map((x) => (
                          <button
                            key={x.text}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-green-50 flex items-center justify-between"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addExamFinding(x.text)}
                          >
                            <span className="text-sm text-slate-800">{x.text}</span>
                            <span className="text-[11px] text-slate-400">{x.count || 0}</span>
                          </button>
                        ))}
                      {examFindingInput.trim() && (
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm text-slate-800 border-t"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addExamFinding(examFindingInput)}
                        >
                          + Add “{examFindingInput.trim()}”
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {examFindings.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    {examFindings.map((f, idx) => (
                      <div key={`${f.text}-${idx}`} className="grid grid-cols-12 gap-2 items-start p-2 border-b last:border-b-0 bg-white">
                        <div className="col-span-5 flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{f.text}</span>
                        </div>
                        <div className="col-span-6">
                          <input
                            type="text"
                            placeholder="Add notes here"
                            value={f.notes || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setExamFindings((prev) => {
                                const next = [...(prev || [])];
                                next[idx] = { ...next[idx], notes: val };
                                return next;
                              });
                            }}
                            className="w-full px-2 py-1.5 text-sm border rounded"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            className="text-slate-400 hover:text-red-600 px-2"
                            onClick={() => setExamFindings((prev) => (prev || []).filter((_, i) => i !== idx))}
                            title="Remove"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );

        case 'Lab Results':
          return (
            <div key="lab-results" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">L</span>
                  Lab Results & Medical Records
                </h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLabTemplateModal(true)}
                    className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition font-medium"
                  >
                    + Add Lab Result
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRecordUploadModal(true)}
                    className="px-3 py-1.5 text-xs bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition font-medium"
                  >
                    Upload File
                  </button>
                </div>
              </div>

              {/* Inline Lab Search */}
              <div className="space-y-2 relative">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search lab tests by name or code... (Press Enter to add new)"
                    value={labInlineSearch}
                    onChange={(e) => setLabInlineSearch(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && labInlineSearch.trim()) {
                        const searchTerm = labInlineSearch.trim();
                        const existsInCustom = customLabTestsFromOverview.some(ct =>
                          ct.test_name.toLowerCase() === searchTerm.toLowerCase()
                        );
                        if (existsInCustom) {
                          addToast(`"${searchTerm}" already exists in custom tests`, 'warning');
                          return;
                        }
                        try {
                          const res = await api.post('/api/custom-lab-tests', {
                            patientId,
                            test_name: searchTerm,
                            remark: '',
                            result_value: '',
                            unit: ''
                          });
                          setCustomLabTestsFromOverview(prev => [...prev, res.data.customLabTest]);
                          addToast(`"${searchTerm}" saved! Click on it to add remarks.`, 'success');
                          setLabInlineSearch('');
                        } catch (err) {
                          addToast('Failed to save custom test', 'error');
                        }
                      }
                    }}
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  />
                  {labInlineSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 border rounded bg-white shadow-lg z-50 max-h-64 overflow-y-auto">
                      {/* Existing Lab Results */}
                      {labResultEntries.filter(e => e.test_name?.toLowerCase().includes(labInlineSearch.toLowerCase())).length > 0 && (
                        <>
                          <div className="px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-600 sticky top-0">Existing Results</div>
                          {labResultEntries.filter(e => e.test_name?.toLowerCase().includes(labInlineSearch.toLowerCase())).map((e, i) => (
                            <div key={`existing-${i}`} className="px-3 py-2 border-b text-sm">
                              <div className="font-medium text-xs">{e.test_name}</div>
                              <div className="text-[10px] text-gray-600">
                                {e.result_value} {e.result_unit || ''} {e.date ? `• ${new Date(e.date).toLocaleDateString('en-IN')}` : ''}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      {/* Custom Tests from PatientOverview */}
                      {customLabTestsFromOverview.filter(ct => ct.test_name?.toLowerCase().includes(labInlineSearch.toLowerCase())).length > 0 && (
                        <>
                          <div className="px-3 py-2 text-xs font-semibold bg-orange-100 text-orange-700 sticky top-0">Saved Custom Tests</div>
                          {customLabTestsFromOverview
                            .filter(ct => ct.test_name?.toLowerCase().includes(labInlineSearch.toLowerCase()))
                            .map(ct => (
                              <button
                                key={`custom-${ct.id}`}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomTest(ct);
                                  setCustomTestForm({ test_name: ct.test_name, remark: '', result_value: '', unit: '', reference_range: '', result_date: getLocalDateString() });
                                  setLabInlineSearch('');
                                  setShowCustomTestModal(true);
                                }}
                                className="w-full text-left px-3 py-2 border-b text-sm hover:bg-orange-50 transition"
                              >
                                <div className="font-medium text-xs flex items-center gap-2">
                                  {ct.test_name}
                                  <span className="text-[10px] bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded">Custom</span>
                                </div>
                                {ct.result_value && (
                                  <div className="text-[10px] text-gray-600">
                                    {ct.result_value} {ct.unit || ''}
                                    {ct.remark && <span className="text-orange-600"> • {ct.remark}</span>}
                                  </div>
                                )}
                              </button>
                            ))}
                        </>
                      )}
                      {/* Available Test Templates */}
                      {labTemplates.filter(t => t.test_name?.toLowerCase().includes(labInlineSearch.toLowerCase()) || (t.test_code && t.test_code.toLowerCase().includes(labInlineSearch.toLowerCase()))).length > 0 && (
                        <>
                          <div className="px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-600 sticky top-0">Available Tests</div>
                          {labTemplates
                            .filter(t => t.test_name?.toLowerCase().includes(labInlineSearch.toLowerCase()) || (t.test_code && t.test_code.toLowerCase().includes(labInlineSearch.toLowerCase())))
                            .slice(0, 20)
                            .map(t => (
                              <button
                                key={`tpl-${t.id}`}
                                type="button"
                                onClick={async () => {
                                  setLabParamLoading(true);
                                  setLabParamFormTest(t);
                                  setLabInlineSearch('');
                                  try {
                                    const res = await api.get(`/api/lab-templates/${t.id}/parameters`);
                                    const params = res.data.parameters || [];
                                    setLabParamFormData(params.map(p => ({ ...p, result_value: '' })));
                                  } catch {
                                    setLabParamFormData([]);
                                  }
                                  setLabParamLoading(false);
                                  setShowLabTemplateModal(true);
                                }}
                                className="w-full text-left px-3 py-2 border-b text-sm hover:bg-purple-50 transition"
                              >
                                <div className="font-medium text-xs flex items-center gap-2">
                                  {t.test_name}
                                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Add</span>
                                </div>
                                <div className="text-[10px] text-gray-600">
                                  {t.category && <span className="text-purple-600">{t.category}</span>}
                                  {t.sample_type && <span> • {t.sample_type}</span>}
                                </div>
                              </button>
                            ))}
                        </>
                      )}
                      {labResultEntries.filter(e => e.test_name?.toLowerCase().includes(labInlineSearch.toLowerCase())).length === 0 &&
                       labTemplates.filter(t => t.test_name?.toLowerCase().includes(labInlineSearch.toLowerCase()) || (t.test_code && t.test_code.toLowerCase().includes(labInlineSearch.toLowerCase()))).length === 0 &&
                       customLabTestsFromOverview.filter(ct => ct.test_name?.toLowerCase().includes(labInlineSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-3 text-sm text-gray-500 text-center">
                          <div>No results found</div>
                          <div className="text-xs mt-1 text-blue-600">
                            Press <span className="font-semibold">Enter</span> to save "{labInlineSearch}" as custom test
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Lab Result Entries */}
              {labResultEntries.length > 0 && (
                <div className="space-y-2">
                  {labResultEntries.map((entry, idx) => (
                    <div key={idx} className="border rounded overflow-hidden">
                      <div className="flex items-center justify-between bg-purple-50 px-3 py-2">
                        <div>
                          <span className="text-xs font-semibold text-purple-800">{entry.test_name}</span>
                          {entry.category && <span className="text-[10px] text-purple-500 ml-2">{entry.category}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const entry = labResultEntries[idx];
                            if (entry.paramIds && entry.paramIds.length > 0) {
                              for (const pid of entry.paramIds) {
                                try { await api.delete(`/api/labs/${pid}`); } catch (err) { console.error('Failed to delete param:', err); }
                              }
                            } else if (entry.id) {
                              try { await api.delete(`/api/labs/${entry.id}`); } catch (err) { console.error('Failed to delete lab result:', err); }
                            }
                            setLabResultEntries(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >×</button>
                      </div>
                      {entry.parameters && entry.parameters.length > 0 ? (
                        <div>
                          <div className="grid grid-cols-12 bg-gray-50 text-[10px] font-semibold text-gray-600 px-3 py-1 gap-1">
                            <span className="col-span-4">Parameter</span>
                            <span className="col-span-3">Result</span>
                            <span className="col-span-2">Unit</span>
                            <span className="col-span-3">Reference</span>
                          </div>
                          {entry.parameters.map((p, pIdx) => (
                            <div key={pIdx} className="grid grid-cols-12 px-3 py-1 text-xs border-t items-center gap-1">
                              <span className="col-span-4 truncate" title={p.parameter_name}>{p.parameter_name}</span>
                              <span className="col-span-3 font-medium text-purple-700">{p.result_value}</span>
                              <span className="col-span-2 text-gray-500">{p.unit || '-'}</span>
                              <span className="col-span-3 text-gray-500">{p.reference_range || '-'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 space-y-1">
                          <div className="grid grid-cols-4 text-sm items-center gap-1">
                            <input
                              type="text"
                              className="px-2 py-1 border rounded text-xs w-full col-span-1"
                              placeholder="Value"
                              value={entry.result_value || ''}
                              onChange={(e) => {
                                const updated = [...labResultEntries];
                                updated[idx].result_value = e.target.value;
                                setLabResultEntries(updated);
                              }}
                            />
                            <span className="text-xs text-gray-500">{entry.result_unit || '-'}</span>
                            <span className="text-xs text-gray-500">{entry.reference_range || '-'}</span>
                            <span className="text-xs text-gray-400">
                              {entry.date ? new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                            </span>
                          </div>
                          {entry.notes && (
                            <div className="text-[11px] text-orange-700 italic px-1">
                              {entry.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Medical Records - card grid like PatientOverview */}
              {pastRecords.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {pastRecords.map((rec, idx) => (
                    <div key={`rec-${idx}`} className="p-3 border rounded bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{rec.record_title || rec.record_type || rec.name}</p>
                          <p className="text-xs text-slate-600">{rec.uploaded_date ? new Date(rec.uploaded_date).toLocaleDateString('en-IN') : rec.date || ''}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          rec.category === 'BLOOD_TEST' ? 'bg-red-100 text-red-700' :
                          rec.category === 'X_RAY' ? 'bg-blue-100 text-blue-700' :
                          rec.category === 'MRI' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{rec.category || rec.record_type || 'RECORD'}</span>
                      </div>
                      <div className="w-full h-16 bg-slate-200 rounded flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (rec.file_path) {
                              window.open(`${apiBase}${rec.file_path}`, '_blank');
                            } else {
                              addToast('No file available', 'error');
                            }
                          }}
                          className="text-xs text-primary hover:underline"
                        >View</button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (rec.file_path) {
                              try {
                                const response = await fetch(`${apiBase}${rec.file_path}`);
                                const blob = await response.blob();
                                const blobUrl = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = rec.record_title || rec.name || 'record';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
                              } catch { addToast('Download failed', 'error'); }
                            } else {
                              addToast('No file available', 'error');
                            }
                          }}
                          className="text-xs text-slate-600 hover:underline"
                        >Download</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {labResultEntries.length === 0 && pastRecords.length === 0 && (
                <p className="text-sm text-gray-400 italic">No lab results or medical records found.</p>
              )}

              {/* Lab Test Advice - Tag Input */}
              <div className="relative pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Lab Test Advice</label>
                  <button
                    type="button"
                    onClick={() => {
                      setLabAdviceGroupTab('groups');
                      setShowLabAdviceGroupForm(false);
                      setEditingLabAdviceGroup(null);
                      setLabAdviceGroupName('');
                      setLabAdviceGroupTests([]);
                      setLabAdviceGroupSearch('');
                      setShowLabAdviceGroupModal(true);
                    }}
                    className="px-3 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 transition"
                    title="Use Lab Test Groups"
                  >
                    Groups
                  </button>
                </div>
                <div className="border rounded p-2 flex flex-wrap gap-1 min-h-[42px] focus-within:ring-1 focus-within:ring-blue-400 bg-white cursor-text">
                  {labAdvice.split(',').map(t => t.trim()).filter(Boolean).map((tag, i) => (
                    <span key={i} className="relative inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                      <button
                        type="button"
                        title="Click to add remark"
                        onClick={() => setLabAdviceRemarkEdit(labAdviceRemarkEdit === i ? null : i)}
                        className="hover:underline text-left"
                      >
                        {tag}
                        {labAdviceRemarks[tag] && (
                          <span className="ml-1 text-blue-500 italic">({labAdviceRemarks[tag]})</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tags = labAdvice.split(',').map(t => t.trim()).filter(Boolean);
                          tags.splice(i, 1);
                          setLabAdvice(tags.join(', '));
                          const newRemarks = { ...labAdviceRemarks };
                          delete newRemarks[tag];
                          setLabAdviceRemarks(newRemarks);
                          if (labAdviceRemarkEdit === i) setLabAdviceRemarkEdit(null);
                        }}
                        className="text-blue-500 hover:text-blue-800 font-bold leading-none"
                      >×</button>
                      {labAdviceRemarkEdit === i && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-white border rounded shadow-lg p-2 w-48">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Add remark..."
                            value={labAdviceRemarks[tag] || ''}
                            onChange={(e) => setLabAdviceRemarks(prev => ({ ...prev, [tag]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') setLabAdviceRemarkEdit(null);
                            }}
                            className="w-full text-xs border rounded px-2 py-1 focus:ring-1 focus:ring-blue-400 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setLabAdviceRemarkEdit(null)}
                            className="mt-1 w-full text-xs bg-blue-600 text-white rounded py-0.5 hover:bg-blue-700"
                          >Done</button>
                        </div>
                      )}
                    </span>
                  ))}
                  <input
                    type="text"
                    value={labAdviceInput}
                    onChange={(e) => { setLabAdviceInput(e.target.value); setLabAdviceDropdown(true); }}
                    onFocus={() => setLabAdviceDropdown(true)}
                    onBlur={() => setTimeout(() => setLabAdviceDropdown(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && labAdviceInput.trim()) {
                        e.preventDefault();
                        const newTag = labAdviceInput.trim();
                        addLabAdviceTag(newTag, { saveCustom: true });
                      } else if (e.key === 'Backspace' && !labAdviceInput) {
                        const tags = labAdvice.split(',').map(t => t.trim()).filter(Boolean);
                        if (tags.length > 0) {
                          tags.pop();
                          setLabAdvice(tags.join(', '));
                        }
                      } else if (e.key === 'Escape') {
                        setLabAdviceDropdown(false);
                      }
                    }}
                    placeholder={labAdvice ? '' : 'Type or select a test...'}
                    className="flex-1 min-w-[150px] text-sm outline-none py-0.5"
                  />
                </div>
                {/* Dropdown */}
                {labAdviceDropdown && (() => {
                  const existing = labResultEntries.filter(e =>
                    !labAdviceInput || e.test_name?.toLowerCase().includes(labAdviceInput.toLowerCase())
                  );
                  const query = (labAdviceInput || '').trim();
                  // Normalize name: strip trailing "(value)" so "abcd (78 mm)" dedupes with "abcd"
                  const normalizeAdviceName = (n) => (n || '').replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
                  const seenAdviceNames = new Set();
                  const customMatches = (customLabAdviceTests || [])
                    .filter(x => {
                      const norm = normalizeAdviceName(x?.name);
                      if (seenAdviceNames.has(norm)) return false;
                      seenAdviceNames.add(norm);
                      return !query || (x?.name || '').toLowerCase().includes(query.toLowerCase()) || norm.includes(query.toLowerCase());
                    })
                    .map(x => ({ ...x, name: normalizeAdviceName(x.name) || x.name })) // show clean name
                    .sort((a, b) => {
                      const ra = rankMatch(a?.name, query);
                      const rb = rankMatch(b?.name, query);
                      if (ra !== rb) return ra - rb;
                      return (Number(b?.count) || 0) - (Number(a?.count) || 0);
                    })
                    .slice(0, 8);

                  // Custom tests from PatientOverview
                  console.log('Dropdown query:', query);
                  console.log('customLabTestsFromOverview:', customLabTestsFromOverview);
                  const customFromOverview = (customLabTestsFromOverview || [])
                    .slice(0, 10); // Show all custom tests without filtering
                  console.log('customFromOverview after filter:', customFromOverview);

                  const templates = (labTemplates || [])
                    .filter(t => (query ? ((t.test_name || '').toLowerCase().includes(query.toLowerCase()) || (t.test_code || '').toLowerCase().includes(query.toLowerCase())) : true))
                    .sort((a, b) => {
                      const ra = Math.min(rankMatch(a?.test_name, query), rankMatch(a?.test_code, query));
                      const rb = Math.min(rankMatch(b?.test_name, query), rankMatch(b?.test_code, query));
                      if (ra !== rb) return ra - rb;
                      return (a.test_name || '').localeCompare(b.test_name || '');
                    })
                    .slice(0, 20);

                  // Sort patient lab results by relevance too
                  const existingSorted = (existing || []).slice().sort((a, b) => {
                    const ra = rankMatch(a?.test_name, query);
                    const rb = rankMatch(b?.test_name, query);
                    if (ra !== rb) return ra - rb;
                    return (a.test_name || '').localeCompare(b.test_name || '');
                  }).slice(0, 10);

                  if (existingSorted.length === 0 && templates.length === 0 && customMatches.length === 0 && customFromOverview.length === 0) return null;

                  return (
                    <div className="absolute left-0 right-0 mt-1 border rounded bg-white shadow-lg z-50 max-h-56 overflow-y-auto">
                      {customMatches.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-semibold bg-gray-100 text-gray-500 sticky top-0">Your Custom / Recent Tests</div>
                          {customMatches.map((x, i) => (
                            <button
                              key={`ct-${i}`}
                              type="button"
                              onMouseDown={(ev) => { ev.preventDefault(); addLabAdviceTag(x.name, { saveCustom: true }); setLabAdviceAutoOpenTag(x.name); }}
                              className="w-full text-left px-3 py-2 border-b text-sm hover:bg-purple-50 transition"
                            >
                              <span className="text-xs font-medium">{x.name}</span>
                              <span className="text-[10px] text-gray-400 ml-2">saved</span>
                            </button>
                          ))}
                        </>
                      )}

                      {customFromOverview.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-semibold bg-orange-100 text-orange-700 sticky top-0">Saved Custom Tests from Patient Overview</div>
                          {customFromOverview.map((ct, i) => (
                            <button
                              key={`cto-${ct.id || i}`}
                              type="button"
                              onMouseDown={(ev) => {
                                ev.preventDefault();
                                addLabAdviceTag(ct.test_name);
                                setLabAdviceAutoOpenTag(ct.test_name);
                              }}
                              className="w-full text-left px-3 py-2 border-b text-sm hover:bg-orange-50 transition"
                            >
                              <span className="text-xs font-medium">{ct.test_name}</span>
                              {ct.result_value && <span className="text-[10px] text-gray-500 ml-2">{ct.result_value} {ct.unit || ''}</span>}
                              {ct.remark && <span className="text-[10px] text-orange-600 ml-2">• {ct.remark}</span>}
                            </button>
                          ))}
                        </>
                      )}

                      {existingSorted.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-semibold bg-gray-100 text-gray-500 sticky top-0">From Patient Lab Results</div>
                          {existingSorted.map((e, i) => (
                            <button
                              key={`ea-${i}`}
                              type="button"
                              onMouseDown={(ev) => { ev.preventDefault(); addLabAdviceTag(e.test_name); }}
                              className="w-full text-left px-3 py-2 border-b text-sm hover:bg-blue-50 transition"
                            >
                              <span className="text-xs font-medium">{e.test_name}</span>
                              {e.result_value && <span className="text-[10px] text-gray-500 ml-2">{e.result_value} {e.result_unit || ''}</span>}
                            </button>
                          ))}
                        </>
                      )}
                      {templates.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[10px] font-semibold bg-gray-100 text-gray-500 sticky top-0">Available Tests</div>
                          {templates.map((t) => (
                            <button
                              key={`ta-${t.id}`}
                              type="button"
                              onMouseDown={(ev) => { ev.preventDefault(); addLabAdviceTag(t.test_name); }}
                              className="w-full text-left px-3 py-2 border-b text-sm hover:bg-purple-50 transition"
                            >
                              <span className="text-xs font-medium">{t.test_name}</span>
                              {t.category && <span className="text-[10px] text-purple-600 ml-2">{t.category}</span>}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
              {/* Remarks */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  rows={2}
                  value={labRemarks}
                  onChange={(e) => setLabRemarks(e.target.value)}
                  placeholder="Additional remarks or notes..."
                />
              </div>
            </div>
          );

        case 'Diagnosis':
          return (
            <div key="diagnosis" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">Dx</span>
                  {uiLabels['en']?.diagnosis || 'Diagnosis'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDiagnosisTemplateSelector(true)}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 transition"
                  title="Use Diagnosis Template"
                >
                  📋 Use Template
                </button>
              </div>
              <div className="relative">
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  placeholder="Start typing Diagnosis"
                  value={diagnosisInput}
                  onChange={(e) => {
                    setDiagnosisInput(e.target.value);
                    setDiagnosisDropdown(true);
                    setSnomedDiagnosisPage(0);
                  }}
                  onFocus={() => setDiagnosisDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setDiagnosisDropdown(false); return; }
                    if (e.key === 'Enter' && diagnosisInput) {
                      e.preventDefault();
                      addDiagnosis(diagnosisInput);
                    }
                  }}
                  onBlur={() => setTimeout(() => setDiagnosisDropdown(false), 200)}
                />
                {diagnosisDropdown && (Boolean(diagnosisInput) || combinedDiagnosisResults.length > 0 || snomedDiagnosisResults.length > 0 || (frequentlyUsedDiagnoses.length > 0 && !diagnosisInput)) && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-64 overflow-y-auto">
                    {/* FREQUENTLY seen by you — shown when no search text */}
                    {!diagnosisInput && frequentlyUsedDiagnoses.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-blue-50 text-xs font-semibold text-blue-900 border-b flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">FREQUENTLY</span>
                          seen by you
                          <span className="text-blue-600 font-normal ml-auto">esc Close</span>
                        </div>
                        {frequentlyUsedDiagnoses.map((item, idx) => (
                          <button
                            key={`freq-dx-${idx}`}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 border-b border-slate-100"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addDiagnosis({ label: item.diagnosis_name, code: item.icd_code || '' })}
                          >
                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs shrink-0">Dx</span>
                            <div className="flex flex-col flex-1">
                              <span className="text-sm">
                                {item.diagnosis_name}
                                {item.icd_code && <span className="text-xs text-purple-600 font-medium ml-2">({item.icd_code})</span>}
                              </span>
                              {!item.icd_code && <span className="text-xs text-slate-400">No code assigned</span>}
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {combinedDiagnosisResults.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-600 border-b flex items-center justify-between">
                          <span>Suggestions</span>
                          {diagnosisLoading && (
                            <span className="text-xs font-normal text-slate-500">Searching…</span>
                          )}
                        </div>
                        {combinedDiagnosisResults.map((item) => (
                          <button
                            key={`${item.type}-${item.code || item.label}`}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addDiagnosis({ label: item.label, code: item.code || '' })}
                          >
                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs">Dx</span>
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.code && <span className="text-xs text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded">{item.code}</span>}
                              </div>
                              {item.type === 'custom' && (
                                <span className="text-xs text-green-600">Your custom diagnosis</span>
                              )}
                              {item.type === 'icd' && item.code && !item.type.includes('custom') && (
                                <span className="text-xs text-slate-500">{item.version || 'ICD'}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </>
                    )}

                    {diagnosisInput && diagnosisLoading && combinedDiagnosisResults.length === 0 && snomedDiagnosisResults.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>
                    )}

                    {diagnosisInput && !diagnosisLoading && combinedDiagnosisResults.length === 0 && snomedDiagnosisResults.length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-500">No results</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {diagnoses.map((rawD, idx) => {
                  // Defensively unwrap any diagnosis entry that is itself a JSON-encoded
                  // array/object string (from stale copied/prefilled data) so the chip
                  // shows a clean label instead of raw JSON.
                  let d = rawD;
                  if (typeof rawD === 'string' && (rawD.trim().startsWith('[') || rawD.trim().startsWith('{'))) {
                    try {
                      const parsed = JSON.parse(rawD);
                      d = Array.isArray(parsed) ? (parsed[0] || rawD) : parsed;
                    } catch { /* not JSON, keep as-is */ }
                  }
                  const label = typeof d === 'string' ? d : (d.label || d.icd_title || '');
                  const code = typeof d === 'object' ? (d.code || '') : '';
                  return (
                    <div key={idx} className="flex items-center gap-1 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-sm">
                      <span>{label}</span>
                      {code && <span className="text-xs text-purple-600 font-medium">({code})</span>}
                      <button
                        type="button"
                        onClick={() => setDiagnoses(diagnoses.filter((_, i) => i !== idx))}
                        className="text-purple-500 hover:text-purple-700 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1">
                {diagnosisSuggestions.slice(0, 8).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onMouseDown={() => addDiagnosis(d)}
                    className="px-2.5 py-1 text-xs bg-gray-100 border border-gray-200 rounded-full hover:bg-gray-200 hover:border-gray-300 transition"
                  >
                    + {d}
                  </button>
                ))}
              </div>
            </div>
          );

        case 'Medications':
          return (
            <div key="medications" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
              
              {/* Smart Suggestions */}
              {showSmartSuggestions && (
                <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm text-blue-900">💡 Smart Suggestions</h4>
                    <button
                      type="button"
                      onClick={() => setShowSmartSuggestions(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Suggestion counts */}

                  {/* Frequently Used Medicines */}
                  {smartSuggestions.frequentlyUsed.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">🔄 Frequently Used for This Patient</div>
                      <div className="flex flex-wrap gap-1">
                        {smartSuggestions.frequentlyUsed.slice(0, 5).map((med, idx) => (
                          <button
                            key={`freq-sugg-${idx}`}
                            type="button"
                            onMouseDown={() => addMed(med)}
                            className="px-2 py-1 bg-white border border-blue-200 rounded text-xs hover:bg-blue-50 transition"
                            title={med.composition ? `${med.composition}${med.strength ? ` (${med.strength})` : ''}` : ''}
                          >
                            {med.brand || med.name}{med.composition ? ` - ${med.composition}` : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Diagnosis-based Medicines */}
                  {smartSuggestions.medicines && smartSuggestions.medicines.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">🎯 Suggested Medicines</div>
                      <div className="flex flex-wrap gap-1">
                        {smartSuggestions.medicines.slice(0, 10).map((med, idx) => (
                          <button
                            key={`med-sugg-${idx}`}
                            type="button"
                            onMouseDown={() => addMed(med)}
                            className={`px-2 py-1 border rounded text-xs hover:opacity-80 transition ${
                              med.source === 'icd11' ? 'bg-purple-50 border-purple-200' :
                              med.source === 'icd10' ? 'bg-blue-50 border-blue-200' :
                              med.source === 'symptom' ? 'bg-green-50 border-green-200' :
                              med.source === 'dosage_reference' ? 'bg-yellow-50 border-yellow-200' :
                              med.source === 'snomed_medication' ? 'bg-pink-50 border-pink-200' :
                              'bg-white border-gray-200'
                            }`}
                            title={`${med.source} - ${med.evidence_level || 'No evidence level'}${med.composition ? ` - ${med.composition}` : ''}`}
                          >
                            {med.brand || med.name}{med.composition ? ` - ${med.composition}` : ''}
                            {med.evidence_level && (
                              <span className="ml-1 text-xs opacity-75">({med.evidence_level})</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Symptom-based Medicines */}
                  {smartSuggestions.medicines && smartSuggestions.medicines.filter(m => m.original_symptom).length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">🔥 Based on Symptoms</div>
                      <div className="flex flex-wrap gap-1">
                        {smartSuggestions.medicines
                          .filter(m => m.original_symptom)
                          .slice(0, 8)
                          .map((med, idx) => (
                            <button
                              key={`sym-sugg-${idx}`}
                              type="button"
                              onMouseDown={() => addMed(med)}
                              className="px-2 py-1 bg-green-50 border border-green-200 rounded text-xs hover:bg-green-100 transition"
                              title={`For ${med.original_symptom}${med.composition ? ` - ${med.composition}` : ''}`}
                            >
                              {med.brand || med.name}{med.composition ? ` - ${med.composition}` : ''}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Injection Suggestions */}
                  {smartSuggestions.injections && smartSuggestions.injections.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-700 mb-2">💉 Suggested Injections</div>
                      <div className="flex flex-wrap gap-1">
                        {smartSuggestions.injections.slice(0, 8).map((inj, idx) => (
                          <button
                            key={`inj-sugg-${idx}`}
                            type="button"
                            onMouseDown={() => {
                              setMeds(prev => [...prev, {
                                type: 'injection',
                                name: inj.injection_name || inj.name || '',
                                brand: inj.injection_name || inj.name || '',
                                composition: inj.generic_name || '',
                                dose: inj.dose || '',
                                route: inj.route || 'IV',
                                infusion_rate: inj.infusion_rate || '',
                                frequency: inj.frequency || '',
                                duration: inj.duration || '',
                                timing: inj.timing || '',
                                instructions: inj.instructions || ''
                              }]);
                            }}
                            className="px-2 py-1 bg-orange-50 border border-orange-200 rounded text-xs hover:bg-orange-100 transition"
                            title={inj.generic_name ? `${inj.generic_name} - ${inj.route || ''}` : ''}
                          >
                            💉 {inj.injection_name || inj.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            {/* Instruction Language Selector */}
            <div className="flex items-center gap-2 mb-3">
              <label htmlFor="instruction-language" className="text-sm font-medium text-gray-700">Instruction Language:</label>
              <select
                className="px-3 py-2 border rounded text-sm"
                id="instruction-language"
                value={language}
                onChange={(e) => {
                  const newLang = e.target.value;
                  changeLanguage(newLang);
                  // Translation handled by useEffect on language change
                }}
              >
                {instructionLanguages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              {!showTaperInput ? (
                <button
                  type="button"
                  onClick={() => setShowTaperInput(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded font-medium text-sm hover:bg-purple-700 transition-all shadow-sm flex items-center gap-1.5"
                >
                  <span className="text-base leading-none">↓</span> Add Tapering Dose
                </button>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="relative flex-1">
                    <label className="text-xs font-semibold text-purple-700 mb-1 block">Search medicine for tapering dose:</label>
                    <input
                      autoFocus
                      className="w-full px-3 py-2 border border-purple-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      placeholder="Type medicine name (e.g. Prednisolone, Wysolone)..."
                      value={taperMedInput}
                      onChange={(e) => {
                        setTaperMedInput(e.target.value);
                        searchTaperMeds(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && taperMedInput.trim()) {
                          e.preventDefault();
                          addTaperMed(taperMedInput.trim());
                        }
                        if (e.key === 'Escape') {
                          setShowTaperInput(false);
                          setTaperMedInput('');
                          setTaperMedResults([]);
                        }
                      }}
                    />
                    {(taperMedResults.length > 0 || taperMedLoading) && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-purple-200 rounded shadow-lg max-h-60 overflow-y-auto">
                        {taperMedLoading && <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>}
                        {taperMedResults.map((m, idx) => (
                          <button
                            key={`taper-${idx}`}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b text-sm"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addTaperMed(m)}
                          >
                            <div className="font-medium text-gray-900">{m.brand || m.name}</div>
                            {(m.composition || m.generic_name || m.strength) && (
                              <div className="text-xs text-gray-500">{[m.composition || m.generic_name, m.strength].filter(Boolean).join(' | ')}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowTaperInput(false); setTaperMedInput(''); setTaperMedResults([]); }}
                    className="mt-6 px-3 py-2 text-sm text-gray-500 hover:text-red-600 border rounded hover:border-red-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="relative sticky top-16 z-20 bg-white p-4 -mx-4 shadow-sm border-b">
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Search & Add Medicines</label>
              <input
                data-testid="medicine-input"
                className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                placeholder="Start typing Medicines name (e.g. Crocin, Amoxicillin)..."
                value={medInput}
                onFocus={() => setMedDropdown(true)}
                onChange={(e) => {
                  setMedInput(e.target.value);
                  setMedDropdown(true);
                  setSnomedDrugPage(0);
                  setMedResultsPage(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && medInput.trim()) {
                    e.preventDefault();
                    addMed(medInput.trim());
                  }
                }}
                onBlur={() => setTimeout(() => setMedDropdown(false), 200)}
              />
              {medDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-80 overflow-y-auto">
                  {frequentlyPrescribedMeds.length > 0 && (
                    <>
                      <div className="px-3 py-2 bg-blue-50 text-xs font-semibold text-blue-900 border-b">
                        FREQUENTLY prescribed by you
                      </div>
                      {frequentlyPrescribedMeds.filter(m =>
                        (m.name || '').toLowerCase().includes(medInput.toLowerCase()) ||
                        (m.brand || '').toLowerCase().includes(medInput.toLowerCase())
                      ).map((m, idx) => (
                        <button
                          key={`freq-${idx}-${m.name}`}
                          type="button"
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b flex items-start justify-between gap-2 transition-colors"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addMed(m)}
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            {(m.dosage_form || m.form) && (
                              <span className="shrink-0 w-8 h-8 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-[9px] font-bold uppercase leading-none text-center">
                                {(m.dosage_form || m.form || 'Rx').slice(0,3).toUpperCase()}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              {/* eKA Care Format: Medicine Name - Composition */}
                              <div className="font-semibold text-sm text-slate-900">
                                {m.name || m.brand}
                                {m.composition && <span className="text-slate-600 font-normal"> - {m.composition}</span>}
                              </div>
                              {/* Pack Size + Manufacturer */}
                              <div className="flex items-center gap-1 mt-0.5">
                                {m.strength && (
                                  <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    {m.strength}
                                  </span>
                                )}
                                {m.manufacturer_name && (
                                  <span className="text-[10px] text-slate-400 truncate">
                                    {m.manufacturer_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {(m.dosage || m.frequency || m.timing || m.duration) && (
                            <div className="text-[10px] text-slate-500 text-right shrink-0 whitespace-nowrap">
                              {[m.dosage, m.frequency, m.timing, m.duration].filter(Boolean).join(' | ')}
                            </div>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                  {filteredMeds.length > 0 && (() => {
                    const MED_PAGE_SIZE = 30;
                    const totalMedPages = Math.ceil(filteredMeds.length / MED_PAGE_SIZE);
                    const pagedMeds = filteredMeds.slice(medResultsPage * MED_PAGE_SIZE, (medResultsPage + 1) * MED_PAGE_SIZE);
                    return (
                      <>
                        <div className="px-3 py-2 bg-green-50 text-xs font-semibold text-green-900 border-b flex items-center justify-between">
                          <span>MEDICINES ({filteredMeds.length} results)</span>
                          {totalMedPages > 1 && (
                            <div className="flex items-center gap-2">
                              <button type="button" className="px-2 py-0.5 border rounded text-xs disabled:opacity-40" onMouseDown={e => e.preventDefault()} onClick={() => setMedResultsPage(p => Math.max(0, p - 1))} disabled={medResultsPage === 0}>Prev</button>
                              <span className="text-xs text-green-700">{medResultsPage + 1} / {totalMedPages}</span>
                              <button type="button" className="px-2 py-0.5 border rounded text-xs disabled:opacity-40" onMouseDown={e => e.preventDefault()} onClick={() => setMedResultsPage(p => Math.min(totalMedPages - 1, p + 1))} disabled={medResultsPage >= totalMedPages - 1}>Next</button>
                            </div>
                          )}
                        </div>
                        {pagedMeds.map((m, idx) => (
                          <button
                            key={`sugg-${medResultsPage}-${idx}-${m.name}`}
                            type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-green-50 border-b border-slate-100 flex items-start gap-2 transition-colors"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addMed(m)}
                          >
                            <span className="shrink-0 w-8 h-8 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-[9px] font-bold uppercase leading-none text-center">
                              {(m.dosage_form || 'Rx').slice(0,3).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              {/* eKA Care Format: Medicine Name - Composition - Pack Size */}
                              <div className="font-semibold text-sm text-slate-900">
                                {m.name || m.brand}
                                {m.composition && <span className="text-slate-600 font-normal"> - {m.composition}</span>}
                              </div>

                              {/* Bottom row: Pack Size + Manufacturer + Source */}
                              <div className="flex items-center gap-1 mt-0.5">
                                {/* Pack Size or Strength */}
                                {m.strength && (
                                  <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    {m.strength}
                                  </span>
                                )}

                                {/* Manufacturer */}
                                {m.manufacturer_name && (
                                  <span className="text-[10px] text-slate-400 truncate">
                                    {m.manufacturer_name}
                                  </span>
                                )}

                                {/* Source badge */}
                                {m.source && (
                                  <span className={`text-[9px] px-1 py-0.5 rounded whitespace-nowrap ${
                                    m.source === 'consolidated' ? 'bg-green-100 text-green-700' :
                                    m.source === 'medicines' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {m.source === 'consolidated' ? '🏥 Extended' : '⭐ Curated'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </>
                    );
                  })()}
                  {snomedDrugResults.length > 0 && (
                    <>
                      <div className="px-3 py-2 bg-purple-50 text-xs font-semibold text-purple-900 border-b flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <span>🔬 SNOMED CT Drug Database</span>
                          <span className="text-purple-600 font-normal">({snomedDrugResults.length} results)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" className="px-2 py-0.5 border rounded text-xs disabled:opacity-50" onClick={() => setSnomedDrugPage(p => Math.max(0, p - 1))} disabled={snomedDrugPage === 0}>Prev</button>
                          <span className="text-xs text-purple-700">Page {snomedDrugPage + 1}</span>
                          <button type="button" className="px-2 py-0.5 border rounded text-xs" onClick={() => setSnomedDrugPage(p => p + 1)}>Next</button>
                        </div>
                      </div>
                      {snomedDrugResults.map((drug, idx) => (
                        <button
                          key={`snomed-${idx}-${drug.conceptId}`}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b border-slate-100 last:border-0"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            // Convert SNOMED drug to medication format
                            const medData = {
                              name: drug.genericName || drug.drugName,
                              brand: drug.brandName || drug.drugName,
                              composition: drug.genericName || '',
                              strength: drug.strength || '',
                              dosageForm: drug.dosageForm || '',
                              snomedId: drug.conceptId,
                              available: true
                            };
                            addMed(medData);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-800">{drug.drugName || drug.brandName}</span>
                            {drug.dosageForm && (
                              <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{drug.dosageForm}</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {drug.genericName && <span>{drug.genericName}</span>}
                            {drug.strength && <span> • {drug.strength}</span>}
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  {frequentlyPrescribedMeds.length === 0 && filteredMeds.length === 0 && snomedDrugResults.length === 0 && medInput.length === 0 && (
                    <div className="px-3 py-3 text-sm text-slate-500 text-center">
                      Start typing to search medicines...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drug Interaction Warnings */}
            {showInteractionWarnings && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-red-900">⚠️ Drug Interactions</h4>
                  <button
                    type="button"
                    onClick={() => setShowInteractionWarnings(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                {drugInteractions.length > 0 && (
                  <div className="space-y-1">
                    {drugInteractions.map((interaction, idx) => (
                      <div key={`interaction-${idx}`} className="text-xs">
                        <span className="font-medium">{interaction.medicine1}</span> +
                        <span className="font-medium"> {interaction.medicine2}</span>:
                        <span className={`ml-1 px-1 py-0.5 rounded text-white ${
                          interaction.severity === 'high' ? 'bg-red-500' :
                          interaction.severity === 'moderate' ? 'bg-orange-500' : 'bg-yellow-500'
                        }`}>
                          {interaction.severity}
                        </span>
                        <div className="text-gray-600 mt-1">{interaction.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Auto-save Status */}
            {autoSaveStatus && (
              <div className="mt-2 text-xs text-green-600 text-center">
                {autoSaveStatus}
              </div>
            )}

            {/* Display Added Items (Medications) */}
            <div className="space-y-6">
              {/* Medications List */}
              {meds.filter(m => !m.type || m.type === 'medication').length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="bg-slate-50 px-4 py-3 rounded-t-xl border-b border-slate-200">
                    <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">💊</span>
                      Medications
                      <span className="text-xs font-normal bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-100">
                        {meds.filter(m => !m.type || m.type === 'medication').length} items
                      </span>
                      <span className="ml-auto flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowMedicationsTemplateSelector(true)}
                          className="text-xs px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition font-medium flex items-center gap-1.5"
                        >
                          📋 Load Template
                        </button>
                        {meds.filter(m => !m.type || m.type === 'medication').length > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              const tName = prompt('Template name:');
                              if (!tName) return;
                              const medsToSave = meds.filter(m => !m.type || m.type === 'medication').map(m => ({
                                name: m.name || m.brand || '',
                                brand: m.brand || m.name || '',
                                composition: m.composition || m.generic_name || '',
                                dosage: m.dosage || '',
                                dosage_form: m.dosage_form || '',
                                strength: m.strength || '',
                                frequency: m.is_tapering ? 'Tapering' : (m.frequency || ''),
                                duration: m.duration || '',
                                timing: m.timing || '',
                                instructions: m.instructions || '',
                                qty: m.qty || 0,
                                is_tapering: m.is_tapering ? true : false,
                                tapering_schedule: m.is_tapering && Array.isArray(m.tapering_schedule)
                                  ? m.tapering_schedule.map(s => ({
                                      step_number: s.step_number,
                                      dose: s.dose,
                                      frequency: s.frequency,
                                      duration_days: parseInt(s.duration_days) || 5
                                    }))
                                  : []
                              }));
                              try {
                                await api.post('/api/medications-templates', { name: tName, medications: JSON.stringify(medsToSave) });
                                addToast('Template saved!', 'success');
                                const res = await api.get('/api/medications-templates');
                                setMedicationsTemplates(res.data.templates || []);
                              } catch (e) {
                                const msg = e?.response?.data?.error || e?.response?.data?.details || e?.message || 'Unknown error';
                                addToast(`Failed to save template: ${msg}`, 'error');
                                console.error('medications-template save error:', e?.response?.status, e?.response?.data, e);
                              }
                            }}
                            className="text-xs px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition font-medium flex items-center gap-1.5"
                          >
                            💾 Save as Template
                          </button>
                        )}
                      </span>
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="grid w-full gap-x-2 bg-slate-50 text-xs font-bold text-slate-700 px-4 py-3 border-b border-slate-200 sticky top-0 z-10" style={{gridTemplateColumns:'36px 2.1fr 0.65fr 0.85fr 1.4fr 0.7fr 1.9fr 36px'}}>
                      <span>#</span>
                      <span>MEDICINE</span>
                      <span>DOSE</span>
                      <span>FREQ</span>
                      <span>TIMING</span>
                      <span>DAYS</span>
                      <span>INSTRUCTIONS</span>
                      <span className="text-center">ACT</span>
                    </div>
                    {meds.filter(m => !m.type || m.type === 'medication').map((med, idx) => {
                      const actualIdx = meds.findIndex(m => m === med);
                      return (
                        <React.Fragment key={idx}>
                        <div className="grid w-full gap-x-2 px-4 py-3 border-b border-slate-100 text-sm hover:bg-blue-50/60 transition-colors items-center" style={{gridTemplateColumns:'36px 2.1fr 0.65fr 0.85fr 1.4fr 0.7fr 1.9fr 36px'}}>
                          <div className="flex items-center gap-0.5 justify-center">
                            <span className="text-xs text-slate-600 font-bold">{idx + 1}</span>
                            <div className="flex flex-col gap-0.5 ml-1">
                              <button type="button" onClick={() => { if (actualIdx > 0) { const u = [...meds]; [u[actualIdx-1], u[actualIdx]] = [u[actualIdx], u[actualIdx-1]]; setMeds(u); }}} className="text-slate-400 hover:text-blue-600 leading-none text-xs p-0" title="Move up">▲</button>
                              <button type="button" onClick={() => { if (actualIdx < meds.length-1) { const u = [...meds]; [u[actualIdx], u[actualIdx+1]] = [u[actualIdx+1], u[actualIdx]]; setMeds(u); }}} className="text-slate-400 hover:text-blue-600 leading-none text-xs p-0" title="Move down">▼</button>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs uppercase leading-tight">
                                {med.name || med.brand}
                                {med.dosage_form && !(med.name || med.brand || '').toLowerCase().includes(med.dosage_form.toLowerCase()) &&
                                  <span className="font-normal text-slate-500 lowercase"> ({med.dosage_form})</span>
                                }
                              </span>
                            </div>
                              {med.composition && (
                                <div className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-1">{med.composition}</div>
                              )}
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...meds];
                                  updated[actualIdx].is_tapering = !updated[actualIdx].is_tapering;
                                  if (updated[actualIdx].is_tapering && (!updated[actualIdx].tapering_schedule || updated[actualIdx].tapering_schedule.length === 0)) {
                                    updated[actualIdx].tapering_schedule = [
                                      { step_number: 1, dose: '10 mg', frequency: 'Once daily', duration_days: 5 },
                                      { step_number: 2, dose: '5 mg', frequency: 'Once daily', duration_days: 5 },
                                      { step_number: 3, dose: '2.5 mg', frequency: 'Once daily', duration_days: 5 }
                                    ];
                                  }
                                  setMeds(updated);
                                }}
                                className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all ${
                                  med.is_tapering
                                    ? 'bg-purple-500 text-white border-purple-500'
                                    : 'bg-white text-purple-600 border-purple-300 hover:border-purple-400 hover:bg-purple-50'
                                }`}
                                title="Toggle tapering dose schedule"
                              >
                                {med.is_tapering ? 'Taper ✓' : 'Taper'}
                              </button>
                            </div>
                          </div>
                          {/* DOSE column */}
                          <input
                            className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs w-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            value={med.dosage || ''}
                            onChange={(e) => {
                              const updated = [...meds];
                              updated[actualIdx].dosage = e.target.value;
                              if (updated[actualIdx].auto_instructions) {
                                updated[actualIdx].instructions = getAutoInstruction(updated[actualIdx].frequency, language);
                              }
                              setMeds(updated);
                            }}
                            placeholder="1 tab"
                          />
                          <div className="relative">
                            <input
                              data-testid={`med-frequency-${actualIdx}`}
                              className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs w-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                              value={med.frequency || ''}
                              onChange={(e) => {
                                const updated = [...meds];
                                updated[actualIdx].frequency = e.target.value;
                                updated[actualIdx].qty = calcQty(e.target.value, updated[actualIdx].duration) || updated[actualIdx].qty;
                                const autoDose = slotDoseQty(e.target.value);
                                if (autoDose) updated[actualIdx].dosage = autoDose;
                                // always regenerate instructions when frequency changes
                                updated[actualIdx].instructions = generateAutoInstructions(
                                  e.target.value,
                                  updated[actualIdx].timing,
                                  language,
                                  translateTiming,
                                  updated[actualIdx].duration,
                                  updated[actualIdx].dosage,
                                  updated[actualIdx].dosage_form
                                );
                                updated[actualIdx].auto_instructions = true;
                                setMeds(updated);
                                // refresh dropdown filter
                                const dd = e.target.nextSibling;
                                if (dd) {
                                  const q = e.target.value.toLowerCase();
                                  dd.querySelectorAll('button[data-freq]').forEach(btn => {
                                    btn.style.display = !q || btn.dataset.freq.toLowerCase().startsWith(q) ? '' : 'none';
                                  });
                                }
                              }}
                              onFocus={(e) => {
                                const dd = e.target.nextSibling;
                                const r = e.target.getBoundingClientRect();
                                dd.style.top = (r.bottom + 4) + 'px';
                                dd.style.left = r.left + 'px';
                                dd.style.width = Math.max(r.width, 176) + 'px';
                                dd.style.display = 'block';
                                // show all on focus
                                const q = e.target.value.toLowerCase();
                                dd.querySelectorAll('button[data-freq]').forEach(btn => {
                                  btn.style.display = !q || btn.dataset.freq.toLowerCase().startsWith(q) ? '' : 'none';
                                });
                              }}
                              onBlur={() => setTimeout(() => { try { document.querySelectorAll('.freq-dd').forEach(el => el.style.display = 'none'); } catch(e){ /* ignore */ } }, 200)}
                              placeholder="1-0-1"
                            />
                            <div className="freq-dd bg-white border border-slate-300 rounded-lg shadow-xl max-h-48 overflow-y-auto" style={{display:'none', position:'fixed', zIndex:9999}}>
                              {getFrequencyPresets(med.dosage).map(f => (
                                <button key={f} type="button" data-freq={f}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const updated = [...meds];
                                    updated[actualIdx].frequency = f;
                                    updated[actualIdx].qty = calcQty(f, updated[actualIdx].duration) || updated[actualIdx].qty;
                                    const autoDose = slotDoseQty(f);
                                    if (autoDose) updated[actualIdx].dosage = autoDose;
                                    // always regenerate instructions on dropdown selection
                                    updated[actualIdx].instructions = generateAutoInstructions(
                                      f,
                                      updated[actualIdx].timing,
                                      language,
                                      translateTiming,
                                      updated[actualIdx].duration,
                                      updated[actualIdx].dosage,
                                      updated[actualIdx].dosage_form
                                    );
                                    updated[actualIdx].auto_instructions = true;
                                    setMeds(updated);
                                    // close dropdown immediately
                                    e.target.closest('.freq-dd').style.display = 'none';
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 hover:text-blue-700 border-b border-slate-100 transition"
                                >{f}</button>
                              ))}
                            </div>
                          </div>
                          <div className="relative">
                            <select
                              className="px-2 py-1.5 border border-slate-300 rounded-lg text-[11px] w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                              title={med.timing && typeof med.timing === 'object' ? med.timing.type : (med.timing || '')}
                              value={
                                med.timing && typeof med.timing === 'object'
                                  ? med.timing.type
                                  : (med.timing || '')
                              }
                              onChange={(e) => {
                                const updated = [...meds];
                                const type = e.target.value;
                                updated[actualIdx].timing = { type, time: type === 'FIXED_TIME' ? (med.timing?.time || '09:00') : null };
                                
                                if (updated[actualIdx].auto_instructions) {
                                  updated[actualIdx].instructions = generateAutoInstructions(
                                    updated[actualIdx].frequency,
                                    updated[actualIdx].timing,
                                    language,
                                    translateTiming,
                                    updated[actualIdx].duration,
                                    updated[actualIdx].dosage,
                                    updated[actualIdx].dosage_form
                                  );
                                }
                                setMeds(updated);
                              }}
                            >
                              {(timingOptions[language] || timingOptions.en).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                              <option value="FIXED_TIME">Fixed Time</option>
                            </select>
                            {med.timing && 
                             (typeof med.timing === 'object' ? med.timing.type : med.timing) === 'FIXED_TIME' && (
                              <input
                                type="time"
                                value={med.timing?.time || '09:00'}
                                onChange={(e) => {
                                  const updated = [...meds];
                                  updated[actualIdx].timing = { ...updated[actualIdx].timing, time: e.target.value };
                                  setMeds(updated);
                                }}
                                className="mt-1 w-full text-[10px] border rounded focus:ring-1 focus:ring-blue-300"
                              />
                            )}
                          </div>
                          <div className="relative">
                            <input
                              data-testid={`med-duration-${actualIdx}`}
                              className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs w-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                              value={(() => {
                                const dn = parseDurationDays(med.duration);
                                if (dn > 0) return String(dn);
                                return (med.duration || '').replace(/[^\d]/g, '');
                              })()}
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
                                const updated = [...meds];
                                updated[actualIdx].duration = v;
                                updated[actualIdx].qty = calcQty(updated[actualIdx].frequency, v) || updated[actualIdx].qty;
                                if (updated[actualIdx].auto_instructions) {
                                  updated[actualIdx].instructions = generateAutoInstructions(
                                    updated[actualIdx].frequency,
                                    updated[actualIdx].timing,
                                    language,
                                    translateTiming,
                                    v,
                                    updated[actualIdx].dosage,
                                    updated[actualIdx].dosage_form
                                  );
                                }
                                setMeds(updated);
                                const dd = e.target.nextSibling;
                                if (dd && dd.classList && dd.classList.contains('duration-dd')) {
                                  dd.querySelectorAll('button[data-day]').forEach(btn => {
                                    const n = btn.getAttribute('data-day') || '';
                                    btn.style.display = !v || n.startsWith(v) ? '' : 'none';
                                  });
                                  dd.style.display = 'block';
                                }
                              }}
                              onFocus={(e) => {
                                const dd = e.target.nextSibling;
                                if (!dd || !dd.classList || !dd.classList.contains('duration-dd')) return;
                                const r = e.target.getBoundingClientRect();
                                dd.style.top = `${r.bottom + 4}px`;
                                dd.style.left = `${r.left}px`;
                                dd.style.width = `${Math.max(r.width, 128)}px`;
                                dd.style.display = 'block';
                                const v = e.target.value.replace(/[^\d]/g, '');
                                dd.querySelectorAll('button[data-day]').forEach(btn => {
                                  const n = btn.getAttribute('data-day') || '';
                                  btn.style.display = !v || n.startsWith(v) ? '' : 'none';
                                });
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  try {
                                    document.querySelectorAll('.duration-dd').forEach(el => {
                                      el.style.display = 'none';
                                    });
                                  } catch (err) { /* ignore */ }
                                  setMeds(prev => {
                                    const u = [...prev];
                                    const raw = u[actualIdx].duration;
                                    const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
                                    if (Number.isNaN(n) || n < 1) return prev;
                                    const clamped = Math.min(365, Math.max(1, n));
                                    const label = `${clamped} day${clamped === 1 ? '' : 's'}`;
                                    if (u[actualIdx].duration === label) return prev;
                                    u[actualIdx] = { ...u[actualIdx], duration: label };
                                    u[actualIdx].qty = calcQty(u[actualIdx].frequency, label) || u[actualIdx].qty;
                                    if (u[actualIdx].auto_instructions) {
                                      u[actualIdx].instructions = generateAutoInstructions(
                                        u[actualIdx].frequency,
                                        u[actualIdx].timing,
                                        language,
                                        translateTiming,
                                        label,
                                        u[actualIdx].dosage,
                                        u[actualIdx].dosage_form
                                      );
                                    }
                                    return u;
                                  });
                                }, 200);
                              }}
                              placeholder="7"
                              inputMode="numeric"
                              autoComplete="off"
                            />
                            <div
                              className="duration-dd bg-white border border-slate-300 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                              style={{ display: 'none', position: 'fixed', zIndex: 9999 }}
                            >
                              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  data-day={String(n)}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const label = `${n} day${n === 1 ? '' : 's'}`;
                                    const updated = [...meds];
                                    updated[actualIdx].duration = label;
                                    updated[actualIdx].qty = calcQty(updated[actualIdx].frequency, label) || updated[actualIdx].qty;
                                    if (updated[actualIdx].auto_instructions) {
                                      updated[actualIdx].instructions = generateAutoInstructions(
                                        updated[actualIdx].frequency,
                                        updated[actualIdx].timing,
                                        language,
                                        translateTiming,
                                        label,
                                        updated[actualIdx].dosage,
                                        updated[actualIdx].dosage_form
                                      );
                                    }
                                    setMeds(updated);
                                    const panel = e.target.closest('.duration-dd');
                                    if (panel) panel.style.display = 'none';
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 hover:text-blue-700 border-b border-slate-100 transition"
                                >
                                  {n} {n === 1 ? 'day' : 'days'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="relative min-w-0">
                            <input
                              data-testid={`med-instructions-${actualIdx}`}
                              className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs w-full focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent min-w-0"
                              value={med.instructions || ''}
                              title={med.instructions || ''}
                              onChange={(e) => {
                                const updated = [...meds];
                                updated[actualIdx].instructions = e.target.value;
                                if (!e.target.value) {
                                  updated[actualIdx].auto_instructions = true;
                                  updated[actualIdx].instructions = getAutoInstruction(
                                    updated[actualIdx].frequency,
                                    language
                                  );
                                } else {
                                  updated[actualIdx].auto_instructions = false;
                                }
                                setMeds(updated);
                              }}
                              onFocus={(e) => {
                                const dd = e.target.nextSibling;
                                const r = e.target.getBoundingClientRect();
                                dd.style.top = (r.bottom + 4) + 'px';
                                dd.style.left = r.left + 'px';
                                dd.style.width = Math.max(r.width, 208) + 'px';
                                dd.style.display = 'block';
                              }}
                              onBlur={() => setTimeout(() => { try { document.querySelectorAll('.instr-dd').forEach(el => el.style.display = 'none'); } catch(e){ /* ignore */ } }, 200)}
                              placeholder="Instructions"
                            />
                            <div className="instr-dd bg-white border border-slate-300 rounded-lg shadow-xl max-h-40 overflow-y-auto" style={{display:'none', position:'fixed', zIndex:9999}}>
                              {(() => {
                                const df = (med.dosage_form || '').toLowerCase();
                                const isCream = /cream|ointment|gel|lotion|paste|topical/.test(df);
                                const isInjection = /injection|inj|im|iv|sc|subcutaneous|intramuscular|intravenous/.test(df);
                                const isPowder = /powder|sachet|granule/.test(df);
                                const isSyrup = /syrup|suspension|liquid|solution|drops/.test(df);
                                const isInhaler = /inhaler|inhale|nebulizer|spray/.test(df);
                                if (isCream) return [
                                  {en: 'Apply on affected area', hi: 'प्रभावित क्षेत्र पर लगाएं', mr: 'प्रभावित भागावर लावा'},
                                  {en: 'Apply thin layer', hi: 'पतली परत लगाएं', mr: 'पातळ थर लावा'},
                                  {en: 'Apply after cleaning the area', hi: 'क्षेत्र साफ करने के बाद लगाएं', mr: 'जागा स्वच्छ केल्यानंतर लावा'},
                                  {en: 'Wash hands after application', hi: 'लगाने के बाद हाथ धोएं', mr: 'लावल्यानंतर हात धुवा'},
                                  {en: 'Avoid contact with eyes', hi: 'आंखों से संपर्क से बचें', mr: 'डोळ्यांशी संपर्क टाळा'},
                                  {en: 'For external use only', hi: 'केवल बाहरी उपयोग के लिए', mr: 'फक्त बाह्य वापरासाठी'},
                                  {en: 'Do not cover with tight bandage', hi: 'तंग पट्टी से न ढकें', mr: 'घट्ट पट्टीने झाकू नका'},
                                  {en: 'As prescribed by doctor', hi: 'डॉक्टर के निर्देशानुसार', mr: 'डॉक्टरांच्या सल्ल्यानुसार'},
                                ];
                                if (isInjection) return [
                                  {en: 'IM - Intramuscular injection', hi: 'IM - इंट्रामस्क्युलर इंजेक्शन', mr: 'IM - इंट्रामस्क्युलर इंजेक्शन'},
                                  {en: 'IV - Intravenous injection', hi: 'IV - इंट्रावेनस इंजेक्शन', mr: 'IV - इंट्राव्हेनस इंजेक्शन'},
                                  {en: 'SC - Subcutaneous injection', hi: 'SC - सबक्यूटेनियस इंजेक्शन', mr: 'SC - सबक्यूटेनियस इंजेक्शन'},
                                  {en: 'Give slowly IV', hi: 'धीरे-धीरे IV दें', mr: 'हळूहळू IV द्या'},
                                  {en: 'Administer under doctor supervision', hi: 'डॉक्टर की निगरानी में दें', mr: 'डॉक्टरांच्या देखरेखीखाली द्या'},
                                  {en: 'Single dose', hi: 'एकल खुराक', mr: 'एकल मात्रा'},
                                  {en: 'Do not self-administer', hi: 'खुद से न दें', mr: 'स्वतः देऊ नका'},
                                ];
                                if (isPowder) return [
                                  {en: 'Mix with water before use', hi: 'उपयोग से पहले पानी में मिलाएं', mr: 'वापरण्यापूर्वी पाण्यात मिसळा'},
                                  {en: 'Take with water or juice', hi: 'पानी या जूस के साथ लें', mr: 'पाणी किंवा ज्यूसबरोबर घ्या'},
                                  {en: 'Mix in 1 glass of water', hi: '1 गिलास पानी में मिलाएं', mr: '1 ग्लास पाण्यात मिसळा'},
                                  {en: 'Apply on affected area', hi: 'प्रभावित क्षेत्र पर लगाएं', mr: 'प्रभावित भागावर लावा'},
                                  {en: 'Take after meals', hi: 'खाने के बाद लें', mr: 'जेवणानंतर घ्या'},
                                  {en: 'Keep dry, avoid moisture', hi: 'सूखा रखें, नमी से बचाएं', mr: 'कोरडे ठेवा, ओलाव्यापासून बचवा'},
                                  {en: 'As prescribed by doctor', hi: 'डॉक्टर के निर्देशानुसार', mr: 'डॉक्टरांच्या सल्ल्यानुसार'},
                                ];
                                if (isSyrup) return [
                                  {en: 'Shake well before use', hi: 'उपयोग से पहले अच्छी तरह हिलाएं', mr: 'वापरण्यापूर्वी चांगले हलवा'},
                                  {en: 'Take with water', hi: 'पानी के साथ लें', mr: 'पाण्याबरोबर घ्या'},
                                  {en: 'Take after meals', hi: 'खाने के बाद लें', mr: 'जेवणानंतर घ्या'},
                                  {en: 'Take before meals', hi: 'खाने से पहले लें', mr: 'जेवणापूर्वी घ्या'},
                                  {en: 'Use measuring spoon/cup', hi: 'नापने वाले चम्मच/कप का उपयोग करें', mr: 'मापाचा चमचा/कप वापरा'},
                                  {en: 'Refrigerate after opening', hi: 'खोलने के बाद फ्रिज में रखें', mr: 'उघडल्यानंतर फ्रिजमध्ये ठेवा'},
                                  {en: 'Complete the full course', hi: 'पूरा कोर्स पूरा करें', mr: 'संपूर्ण कोर्स पूर्ण करा'},
                                ];
                                if (isInhaler) return [
                                  {en: 'Inhale as directed', hi: 'निर्देशानुसार श्वास लें', mr: 'निर्देशाप्रमाणे श्वास घ्या'},
                                  {en: 'Shake well before use', hi: 'उपयोग से पहले अच्छी तरह हिलाएं', mr: 'वापरण्यापूर्वी चांगले हलवा'},
                                  {en: 'Rinse mouth after use', hi: 'उपयोग के बाद मुंह धोएं', mr: 'वापरल्यानंतर तोंड धुवा'},
                                  {en: 'Use spacer if needed', hi: 'जरूरत पड़ने पर स्पेसर का उपयोग करें', mr: 'गरज असल्यास स्पेसर वापरा'},
                                  {en: 'Breathe out fully before inhaling', hi: 'श्वास लेने से पहले पूरी तरह सांस छोड़ें', mr: 'श्वास घेण्यापूर्वी पूर्णपणे श्वास सोडा'},
                                  {en: 'Hold breath for 10 seconds after inhaling', hi: 'श्वास लेने के बाद 10 सेकंड सांस रोकें', mr: 'श्वास घेतल्यानंतर 10 सेकंद श्वास रोखा'},
                                ];
                                // Default (tablet/capsule/oral)
                                return [
                                  {en: 'Take with water', hi: 'पानी के साथ लें', mr: 'पाण्याबरोबर घ्या'},
                                  {en: 'Take after meals', hi: 'खाने के बाद लें', mr: 'जेवणानंतर घ्या'},
                                  {en: 'Take before meals', hi: 'खाने से पहले लें', mr: 'जेवणापूर्वी घ्या'},
                                  {en: 'Take on empty stomach', hi: 'खाली पेट पर लें', mr: 'रिकाम्या पोटी घ्या'},
                                  {en: 'Take at bedtime', hi: 'सोते समय लें', mr: 'झोपण्यापूर्वी घ्या'},
                                  {en: 'Take as prescribed by doctor', hi: 'डॉक्टर के निर्देशानुसार लें', mr: 'डॉक्टरांच्या सल्ल्यानुसार घ्या'},
                                  {en: 'After food to avoid gastric irritation', hi: 'गैस्ट्रिक जलन से बचने के लिए खाने के बाद', mr: 'जठरामाशयीय जलनापासून बचण्यासाठी खाण्यानंतर'},
                                  {en: 'Do not crush or chew', hi: 'कुचलें या चबाएं नहीं', mr: 'कुस्करू किंवा चावू नका'},
                                  {en: 'Complete the full course', hi: 'पूरा कोर्स पूरा करें', mr: 'संपूर्ण कोर्स पूर्ण करा'},
                                  {en: 'SOS - take only when needed', hi: 'SOS - जरूरत पड़ने पर ही लें', mr: 'SOS - गरज असेल तेव्हाच घ्या'},
                                  {en: 'Avoid alcohol', hi: 'शराब से बचें', mr: 'मद्यपान टाळा'},
                                ];
                              })().map((opt, oi) => (
                                <button key={oi} type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const updated = [...meds];
                                    updated[actualIdx].instructions = opt[language] || opt.en;
                                    updated[actualIdx].auto_instructions = false;
                                    setMeds(updated);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 hover:text-blue-700 border-b border-slate-100 transition"
                                >{opt[language] || opt.en}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => removeMed(actualIdx)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition font-bold text-lg"
                              title="Remove medicine"
                            >
                              ✕
                            </button>
                          </div>

                        </div>
                        {/* Tapering Schedule - Step-wise */}
                        {!!med.is_tapering && med.tapering_schedule && (
                          <div className="min-w-[900px] px-4 py-3 bg-purple-50 border-b border-purple-200">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs font-bold text-purple-700">📊 Tapering Schedule</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...meds];
                                  const nextStep = updated[actualIdx].tapering_schedule.length + 1;
                                  updated[actualIdx].tapering_schedule.push({ step_number: nextStep, dose: '', frequency: 'Once daily', duration_days: 5 });
                                  setMeds(updated);
                                }}
                                className="text-xs px-2.5 py-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold"
                              >
                                + Add Step
                              </button>
                            </div>
                            <div className="grid grid-cols-[50px_1fr_1.2fr_100px_30px] gap-2 text-xs font-bold text-purple-600 mb-2 px-2">
                              <span>Step</span>
                              <span>Dose</span>
                              <span>Frequency</span>
                              <span>Duration</span>
                              <span></span>
                            </div>
                            {med.tapering_schedule.map((step, si) => (
                              <div key={si} className="grid grid-cols-[50px_1fr_1.2fr_100px_30px] gap-2 items-center mb-2">
                                <span className="text-xs font-bold text-purple-700 text-center px-2 py-1.5 bg-purple-200 rounded">{si + 1}</span>
                                <input
                                  className="text-xs border border-purple-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                                  value={step.dose}
                                  onChange={(e) => {
                                    const updated = [...meds];
                                    updated[actualIdx].tapering_schedule[si].dose = e.target.value;
                                    setMeds(updated);
                                  }}
                                  placeholder="e.g. 10 mg"
                                />
                                <select
                                  className="text-xs border border-purple-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-white"
                                  value={step.frequency}
                                  onChange={(e) => {
                                    const updated = [...meds];
                                    updated[actualIdx].tapering_schedule[si].frequency = e.target.value;
                                    setMeds(updated);
                                  }}
                                >
                                  <option value="Once daily">Once daily</option>
                                  <option value="Twice daily">Twice daily</option>
                                  <option value="Thrice daily">Thrice daily</option>
                                  <option value="Every other day">Every other day</option>
                                  <option value="Once weekly">Once weekly</option>
                                  <option value="1-0-0">1-0-0</option>
                                  <option value="0-1-0">0-1-0</option>
                                  <option value="0-0-1">0-0-1</option>
                                  <option value="1-1-0">1-1-0</option>
                                  <option value="1-0-1">1-0-1</option>
                                  <option value="0-1-1">0-1-1</option>
                                  <option value="1-1-1">1-1-1</option>
                                </select>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    className="text-xs border border-purple-300 rounded-lg px-2 py-1.5 w-14 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                                    value={safeNumberInputValue(step.duration_days)}
                                    onChange={(e) => {
                                      const updated = [...meds];
                                      updated[actualIdx].tapering_schedule[si].duration_days = parseInt(e.target.value) || 1;
                                      setMeds(updated);
                                    }}
                                  />
                                  <span className="text-xs text-purple-600 font-semibold">d</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...meds];
                                    updated[actualIdx].tapering_schedule = updated[actualIdx].tapering_schedule.filter((_, i) => i !== si);
                                    updated[actualIdx].tapering_schedule.forEach((s, i) => s.step_number = i + 1);
                                    setMeds(updated);
                                  }}
                                  className="text-red-500 hover:text-red-700 text-xs font-bold hover:bg-red-50 p-1.5 rounded transition"
                                  title="Remove step"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {med.tapering_schedule.length > 0 && (
                              <div className="mt-2 text-xs text-purple-700 bg-purple-100 rounded-lg px-3 py-2 border border-purple-300">
                                <span className="font-bold">Preview: </span>
                                {med.tapering_schedule.map((s, i) => (
                                  <span key={i}>
                                    {i > 0 && <span className="font-bold"> → Then </span>}
                                    {s.dose} {s.frequency} for {s.duration_days} day{s.duration_days > 1 ? 's' : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Injections List */}
              {meds.filter(m => m.type === 'injection').length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                  <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-4 py-4 rounded-t-xl">
                    <h4 className="font-bold text-sm text-white flex items-center gap-3">
                      💉 Injections / IVF
                      <span className="text-xs font-normal bg-white/25 px-2.5 py-1 rounded-full backdrop-blur-sm">
                        {meds.filter(m => m.type === 'injection').length} items
                      </span>
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="grid w-full bg-slate-50 text-xs font-bold text-slate-700 px-4 py-3 border-b border-slate-200 sticky top-0 z-10" style={{gridTemplateColumns:'40px 1.8fr 0.8fr 1fr 1fr 1fr 1fr 50px'}}>
                      <span>#</span>
                      <span>INJECTION</span>
                      <span>DOSE</span>
                      <span>ROUTE</span>
                      <span>FREQ</span>
                      <span>DAYS</span>
                      <span>NOTES</span>
                      <span className="text-center">ACT</span>
                    </div>
                    {meds.filter(m => m.type === 'injection').map((inj, idx) => {
                      const actualIdx = meds.findIndex(m => m === inj);
                      return (
                        <div key={idx} className="grid w-full px-4 py-3 border-b border-slate-100 text-sm hover:bg-orange-50/60 transition-colors items-center" style={{gridTemplateColumns:'40px 1.8fr 0.8fr 1fr 1fr 1fr 1fr 50px'}}>
                          <span className="text-xs text-slate-600 font-bold">{idx + 1}</span>
                          <div className="text-xs">
                            <div className="font-semibold text-slate-900 line-clamp-2">{inj.brand || inj.name}</div>
                            {inj.composition && <div className="text-xs text-slate-400 line-clamp-1">{inj.composition}</div>}
                          </div>
                          <div className="text-slate-700 font-semibold text-xs">{inj.dosage || inj.dose || inj.strength || '—'}</div>
                          <div>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">{inj.route || inj.dosage_form || '—'}</span>
                          </div>
                          <div className="text-slate-700 text-xs">{inj.frequency || '—'}</div>
                          <div className="text-slate-700 text-xs">{inj.duration || '—'}</div>
                          <div className="text-slate-600 text-xs truncate" title={inj.instructions}>{translateInstruction(inj.instructions, language) || '—'}</div>
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => removeMed(actualIdx)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition font-bold text-lg"
                              title="Remove injection"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {meds.length === 0 && (
                <div className="p-6 text-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <div className="text-gray-400 text-lg mb-2">💊 💉</div>
                  <div className="text-gray-500 text-sm">
                    No medications or injections added yet
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    Search above or use smart suggestions to add items
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMedicationsTemplateSelector(true)}
                    className="mt-3 text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                  >
                    📋 Load from Template
                  </button>
                </div>
              )}
            </div>

            </div>
          );

        case 'Notes':
          return (
            <div key="notes" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold">📝</span>
                Notes
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient Notes</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    rows={3}
                    placeholder="Enter patient notes..."
                    value={patientNotes}
                    onChange={(e) => setPatientNotes(e.target.value)}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-amber-800 mb-1">
                    🔒 Private Notes
                    <span className="text-[10px] font-normal text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">Not shared with patient</span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-amber-200 bg-amber-50/40 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition"
                    rows={3}
                    placeholder="Enter private notes (for doctor reference only)..."
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          );

        case 'Follow Up & Advices':
          return (
            <div key="followup" className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">📅</span>
                Follow Up & Advices
              </h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Follow Up Days</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                      placeholder="7"
                      value={safeNumberInputValue(followUp.days)}
                      onChange={(e) => {
                        const days = parseInt(e.target.value) || 0;
                        const today = new Date();
                        const followUpDate = new Date(today);
                        followUpDate.setDate(today.getDate() + days);
                        setFollowUp({ 
                          ...followUp, 
                          days: e.target.value,
                          date: followUpDate.toISOString().split('T')[0]
                        });
                      }}
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Follow Up Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                      value={safeDateInputValue(followUp.date)}
                      onChange={(e) => setFollowUp({ ...followUp, date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Advice</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    rows={3}
                    placeholder="Enter advice for patient..."
                    value={advice}
                    onChange={(e) => setAdvice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quick Advice Selection</label>
                  {/* Searchable dropdown instead of a chip grid — several of these
                      advice entries are full sentences/paragraphs (not short
                      3-5 word phrases), so a wrapped button grid got cluttered
                      fast. Type to filter, click to insert — same pattern as
                      the diagnosis/medicine search elsewhere in this form. */}
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                      placeholder="Search advice..."
                      value={adviceSearchInput}
                      onChange={(e) => { setAdviceSearchInput(e.target.value); setAdviceDropdownOpen(true); }}
                      onFocus={() => setAdviceDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setAdviceDropdownOpen(false), 150)}
                    />
                    {adviceDropdownOpen && (() => {
                      const list = (predefinedAdvice[language] || predefinedAdvice.en).filter(
                        (adv) => !adviceSearchInput.trim() || adv.toLowerCase().includes(adviceSearchInput.trim().toLowerCase())
                      );
                      return (
                        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border rounded shadow-lg">
                          {list.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-400">No matches</div>
                          ) : list.map((adv) => (
                            <button
                              key={adv}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                if (advice && !advice.endsWith('\n')) {
                                  setAdvice(advice + '\n' + adv);
                                } else {
                                  setAdvice((advice || '') + adv);
                                }
                                setAdviceSearchInput('');
                                setAdviceDropdownOpen(false);
                              }}
                              title={adv}
                              className="block w-full text-left px-3 py-2 text-xs hover:bg-blue-50 truncate border-b last:border-b-0"
                            >
                              + {adv}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          );

        default:
          // Custom fields added by doctor via Pad Configuration
          return (
            <div key={fieldName} className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">✎</span>
                {toTitleCase(fieldName)}
              </h2>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                rows={2}
                placeholder={`Enter ${toTitleCase(fieldName)}...`}
                value={customFieldValues[fieldName] || ''}
                onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [fieldName]: e.target.value }))}
              />
            </div>
          );
      }
    });
  };

  const [symptomInput, setSymptomInput] = useState('');
  const [symptomDropdown, setSymptomDropdown] = useState(false);
  const [symptomFocusTick, setSymptomFocusTick] = useState(0);
  const [diagnosisInput, setDiagnosisInput] = useState('');
  const [diagnosisDropdown, setDiagnosisDropdown] = useState(false);
  const [diagnosisSearchResults, setDiagnosisSearchResults] = useState([]); // ICD diagnosis search results
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [snomedDiagnosisResults, setSnomedDiagnosisResults] = useState([]); // SNOMED CT diagnosis search results
  const [frequentlyUsedDiagnoses, setFrequentlyUsedDiagnoses] = useState([]); // "FREQUENTLY seen by you"
  const [symptoms, setSymptoms] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  // ICD integration state
  const [icdQuery, _setIcdQuery] = useState('');
  const [_icdResults, setIcdResults] = useState([]);
  const [_showIcdDropdown, _setShowIcdDropdown] = useState(false);
  const [selectedIcds, _setSelectedIcds] = useState([]); // [{ icd_code, icd_title }]
  const [icdVersion, _setIcdVersion] = useState('all'); // 'icd10', 'icd11', 'all'
  const [symptomsTemplates, setSymptomsTemplates] = useState([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [diagnosisTemplates, setDiagnosisTemplates] = useState([]);
  const [showDiagnosisTemplateSelector, setShowDiagnosisTemplateSelector] = useState(false);
  const [medInput, setMedInput] = useState('');
  const [medDropdown, setMedDropdown] = useState(false);
  const [showTaperInput, setShowTaperInput] = useState(false);
  const [taperMedInput, setTaperMedInput] = useState('');
  const [taperMedResults, setTaperMedResults] = useState([]);
  const [taperMedLoading, setTaperMedLoading] = useState(false);
  const [meds, setMeds] = useState([]);
  const [snomedDrugResults, setSnomedDrugResults] = useState([]); // SNOMED CT drug search results
  const [medicationSuggestions, setMedicationSuggestions] = useState([]); // Real medications from API
  const [frequentlyPrescribedMeds, setFrequentlyPrescribedMeds] = useState([]); // Patient's frequently prescribed
  const [_medicationLoading, _setMedicationLoading] = useState(false); // Loading state for med search
  const [medicationsTemplates, setMedicationsTemplates] = useState([]);
  const [showMedicationsTemplateSelector, setShowMedicationsTemplateSelector] = useState(false);
  const [_deliveryPincode, _setDeliveryPincode] = useState('');
  const [advice, setAdvice] = useState('');
  const [_enableTranslations, _setEnableTranslations] = useState(false);
  const [selectedAdvice, setSelectedAdvice] = useState([]);
  const [adviceSearchInput, setAdviceSearchInput] = useState('');
  const [adviceDropdownOpen, setAdviceDropdownOpen] = useState(false);
  const [printOnPrescription, _setPrintOnPrescription] = useState(true);
  const [followUp, setFollowUp] = useState({ days: '', date: '', autoFill: false });
  const [patientNotes, setPatientNotes] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  // Values for doctor-defined custom pad fields (e.g. "NEGATIVE HISTORY"),
  // keyed by field name. Previously these fields rendered an uncontrolled
  // textarea with no state at all, so anything typed into them was silently
  // discarded — never saved, never reloaded.
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [_adviceTemplates, _setAdviceTemplates] = useState([]);
  const [_adviceTemplatesLoading, _setAdviceTemplatesLoading] = useState(false);
  // Allergies and warnings
  const [patientAllergies, setPatientAllergies] = useState([]);
  const [_allergyConflicts, setAllergyConflicts] = useState([]);
  // SNOMED pagination & suggestions
  const [snomedDiagnosisPage, setSnomedDiagnosisPage] = useState(0);
  const [snomedDrugPage, setSnomedDrugPage] = useState(0);
  const [medResultsPage, setMedResultsPage] = useState(0);
  const [snomedSymptomResults, setSnomedSymptomResults] = useState([]);
  const [_suggestedDx, _setSuggestedDx] = useState([]);
  const [_suggestedMeds, _setSuggestedMeds] = useState([]);
  const [showMedicationSuggestionModal, setShowMedicationSuggestionModal] = useState(false);
  const [pendingMedicationSuggestions, setPendingMedicationSuggestions] = useState([]);
  
  // PHASE 1: Quick Wins state variables
  const [showTemplateQuickWins, setShowTemplateQuickWins] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [_recentMedicines, _setRecentMedicines] = useState([]);

  // Custom Template Creation states
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [showQuickTemplateDropdown, setShowQuickTemplateDropdown] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateShortName, setNewTemplateShortName] = useState('');
  const [_loadingTemplates, _setLoadingTemplates] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateFormData, setTemplateFormData] = useState({
    symptoms: '',
    diagnoses: '',
    medications: [{ name: '', brand: '', composition: '', dosage: '', dosage_form: '', frequency: '', timing: 'After Meal', duration: '', instructions: '', qty: '' }],
    investigations: '',
    precautions: '',
    diet_restrictions: '',
    activities: '',
    advice: '',
    follow_up_days: '',
    duration_days: '7'
  });

  // Autocomplete states for Create Template modal
  const [tplSymptomInput, setTplSymptomInput] = useState('');
  const [tplSymptomSuggestions, setTplSymptomSuggestions] = useState([]);
  const [tplDiagInput, setTplDiagInput] = useState('');
  const [tplDiagSuggestions, setTplDiagSuggestions] = useState([]);
  const [tplMedSuggestions, setTplMedSuggestions] = useState([]);
  const [tplActiveMedIdx, setTplActiveMedIdx] = useState(null);
  const tplSymptomDebounceRef = useRef(null);
  const tplDiagDebounceRef = useRef(null);
  const tplMedDebounceRef = useRef(null);

  const tplSearchSymptoms = (q) => {
    if (tplSymptomDebounceRef.current) clearTimeout(tplSymptomDebounceRef.current);
    setTplSymptomInput(q);
    if (!q.trim() || q.length < 2) { setTplSymptomSuggestions([]); return; }
    tplSymptomDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/symptoms/search?q=${encodeURIComponent(q)}&limit=20`);
        setTplSymptomSuggestions(res.data.symptoms || []);
      } catch { setTplSymptomSuggestions([]); }
    }, 300);
  };

  const tplSelectSymptom = (s) => {
    const val = s.symptom || s;
    const existing = templateFormData.symptoms;
    const appended = existing ? `${existing}, ${val}` : val;
    setTemplateFormData(prev => ({ ...prev, symptoms: appended }));
    setTplSymptomInput('');
    setTplSymptomSuggestions([]);
  };

  const tplSearchDiag = (q) => {
    if (tplDiagDebounceRef.current) clearTimeout(tplDiagDebounceRef.current);
    setTplDiagInput(q);
    if (!q.trim() || q.length < 2) { setTplDiagSuggestions([]); return; }
    tplDiagDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/api/diagnoses/search?q=${encodeURIComponent(q)}&limit=20&version=icd10`);
        const items = res.data?.data?.diagnoses || res.data?.diagnoses || [];
        setTplDiagSuggestions(items);
      } catch { setTplDiagSuggestions([]); }
    }, 300);
  };

  const tplSelectDiag = (s) => {
    const val = s.diagnosis_name || s.disease_name || s.name || '';
    const existing = templateFormData.diagnoses;
    const appended = existing ? `${existing}, ${val}` : val;
    setTemplateFormData(prev => ({ ...prev, diagnoses: appended }));
    setTplDiagInput('');
    setTplDiagSuggestions([]);
  };

  const tplSearchMed = (q, idx) => {
    if (tplMedDebounceRef.current) clearTimeout(tplMedDebounceRef.current);
    setTplActiveMedIdx(idx);
    const m = [...templateFormData.medications];
    m[idx] = { ...m[idx], name: q };
    setTemplateFormData(prev => ({ ...prev, medications: m }));
    if (!q.trim() || q.length < 2) { setTplMedSuggestions([]); return; }
    tplMedDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/api/medicines/search', { params: { q, limit: 20 } });
        const items = res.data?.data?.medicines || res.data?.medicines || res.data?.items || [];
        setTplMedSuggestions(Array.isArray(items) ? items : []);
      } catch { setTplMedSuggestions([]); }
    }, 300);
  };

  const tplSelectMed = (s) => {
    if (tplActiveMedIdx === null) return;
    // /api/medicines/search returns: name, brand, composition, dosage_form, strength, recommended_frequency, recommended_duration
    const name = s.name || s.brand || '';
    const comp = s.composition || s.generic_name || '';
    const dosageForm = s.dosage_form || '';
    const m = [...templateFormData.medications];
    m[tplActiveMedIdx] = {
      ...m[tplActiveMedIdx],
      name,
      composition: comp || m[tplActiveMedIdx].composition,
      dosage_form: dosageForm,
      frequency: s.recommended_frequency || m[tplActiveMedIdx].frequency,
      duration: s.recommended_duration || m[tplActiveMedIdx].duration,
    };
    setTemplateFormData(prev => ({ ...prev, medications: m }));
    setTplMedSuggestions([]);
    setTplActiveMedIdx(null);
  };

  // Fetch custom templates from database
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        _setLoadingTemplates(true);
        const response = await api.get('/api/prescription-templates');
        setCustomTemplates(response.data.templates || []);
      } catch (error) {
        console.error('Error fetching templates:', error);
        setCustomTemplates([]);
      } finally {
        _setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  // PHASE 2: Advanced Features state variables
  const [_showMedicationCombos, _setShowMedicationCombos] = useState(false);
  const [_medicationCombos, _setMedicationCombos] = useState({
    'URTI': [
      { name: 'Amoxicillin', brand: '', composition: '500mg', frequency: '1-1-1', timing: '1-1-1', duration: '5 days', instructions: 'After food', qty: '' },
      { name: 'Cetirizine', brand: '', composition: '10mg', frequency: '0-0-1', timing: '0-0-1', duration: '5 days', instructions: 'At night', qty: '' }
    ],
    'Migraine': [
      { name: 'Ibuprofen', brand: '', composition: '400mg', frequency: '1-0-1', timing: '1-0-1', duration: '7 days', instructions: 'After food', qty: '' },
      { name: 'Metoclopramide', brand: '', composition: '10mg', frequency: '1-1-1', timing: '1-1-1', duration: '7 days', instructions: 'Before meals', qty: '' }
    ],
    'Gastritis': [
      { name: 'Omeprazole', brand: '', composition: '20mg', frequency: '1-0-0', timing: '1-0-0', duration: '10 days', instructions: 'Before breakfast', qty: '' },
      { name: 'Domperidone', brand: '', composition: '10mg', frequency: '1-1-1', timing: '1-1-1', duration: '10 days', instructions: 'Before meals', qty: '' }
    ],
    'HTN': [
      { name: 'Amlodipine', brand: '', composition: '5mg', frequency: '1-0-0', timing: '1-0-0', duration: 'Continued', instructions: 'Once daily', qty: '' },
      { name: 'Lisinopril', brand: '', composition: '10mg', frequency: '1-0-0', timing: '1-0-0', duration: 'Continued', instructions: 'Once daily', qty: '' }
    ],
    'Diabetes': [
      { name: 'Metformin', brand: '', composition: '500mg', frequency: '1-1-1', timing: '1-1-1', duration: 'Continued', instructions: 'With meals', qty: '' },
      { name: 'Glipizide', brand: '', composition: '5mg', frequency: '1-0-1', timing: '1-0-1', duration: 'Continued', instructions: 'Before meals', qty: '' }
    ]
  });
  const [_showRecentSidebar, _setShowRecentSidebar] = useState(true);
  const [dosageCalculator, _setDosageCalculator] = useState({
    calculateDosage: (drugName, weight, age) => {
      const dosages = {
        'Paracetamol': { base: 15, frequency: '1-1-1', unit: 'mg/kg' },
        'Ibuprofen': { base: 10, frequency: '1-1-1', unit: 'mg/kg' },
        'Amoxicillin': { base: 25, frequency: '1-1-1', unit: 'mg/kg' },
        'Metformin': { base: 0, frequency: '0-0-0', unit: 'fixed', fixed: 500 },
        'Cephalexin': { base: 25, frequency: '1-1-1', unit: 'mg/kg' }
      };
      const dose = dosages[drugName];
      if (!dose) return { calculatedDose: 'Not found', frequency: '', warning: '' };
      if (dose.unit === 'fixed') {
        return { calculatedDose: `${dose.fixed}mg`, frequency: dose.frequency, warning: '' };
      }
      const calcDose = Math.round((weight * dose.base) / 10) * 10;
      let warning = '';
      if (age < 5 && calcDose > 250) warning = 'Consider pediatric dosing';
      if (age > 65 && calcDose > 500) warning = 'Monitor renal function';
      return { calculatedDose: `${calcDose}mg`, frequency: dose.frequency, warning };
    }
  });
  const [_voiceTranscript, _setVoiceTranscript] = useState('');
  const [_isListening, _setIsListening] = useState(false);
  const [_showComplianceTracker, _setShowComplianceTracker] = useState(false);
  const [_complianceStatus, _setComplianceStatus] = useState(null);
  const [_splitViewMode, _setSplitViewMode] = useState('full'); // 'split' or 'full'

  // NEW: Additional sections
  const [_examinationFindings, _setExaminationFindings] = useState('');
  const [generalExamination, setGeneralExamination] = useState('');
  const [systemicExamination, setSystemicExamination] = useState('');
  const [examFindings, setExamFindings] = useState([]); // [{ text, notes }]
  const [examFindingInput, setExamFindingInput] = useState('');
  const [examFindingDropdown, setExamFindingDropdown] = useState(false);
  const [frequentExamFindings, setFrequentExamFindings] = useState([]);
  const [showExaminationTemplateModal, setShowExaminationTemplateModal] = useState(false);
  const [labResults, _setLabResults] = useState([]);
  // Lab Records & Medical Records for prescription pad
  const [_prescriptionRecords, setPrescriptionRecords] = useState([]);
  const [showRecordUploadModal, setShowRecordUploadModal] = useState(false);
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [recordUploadForm, setRecordUploadForm] = useState({ name: '', category: 'OTHERS', description: '', file: null });
  const [manualRecordForm, setManualRecordForm] = useState({ name: '', category: 'OTHERS', description: '', date: getLocalDateString() });
  const [recordUploadLoading, setRecordUploadLoading] = useState(false);
  // Lab test templates from database
  const [labTemplates, setLabTemplates] = useState([]);
  const [labTemplateCategories, setLabTemplateCategories] = useState([]);
  const [showLabTemplateModal, setShowLabTemplateModal] = useState(false);
  const [selectedLabCategory, setSelectedLabCategory] = useState('');
  const [labResultEntries, setLabResultEntries] = useState([]); // {test_name, result_value, result_unit, reference_range, category, parameters: []}
  const [labParamFormTest, setLabParamFormTest] = useState(null); // currently selected test for parameter entry
  const [labParamFormData, setLabParamFormData] = useState([]); // parameter values being filled
  const [labParamLoading, setLabParamLoading] = useState(false);
  const [labSearchQuery, setLabSearchQuery] = useState('');
  const [labInlineSearch, setLabInlineSearch] = useState('');
  const [labAdvice, setLabAdvice] = useState('');
  const [labAdviceInput, setLabAdviceInput] = useState('');
  const [labAdviceDropdown, setLabAdviceDropdown] = useState(false);
  const [labAdviceRemarks, setLabAdviceRemarks] = useState({}); // { [tag]: remark }
  const [labAdviceRemarkEdit, setLabAdviceRemarkEdit] = useState(null); // index being edited
  const [labAdviceAutoOpenTag, setLabAdviceAutoOpenTag] = useState(null); // tag name to auto-open remark
  // Custom (manually entered) lab advice tests so they appear next time in dropdown
  const [customLabAdviceTests, setCustomLabAdviceTests] = useState([]); // [{ name, count }]
  // Custom lab tests from PatientOverview localStorage
  const [customLabTestsFromOverview, setCustomLabTestsFromOverview] = useState([]);
  const [showCustomTestModal, setShowCustomTestModal] = useState(false);
  const [selectedCustomTest, setSelectedCustomTest] = useState(null);
  const [customTestForm, setCustomTestForm] = useState({ test_name: '', remark: '', result_value: '', unit: '', reference_range: '', result_date: '' });
  // Lab advice groups (like Billing service groups)
  const [labAdviceGroups, setLabAdviceGroups] = useState([]);
  const [showLabAdviceGroupModal, setShowLabAdviceGroupModal] = useState(false);
  const [labAdviceGroupTab, setLabAdviceGroupTab] = useState('groups'); // 'groups' | 'tests'
  const [labAdviceGroupSearch, setLabAdviceGroupSearch] = useState('');
  const [showLabAdviceGroupForm, setShowLabAdviceGroupForm] = useState(false);
  const [editingLabAdviceGroup, setEditingLabAdviceGroup] = useState(null);
  const [labAdviceGroupName, setLabAdviceGroupName] = useState('');
  const [labAdviceGroupTests, setLabAdviceGroupTests] = useState([]); // string[]
  const [labRemarks, setLabRemarks] = useState('');

  const labAdviceCustomKey = `custom_lab_advice_tests_${meta?.doctor_id || user?.doctor_id || user?.id || 'global'}`;

  const rankMatch = (text, query) => {
    const t = (text || '').toString().toLowerCase().trim();
    const q = (query || '').toString().toLowerCase().trim();
    if (!q) return 50;
    if (t === q) return 0;
    if (t.startsWith(q)) return 1;
    if (t.includes(q)) return 2;
    return 99;
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(labAdviceCustomKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setCustomLabAdviceTests(Array.isArray(parsed) ? parsed : []);
    } catch (_e) {
      setCustomLabAdviceTests([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labAdviceCustomKey]);

  const rememberCustomLabTest = useCallback((name) => {
    const cleaned = (name || '').toString().trim();
    if (!cleaned) return;
    setCustomLabAdviceTests((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const idx = current.findIndex((x) => (x?.name || '').toLowerCase() === cleaned.toLowerCase());
      const next = (() => {
        if (idx >= 0) {
          const updated = [...current];
          updated[idx] = { ...updated[idx], count: (Number(updated[idx].count) || 0) + 1 };
          return updated;
        }
        return [{ name: cleaned, count: 1 }, ...current];
      })()
        .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
        .slice(0, 50);
      try { localStorage.setItem(labAdviceCustomKey, JSON.stringify(next)); } catch (_e) { /* ignore */ }
      return next;
    });
  }, [labAdviceCustomKey]);

  const addLabAdviceTag = useCallback((name, opts = {}) => {
    const cleaned = (name || '').toString().trim();
    if (!cleaned) return;
    const saveCustom = !!opts.saveCustom;
    setLabAdvice((prev) => {
      const current = (prev || '').split(',').map(t => t.trim()).filter(Boolean);
      const set = new Set(current.map(x => x.toLowerCase()));
      if (!set.has(cleaned.toLowerCase())) current.push(cleaned);
      return current.join(', ');
    });
    if (saveCustom) rememberCustomLabTest(cleaned);
    setLabAdviceInput('');
    setLabAdviceDropdown(false);
    setLabAdviceAutoOpenTag(cleaned);
  }, [rememberCustomLabTest]);

  // Auto-open remark popover when a tag is freshly added
  useEffect(() => {
    if (!labAdviceAutoOpenTag) return;
    const tags = labAdvice.split(',').map(t => t.trim()).filter(Boolean);
    const idx = tags.findIndex(t => t.toLowerCase() === labAdviceAutoOpenTag.toLowerCase());
    if (idx >= 0) {
      setLabAdviceRemarkEdit(idx);
      setLabAdviceAutoOpenTag(null);
    }
  }, [labAdvice, labAdviceAutoOpenTag]);

  // Refer Doctor state
  const [showReferModal, setShowReferModal] = useState(false);
  const [referredDoctor, setReferredDoctor] = useState(() => {
    try {
      if (patientId) {
        const saved = localStorage.getItem(`referredDoctor_${patientId}`);
        if (saved) return JSON.parse(saved);
      }
    } catch (_e) { /* ignore parse error */ }
    return null;
  }); // { name, specialty, phone, hospital, notes } for print
  const [referralNetwork, setReferralNetwork] = useState([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralForm, setReferralForm] = useState({ selectedDoctor: '', referred_doctor_name: '', referred_doctor_phone: '', referred_doctor_specialization: '', hospital_name: '', reason: '', priority: 'routine', notes: '' });

  // Persist referredDoctor in localStorage so it survives save/refresh until explicitly removed
  useEffect(() => {
    if (!patientId) return;
    if (referredDoctor) {
      localStorage.setItem(`referredDoctor_${patientId}`, JSON.stringify(referredDoctor));
    } else {
      localStorage.removeItem(`referredDoctor_${patientId}`);
    }
  }, [referredDoctor, patientId]);

  // Examination Findings custom templates
  const [customExamTemplates, setCustomExamTemplates] = useState([]);
  const [showSaveExamTemplate, setShowSaveExamTemplate] = useState(false);
  const [examTemplateName, setExamTemplateName] = useState('');
  const [_labTestInput, _setLabTestInput] = useState('');
  const [procedures, setProcedures] = useState([]);
  const [_printProcedures, _setPrintProcedures] = useState(true);
  const [_referralDoctor, _setReferralDoctor] = useState('');
  const [_prescriptionDate, _setPrescriptionDate] = useState(new Date().toISOString());

  // Past data states
  const [pastVisitsTab, setPastVisitsTab] = useState('past');
  const [pastVisits, setPastVisits] = useState([]);
  const [pastPrescriptions, setPastPrescriptions] = useState([]);
  const [pastVitals, setPastVitals] = useState([]);
  const [pastRecords, setPastRecords] = useState([]);
  const [loadingPastData, setLoadingPastData] = useState(false);

  // Patient search states
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [showPatientSearch, setShowPatientSearch] = useState(false);

  // Current prescription ID for PDF download and compliance tracker
  const [currentPrescriptionId, setCurrentPrescriptionId] = useState(null);
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);

  // Monetize Rx option
  const [_monetizeRx, _setMonetizeRx] = useState(false);

  // Lab results modal state
  const [showLabResultsModal, setShowLabResultsModal] = useState(false);
  const [previousLabResults, _setPreviousLabResults] = useState([]);

  // Letterhead toggle for print/download (default: false = no header/footer)
  const [printWithLetterhead, setPrintWithLetterhead] = useState(false);

  // Receipt template states
  const [receiptTemplates, setReceiptTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showDefaultLetterhead, setShowDefaultLetterhead] = useState(() => {
    return localStorage.getItem('hideDefaultLetterhead') !== 'true';
  });
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const templateDropdownRef = useRef(null);

  // For a saved prescription, print the actual server-rendered PDF (opened in
  // a new tab, printable from the browser's PDF viewer) instead of the
  // in-page React table — the browser's native print dialog doesn't reliably
  // reproduce that table's borders/colors, so it looked different from the
  // real PDF. Unsaved drafts have no PDF yet, so fall back to the old path.
  // Shared by both the Print button and the Ctrl+P shortcut so they can't
  // drift out of sync again.
  // handleSave is declared much further down; a ref keeps this callback out of
  // its temporal-dead-zone (a deps-array reference would throw at render time).
  const handleSaveRef = useRef(null);

  const handlePrintClick = useCallback(async () => {
    const openRxPdf = (id) => window.open(
      `/api/pdf/prescription/${id}?lang=${language}${selectedTemplateId ? `&template_id=${selectedTemplateId}` : ''}${printWithLetterhead ? '&with_letterhead=1' : ''}`,
      '_blank',
    );

    if (currentPrescriptionId) {
      openRxPdf(currentPrescriptionId);
      return;
    }

    // Not saved yet (a fresh pad, or one opened with ?copy=true) — the old code
    // silently fell back to react-to-print here, which prints the in-page React
    // markup and looks NOTHING like the server PDF that "View Rx" opens. Save
    // first so Print always yields that same PDF; only if the save genuinely
    // can't produce an id do we fall back to the browser print path.
    let savedId = null;
    try {
      const saved = await handleSaveRef.current?.();
      savedId = saved?.id || saved?.data?.id || null;
    } catch {
      return; // handleSave already surfaced the error toast — don't also print.
    }

    if (savedId) openRxPdf(savedId);
    else handlePrint();
  }, [currentPrescriptionId, language, selectedTemplateId, printWithLetterhead, handlePrint]);

  // Open a PAST visit's prescription — the same server-rendered PDF that
  // "View Rx" opens, so a past visit reads exactly like a printed one. Copy
  // pulls a past visit INTO the current pad; this just lets you read it.
  const openPastVisit = useCallback((visit) => {
    const rxId = visit?.id || visit?.prescription_id;
    if (!rxId) {
      addToast('Cannot open this visit — no prescription found for it', 'error');
      return;
    }
    window.open(
      `/api/pdf/prescription/${rxId}?lang=${language}${selectedTemplateId ? `&template_id=${selectedTemplateId}` : ''}${printWithLetterhead ? '&with_letterhead=1' : ''}`,
      '_blank',
    );
  }, [language, selectedTemplateId, printWithLetterhead, addToast]);

  // Specialty module states
  const [showSpecialtySelector, setShowSpecialtySelector] = useState(false);
  const [_specialtyData, setSpecialtyData] = useState(null);

  // Print format states
  const [printFormat, setPrintFormat] = useState('A4'); // 'A4' or 'A5'

  // Smart Prescription states
  const [smartSuggestions, setSmartSuggestions] = useState({
    medicines: [],
    diagnoses: [],
    investigations: [],
    frequentlyUsed: [],
    interactions: [],
    warnings: []
  });
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [drugInteractions, setDrugInteractions] = useState([]);
  const [showInteractionWarnings, setShowInteractionWarnings] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('');

  const safeNumberInputValue = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return '';
    return v;
  };

  const safeDateInputValue = (v) => {
    if (!v) return '';
    if (typeof v === 'object') return '';
    return String(v);
  };

  // Calculate filtered symptoms for dropdown — keep full objects for ICD-10 display
  const snomedObjects = (snomedSymptomResults || []).map(c => ({
    term: c?.pt?.term || c?.fsn?.term || '',
    source: c?.source || 'snomed',
    icd_code: c?.icd_code || null,
    snomed_id: c?.snomed_id || null,
  })).filter(o => o.term);
  const suggestionObjects = (symptomSuggestions || []).map(s => ({ term: s, source: 'suggestion', icd_code: null }));
  const seenSymTerms = new Set();
  const mergedSymptomsPool = [];
  for (const obj of [...snomedObjects, ...suggestionObjects]) {
    const key = obj.term.toLowerCase();
    if (!seenSymTerms.has(key)) { seenSymTerms.add(key); mergedSymptomsPool.push(obj); }
  }
  const filteredSymptoms = symptomInput.length > 0
    ? mergedSymptomsPool.filter(o => o.term.toLowerCase().includes(symptomInput.toLowerCase()))
    : mergedSymptomsPool.slice(0, 12);

  // Fetch smart suggestions based on diagnosis, symptoms, and patient history
  const fetchSmartSuggestions = useCallback(async () => {
    try {
      if (fetchSmartSuggestions.inFlight) return;
      fetchSmartSuggestions.inFlight = true;
      if (fetchSmartSuggestions.abortController) {
        try { fetchSmartSuggestions.abortController.abort(); } catch (e) { /* ignore */ }
      }
      const ac = new AbortController();
      fetchSmartSuggestions.abortController = ac;

      const params = new URLSearchParams();
      if (patientId) params.append('patientId', patientId);
      if (diagnoses.length > 0) params.append('diagnosis', diagnoses.map(d => d.icd_code || d).join(','));
      if (symptoms.length > 0) params.append('symptoms', symptoms.map(s => typeof s === 'object' ? s.name : s).join(','));
      if (patient?.age) params.append('age', patient.age);
      if (patient?.weight) params.append('weight', patient.weight);

      // console.log('🔍 Fetching smart suggestions with params:', params.toString());
      const res = await api.get(`/api/smart-prescription/suggestions?${params}`, { signal: ac.signal });
      // console.log('📊 Smart suggestions response:', res.data);
      
      if (res.data?.success) {
        // console.log('✅ Smart suggestions data:', res.data.data);
        setSmartSuggestions(res.data.data);
        setShowSmartSuggestions(true);
      } else {
        // console.log('❌ Smart suggestions failed:', res.data);
      }
    } catch (error) {
      if (error?.name === 'CanceledError' || error?.name === 'AbortError') return;
      console.error('Error fetching smart suggestions:', error);
    } finally {
      fetchSmartSuggestions.inFlight = false;
    }
  }, [api, patientId, diagnoses, symptoms, patient]);

  // Check for drug interactions
  const checkDrugInteractions = useCallback(async () => {
    try {
      const medicines = (Array.isArray(meds) ? meds : []).map(m => ({ name: m.name || m.brand, composition: m.composition }));
      const res = await api.post('/api/smart-prescription/check-interactions', { medicines });
      if (res.data?.success) {
        const interactions = res.data.data?.interactions || [];
        const warnings = res.data.data?.warnings || [];
        setDrugInteractions(interactions);
        setShowInteractionWarnings(interactions.length > 0 || warnings.length > 0);
      }
    } catch (error) {
      console.error('Error checking drug interactions:', error);
    }
  }, [api, meds]);

  // Calculate dosage for a medicine
  const _calculateDosage = useCallback(async (medicineName) => {
    try {
      const params = new URLSearchParams();
      params.append('medicineName', medicineName);
      if (patient?.age) params.append('age', patient.age);
      if (patient?.weight) params.append('weight', patient.weight);
      params.append('patientType', patient?.age && parseInt(patient.age) < 18 ? 'pediatric' : 'adult');

      const res = await api.get(`/api/smart-prescription/calculate-dosage?${params}`);
      if (res.data?.success) {
        return res.data.data.dosage;
      }
    } catch (error) {
      console.error('Error calculating dosage:', error);
    }
    return null;
  }, [api, patient]);

  // Auto-save functionality.
  // The draft key is scoped to the patient AND the calendar day. A draft is the
  // unsaved work of ONE day's visit — keying it by patient alone meant a patient
  // who came back the next day had yesterday's whole prescription (and, via the
  // bill editor, the receipt) auto-restored into the new visit.
  const clearDraft = useCallback(() => {
    try {
      if (!patientId) return;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`prescription_draft_${patientId}`)) localStorage.removeItem(k);
      }
    } catch (e) { /* ignore */ }
  }, [patientId]);

  const saveDraft = useCallback(async () => {
    try {
      if (!patientId) return;
      const draftData = {
        patientId,
        appointmentId: meta.appointment_id || null,
        symptoms,
        diagnoses,
        meds,
        advice,
        followUp,
        patientNotes,
        privateNotes,
        procedures,
        vitals,
        timestamp: new Date().toISOString()
      };

      // Save to localStorage for now (can be extended to backend)
      localStorage.setItem(`prescription_draft_${patientId}_${getLocalDateString()}`, JSON.stringify(draftData));
      setAutoSaveStatus('Draft saved');
      setTimeout(() => setAutoSaveStatus(''), 2000);
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [patientId, meta.appointment_id, symptoms, diagnoses, meds, advice, followUp, patientNotes, privateNotes, procedures, vitals]);

  // Load draft on component mount
  const loadDraft = useCallback(() => {
    try {
      if (!patientId) return;
      const todayKey = `prescription_draft_${patientId}_${getLocalDateString()}`;
      // Purge this patient's drafts from earlier days (and the legacy un-dated
      // key) so a returning patient never inherits an earlier visit's Rx.
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`prescription_draft_${patientId}`) && k !== todayKey) {
          localStorage.removeItem(k);
        }
      }
      const draft = localStorage.getItem(todayKey);
      if (draft) {
        const draftData = JSON.parse(draft);
        // Extra guard: the key is already day-scoped, but confirm the saved
        // timestamp really is today (clock/date changes, stale tab, etc.).
        const draftTime = new Date(draftData.timestamp);
        const sameDay = getLocalDateString(draftTime) === getLocalDateString();

        if (sameDay) {
          setSymptoms(draftData.symptoms || []);
          setDiagnoses(draftData.diagnoses || []);
          setMeds((draftData.meds || []).map(m => ({
            ...m,
            timing: translateTiming(m.timing, language) || m.timing,
            instructions: translateInstruction(m.instructions, language) || m.instructions
          })));
          setAdvice(draftData.advice || '');
          const draftFollowUp = draftData.followUp || { days: '', date: '', autoFill: false };
          // Sanitize days: reset if object or not a valid number string
          if (draftFollowUp.days && (typeof draftFollowUp.days === 'object' || isNaN(parseInt(draftFollowUp.days, 10)))) draftFollowUp.days = '';
          setFollowUp(draftFollowUp);
          setPatientNotes(draftData.patientNotes || '');
          setPrivateNotes(draftData.privateNotes || '');
          setProcedures(draftData.procedures || []);
          setVitals(draftData.vitals || {});
          addToast('Draft loaded from auto-save', 'info');
        }
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  }, [patientId, addToast]);

  // Template Management states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // Save current prescription as template
  const saveAsTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      addToast('Please enter a template name', 'error');
      return;
    }

    try {
      const name = templateName.trim();
      const templateData = {
        template_name: name,
        short_name: name.slice(0, 50),
        category: templateCategory,
        description: templateDescription,
        symptoms: JSON.stringify(symptoms),
        diagnosis: JSON.stringify(diagnoses),
        medications: JSON.stringify(meds.map(m => ({
          name: m.name,
          brand: m.brand,
          composition: m.composition || '',
          strength: m.strength || '',
          dosage_form: m.dosage_form || '',
          frequency: m.is_tapering ? 'Tapering' : (m.frequency || ''),
          timing: m.timing,
          duration: m.duration,
          instructions: m.instructions || '',
          qty: m.qty || '',
          is_tapering: m.is_tapering ? true : false,
          tapering_schedule: m.is_tapering && m.tapering_schedule
            ? m.tapering_schedule.map(s => ({
                step_number: s.step_number,
                dose: s.dose,
                frequency: s.frequency,
                duration_days: parseInt(s.duration_days) || 5
              }))
            : []
        }))),
        advice,
        precautions: advice,
        investigations: labAdvice || '',
        follow_up_days: (() => { const d = parseInt(followUp.days, 10); return isNaN(d) ? null : d; })(),
        duration_days: (() => { const d = parseInt(followUp.days, 10); return isNaN(d) ? 7 : d; })(),
        created_by: user?.id
      };

      await api.post('/api/prescription-templates', templateData);
      try {
        const tRes = await api.get('/api/prescription-templates');
        setCustomTemplates(tRes.data.templates || []);
      } catch (_) { /* ignore refresh failure */ }
      addToast('Template saved successfully', 'success');
      setShowTemplateModal(false);
      setTemplateName('');
      setTemplateCategory('');
      setTemplateDescription('');
    } catch (error) {
      console.error('Error saving template:', error, error.response?.data);
      const errMsg = error.response?.data?.error
        || error.response?.data?.details
        || error.message
        || 'Failed to save template';
      addToast(`Template save failed: ${errMsg}`, 'error');
    }
  }, [templateName, templateCategory, templateDescription, meds, symptoms, diagnoses, advice, labAdvice, followUp, user, api, addToast, setCustomTemplates]);

  // ========================================
  // Fetch Doctor ID
  // ========================================
  const fetchDoctorId = useCallback(async () => {
    try {
      // Method 1: If user is logged in and is a doctor
      if (user && user.id && user.role === 'doctor') {
        try {
          const res = await api.get(`/api/doctors/by-user/${user.id}`);
          if (res.data && res.data.id) {
            setMeta(prev => ({ ...prev, doctor_id: res.data.id }));
            return;
          }
        } catch (err) {
          // console.log('User is not a doctor, trying fallback...');
        }
      }

      // Method 2: Fallback - get first available doctor
      try {
        const res = await api.get('/api/doctors');
        if (res.data.doctors && res.data.doctors.length > 0) {
          setMeta(prev => ({ ...prev, doctor_id: res.data.doctors[0].id }));
        }
      } catch (err) {
        console.error('Failed to fetch doctors list:', err);
      }
    } catch (error) {
      console.error('Error fetching doctor ID:', error);
    }
  }, [api, user]);

  // ========================================
  // Fetch Patient
  // ========================================
  const fetchPatient = useCallback(async () => {
    try {
      if (!patientId) {
        addToast('No patient ID provided', 'error');
        return;
      }
      const normalizedPatientId = String(patientId).split(':')[0].split('/')[0].trim();
      if (!normalizedPatientId) {
        addToast('Invalid patient ID', 'error');
        return;
      }
      const res = await api.get(`/api/patients/${normalizedPatientId}`);
      const patientData = res.data?.data || res.data;
      setPatient(patientData);
      setMeta(prev => ({ ...prev, patient_id: patientData.id }));
    } catch (error) {
      console.error('Error loading patient:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to load patient';
      addToast(errorMsg, 'error');
    }
  }, [api, patientId, addToast]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      saveDraft();
    }, 30000);

    return () => clearInterval(interval);
  }, [saveDraft]);

  // Load draft on component mount
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // Fetch smart suggestions when diagnosis or symptoms change
  useEffect(() => {
    if (diagnoses.length > 0 || symptoms.length > 0) {
      const timer = setTimeout(() => {
        fetchSmartSuggestions();
      }, 1000); // Debounce 1 second

      return () => clearTimeout(timer);
    }
  }, [diagnoses, symptoms, fetchSmartSuggestions]);

  // Check drug interactions when medicines change
  useEffect(() => {
    if (meds.length >= 2) {
      const timer = setTimeout(() => {
        checkDrugInteractions();
      }, 2000); // Debounce 2 seconds

      return () => clearTimeout(timer);
    }
  }, [meds, checkDrugInteractions]);

  // ========================================
  // Search Patients
  // ========================================
  const searchPatients = async (query) => {
    if (!query || query.length < 2) {
      setPatientResults([]);
      return;
    }

    try {
      const res = await api.get(`/api/patients?search=${query}`);
      setPatientResults(res.data?.data?.data || res.data?.patients || []);
    } catch (error) {
      console.error('Error searching patients:', error);
      setPatientResults([]);
    }
  };

  const handlePatientSelect = (selectedPatient) => {
    navigate(`/orders/${selectedPatient.id}`);
    setShowPatientSearch(false);
    setPatientSearch('');
    setPatientResults([]);
  };

  // ========================================
  // Fetch Past Data
  // ========================================
  const fetchPastData = useCallback(async () => {
    if (!patientId) return;
    setLoadingPastData(true);
    try {
      // Fetch past prescriptions
      try {
        const rxRes = await api.get(`/api/prescriptions/${patientId}?limit=50`);
        // ApiResponse.paginated → res.data.data.data; sendSuccess → res.data.data.prescriptions
        const rxData = rxRes.data?.data;
        setPastPrescriptions(Array.isArray(rxData?.data) ? rxData.data : (rxData?.prescriptions || rxRes.data?.prescriptions || []));
      } catch (err) {
        console.error('Failed to fetch prescriptions:', err);
      }
      
      // Fetch past appointments (visits)
      try {
        const aptRes = await api.get('/api/appointments', {
          params: {
            patient_id: patientId,
            limit: 20,
            page: 1,
          }
        });
        const aptPayload = aptRes?.data?.data || aptRes?.data || {};
        const aptList =
          Array.isArray(aptPayload?.appointments)
            ? aptPayload.appointments
            : (Array.isArray(aptPayload?.data) ? aptPayload.data : (Array.isArray(aptRes?.data?.appointments) ? aptRes.data.appointments : []));
        setPastVisits((aptList || []).slice(0, 10));
      } catch (err) {
        console.error('Failed to fetch appointments:', err);
      }
      
      // Fetch past vitals
      try {
        const vitalsRes = await api.get(`/api/patient-data/vitals/${patientId}`);
        const vitalsData = vitalsRes.data?.data?.vitals || vitalsRes.data?.vitals || [];
        setPastVitals(vitalsData);

        // NOTE: Do NOT auto-fill the editable Vitals form from the last visit.
        // Vitals (temperature, BP, pulse, weight, SpO2, etc.) change at every
        // visit, so the doctor must record fresh values each time rather than
        // inheriting (and unintentionally re-saving) the previous visit's
        // readings. Past vitals remain available for display via pastVitals.
      } catch (err) {
        console.error('Failed to fetch vitals:', err);
      }
      
      // Fetch medical records
      try {
        const recordsRes = await api.get(`/api/patient-data/records/${patientId}`);
        setPastRecords(recordsRes.data?.data?.records || recordsRes.data?.records || []);
      } catch (err) {
        console.error('Failed to fetch records:', err);
      }
      
      // Fetch lab results to sync with PatientOverview
      try {
        const labsRes = await api.get(`/api/labs/${patientId}`);
        const labsData = labsRes.data.labs || [];
        // Group by report_group: multi-param tests share a non-'Prescription' report_group
        const groupMap = new Map();
        const ungrouped = [];
        for (const lab of labsData) {
          if (lab.report_group && lab.report_group !== 'Prescription') {
            if (!groupMap.has(lab.report_group)) groupMap.set(lab.report_group, []);
            groupMap.get(lab.report_group).push(lab);
          } else {
            ungrouped.push(lab);
          }
        }
        const labEntries = [];
        for (const [groupName, rows] of groupMap) {
          labEntries.push({
            id: rows[0].id,
            paramIds: rows.map(r => r.id),
            test_name: groupName,
            result_value: '',
            result_unit: '',
            reference_range: '',
            notes: rows[0].notes || '',
            category: rows[0].test_category || 'GENERAL',
            date: rows[0].date,
            parameters: rows.map(r => ({
              parameter_name: r.name,
              result_value: r.reading,
              unit: r.unit || '',
              reference_range: r.reference_range || ''
            }))
          });
        }
        for (const lab of ungrouped) {
          labEntries.push({
            id: lab.id,
            test_name: lab.name,
            result_value: lab.reading,
            result_unit: lab.unit,
            reference_range: lab.reference_range,
            notes: lab.notes,
            category: lab.test_category || 'GENERAL',
            date: lab.date
          });
        }
        setLabResultEntries(labEntries);
      } catch (err) {
        console.error('Failed to fetch lab results:', err);
      }
    } catch (err) {
      console.error('Failed to load past data:', err);
    } finally {
      setLoadingPastData(false);
    }
  }, [api, patientId]);

  // ========================================
  // Medical History Functions (dr.eka.care style)
  // ========================================
  const fetchMedicalHistory = useCallback(async () => {
    if (!patientId) return;
    setMedicalHistoryLoading(true);
    try {
      const res = await api.get(`/api/medical-history/patient/${patientId}`);
      const body = res.data || {};
      let raw = body.data != null ? body.data : body;
      if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
        raw = raw.data;
      }
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        raw = {};
      }
      setMedicalHistoryData({
        medicalHistory: Array.isArray(raw.medicalHistory) ? raw.medicalHistory : [],
        existingConditions: Array.isArray(raw.existingConditions) ? raw.existingConditions : [],
        surgicalHistory: Array.isArray(raw.surgicalHistory) ? raw.surgicalHistory : [],
        allergies: Array.isArray(raw.allergies) ? raw.allergies : [],
        familyHistory: Array.isArray(raw.familyHistory) ? raw.familyHistory : []
      });
    } catch (err) {
      console.error('Failed to fetch medical history:', err);
    } finally {
      setMedicalHistoryLoading(false);
    }
  }, [api, patientId]);

  // Load pad config from backend on mount — handles cross-device / post-login stale localStorage
  useEffect(() => {
    const loadPadConfigFromServer = async () => {
      try {
        const res = await api.get('/api/pad-config');
        if (res.data?.success && res.data?.templateConfigs) {
          const layout = res.data.templateConfigs.find(t => t.template_type === 'layout' && !!t.is_default);
          if (layout?.content) {
            const parsed = JSON.parse(layout.content);
            if (Array.isArray(parsed.field_order) && parsed.field_order.length > 0) {
              setPadFields(parsed.field_order);
            }
            if (parsed.sections && typeof parsed.sections === 'object') {
              setFieldStates(parsed.sections);
            }
          }
        }
      } catch {
        // keep localStorage values on failure
      }
    };
    loadPadConfigFromServer();
  }, [api]);

  // Pad config: re-read localStorage on window focus; if PMH "Auto sync" is on, refetch history from server
  useEffect(() => {
    const reloadConfigAndMaybeHistory = () => {
      try {
        const savedConfig = localStorage.getItem('padConfiguration');
        if (savedConfig) {
          const config = JSON.parse(savedConfig);
          if (config.fields && config.fieldStates) {
            setPadFields(config.fields);
            setFieldStates(config.fieldStates);
          }
          const autoSync = config.fieldStates?.['Patient Medical History']?.autoCopy;
          if (patientId && autoSync) {
            fetchMedicalHistory();
          }
        }
      } catch (error) {
        console.error('Failed to load pad configuration:', error);
      }
    };
    window.addEventListener('focus', reloadConfigAndMaybeHistory);
    return () => window.removeEventListener('focus', reloadConfigAndMaybeHistory);
  }, [patientId, fetchMedicalHistory]);

  useEffect(() => {
    if (!patientId) return;
    const enabled = fieldStates['Patient Medical History']?.enabled !== false;
    const autoSync = fieldStates['Patient Medical History']?.autoCopy === true;
    if (enabled) {
      if (pmhSectionWasHiddenRef.current) {
        if (autoSync) {
          fetchMedicalHistory();
        } else {
          setMedicalHistoryData(emptyMedicalHistoryData());
        }
      }
      pmhSectionWasHiddenRef.current = false;
    } else {
      pmhSectionWasHiddenRef.current = true;
    }
  }, [patientId, fieldStates, fetchMedicalHistory, emptyMedicalHistoryData]);

  // Configure your pad: same-tab save dispatches event; other tabs use storage — reload config + refetch PMH from API
  useEffect(() => {
    const applyConfigAndRefetch = (configJson) => {
      try {
        const config = typeof configJson === 'string' ? JSON.parse(configJson) : configJson;
        if (config?.fields && config?.fieldStates) {
          setPadFields(config.fields);
          setFieldStates(config.fieldStates);
        }
        const autoSync = config?.fieldStates?.['Patient Medical History']?.autoCopy === true;
        if (patientId && autoSync) {
          fetchMedicalHistory();
        } else {
          setMedicalHistoryData(emptyMedicalHistoryData());
        }
      } catch (e) {
        console.error('applyConfigAndRefetch:', e);
      }
    };
    const onPadConfigUpdated = () => {
      const raw = localStorage.getItem('padConfiguration');
      if (raw) applyConfigAndRefetch(raw);
    };
    const onStorage = (e) => {
      if (e.key !== 'padConfiguration' || !e.newValue) return;
      applyConfigAndRefetch(e.newValue);
    };
    window.addEventListener('padConfigurationUpdated', onPadConfigUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('padConfigurationUpdated', onPadConfigUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, [patientId, fetchMedicalHistory, emptyMedicalHistoryData]);

  const _toggleMedicalCondition = async (option, newValue) => {
    try {
      await api.put(`/api/medical-history/patient/${patientId}/toggle`, {
        option_id: option.option_id,
        condition_name: option.condition_name,
        has_condition: newValue,
        since_date: option.since_date || null
      });
      // Update local state
      setMedicalHistoryData(prev => ({
        ...prev,
        medicalHistory: (prev.medicalHistory || []).map(item =>
          item.option_id === option.option_id
            ? { ...item, has_condition: newValue }
            : item
        )
      }));
    } catch (err) {
      console.error('Failed to toggle condition:', err);
      addToast('Failed to update condition', 'error');
    }
  };

  const _updateConditionSince = async (option, sinceDate) => {
    try {
      await api.put(`/api/medical-history/patient/${patientId}/toggle`, {
        option_id: option.option_id,
        condition_name: option.condition_name,
        has_condition: option.has_condition,
        since_date: sinceDate
      });
      // Update local state
      setMedicalHistoryData(prev => ({
        ...prev,
        medicalHistory: (prev.medicalHistory || []).map(item =>
          item.option_id === option.option_id
            ? { ...item, since_date: sinceDate }
            : item
        )
      }));
    } catch (err) {
      console.error('Failed to update since date:', err);
    }
  };

  const addExistingCondition = async () => {
    if (!newCondition.condition_name.trim()) {
      addToast('Condition name is required', 'error');
      return;
    }
    try {
      const res = await api.post(`/api/medical-history/patient/${patientId}/existing-condition`, newCondition);
      if (res.status === 201 || res.data?.success || res.data?.data?.id) {
        const newId = res.data?.id || res.data?.data?.id || Date.now();
        setMedicalHistoryData(prev => ({
          ...prev,
          existingConditions: [...(prev.existingConditions || []), { id: newId, ...newCondition, status: 'Active' }]
        }));
        setNewCondition({ condition_name: '', icd_code: '', start_date: '', notes: '' });
        setShowAddConditionModal(false);
        addToast('Condition added', 'success');
      }
    } catch (err) {
      console.error('Failed to add condition:', err);
      addToast('Failed to add condition', 'error');
    }
  };

  const deleteExistingCondition = async (conditionId) => {
    try {
      await api.delete(`/api/medical-history/patient/${patientId}/existing-condition/${conditionId}`);
      setMedicalHistoryData(prev => ({
        ...prev,
        existingConditions: (prev.existingConditions || []).filter(c => c.id !== conditionId)
      }));
      addToast('Condition removed', 'success');
    } catch (err) {
      console.error('Failed to delete condition:', err);
      addToast('Failed to remove condition', 'error');
    }
  };

  const addSurgicalProcedure = async () => {
    if (!newSurgery.surgery_name.trim()) {
      addToast('Surgery name is required', 'error');
      return;
    }
    try {
      const res = await api.post(`/api/medical-history/patient/${patientId}/surgical-procedure`, newSurgery);
      if (res.data?.success || res.status === 201) {
        const newId = res.data?.data?.id || res.data?.id || Date.now();
        setMedicalHistoryData(prev => ({
          ...prev,
          surgicalHistory: [...(prev.surgicalHistory || []), { id: newId, ...newSurgery }]
        }));
        setNewSurgery({ surgery_name: '', surgery_date: '', hospital: '', surgeon: '', complications: '' });
        setShowAddSurgeryModal(false);
        addToast('Surgery added', 'success');
      }
    } catch (err) {
      console.error('Failed to add surgery:', err);
      addToast('Failed to add surgery', 'error');
    }
  };

  const deleteSurgicalProcedure = async (procedureId) => {
    try {
      await api.delete(`/api/medical-history/patient/${patientId}/surgical-procedure/${procedureId}`);
      setMedicalHistoryData(prev => ({
        ...prev,
        surgicalHistory: (prev.surgicalHistory || []).filter(s => s.id !== procedureId)
      }));
      addToast('Surgery removed', 'success');
    } catch (err) {
      console.error('Failed to delete surgery:', err);
      addToast('Failed to remove surgery', 'error');
    }
  };

  // Medical history belongs only in "Patient Medical History" — strip legacy auto blocks from Patient Notes
  useEffect(() => {
    if (!patientId) return;
    setPatientNotes((prev) => {
      if (!prev || typeof prev !== 'string' || !prev.includes('[AUTO_MEDICAL_HISTORY]')) return prev;
      const START = '[AUTO_MEDICAL_HISTORY]';
      const END = '[/AUTO_MEDICAL_HISTORY]';
      const start = prev.indexOf(START);
      if (start === -1) return prev;
      const end = prev.indexOf(END, start);
      if (end === -1) {
        return prev.slice(0, start).replace(/\s+$/u, '').trimEnd();
      }
      const after = end + END.length;
      return (prev.slice(0, start) + prev.slice(after)).replace(/\n{3,}/g, '\n\n').trim();
    });
  }, [patientId]);

  // ========================================
  // useEffect Hooks
  // ========================================

  // Load appointment context from sessionStorage
  useEffect(() => {
    try {
      const appointmentData = sessionStorage.getItem('currentAppointment');
      if (appointmentData) {
        const { appointmentId, queueId } = JSON.parse(appointmentData);
        setMeta(prev => ({
          ...prev,
          ...(appointmentId ? { appointment_id: appointmentId } : {}),
          ...(queueId ? { queue_id: queueId } : {})
        }));
      }
    } catch (error) {
      console.error('Error loading appointment context:', error);
    }
  }, []);

  useEffect(() => {
    fetchDoctorId();
  }, [fetchDoctorId]);

  useEffect(() => {
    if (patientId) {
      fetchPatient();
      fetchPastData();
      const autoSync = fieldStates['Patient Medical History']?.autoCopy === true;
      if (autoSync) {
        fetchMedicalHistory();
      } else {
        setMedicalHistoryData(emptyMedicalHistoryData());
      }
    }
  }, [patientId, location.key, fieldStates, fetchPatient, fetchPastData, fetchMedicalHistory, emptyMedicalHistoryData]);

  // Load copied prescription data from PatientOverview
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('copy') === 'true') {
      try {
        const rxData = JSON.parse(sessionStorage.getItem('copyPrescription') || '{}');
        if (rxData.symptoms && rxData.symptoms.length > 0) {
          const rawSx = rxData.symptoms;
          const normSx = Array.isArray(rawSx)
            ? rawSx.map(s => typeof s === 'string' ? { name: s, remarks: '' } : s)
            : String(rawSx).split(',').map(s => ({ name: s.trim(), remarks: '' })).filter(s => s.name);
          setSymptoms(normSx);
        }
        if (rxData.diagnoses && rxData.diagnoses.length > 0) {
          setDiagnoses(normalizeDiagnosisList(rxData.diagnoses));
        }
        if (rxData.medications && rxData.medications.length > 0) {
          setMeds(rxData.medications.map(m => ({
            ...m,
            timing: translateTiming(m.timing, language) || m.timing,
            instructions: translateInstruction(m.instructions, language) || m.instructions
          })));
        }
        if (rxData.advice) {
          setAdvice(rxData.advice);
        }
        if (rxData.follow_up_days) {
          setFollowUp(prev => ({ ...prev, days: String(typeof rxData.follow_up_days === 'object' ? (rxData.follow_up_days?.days || '') : rxData.follow_up_days || '') }));
        }
        if (rxData.patient_notes) {
          setPatientNotes(rxData.patient_notes);
        }
        if (rxData.custom_fields) {
          try {
            const cf = typeof rxData.custom_fields === 'string' ? JSON.parse(rxData.custom_fields) : rxData.custom_fields;
            if (cf && typeof cf === 'object') setCustomFieldValues(cf);
          } catch { /* ignore malformed custom_fields */ }
        }
        sessionStorage.removeItem('copyPrescription');
        addToast('Prescription data copied from previous visit', 'success');
      } catch (e) {
        console.error('Failed to load copied prescription:', e);
      }
    }
  }, [location.search]);

  // Fetch active allergies for this patient
  useEffect(() => {
    const fetchAllergies = async () => {
      if (!patientId) return;
      try {
        const res = await api.get(`/api/allergies/${patientId}`, { params: { active: 1 } });
        const allergyItems = res.data?.data?.items || res.data?.items;
        setPatientAllergies(Array.isArray(allergyItems) ? allergyItems : []);
      } catch (e) {
        setPatientAllergies([]);
      }
    };
    fetchAllergies();
  }, [api, patientId]);

  // Compute allergy conflicts whenever meds or allergies change
  useEffect(() => {
    const normalize = (s) => (s || '')
      .toString()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s.-]/g, '')
      .trim();

    const conflicts = [];
    for (const m of meds) {
      const medName = normalize(m?.name || m?.brand || m?.medication_name);
      if (!medName) continue;
      for (const a of patientAllergies) {
        const alNameOrig = a?.allergen_name || '';
        const alName = normalize(alNameOrig);
        if (!alName) continue;
        if (medName.includes(alName) || alName.includes(medName)) {
          const label = `${m?.brand || m?.name || 'Medicine'} ↔ ${alNameOrig}`;
          conflicts.push(label);
        }
      }
    }
    // de-duplicate
    setAllergyConflicts([...new Set(conflicts)]);
  }, [meds, patientAllergies]);

  // Prefill from last prescription if coming from Patient Overview
  useEffect(() => {
    try {
      const prefillStr = sessionStorage.getItem('prefill_last_rx');
      if (!prefillStr) return;
      sessionStorage.removeItem('prefill_last_rx');
      const rx = JSON.parse(prefillStr);
      if (!rx) return;

      // Symptoms
      const sx = Array.isArray(rx.symptoms) ? rx.symptoms : (rx.symptoms ? [rx.symptoms] : []);
      if (sx.length) setSymptoms(sx);

      // Diagnoses
      const dx = normalizeDiagnosisList(rx.diagnoses);
      if (dx.length) setDiagnoses(dx);

      // Medications - Filter out invalid entries and translate to current language
      const medsIn = Array.isArray(rx.medications) ? rx.medications : [];
      if (medsIn.length) {
        const validMeds = medsIn
          .filter(m => m && (m.name || m.medication_name || m.brand))
          .map(m => {
            const rawTiming = m.timing || (timingOptions[language] || timingOptions.en)[0];
            const rawInstructions = m.instructions || '';
            return {
              name: m.name || m.medication_name || m.brand || '',
              brand: m.brand || m.name || '',
              composition: m.composition || m.generic_name || '',
              dosage_form: m.dosage_form || '',
              dosage: m.dosage || '',
              frequency: m.frequency || '',
              timing: translateTiming(rawTiming, language) || rawTiming,
              duration: m.duration || '',
              instructions: translateInstruction(rawInstructions, language) || rawInstructions,
              qty: m.quantity || m.qty || 0
            };
          });
        if (validMeds.length > 0) {
          setMeds(validMeds);
        }
      }

      // Advice
      if (rx.advice || rx.advices) setAdvice(rx.advice || rx.advices || '');

      // Follow-up
      if (rx.follow_up_date) setFollowUp(prev => ({ ...prev, date: rx.follow_up_date }));

      addToast('Prefilled from last prescription. Review and save.', 'success');
    } catch (e) {
      console.error('Prefill error:', e);
    }
  }, [language, addToast]);

  // Load custom examination templates from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('custom_exam_templates');
      if (saved) setCustomExamTemplates(JSON.parse(saved));
    } catch (e) {
      // ignore errors accessing localStorage
    }
  }, []);

  useEffect(() => {
    try {
      const key = `frequent_exam_findings_${meta?.doctor_id || user?.doctor_id || user?.id || 'global'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFrequentExamFindings(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      setFrequentExamFindings([]);
    }
  }, [meta?.doctor_id, user?.doctor_id, user?.id]);

  useEffect(() => {
    const text = (examFindings || [])
      .map((f) => {
        const t = (f?.text || '').trim();
        const n = (f?.notes || '').trim();
        if (!t && !n) return '';
        if (!n) return t;
        return `${t} - ${n}`;
      })
      .filter(Boolean)
      .join('\n');
    setGeneralExamination(text);
    setSystemicExamination('');
  }, [examFindings, setGeneralExamination, setSystemicExamination]);

  const addExamFinding = useCallback((text) => {
    const cleaned = (text || '').toString().trim();
    if (!cleaned) return;
    setExamFindings((prev) => {
      const existing = prev || [];
      if (existing.some((f) => (f?.text || '').toLowerCase() === cleaned.toLowerCase())) return existing;
      return [...existing, { text: cleaned, notes: '' }];
    });
    setExamFindingInput('');
    setExamFindingDropdown(false);

    try {
      const key = `frequent_exam_findings_${meta?.doctor_id || user?.doctor_id || user?.id || 'global'}`;
      const current = Array.isArray(frequentExamFindings) ? frequentExamFindings : [];
      const next = (() => {
        const idx = current.findIndex((x) => (x?.text || '').toLowerCase() === cleaned.toLowerCase());
        if (idx >= 0) {
          const updated = [...current];
          updated[idx] = { ...updated[idx], count: (Number(updated[idx].count) || 0) + 1 };
          return updated;
        }
        return [{ text: cleaned, count: 1 }, ...current];
      })()
        .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
        .slice(0, 20);

      setFrequentExamFindings(next);
      localStorage.setItem(key, JSON.stringify(next));
    } catch (e) {
      // ignore
    }
  }, [frequentExamFindings, meta?.doctor_id, user?.doctor_id, user?.id]);

  // Fetch all templates sequentially to avoid overwhelming the backend
  useEffect(() => {
    const fetchAllTemplates = async () => {
      // symptoms
      try {
        const res = await api.get('/api/symptoms-templates');
        setSymptomsTemplates(res.data?.data?.templates || res.data?.templates || []);
      } catch (error) {
        console.error('Failed to fetch symptoms templates:', error);
      }
      // diagnosis
      try {
        const res = await api.get('/api/diagnosis-templates');
        setDiagnosisTemplates(res.data.templates || []);
      } catch (error) {
        console.error('Failed to fetch diagnosis templates:', error);
      }
      // lab templates
      try {
        const res = await api.get('/api/lab-templates');
        const templates = res.data.data || res.data.templates || res.data || [];
        setLabTemplates(templates);
        const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];
        setLabTemplateCategories(categories);
      } catch (error) {
        console.error('Failed to fetch lab templates:', error);
      }
      // Load custom lab tests from database
      if (patientId) {
        try {
          const res = await api.get('/api/custom-lab-tests', { params: { patientId: patientId } });
          setCustomLabTestsFromOverview(res.data.customLabTests || []);
          console.log('Loaded custom tests from database:', res.data.customLabTests);
        } catch (e) {
          console.error('Failed to load custom lab tests from database:', e);
          setCustomLabTestsFromOverview([]);
        }
      }
      // lab advice groups (for Lab Test Advice)
      try {
        const res = await api.get('/api/lab-advice-groups');
        const groups = res.data?.groups || res.data?.data?.groups || [];
        setLabAdviceGroups(Array.isArray(groups) ? groups : []);
      } catch (error) {
        console.error('Failed to fetch lab advice groups:', error);
        setLabAdviceGroups([]);
      }
      // medications templates
      try {
        const res = await api.get('/api/medications-templates');
        setMedicationsTemplates(res.data.templates || []);
      } catch (error) {
        console.error('Failed to fetch medications templates:', error);
      }
      // receipt templates
      try {
        const res = await api.get('/api/receipt-templates');
        const templates = res.data.templates || [];
        setReceiptTemplates(templates);
        const defaultTpl = templates.find(t => t.is_default);
        if (defaultTpl) {
          setSelectedTemplateId(defaultTpl.id);
          setSelectedTemplate(defaultTpl);
        }
      } catch (error) {
        console.error('Failed to fetch receipt templates:', error);
      }
    };
    fetchAllTemplates();
  }, [api]);

  // Fetch advice templates based on language
  useEffect(() => {
    const fetchAdviceTemplates = async () => {
      try {
        _setAdviceTemplatesLoading(true);
        const res = await api.get('/api/advice/templates', {
          params: { language, limit: 50 }
        });
        const payload = res.data?.data || res.data || [];
        _setAdviceTemplates(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.error('Failed to fetch advice templates:', error);
        _setAdviceTemplates([]);
      } finally {
        _setAdviceTemplatesLoading(false);
      }
    };
    fetchAdviceTemplates();
  }, [language, api]);

  // Close template dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target)) {
        setShowTemplateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Delete a receipt template
  const deleteReceiptTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this letterhead template?')) return;
    try {
      await api.delete(`/api/receipt-templates/${templateId}`);
      setReceiptTemplates(prev => prev.filter(t => t.id !== templateId));
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
        setSelectedTemplate(null);
      }
      addToast('Template deleted', 'success');
    } catch (e) {
      addToast('Failed to delete template', 'error');
    }
  };

  // Hide default letterhead
  const hideDefaultLetterhead = () => {
    if (!confirm('Remove Default Letterhead? You can restore it from Doctor Settings.')) return;
    setShowDefaultLetterhead(false);
    localStorage.setItem('hideDefaultLetterhead', 'true');
    // If default was selected, switch to first available template or none
    if (!selectedTemplateId) {
      const first = receiptTemplates[0];
      if (first) {
        setSelectedTemplateId(first.id);
        setSelectedTemplate(first);
      }
    }
    addToast('Default Letterhead removed', 'success');
  };

  // Clear selected advice when language changes to avoid mismatch
  useEffect(() => {
    // Clear selected advice when language changes
    setSelectedAdvice([]);
  }, [language]);

  // PHASE 1: Initialize recent medicines and keyboard shortcuts
  useEffect(() => {
    // Load recently used medicines
    const recent = RecentlyUsedMedicines.getAll();
    _setRecentMedicines(recent.slice(0, 15));

    // Setup keyboard shortcuts
    const handleKeyDown = (e) => {
      // Ctrl+T = Open template selector
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        setShowTemplateQuickWins(!showTemplateQuickWins);
        addToast('Template selector opened (Ctrl+T)', 'info');
      }
      // Ctrl+S = Save prescription  
      else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveDraft();
        addToast('Draft saved (Ctrl+S)', 'success');
      }
      // Ctrl+Shift+S = Save as template
      else if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setShowTemplateModal(true);
        addToast('Save as template (Ctrl+Shift+S)', 'info');
      }
      // Ctrl+P = Print prescription
      else if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        handlePrintClick();
      }
      // Ctrl+M = Focus medicine input
      else if (e.ctrlKey && e.key === 'm') {
        e.preventDefault();
        const medicineInput = document.querySelector('[data-testid="medicine-input"]');
        if (medicineInput) {
          medicineInput.focus();
          addToast('Focused on medicine input (Ctrl+M)', 'info');
        }
      }
      // Ctrl+D = Focus diagnosis input
      else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        const diagnosisInput = document.querySelector('input[placeholder*="Diagnosis"]');
        if (diagnosisInput) {
          diagnosisInput.focus();
          addToast('Focused on diagnosis input (Ctrl+D)', 'info');
        }
      }
      // Ctrl+L = Focus lab tests input
      else if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        const labInput = document.querySelector('[data-testid="lab-input"]');
        if (labInput) {
          labInput.focus();
          addToast('Focused on lab tests input (Ctrl+L)', 'info');
        }
      }
      // Ctrl+I = Check interactions
      else if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        checkDrugInteractions();
        addToast('Checking drug interactions (Ctrl+I)', 'info');
      }
      // Ctrl+Shift+C = Clear form
      else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (window.confirm('Clear entire prescription? This cannot be undone.')) {
          handleClearForm();
          addToast('Prescription cleared', 'success');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTemplateQuickWins, addToast]);

  // PHASE 1: Handle diagnosis auto-suggestions
  const _handleDiagnosisAutoSuggest = useCallback((diagnosisName) => {
    const suggestions = diagnosisSuggestions[diagnosisName];
    if (!suggestions) return;

    // Auto-add investigations (lab tests)
    if (suggestions.investigations && labResults.length === 0) {
      setProcedures([...procedures, ...suggestions.investigations.map(inv => ({
        name: inv,
        notes: ''
      }))]);
      addToast(`Added ${diagnosisName} investigations`, 'info');
    }

    // Auto-add precautions
    if (suggestions.precautions && advice.length === 0) {
      setAdvice(suggestions.precautions);
    }

    // Auto-add diet advice
    if (suggestions.diet && !advice.includes(suggestions.diet)) {
      setAdvice(prev => prev ? `${prev}\n\nDiet: ${suggestions.diet}` : `Diet: ${suggestions.diet}`);
    }
  }, [procedures, labResults, advice, addToast]);

  // Handle template application
  const handleApplyTemplate = useCallback((templateName) => {
    let template = null;
    const customTemplate = customTemplates.find(t => t.template_name === templateName);
    if (customTemplate) {
      const rawDiagnoses = customTemplate.diagnosis || customTemplate.diagnoses;
      template = {
        name: customTemplate.template_name,
        shortName: customTemplate.category,
        symptoms: typeof customTemplate.symptoms === 'string' ?
          JSON.parse(customTemplate.symptoms) : customTemplate.symptoms || [],
        diagnoses: typeof rawDiagnoses === 'string' ?
          JSON.parse(rawDiagnoses) : rawDiagnoses || [],
        medications: typeof customTemplate.medications === 'string' ?
          JSON.parse(customTemplate.medications) : customTemplate.medications || [],
        investigations: customTemplate.investigations || '',
        precautions: customTemplate.precautions || '',
        dietRestrictions: customTemplate.diet_restrictions || '',
        activities: customTemplate.activities || '',
        advice: customTemplate.advice || '',
        followUpDays: customTemplate.follow_up_days || 7
      };
    }
    
    if (!template) return;

    // Apply template using the utility function
    applyCompleteTemplate(template, {
      setSymptoms,
      setDiagnoses,
      setLabAdvice,
      setMeds: (medsToAdd) => {
        // Merge template meds into existing meds (don't replace)
        setMeds(prev => {
          const existingNames = new Set(
            (prev || []).map(m => (m.name || m.brand || '').toLowerCase().trim())
          );
          const filtered = (Array.isArray(medsToAdd) ? medsToAdd : []).filter(m => {
            const key = (m.name || m.brand || '').toLowerCase().trim();
            return key && !existingNames.has(key);
          });
          const withInstructions = filtered.map(m => {
            const instr = generateAutoInstructions(
              m.frequency || '1-0-1',
              m.timing,
              language,
              translateTiming,
              m.duration,
              m.dosage || '',
              m.dosage_form || ''
            );
            return { ...m, instructions: instr, auto_instructions: true };
          });
          return [...(prev || []), ...withInstructions];
        });
      },
      setAdvice,
      setFollowUp: (val) => {
        if (val && typeof val === 'object' && val.days !== undefined) {
          setFollowUp(prev => ({ ...prev, days: val.days.toString(), date: val.date || prev.date }));
        } else if (val !== undefined) {
          setFollowUp(prev => ({ ...prev, days: val.toString() }));
        }
      },
      setPatientNotes,
      setProcedures,
      language,
      timingOptions,
      addToast
    });

    setShowTemplateQuickWins(false);
    addToast(`Applied ${templateName} template successfully`, 'success');
  }, [addToast, language, customTemplates]);

  // Save current prescription as custom template
  const handleSaveAsTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) {
      addToast('Template name is required', 'error');
      return;
    }
    if (!newTemplateShortName.trim()) {
      addToast('Short name is required', 'error');
      return;
    }
    if (isSavingTemplate) return;
    setIsSavingTemplate(true);

    try {
      const symptomsArr = templateFormData.symptoms
        ? templateFormData.symptoms.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const diagnosesArr = templateFormData.diagnoses
        ? templateFormData.diagnoses.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const medsArr = templateFormData.medications.filter(m => m.name.trim());

      const newTemplate = {
        template_name: newTemplateName,
        category: newTemplateShortName,
        description: `Custom template: ${symptomsArr.join(', ') || newTemplateName}`,
        symptoms: JSON.stringify(symptomsArr),
        diagnoses: JSON.stringify(diagnosesArr),
        medications: JSON.stringify(medsArr),
        investigations: templateFormData.investigations || '',
        precautions: templateFormData.precautions || '',
        diet_restrictions: templateFormData.diet_restrictions || '',
        activities: templateFormData.activities || '',
        advice: templateFormData.advice || '',
        follow_up_days: parseInt(templateFormData.follow_up_days) || 7,
        duration_days: parseInt(templateFormData.duration_days) || 7,
        is_active: 1
      };

      const response = await api.post('/api/prescription-templates', newTemplate);

      if (response.data.templateId || response.status === 201) {
        // Refetch templates to get updated list
        try {
          const tRes = await api.get('/api/prescription-templates');
          setCustomTemplates(tRes.data.templates || []);
        } catch (_) { /* ignore */ }
        setShowCreateTemplateModal(false);
        setNewTemplateName('');
        setNewTemplateShortName('');
        setTemplateFormData({
          symptoms: '', diagnoses: '',
          medications: [{ name: '', brand: '', composition: '', dosage: '', dosage_form: '', frequency: '', timing: { type: 'After Meal', time: null }, duration: '', instructions: '', qty: '' }],
          investigations: '', precautions: '', diet_restrictions: '', activities: '', advice: '', follow_up_days: '', duration_days: '7'
        });
        setTplSymptomInput(''); setTplDiagInput('');
        addToast(`Template "${newTemplateName}" saved!`, 'success');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      addToast('Failed to save template', 'error');
    } finally {
      setIsSavingTemplate(false);
    }
  }, [
    newTemplateName,
    newTemplateShortName,
    templateFormData,
    customTemplates,
    isSavingTemplate,
    addToast
  ]);

  // Delete custom template
  const handleDeleteCustomTemplate = useCallback(async (templateId) => {
    try {
      await api.delete(`/api/prescription-templates/${templateId}`);
      setCustomTemplates(customTemplates.filter(t => t.id !== templateId));
      addToast('Template deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting template:', error);
      addToast('Failed to delete template', 'error');
    }
  }, [customTemplates, addToast]);

  // Clear form function
  const handleClearForm = useCallback(() => {
    setSymptoms([]);
    setDiagnoses([]);
    setMeds([]);
    setAdvice('');
    setLabAdvice('');
    setLabAdviceRemarks({});
    setLabAdviceInput('');
    setFollowUp({ days: '', date: '', autoFill: false });
    setPatientNotes('');
    setPrivateNotes('');
    setProcedures([]);
    setExamFindings([]);
    setSelectedAdvice([]);
    setVitals({ temp: '', height: '', bmi: '', weight: '', pulse: '', blood_pressure: '', spo2: '' });
    setCustomFieldValues({});
    clearDraft();
  }, [clearDraft]);

  // ICD Search - debounced API call
  useEffect(() => {
    if (icdQuery.length < 1) {
      setIcdResults([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        // Search ICD based on selected version
        const response = await api.get('/api/icd/search', {
          params: { 
            q: icdQuery, 
            version: icdVersion, // 'icd10', 'icd11', 'icd11local', or 'all'
            limit: 20 
          }
        });

        const payload = response.data?.data || response.data;

        // Handle response formats:
        // - { success: true, data: { items: [...] } }
        // - { items: [...] }
        // - legacy: { results: [...] }
        if (payload?.items && Array.isArray(payload.items)) {
          setIcdResults(payload.items);
        } else if (payload?.results && Array.isArray(payload.results)) {
          setIcdResults(payload.results);
        } else if (Array.isArray(payload)) {
          setIcdResults(payload);
        } else {
          setIcdResults([]);
        }
      } catch (err) {
        console.error('ICD search error:', err);
        setIcdResults([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [icdQuery, icdVersion, api]);

  // Symptom Search - searches from snomed_clinical_findings + symptom_medication_mapping
  // When empty, shows top/popular symptoms so doctor sees options immediately on focus
  useEffect(() => {
    const debounceMs = symptomInput.length < 1 ? 0 : 250;

    const debounceTimer = setTimeout(async () => {
      try {
        const res = await api.get('/api/symptoms/search', {
          params: { q: symptomInput, limit: 25 }
        });
        const allResults = (res.data?.symptoms || []).map(s => ({
          pt: { term: s.symptom.charAt(0).toUpperCase() + s.symptom.slice(1) },
          fsn: { term: s.symptom },
          source: s.source || 'mapping',
          snomed_id: s.snomed_id,
          icd_code: s.icd_code
        }));
        setSnomedSymptomResults(allResults);
      } catch (err) {
        console.debug('Symptom search error:', err);
        setSnomedSymptomResults([]);
      }
    }, debounceMs);

    return () => clearTimeout(debounceTimer);
  }, [symptomInput, symptomFocusTick, api]);

  // ICD Diagnosis Search (ICD-10 + ICD-11 from local DB) - debounced
  useEffect(() => {
    if (diagnosisInput.length < 1) {
      setDiagnosisSearchResults([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setDiagnosisLoading(true);
        const response = await api.get('/api/diagnoses/search', {
          params: { q: diagnosisInput, limit: 20, version: 'icd10' }
        });

        const payload = response.data?.data || response.data;
        const results = payload?.diagnoses || [];
        setDiagnosisSearchResults(Array.isArray(results) ? results.map(r => ({
          code: r.code || r.icd_code || r.icd11_code || '',
          diagnosis_name: r.diagnosis_name || r.primary_description || r.preferred_label || r.title || '',
          description: r.description || r.secondary_description || r.full_title || '',
          version: r.version === 'custom' ? 'Custom' : (r.version === 'icd11' ? 'ICD-11' : 'ICD-10'),
          isCustom: r.version === 'custom'
        })) : []);
      } catch (err) {
        console.debug('Diagnosis search error:', err);
        setDiagnosisSearchResults([]);
      } finally {
        setDiagnosisLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [diagnosisInput, api]);

  // SNOMED Diagnosis Search - debounced API call
  useEffect(() => {
    if (diagnosisInput.length < 1) {
      setSnomedDiagnosisResults([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const response = await api.get('/api/snomed-local/search', {
          params: { q: diagnosisInput, limit: 10, offset: snomedDiagnosisPage * 10, semanticTag: 'disorder', mode: 'like' }
        });

        if (response.data?.items && Array.isArray(response.data.items)) {
          setSnomedDiagnosisResults(response.data.items);
        } else {
          setSnomedDiagnosisResults([]);
        }
      } catch (err) {
        console.debug('SNOMED diagnosis search error:', err);
        setSnomedDiagnosisResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [diagnosisInput, api, snomedDiagnosisPage]);

  // SNOMED Drug Search - debounced API call
  useEffect(() => {
    if (medInput.length < 1) {
      setSnomedDrugResults([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        const response = await api.get('/api/snomed-local/drugs', {
          params: { q: medInput, limit: 15, offset: snomedDrugPage * 15 }
        });

        if (response.data?.items && Array.isArray(response.data.items)) {
          setSnomedDrugResults(response.data.items);
        } else {
          setSnomedDrugResults([]);
        }
      } catch (err) {
        console.debug('SNOMED drug search error:', err);
        setSnomedDrugResults([]);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [medInput, api, snomedDrugPage]);

  // ========================================
  // Utility Functions
  // ========================================

  // Helper function to translate timing from any language to target language
  const translateTiming = (timingValue, targetLang) => {
    if (!timingValue) return '';

    // Extract type if it's an object
    const isObject = typeof timingValue === 'object' && timingValue !== null;
    const rawValue = isObject ? timingValue.type : timingValue;

    if (!rawValue) return '';

    // Special case for FIXED_TIME formatting
    if (isObject && timingValue.type === 'FIXED_TIME' && timingValue.time) {
      const timeStr = timingValue.time;
      const at = { en: 'at', hi: 'बजे', mr: 'वाजता' }[targetLang] || 'at';
      return targetLang === 'en' ? `${at} ${timeStr}` : `${timeStr} ${at}`;
    }

    // Create reverse lookup: find which index this timing value corresponds to
    let foundIndex = -1;

    // Check each language to find where this timing value exists
    Object.keys(timingOptions).forEach(lang => {
      const idx = timingOptions[lang]?.indexOf(rawValue);
      if (idx !== -1) {
        foundIndex = idx;
      }
    });

    // If found, return the corresponding value in target language
    if (foundIndex !== -1 && timingOptions[targetLang]) {
      return timingOptions[targetLang][foundIndex] || rawValue;
    }

    // Fallback: use TIMING_TRANSLATIONS for extra timings not in timingOptions
    if (TIMING_TRANSLATIONS[rawValue]?.[targetLang]) {
      return TIMING_TRANSLATIONS[rawValue][targetLang];
    }

    // Reverse lookup in TIMING_TRANSLATIONS (for non-English → target)
    for (const [enKey, langs] of Object.entries(TIMING_TRANSLATIONS)) {
      for (const [, text] of Object.entries(langs)) {
        if (text === rawValue && TIMING_TRANSLATIONS[enKey][targetLang]) {
          return TIMING_TRANSLATIONS[enKey][targetLang];
        }
      }
    }

    return String(rawValue); // Ensure we return a string, not an object
  };

  // Helper function to translate instructions
  const translateInstruction = (instruction, targetLang) => {
    if (!instruction) return '';
    
    // Instruction translations dictionary
    const instructionTranslations = INSTRUCTION_TRANSLATIONS;

    if (!targetLang) return instruction;

    // 1. Exact match against English keys
    if (instructionTranslations[instruction] && instructionTranslations[instruction][targetLang]) {
      return instructionTranslations[instruction][targetLang];
    }

    // 2. Reverse lookup: if instruction is already in another language, find the English key and translate
    for (const [enKey, langs] of Object.entries(instructionTranslations)) {
      for (const [, text] of Object.entries(langs)) {
        if (text === instruction && instructionTranslations[enKey][targetLang]) {
          return instructionTranslations[enKey][targetLang];
        }
      }
    }

    // 3. Partial match - only when instruction is short and key covers most of it
    // Skip partial match for long custom instructions to avoid replacing them
    const lowerInstr = instruction.toLowerCase();
    const instrLen = lowerInstr.trim().length;
    let bestMatch = null;
    let bestLen = 0;
    // Check English keys - only match if key covers >= 60% of instruction length
    for (const key of Object.keys(instructionTranslations)) {
      const keyLower = key.toLowerCase();
      if (lowerInstr.includes(keyLower) && key.length > bestLen && key.length >= instrLen * 0.6) {
        bestMatch = key;
        bestLen = key.length;
      }
    }
    // Also check non-English values for reverse partial match
    if (!bestMatch) {
      for (const [enKey, langs] of Object.entries(instructionTranslations)) {
        for (const [, text] of Object.entries(langs)) {
          if (text && lowerInstr.includes(text.toLowerCase()) && text.length > bestLen && text.length >= instrLen * 0.6) {
            bestMatch = enKey;
            bestLen = text.length;
          }
        }
      }
    }
    if (bestMatch && instructionTranslations[bestMatch][targetLang]) {
      return instructionTranslations[bestMatch][targetLang];
    }

    return instruction;
  };

  // Translate a single advice item by matching against predefinedAdvice in all languages
  const translateSingleAdviceItem = (item, targetLang) => {
    const trimmed = item.trim();
    if (!trimmed) return item;
    const langKeys = Object.keys(predefinedAdvice);
    for (const srcLang of langKeys) {
      const items = predefinedAdvice[srcLang];
      const idx = items.findIndex(i => i.toLowerCase() === trimmed.toLowerCase());
      if (idx !== -1) {
        const target = predefinedAdvice[targetLang] || predefinedAdvice.en;
        return target[idx] || item;
      }
    }
    return item; // no match found, keep as-is
  };

  // Translate a single advice line — handles "•"-separated items within a line
  const translateAdviceLine = (line, targetLang) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Try exact match first
    const exact = translateSingleAdviceItem(trimmed, targetLang);
    if (exact !== trimmed) return exact;

    // If line contains "•", translate each part individually
    if (trimmed.includes('•')) {
      const parts = trimmed.split('•').map(p => p.trim()).filter(Boolean);
      const translated = parts.map(p => translateSingleAdviceItem(p, targetLang));
      return translated.join(' • ');
    }

    return line; // no match found, keep as-is
  };

  // When language changes, translate all existing medication timings, instructions AND advice to the new language
  useEffect(() => {
    if (meds.length > 0) {
      setMeds(prev => prev.map(m => {
        const newTiming = translateTiming(m.timing, language) || m.timing;
        let newInstructions = m.instructions;

        if (m.auto_instructions) {
          // Auto-generated: always regenerate in new language
          const generated = generateAutoInstructions(m.frequency, newTiming, language, translateTiming, m.duration, m.dosage, m.dosage_form);
          if (generated) newInstructions = generated;
        } else if (m.instructions) {
          // Manual/DB instruction: try to translate
          const attempted = translateInstruction(m.instructions, language);
          if (attempted && attempted !== m.instructions) {
            // Found translation
            newInstructions = attempted;
          } else if (language !== 'en') {
            // No translation found — auto-generate from frequency+timing
            const generated = generateAutoInstructions(m.frequency, newTiming, language, translateTiming, m.duration, m.dosage, m.dosage_form);
            if (generated) newInstructions = generated;
          } else {
            // Going to English — try auto-generate fallback
            const generated = generateAutoInstructions(m.frequency, newTiming, language, translateTiming, m.duration, m.dosage, m.dosage_form);
            if (generated) newInstructions = generated;
          }
        } else {
          // No instruction yet — generate
          const generated = generateAutoInstructions(m.frequency, newTiming, language, translateTiming, m.duration, m.dosage, m.dosage_form);
          if (generated) newInstructions = generated;
        }

        return { ...m, timing: newTiming, instructions: newInstructions, auto_instructions: m.auto_instructions };
      }));
    }
    // Translate advice text
    if (advice) {
      const lines = advice.split('\n');
      const translated = lines.map(line => translateAdviceLine(line, language));
      const newAdvice = translated.join('\n');
      if (newAdvice !== advice) setAdvice(newAdvice);
    }

  }, [language]);

  // Parse frequency strings like '1-0-1', 'OD', 'BD', 'TDS', 'QID'
  const parseFrequency = (freq) => {
    if (!freq) return 0;
    const s = String(freq).toUpperCase().trim();
    if (/^\d+(-\d+)*$/.test(s)) {
      return s.split('-').map(x => parseInt(x || '0', 10)).reduce((a, b) => a + b, 0);
    }
    const map = { OD: 1, BD: 2, TDS: 3, TID: 3, QID: 4, HS: 1, STAT: 1, QHS: 1, QOD: 0.5 };
    return map[s] || 0;
  };

  const parseDurationDays = (dur) => {
    if (!dur) return 0;
    const m = String(dur).match(/(\d+)/);
    if (!m) return 0;
    return parseInt(m[1], 10) || 0;
  };

  const formatTimeWithAMPM = (timeStr) => {
    if (!timeStr) return '';
    if (/am|pm/i.test(timeStr)) return timeStr;
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    const m = mStr || '00';
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${period}`;
  };

  const calculateAge = (dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const calculateFollowUpDate = (days) => {
    if (!days) return '';
    const date = new Date();
    date.setDate(date.getDate() + parseInt(days));
    return date.toISOString().split('T')[0];
  };

  // ========================================
  // MyGenie Integration - Apply suggestion to current prescription
  // Accessible to other components (e.g., MyGenie widget) via window.applyMyGenieSuggestion
  const applyGenieSuggestion = (suggestion) => {
    if (!suggestion) return;

    try {
      // Symptoms
      if (Array.isArray(suggestion.symptoms) && suggestion.symptoms.length > 0) {
        const newSx = suggestion.symptoms.filter(s => !symptoms.includes(s));
        if (newSx.length) setSymptoms(prev => [...prev, ...newSx]);
      }

      // Diagnoses
      if (Array.isArray(suggestion.diagnoses) && suggestion.diagnoses.length > 0) {
        const newDx = suggestion.diagnoses.filter(d => {
          const dLower = (typeof d === 'object' ? (d.label || '') : d).toLowerCase();
          return !diagnoses.some(dx => {
            const dxLabel = typeof dx === 'string' ? dx : (dx.label || '');
            return dxLabel.toLowerCase() === dLower;
          });
        });
        if (newDx.length) setDiagnoses(prev => [...prev, ...newDx]);
      }

      // Medications - accept array of medication-like objects
      if (Array.isArray(suggestion.medications) && suggestion.medications.length > 0) {
        const toAdd = suggestion.medications.map(m => ({
          name: m.name || m.medication_name || m.brand || '',
          brand: m.brand || m.name || '',
          composition: m.composition || '',
          frequency: m.frequency || '1-0-1',
          timing: m.timing || (timingOptions[language] || timingOptions.en)[0],
          duration: m.duration || '7 days',
          instructions: m.instructions || '',
          qty: m.qty || m.quantity || 7
        }));

        setMeds(prev => {
          const existing = prev || [];
          const filtered = toAdd.filter(n => !existing.some(e => (e.name && n.name && e.name === n.name) || (e.brand && n.brand && e.brand === n.brand)));
          return [...existing, ...filtered];
        });
      }

      // Advice / Free text
      if (suggestion.advice && typeof suggestion.advice === 'string') {
        setAdvice(prev => (prev ? `${prev}\n${suggestion.advice}` : suggestion.advice));
      }

      // Patient / private notes — if note starts with "Investigations:", route to lab advice
      if (suggestion.note && typeof suggestion.note === 'string') {
        if (/^investigations?:/i.test(suggestion.note.trim())) {
          const labContent = suggestion.note.replace(/^investigations?:\s*/i, '').trim();
          setLabAdvice(prev => (prev ? `${prev}\n${labContent}` : labContent));
        } else {
          setPatientNotes(prev => (prev ? `${prev}\n${suggestion.note}` : suggestion.note));
        }
      }

      addToast('Applied MyGenie suggestion to the prescription', 'success');
    } catch (err) {
      console.error('Failed to apply MyGenie suggestion:', err);
      addToast('Could not apply MyGenie suggestion', 'error');
    }
  };

  useEffect(() => {
    // Expose a short-lived bridge for other components to apply suggestions
    try {
      window.applyMyGenieSuggestion = applyGenieSuggestion;
    } catch (e) {
      // ignore in non-browser environments
    }
    return () => {
      try {
        if (window.applyMyGenieSuggestion === applyGenieSuggestion) delete window.applyMyGenieSuggestion;
      } catch (e) {
        // ignore
      }
    };
  }, [symptoms, diagnoses, meds, language, advice]);

  // ========================================
  // Symptom Handlers
  // ========================================
  const addSymptom = async (s) => {
    if (!s) return;
    const symptomName = typeof s === 'object' ? s.name : s;
    const alreadyExists = symptoms.some(sym => (typeof sym === 'object' ? sym.name : sym) === symptomName);
    if (!alreadyExists) {
      setSymptoms((prev) => [...prev, { name: symptomName, remarks: '' }]);

      // Save custom symptom to DB for future suggestions
      try { api.post('/api/symptoms', { symptom_name: symptomName }); } catch (e) { /* ignore */ }

      // Auto-suggest diagnosis and medications based on symptom
      try {
        const response = await api.get(`/api/symptom-medications/suggestions?symptoms=${encodeURIComponent(s)}`);

        // Backend returns { diagnoses: [...], medications: [...], flatList: [...] }
        const _dxFromApi = response.data?.diagnoses || response.data?.diagnosis || [];
        const medsFromApi = response.data?.flatList || response.data?.medications || [];

        // Auto-diagnosis suggestions disabled

        // Show medication suggestions in modal instead of auto-adding
        if (Array.isArray(medsFromApi) && medsFromApi.length > 0) {
          // Filter out medications that are already added AND remove duplicates from suggestions
          const uniqueMeds = [];
          const seenMeds = new Set();

          medsFromApi.forEach(med => {
            // Create a unique key for this medication
            const medKey = `${(med.name || '').toLowerCase().trim()}|${(med.brand || '').toLowerCase().trim()}|${(med.composition || '').toLowerCase().trim()}`;
            
            // Skip if already seen in suggestions or already added to prescription
            if (!seenMeds.has(medKey) && !meds.some(m => {
              const existingKey = `${(m.name || '').toLowerCase().trim()}|${(m.brand || '').toLowerCase().trim()}|${(m.composition || '').toLowerCase().trim()}`;
              return existingKey === medKey;
            })) {
              seenMeds.add(medKey);
              uniqueMeds.push(med);
            }
          });

          if (uniqueMeds.length > 0) {
            // Normalize keys expected by UI
            const normalized = uniqueMeds.map(m => ({
              name: m.name || m.medication_name,
              brand: m.brand || m.name || m.medication_name,
              composition: m.composition || '',
              dosage: m.dosage || m.strength || '',
              frequency: m.frequency || '1-0-1',
              duration: m.duration || '7 days',
              timing: m.timing,
              route: m.route,
              id: m.medicine_id || m.id
            }));

            // Store suggestions and show modal
            setPendingMedicationSuggestions(normalized);
            setShowMedicationSuggestionModal(true);
            addToast(`${normalized.length} medication(s) suggested for ${s}`, 'info');
          }
        }

        // Auto-diagnosis from ICD suggestions disabled
      } catch (error) {
        console.error('Error fetching medication suggestions:', error);
        // Silently fail - don't interrupt the doctor's workflow
      }
    }
    setSymptomInput('');
    setSymptomDropdown(false);
  };

  // Handle accepting medication suggestions
  const handleAcceptMedicationSuggestions = (selectedMeds) => {
    const defaultTiming = (timingOptions[language] || timingOptions.en)[0];
    
    selectedMeds.forEach(med => {
      const rawInstr = med.instructions || '';
      const resolvedTiming = translateTiming(med.timing, language) || med.timing || defaultTiming;
      const translatedInstr = translateInstruction(rawInstr, language) || rawInstr;
      const shouldAuto = !translatedInstr;
      const medObj = {
        name: med.name,
        brand: med.brand || med.name,
        strength: med.strength || '',
        dosage_form: med.dosage_form || '',
        frequency: med.frequency || '1-0-1',
        timing: resolvedTiming,
        duration: med.duration || '7 days',
        instructions: shouldAuto
          ? generateAutoInstructions(med.frequency || '1-0-1', resolvedTiming, language, translateTiming, med.duration || '7 days', med.dosage || '', med.dosage_form || '')
          : translatedInstr,
        auto_instructions: shouldAuto,
        qty: 7
      };
      setMeds((prev) => [...prev, medObj]);
    });

    setShowMedicationSuggestionModal(false);
    setPendingMedicationSuggestions([]);
    addToast(`${selectedMeds.length} medication(s) added`, 'success');
  };

  const _removeSymptom = (idx) => {
    setSymptoms((prev) => prev.filter((_, i) => i !== idx));
  };

  const _copySymptom = (s) => {
    navigator.clipboard.writeText(s);
    addToast('Copied to clipboard', 'success');
  };

  // Apply symptoms template
  const applySymptomTemplate = async (template) => {
    try {
      const templateSymptoms = Array.isArray(template.symptoms)
        ? template.symptoms
        : JSON.parse(template.symptoms || '[]');

      // Add template symptoms to existing symptoms (avoid duplicates)
      const newSymptoms = [...symptoms];
      const addedSymptoms = [];

      templateSymptoms.forEach(symptom => {
        if (!newSymptoms.includes(symptom)) {
          newSymptoms.push(symptom);
          addedSymptoms.push(symptom);
        }
      });

      setSymptoms(newSymptoms);
      setShowTemplateSelector(false);
      addToast(`Applied template: ${template.name}`, 'success');

      // Auto-suggest diagnosis/medications disabled
    } catch (error) {
      console.error('Error applying template:', error);
      addToast('Failed to apply template', 'error');
    }
  };

  // ========================================
  // Diagnosis Handlers
  // ========================================
  const addDiagnosis = (d) => {
    if (!d) return;
    const label = typeof d === 'string' ? d : (d.label || d.diagnosis_name || d.name || '');
    const icd_code = typeof d === 'object' ? (d.code || d.icd_code || '') : '';

    if (!label) return;
    
    // Check if diagnosis already exists (by label)
    const alreadyExists = diagnoses.some(dx => {
      const dxLabel = typeof dx === 'string' ? dx : (dx.label || '');
      return dxLabel.toLowerCase() === label.toLowerCase();
    });
    
    if (!alreadyExists) {
      const diagnosisObj = icd_code ? { label, code: icd_code } : { label };
      setDiagnoses((prev) => [...prev, diagnosisObj]);
      try { api.post('/api/diagnoses', { diagnosis_name: label, icd_code: icd_code || null }); } catch (e) { /* ignore */ }
    }
    setDiagnosisInput('');
    setDiagnosisDropdown(false);
  };

  const _removeDiagnosis = (idx) => {
    setDiagnoses((prev) => prev.filter((_, i) => i !== idx));
  };

  const _copyDiagnosis = (d) => {
    navigator.clipboard.writeText(d);
    addToast('Copied to clipboard', 'success');
  };

  // Apply diagnosis template
  const applyDiagnosisTemplate = (template) => {
    try {
      const templateDiagnoses = Array.isArray(template.diagnoses)
        ? template.diagnoses
        : JSON.parse(template.diagnoses || '[]');

      // Add template diagnoses to existing diagnoses (avoid duplicates)
      const newDiagnoses = [...diagnoses];
      templateDiagnoses.forEach(diagnosis => {
        const diagString = typeof diagnosis === 'string' ? diagnosis : (diagnosis.label || '');
        const alreadyExists = newDiagnoses.some(d => {
          const dLabel = typeof d === 'string' ? d : (d.label || '');
          return dLabel.toLowerCase() === diagString.toLowerCase();
        });
        if (!alreadyExists) {
          newDiagnoses.push(diagnosis);
        }
      });

      setDiagnoses(newDiagnoses);
      setShowDiagnosisTemplateSelector(false);
      addToast(`Applied template: ${template.name}`, 'success');
    } catch (error) {
      console.error('Error applying diagnosis template:', error);
      addToast('Failed to apply template', 'error');
    }
  };

  // Handle ICD code selection - fetch related symptoms, diagnoses, and medications
  const _handleIcdSelect = async (icdCode, _icdTitle) => {
    try {
      // Fetch related data for this ICD code
      const response = await api.get(`/api/icd/${icdCode}/related`, {
        params: { limit: 20 }
      });

      const relatedData = response.data?.data || response.data || {};

      // Add related symptoms
      if (relatedData.symptoms && Array.isArray(relatedData.symptoms)) {
        const newSymptoms = relatedData.symptoms.filter(s => !symptoms.includes(s));
        if (newSymptoms.length > 0) {
          setSymptoms(prev => [...prev, ...newSymptoms]);
          addToast(`${newSymptoms.length} symptom(s) added for ${icdCode}`, 'info');
        }
      }

      // Add related diagnoses
      if (relatedData.diagnoses && Array.isArray(relatedData.diagnoses)) {
        const newDiagnoses = relatedData.diagnoses.filter(d => {
          const dLower = (d || '').toLowerCase();
          return !diagnoses.some(dx => {
            const dxLabel = typeof dx === 'string' ? dx : (dx.label || '');
            return dxLabel.toLowerCase() === dLower;
          });
        });
        if (newDiagnoses.length > 0) {
          setDiagnoses(prev => [...prev, ...newDiagnoses]);
          addToast(`${newDiagnoses.length} diagnosis/diagnoses added for ${icdCode}`, 'info');
        }
      }

      // Add related medications
      if (relatedData.medications && Array.isArray(relatedData.medications)) {
        const uniqueMeds = [];
        const seenMeds = new Set();

        relatedData.medications.forEach(med => {
          const medKey = `${(med.name || '').toLowerCase().trim()}|${(med.brand || '').toLowerCase().trim()}|${(med.composition || '').toLowerCase().trim()}`;
          
          if (!seenMeds.has(medKey) && !meds.some(m => {
            const existingKey = `${(m.name || '').toLowerCase().trim()}|${(m.brand || '').toLowerCase().trim()}|${(m.composition || '').toLowerCase().trim()}`;
            return existingKey === medKey;
          })) {
            seenMeds.add(medKey);
            uniqueMeds.push(med);
          }
        });

        if (uniqueMeds.length > 0) {
          setPendingMedicationSuggestions(uniqueMeds);
          setShowMedicationSuggestionModal(true);
          addToast(`${uniqueMeds.length} medication(s) suggested for ${icdCode}`, 'info');
        }
      }
    } catch (error) {
      console.error('Error fetching ICD related data:', error);
      // Silently fail - ICD selection still works even if related data fetch fails
    }
  };

  // ========================================
  // Medication Handlers
  // ========================================
  const _addEmptyMed = () => {
    const defaultTiming = (timingOptions[language] || timingOptions.en)[0];
    const medObj = {
      name: '',
      brand: '',
      composition: '',
      frequency: '',
      timing: defaultTiming,
      duration: '',
      instructions: '',
      qty: 7
    };
    setMeds(prev => [...prev, medObj]);
  };

  const addMed = async (med) => {
    if (!med) return;
    const defaultTiming = (timingOptions[language] || timingOptions.en)[0];

    const baseMed = typeof med === 'string'
      ? { name: med, brand: med, composition: '' }
      : { ...med };

    // For consolidated DB medicines: name = brand name, brand = manufacturer
    // Fix: use name as the primary display name, combine both compositions
    if (baseMed.short_composition1 || baseMed.short_composition2) {
      baseMed.composition = [baseMed.short_composition1, baseMed.short_composition2]
        .map(c => (c || '').trim()).filter(Boolean).join(' + ');
    }
    // Map form → dosage_form if not already set
    if (!baseMed.dosage_form && baseMed.form && baseMed.form !== 'allopathy') {
      baseMed.dosage_form = baseMed.form;
    }

    // Try to fetch dosage defaults.
    // FIX (2026-07-11): custom medicines saved from Medicine Master carry
    // default_frequency/default_timing/default_duration/default_instructions.
    // These were never read here, so a doctor's saved defaults were ignored and
    // the row fell back to system defaults. Read default_* first (personal
    // doctor defaults fetched below still override them).
    let _dosage = '';
    let frequency = baseMed.default_frequency || baseMed.recommended_frequency || '1-0-1';
    let duration = baseMed.default_duration || baseMed.recommended_duration || '7 days';
    let _route = '';
    let qty = 7;

    // A frequency/duration the doctor typed into Medicine Master is an explicit
    // decision about THIS medicine. The shared dosage_references lookup below is
    // generic reference data, and it used to overwrite those values — so a
    // medicine created with, say, 1-0-0 came back as something else the moment
    // it was searched in the pad. Lock the explicitly-set fields against the
    // reference tables; the doctor's OWN saved defaults may still override.
    const masterSetFrequency = Boolean(baseMed.default_frequency);
    const masterSetDuration = Boolean(baseMed.default_duration);

    // If med already has dosage data from dosage_references (via search)
    if (baseMed.standard_dosage) {
      _dosage = baseMed.standard_dosage;
      if (!masterSetFrequency) frequency = baseMed.recommended_frequency || frequency;
      if (!masterSetDuration) duration = baseMed.recommended_duration || duration;
    }

    // Try to fetch dosage from dosage_references by medicine name
    // For consolidated DB: name = the actual medicine/brand name; brand = manufacturer (skip it)
    const medName = baseMed.name || baseMed.medication_name || baseMed.brand || '';
    try {
      if (medName) {
        const resp = await api.get('/api/medicines/dosage', {
          params: { name: medName }
        });
        const dosageInfo = resp.data?.dosage;
        if (dosageInfo) {
          _dosage = dosageInfo.standard_dosage || _dosage;
          if (!masterSetFrequency) frequency = dosageInfo.recommended_frequency || frequency;
          if (!masterSetDuration) duration = dosageInfo.recommended_duration || duration;
          _route = dosageInfo.route_of_administration || _route;
        }
      }
    } catch (e) {
      // Fallback: try medicine defaults by id
      try {
        if (baseMed.id) {
          const resp = await api.get(`/api/medicines/${baseMed.id}/defaults`);
          const defs = resp.data?.defaults || {};
          _dosage = defs.dosage || _dosage;
          if (!masterSetFrequency) frequency = defs.frequency || frequency;
          if (!masterSetDuration) duration = defs.duration || duration;
          _route = defs.route || _route;
        }
      } catch (e2) {
        // ignore
      }
    }

    // Try to fetch doctor's custom defaults (highest priority - overrides system defaults)
    let customTiming = '';
    let customInstructions = '';
    try {
      if (medName) {
        const resp = await api.get('/api/medicines/my-defaults', { params: { name: medName } });
        const defs = resp.data?.defaults;
        if (defs) {
          _dosage = defs.dosage || _dosage;
          frequency = defs.frequency || frequency;
          duration = defs.duration || duration;
          customTiming = defs.timing || '';
          customInstructions = defs.instructions || '';
          if (defs.quantity) qty = defs.quantity;
        }
      }
    } catch (e) { /* ignore */ }

    // Estimate quantity
    const perDay = parseFrequency(frequency);
    const days = parseDurationDays(duration);
    if (perDay && days) qty = perDay * days;

    // Determine timing and instructions, then translate if non-English language
    // For non-oral forms (cream/gel/injection/IV/inhaler), meal-based timing is not relevant
    const dfAddLower = (baseMed.dosage_form || '').toLowerCase();
    const isNonOralForm = /cream|ointment|gel|lotion|paste|topical|injection|inj|^iv$|^im$|^sc$|intravenous|intramuscular|subcutaneous|inhaler|inhale|nebulizer|spray/.test(dfAddLower);
    let finalTiming = isNonOralForm ? '' : (customTiming || baseMed.default_timing || baseMed.timing || defaultTiming);
    let finalInstructions = customInstructions || baseMed.default_instructions || baseMed.instructions || '';
    let useAutoInstructions = !finalInstructions;
    if (language && language !== 'en') {
      const translatedT = translateTiming(finalTiming, language);
      if (translatedT) finalTiming = translatedT;
      if (finalInstructions) {
        const translatedI = translateInstruction(finalInstructions, language);
        // If translation found (different from original), use it; otherwise auto-generate
        if (translatedI && translatedI !== finalInstructions) {
          finalInstructions = translatedI;
        } else if (!customInstructions) {
          // DB instruction can't be translated - fall back to auto-generated
          finalInstructions = '';
          useAutoInstructions = true;
        }
      }
    }

    const medObj = {
      name: medName,
      brand: baseMed.brand || '',
      generic_name: baseMed.name || baseMed.generic_name || baseMed.composition || '',
      composition: baseMed.composition || baseMed.generic_name || '',
      strength: baseMed.strength || '',
      dosage_form: baseMed.dosage_form || '',
      manufacturer_name: baseMed.manufacturer_name || '',
      source: baseMed.source || '',
      dosage: (() => {
        // Use doctor's saved default dose, or smart default from dosage_form
        if (_dosage && /\d/.test(_dosage) && !/mg|mcg|gm|ml.*\d{2,}/.test(_dosage)) return _dosage;
        const form = (baseMed.dosage_form || '').toLowerCase();
        if (form.includes('syrup') || form.includes('liquid') || form.includes('suspension')) return '5 ml';
        if (form.includes('drops')) return '2 drops';
        if (form.includes('inhaler') || form.includes('spray')) return '2 puffs';
        if (form.includes('sachet')) return '1 sachet';
        if (form.includes('capsule')) return '1 cap';
        if (form.includes('cream') || form.includes('ointment') || form.includes('gel')) return 'apply';
        return '1 tab';
      })(),
      frequency,
      timing: finalTiming,
      duration,
      start_from: '',
      instructions: finalInstructions || generateAutoInstructions(frequency, finalTiming, language, translateTiming, duration, (() => {
        if (_dosage && /\d/.test(_dosage) && !/mg|mcg|gm|ml.*\d{2,}/.test(_dosage)) return _dosage;
        const form = (baseMed.dosage_form || '').toLowerCase();
        if (form.includes('syrup') || form.includes('liquid') || form.includes('suspension')) return '5 ml';
        if (form.includes('drops')) return '2 drops';
        if (form.includes('inhaler') || form.includes('spray')) return '2 puffs';
        if (form.includes('sachet')) return '1 sachet';
        if (form.includes('capsule')) return '1 cap';
        return '1 tab';
      })(), baseMed.dosage_form || ''),
      auto_instructions: useAutoInstructions || !finalInstructions,
      qty
    };

    setMeds((prev) => [...prev, medObj]);
    setMedInput('');
    setMedDropdown(false);

    // Save custom medicine to database if it was typed manually (not from search).
    // FIX (2026-07-11): previously sent only {name, brand, is_active} — the backend
    // REQUIRES generic_name, so this silently failed AND never persisted the timing
    // the doctor set. Now we send generic_name plus the default_* fields from the row
    // just built, so a newly typed medicine remembers its timing/frequency/etc. and
    // the same values come back on the next search.
    if (typeof med === 'string') {
      try {
        await api.post('/api/medicines', {
          name: med,
          brand: med,
          generic_name: medObj.generic_name || med,
          is_active: 1,
          default_frequency: medObj.frequency || null,
          default_timing: medObj.timing || null,
          default_duration: medObj.duration || null,
          default_instructions: medObj.instructions || null,
        });
      } catch (e) {
        // Ignore if already exists or fails
      }
    }
  };

  // Add medicine with tapering enabled
  const addTaperMed = async (med) => {
    const defaultTiming = (timingOptions[language] || timingOptions.en)[0];
    const baseMed = typeof med === 'string' ? { name: med, brand: med } : { ...med };
    const medName = baseMed.brand || baseMed.name || '';
    let frequency = '1-0-0';
    let duration = '15 days';
    let dosage = '';
    try {
      if (medName) {
        const resp = await api.get('/api/medicines/dosage', { params: { name: medName } });
        const d = resp.data?.dosage;
        if (d) { dosage = d.standard_dosage || ''; frequency = d.recommended_frequency || frequency; duration = d.recommended_duration || duration; }
      }
    } catch (e) { /* ignore */ }
    setMeds(prev => [...prev, {
      name: medName,
      brand: baseMed.brand || '',
      generic_name: baseMed.name || baseMed.generic_name || baseMed.composition || '',
      composition: baseMed.composition || baseMed.generic_name || '',
      strength: baseMed.strength || '',
      dosage_form: baseMed.dosage_form || '',
      manufacturer_name: baseMed.manufacturer_name || '',
      source: baseMed.source || '',
      frequency, timing: defaultTiming, duration,
      instructions: '', qty: '',
      is_tapering: true,
      tapering_schedule: [
        { step_number: 1, dose: dosage || '10 mg', frequency: 'Once daily', duration_days: 5 },
        { step_number: 2, dose: '5 mg', frequency: 'Once daily', duration_days: 5 },
        { step_number: 3, dose: '2.5 mg', frequency: 'Once daily', duration_days: 5 }
      ]
    }]);
    setShowTaperInput(false);
    setTaperMedInput('');
    setTaperMedResults([]);
  };

  // Search medicines for tapering input
  const searchTaperMeds = useCallback(async (query) => {
    if (!query || query.length < 2) { setTaperMedResults([]); return; }
    setTaperMedLoading(true);
    try {
      const resp = await api.get('/api/medicines/search', { params: { q: query, limit: 15 } });
      setTaperMedResults(resp.data?.medicines || resp.data?.results || resp.data || []);
    } catch (e) { setTaperMedResults([]); }
    setTaperMedLoading(false);
  }, []);

  const removeMed = (idx) => {
    setMeds((prev) => prev.filter((_, i) => i !== idx));
  };

  const _updateMed = (idx, field, value) => {
    setMeds((prev) => {
      const updated = [...prev];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], [field]: value };
      }
      return updated;
    });
  };

  // Search medications from database (replaces hardcoded list)
  const searchMedications = useCallback(async (query) => {
    if (!query || query.length < 1) {
      setMedicationSuggestions([]);
      return;
    }

    try {
      _setMedicationLoading(true);
      const response = await api.get('/api/medicines/search', {
        params: { q: query, limit: 500 }
      });

      // Handle response format: { medicines: [...] } or ApiResponse wrapper { data: { medicines: [...] } }
      const meds = response.data?.data?.medicines || response.data?.medicines || response.data?.medications || response.data?.items || [];
      setMedicationSuggestions(Array.isArray(meds) ? meds.map(m => ({
        id: m.id,
        name: m.name || m.medication_name || '',
        brand: m.brand || m.brand_name || '',
        manufacturer_name: m.manufacturer_name || m.manufacturer || '',
        composition: m.generic_name || m.active_ingredient || '',
        strength: m.strength || '',
        dosage_form: m.dosage_form || '',
        source: m.source || 'local',
        standard_dosage: m.standard_dosage,
        recommended_frequency: m.recommended_frequency,
        recommended_duration: m.recommended_duration,
        available: true
      })) : []);
    } catch (err) {
      console.error('Medication search error:', err);
      setMedicationSuggestions([]);
    } finally {
      _setMedicationLoading(false);
    }
  }, [api]);

  // Fetch frequently prescribed medications for this patient
  const fetchFrequentlyPrescribedMeds = useCallback(async () => {
    if (!patientId) return;

    try {
      const response = await api.get(`/api/medicines/patient/${patientId}/recent`, {
        params: { limit: 10 }
      });

      const meds = response.data.medications || response.data.items || response.data || [];
      setFrequentlyPrescribedMeds(Array.isArray(meds) ? meds : []);
    } catch (err) {
      console.error('Failed to fetch frequently prescribed medications:', err);
      setFrequentlyPrescribedMeds([]);
    }
  }, [api, patientId]);

  // Load frequently prescribed meds when patient loads
  useEffect(() => {
    if (patientId) {
      fetchFrequentlyPrescribedMeds();
    }
  }, [patientId, fetchFrequentlyPrescribedMeds]);

  // Fetch frequently used diagnoses for this doctor (Eka Care "FREQUENTLY seen by you")
  useEffect(() => {
    api.get('/api/diagnoses/frequently-used', { params: { limit: 10 } })
      .then(res => {
        const list = res.data?.data?.diagnoses || res.data?.diagnoses || [];
        setFrequentlyUsedDiagnoses(list);
      })
      .catch(() => setFrequentlyUsedDiagnoses([]));
  }, [api]);

  // Search medications with debounce
  useEffect(() => {
    if (medInput.length < 1) {
      setMedicationSuggestions([]);
      return;
    }

    const debounceTimer = setTimeout(() => {
      searchMedications(medInput);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [medInput, searchMedications]);

  // Apply medications template
  const applyMedicationsTemplate = (template) => {
    try {
      const templateMeds = Array.isArray(template.medications)
        ? template.medications
        : JSON.parse(template.medications || '[]');

      // Add template medications to existing medications (avoid duplicates)
      templateMeds.forEach(med => {
        const alreadyExists = meds.some(m =>
          m.name === med.name || m.brand === med.brand
        );

        if (!alreadyExists) {
          // Normalize timing
          let normalizedTiming = med.timing;
          if (typeof med.timing === 'string') {
            normalizedTiming = { type: med.timing, time: null };
          } else if (!med.timing) {
            const defaultTiming = (timingOptions[language] || timingOptions.en)[0];
            normalizedTiming = { type: defaultTiming, time: null };
          }

          const medObj = {
            name: med.name || med.medication_name || '',
            brand: med.brand || med.brand_name || med.name || '',
            composition: med.composition || '',
            dosage: med.dosage || '',
            dosage_form: med.dosage_form || '',
            strength: med.strength || '',
            frequency: med.is_tapering ? 'Tapering' : (med.frequency || '1-0-1'),
            timing: normalizedTiming,
            duration: med.duration || '7 days',
            instructions: med.instructions || '',
            qty: med.qty || med.quantity || 7,
            is_tapering: med.is_tapering ? true : false,
            tapering_schedule: med.is_tapering && Array.isArray(med.tapering_schedule)
              ? med.tapering_schedule
              : []
          };
          setMeds((prev) => [...prev, medObj]);
        }
      });

      setShowMedicationsTemplateSelector(false);
      addToast(`Applied template: ${template.name}`, 'success');
    } catch (error) {
      console.error('Error applying medications template:', error);
      addToast('Failed to apply template', 'error');
    }
  };

  // ========================================
  // Advice Handlers
  // ========================================
  const _toggleAdvice = (adv) => {
    setSelectedAdvice((prev) =>
      prev.includes(adv) ? prev.filter(a => a !== adv) : [...prev, adv]
    );
  };

  const _formatAdvice = (command) => {
    const editor = adviceEditorRef.current;
    if (!editor) return;
    document.execCommand(command, false, null);
    editor.focus();
  };

  // ========================================
  // Follow-up Handler
  // ========================================
  const _handleFollowUpDaysChange = (days) => {
    const daysStr = (typeof days === 'string' ? days : String(days || ''));
    setFollowUp({
      ...followUp,
      days: daysStr,
      date: daysStr ? calculateFollowUpDate(daysStr) : ''
    });
  };

  // ========================================
  // Specialty Module Handlers
  // ========================================
  const handleSpecialtyDataChange = (data) => {
    setSpecialtyData(data);
    // console.log('Specialty data updated:', data);
  };

  // ========================================
  // Repeat Prescription Handler
  // ========================================
  const _handleRepeatSuccess = (prescriptionData) => {
    // Populate form with repeated prescription data
    if (prescriptionData.prescription) {
      const rx = prescriptionData.prescription;

      // Set symptoms
      if (rx.symptoms) {
        const sx = Array.isArray(rx.symptoms) ? rx.symptoms : [rx.symptoms];
        const mapped = sx
          .map((s) => {
            if (!s) return null;
            if (typeof s === 'string') return { name: s, remarks: '' };
            if (typeof s === 'object') return { name: s.name || s.term || '', remarks: s.remarks || '' };
            return null;
          })
          .filter((s) => s && s.name);
        setSymptoms(mapped);
      }

      // Set diagnoses
      if (rx.diagnosis) {
        setDiagnoses(normalizeDiagnosisList(rx.diagnosis).filter(Boolean));
      }

      // Set medications
      if (rx.medications && Array.isArray(rx.medications)) {
        setMeds(rx.medications.map(med => ({
          name: med.medication_name || med.name,
          medication_name: med.medication_name || med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          instructions: translateInstruction(med.instructions, language) || med.instructions,
          timing: translateTiming(med.timing, language) || med.timing,
          is_tapering: med.is_tapering || 0,
          tapering_schedule: med.tapering_schedule || []
        })));
      }

      // Set advice
      if (rx.advice) {
        setAdvice(rx.advice);
      }

      // Set follow up
      if (rx.follow_up_days) {
        setFollowUp(prev => ({
          ...prev,
          days: String(typeof rx.follow_up_days === 'object' ? (rx.follow_up_days?.days || '') : rx.follow_up_days || ''),
          date: rx.follow_up_date || prev.date
        }));
      } else if (rx.follow_up_date) {
        setFollowUp(prev => ({ ...prev, date: rx.follow_up_date }));
      }

      if (rx.patient_notes) setPatientNotes(rx.patient_notes);
      if (rx.private_notes) setPrivateNotes(rx.private_notes);

      // Set lab advice + per-tag remarks
      if (rx.lab_advice) setLabAdvice(rx.lab_advice);
      if (rx.lab_remarks) {
        let freeText = rx.lab_remarks || '';
        let tagRemarks = {};
        if (freeText.startsWith('__TAG_REMARKS__:')) {
          const nlIdx = freeText.indexOf('\n');
          const jsonStr = nlIdx >= 0 ? freeText.slice(16, nlIdx) : freeText.slice(16);
          try { tagRemarks = JSON.parse(jsonStr); } catch (e) { console.debug('tagRemarks JSON parse failed', e.message); }
          freeText = nlIdx >= 0 ? freeText.slice(nlIdx + 1) : '';
        }
        setLabAdviceRemarks(tagRemarks);
        setLabRemarks(freeText);
      }

      // Set vitals if available
      if (rx.vitals) {
        setVitals(rx.vitals);
      }

      addToast('Last prescription loaded successfully! Review and modify as needed.', 'success');
    }
  };

  // ========================================
  // Save Prescription
  // ========================================
  const handleSave = async () => {
    // Prevent concurrent saves from rapid button clicks
    if (savingInProgress.current) return;
    savingInProgress.current = true;

    try {
      if (!meta.patient_id) {
        addToast('Patient ID is required', 'error');
        return;
      }

      const parsedPatientId = parseInt(meta.patient_id, 10);
      if (Number.isNaN(parsedPatientId)) {
        addToast('Invalid patient ID. Please select a patient from the queue or patients list.', 'error');
        return;
      }

      setIsLoading(true);
      try {
      // Get doctor_id - with fallback
      let doctorId = meta.doctor_id;

      if (!doctorId) {
        try {
          const docRes = await api.get('/api/doctors');
          if (docRes.data.doctors && docRes.data.doctors.length > 0) {
            doctorId = docRes.data.doctors[0].id;
            setMeta(prev => ({ ...prev, doctor_id: doctorId }));
          }
        } catch (err) {
          console.error('Failed to get doctor:', err);
        }
      }

      // Prepare medications data — medicines first, injections last
      const sortedMeds = [...meds.filter(m => m.type !== 'injection'), ...meds.filter(m => m.type === 'injection')];
      const medicationsData = sortedMeds.map(m => ({
        medication_name: m.name || m.medication_name || m.medicine_name || m.brand || '',
        brand_name: m.brand || m.name || '',
        dosage: m.dosage || '',
        frequency: m.is_tapering ? 'Tapering' : (m.frequency || ''),
        duration: m.duration || '',
        instructions: m.instructions || '',
        // m.timing is {type, time} in UI state — the DB column is plain text,
        // so send the extracted type (e.g. "After Meal"), not the raw object,
        // or it gets JSON.stringified and prints as raw JSON on the PDF.
        timing: (m.timing && typeof m.timing === 'object' ? m.timing.type : m.timing) || '',
        quantity: m.qty || 0,
        is_tapering: m.is_tapering ? 1 : 0,
        tapering_schedule: m.is_tapering && m.tapering_schedule ? m.tapering_schedule.map((s, i) => ({
          step_number: i + 1,
          dose: s.dose || '',
          frequency: s.frequency || '',
          duration_days: parseInt(s.duration_days, 10) || 1
        })) : []
      }));

      // Prepare request body
      const requestBody = {
        patient_id: parsedPatientId,
        doctor_id: doctorId || null,  // Backend will handle fallback
        appointment_id: meta.appointment_id ? parseInt(meta.appointment_id) : null,
        template_id: selectedTemplateId || null,  // Letterhead template
        medications: medicationsData,
        symptoms: symptoms.map(s => typeof s === 'object' ? (s.remarks ? `${s.name} - ${s.remarks}` : s.name) : s),
        diagnosis: diagnoses.map(d => {
          if (typeof d === 'string') return d;
          const label = d.label || d.icd_title || '';
          const code = d.code || '';
          return code ? `${label} - ${code}` : label;
        }),
        vitals: {
          temp: vitals.temp || null,
          height: vitals.height || null,
          weight: vitals.weight || null,
          pulse: vitals.pulse || null,
          bmi: vitals.bmi || null,
          blood_pressure: vitals.blood_pressure || null,
          spo2: vitals.spo2 || null
        },
        advice: advice + (selectedAdvice.length > 0 ? '\n' + selectedAdvice.join('\n') : ''),
        follow_up_days: followUp.days ? parseInt(followUp.days) : null,
        follow_up_date: followUp.date || null,
        patient_notes: patientNotes || '',
        private_notes: (() => {
          const base = privateNotes || '';
          const examText = (generalExamination || '').trim();
          if (!examText) return base;
          const marker = '[EXAM_FINDINGS]';
          if (base.includes(marker)) return base;
          return `${base ? base + '\n\n' : ''}${marker}\n${examText}`;
        })(),
        lab_advice: labAdvice || '',
        lab_remarks: (() => {
          const tagRemarksJson = Object.keys(labAdviceRemarks).length > 0 ? JSON.stringify(labAdviceRemarks) : '';
          const prefix = tagRemarksJson ? `__TAG_REMARKS__:${tagRemarksJson}\n` : '';
          return prefix + (labRemarks || '');
        })(),
        examination_findings: {
          general: generalExamination || '',
          systemic: systemicExamination || ''
        },
        custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : null
      };

      // console.log('Saving prescription:', requestBody);

      const response = await api.post('/api/prescriptions', requestBody, { timeout: 60000 });
      
      // console.log('Prescription saved:', response.data);
      addToast('Prescription saved successfully', 'success');

      // The visit's work is now persisted server-side — drop the local draft so
      // it can't be auto-restored into this patient's next visit.
      clearDraft();

      // Vitals are persisted by POST /api/prescriptions itself (linked to the
      // appointment). A second write here just created a duplicate row — and,
      // because it sent `temperature` instead of `temp`, one with a blank
      // temperature that then won the "latest reading" tie-break on the PDF.

      // Save lab results to patient's lab record for bidirectional sync
      try {
        if (labResultEntries.length > 0) {
          for (const lab of labResultEntries) {
            // Skip entries already saved to DB (have an id) to avoid duplicates
            if (lab.id) continue;
            if (lab.result_value && lab.test_name) {
              await api.post(`/api/labs/${parsedPatientId}`, {
                test_name: lab.test_name,
                result_value: lab.result_value,
                result_unit: lab.result_unit || '',
                reference_range: lab.reference_range || '',
                test_category: lab.category || 'GENERAL',
                result_date: lab.date || getLocalDateString(),
                report_group: 'Prescription'
              });
            }
          }
          // console.log('Lab results synced to patient overview:', labResultEntries.length);
          // Trigger refresh in PatientOverview by emitting a custom event
          window.dispatchEvent(new CustomEvent('patientDataRefresh', { detail: { patientId: parsedPatientId } }));
        }
      } catch (labErr) {
        console.warn('Could not sync lab results to patient record:', labErr);
        // Don't fail the prescription save if lab sync fails
      }

      // Store prescription ID for PDF download
      if (response.data?.id) {
        setCurrentPrescriptionId(response.data.id);
      }

      // Save ICD diagnoses if selected
      try {
        if (response.data?.id && selectedIcds.length > 0) {
          await api.post(`/api/prescriptions/detail/${response.data.id}/diagnoses`, selectedIcds);
          addToast('Diagnoses (ICD) saved', 'success');
        }
      } catch (e) {
        console.error('Failed to save ICD diagnoses:', e);
        addToast('Prescription saved, but ICD diagnoses could not be saved', 'warning');
      }

      // Save medicine defaults for future suggestions (fire-and-forget)
      try {
        for (const m of meds) {
          api.post('/api/medicines/defaults', {
            medicine_name: m.name || m.brand,
            dosage: m.dosage || null,
            frequency: m.frequency || null,
            duration: m.duration || null,
            timing: m.timing || null,
            instructions: m.instructions || null,
            quantity: m.qty || null
          }).catch(() => {});
        }
      } catch (e) { /* ignore */ }

        return response.data;
      } catch (error) {
        console.error('Save error:', error);
        const payload = error.response?.data;
        const extra = payload?.sqlMessage || payload?.code || payload?.details;
        const base = payload?.error || payload?.details || 'Failed to save prescription';
        const errorMsg = extra && extra !== base ? `${base} (${extra})` : base;
        addToast(errorMsg, 'error');
        throw error;
      } finally {
        setIsLoading(false);
      }
    } finally {
      savingInProgress.current = false;
    }
  };

  // Lets handlePrintClick (defined far above) save an unsaved pad before
  // opening the server-rendered PDF, without pulling handleSave into its deps.
  handleSaveRef.current = handleSave;

  // ========================================
  // Finish Visit
  // ========================================
  const handleFinish = async () => {
    try {
      // Step 1: Save the prescription
      await handleSave();

      // Step 2: Complete the visit RIGHT NOW (2026-07-16 workflow change):
      // sending the prescription is what finishes a consultation — the bill
      // is optional and no longer gates completion.
      let visitCompleted = false;
      if (meta.appointment_id) {
        try {
          await api.patch(`/api/appointments/${meta.appointment_id}/status`, { status: 'completed' });
          visitCompleted = true;
        } catch (e) {
          if (e?.response?.status === 404) visitCompleted = true; // row already gone/closed
          else console.error('Failed to mark appointment completed:', e);
        }
      }
      if (meta.queue_id) {
        try {
          await api.patch(`/api/queue/${meta.queue_id}/status`, { status: 'completed' });
          visitCompleted = true;
        } catch (e) {
          if (e?.response?.status === 404) visitCompleted = true;
          else console.error('Failed to mark queue entry completed:', e);
        }
      }

      // Hand off to Queue: it auto-opens the bill editor as a convenience
      // (saving is optional), and completes the visit as a FALLBACK only when
      // we couldn't do it here (visit_completed: false, e.g. no ids in context).
      sessionStorage.setItem('pendingVisitCompletion', JSON.stringify({
        patient_id: patientId,
        appointment_id: meta.appointment_id || null,
        queue_id: meta.queue_id || null,
        visit_completed: visitCompleted,
        source: 'prescription-pad',
        created_at: Date.now()
      }));

      addToast(
        visitCompleted
          ? 'Prescription sent — visit completed. Bill can be created in Queue (optional).'
          : 'Prescription saved. Visit will be completed in Queue.',
        'success'
      );

      // Return to Queue where the (optional) bill editor will auto-open.
      navigate('/queue');
    } catch (error) {
      console.error('Finish error:', error);
      // Error already shown in handleSave
    }
  };

  // ========================================
  // Clear Form
  // ========================================
  const handleClear = () => {
    setSymptoms([]);
    setDiagnoses([]);
    setMeds([]);
    setAdvice('');
    setLabAdvice('');
    setLabAdviceRemarks({});
    setLabAdviceInput('');
    setPatientNotes('');
    setPrivateNotes('');
    setProcedures([]);
    setExamFindings([]);
    setVitals({ temp: '', height: '', bmi: '', weight: '', pulse: '', blood_pressure: '', spo2: '' });
    setFollowUp({ days: '', date: '', autoFill: false });
    setSelectedAdvice([]);
    setCustomFieldValues({});
    clearDraft();
    addToast('Prescription cleared', 'info');
  };

  // ========================================
  // Filtered Lists
  // ========================================
  // Note: filteredSymptoms is already defined above in component scope
  
  const filteredDiagnoses = diagnosisInput.length > 0
    ? diagnosisSuggestions.filter(d => 
        d.toLowerCase().startsWith(diagnosisInput.toLowerCase())
      )
    : diagnosisSuggestions.slice(0, 4);

  const combinedDiagnosisResults = (() => {
    const out = [];

    // 1) Backend results (Custom diagnoses first, then ICD-10 + ICD-11)
    for (const r of diagnosisSearchResults) {
      const label = r.diagnosis_name || r.code;
      if (!label) continue;
      out.push({ type: r.isCustom ? 'custom' : 'icd', label, code: r.code, description: r.description, version: r.version });
    }

    // 2) Quick suggestions (only if no ICD results or no input)
    if (out.length === 0) {
      for (const d of filteredDiagnoses) {
        out.push({ type: 'quick', label: d });
      }
    }

    // De-dup by label
    const seen = new Set();
    return out.filter(x => {
      const k = (x.label || '').toLowerCase().trim();
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  })();

  const filteredMeds = medInput.length > 0
    ? medicationSuggestions.filter(m =>
        (m.name || '').toLowerCase().includes(medInput.toLowerCase()) ||
        (m.brand || '').toLowerCase().includes(medInput.toLowerCase()) ||
        (m.composition || '').toLowerCase().includes(medInput.toLowerCase()) ||
        (m.manufacturer_name || '').toLowerCase().includes(medInput.toLowerCase())
      )
    : medicationSuggestions.slice(0, 10);

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="space-y-6 px-2 sm:px-4 pb-24 max-w-[1600px] mx-auto rx-pad-root">
      {/* Browser Ctrl+P support: the app's Print button uses react-to-print
          (isolated iframe), but users also print with Ctrl+P — which used to
          render the ENTIRE editing UI (grey panels) below the prescription.
          Hide every sibling of the print region in print media. */}
      <style>{`@media print { .rx-pad-root > *:not(.rx-print-region) { display: none !important; } }`}</style>
      {/* No Patient Selected - Show Search */}
      {!patient && !patientId && (
        <div className="bg-white border rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Select a Patient</h3>

          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search by name, UHID, or phone number..."
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={patientSearch}
              onChange={(e) => {
                setPatientSearch(e.target.value);
                searchPatients(e.target.value);
                setShowPatientSearch(true);
              }}
              autoComplete="off"
              onFocus={() => setShowPatientSearch(true)}
            />

            {/* Search Results Dropdown */}
            {showPatientSearch && patientResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-96 overflow-y-auto">
                {patientResults.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => handlePatientSelect(p)}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-gray-600">
                      UHID: {p.patient_id} • {p.phone} • {p.gender}, {calculateAge(p.dob)} years
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-center text-gray-600">
            <p className="mb-2">Or select from:</p>
            <div className="flex gap-3 justify-center">
              <Link to="/queue" className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">
                View Queue
              </Link>
              <Link to="/patients" className="px-4 py-2 border border-primary text-primary rounded hover:bg-primary/10">
                All Patients
              </Link>
            </div>
            </div>
            </div>
            )}

      {/* Patient Info Header */}
      {patient && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center shrink-0">
                {(patient.name || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">{patient.name}</h2>
                  <select className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white">
                    <option>{patient.name}</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{calculateAge(patient.dob)} yrs, {patient.gender || '-'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">UHID {patient.patient_id || '-'}</span>
                  {patient.phone && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{patient.phone}</span>}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    📅 {new Date(meta.prescription_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {meta.prescription_time}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="p-2 border border-gray-300 rounded-md text-slate-600 hover:bg-slate-50 hover:text-primary transition active:scale-[0.98]" title="Edit" onClick={() => {}}>
                <FiEdit3 />
              </button>
              <button type="button" className="p-2 border border-gray-300 rounded-md text-slate-600 hover:bg-slate-50 hover:text-primary transition active:scale-[0.98]" title="Video Call" onClick={() => {}}>
                <FiVideo />
              </button>
              <button type="button" className="p-2 border border-gray-300 rounded-md text-slate-600 hover:bg-slate-50 hover:text-primary transition active:scale-[0.98]" title="Link" onClick={() => {}}>
                <FiLink2 />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            <button
              type="button"
              onClick={() => navigate(`/patient-overview/${patientId}`)}
              className="px-4 py-2 text-sm rounded-t-md border-b-2 border-transparent text-slate-500 hover:text-primary hover:bg-slate-50 transition active:scale-[0.98]"
            >
              Patient Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('prescription')}
              className={`px-4 py-2 text-sm rounded-t-md border-b-2 font-medium transition active:scale-[0.98] ${
                activeTab === 'prescription' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-500 hover:text-primary hover:bg-slate-50'
              }`}
            >
              Prescription Pad
            </button>
            <button
              type="button"
              onClick={() => navigate('/rx-template')}
              className="px-4 py-2 text-sm rounded-t-md border-b-2 border-transparent text-slate-500 hover:text-primary hover:bg-slate-50 transition active:scale-[0.98]"
            >
              Templates
            </button>
            <button
              type="button"
              onClick={() => navigate('/pad-configuration')}
              className="px-4 py-2 text-sm rounded-t-md border-b-2 border-transparent text-slate-500 hover:text-primary hover:bg-slate-50 transition active:scale-[0.98]"
            >
              Configure your pad
            </button>
          </div>
        </div>
      )}

      {/* PHASE 1: Quick Templates Bar */}
      <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm">
        <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
              <span>🚀</span>
              Quick Templates
              <span className="text-xs font-normal text-blue-500">({customTemplates.length})</span>
            </h3>
            <button
              onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
              className="text-xs bg-blue-200 hover:bg-blue-300 text-blue-900 px-1.5 py-0.5 rounded transition"
              title="Show keyboard shortcuts"
            >
              ⌨️ Ctrl+T
            </button>
          </div>
        </div>

        {/* Keyboard Help */}
        {showKeyboardHelp && (
          <div className="mb-2 p-2 bg-white rounded border border-blue-300 text-sm">
            <div className="font-semibold mb-2 text-gray-900">Keyboard Shortcuts:</div>
            <div className="grid grid-cols-2 gap-2">
              <div><kbd className="bg-gray-200 px-2 py-1 rounded text-xs">Ctrl+T</kbd> Template</div>
              <div><kbd className="bg-gray-200 px-2 py-1 rounded text-xs">Ctrl+S</kbd> Save</div>
              <div><kbd className="bg-gray-200 px-2 py-1 rounded text-xs">Ctrl+P</kbd> Print</div>
              <div><kbd className="bg-gray-200 px-2 py-1 rounded text-xs">Ctrl+M</kbd> Medicine</div>
              <div><kbd className="bg-gray-200 px-2 py-1 rounded text-xs">Ctrl+L</kbd> Lab</div>
              <div><kbd className="bg-gray-200 px-2 py-1 rounded text-xs">Ctrl+Shift+C</kbd> Clear</div>
            </div>
          </div>
        )}

        {/* Searchable dropdown — same pattern as Quick Advice Selection.
            Type to filter, click to apply; custom templates get a delete (✕)
            on hover instead of a permanent chip on screen. */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition bg-white"
              placeholder="Search templates..."
              value={templateSearch}
              onChange={(e) => { setTemplateSearch(e.target.value); setShowQuickTemplateDropdown(true); }}
              onFocus={() => setShowQuickTemplateDropdown(true)}
              onBlur={() => setTimeout(() => setShowQuickTemplateDropdown(false), 150)}
            />
            {showQuickTemplateDropdown && (() => {
              const list = customTemplates.filter(t =>
                !templateSearch.trim() || (t.category || t.template_name || '').toLowerCase().includes(templateSearch.trim().toLowerCase())
              );
              return (
                <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border rounded shadow-lg">
                  {list.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">No matches</div>
                  ) : list.map((template) => {
                    const medications = typeof template.medications === 'string' ?
                      JSON.parse(template.medications) : template.medications || [];
                    const medCount = medications.length;
                    const isEmpty = medCount === 0;
                    return (
                      <div
                        key={template.id}
                        className="group flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-blue-50 border-b last:border-b-0 cursor-pointer"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          handleApplyTemplate(template.template_name);
                          setTemplateSearch('');
                          setShowQuickTemplateDropdown(false);
                        }}
                        title={isEmpty ? `"${template.template_name}" has no medicines yet` : `Apply "${template.template_name}" custom template`}
                      >
                        <span className={`flex items-center gap-1.5 truncate ${isEmpty ? 'text-gray-400' : ''}`}>
                          <span className={isEmpty ? 'grayscale opacity-60' : ''}>⭐</span>
                          <span className="truncate">{template.category || template.template_name}</span>
                        </span>
                        <span className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isEmpty ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-800'}`}>{medCount}</span>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => { e.stopPropagation(); handleDeleteCustomTemplate(template.id); }}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"
                            title="Delete custom template"
                          >
                            ✕
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Create New Template Button */}
          <button
            onClick={() => setShowCreateTemplateModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-md font-semibold transition hover:shadow-md shadow-sm text-sm flex items-center gap-1.5 flex-shrink-0"
            title="Save current prescription as custom template"
          >
            <span>➕</span>
            <span className="hidden sm:inline">Create Template</span>
          </button>
        </div>

        {/* Template Info */}
        <div className="mt-2 text-xs text-gray-500">
          💡 Search and click a template to instantly fill medicines, advice &amp; investigations.
        </div>
      </div>

      {/* Create Template Modal */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[94vh] flex flex-col">
            <div className="p-3 border-b flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-gray-800">Create New Template</h2>
              <button
                onClick={() => {
                  setShowCreateTemplateModal(false);
                  setNewTemplateName('');
                  setNewTemplateShortName('');
                  setTemplateFormData({
                    symptoms: '', diagnoses: '',
                    medications: [{ name: '', brand: '', composition: '', dosage: '', dosage_form: '', frequency: '', timing: { type: 'After Meal', time: null }, duration: '', instructions: '', qty: '' }],
                    investigations: '', precautions: '', diet_restrictions: '', activities: '', advice: '', follow_up_days: '', duration_days: '7'
                  });
                  setTplSymptomInput(''); setTplSymptomSuggestions([]);
                  setTplDiagInput(''); setTplDiagSuggestions([]);
                  setTplMedSuggestions([]); setTplActiveMedIdx(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-3 space-y-3 overflow-y-auto flex-1">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Template Name *</label>
                  <input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g., Asthma Management" className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Short Name *</label>
                  <input type="text" value={newTemplateShortName} onChange={(e) => setNewTemplateShortName(e.target.value)}
                    placeholder="e.g., Asthma" maxLength="15" className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs" />
                </div>
              </div>

              {/* Symptoms & Diagnoses */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Symptoms</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={tplSymptomInput}
                      onChange={(e) => tplSearchSymptoms(e.target.value)}
                      onBlur={() => setTimeout(() => setTplSymptomSuggestions([]), 150)}
                      placeholder="Search & add symptoms..."
                      className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                    />
                    {tplSymptomSuggestions.length > 0 && (
                      <ul className="absolute z-20 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-36 overflow-y-auto">
                        {tplSymptomSuggestions.map((s, i) => (
                          <li key={i} onMouseDown={(e) => { e.preventDefault(); tplSelectSymptom(s); }}
                            className="px-2 py-1.5 text-xs cursor-pointer hover:bg-purple-50">{s.symptom || s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <textarea value={templateFormData.symptoms}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, symptoms: e.target.value }))}
                    placeholder="Fever, Cough, Headache"
                    className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs mt-1" rows="1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Diagnoses</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={tplDiagInput}
                      onChange={(e) => tplSearchDiag(e.target.value)}
                      onBlur={() => setTimeout(() => setTplDiagSuggestions([]), 150)}
                      placeholder="Search & add diagnoses..."
                      className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                    />
                    {tplDiagSuggestions.length > 0 && (
                      <ul className="absolute z-20 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-36 overflow-y-auto">
                        {tplDiagSuggestions.map((s, i) => (
                          <li key={i} onMouseDown={(e) => { e.preventDefault(); tplSelectDiag(s); }}
                            className="px-2 py-1.5 text-xs cursor-pointer hover:bg-purple-50">
                            <span className="font-medium">{s.diagnosis_name || s.disease_name || s.name || ''}</span>
                            {(s.code || s.icd_code) && <span className="ml-1 text-gray-400">{s.code || s.icd_code}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <textarea value={templateFormData.diagnoses}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, diagnoses: e.target.value }))}
                    placeholder="Acute URI, Bronchitis"
                    className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs mt-1" rows="1" />
                </div>
              </div>

              {/* Medications */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">Medications</label>
                  <button type="button" onClick={() => setTemplateFormData(prev => ({
                    ...prev,
                    medications: [...prev.medications, { name: '', brand: '', composition: '', frequency: '', timing: { type: 'After Meal', time: null }, duration: '', instructions: '', qty: '' }]
                  }))} className="text-xs px-2 py-0.5 bg-green-500 text-white rounded hover:bg-green-600">+ Add</button>
                </div>
                <div className="space-y-1.5">
                  {templateFormData.medications.map((med, idx) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded border relative">
                      {templateFormData.medications.length > 1 && (
                        <button type="button" onClick={() => setTemplateFormData(prev => ({
                          ...prev, medications: prev.medications.filter((_, i) => i !== idx)
                        }))} className="absolute top-1 right-1 text-red-400 hover:text-red-600 text-xs">✕</button>
                      )}
                      <div className="grid grid-cols-[1fr_100px] gap-1.5 mb-1.5">
                        <div className="relative col-span-1">
                          <input type="text" value={med.name} placeholder="Medicine Name *"
                            onChange={(e) => tplSearchMed(e.target.value, idx)}
                            onBlur={() => setTimeout(() => { setTplMedSuggestions([]); setTplActiveMedIdx(null); }, 150)}
                            className="w-full px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-purple-500" />
                          {tplActiveMedIdx === idx && tplMedSuggestions.length > 0 && (
                            <ul className="absolute z-20 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-52 overflow-y-auto" style={{minWidth:'320px'}}>
                              {tplMedSuggestions.map((s, i) => {
                                const drugName = s.name || s.brand || '';
                                const comp = s.composition || s.generic_name || '';
                                const df = s.dosage_form || '';
                                const dfBadge = df ? (/syrup|suspension|liquid|solution/i.test(df) ? 'SYR' : /drop/i.test(df) ? 'DRP' : /injection|inj/i.test(df) ? 'INJ' : /inhaler|spray/i.test(df) ? 'INH' : /cream|ointment|gel/i.test(df) ? 'TOP' : 'TAB') : 'TAB';
                                const badgeColor = dfBadge === 'TAB' ? 'bg-pink-100 text-pink-700' : dfBadge === 'SYR' ? 'bg-blue-100 text-blue-700' : dfBadge === 'INJ' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
                                const isCurated = s.source === 'curated' || s.curated;
                                return (
                                  <li key={i} onMouseDown={(e) => { e.preventDefault(); tplSelectMed(s); }}
                                    className="px-3 py-2 text-xs cursor-pointer hover:bg-purple-50 border-b border-gray-50 flex items-start gap-2">
                                    <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${badgeColor}`}>{dfBadge}</span>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-gray-800 flex items-center gap-1">
                                        {drugName}
                                        {isCurated && <span className="text-yellow-400 text-[10px]">★</span>}
                                      </div>
                                      {comp && <div className="text-gray-400 truncate">{comp}</div>}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                        <input type="text" value={med.frequency} placeholder="Freq (1-1-1)"
                          onChange={(e) => { const m = [...templateFormData.medications]; m[idx] = { ...m[idx], frequency: e.target.value }; setTemplateFormData(prev => ({ ...prev, medications: m })); }}
                          className="px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-purple-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex flex-col gap-1">
                          <select value={med.timing?.type || med.timing || 'After Meal'}
                            onChange={(e) => { 
                              const type = e.target.value;
                              const m = [...templateFormData.medications]; 
                              m[idx] = { ...m[idx], timing: { type, time: type === 'Fixed Time' ? (m[idx].timing?.time || '09:00') : null } }; 
                              setTemplateFormData(prev => ({ ...prev, medications: m })); 
                            }}
                            className="px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-purple-500 w-full">
                            <option value="Before Meal">Before Meal</option>
                            <option value="After Meal">After Meal</option>
                            <option value="With Meal">With Meal</option>
                            <option value="Empty Stomach">Empty Stomach</option>
                            <option value="Bedtime">Bedtime</option>
                            <option value="Fixed Time">Fixed Time</option>
                          </select>
                          {(med.timing?.type === 'Fixed Time' || med.timing === 'Fixed Time') && (
                            <input 
                              type="time" 
                              value={med.timing?.time || '09:00'}
                              onChange={(e) => {
                                const m = [...templateFormData.medications];
                                m[idx] = { ...m[idx], timing: { ...m[idx].timing, time: e.target.value } };
                                setTemplateFormData(prev => ({ ...prev, medications: m }));
                              }}
                              className="px-2 py-0.5 border rounded text-[10px]"
                            />
                          )}
                        </div>
                        <input type="text" value={med.duration} placeholder="Duration (5 days)"
                          onChange={(e) => { const m = [...templateFormData.medications]; m[idx] = { ...m[idx], duration: e.target.value }; setTemplateFormData(prev => ({ ...prev, medications: m })); }}
                          className="px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-purple-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Investigations & Precautions */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Investigations</label>
                  <textarea value={templateFormData.investigations}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, investigations: e.target.value }))}
                    placeholder="CBC, Blood Sugar, etc."
                    className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs" rows="1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Precautions</label>
                  <textarea value={templateFormData.precautions}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, precautions: e.target.value }))}
                    placeholder="Avoid cold water..."
                    className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs" rows="1" />
                </div>
              </div>

              {/* Diet & Advice */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Diet Restrictions</label>
                  <textarea value={templateFormData.diet_restrictions}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, diet_restrictions: e.target.value }))}
                    placeholder="Avoid spicy food..."
                    className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs" rows="1" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Advice</label>
                  <textarea value={templateFormData.advice}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, advice: e.target.value }))}
                    placeholder="Plenty of fluids..."
                    className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs" rows="1" />
                </div>
              </div>

              {/* Follow-up & Duration */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Follow-up Days</label>
                  <input type="number" value={safeNumberInputValue(templateFormData.follow_up_days)}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, follow_up_days: e.target.value }))}
                    placeholder="7" className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Duration Days</label>
                  <input type="number" value={safeNumberInputValue(templateFormData.duration_days)}
                    onChange={(e) => setTemplateFormData(prev => ({ ...prev, duration_days: e.target.value }))}
                    placeholder="7" className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs" />
                </div>
              </div>
            </div>

            <div className="p-3 border-t flex gap-2 shrink-0">
              <button
                onClick={() => {
                  setShowCreateTemplateModal(false);
                  setNewTemplateName('');
                  setNewTemplateShortName('');
                  setTemplateFormData({
                    symptoms: '', diagnoses: '',
                    medications: [{ name: '', brand: '', composition: '', dosage: '', dosage_form: '', frequency: '', timing: { type: 'After Meal', time: null }, duration: '', instructions: '', qty: '' }],
                    investigations: '', precautions: '', diet_restrictions: '', activities: '', advice: '', follow_up_days: '', duration_days: '7'
                  });
                  setTplSymptomInput(''); setTplSymptomSuggestions([]);
                  setTplDiagInput(''); setTplDiagSuggestions([]);
                  setTplMedSuggestions([]); setTplActiveMedIdx(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!newTemplateName.trim() || !newTemplateShortName.trim() || isSavingTemplate}
              >
                {isSavingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="grid lg:grid-cols-3 gap-6 py-3 items-start">
        <div className="lg:col-span-2 space-y-3">
          {/* Dosage Calculator */}
          <div className="mb-2">
            <DosageCalculator
              patientWeight={parseFloat(vitals.weight) || 0}
              patientAge={patient ? calculateAge(patient.dob) : 0}
              dosageCalculator={dosageCalculator}
              language={language}
              addToast={addToast}
              addMedicine={(med) => {
                setMeds(prev => [...prev, med]);
                RecentlyUsedMedicines.add(med);
                const recent = RecentlyUsedMedicines.getAll();
                _setRecentMedicines(recent.slice(0, 15));
              }}
            />
          </div>

          {/* Dynamic Sections - Render based on pad configuration */}
          {renderDynamicSections()}

          {/* Injections section removed (merged into medications list). */}

          {/* Lab Investigations - Now dynamically rendered based on pad configuration */}
          {/* <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Lab Investigations</h3>
              <button
                onClick={async () => {
                  try {
                    const res = await api.get(`/api/lab-investigations?patient=${patientId}`);
                    const investigations = res.data.investigations || [];

                    if (investigations.length === 0) {
                      addToast('No previous lab results found', 'info');
                      return;
                    }

                    setPreviousLabResults(investigations);
                    setShowLabResultsModal(true);
                  } catch (error) {
                    console.error('Error fetching previous lab results:', error);
                    addToast('Failed to load previous lab results', 'error');
                  }
                }}
                className="text-sm text-primary hover:underline"
              >
                View Previous Results
              </button>
            </div>

            <div className="flex gap-2 mb-2">
              <input
                data-testid="lab-input"
                type="text"
                value={_labTestInput}
                onChange={(e) => _setLabTestInput(e.target.value)}
                className="flex-1 px-3 py-2 border rounded"
                placeholder="Add lab test (e.g., CBC, Blood Sugar, etc.)..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (labTestInput.trim()) {
                      _setLabResults(prev => [...prev, {
                        test: labTestInput.trim(),
                        status: 'pending',
                        date: getLocalDateString()
                      }]);
                      setLabTestInput('');
                    }
                  }
                }}
              />
            </div>

            {labResults.length > 0 && (
              <div className="border rounded overflow-hidden">
                <div className="grid grid-cols-3 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                  <span>Test Name</span>
                  <span>Date</span>
                  <span>Action</span>
                </div>
                {labResults.map((lab, idx) => (
                  <div key={idx} className="grid grid-cols-3 px-3 py-2 border-t items-center text-sm">
                    <span>{lab.test}</span>
                    <span className="text-gray-600">{lab.date}</span>
                    <button
                      onClick={() => _setLabResults(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advices - Now dynamically rendered based on pad configuration */}
          {/* <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{uiLabels['en']?.advice || 'Advices'}</h3>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={enableTranslations}
                    onChange={(e) => setEnableTranslations(e.target.checked)}
                  />
                  Enable Translations
                </label>
                {enableTranslations && (
                  <select
                    className="px-2 py-1 border rounded text-sm"
                    value={language}
                    onChange={(e) => changeLanguage(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="mr">Marathi</option>
                  </select>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(adviceTemplates.length > 0 ? adviceTemplates.map(t => t.text) : (predefinedAdvice[language] || predefinedAdvice.en)).map((adv) => (
                <label key={adv} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedAdvice.includes(adv)}
                    onChange={() => _toggleAdvice(adv)}
                  />
                  {adv}
                </label>
              ))}
              {customAdviceItems.map((adv, idx) => (
                <span key={'ca2-' + idx} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedAdvice.includes(adv)}
                    onChange={() => _toggleAdvice(adv)}
                  />
                  <span className="text-blue-700">{adv}</span>
                  <button type="button" onClick={() => deleteCustomAdvice(idx)} className="text-red-400 hover:text-red-600 text-xs ml-1">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                className="flex-1 px-2 py-1 text-sm border rounded"
                placeholder="Type custom advice and press Enter..."
                value={newAdviceInput}
                onChange={(e) => setNewAdviceInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomAdvice(newAdviceInput); } }}
              />
              <button
                type="button"
                onClick={() => addCustomAdvice(newAdviceInput)}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add
              </button>
            </div>
            <div className="border rounded p-2">
              <div className="flex gap-2 mb-2 border-b pb-2">
                <button
                  type="button"
                  onClick={() => _formatAdvice('bold')}
                  className="px-2 py-1 text-sm border rounded hover:bg-slate-50 font-bold"
                  title="Bold"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => _formatAdvice('italic')}
                  className="px-2 py-1 text-sm border rounded hover:bg-slate-50 italic"
                  title="Italic"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => _formatAdvice('insertUnorderedList')}
                  className="px-2 py-1 text-sm border rounded hover:bg-slate-50"
                  title="List"
                >
                  •
                </button>
              </div>
              <div
                ref={adviceEditorRef}
                contentEditable
                className="min-h-[100px] p-2 focus:outline-none"
                onInput={(e) => setAdvice(e.target.innerText)}
                suppressContentEditableWarning={true}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={printOnPrescription}
                onChange={(e) => _setPrintOnPrescription(e.target.checked)}
              />
              {language === 'hi' ? 'प्रिस्क्रिप्शन पर प्रिंट करें' : language === 'mr' ? 'प्रिस्क्रिप्शनवर छापा' : 'Print on prescription'}
            </label>
          </div>

          {/* Follow Up - Now dynamically rendered based on pad configuration */}
          {/* <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
            <h3 className="font-semibold">{uiLabels['en']?.followUp || 'Follow Up'}</h3>
            <div className="flex gap-2 items-center">
              <input
                className="px-3 py-2 border rounded"
                placeholder={language === 'hi' ? 'दिन' : language === 'mr' ? 'दिवस' : 'Days'}
                type="number"
                value={safeNumberInputValue(followUp.days)}
                onChange={(e) => _handleFollowUpDaysChange(e.target.value)}
              />
              <input
                className="px-3 py-2 border rounded"
                type="date"
                value={safeDateInputValue(followUp.date)}
                onChange={(e) => setFollowUp({ ...followUp, date: e.target.value })}
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={followUp.autoFill}
                  onChange={(e) => setFollowUp({ ...followUp, autoFill: e.target.checked })}
                />
                {language === 'hi' ? 'Rx से ऑटो फिल' : language === 'mr' ? 'Rx वरून ऑटो भरा' : 'Auto Fill from Rx'}
              </label>
            </div>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              rows={2}
              placeholder={language === 'hi' ? 'नोट्स' : language === 'mr' ? 'टिपा' : 'Notes'}
            />
          </div> */}

          {/* Notes - Now dynamically rendered based on pad configuration */}
          {/* <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
            <h3 className="font-semibold">{language === 'hi' ? 'नोट्स' : language === 'mr' ? 'टिपा' : 'Notes'}</h3>
            <div>
              <label className="block text-sm font-medium mb-1">{uiLabels['en']?.patientNotes || 'Patient Notes'}</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                rows={3}
                placeholder={language === 'hi' ? 'रोगी को दिखने वाले नोट्स' : language === 'mr' ? 'रुग्यांना दिसणारे नोट्स' : 'Notes visible to patient'}
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {(uiLabels['en']?.privateNotes || 'PRIVATE NOTES').toUpperCase()}
                <span className="text-xs text-slate-500 ml-2">(These will not be printed)</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                rows={3}
                placeholder={language === 'hi' ? 'डॉक्टर के लिए निजी नोट्स' : language === 'mr' ? 'डॉक्टरसाठी खाजगी नोट्स' : 'Private notes for doctor'}
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
              />
            </div>
          </div> */}

          {/* Bottom Action Bar */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mb-3 pb-3 border-b border-gray-100">
              <button
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-slate-50 transition"
                onClick={handleClear}
              >
                Clear
              </button>
              <select
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white"
                value={language}
                onChange={(e) => changeLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
              </select>
              <div className="relative" ref={templateDropdownRef}>
                <button
                  type="button"
                  className="px-3 py-2 text-sm border border-blue-200 rounded-md bg-blue-50 hover:bg-blue-100 transition flex items-center gap-2 min-w-[160px] justify-between"
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                  title="Select Letterhead Template"
                >
                  <span className="truncate">
                    {selectedTemplateId
                      ? (receiptTemplates.find(t => t.id === selectedTemplateId)?.template_name || 'Template')
                      : (showDefaultLetterhead ? 'Default Letterhead' : 'No Letterhead')}
                  </span>
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showTemplateDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[220px]">
                    {/* No Letterhead option */}
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${!selectedTemplateId && !showDefaultLetterhead ? 'bg-blue-50 font-medium' : ''}`}
                      onClick={() => { setSelectedTemplateId(null); setSelectedTemplate(null); setShowDefaultLetterhead(false); localStorage.setItem('hideDefaultLetterhead', 'true'); setShowTemplateDropdown(false); }}
                    >
                      No Letterhead
                    </button>
                    {/* Default Letterhead option */}
                    {showDefaultLetterhead && (
                      <div className={`flex items-center justify-between hover:bg-gray-100 ${!selectedTemplateId ? 'bg-blue-50' : ''}`}>
                        <button
                          type="button"
                          className="flex-1 text-left px-3 py-2 text-sm font-medium"
                          onClick={() => { setSelectedTemplateId(null); setSelectedTemplate(null); setShowTemplateDropdown(false); }}
                        >
                          Default Letterhead
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 text-red-400 hover:text-red-600 text-xs mr-1"
                          onClick={(e) => { e.stopPropagation(); hideDefaultLetterhead(); setShowTemplateDropdown(false); }}
                          title="Remove Default Letterhead"
                        >
                          &times;
                        </button>
                      </div>
                    )}
                    {/* Receipt templates */}
                    {receiptTemplates.map(template => (
                      <div key={template.id} className={`flex items-center justify-between hover:bg-gray-100 ${selectedTemplateId === template.id ? 'bg-blue-50' : ''}`}>
                        <button
                          type="button"
                          className="flex-1 text-left px-3 py-2 text-sm"
                          onClick={() => { setSelectedTemplateId(template.id); setSelectedTemplate(template); setShowTemplateDropdown(false); }}
                        >
                          {template.template_name} {template.is_default ? '(Default)' : ''}
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 text-red-400 hover:text-red-600 text-xs mr-1"
                          onClick={(e) => { e.stopPropagation(); deleteReceiptTemplate(template.id); }}
                          title="Delete template"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {/* Restore default option if hidden */}
                    {!showDefaultLetterhead && (
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs text-blue-500 hover:bg-blue-50 border-t"
                        onClick={() => { setShowDefaultLetterhead(true); localStorage.removeItem('hideDefaultLetterhead'); setShowTemplateDropdown(false); addToast('Default Letterhead restored', 'info'); }}
                      >
                        + Restore Default Letterhead
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-start md:justify-end">
              <button
                data-testid="save-btn"
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-slate-50 transition disabled:opacity-50"
                onClick={handleSave}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Prescription'}
              </button>
              <button
                className="flex items-center gap-1 px-3 py-2 text-sm border border-blue-200 rounded-md hover:bg-blue-50 text-blue-700 hover:border-blue-300 transition"
                onClick={() => setShowTemplateModal(true)}
                title="Save current prescription as a template"
              >
                <FiBookmark />
                <span className="hidden sm:inline">Save as Template</span>
                <span className="sm:hidden">Template</span>
              </button>
              {currentPrescriptionId && (
                <button
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-green-200 rounded-md hover:bg-green-50 text-green-700 hover:border-green-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isPdfDownloading}
                  onClick={async () => {
                    setIsPdfDownloading(true);
                    try {
                      await downloadPrescriptionPDF(currentPrescriptionId, { language, templateId: selectedTemplateId, withLetterhead: printWithLetterhead });
                    } catch (e) {
                      addToast('PDF download failed. Try Print instead.', 'error');
                    } finally {
                      setIsPdfDownloading(false);
                    }
                  }}
                  title="Download prescription as PDF"
                >
                  {isPdfDownloading
                    ? <><span className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin inline-block" /><span className="hidden sm:inline ml-1">Generating...</span></>
                    : <><FiDownload className="w-4 h-4" /><span className="hidden sm:inline">Download PDF</span><span className="sm:hidden">PDF</span></>
                  }
                </button>
              )}

              {/* WhatsApp Send */}
              <button
                className="flex items-center gap-1 px-3 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 shadow-sm hover:shadow transition"
                onClick={() => {
                  const phone = patient?.phone || patient?.mobile;
                  if (!phone) {
                    addToast('Patient phone number not available', 'error');
                    return;
                  }
                  const patientName = patient?.name || patient?.first_name || 'Patient';
                  const medsText = meds.map(m => `- ${m.name || m.brand}${m.frequency ? ' (' + m.frequency + ')' : ''}${m.duration ? ' x ' + m.duration : ''}`).join('\n');
                  const pdfLink = currentPrescriptionId ? `${window.location.origin}/api/pdf/prescription/${currentPrescriptionId}` : '';
                  const message = `Hello ${patientName},\n\nYour prescription is ready.\n\n*Medicines:*\n${medsText}\n\n${advice ? '*Advice:* ' + advice + '\n' : ''}${followUp.days ? '*Follow up:* After ' + followUp.days + ' days\n' : ''}${pdfLink ? '\n📄 *View/Download Prescription:*\n' + pdfLink + '\n' : ''}\nPlease follow the prescribed medications as advised.\n\nGet well soon!`;
                  const cleanPhone = String(phone).replace(/\D/g, '');
                  const formattedPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
                  window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
                }}
                title="Send prescription via WhatsApp"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              {/* Print Format Selector */}
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md bg-gray-50">
                <span className="text-xs font-medium text-gray-700 hidden sm:inline">Print:</span>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    value="A4"
                    checked={printFormat === 'A4'}
                    onChange={(e) => setPrintFormat(e.target.value)}
                    className="cursor-pointer"
                  />
                  <span>A4</span>
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="radio"
                    value="A5"
                    checked={printFormat === 'A5'}
                    onChange={(e) => setPrintFormat(e.target.value)}
                    className="cursor-pointer"
                  />
                  <span>A5</span>
                </label>
              </div>

              {/* Letterhead toggle */}
              <label className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 cursor-pointer text-xs text-gray-700 select-none" title="Include clinic header & footer when printing/downloading">
                <input
                  type="checkbox"
                  checked={printWithLetterhead}
                  onChange={e => setPrintWithLetterhead(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="hidden sm:inline">With Letterhead</span>
                <span className="sm:hidden">Letterhead</span>
              </label>

              {/* Refer Doctor Button */}
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md transition ${referredDoctor ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100' : 'border-gray-300 hover:bg-slate-50'}`}
                onClick={async () => {
                  setShowReferModal(true);
                  setReferralLoading(true);
                  try {
                    const res = await api.get('/api/patient-referrals/network/doctors');
                    setReferralNetwork(res.data?.network || res.data?.doctors || res.data?.data?.network || res.data?.data || []);
                  } catch { setReferralNetwork([]); }
                  setReferralLoading(false);
                }}
                title="Refer patient to another doctor"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="hidden sm:inline">{referredDoctor ? `Referred: Dr. ${referredDoctor.name}` : 'Refer Doctor'}</span>
                <span className="sm:hidden">Refer</span>
              </button>

              <button
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-slate-50 transition"
                onClick={handlePrintClick}
              >
                Print
              </button>
              <button
                className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 min-w-[140px] sm:min-w-[160px] md:min-w-[180px] lg:min-w-[200px] font-medium shadow-sm hover:shadow-md transition-all duration-200 order-first md:order-last"
                onClick={handleFinish}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Send Rx & End Visit'}
              </button>
            </div>
          </div>

          {/* Referred Doctor Card — inside left column */}
          {referredDoctor && (
            <div className="bg-indigo-50 border border-indigo-200 rounded p-3 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                  {(referredDoctor.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Referred To</p>
                  <p className="font-semibold text-gray-900 text-sm">Dr. {referredDoctor.name}</p>
                  <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-600">
                    {referredDoctor.specialty && <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{referredDoctor.specialty}</span>}
                    {referredDoctor.hospital && <span>{referredDoctor.hospital}</span>}
                    {referredDoctor.phone && <span>📞 {referredDoctor.phone}</span>}
                  </div>
                  {referredDoctor.notes && <p className="text-xs text-gray-500 mt-1 italic">{referredDoctor.notes}</p>}
                </div>
              </div>
              <button
                type="button"
                className="text-indigo-400 hover:text-indigo-700 text-xs underline shrink-0"
                onClick={async () => {
                  setReferralForm(prev => ({ ...prev, referred_doctor_name: referredDoctor.name || '', referred_doctor_phone: referredDoctor.phone || '', referred_doctor_specialization: referredDoctor.specialty || '', hospital_name: referredDoctor.hospital || '', notes: referredDoctor.notes || '' }));
                  setShowReferModal(true);
                  setReferralLoading(true);
                  try { const res = await api.get('/api/patient-referrals/network/doctors'); setReferralNetwork(res.data?.network || res.data?.doctors || res.data?.data?.network || []); } catch { setReferralNetwork([]); }
                  setReferralLoading(false);
                }}
              >Edit</button>
            </div>
          )}

        </div>

        {/* Right Sidebar - Past Visits */}
        <aside className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 mb-3 pb-3 border-b border-gray-100">
              <button
                onClick={() => setPastVisitsTab('past')}
                className={`w-8 h-8 flex items-center justify-center text-xs font-semibold rounded-full transition ${
                  pastVisitsTab === 'past' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                }`}
                title="Past Visits"
              >
                P
              </button>
              <button
                onClick={() => setPastVisitsTab('history')}
                className={`w-8 h-8 flex items-center justify-center text-xs font-semibold rounded-full transition ${
                  pastVisitsTab === 'history' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                }`}
                title="History"
              >
                H
              </button>
              <button
                onClick={() => setPastVisitsTab('vitals')}
                className={`w-8 h-8 flex items-center justify-center text-xs font-semibold rounded-full transition ${
                  pastVisitsTab === 'vitals' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                }`}
                title="Vitals"
              >
                V
              </button>
              <button
                onClick={() => setPastVisitsTab('records')}
                className={`relative w-8 h-8 flex items-center justify-center text-xs font-semibold rounded-full transition ${
                  pastVisitsTab === 'records' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                }`}
                title="Records"
              >
                R
                {pastRecords.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center ring-2 ring-white">
                    {pastRecords.length > 9 ? '9+' : pastRecords.length}
                  </span>
                )}
              </button>
            </div>

            {/* See all link */}
            <div className="text-xs text-slate-600 mb-3">
              <Link to={`/patient-overview/${patientId}`} className="text-primary hover:underline font-medium">
                See all Past Visits {pastVisits.length > 0 && `[${pastVisits.length}]`}
              </Link>
            </div>

            {/* Tab Content */}
            {loadingPastData ? (
              <div className="text-xs text-slate-500 text-center py-4">Loading...</div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {pastVisitsTab === 'past' && (
                  <>
                    {pastPrescriptions.length === 0 ? (
                      <div className="text-xs text-slate-500 text-center py-4">No past prescriptions</div>
                    ) : (
                      pastPrescriptions.map((visit, idx) => (
                        <div
                          key={`past-${idx}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => openPastVisit(visit)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPastVisit(visit); } }}
                          title="Click to open this visit's prescription"
                          className="border border-gray-200 rounded-md p-2 space-y-1.5 hover:border-blue-300 hover:shadow-sm transition cursor-pointer"
                        >
                          {/* Header: Date + Open/Copy Buttons */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="text-xs font-bold text-slate-700">
                              {new Date(visit.prescribed_date || visit.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openPastVisit(visit); }}
                              className="px-2 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded hover:bg-violet-100 transition flex items-center gap-1"
                              title="Open this prescription"
                            >
                              <FiEye className="w-3 h-3" /> Open
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                // Card click opens the visit — keep Copy doing only its own job.
                                e.stopPropagation();
                                // Copy this prescription into current form
                                const copied = [];
                                // Prefer the STRUCTURED symptoms array — splitting chief_complaint on
                                // commas loses each symptom's remarks (and mangles names containing
                                // a comma). Fall back to chief_complaint only when it is absent.
                                if (Array.isArray(visit.symptoms) && visit.symptoms.length > 0) {
                                  const mapped = visit.symptoms.map((sx) => (
                                    typeof sx === 'string'
                                      ? { name: sx, remarks: '' }
                                      : { name: sx?.name || sx?.term || '', remarks: sx?.remarks || '' }
                                  )).filter(sx => sx.name);
                                  if (mapped.length) { setSymptoms(mapped); copied.push(`${mapped.length} symptom(s)`); }
                                } else if (visit.chief_complaint) {
                                  const syms = visit.chief_complaint.split(',').map(s => s.trim()).filter(Boolean);
                                  setSymptoms(syms.map(s => ({ name: s, remarks: '' })));
                                  copied.push(`${syms.length} symptom(s)`);
                                }
                                if (visit.diagnoses && visit.diagnoses.length > 0) {
                                  setDiagnoses(normalizeDiagnosisList(visit.diagnoses));
                                  copied.push('diagnosis');
                                } else if (visit.diagnosis) {
                                  setDiagnoses(normalizeDiagnosisList(visit.diagnosis));
                                }
                                if (visit.medications && visit.medications.length > 0) {
                                  const copiedMeds = visit.medications.map(med => ({
                                    name: med.medication_name || med.name || '',
                                    brand: med.medication_name || med.name || '',
                                    generic_name: med.generic_name || '',
                                    dosage: med.dosage || '',
                                    frequency: med.frequency || '',
                                    duration: med.duration || '',
                                    timing: translateTiming(med.timing, language) || med.timing || '',
                                    instructions: translateInstruction(med.instructions || med.notes || '', language) || med.instructions || med.notes || '',
                                    qty: med.quantity || '',
                                    type: med.type || 'medication',
                                    is_tapering: med.is_tapering || 0,
                                    tapering_schedule: med.tapering_schedule || []
                                  }));
                                  setMeds(copiedMeds);
                                  copied.push(`${copiedMeds.length} medicine(s)`);
                                }
                                if (visit.advice) { setAdvice(visit.advice); copied.push('advice'); }
                                if (visit.follow_up_days) setFollowUp(prev => ({ ...prev, days: String(typeof visit.follow_up_days === 'object' ? (visit.follow_up_days?.days || '') : visit.follow_up_days || '') }));
                                if (visit.patient_notes) setPatientNotes(visit.patient_notes);
                                if (visit.custom_fields) {
                                  try {
                                    const cf = typeof visit.custom_fields === 'string' ? JSON.parse(visit.custom_fields) : visit.custom_fields;
                                    if (cf && typeof cf === 'object') setCustomFieldValues(cf);
                                  } catch { /* ignore malformed custom_fields */ }
                                }
                                // Lab tests + their per-test remarks. lab_remarks carries an encoded
                                // __TAG_REMARKS__ header (same format the PDF decodes), so parse it
                                // rather than dumping the raw string into the remarks box.
                                if (visit.lab_advice) {
                                  setLabAdvice(visit.lab_advice);
                                  copied.push(`${visit.lab_advice.split(',').filter(Boolean).length} lab test(s)`);
                                }
                                if (visit.lab_remarks) {
                                  const MARKER = '__TAG_REMARKS__:';
                                  let freeText = visit.lab_remarks;
                                  if (freeText.startsWith(MARKER)) {
                                    const nl = freeText.indexOf(String.fromCharCode(10));
                                    const jsonStr = nl >= 0 ? freeText.slice(MARKER.length, nl) : freeText.slice(MARKER.length);
                                    freeText = nl >= 0 ? freeText.slice(nl + 1) : '';
                                    try {
                                      const tags = JSON.parse(jsonStr);
                                      if (tags && typeof tags === 'object') setLabAdviceRemarks(tags);
                                    } catch { /* malformed header: keep the free text only */ }
                                  }
                                  setLabRemarks(freeText.trim());
                                }
                                if (visit.vitals && typeof visit.vitals === 'object') {
                                  setVitals(prev => ({ ...prev, ...visit.vitals }));
                                  copied.push('vitals');
                                }
                                // Examination findings live inside private_notes behind a marker.
                                if (visit.private_notes && visit.private_notes.includes('[EXAM_FINDINGS]')) {
                                  const exam = visit.private_notes.split('[EXAM_FINDINGS]')[1];
                                  if (exam && exam.trim()) { setGeneralExamination(exam.trim()); copied.push('examination'); }
                                }
                                // Say exactly what came across. Several visits legitimately have no
                                // medicines, and a generic "copied!" made that look like a failure.
                                addToast(
                                  copied.length ? `Copied: ${copied.join(', ')}` : 'That visit had nothing to copy',
                                  copied.length ? 'success' : 'info',
                                );
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition flex items-center gap-1"
                              title="Copy this prescription"
                            >
                              <FiCopy className="w-3 h-3" /> Copy
                            </button>
                            </div>
                          </div>

                          {/* Symptoms */}
                          {(visit.symptoms?.length > 0 || visit.chief_complaint) && (
                            <div className="flex items-start gap-1 text-xs">
                              <span className="shrink-0 w-4 h-4 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[9px] font-bold mt-0.5">S</span>
                              <span className="text-slate-600 leading-tight">
                                {visit.symptoms?.length > 0 ? cleanReasonForVisit(visit.symptoms) : cleanReasonForVisit(visit.chief_complaint)}
                              </span>
                            </div>
                          )}

                          {/* Diagnosis */}
                          {(visit.diagnoses?.length > 0 || visit.diagnosis) && (
                            <div className="flex items-start gap-1 text-xs">
                              <span className="shrink-0 w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-bold mt-0.5">D</span>
                              <span className="text-slate-600 leading-tight">
                                {visit.diagnoses?.length > 0 ? cleanReasonForVisit(visit.diagnoses) : cleanReasonForVisit(visit.diagnosis)}
                              </span>
                            </div>
                          )}

                          {/* Medicines */}
                          {visit.medications && visit.medications.length > 0 && (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 text-xs">
                                <span className="shrink-0 w-4 h-4 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-[9px] font-bold">M</span>
                                <span className="font-medium text-slate-700">{visit.medications.filter(m => !m.type || m.type === 'medication').length} medicines</span>
                              </div>
                              {visit.medications.filter(m => !m.type || m.type === 'medication').map((med, mIdx) => (
                                <div key={`med-${mIdx}`} className="ml-5 text-[11px] text-slate-600 flex items-center gap-1">
                                  <span className="font-medium">{med.medication_name || med.name}</span>
                                  {med.frequency && <span className="text-slate-400">| {med.frequency}</span>}
                                  {med.duration && <span className="text-slate-400">| {med.duration}</span>}
                                </div>
                              ))}
                              {/* Injections */}
                              {visit.medications.filter(m => m.type === 'injection').length > 0 && (
                                <>
                                  <div className="flex items-center gap-1 text-xs mt-1">
                                    <span className="shrink-0 w-4 h-4 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[9px] font-bold">I</span>
                                    <span className="font-medium text-slate-700">{visit.medications.filter(m => m.type === 'injection').length} injections</span>
                                  </div>
                                  {visit.medications.filter(m => m.type === 'injection').map((inj, iIdx) => (
                                    <div key={`inj-${iIdx}`} className="ml-5 text-[11px] text-slate-600">
                                      <span className="font-medium">{inj.medication_name || inj.name}</span>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          )}

                          {/* Advice preview */}
                          {visit.advice && (
                            <div className="flex items-start gap-1 text-xs">
                              <span className="shrink-0 w-4 h-4 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[9px] font-bold mt-0.5">A</span>
                              <span className="text-slate-500 leading-tight line-clamp-2">{visit.advice}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}

                {pastVisitsTab === 'history' && (
                  <>
                    {pastVisits.length === 0 ? (
                      <div className="text-xs text-slate-500 text-center py-4">No history available</div>
                    ) : (
                      pastVisits.slice(0, 5).map((visit, idx) => (
                        <div key={`history-${idx}`} className="border rounded p-2 space-y-1">
                          <div className="text-xs font-semibold">
                            {new Date(visit.appointment_date).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-slate-600">{visit.reason_for_visit || 'No reason specified'}</div>
                          {visit.notes && (
                            <div className="text-xs text-slate-500 italic">{visit.notes}</div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}

                {pastVisitsTab === 'vitals' && (
                  <>
                    {pastVitals.length === 0 ? (
                      <div className="text-xs text-slate-500 text-center py-4">No vitals recorded</div>
                    ) : (
                      pastVitals.slice(0, 5).map((vital, idx) => (
                        <div key={`vital-${idx}`} className="border rounded p-2 space-y-1">
                          <div className="text-xs font-semibold">
                            {vital.date ? new Date(vital.date).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-xs text-slate-600">
                            {vital.value || 'No vitals data'}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {pastVisitsTab === 'records' && (
                  <>
                    {pastRecords.length === 0 ? (
                      <div className="text-xs text-slate-500 text-center py-4">No records available</div>
                    ) : (
                      pastRecords.slice(0, 5).map((record, idx) => (
                        <div key={`record-${idx}`} className="border rounded p-2 space-y-1">
                          <div className="text-xs font-semibold">{record.record_title || record.record_type}</div>
                          <div className="text-xs text-slate-600">
                            {new Date(record.uploaded_date || record.created_at).toLocaleDateString()}
                          </div>
                          {record.description && (
                            <div className="text-xs text-slate-500 truncate">{record.description}</div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* Hidden printable region containing the Letterhead wrapper */}
      <div className="hidden print:block rx-print-region">
        <div ref={printRef}>
          {printFormat === 'A4' ? (
            <Suspense fallback={<div>Loading letterhead...</div>}>
              <Letterhead template={selectedTemplate} showLetterhead={printWithLetterhead}>
                <div style={(() => {
                  try {
                    const m = JSON.parse(localStorage.getItem('rxTemplateMargins') || '{}');
                    return {
                      paddingTop: m.contentTop ? `${m.contentTop}mm` : undefined,
                      paddingBottom: m.contentBottom ? `${m.contentBottom}mm` : undefined,
                    };
                  } catch (e) { return {}; }
                })()}>
                {/* ── Doctor Header ──
                  Only shown when printing WITHOUT letterhead. With letterhead
                  on, the Letterhead component already renders the clinic/
                  doctor branding in its own header (image or the built-in
                  design) — repeating the doctor's name+qualification here
                  duplicated it. Still show just the visit date/time with
                  letterhead on, since neither an uploaded header image nor
                  the built-in design includes that. */}
              {printWithLetterhead ? (
                <div style={{ textAlign: 'right', fontSize: 11, color: '#555', marginBottom: 8 }}>
                  {new Date(meta.prescription_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                  {meta.prescription_time ? `, ${formatTimeWithAMPM(meta.prescription_time)}` : ''}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Dr. {user?.name || 'Doctor'}</div>
                      {(user?.specialization || user?.qualification) && (
                        <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>
                          {[user?.specialization, user?.qualification].filter(Boolean).join(' | ')}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap' }}>
                      {new Date(meta.prescription_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                      {meta.prescription_time ? `, ${formatTimeWithAMPM(meta.prescription_time)}` : ''}
                    </div>
                  </div>
                  <div style={{ borderTop: '1.5px solid #003366', marginBottom: 8 }} />
                </>
              )}

              {/* ── Patient Info Bar ── */}
              {patient && (
                <div style={{ padding: '3px 7px', background: '#f0f4ff', borderRadius: 3, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.2, textTransform: 'uppercase' }}>{printableName(patient)}</span>
                    {(patient.patient_id || patient.uhid) && <span style={{ fontWeight: 700, fontSize: 10, color: '#003366', whiteSpace: 'nowrap' }}>UHID : {patient.patient_id || patient.uhid}</span>}
                  </div>
                  <div style={{ color: '#555', fontSize: 10, marginTop: 1 }}>
                    {[
                      patient.gender,
                      patient.dob ? `${calculateAge(patient.dob)} Yrs` : (patient.age_years ? `${patient.age_years} Yrs` : null),
                      patient.phone
                    ].filter(Boolean).join(' | ')}
                  </div>
                </div>
              )}

              {/* ── Vitals ── */}
              {(vitals.temp || vitals.height || vitals.bmi || vitals.weight || vitals.pulse || vitals.blood_pressure || vitals.spo2) && (
                <div style={{ marginBottom: 8, padding: '4px 8px', background: '#f8f9fa', borderRadius: 4, fontSize: 11 }}>
                  <span style={{ fontWeight: 700, color: '#003366', marginRight: 8 }}>VITALS:</span>
                  {[
                    vitals.temp && `Temp: ${vitals.temp}°F`,
                    vitals.blood_pressure && `BP: ${vitals.blood_pressure}`,
                    vitals.pulse && `Pulse: ${vitals.pulse} bpm`,
                    vitals.weight && `Wt: ${vitals.weight} kg`,
                    vitals.height && `Ht: ${vitals.height} cm`,
                    vitals.bmi && `BMI: ${vitals.bmi}`,
                    vitals.spo2 && `SpO2: ${vitals.spo2}%`,
                  ].filter(Boolean).join('   ')}
                </div>
              )}

              {/* ── Clinical Info ── */}
              {symptoms.length > 0 && (
                <div style={{ marginBottom: 5, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#333' }}>C/O: </span>
                  <span>{symptoms.map(s => {
                    const name = typeof s === 'object' ? s.name : cleanReasonForVisit(s);
                    const rem = typeof s === 'object' ? s.remarks : '';
                    return name + (rem ? ` (${rem})` : '');
                  }).join(', ')}</span>
                </div>
              )}

              {(() => {
                // Compute the text FIRST — the old length>0 guard printed a bare
                // "Dx:" label when every diagnosis entry mapped to an empty string.
                const dxText = diagnoses.map(d => typeof d === 'string' ? cleanReasonForVisit(d) : (d.label || d.icd_title || d.name || '')).filter(Boolean).join(', ');
                return dxText ? (
                  <div style={{ marginBottom: 5, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#333' }}>Dx: </span>
                    <span style={{ fontWeight: 500 }}>{dxText}</span>
                  </div>
                ) : null;
              })()}

              {(generalExamination || systemicExamination) && (
                <div style={{ marginBottom: 5, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#333' }}>Examination: </span>
                  <span>{[generalExamination, systemicExamination].filter(Boolean).join(' | ')}</span>
                </div>
              )}

              {/* ── Unified Rx Table (Medications + Injections) ── */}
              {meds.length > 0 && (
                <div style={{ marginTop: 10, marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#003366', borderBottom: '2px solid #003366', paddingBottom: 3, marginBottom: 6, letterSpacing: 0.5 }}>
                    Rx PRESCRIPTION
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#003366', color: '#fff' }}>
                        <th style={{ padding: '5px 6px', textAlign: 'center', width: '5%', border: '1px solid #1a4a8a' }}>Sr.</th>
                        <th style={{ padding: '5px 6px', textAlign: 'left', width: '35%', border: '1px solid #1a4a8a' }}>Medications</th>
                        <th style={{ padding: '5px 6px', textAlign: 'center', width: '10%', border: '1px solid #1a4a8a' }}>Dose</th>
                        <th style={{ padding: '5px 6px', textAlign: 'center', width: '15%', border: '1px solid #1a4a8a' }}>Frequency</th>
                        <th style={{ padding: '5px 6px', textAlign: 'center', width: '10%', border: '1px solid #1a4a8a' }}>Duration</th>
                        <th style={{ padding: '5px 6px', textAlign: 'left', width: '25%', border: '1px solid #1a4a8a' }}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...meds.filter(m => m.type !== 'injection'), ...meds.filter(m => m.type === 'injection')].map((m, idx) => {
                        const isInj = m.type === 'injection';
                        const rowBg = isInj ? '#fff8f0' : (idx % 2 === 0 ? '#fff' : '#f9fafb');
                        const nameDisplay = m.name || m.brand || m.medication_name || '';
                        const doseDisplay = isInj ? (m.dose || m.dosage || '-') : (m.dosage || '-');
                        const freqDisplay = m.is_tapering ? 'Tapering' : (m.frequency || '-');
                        const timingText = m.timing ? translateTiming(m.timing, language) : null;
                        const translatedInstr = m.auto_instructions
                          ? generateAutoInstructions(
                              m.is_tapering ? 'Tapering' : (m.frequency || ''),
                              timingText || m.timing,
                              language,
                              translateTiming,
                              m.duration,
                              m.dosage || '',
                              m.dosage_form || ''
                            )
                          : (translateInstruction(m.instructions, language) || m.instructions || '');
                        const remarksDisplay = isInj
                          ? [translatedInstr, m.route ? `[${m.route}]` : null].filter(Boolean).join(' ')
                          : translatedInstr;
                        const cellStyle = { padding: '5px 6px', border: '1px solid #94a3b8', verticalAlign: 'middle' };
                        return (
                          <React.Fragment key={`print-row-${idx}`}>
                            <tr style={{ backgroundColor: rowBg }}>
                              <td style={{ ...cellStyle, textAlign: 'center', color: '#555', fontSize: 10 }}>{idx + 1}</td>
                              <td style={cellStyle}>
                                <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11, color: isInj ? '#b45309' : '#111' }}>
                                  {isInj && <span style={{ fontSize: 9, background: '#fed7aa', color: '#92400e', padding: '1px 4px', borderRadius: 3, marginRight: 4, fontWeight: 600 }}>INJ</span>}
                                  {nameDisplay}{m.dosage_form && !nameDisplay.toLowerCase().includes(m.dosage_form.toLowerCase()) ? ` (${m.dosage_form.toLowerCase()})` : ''}
                                </div>
                                {m.composition && <div style={{ color: '#111827', fontSize: 9, marginTop: 1 }}>{m.composition}</div>}
                                {isInj && m.route && <div style={{ color: '#6b7280', fontSize: 9 }}>Route: {m.route}</div>}
                              </td>
                              <td style={{ ...cellStyle, textAlign: 'center' }}>{doseDisplay}</td>
                              <td style={{ ...cellStyle, textAlign: 'center' }}>
                                {freqDisplay}
                                {timingText && <div style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>{timingText}</div>}
                              </td>
                              <td style={{ ...cellStyle, textAlign: 'center' }}>
                                {m.is_tapering && m.tapering_schedule?.length
                                  ? m.tapering_schedule.reduce((sum, s) => sum + (parseInt(s.duration_days) || 0), 0) + ' days'
                                  : (m.duration || '-')}
                              </td>
                              <td style={{ ...cellStyle, color: '#374151', fontSize: 10 }}>
                                {m.is_tapering && m.tapering_schedule?.length
                                  ? m.tapering_schedule.map((s, si) => `${si > 0 ? '-> ' : ''}${s.dose} ${translateTaperFreq(s.frequency, language)} x${s.duration_days}d`).join(' ')
                                  : (remarksDisplay || '-')}
                              </td>
                            </tr>
                            {!!m.is_tapering && m.tapering_schedule && m.tapering_schedule.length > 0 && (
                              <tr style={{ backgroundColor: '#f5f0ff' }}>
                                <td></td>
                                <td colSpan={5} style={{ padding: '3px 8px', fontSize: 10, color: '#5b21b6' }}>
                                  <strong>Tapering: </strong>
                                  {m.tapering_schedule.map((s, si) => (
                                    <span key={si}>{si > 0 && ' -> '}{s.dose} {s.frequency} x {s.duration_days}d</span>
                                  ))}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Lab Investigations ── */}
              {(() => {
                const notesIsInvestigation = patientNotes && /^investigations?:/i.test(patientNotes.trim());
                const investigationExtra = notesIsInvestigation ? patientNotes.replace(/^investigations?:\s*/i, '').trim() : '';
                const labTags = labAdvice ? labAdvice.split(',').map(t => t.trim()).filter(Boolean) : [];
                if (!labTags.length && !investigationExtra) return null;
                return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#003366', borderBottom: '1.5px solid #003366', paddingBottom: 2, marginBottom: 5, letterSpacing: 0.3 }}>
                      PRESCRIBED LAB TESTS
                    </div>
                    <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6 }}>
                      {labTags.map(tag => labAdviceRemarks[tag] ? `${tag} (${labAdviceRemarks[tag]})` : tag).join(', ')}
                    </div>
                    {investigationExtra && <div style={{ fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 4, color: '#374151' }}>{investigationExtra}</div>}
                  </div>
                );
              })()}

              {/* ── Notes ── */}
              {patientNotes && !/^investigations?:/i.test(patientNotes.trim()) && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: '#003366', marginBottom: 3 }}>NOTES</div>
                  <div style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: '#374151', paddingLeft: 4, borderLeft: '2px solid #93c5fd' }}>{patientNotes}</div>
                </div>
              )}

              {labRemarks && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: '#003366', marginBottom: 3 }}>LAB REMARKS</div>
                  <div style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: '#374151', paddingLeft: 4, borderLeft: '2px solid #86efac' }}>{labRemarks}</div>
                </div>
              )}

              {/* ── Advice ── */}
              {(advice || selectedAdvice.length > 0) && printOnPrescription && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: '#003366', marginBottom: 3 }}>ADVICE</div>
                  <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.6 }}>
                    {[
                      ...(advice
                        ? String(advice)
                          .split(/\r?\n+/)
                          .map(s => s.trim())
                          .filter(Boolean)
                        : []),
                      ...(Array.isArray(selectedAdvice)
                        ? selectedAdvice.map(s => String(s).trim()).filter(Boolean)
                        : []),
                    ].map((line, li) => <div key={li}>{line}</div>)}
                  </div>
                </div>
              )}

              {/* ── Follow Up ── */}
              {(followUp.days || followUp.date) && (
                <div style={{ marginTop: 10, padding: '5px 10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#15803d' }}>FOLLOW UP: </span>
                  {(() => { const d = parseInt(followUp.days, 10); return d > 0 ? `In ${d} day(s)${followUp.date ? ', ' : ''}` : ''; })()}
                  {followUp.date && `on ${new Date(followUp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </div>
              )}

              {/* ── Referred To ── */}
              {referredDoctor && (
                <div style={{ marginTop: 12, padding: '8px 12px', background: '#eef2ff', border: '1px solid #a5b4fc', borderRadius: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 11, color: '#4338ca', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Referred To</div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e1b4b' }}>Dr. {referredDoctor.name}</div>
                      <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
                        {[referredDoctor.specialty, referredDoctor.hospital].filter(Boolean).join(' • ')}
                      </div>
                      {referredDoctor.phone && (
                        <div style={{ fontSize: 11, color: '#4b5563', marginTop: 1 }}>Contact: {referredDoctor.phone}</div>
                      )}
                      {referredDoctor.notes && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, fontStyle: 'italic' }}>Note: {referredDoctor.notes}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Signature ── */}
              <div style={{ marginTop: '8mm', textAlign: 'right', paddingRight: '6mm' }}>
                <div style={{ borderTop: '1px solid #333', width: 110, marginLeft: 'auto', marginBottom: '1.5mm' }} />
                <div style={{ fontWeight: 700, fontSize: 12 }}>Dr. {user?.name || 'Doctor'}</div>
                {user?.specialization && <div style={{ fontSize: 10, color: '#555' }}>{user.specialization}</div>}
                {user?.qualification && <div style={{ fontSize: 10, color: '#555' }}>{user.qualification}</div>}
              </div>
            </div>
          </Letterhead>
            </Suspense>
          ) : (
            <Suspense fallback={<div>Loading compact format...</div>}>
              <PrescriptionA5Format
              prescriptionData={{
                date: meta.prescription_date,
                prescription_id: meta.prescription_id,
                vitals: vitals,
                symptoms: symptoms,
                diagnosis: diagnoses,
                medications: meds,
                advice: advice,
                selectedAdvice: selectedAdvice
              }}
              patientData={{
                name: printableName(patient),
                age: patient?.dob ? calculateAge(patient.dob) : 'N/A',
                gender: patient?.gender,
                phone: patient?.phone,
                patient_id: patient?.patient_id
              }}
              doctorData={{
                name: user?.name || 'Dr. Name',
                specialization: user?.specialization || ''
              }}
              clinicData={{
                name: 'Clinic Name',
                address: 'Clinic Address',
                phone: 'Clinic Phone'
              }}
            />
            </Suspense>
          )}
        </div>
      </div>

      {/* Specialty Selector Modal */}
      {showSpecialtySelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
              <Suspense fallback={<div className="p-6">Loading module...</div>}>
                <SpecialtySelector
                  patientData={{
                    age: patient?.dob ? calculateAge(patient.dob) : null,
                    weight: vitals.weight,
                    height: vitals.height,
                    ...patient
                  }}
                  onDataChange={handleSpecialtyDataChange}
                  onClose={() => setShowSpecialtySelector(false)}
                />
              </Suspense>
          </div>
        </div>
      )}

      {/* Lab Results Modal */}
      {showLabResultsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-semibold">Previous Lab Results</h2>
              <button
                onClick={() => setShowLabResultsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="p-6">
              {previousLabResults.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No previous lab results found</p>
              ) : (
                <div className="space-y-4">
                  {previousLabResults.map((result, idx) => (
                    <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">{result.test_name || result.test}</h3>
                          <p className="text-sm text-gray-600">
                            Date: {new Date(result.date || result.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-3 py-1 text-sm rounded-full ${
                          result.status === 'completed' ? 'bg-green-100 text-green-800' :
                          result.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {result.status || 'Pending'}
                        </span>
                      </div>
                      {result.result && (
                        <div className="mt-2 p-3 bg-gray-50 rounded">
                          <p className="text-sm font-medium text-gray-700">Result:</p>
                          <p className="text-sm mt-1">{result.result}</p>
                        </div>
                      )}
                      {result.notes && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">{result.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowLabResultsModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Symptoms Template Selector Modal */}
      {showTemplateSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Select Symptoms Template</h2>
              <button
                onClick={() => setShowTemplateSelector(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {symptomsTemplates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No templates available. Create templates in Settings.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {symptomsTemplates.map((template) => {
                    const templateSymptoms = Array.isArray(template.symptoms)
                      ? template.symptoms
                      : JSON.parse(template.symptoms || '[]');

                    return (
                      <div
                        key={template.id}
                        onClick={() => applySymptomTemplate(template)}
                        className="border rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm">{template.name}</h3>
                            {template.category && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                {template.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {template.description && (
                          <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {templateSymptoms.slice(0, 4).map((symptom, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {symptom}
                            </span>
                          ))}
                          {templateSymptoms.length > 4 && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                              +{templateSymptoms.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowTemplateSelector(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Examination Findings Template Modal */}
      {showExaminationTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Examination Findings Templates</h2>
              <button
                onClick={() => setShowExaminationTemplateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {/* Doctor's Custom Templates */}
              {customExamTemplates.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-blue-700 mb-2">Your Custom Templates</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {customExamTemplates.map((template, idx) => (
                      <div
                        key={`custom-${idx}`}
                        className="border rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition relative group"
                      >
                        <div onClick={() => {
                          // Parse and add template findings
                          const allText = `${template.general} ${template.systemic}`.trim();
                          allText.split('.').forEach(sentence => {
                            const trimmed = sentence.trim();
                            if (trimmed) {
                              addExamFinding(trimmed);
                            }
                          });
                          setShowExaminationTemplateModal(false);
                        }}>
                          <h3 className="font-semibold text-sm mb-1 text-blue-800">{template.name}</h3>
                          <p className="text-xs text-gray-600 line-clamp-2">{template.general}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = customExamTemplates.filter((_, i) => i !== idx);
                            setCustomExamTemplates(updated);
                            localStorage.setItem('custom_exam_templates', JSON.stringify(updated));
                            addToast('Template deleted', 'info');
                          }}
                          className="absolute top-1 right-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition text-sm px-1.5 py-0.5"
                          title="Delete template"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Default Templates */}
              <div>
                <h4 className="text-xs font-semibold text-gray-600 mb-2">Default Templates</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { name: 'Normal General Exam', general: 'Patient is conscious, oriented, afebrile. No pallor, icterus, cyanosis, clubbing, lymphadenopathy, edema.', systemic: 'CVS: S1S2 normal, no murmur. RS: Bilateral air entry equal, no added sounds. P/A: Soft, non-tender, no organomegaly. CNS: No focal neurological deficit.' },
                    { name: 'Fever Workup', general: 'Patient is febrile (temp recorded). Mild dehydration noted. No rash, no lymphadenopathy.', systemic: 'Throat: Congested. RS: Clear. P/A: Soft, no tenderness. No signs of meningeal irritation.' },
                    { name: 'Respiratory Exam', general: 'Patient appears comfortable at rest. Using accessory muscles - No. Cyanosis - No.', systemic: 'RS: Bilateral air entry present. Rhonchi/Crepitations heard in ___. Wheeze - Present/Absent. CVS: S1S2 normal.' },
                    { name: 'Abdominal Exam', general: 'Patient is conscious, oriented. No pallor, no icterus. Vital signs stable.', systemic: 'P/A: Soft/Distended, Tenderness in ___ quadrant. Bowel sounds: Present/Absent. No organomegaly. No guarding or rigidity.' },
                    { name: 'Cardiac Exam', general: 'Patient is comfortable at rest. JVP - Normal/Raised. Pedal edema - Present/Absent.', systemic: 'CVS: Apex beat in 5th ICS MCL. S1S2 heard. Murmur - Present/Absent. RS: Bilateral basal crepitations - Present/Absent.' },
                    { name: 'Musculoskeletal', general: 'Patient ambulatory. Gait - Normal/Antalgic. No obvious deformity.', systemic: 'Local examination: Swelling/Tenderness over ___. ROM - Limited/Full. Power - ___/5. Sensation intact.' },
                  ].map((template) => (
                    <div
                      key={template.name}
                      onClick={() => {
                        // Parse and add template findings
                        const allText = `${template.general} ${template.systemic}`.trim();
                        allText.split('.').forEach(sentence => {
                          const trimmed = sentence.trim();
                          if (trimmed) {
                            addExamFinding(trimmed);
                          }
                        });
                        setShowExaminationTemplateModal(false);
                      }}
                      className="border rounded-lg p-3 hover:border-green-500 hover:bg-green-50 cursor-pointer transition"
                    >
                      <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
                      <p className="text-xs text-gray-600 line-clamp-2">{template.general}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Current as Template */}
              {showSaveExamTemplate ? (
                <div className="border-t pt-3">
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">Save Current Findings as Template</h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 border rounded text-sm"
                      placeholder="Template name..."
                      value={examTemplateName}
                      onChange={(e) => setExamTemplateName(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        if (!examTemplateName.trim()) { addToast('Enter template name', 'error'); return; }
                        if (!generalExamination && !systemicExamination) { addToast('Fill examination findings first', 'error'); return; }
                        const newTemplate = { name: examTemplateName, general: generalExamination, systemic: systemicExamination };
                        const updated = [...customExamTemplates, newTemplate];
                        setCustomExamTemplates(updated);
                        localStorage.setItem('custom_exam_templates', JSON.stringify(updated));
                        setExamTemplateName('');
                        setShowSaveExamTemplate(false);
                        addToast('Template saved', 'success');
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >Save</button>
                    <button
                      onClick={() => setShowSaveExamTemplate(false)}
                      className="px-3 py-2 border rounded text-sm hover:bg-gray-100"
                    >Cancel</button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex justify-between gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowSaveExamTemplate(true)}
                className="px-4 py-2 text-sm text-green-700 border border-green-300 rounded hover:bg-green-50"
                disabled={!generalExamination && !systemicExamination}
              >
                + Save Current as Template
              </button>
              <button
                onClick={() => setShowExaminationTemplateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lab Test Template Selector Modal */}
      {showLabTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {labParamFormTest ? `Fill Results: ${labParamFormTest.test_name}` : 'Select Lab Tests'}
              </h2>
              <button onClick={() => { setShowLabTemplateModal(false); setLabParamFormTest(null); setLabParamFormData([]); setLabSearchQuery(''); }} className="p-1 hover:bg-gray-100 rounded">
                <FiX size={20} />
              </button>
            </div>

            {/* Parameter Form View */}
            {labParamFormTest ? (
              <>
                <div className="overflow-y-auto flex-1 p-4">
                  <div className="mb-3 p-3 bg-purple-50 rounded-lg">
                    <div className="text-sm font-semibold text-purple-800">{labParamFormTest.test_name}</div>
                    <div className="text-xs text-purple-600">{labParamFormTest.category} | Sample: {labParamFormTest.sample_type || 'Blood'}</div>
                  </div>
                  {labParamLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading parameters...</div>
                  ) : labParamFormData.length > 0 ? (
                    <div className="border rounded overflow-hidden">
                      <div className="grid grid-cols-12 bg-gray-100 text-xs font-semibold text-gray-700 px-3 py-2 gap-2">
                        <span className="col-span-4">Parameter</span>
                        <span className="col-span-3">Result Value</span>
                        <span className="col-span-2">Unit</span>
                        <span className="col-span-3">Reference Range</span>
                      </div>
                      {labParamFormData.map((param, idx) => (
                        <div key={idx} className="grid grid-cols-12 px-3 py-2 text-sm border-t items-center gap-2">
                          <div className="col-span-4">
                            <div className="text-xs font-medium">{param.parameter_name}</div>
                            {param.short_name && param.short_name !== param.parameter_name && (
                              <div className="text-[10px] text-gray-400">{param.short_name}</div>
                            )}
                          </div>
                          <div className="col-span-3">
                            <input
                              type="text"
                              className="w-full px-2 py-1.5 border rounded text-xs focus:ring-1 focus:ring-purple-400 focus:border-purple-400"
                              placeholder="Enter value"
                              value={param.result_value || ''}
                              onChange={(e) => {
                                const updated = [...labParamFormData];
                                updated[idx].result_value = e.target.value;
                                setLabParamFormData(updated);
                              }}
                            />
                          </div>
                          <span className="col-span-2 text-xs text-gray-500">{param.unit || '-'}</span>
                          <span className="col-span-3 text-xs text-gray-500">{param.reference_range || '-'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4">
                      <p className="text-gray-500 text-sm mb-4">No predefined parameters for this test. Enter result manually:</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Result Value</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                            placeholder="e.g., 110"
                            value={labParamFormTest.result_value || ''}
                            onChange={(e) => setLabParamFormTest(prev => ({ ...prev, result_value: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                            placeholder="e.g., mg/dL"
                            value={labParamFormTest.result_unit || ''}
                            onChange={(e) => setLabParamFormTest(prev => ({ ...prev, result_unit: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Reference Range</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                            placeholder="e.g., 70-100"
                            value={labParamFormTest.reference_range || ''}
                            onChange={(e) => setLabParamFormTest(prev => ({ ...prev, reference_range: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                          <input
                            type="date"
                            className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                            value={labParamFormTest.result_date || getLocalDateString()}
                            onChange={(e) => setLabParamFormTest(prev => ({ ...prev, result_date: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes / Remarks */}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Remarks / Notes</label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                      placeholder="Optional remarks..."
                      value={labParamFormTest?.notes || ''}
                      onChange={(e) => setLabParamFormTest(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-between gap-3 p-4 border-t bg-gray-50">
                  <button
                    type="button"
                    onClick={() => { setLabParamFormTest(null); setLabParamFormData([]); }}
                    className="px-4 py-2 border rounded hover:bg-gray-100 text-sm"
                  >
                    ← Back to Tests
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const entry = {
                        test_name: labParamFormTest.test_name,
                        test_code: labParamFormTest.test_code,
                        result_value: labParamFormTest.result_value || '',
                        result_unit: labParamFormTest.result_unit || labParamFormTest.unit || '',
                        reference_range: labParamFormTest.reference_range || '',
                        notes: labParamFormTest.notes || '',
                        category: labParamFormTest.category || '',
                        sample_type: labParamFormTest.sample_type || '',
                        lab_template_id: labParamFormTest.id,
                        parameters: labParamFormData.filter(p => p.result_value).map(p => ({
                          parameter_name: p.parameter_name,
                          loinc_num: p.loinc_num,
                          result_value: p.result_value,
                          unit: p.unit || '',
                          reference_range: p.reference_range || ''
                        }))
                      };
                      const resultDate = labParamFormTest.result_date || getLocalDateString();
                      const filledParams = labParamFormData.filter(p => p.result_value);
                      // Save each parameter as separate DB row (report_group = parent test name for grouping)
                      if (filledParams.length > 0) {
                        const savedIds = [];
                        for (let i = 0; i < filledParams.length; i++) {
                          const param = filledParams[i];
                          try {
                            const resp = await api.post(`/api/labs/${patientId}`, {
                              test_name: param.parameter_name,
                              result_value: param.result_value,
                              result_unit: param.unit || '',
                              reference_range: param.reference_range || '',
                              notes: i === 0 ? (entry.notes || '') : '',
                              test_category: entry.category || 'GENERAL',
                              result_date: resultDate,
                              report_group: entry.test_name
                            });
                            savedIds.push(resp.data.id);
                          } catch (err) {
                            console.error('Failed to save parameter:', err);
                          }
                        }
                        entry.id = savedIds[0] || null;
                        entry.paramIds = savedIds;
                      } else {
                        try {
                          const resp = await api.post(`/api/labs/${patientId}`, {
                            test_name: entry.test_name,
                            result_value: entry.result_value,
                            result_unit: entry.result_unit,
                            reference_range: entry.reference_range,
                            notes: entry.notes,
                            test_category: entry.category || 'GENERAL',
                            result_date: resultDate,
                            report_group: 'Prescription'
                          });
                          entry.id = resp.data.id;
                        } catch (err) {
                          console.error('Failed to save lab result:', err);
                        }
                      }
                      setLabResultEntries(prev => [...prev, entry]);
                      addToast(`${labParamFormTest.test_name} added with results`, 'success');
                      setLabParamFormTest(null);
                      setLabParamFormData([]);
                      setShowLabTemplateModal(false);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                  >
                    Add to Prescription
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Search and Category Filter */}
                <div className="p-4 border-b space-y-3">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                    placeholder="Search lab tests by name or code..."
                    value={labSearchQuery}
                    onChange={(e) => setLabSearchQuery(e.target.value)}
                    autoComplete="off"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLabCategory('')}
                      className={`px-3 py-1 text-xs rounded-full border transition ${!selectedLabCategory ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-purple-50 border-gray-300'}`}
                    >
                      All
                    </button>
                    {labTemplateCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedLabCategory(cat)}
                        className={`px-3 py-1 text-xs rounded-full border transition ${selectedLabCategory === cat ? 'bg-purple-600 text-white border-purple-600' : 'hover:bg-purple-50 border-gray-300'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Test List */}
                <div className="overflow-y-auto flex-1 p-4">
                  {/* Custom Tests from PatientOverview */}
                  {(customLabTestsFromOverview || []).filter(ct => !labSearchQuery || (ct.test_name || '').toLowerCase().includes(labSearchQuery.toLowerCase())).length > 0 && (
                    <div className="mb-4">
                      <div className="px-3 py-2 text-xs font-semibold bg-orange-100 text-orange-700 rounded-t">Saved Custom Tests from Patient Overview</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2 border border-orange-200 rounded-b bg-orange-50/30">
                        {(customLabTestsFromOverview || [])
                          .filter(ct => !labSearchQuery || (ct.test_name || '').toLowerCase().includes(labSearchQuery.toLowerCase()))
                          .map(ct => {
                            const alreadyAdded = labResultEntries.some(e => e.test_name === ct.test_name);
                            return (
                              <button
                                key={`custom-modal-${ct.id}`}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomTest(ct);
                                  setCustomTestForm({ test_name: ct.test_name, remark: '', result_value: '', unit: '', reference_range: '', result_date: getLocalDateString() });
                                  setShowCustomTestModal(true);
                                }}
                                disabled={false}
                                className={`text-left p-2 rounded border text-sm transition ${alreadyAdded ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-orange-50 border-orange-200'}`}
                              >
                                <div className="font-medium text-xs flex items-center gap-1">
                                  {ct.test_name}
                                  <span className="text-[10px] bg-orange-200 text-orange-700 px-1 rounded">Custom</span>
                                </div>
                                {ct.result_value && <div className="text-[10px] text-gray-500">{ct.result_value} {ct.unit || ''}</div>}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(labTemplates || [])
                      .filter(t => !selectedLabCategory || t.category === selectedLabCategory)
                      .filter(t => !labSearchQuery || (t.test_name || '').toLowerCase().includes(labSearchQuery.toLowerCase()) || ((t.test_code || '').toLowerCase().includes(labSearchQuery.toLowerCase())))
                      .sort((a, b) => {
                        const q = (labSearchQuery || '').trim();
                        const ra = Math.min(rankMatch(a?.test_name, q), rankMatch(a?.test_code, q));
                        const rb = Math.min(rankMatch(b?.test_name, q), rankMatch(b?.test_code, q));
                        if (ra !== rb) return ra - rb;
                        return (a.test_name || '').localeCompare(b.test_name || '');
                      })
                      .slice(0, 150)
                      .map(t => {
                        const alreadyAdded = labResultEntries.some(e => e.test_name === t.test_name);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={async () => {
                              if (alreadyAdded) return;
                              // Fetch parameters for this test
                              setLabParamLoading(true);
                              setLabParamFormTest(t);
                              try {
                                const res = await api.get(`/api/lab-templates/${t.id}/parameters`);
                                const params = res.data.parameters || [];
                                setLabParamFormData(params.map(p => ({ ...p, result_value: '' })));
                              } catch (err) {
                                console.error('Failed to fetch parameters:', err);
                                setLabParamFormData([]);
                              }
                              setLabParamLoading(false);
                            }}
                            disabled={alreadyAdded}
                            className={`text-left p-2 border rounded text-sm transition ${
                              alreadyAdded ? 'bg-green-50 border-green-300 opacity-60' : 'hover:bg-purple-50 hover:border-purple-300'
                            }`}
                          >
                            <div className="font-medium text-xs">{t.test_name}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {t.category && <span className="text-purple-600">{t.category}</span>}
                              {t.sample_type && <span> · {t.sample_type}</span>}
                            </div>
                            {alreadyAdded && <span className="text-[10px] text-green-600">✓ Added</span>}
                          </button>
                        );
                      })}
                  </div>
                </div>
                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                  <button
                    onClick={() => { setShowLabTemplateModal(false); setLabSearchQuery(''); }}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lab Advice Groups Modal (Lab Test Advice) */}
      {showLabAdviceGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLabAdviceGroupModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Lab Test Groups</h2>
              <div className="flex items-center gap-2">
                {labAdviceGroupTab === 'groups' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowLabAdviceGroupForm(true);
                      setEditingLabAdviceGroup(null);
                      setLabAdviceGroupName('');
                      setLabAdviceGroupTests([]);
                      setLabAdviceGroupSearch('');
                    }}
                    className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100"
                  >
                    + New Group
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowLabAdviceGroupModal(false)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-500"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => { setLabAdviceGroupTab('groups'); setShowLabAdviceGroupForm(false); }}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${labAdviceGroupTab === 'groups' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Groups
                {labAdviceGroups.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">{labAdviceGroups.length}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setLabAdviceGroupTab('tests'); setShowLabAdviceGroupForm(false); }}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${labAdviceGroupTab === 'tests' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                All Tests
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b">
              <input
                type="text"
                autoComplete="off"
                className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                placeholder={labAdviceGroupTab === 'groups' ? 'Search groups/tests...' : 'Search tests...'}
                value={labAdviceGroupSearch}
                onChange={(e) => setLabAdviceGroupSearch(e.target.value)}
              />
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {(() => {
                const addTestsToAdvice = (tests) => {
                  const names = (tests || []).map(t => (typeof t === 'string' ? t : t?.test_name || t?.name || '')).map(s => String(s).trim()).filter(Boolean);
                  if (names.length === 0) return;
                  setLabAdvice((prev) => {
                    const current = (prev || '').split(',').map(s => s.trim()).filter(Boolean);
                    const set = new Set(current.map(s => s.toLowerCase()));
                    const next = [...current];
                    for (const n of names) {
                      const key = n.toLowerCase();
                      if (!set.has(key)) {
                        set.add(key);
                        next.push(n);
                      }
                    }
                    return next.join(', ');
                  });
                };

                const filteredTemplates = (labTemplates || [])
                  .filter(t => !labAdviceGroupSearch || (t.test_name || '').toLowerCase().includes(labAdviceGroupSearch.toLowerCase()) || (t.test_code || '').toLowerCase().includes(labAdviceGroupSearch.toLowerCase()))
                  .slice(0, 200);

                if (labAdviceGroupTab === 'tests') {
                  if (filteredTemplates.length === 0) {
                    return <p className="text-sm text-gray-500 text-center py-10">No tests found.</p>;
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {filteredTemplates.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { addTestsToAdvice([t.test_name]); addToast(`${t.test_name} added`, 'success'); }}
                          className="text-left p-2 border rounded hover:bg-purple-50 hover:border-purple-300 transition"
                        >
                          <div className="font-medium text-xs">{t.test_name}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {t.category && <span className="text-purple-600">{t.category}</span>}
                            {t.test_code && <span className="ml-2">{t.test_code}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                }

                // groups tab
                const groupsFiltered = (labAdviceGroups || []).filter(g => {
                  if (!labAdviceGroupSearch) return true;
                  const q = labAdviceGroupSearch.toLowerCase();
                  const nameHit = (g.group_name || '').toLowerCase().includes(q);
                  const tests = Array.isArray(g.tests) ? g.tests : [];
                  const testHit = tests.some(t => String(t || '').toLowerCase().includes(q));
                  return nameHit || testHit;
                });

                return (
                  <div className="space-y-4">
                    {/* Create/Edit form */}
                    {showLabAdviceGroupForm && (
                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-purple-800">
                            {editingLabAdviceGroup ? 'Edit Group' : 'Create New Group'}
                          </p>
                          <button
                            type="button"
                            className="text-xs text-purple-700 hover:underline"
                            onClick={() => { setShowLabAdviceGroupForm(false); setEditingLabAdviceGroup(null); }}
                          >
                            Close
                          </button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Group Name *</label>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border rounded text-sm focus:ring-1 focus:ring-purple-400"
                              placeholder="e.g., Thyroid Panel, Diabetes Package"
                              value={labAdviceGroupName}
                              onChange={(e) => setLabAdviceGroupName(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Selected Tests</label>
                            <div className="min-h-[38px] bg-white border rounded p-2 flex flex-wrap gap-1">
                              {labAdviceGroupTests.length === 0 ? (
                                <span className="text-xs text-gray-400">No tests selected</span>
                              ) : (
                                labAdviceGroupTests.slice(0, 8).map((t, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                    {t}
                                  </span>
                                ))
                              )}
                              {labAdviceGroupTests.length > 8 && (
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">+{labAdviceGroupTests.length - 8} more</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Pick tests</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                            {filteredTemplates.map(t => {
                              const checked = labAdviceGroupTests.includes(t.test_name);
                              return (
                                <button
                                  key={`pick-${t.id}`}
                                  type="button"
                                  onClick={() => {
                                    setLabAdviceGroupTests(prev => {
                                      const cur = Array.isArray(prev) ? prev : [];
                                      if (cur.includes(t.test_name)) return cur.filter(x => x !== t.test_name);
                                      return [...cur, t.test_name];
                                    });
                                  }}
                                  className={`text-left p-2 border rounded transition ${checked ? 'bg-purple-100 border-purple-300' : 'hover:bg-purple-50 hover:border-purple-300'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`w-4 h-4 inline-flex items-center justify-center border rounded text-[10px] ${checked ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-400'}`}>
                                      {checked ? '✓' : ''}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="font-medium text-xs truncate">{t.test_name}</div>
                                      <div className="text-[10px] text-gray-500 truncate">{t.category || 'Other'}</div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                          <button
                            type="button"
                            className="px-3 py-2 text-sm border rounded hover:bg-white"
                            onClick={() => {
                              setShowLabAdviceGroupForm(false);
                              setEditingLabAdviceGroup(null);
                              setLabAdviceGroupName('');
                              setLabAdviceGroupTests([]);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                            onClick={async () => {
                              if (!labAdviceGroupName.trim()) { addToast('Group name required', 'error'); return; }
                              if (labAdviceGroupTests.length === 0) { addToast('Select at least 1 test', 'error'); return; }
                              try {
                                if (editingLabAdviceGroup?.id) {
                                  await api.put(`/api/lab-advice-groups/${editingLabAdviceGroup.id}`, {
                                    group_name: labAdviceGroupName.trim(),
                                    tests: labAdviceGroupTests
                                  });
                                  addToast('Group updated', 'success');
                                } else {
                                  await api.post('/api/lab-advice-groups', {
                                    group_name: labAdviceGroupName.trim(),
                                    tests: labAdviceGroupTests
                                  });
                                  addToast('Group created', 'success');
                                }
                                const ref = await api.get('/api/lab-advice-groups');
                                setLabAdviceGroups(Array.isArray(ref.data?.groups) ? ref.data.groups : []);
                                setShowLabAdviceGroupForm(false);
                                setEditingLabAdviceGroup(null);
                                setLabAdviceGroupName('');
                                setLabAdviceGroupTests([]);
                              } catch (e) {
                                addToast('Failed to save group', 'error');
                              }
                            }}
                          >
                            {editingLabAdviceGroup ? 'Save' : 'Create'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Groups List */}
                    {groupsFiltered.length === 0 ? (
                      <div className="text-center py-10 text-gray-500">
                        <div className="text-3xl mb-2">📦</div>
                        <p className="text-sm">No groups found.</p>
                        <p className="text-xs mt-1">Create one using “+ New Group”.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {groupsFiltered.map(g => {
                          const tests = Array.isArray(g.tests) ? g.tests : [];
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => { addTestsToAdvice(tests); addToast(`${g.group_name} added`, 'success'); }}
                              className="text-left border-2 border-purple-200 rounded-lg p-3 hover:border-purple-500 hover:bg-purple-50 transition relative"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-semibold text-sm text-gray-900">{g.group_name}</div>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className="px-2 py-1 text-[10px] border rounded hover:bg-white"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingLabAdviceGroup(g);
                                      setLabAdviceGroupName(g.group_name || '');
                                      setLabAdviceGroupTests(Array.isArray(g.tests) ? g.tests : []);
                                      setShowLabAdviceGroupForm(true);
                                      setLabAdviceGroupSearch('');
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-1 text-[10px] border border-red-200 text-red-700 rounded hover:bg-red-50"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (!confirm(`Delete group "${g.group_name}"?`)) return;
                                      try {
                                        await api.delete(`/api/lab-advice-groups/${g.id}`);
                                        addToast('Group deleted', 'success');
                                        setLabAdviceGroups(prev => (prev || []).filter(x => x.id !== g.id));
                                      } catch (err) {
                                        addToast('Failed to delete group', 'error');
                                      }
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {tests.slice(0, 6).map((t, i) => (
                                  <span key={i} className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{t}</span>
                                ))}
                                {tests.length > 6 && (
                                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">+{tests.length - 6} more</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-2">{tests.length} tests</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t flex justify-end bg-gray-50">
              <button
                type="button"
                onClick={() => setShowLabAdviceGroupModal(false)}
                className="px-5 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refer Doctor Modal */}
      {showReferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Refer Patient to Doctor</h2>
              <button onClick={() => setShowReferModal(false)} className="p-1 hover:bg-gray-100 rounded"><FiX size={20} /></button>
            </div>

            <div className="space-y-4 p-4">
              {/* Select from network */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor from Network</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  value={referralForm.selectedDoctor}
                  onChange={(e) => {
                    const docId = e.target.value;
                    if (docId === 'new') {
                      setReferralForm(prev => ({ ...prev, selectedDoctor: 'new', referred_doctor_name: '', referred_doctor_phone: '', referred_doctor_specialization: '', hospital_name: '' }));
                    } else if (docId) {
                      const doc = referralNetwork.find(d => String(d.id) === docId);
                      if (doc) {
                        setReferralForm(prev => ({
                          ...prev,
                          selectedDoctor: docId,
                          referred_doctor_name: doc.network_doctor_name || '',
                          referred_doctor_phone: doc.network_doctor_phone || '',
                          referred_doctor_specialization: doc.specialization || '',
                          hospital_name: doc.hospital_name || ''
                        }));
                      }
                    } else {
                      setReferralForm(prev => ({ ...prev, selectedDoctor: '' }));
                    }
                  }}
                >
                  <option value="">-- Select Doctor --</option>
                  {referralLoading && <option disabled>Loading...</option>}
                  {referralNetwork.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.network_doctor_name}{doc.specialization ? ` (${doc.specialization})` : ''}{doc.hospital_name ? ` - ${doc.hospital_name}` : ''}
                    </option>
                  ))}
                  <option value="new">+ Add New Doctor</option>
                </select>
              </div>

              {/* Doctor details (editable if new or selected) */}
              {(referralForm.selectedDoctor === 'new' || referralForm.selectedDoctor) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Doctor Name *</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" value={referralForm.referred_doctor_name}
                      onChange={e => setReferralForm(prev => ({ ...prev, referred_doctor_name: e.target.value }))} placeholder="Dr. Name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" value={referralForm.referred_doctor_phone}
                      onChange={e => setReferralForm(prev => ({ ...prev, referred_doctor_phone: e.target.value }))} placeholder="Phone number" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Specialization</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" value={referralForm.referred_doctor_specialization}
                      onChange={e => setReferralForm(prev => ({ ...prev, referred_doctor_specialization: e.target.value }))} placeholder="e.g. Cardiologist" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hospital</label>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" value={referralForm.hospital_name}
                      onChange={e => setReferralForm(prev => ({ ...prev, hospital_name: e.target.value }))} placeholder="Hospital name" />
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Referral *</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" value={referralForm.reason}
                  onChange={e => setReferralForm(prev => ({ ...prev, reason: e.target.value }))} placeholder="e.g., Further cardiac evaluation" />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="rx-refer-priority" value="routine" checked={referralForm.priority === 'routine'}
                      onChange={() => setReferralForm(prev => ({ ...prev, priority: 'routine' }))} className="accent-blue-600" />
                    <span className="text-sm">Routine</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="rx-refer-priority" value="urgent" checked={referralForm.priority === 'urgent'}
                      onChange={() => setReferralForm(prev => ({ ...prev, priority: 'urgent' }))} className="accent-red-600" />
                    <span className="text-sm text-red-600 font-medium">Urgent</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" rows={3} value={referralForm.notes}
                  onChange={e => setReferralForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Additional notes..." />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {referredDoctor && (
                  <button type="button" className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
                    onClick={() => { setReferredDoctor(null); setShowReferModal(false); setReferralForm({ selectedDoctor: '', referred_doctor_name: '', referred_doctor_phone: '', referred_doctor_specialization: '', hospital_name: '', reason: '', priority: 'routine', notes: '' }); if (patientId) localStorage.removeItem(`referredDoctor_${patientId}`); }}>
                    Remove Referral
                  </button>
                )}
                <button onClick={() => setShowReferModal(false)} className="flex-1 px-4 py-2 border rounded text-sm hover:bg-gray-50">Cancel</button>
                <button
                  disabled={referralLoading || !referralForm.referred_doctor_name || !referralForm.reason}
                  onClick={async () => {
                    setReferralLoading(true);
                    try {
                      await api.post('/api/patient-referrals', {
                        patient_id: parseInt(patientId),
                        referred_doctor_name: referralForm.referred_doctor_name,
                        referred_doctor_phone: referralForm.referred_doctor_phone,
                        referred_doctor_specialization: referralForm.referred_doctor_specialization,
                        hospital_name: referralForm.hospital_name,
                        referral_date: getLocalDateString(),
                        reason: referralForm.reason,
                        priority: referralForm.priority,
                        notes: referralForm.notes
                      });
                      // Save new doctor to network
                      if (referralForm.selectedDoctor === 'new' && referralForm.referred_doctor_name) {
                        try {
                          await api.post('/api/patient-referrals/network/doctors', {
                            network_doctor_name: referralForm.referred_doctor_name,
                            network_doctor_phone: referralForm.referred_doctor_phone,
                            specialization: referralForm.referred_doctor_specialization,
                            hospital_name: referralForm.hospital_name
                          });
                        } catch (e) { /* ignore */ }
                      }
                      // Set for display on pad & print
                      setReferredDoctor({
                        name: referralForm.referred_doctor_name,
                        specialty: referralForm.referred_doctor_specialization,
                        phone: referralForm.referred_doctor_phone,
                        hospital: referralForm.hospital_name,
                        notes: [referralForm.reason, referralForm.priority === 'urgent' ? '⚠️ URGENT' : '', referralForm.notes].filter(Boolean).join(' | ')
                      });
                      addToast('Referral saved successfully!', 'success');
                      setShowReferModal(false);
                    } catch (err) {
                      addToast(err.response?.data?.error || 'Failed to save referral', 'error');
                    } finally {
                      setReferralLoading(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {referralLoading ? 'Saving...' : 'Save Referral'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal for Lab Results & Medical Records */}
      {showRecordUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Upload File</h2>
              <button onClick={() => setShowRecordUploadModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!recordUploadForm.file) { addToast('Please select a file', 'error'); return; }
              if (!recordUploadForm.name.trim()) { addToast('Please enter a record name', 'error'); return; }
              setRecordUploadLoading(true);
              try {
                const formData = new FormData();
                formData.append('file', recordUploadForm.file);
                formData.append('name', recordUploadForm.name);
                formData.append('category', recordUploadForm.category);
                if (recordUploadForm.description) formData.append('description', recordUploadForm.description);
                const parsedId = parseInt(meta.patient_id || patientId);
                if (parsedId) {
                  await api.post(`/api/patient-data/records/${parsedId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                }
                setPrescriptionRecords(prev => [...prev, { name: recordUploadForm.name, category: recordUploadForm.category, description: recordUploadForm.description, file: recordUploadForm.file.name }]);
                addToast('Record uploaded successfully', 'success');
                setShowRecordUploadModal(false);
                setRecordUploadForm({ name: '', category: 'OTHERS', description: '', file: null });
              } catch (error) {
                console.error('Upload error:', error);
                addToast(error.response?.data?.error || 'Failed to upload record', 'error');
              } finally {
                setRecordUploadLoading(false);
              }
            }} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Record Name *</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" value={recordUploadForm.name} onChange={(e) => setRecordUploadForm({ ...recordUploadForm, name: e.target.value })} placeholder="e.g., Blood Test Report" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" value={recordUploadForm.category} onChange={(e) => setRecordUploadForm({ ...recordUploadForm, category: e.target.value })}>
                  <option value="OTHERS">Others</option>
                  <option value="BLOOD_TEST">Blood Test</option>
                  <option value="X_RAY">X-Ray</option>
                  <option value="MRI">MRI</option>
                  <option value="CT_SCAN">CT Scan</option>
                  <option value="ULTRASOUND">Ultrasound</option>
                  <option value="ECG">ECG</option>
                  <option value="PRESCRIPTION">Prescription</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <input type="file" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setRecordUploadForm({ ...recordUploadForm, file: e.target.files[0] })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" rows={2} value={recordUploadForm.description} onChange={(e) => setRecordUploadForm({ ...recordUploadForm, description: e.target.value })} placeholder="Optional description..." />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowRecordUploadModal(false)} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={recordUploadLoading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {recordUploadLoading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Record Modal for Lab Results & Medical Records */}
      {showAddRecordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Add Record</h2>
              <button onClick={() => setShowAddRecordModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!manualRecordForm.name.trim()) { addToast('Please enter a record name', 'error'); return; }
              setPrescriptionRecords(prev => [...prev, { name: manualRecordForm.name, category: manualRecordForm.category, description: manualRecordForm.description, date: manualRecordForm.date }]);
              addToast('Record added', 'success');
              setShowAddRecordModal(false);
              setManualRecordForm({ name: '', category: 'OTHERS', description: '', date: getLocalDateString() });
            }} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Record Name *</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" value={manualRecordForm.name} onChange={(e) => setManualRecordForm({ ...manualRecordForm, name: e.target.value })} placeholder="e.g., CBC Report" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" value={manualRecordForm.category} onChange={(e) => setManualRecordForm({ ...manualRecordForm, category: e.target.value })}>
                  <option value="OTHERS">Others</option>
                  <option value="BLOOD_TEST">Blood Test</option>
                  <option value="X_RAY">X-Ray</option>
                  <option value="MRI">MRI</option>
                  <option value="CT_SCAN">CT Scan</option>
                  <option value="ULTRASOUND">Ultrasound</option>
                  <option value="ECG">ECG</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" value={manualRecordForm.date} onChange={(e) => setManualRecordForm({ ...manualRecordForm, date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition" rows={2} value={manualRecordForm.description} onChange={(e) => setManualRecordForm({ ...manualRecordForm, description: e.target.value })} placeholder="Optional notes..." />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddRecordModal(false)} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diagnosis Template Selector Modal */}
      {showDiagnosisTemplateSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Select Diagnosis Template</h2>
              <button
                onClick={() => setShowDiagnosisTemplateSelector(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {diagnosisTemplates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No templates available. Create templates in Settings.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {diagnosisTemplates.map((template) => {
                    const templateDiagnoses = Array.isArray(template.diagnoses)
                      ? template.diagnoses
                      : JSON.parse(template.diagnoses || '[]');

                    return (
                      <div
                        key={template.id}
                        onClick={() => applyDiagnosisTemplate(template)}
                        className="border rounded-lg p-3 hover:border-purple-500 hover:bg-purple-50 cursor-pointer transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm">{template.name}</h3>
                            {template.category && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">
                                {template.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {template.description && (
                          <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {templateDiagnoses.slice(0, 4).map((diagnosis, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {diagnosis}
                            </span>
                          ))}
                          {templateDiagnoses.length > 4 && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                              +{templateDiagnoses.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowDiagnosisTemplateSelector(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medications Template Selector Modal */}
      {showMedicationsTemplateSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Select Medications Template</h2>
              <button
                onClick={() => setShowMedicationsTemplateSelector(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {medicationsTemplates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No templates available. Create templates in Settings.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {medicationsTemplates.map((template) => {
                    const templateMeds = Array.isArray(template.medications)
                      ? template.medications
                      : JSON.parse(template.medications || '[]');

                    return (
                      <div
                        key={template.id}
                        onClick={() => applyMedicationsTemplate(template)}
                        className="border rounded-lg p-3 hover:border-pink-500 hover:bg-pink-50 cursor-pointer transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm">{template.name}</h3>
                            {template.category && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-pink-100 text-pink-800 rounded">
                                {template.category}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm('Delete this template?')) return;
                              try {
                                await api.delete(`/api/medications-templates/${template.id}`);
                                setMedicationsTemplates(prev => prev.filter(t => t.id !== template.id));
                                addToast('Template deleted', 'success');
                              } catch (err) {
                                addToast('Failed to delete template', 'error');
                              }
                            }}
                            className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
                            title="Delete template"
                          >
                            <FiX size={14} />
                          </button>
                        </div>

                        {template.description && (
                          <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                        )}

                        <div className="space-y-1">
                          {templateMeds.slice(0, 3).map((med, idx) => (
                            <div key={idx} className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-1">
                              <div className="font-medium">{med.name || med.medication_name || med.brand || med.brand_name || ''}{med.composition ? ` - ${med.composition}` : ''}</div>
                              {med.is_tapering && Array.isArray(med.tapering_schedule) && med.tapering_schedule.length > 0 ? (
                                <div className="text-purple-600 mt-0.5">
                                  Tapering: {med.tapering_schedule.map(s => `${s.dose} ${s.frequency}`).join(' → ')}
                                </div>
                              ) : (med.frequency || med.duration) && (
                                <div className="text-gray-600">
                                  {med.frequency} {med.duration && `• ${med.duration}`}
                                </div>
                              )}
                            </div>
                          ))}
                          {templateMeds.length > 3 && (
                            <div className="text-xs text-gray-600 text-center py-1">
                              +{templateMeds.length - 3} more medications
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowMedicationsTemplateSelector(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medication Suggestion Modal */}
      {showMedicationSuggestionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">💊 Suggested Medications</h3>
              <button
                onClick={() => {
                  setShowMedicationSuggestionModal(false);
                  setPendingMedicationSuggestions([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">
                Select medications you want to add to the prescription. Duplicates have been filtered out.
              </p>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {pendingMedicationSuggestions.map((med, idx) => (
                  <label key={`med-${idx}-${med.name}`} className="flex items-start gap-3 p-3 border rounded hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked={true}
                      className="mt-1"
                      id={`med-check-${idx}`}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{med.brand || med.name}</div>
                      <div className="text-sm text-gray-600">{med.strength} {med.dosage_form}</div>
                      {med.frequency && (
                        <div className="text-xs text-gray-500 mt-1">
                          Frequency: {med.frequency}
                        </div>
                      )}
                      {med.duration && (
                        <div className="text-xs text-gray-500">
                          Duration: {med.duration}
                        </div>
                      )}
                      {med.instructions && (
                        <div className="text-xs text-blue-600 mt-1 font-medium">
                          💡 {med.instructions}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {pendingMedicationSuggestions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No medications to suggest
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowMedicationSuggestionModal(false);
                  setPendingMedicationSuggestions([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-700 font-medium"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  // Get all checked medications
                  const selectedMeds = [];
                  pendingMedicationSuggestions.forEach((med, idx) => {
                    const checkbox = document.getElementById(`med-check-${idx}`);
                    if (checkbox && checkbox.checked) {
                      selectedMeds.push(med);
                    }
                  });
                  handleAcceptMedicationSuggestions(selectedMeds);
                }}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 font-medium"
              >
                Add Selected ({pendingMedicationSuggestions.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-[fadeInScale_0.2s_ease] max-h-[90vh]"
               style={{ animation: 'fadeInUp 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>

            {/* ── Header ── */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-5 h-5">
                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-bold text-base leading-tight">Save as Template</h2>
                  <p className="text-white/70 text-xs mt-0.5">Reuse this prescription in future</p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors"
                aria-label="Close"
              >
                <FiX size={16} />
              </button>
            </div>

            {/* ── Form ── */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">

              {/* Template name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-400"
                  placeholder="e.g. Asthma Management"
                  maxLength={120}
                  autoFocus
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Category
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-400"
                    placeholder="e.g., Respiratory, Cardiac, Pediatric"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Description
                  <span className="ml-1.5 text-[10px] normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-400 resize-none"
                  rows={2}
                  placeholder="Brief description of this template..."
                />
              </div>

              {/* Summary preview */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
                <p className="text-xs font-semibold text-indigo-700 mb-2.5 flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                  </svg>
                  Template will include
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-white rounded-lg px-2.5 py-2 text-center border border-indigo-100">
                    <div className="text-lg font-bold text-indigo-600 leading-none">{meds.length}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 font-medium">Medicines</div>
                  </div>
                  <div className="bg-white rounded-lg px-2.5 py-2 text-center border border-indigo-100">
                    <div className="text-lg font-bold text-violet-600 leading-none">{symptoms.length}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 font-medium">Symptoms</div>
                  </div>
                  <div className="bg-white rounded-lg px-2.5 py-2 text-center border border-indigo-100">
                    <div className="text-lg font-bold text-blue-600 leading-none">{diagnoses.length}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 font-medium">Diagnoses</div>
                  </div>
                  <div className="bg-white rounded-lg px-2.5 py-2 text-center border border-indigo-100">
                    <div className="text-lg font-bold text-teal-600 leading-none">{labAdvice ? labAdvice.split(',').map(t => t.trim()).filter(Boolean).length : 0}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 font-medium">Lab Tests</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="inline-flex items-center gap-1 text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                    Advice &amp; Precautions
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                    Follow-up: {(typeof followUp.days === 'object' ? '' : followUp.days) || '—'} days
                  </span>
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/70 flex gap-3">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveAsTemplate}
                disabled={!templateName?.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Condition Modal */}
      {showAddConditionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">Add Existing Condition</h3>
              <button onClick={() => setShowAddConditionModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Condition Name *</label>
                <input
                  type="text"
                  value={newCondition.condition_name}
                  onChange={(e) => setNewCondition({ ...newCondition, condition_name: e.target.value })}
                  placeholder="e.g. Diabetes, Hypertension"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Since Date</label>
                <input
                  type="date"
                  value={newCondition.start_date}
                  onChange={(e) => setNewCondition({ ...newCondition, start_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={newCondition.notes}
                  onChange={(e) => setNewCondition({ ...newCondition, notes: e.target.value })}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t">
              <button onClick={() => setShowAddConditionModal(false)} className="flex-1 px-4 py-2 border rounded text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={addExistingCondition} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Add Condition</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Surgery Modal */}
      {showAddSurgeryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">Add Surgical History</h3>
              <button onClick={() => setShowAddSurgeryModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Surgery Name *</label>
                <input
                  type="text"
                  value={newSurgery.surgery_name}
                  onChange={(e) => setNewSurgery({ ...newSurgery, surgery_name: e.target.value })}
                  placeholder="e.g. Appendectomy, Knee replacement"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Surgery Date</label>
                <input
                  type="date"
                  value={newSurgery.surgery_date}
                  onChange={(e) => setNewSurgery({ ...newSurgery, surgery_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hospital</label>
                <input
                  type="text"
                  value={newSurgery.hospital}
                  onChange={(e) => setNewSurgery({ ...newSurgery, hospital: e.target.value })}
                  placeholder="Hospital name"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Surgeon</label>
                <input
                  type="text"
                  value={newSurgery.surgeon}
                  onChange={(e) => setNewSurgery({ ...newSurgery, surgeon: e.target.value })}
                  placeholder="Surgeon name"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t">
              <button onClick={() => setShowAddSurgeryModal(false)} className="flex-1 px-4 py-2 border rounded text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={addSurgicalProcedure} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Add Surgery</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Test Modal - Edit from PrescriptionPad */}
      {showCustomTestModal && selectedCustomTest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Custom Test: {selectedCustomTest.test_name}</h3>
              <button
                onClick={() => { setShowCustomTestModal(false); setSelectedCustomTest(null); }}
                className="text-gray-400 hover:text-gray-600"
              >✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
                <input
                  type="text"
                  value={customTestForm.test_name}
                  onChange={(e) => setCustomTestForm({ ...customTestForm, test_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Result Value</label>
                <input
                  type="text"
                  value={customTestForm.result_value}
                  onChange={(e) => setCustomTestForm({ ...customTestForm, result_value: e.target.value })}
                  placeholder="e.g., 120, Positive, Normal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={customTestForm.unit}
                  onChange={(e) => setCustomTestForm({ ...customTestForm, unit: e.target.value })}
                  placeholder="e.g., mg/dL, mmHg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Range</label>
                  <input
                    type="text"
                    value={customTestForm.reference_range}
                    onChange={(e) => setCustomTestForm({ ...customTestForm, reference_range: e.target.value })}
                    placeholder="e.g., 70-100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={customTestForm.result_date}
                    onChange={(e) => setCustomTestForm({ ...customTestForm, result_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remark / Notes</label>
                <textarea
                  value={customTestForm.remark}
                  onChange={(e) => setCustomTestForm({ ...customTestForm, remark: e.target.value })}
                  placeholder="Add any remarks or notes about this test..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={async () => {
                  try {
                    await api.delete(`/api/custom-lab-tests/${selectedCustomTest.id}`);
                    setCustomLabTestsFromOverview(prev => prev.filter(ct => ct.id !== selectedCustomTest.id));
                    addToast('Custom test removed', 'success');
                    setShowCustomTestModal(false);
                    setSelectedCustomTest(null);
                  } catch {
                    addToast('Failed to delete custom test', 'error');
                  }
                }}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
              >Delete</button>
              <button
                onClick={async () => {
                  try {
                    // Update the custom test template
                    await api.put(`/api/custom-lab-tests/${selectedCustomTest.id}`, {
                      test_name: customTestForm.test_name,
                      remark: customTestForm.remark,
                      result_value: customTestForm.result_value || '',
                      unit: customTestForm.unit || ''
                    });
                    setCustomLabTestsFromOverview(prev => prev.map(ct =>
                      ct.id === selectedCustomTest.id
                        ? { ...ct, test_name: customTestForm.test_name, remark: customTestForm.remark, result_value: customTestForm.result_value, unit: customTestForm.unit }
                        : ct
                    ));

                    // Save as actual lab result in DB and add to entries list (same as template flow)
                    const resultDate = customTestForm.result_date || getLocalDateString();
                    const entry = {
                      test_name: customTestForm.test_name,
                      result_value: customTestForm.result_value || '',
                      result_unit: customTestForm.unit || '',
                      reference_range: customTestForm.reference_range || '',
                      notes: customTestForm.remark || '',
                      date: resultDate,
                      category: 'Custom',
                      parameters: []
                    };
                    try {
                      const resp = await api.post(`/api/labs/${patientId}`, {
                        test_name: entry.test_name,
                        result_value: entry.result_value,
                        result_unit: entry.result_unit,
                        reference_range: entry.reference_range,
                        notes: entry.notes,
                        test_category: 'Custom',
                        result_date: resultDate,
                        report_group: 'Prescription'
                      });
                      entry.id = resp.data.id;
                    } catch (err) {
                      console.error('Failed to save lab result to DB:', err);
                    }
                    setLabResultEntries(prev => [...prev, entry]);

                    addToast(`"${customTestForm.test_name}" added to prescription`, 'success');
                    setShowCustomTestModal(false);
                    setSelectedCustomTest(null);
                  } catch {
                    addToast('Failed to update custom test', 'error');
                  }
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}