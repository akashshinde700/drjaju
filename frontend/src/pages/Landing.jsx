import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FaWhatsapp, FaPhoneAlt, FaEnvelope, FaStar, FaHeart, FaStethoscope, FaUserMd, FaNotesMedical, FaHospital, FaCalendarCheck, FaMapMarkerAlt, FaGoogle, FaFacebook, FaInstagram, FaYoutube, FaGraduationCap, FaAward } from 'react-icons/fa';
import { FiCheckCircle, FiLoader, FiAlertCircle, FiArrowRight } from 'react-icons/fi';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { getLocalDateString } from '../utils/localDate';

// Google Place ID for the clinic (configure in environment)
const GOOGLE_PLACE_ID = import.meta.env.VITE_GOOGLE_PLACE_ID || '';

// Specialties data
const specialties = [
  { name: 'Diabetes Management', icon: FaNotesMedical, description: 'Comprehensive diabetes care and monitoring' },
  { name: 'Cardiology', icon: FaHeart, description: 'Heart health and cardiac care' },
  { name: 'Internal Medicine', icon: FaStethoscope, description: 'General adult medical care' },
  { name: 'Thyroid Disorders', icon: FaUserMd, description: 'Thyroid diagnosis and treatment' },
  { name: 'Hypertension', icon: FaHospital, description: 'Blood pressure management' },
  { name: 'Preventive Care', icon: FaCalendarCheck, description: 'Health checkups and prevention' },
];

// Patient testimonials with real content
const patientStories = [
  {
    name: 'Rajesh Kumar',
    location: 'Kharadi, Pune',
    quote: 'The clinic diagnosed my diabetes early with Dr. Jaju\'s expert care. The treatment plan helped me manage it effectively. Very caring and knowledgeable team.',
    rating: 5
  },
  {
    name: 'Priya Sharma',
    location: 'Wagholi, Pune',
    quote: 'Best healthcare facility in the area. The doctors take time to explain everything clearly and follow up regularly. Highly recommended!',
    rating: 5
  },
  {
    name: 'Amit Patel',
    location: 'Viman Nagar, Pune',
    quote: 'I was suffering from thyroid issues for years. The treatment with Dr. Jaju has been life-changing. Thank you!',
    rating: 5
  },
  {
    name: 'Sunita Deshmukh',
    location: 'Hadapsar, Pune',
    quote: 'Dr. Jaju is very patient and listens to all concerns carefully. My mother\'s diabetes is now well controlled thanks to his expert guidance. Excellent doctor!',
    rating: 5
  },
  {
    name: 'Manoj Kulkarni',
    location: 'Kalyani Nagar, Pune',
    quote: 'I visited the clinic for my high blood pressure issues. Dr. Jaju prescribed the right medication and my BP is now under control. Very professional staff.',
    rating: 5
  },
  {
    name: 'Neha Joshi',
    location: 'Wadgaon Sheri, Pune',
    quote: 'The clinic is clean and well-maintained. Dr. Jaju explained my thyroid condition in simple terms and the treatment has worked wonderfully. Highly recommend!',
    rating: 5
  },
  {
    name: 'Sanjay Gaikwad',
    location: 'Mundhwa, Pune',
    quote: 'Very satisfied with the treatment for my heart condition. Dr. Jaju is thorough with his diagnosis and takes time to explain everything. Best doctor in Kharadi.',
    rating: 5
  },
  {
    name: 'Aarti Bhosale',
    location: 'Chandan Nagar, Pune',
    quote: 'My father has been visiting the clinic for diabetes management for over a year now. His sugar levels are perfectly controlled. Thank you Dr. Jaju!',
    rating: 5
  },
  {
    name: 'Vikram Jadhav',
    location: 'Kharadi, Pune',
    quote: 'Dr. Gopal Jaju is an excellent physician. He diagnosed my lifestyle disorder accurately and suggested both medication and diet changes. Feeling much better now.',
    rating: 5
  },
  {
    name: 'Pooja Mehta',
    location: 'Magarpatta, Pune',
    quote: 'I was referred to Dr. Jaju for my cholesterol issues. Within 3 months of treatment, my levels normalized. Very knowledgeable and caring doctor.',
    rating: 4
  },
  {
    name: 'Rahul Patil',
    location: 'Wagholi, Pune',
    quote: 'Staff is very cooperative and the appointment system is smooth. Dr. Jaju gives proper time to each patient and doesn\'t rush. Very happy with the treatment.',
    rating: 5
  },
  {
    name: 'Deepa Nair',
    location: 'Viman Nagar, Pune',
    quote: 'The clinic has become our family doctor. From my husband\'s BP treatment to my thyroid medication, Dr. Jaju handles everything with great expertise.',
    rating: 5
  },
  {
    name: 'Sachin Wagh',
    location: 'Keshav Nagar, Pune',
    quote: 'I appreciate how Dr. Jaju focuses on preventive care. Regular health checkups here have helped me avoid serious complications. Very trustworthy clinic.',
    rating: 5
  },
  {
    name: 'Anjali Deshpande',
    location: 'Koregaon Park, Pune',
    quote: 'After visiting multiple doctors for my persistent fatigue, Dr. Jaju correctly identified it as a thyroid issue. Proper diagnosis and effective treatment. Thank you!',
    rating: 5
  },
  {
    name: 'Hemant Shirke',
    location: 'Hadapsar, Pune',
    quote: 'Dr. Jaju is one of the best physicians in Pune. His approach to treating diabetes with both medicine and lifestyle advice has really helped me. Highly recommended!',
    rating: 5
  },
];

// Default hospital affiliations (fallback)
const defaultHospitals = [
  { name: 'Clinic', location: 'City Vista, Kharadi' },
  { name: 'Manipal Hospital', location: 'Kharadi' },
  { name: 'Venkatesh Hospital', location: 'Wagholi' },
  { name: 'Ojas Hospital', location: 'Wagholi' },
];

// Training / qualification credentials shown in the About section
const credentials = [
  { icon: FaHospital, title: 'Lilavati Hospital, Mumbai', subtitle: 'Ex ICU Registrar' },
  { icon: FaHospital, title: 'Nanavati Hospital, Mumbai', subtitle: 'Ex ICU Registrar' },
  { icon: FaGraduationCap, title: 'MBBS, MD Medicine', subtitle: 'Internal Medicine Specialist' },
  { icon: FaAward, title: 'MMC Registered', subtitle: 'Reg: MMC-2022051089' },
];

// WhatsApp number/link now computed dynamically from doctorInfo state

const FULL_CLINIC_ADDRESS = '1st Floor, Tower B, City Vista, Office No. 22 to 25, Kharadi, Pune, Maharashtra 411014';

const LandingPage = () => {
  const { addToast } = useToast();

  // Inject the display typeface (scoped to this page only — the rest of the
  // app uses Inter everywhere) plus the floating-image keyframe.
  useEffect(() => {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap';
    document.head.appendChild(fontLink);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes floatImage {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-18px); }
      }
      .lp-display { font-family: 'Fraunces', ui-serif, Georgia, serif; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(fontLink);
      document.head.removeChild(style);
    };
  }, []);

  const [showBookingModal, setShowBookingModal] = useState(false);
  // Booking outcome shown as a clear confirmation panel inside the modal.
  const [bookingResult, setBookingResult] = useState(null); // { ok: bool, message: string }
  const [bookingData, setBookingData] = useState({ name: '', email: '', phone: '', preferred_date: '', appointment_time: '', arrival_type: 'online' });
  const [existingPatient, setExistingPatient] = useState(null);
  const [checkingPatient, setCheckingPatient] = useState(false);
  const patientCheckTimeout = useRef(null);
  const [showQRModal, setShowQRModal] = useState(false);
  // Effective doctor ID resolved from API (avoids hardcoding a specific doctor ID)
  const [effectiveDoctorId, setEffectiveDoctorId] = useState(2);
  const [doctorParam, setDoctorParam] = useState(null);
  const [activeSection, setActiveSection] = useState('home');
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [allTimeSlots, setAllTimeSlots] = useState([]);
  const [doctorAvailability, setDoctorAvailability] = useState([]);
  const [googleReviews, setGoogleReviews] = useState([]);
  const [googleRating, setGoogleRating] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [hospitals, setHospitals] = useState(defaultHospitals);
  const [doctorInfo, setDoctorInfo] = useState({ name: 'Dr. Gopal Jaju', phone: '8530345858', specialization: 'General Practice' });
  const [clinicInfo, setClinicInfo] = useState({
    name: 'Clinic',
    address: FULL_CLINIC_ADDRESS,
    phone: '8530345858'
  });
  const whatsappNumber = '+91 ' + (doctorInfo.phone || '85303 45858').replace(/(\d{5})(\d{5})/, '$1 $2');
  const whatsappLink = 'https://wa.me/91' + (doctorInfo.phone || '8530345858');

  // Initialize API client
  const api = useApiClient();

  // Parse doctor param for QR booking - auto open booking modal
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const d = params.get('doctor');
      if (d) {
        setDoctorParam(parseInt(d));
        // Auto open booking modal when coming from QR code
        setShowBookingModal(true);
      }
    } catch {
      /* URL parsing error silently ignored */
    }
  }, []);

  // Fetch landing page data (doctor, clinic, affiliations)
  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        const fetchId = doctorParam || 2;
        const res = await api.get(`/api/doctors/${fetchId}/landing`);
        const data = res.data;
        if (data.doctor) {
          // Use the real doctor ID returned by the API so all bookings go to the correct doctor
          if (data.doctor.id) setEffectiveDoctorId(data.doctor.id);
          setDoctorInfo({
            name: 'Dr. ' + (data.doctor.name || 'Gopal Jaju'),
            phone: data.doctor.phone || '8530345858',
            specialization: data.doctor.specialization || 'General Practice',
            qualification: data.doctor.qualification || ''
          });
        }
        if (data.clinic) {
          setClinicInfo({
            name: data.clinic.name || 'Clinic',
            // Always show full address on landing for clarity
            address: FULL_CLINIC_ADDRESS,
            phone: data.clinic.phone || data.doctor?.phone || '8530345858'
          });
        }
        if (data.affiliations && data.affiliations.length > 0) {
          setHospitals(data.affiliations);
        }
      } catch (err) {
        // console.log('Using default landing page data');
      }
    };
    fetchLandingData();
  }, [api, doctorParam]);

  // Fetch Google Reviews
  useEffect(() => {
    const fetchGoogleReviews = async () => {
      if (!GOOGLE_PLACE_ID) return;

      setLoadingReviews(true);
      try {
        const _response = await api.get(`/api/google-reviews?placeId=${GOOGLE_PLACE_ID}`);
        if (_response.data.reviews) {
          setGoogleReviews(_response.data.reviews);
          setGoogleRating(_response.data.rating);
        }
      } catch (err) {
        // console.log('Google reviews not available, using fallback testimonials');
      } finally {
        setLoadingReviews(false);
      }
    };

    fetchGoogleReviews();
  }, [api]);

  // Fetch doctor's time slots and availability on component mount
  useEffect(() => {
    const fetchTimeSlots = async () => {
      try {
        const slotsResponse = await api.get(`/api/doctor-availability/${effectiveDoctorId}/slots`);
        const slots = (slotsResponse.data.slots || [])
          .filter(slot => slot.is_active)
          .map(slot => ({
            dbTime: slot.slot_time.substring(0, 5),
            displayTime: slot.display_time
          }));
        setAllTimeSlots(slots);

        const availResponse = await api.get(`/api/doctor-availability/${effectiveDoctorId}/availability`);
        setDoctorAvailability(availResponse.data.availability || []);
      } catch (error) {
        console.error('Error fetching doctor settings:', error);
        setAllTimeSlots([
          { dbTime: '12:15', displayTime: '12:15 PM' },
          { dbTime: '12:30', displayTime: '12:30 PM' },
          { dbTime: '12:45', displayTime: '12:45 PM' },
          { dbTime: '13:00', displayTime: '01:00 PM' },
          { dbTime: '18:00', displayTime: '06:00 PM' },
          { dbTime: '18:30', displayTime: '06:30 PM' },
          { dbTime: '19:00', displayTime: '07:00 PM' },
          { dbTime: '19:30', displayTime: '07:30 PM' },
          { dbTime: '20:00', displayTime: '08:00 PM' },
        ]);
      }
    };

    fetchTimeSlots();
  }, [api, effectiveDoctorId]);

  // Fetch booked slots when date changes
  useEffect(() => {
    const fetchBookedSlots = async () => {
      if (!bookingData.preferred_date) {
        setBookedSlots([]);
        return;
      }

      setLoadingSlots(true);
      try {
        const response = await api.get('/api/appointments/booked-slots', {
          params: {
            doctor_id: effectiveDoctorId,
            date: bookingData.preferred_date
          }
        });
        setBookedSlots(response.data.bookedSlots || []);
      } catch (error) {
        console.error('Error fetching booked slots:', error);
        setBookedSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchBookedSlots();
  }, [bookingData.preferred_date, api, effectiveDoctorId]);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['home', 'experience', 'doctor', 'specialties', 'testimonials', 'contact'];
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i]);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const checkExistingPatient = useCallback(async (phone, name) => {
    if (!phone || phone.length < 10) {
      setExistingPatient(null);
      return;
    }
    setCheckingPatient(true);
    try {
      const res = await api.get('/api/qr/check-patient', {
        params: { phone, name: name || undefined }
      });
      setExistingPatient(res.data?.data?.found ? res.data.data : null);
    } catch {
      setExistingPatient(null);
    } finally {
      setCheckingPatient(false);
    }
  }, [api]);

  const handleBookingFieldChange = (field, value) => {
    setBookingData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'phone' || field === 'name') {
        clearTimeout(patientCheckTimeout.current);
        patientCheckTimeout.current = setTimeout(() => {
          checkExistingPatient(updated.phone, updated.name);
        }, 600);
      }
      return updated;
    });
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookingData.preferred_date || !bookingData.appointment_time) {
      addToast('Please select date and time', 'error');
      return;
    }

    try {
      const _response = await api.post('/api/appointment-intents', {
        full_name: bookingData.name,
        phone: bookingData.phone,
        email: bookingData.email,
        speciality: 'Consultation',
        preferred_date: bookingData.preferred_date,
        preferred_time: bookingData.appointment_time,
        doctor_id: doctorParam || effectiveDoctorId,
        arrival_type: bookingData.arrival_type,
        message: `${bookingData.arrival_type === 'online' ? 'Online' : 'Offline'} appointment request on ${bookingData.preferred_date} at ${bookingData.appointment_time}`,
        auto_create: true
      });
      addToast('Appointment booked successfully!', 'success');
      // Capture what was actually picked BEFORE clearing the form — the
      // confirmation screen was showing a generic message with no date/time,
      // even though the patient had just chosen a specific slot.
      const pickedSlot = allTimeSlots.find(s => s.dbTime === bookingData.appointment_time);
      const pickedDateLabel = new Date(`${bookingData.preferred_date}T00:00:00`).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      const pickedTimeLabel = pickedSlot?.displayTime || bookingData.appointment_time;
      setBookingResult({
        ok: true,
        message: 'Please visit 10 minutes before your scheduled time. If there is any change in the appointment time, it will be conveyed to you by our team.',
        date: pickedDateLabel,
        time: pickedTimeLabel,
      });
      setBookingData({ name: '', email: '', phone: '', preferred_date: '', appointment_time: '', arrival_type: 'online' });
      setBookedSlots([]);
    } catch (error) {
      console.error('Booking error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to book appointment';
      addToast(errorMessage, 'error');
      setBookingResult({ ok: false, message: errorMessage });

      if (errorMessage.includes('already booked')) {
        try {
          const response = await api.get('/api/appointments/booked-slots', {
            params: {
              doctor_id: effectiveDoctorId,
              date: bookingData.preferred_date
            }
          });
          setBookedSlots(response.data.bookedSlots || []);
        } catch (refreshError) {
          console.error('Error refreshing slots:', refreshError);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-[#1B2B29] flex flex-col relative">
      {/* Header */}
      <header className="bg-[#FBF9F4]/90 backdrop-blur-md border-b border-[#DCEAE8] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#0F5C56] flex items-center justify-center text-white font-semibold text-sm lp-display">
              DJ
            </div>
            <div>
              <p className="font-semibold text-[#1B2B29] text-sm leading-tight">{clinicInfo.name}</p>
              <p className="text-xs text-[#5B6B69] leading-tight">{doctorInfo.name}</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm text-[#5B6B69]">
            <a href="#home" className={`transition ${activeSection === 'home' ? 'font-semibold text-[#0F5C56]' : 'hover:text-[#0F5C56]'}`}>Home</a>
            <a href="#experience" className={`transition ${activeSection === 'experience' ? 'font-semibold text-[#0F5C56]' : 'hover:text-[#0F5C56]'}`}>Credentials</a>
            <a href="#doctor" className={`transition ${activeSection === 'doctor' ? 'font-semibold text-[#0F5C56]' : 'hover:text-[#0F5C56]'}`}>About</a>
            <a href="#specialties" className={`transition ${activeSection === 'specialties' ? 'font-semibold text-[#0F5C56]' : 'hover:text-[#0F5C56]'}`}>Specialties</a>
            <a href="#testimonials" className={`transition ${activeSection === 'testimonials' ? 'font-semibold text-[#0F5C56]' : 'hover:text-[#0F5C56]'}`}>Reviews</a>
            <a href="#contact" className={`transition ${activeSection === 'contact' ? 'font-semibold text-[#0F5C56]' : 'hover:text-[#0F5C56]'}`}>Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-[#0F5C56] border border-[#0F5C56]/30 rounded-full hover:bg-[#0F5C56]/5 transition">
              Login
            </Link>
            <button onClick={() => setShowBookingModal(true)} className="px-5 py-2 text-sm font-semibold rounded-full bg-[#E4572E] text-white hover:bg-[#C94A24] shadow-sm transition">
              Book Now
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="relative overflow-hidden bg-[#0B3D3A]">
        <div className="absolute inset-0 opacity-[0.07]" style={{backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '26px 26px'}}></div>
        <div className="absolute -top-24 -right-24 w-[28rem] h-[28rem] bg-[#E4572E]/10 rounded-full blur-3xl"></div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center relative z-10">
          <div>
            <p className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 text-[#CFEDE8] text-xs font-semibold tracking-wide rounded-full mb-6 border border-white/15">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5EEAD4]"></span>
              TRUSTED HEALTHCARE PROVIDER
            </p>
            <h1 className="lp-display text-4xl sm:text-5xl lg:text-6xl font-medium leading-[1.08] mb-6 text-white">
              {doctorInfo.name}
              <span className="block text-[#8FD9CE] mt-1">Expert Medical Care</span>
            </h1>
            <p className="text-[#B9DAD3] mb-2 text-base font-medium tracking-wide">
              MD Medicine &middot; Consultant Physician
            </p>
            <p className="text-[#DCEAE8]/80 mb-9 text-base leading-relaxed max-w-xl">
              Specialist in Diabetes, Cardiology, and Internal Medicine with over 15 years of experience. Known for accurate diagnosis, ethical practice, and personalized treatment plans focused on long-term health.
            </p>

            <div className="flex flex-wrap gap-3 mb-11">
              <button
                onClick={() => setShowBookingModal(true)}
                className="px-7 py-3.5 rounded-full bg-[#E4572E] text-white font-semibold text-sm shadow-lg hover:bg-[#C94A24] transition inline-flex items-center gap-2"
              >
                Book Appointment <FiArrowRight />
              </button>
              <a
                href={`tel:+91${doctorInfo.phone}`}
                className="px-7 py-3.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/20 transition inline-flex items-center gap-2"
              >
                <FaPhoneAlt className="text-xs" /> {doctorInfo.phone}
              </a>
            </div>

            {/* Stats strip */}
            <div className="flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-7">
              <div>
                <p className="lp-display text-3xl font-medium text-white">15+</p>
                <p className="text-[#8FAFA8] text-xs font-medium tracking-wide mt-0.5">Years Experience</p>
              </div>
              <div>
                <p className="lp-display text-3xl font-medium text-white">10,000+</p>
                <p className="text-[#8FAFA8] text-xs font-medium tracking-wide mt-0.5">Patients Treated</p>
              </div>
              <div>
                <p className="lp-display text-3xl font-medium text-white">4.9<span className="text-lg">/5</span></p>
                <p className="text-[#8FAFA8] text-xs font-medium tracking-wide mt-0.5">Patient Rating</p>
              </div>
            </div>
          </div>

          {/* Doctor Image */}
          <div className="hidden lg:flex justify-center items-center">
            <div className="relative" style={{animation: 'floatImage 5s ease-in-out infinite'}}>
              <div className="absolute -bottom-5 -right-5 w-full h-full rounded-[2rem] bg-[#E4572E]"></div>
              <div className="w-72 h-[22rem] rounded-[2rem] overflow-hidden shadow-2xl relative border border-white/10">
                <img
                  src="/dr-gopal-jaju.jpg"
                  alt={doctorInfo.name}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div class="w-full h-full bg-[#0F5C56] flex items-center justify-center text-white/30"><svg class="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg></div>';
                  }}
                />
              </div>
              <div className="absolute top-4 right-4 bg-white text-[#0F5C56] px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span> Verified
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* Credentials & Affiliations */}
        <section id="experience" className="py-16 lg:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-[#E4572E] font-semibold text-xs uppercase tracking-[0.15em] mb-2">Credentials</p>
              <h2 className="lp-display text-3xl lg:text-4xl font-medium text-[#1B2B29]">Clinical Training &amp; Affiliations</h2>
            </div>

            {/* Hospital Affiliations */}
            <div className="mb-10">
              <h3 className="text-center text-sm font-semibold text-[#5B6B69] uppercase tracking-wide mb-5">Hospital Affiliations</h3>
              <div className="flex flex-wrap justify-center gap-4">
                {hospitals.map((hospital, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-5 border border-[#DCEAE8] text-center hover:border-[#0F5C56]/40 hover:-translate-y-0.5 transition-all duration-200 w-full sm:w-56 flex flex-col items-center">
                    <div className="w-11 h-11 rounded-full bg-[#F0F7F5] flex items-center justify-center mb-3">
                      <FaHospital className="text-lg text-[#0F5C56]" />
                    </div>
                    <p className="font-semibold text-[#1B2B29] text-sm">{hospital.name}</p>
                    <p className="text-[#5B6B69] text-xs mt-1">{hospital.location}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Training Background */}
            <div className="max-w-3xl mx-auto">
              <h3 className="text-center text-sm font-semibold text-[#5B6B69] uppercase tracking-wide mb-5">Training &amp; Qualifications</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {credentials.map((c, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-[#DCEAE8]">
                    <div className="w-10 h-10 rounded-full bg-[#F0F7F5] flex items-center justify-center shrink-0">
                      <c.icon className="text-base text-[#0F5C56]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1B2B29] text-sm">{c.title}</p>
                      <p className="text-[#5B6B69] text-xs mt-0.5">{c.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* About Doctor */}
        <section id="doctor" className="py-16 lg:py-20 bg-white border-y border-[#DCEAE8]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-center">
              <div className="relative mx-auto lg:mx-0">
                <div className="absolute -top-4 -left-4 w-full h-full rounded-[1.75rem] border-2 border-[#0F5C56]/20"></div>
                <div className="w-64 h-80 rounded-[1.75rem] overflow-hidden shadow-xl relative">
                  <img
                    src="/dr-gopal-jaju.jpg"
                    alt={doctorInfo.name}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      e.target.parentElement.innerHTML = '<div class="w-full h-full bg-[#0F5C56] flex items-center justify-center text-white/40"><svg class="w-20 h-20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg></div>';
                    }}
                  />
                </div>
              </div>

              <div>
                <p className="text-[#E4572E] font-semibold text-xs uppercase tracking-[0.15em] mb-3">About the Doctor</p>
                <h2 className="lp-display text-3xl lg:text-4xl font-medium text-[#1B2B29] mb-4">{doctorInfo.name}</h2>
                <p className="text-[#5B6B69] leading-relaxed mb-8 max-w-xl">
                  Specialist in Diabetes, Cardiology, and Internal Medicine with over 15 years of experience.
                  Known for accurate diagnosis, ethical practice, and personalized treatment plans focused on
                  long-term health — combining evidence-based medicine with genuine, unhurried attention to
                  every patient.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className="px-6 py-3 bg-[#0F5C56] hover:bg-[#0B4A45] text-white font-semibold text-sm rounded-full transition"
                  >
                    Book Appointment
                  </button>
                  <a
                    href={`tel:${whatsappNumber.replace(/\s/g, '')}`}
                    className="px-6 py-3 border border-[#DCEAE8] hover:border-[#0F5C56]/40 text-[#1B2B29] font-semibold text-sm rounded-full transition flex items-center gap-2"
                  >
                    <FaPhoneAlt className="text-xs text-[#0F5C56]" /> {doctorInfo.phone}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Specialties */}
        <section id="specialties" className="py-16 lg:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-[#E4572E] font-semibold text-xs uppercase tracking-[0.15em] mb-2">Services</p>
              <h2 className="lp-display text-3xl lg:text-4xl font-medium text-[#1B2B29]">Our Specialties</h2>
              <p className="mt-3 text-[#5B6B69] max-w-2xl mx-auto">
                Comprehensive medical care for a wide range of conditions
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {specialties.map((specialty, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 border border-[#DCEAE8] hover:border-[#0F5C56]/40 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#0F5C56] flex items-center justify-center mb-4 group-hover:bg-[#E4572E] transition-colors duration-200">
                    <specialty.icon className="text-xl text-white" />
                  </div>
                  <h3 className="font-semibold text-[#1B2B29] text-base mb-1.5">{specialty.name}</h3>
                  <p className="text-[#5B6B69] text-sm leading-relaxed">{specialty.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Patient Experiences / Testimonials */}
        <section id="testimonials" className="py-16 lg:py-20 bg-white border-y border-[#DCEAE8]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-[#E4572E] font-semibold text-xs uppercase tracking-[0.15em] mb-2">Reviews</p>
              <h2 className="lp-display text-3xl lg:text-4xl font-medium text-[#1B2B29]">Patient Experiences</h2>
              <p className="mt-3 text-[#5B6B69] max-w-2xl mx-auto">
                What our patients say about their experience with {doctorInfo.name}
              </p>

              {/* Google Rating Badge */}
              {googleRating && (
                <div className="mt-4 inline-flex items-center gap-2 bg-[#F0F7F5] border border-[#DCEAE8] rounded-full px-4 py-2">
                  <FaGoogle className="text-[#0F5C56]" />
                  <span className="font-semibold text-[#1B2B29]">{googleRating.toFixed(1)}</span>
                  <div className="flex text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <FaStar key={i} className={i < Math.round(googleRating) ? 'text-amber-400' : 'text-gray-300'} />
                    ))}
                  </div>
                  <span className="text-[#5B6B69] text-sm">on Google</span>
                </div>
              )}
            </div>

            {loadingReviews ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F5C56]"></div>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-5">
                {/* Show Google reviews if available, otherwise show static testimonials */}
                {(googleReviews.length > 0 ? googleReviews : patientStories).slice(0, showAllReviews ? undefined : 3).map((story, idx) => (
                  <div key={idx} className="bg-[#FBF9F4] rounded-2xl p-6 border border-[#DCEAE8] hover:shadow-md transition">
                    {/* Google badge for Google reviews */}
                    {googleReviews.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-[#5B6B69] mb-2">
                        <FaGoogle className="text-[#0F5C56]" />
                        <span>Google Review</span>
                      </div>
                    )}

                    {/* Stars */}
                    <div className="flex text-amber-400 text-sm gap-0.5 mb-4">
                      {Array.from({ length: story.rating || 5 }).map((_, i) => <FaStar key={i} />)}
                    </div>

                    {/* Quote */}
                    <p className="text-[#3A4644] mb-6 leading-relaxed line-clamp-4">
                      &ldquo;{story.text || story.quote}&rdquo;
                    </p>

                    {/* Patient Info */}
                    <div className="flex items-center gap-3">
                      {story.profile_photo_url ? (
                        <img
                          src={story.profile_photo_url}
                          alt={story.author_name || story.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#0F5C56]/10 flex items-center justify-center text-[#0F5C56] font-semibold">
                          {(story.author_name || story.name || 'A').charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[#1B2B29] text-sm">{story.author_name || story.name}</p>
                        <p className="text-[#5B6B69] text-xs flex items-center gap-1">
                          {story.relative_time_description ? (
                            <span>{story.relative_time_description}</span>
                          ) : (
                            <>
                              <FaMapMarkerAlt className="text-[#0F5C56]" />
                              {story.location}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* View All / Show Less toggle */}
            {!showAllReviews && (googleReviews.length > 3 || patientStories.length > 3) && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowAllReviews(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#0F5C56] text-white rounded-full font-semibold hover:bg-[#0B4A45] transition"
                >
                  View All Reviews
                </button>
              </div>
            )}
            {showAllReviews && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowAllReviews(false)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#EFEBE2] text-[#1B2B29] rounded-full font-semibold hover:bg-[#E5E0D4] transition"
                >
                  Show Less
                </button>
              </div>
            )}

            <div className="mt-10 flex justify-center">
              <button
                onClick={() => setShowBookingModal(true)}
                className="px-8 py-3.5 rounded-full bg-[#E4572E] text-white font-semibold hover:bg-[#C94A24] transition"
              >
                Book Your Appointment
              </button>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-16 lg:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-[#E4572E] font-semibold text-xs uppercase tracking-[0.15em] mb-2">Contact</p>
              <h2 className="lp-display text-3xl lg:text-4xl font-medium text-[#1B2B29]">Get In Touch</h2>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              {/* Phone */}
              <a
                href={`tel:${whatsappNumber.replace(/\s/g, '')}`}
                className="bg-white rounded-2xl p-6 border border-[#DCEAE8] hover:border-[#0F5C56]/40 hover:shadow-md transition text-center group"
              >
                <div className="w-12 h-12 rounded-full bg-[#F0F7F5] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#0F5C56]/10 transition">
                  <FaPhoneAlt className="text-lg text-[#0F5C56]" />
                </div>
                <h3 className="font-semibold text-[#1B2B29] mb-1">Call Us</h3>
                <p className="text-[#0F5C56] font-semibold text-sm">{whatsappNumber}</p>
              </a>

              {/* WhatsApp */}
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="bg-white rounded-2xl p-6 border border-[#DCEAE8] hover:border-green-300 hover:shadow-md transition text-center group"
              >
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4 group-hover:bg-green-100 transition">
                  <FaWhatsapp className="text-xl text-green-600" />
                </div>
                <h3 className="font-semibold text-[#1B2B29] mb-1">WhatsApp</h3>
                <p className="text-green-600 font-semibold text-sm">Chat with us</p>
              </a>

              {/* Location */}
              <a href="https://maps.app.goo.gl/kUUYaKF5vSYTXNhE9" target="_blank" rel="noopener noreferrer"
                className="bg-white rounded-2xl p-6 border border-[#DCEAE8] text-center block hover:border-[#E4572E]/40 hover:shadow-md transition group">
                <div className="w-12 h-12 rounded-full bg-[#FBEEE8] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#F8DFD3] transition">
                  <FaMapMarkerAlt className="text-lg text-[#E4572E]" />
                </div>
                <h3 className="font-semibold text-[#1B2B29] mb-1">Visit Us</h3>
                <p className="text-[#5B6B69] text-sm">{clinicInfo.address}</p>
                <p className="text-[#E4572E] text-xs mt-1.5 font-medium">Open in Maps &rarr;</p>
              </a>
            </div>

            {/* Social Media */}
            <div className="grid lg:grid-cols-3 gap-5 mt-5">
              {/* Facebook */}
              <a href="https://www.facebook.com/drjajulifecare/" target="_blank" rel="noopener noreferrer"
                className="bg-white rounded-2xl p-6 border border-[#DCEAE8] text-center block hover:border-[#0F5C56]/40 hover:shadow-md transition group">
                <div className="w-12 h-12 rounded-full bg-[#F0F7F5] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#0F5C56]/10 transition">
                  <FaFacebook className="text-lg text-[#0F5C56]" />
                </div>
                <h3 className="font-semibold text-[#1B2B29] mb-1">Facebook</h3>
                <p className="text-[#5B6B69] text-sm">Follow Us</p>
              </a>

              {/* Instagram */}
              <a href="https://www.instagram.com/dr_jaju_lifecare/" target="_blank" rel="noopener noreferrer"
                className="bg-white rounded-2xl p-6 border border-[#DCEAE8] text-center block hover:border-pink-300 hover:shadow-md transition group">
                <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-4 group-hover:bg-pink-100 transition">
                  <FaInstagram className="text-lg text-pink-600" />
                </div>
                <h3 className="font-semibold text-[#1B2B29] mb-1">Instagram</h3>
                <p className="text-[#5B6B69] text-sm">Follow Us</p>
              </a>

              {/* YouTube */}
              <a href="https://www.youtube.com/@DrGopalJajuLifecareMD" target="_blank" rel="noopener noreferrer"
                className="bg-white rounded-2xl p-6 border border-[#DCEAE8] text-center block hover:border-red-300 hover:shadow-md transition group">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 group-hover:bg-red-100 transition">
                  <FaYoutube className="text-lg text-red-600" />
                </div>
                <h3 className="font-semibold text-[#1B2B29] mb-1">YouTube</h3>
                <p className="text-[#5B6B69] text-sm">Subscribe</p>
              </a>
            </div>

            {/* Clinic Timings */}
            <div className="mt-10 bg-white rounded-2xl p-6 border border-[#DCEAE8] max-w-3xl mx-auto">
              <h3 className="font-semibold text-[#1B2B29] text-center mb-5">Clinic Timings</h3>

              {/* Time Slots Range */}
              {allTimeSlots.length > 0 && (() => {
                const times = allTimeSlots.map(s => s.dbTime).sort();
                const groups = [];
                let groupStart = times[0];
                let prev = times[0];
                for (let i = 1; i <= times.length; i++) {
                  const curr = times[i];
                  const prevMins = prev ? parseInt(prev.split(':')[0]) * 60 + parseInt(prev.split(':')[1]) : 0;
                  const currMins = curr ? parseInt(curr.split(':')[0]) * 60 + parseInt(curr.split(':')[1]) : 0;
                  if (!curr || currMins - prevMins > 60) {
                    groups.push({ start: groupStart, end: prev });
                    if (curr) groupStart = curr;
                  }
                  prev = curr;
                }
                const fmt = (t) => {
                  const [h, m] = t.split(':').map(Number);
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
                  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
                };
                return (
                  <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
                    {groups.map((g, i) => (
                      <div key={i} className="flex justify-between items-center p-4 bg-[#F0F7F5] rounded-xl border border-[#DCEAE8]">
                        <span className="text-[#3A4644] font-medium">{i === 0 ? 'Morning / Afternoon' : 'Evening'}</span>
                        <span className="font-semibold text-[#0F5C56]">{fmt(g.start)} - {fmt(g.end)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Working Days */}
              {doctorAvailability.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {doctorAvailability.map(day => (
                    <span
                      key={day.day_of_week}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                        day.is_available
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-400 border border-red-200 line-through'
                      }`}
                    >
                      {day.day_name}
                    </span>
                  ))}
                </div>
              )}
              {doctorAvailability.length > 0 && (() => {
                const closedDays = doctorAvailability.filter(d => !d.is_available).map(d => d.day_name);
                return closedDays.length > 0 ? (
                  <p className="text-center text-[#5B6B69] text-xs mt-3">Closed on {closedDays.join(', ')}</p>
                ) : (
                  <p className="text-center text-[#5B6B69] text-xs mt-3">Open all days</p>
                );
              })()}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0B3D3A] text-[#B9DAD3] relative overflow-hidden">
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-16 relative z-10">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            {/* Clinic Info */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-11 w-11 rounded-full bg-[#E4572E] flex items-center justify-center text-white lp-display font-semibold">DJ</div>
                <div>
                  <p className="font-semibold text-white text-base">{clinicInfo.name}</p>
                  <p className="text-xs text-[#8FAFA8]">{doctorInfo.name}</p>
                </div>
              </div>
              <p className="text-sm text-[#8FAFA8] leading-relaxed">Expert care for Diabetes, Heart Disease, and Lifestyle disorders. Your health is our priority.</p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Quick Links</h4>
              <div className="space-y-2.5 text-sm">
                <a href="#home" className="block text-[#8FAFA8] hover:text-white transition">Home</a>
                <a href="#doctor" className="block text-[#8FAFA8] hover:text-white transition">About Doctor</a>
                <a href="#specialties" className="block text-[#8FAFA8] hover:text-white transition">Specialties</a>
                <a href="#contact" className="block text-[#8FAFA8] hover:text-white transition">Contact</a>
              </div>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Services</h4>
              <div className="space-y-2.5 text-sm text-[#8FAFA8]">
                <p>Diabetes Management</p>
                <p>Cardiac Care</p>
                <p>Lifestyle Disorders</p>
                <p>General Consultation</p>
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Contact</h4>
              <div className="space-y-2.5 text-sm">
                <a href={`tel:+91${doctorInfo.phone}`} className="flex items-start gap-2 text-[#8FAFA8] hover:text-white transition">
                  <FaPhoneAlt className="mt-0.5 text-xs shrink-0" /> {whatsappNumber}
                </a>
                <p className="flex items-start gap-2 text-[#8FAFA8]">
                  <FaMapMarkerAlt className="mt-0.5 text-xs shrink-0" /> {clinicInfo.address}
                </p>
                <a href="mailto:drjajugopal@gmail.com" className="flex items-start gap-2 text-[#8FAFA8] hover:text-white transition">
                  <FaEnvelope className="mt-0.5 text-xs shrink-0" /> drjajugopal@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-8"></div>

          {/* Bottom Section */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-sm text-[#6E8B85] text-center md:text-left">
              &copy; {new Date().getFullYear()} {clinicInfo.name}. All rights reserved.
            </p>

            {/* WhatsApp CTA */}
            <a
              href={`${whatsappLink}?text=${encodeURIComponent('Hello, I would like to book an appointment at ' + clinicInfo.name + '.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-full font-semibold hover:bg-green-700 transition"
            >
              <FaWhatsapp /> WhatsApp Us
            </a>
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#DCEAE8] flex justify-between items-center sticky top-0 bg-white rounded-t-2xl">
              <h2 className="lp-display text-xl font-medium text-[#1B2B29]">Book Appointment</h2>
              <button onClick={() => {
                setShowBookingModal(false);
                setBookingResult(null);
                setBookingData({ name: '', email: '', phone: '', preferred_date: '', appointment_time: '', arrival_type: 'online' });
                setExistingPatient(null);
              }} className="text-[#5B6B69] hover:text-[#1B2B29] text-2xl leading-none">&times;</button>
            </div>
            {bookingResult && (
              <div className="p-8 text-center">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${bookingResult.ok ? 'bg-green-100' : 'bg-red-100'}`}>
                  {bookingResult.ok
                    ? <FiCheckCircle className="w-9 h-9 text-green-600" />
                    : <FiAlertCircle className="w-9 h-9 text-red-600" />}
                </div>
                <h3 className="text-lg font-bold mt-4 text-[#1B2B29]">{bookingResult.ok ? 'Appointment booked' : 'Booking not completed'}</h3>
                {bookingResult.ok && bookingResult.date && bookingResult.time && (
                  <div className="mt-4 inline-flex flex-col items-center gap-1 px-5 py-3 bg-[#F0F7F5] border border-[#DCEAE8] rounded-xl">
                    <span className="text-xs font-medium text-[#0F5C56] uppercase tracking-wide">You requested</span>
                    <span className="text-base font-semibold text-[#1B2B29]">{bookingResult.date}</span>
                    <span className="text-sm font-medium text-[#0F5C56]">{bookingResult.time}</span>
                  </div>
                )}
                <p className="text-sm text-[#5B6B69] mt-3 max-w-sm mx-auto">{bookingResult.message}</p>
                <div className="flex gap-2 justify-center mt-6">
                  {bookingResult.ok ? (
                    <button type="button" onClick={() => { setShowBookingModal(false); setBookingResult(null); }} className="px-6 py-2.5 bg-[#0F5C56] text-white rounded-full font-semibold hover:bg-[#0B4A45]">Done</button>
                  ) : (
                    <button type="button" onClick={() => setBookingResult(null)} className="px-6 py-2.5 bg-[#0F5C56] text-white rounded-full font-semibold hover:bg-[#0B4A45]">Try again</button>
                  )}
                </div>
              </div>
            )}
            <form onSubmit={handleBookingSubmit} className={`p-6 space-y-4 ${bookingResult ? 'hidden' : ''}`}>
              {/* Existing patient found banner */}
              {checkingPatient && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500">
                  <FiLoader className="w-4 h-4 animate-spin" />
                  Checking patient records...
                </div>
              )}
              {!checkingPatient && existingPatient?.found && (
                <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-300 rounded-xl">
                  <FiCheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-green-800">Existing Patient Found</p>
                    <p className="text-green-700">{existingPatient.patient.name} &bull; {existingPatient.patient.patient_id}</p>
                    <p className="text-green-600 text-xs mt-0.5">Your existing record will be used — no duplicate will be created.</p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1 text-[#1B2B29]">Full Name *</label>
                <input
                  type="text"
                  required
                  value={bookingData.name}
                  onChange={e => handleBookingFieldChange('name', e.target.value)}
                  className="w-full px-4 py-3 border border-[#DCEAE8] rounded-xl focus:ring-2 focus:ring-[#0F5C56]/30 focus:border-[#0F5C56] outline-none transition"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[#1B2B29]">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={bookingData.phone}
                  onChange={e => handleBookingFieldChange('phone', e.target.value)}
                  className="w-full px-4 py-3 border border-[#DCEAE8] rounded-xl focus:ring-2 focus:ring-[#0F5C56]/30 focus:border-[#0F5C56] outline-none transition"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[#1B2B29]">Email</label>
                <input
                  type="email"
                  value={bookingData.email}
                  onChange={e => setBookingData({ ...bookingData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-[#DCEAE8] rounded-xl focus:ring-2 focus:ring-[#0F5C56]/30 focus:border-[#0F5C56] outline-none transition"
                  placeholder="Enter email (optional)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[#1B2B29]">Consultation Type *</label>
                <select
                  required
                  value={bookingData.arrival_type}
                  onChange={e => setBookingData({ ...bookingData, arrival_type: e.target.value })}
                  className="w-full px-4 py-3 border border-[#DCEAE8] rounded-xl focus:ring-2 focus:ring-[#0F5C56]/30 focus:border-[#0F5C56] outline-none bg-white transition"
                >
                  <option value="offline">Offline - Hospital Visit</option>
                  <option value="online">Online - WhatsApp / Video Call</option>
                </select>
                <p className="text-xs text-[#5B6B69] mt-1">
                  {bookingData.arrival_type === 'online'
                    ? 'Doctor will connect via WhatsApp call or video call'
                    : 'Visit the hospital for in-person consultation'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[#1B2B29]">Preferred Date *</label>
                <input
                  type="date"
                  required
                  min={getLocalDateString()}
                  value={bookingData.preferred_date}
                  onChange={e => {
                    const selectedDate = new Date(e.target.value + 'T00:00:00');
                    const dayOfWeek = selectedDate.getDay();

                    const dayAvailability = doctorAvailability.find(d => d.day_of_week === dayOfWeek);
                    if (dayAvailability && !dayAvailability.is_available) {
                      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
                      addToast(`Clinic is closed on ${dayName}s. Please select another date.`, 'error');
                      return;
                    }

                    setBookingData({ ...bookingData, preferred_date: e.target.value, appointment_time: '' });
                  }}
                  className="w-full px-4 py-3 border border-[#DCEAE8] rounded-xl focus:ring-2 focus:ring-[#0F5C56]/30 focus:border-[#0F5C56] outline-none transition"
                />
                <p className="text-xs text-[#5B6B69] mt-1">Clinic is closed on Sundays</p>
              </div>

              {bookingData.preferred_date && (() => {
                const isToday = bookingData.preferred_date === getLocalDateString();
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();

                // Filter slots: if today, only show future slots
                const availableSlots = allTimeSlots.filter(slot => {
                  if (!isToday) return true;
                  const [h, m] = slot.dbTime.split(':').map(Number);
                  return h * 60 + m > currentMinutes;
                });

                return (
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#1B2B29]">
                    Select Time Slot *
                    {loadingSlots && <span className="text-xs text-[#5B6B69] ml-2">(Loading...)</span>}
                  </label>
                  {availableSlots.length === 0 ? (
                    <div className="text-center py-4 border border-[#DCEAE8] rounded-xl bg-[#FBF9F4]">
                      <p className="text-[#5B6B69] text-sm">No available slots {isToday ? 'remaining for today' : 'for this date'}. Please select another date.</p>
                    </div>
                  ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-[#DCEAE8] rounded-xl p-3">
                    {availableSlots.map((slot) => {
                      const isBooked = bookedSlots.includes(slot.dbTime);
                      const isSelected = bookingData.appointment_time === slot.dbTime;

                      return (
                        <button
                          key={slot.dbTime}
                          type="button"
                          disabled={isBooked}
                          onClick={() => {
                            if (isBooked) {
                              addToast('This slot is already booked. Please choose another slot.', 'error');
                              return;
                            }
                            setBookingData({ ...bookingData, appointment_time: slot.dbTime });
                          }}
                          title={isBooked ? 'Already booked - choose another slot' : `Book at ${slot.displayTime}`}
                          className={`
                            px-2 py-2 text-xs rounded-lg font-medium transition-all relative
                            ${isBooked
                              ? 'bg-red-50 text-red-400 cursor-not-allowed border border-red-200'
                              : isSelected
                                ? 'bg-[#0F5C56] text-white shadow-sm'
                                : 'bg-white border border-[#DCEAE8] text-[#3A4644] hover:border-[#0F5C56]/40 hover:bg-[#F0F7F5]'
                            }
                          `}
                        >
                          {slot.displayTime}
                          {isBooked && <span className="block text-[10px] text-red-400 mt-0.5">Booked</span>}
                        </button>
                      );
                    })}
                  </div>
                  )}
                </div>
                );
              })()}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowBookingModal(false);
                    setBookingData({ name: '', email: '', phone: '', preferred_date: '', appointment_time: '', arrival_type: 'online' });
                    setBookedSlots([]);
                    setExistingPatient(null);
                  }}
                  className="flex-1 px-4 py-3 border border-[#DCEAE8] rounded-xl hover:bg-[#FBF9F4] transition font-medium text-[#1B2B29]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[#E4572E] text-white rounded-xl hover:bg-[#C94A24] transition font-semibold"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-4 border-b border-[#DCEAE8] flex justify-between items-center">
              <h3 className="text-lg font-semibold text-[#1B2B29]">Doctor QR Booking</h3>
              <button onClick={() => setShowQRModal(false)} className="text-[#5B6B69] hover:text-[#1B2B29] text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4 text-center">
              {(() => {
                const link = `${window.location.origin}${window.location.pathname}?doctor=${doctorParam || effectiveDoctorId}`;
                const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;
                return (
                  <>
                    <img src={qrSrc} alt="Booking QR" className="mx-auto" />
                    <p className="text-sm text-[#5B6B69] break-all">{link}</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={async () => { await navigator.clipboard.writeText(link); addToast('Link copied!', 'success'); }}
                        className="px-4 py-2 text-sm border border-[#DCEAE8] rounded-lg hover:bg-[#FBF9F4]"
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={() => {
                          const msg = `Book your appointment here: ${link}`;
                          const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
                          window.open(wa, '_blank');
                        }}
                        className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Share via WhatsApp
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Floating Button */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-xl p-4 flex items-center justify-center z-[9999] transition-transform duration-200 hover:scale-105"
        aria-label="Contact us on WhatsApp"
      >
        <FaWhatsapp className="text-2xl" />
      </a>
    </div>
  );
};

export default LandingPage;
