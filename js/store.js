/**
 * Mediarca Central Data Store & RBAC Authentication Engine
 * Strict role-based storage with localStorage persistence
 */

const STORAGE_KEY = 'mediarca_release_v1';

const SEED_USERS = [
  {
    id: 'pat_1',
    role: 'patient',
    email: 'sarah@mediarca.health',
    password: 'patient123',
    name: 'Sarah Johnson',
    phone: '+1 (555) 234-8900',
    age: 32,
    gender: 'Female',
    bloodGroup: 'O+'
  },
  {
    id: 'doc_1',
    role: 'doctor',
    email: 'thorne@mediarca.health',
    password: 'doc123',
    name: 'Dr. Aris Thorne',
    specialty: 'Cardiology',
    specialtyId: 'cardiology',
    title: 'Senior Interventional Cardiologist',
    degrees: 'MBBS, MD (Cardiology), FACC',
    regNumber: 'NMC-84920-IND',
    mediarcaId: 'MED-DOC-1082',
    verificationStatus: 'verified',
    experienceYears: 16,
    hospital: 'Metro Heart Institute, Wing B - Room 304',
    fee: 65,
    rating: 4.9,
    reviewsCount: 312,
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&fit=crop&crop=faces&q=80',
    bio: 'Specialist in preventative cardiology, coronary angioplasty, and hypertension management with 16+ years of clinical excellence.',
    schedule: 'Mon - Fri | 09:00 AM - 02:00 PM',
    queueActive: true,
    currentToken: 4,
    totalTokens: 9,
    avgConsultTimeMins: 12
  },
  {
    id: 'doc_6',
    role: 'doctor',
    email: 'vance@mediarca.health',
    password: 'doc123',
    name: 'Dr. Elena Vance',
    specialty: 'General Medicine',
    specialtyId: 'general',
    title: 'Associate Physician & Family Specialist',
    degrees: 'MBBS, MD (Internal Medicine)',
    regNumber: 'KMC-54321-APP',
    mediarcaId: null,
    verificationStatus: 'pending',
    experienceYears: 8,
    hospital: 'City Life Health Center',
    fee: 40,
    rating: 4.7,
    reviewsCount: 88,
    avatar: 'https://images.unsplash.com/photo-1594824813689-53e7b1a13437?w=300&h=300&fit=crop&crop=faces&q=80',
    bio: 'Comprehensive internal medicine, diabetes care, infectious diseases, and executive preventive health checkups.',
    schedule: 'Mon - Sat | 10:00 AM - 02:00 PM',
    queueActive: false,
    currentToken: 0,
    totalTokens: 0,
    avgConsultTimeMins: 12,
    appliedDate: '2026-08-15'
  },
  {
    id: 'admin_1',
    role: 'admin',
    email: 'admin@mediarca.health',
    password: 'admin2026',
    name: 'Medical Board Director Robert Vance',
    badge: 'Senior Medical Registrar'
  }
];

const SEED_DOCTORS = [
  SEED_USERS[1], // doc_1
  {
    id: 'doc_2',
    role: 'doctor',
    email: 'sen@mediarca.health',
    password: 'doc123',
    name: 'Dr. Ananya Sen',
    specialty: 'Dermatology',
    specialtyId: 'dermatology',
    title: 'Consultant Dermatologist & Dermatosurgeon',
    degrees: 'MBBS, MD - Dermatology, Venereology & Leprosy',
    regNumber: 'WBMC-77341-REG',
    mediarcaId: 'MED-DOC-2390',
    verificationStatus: 'verified',
    experienceYears: 11,
    hospital: 'Apex Skin & Laser Clinic, Suite 12',
    fee: 50,
    rating: 4.8,
    reviewsCount: 245,
    avatar: 'https://images.unsplash.com/photo-1594824813501-48e02d64a27a?w=300&h=300&fit=crop&crop=faces&q=80',
    bio: 'Expertise in clinical dermatology, acne therapeutics, psoriasis biologics, and minimally invasive aesthetic surgery.',
    schedule: 'Mon, Wed, Sat | 10:00 AM - 04:00 PM',
    queueActive: true,
    currentToken: 2,
    totalTokens: 6,
    avgConsultTimeMins: 15
  },
  {
    id: 'doc_3',
    role: 'doctor',
    email: 'marcus@mediarca.health',
    password: 'doc123',
    name: 'Dr. Marcus Vance',
    specialty: 'Orthopedics',
    specialtyId: 'orthopedics',
    title: 'Chief Joint Replacement Surgeon',
    degrees: 'MBBS, MS (Orthopedics), MCh (Ortho)',
    regNumber: 'DMC-90114-MED',
    mediarcaId: 'MED-DOC-4482',
    verificationStatus: 'verified',
    experienceYears: 19,
    hospital: 'Global Orthopedic Center, Level 2',
    fee: 80,
    rating: 4.95,
    reviewsCount: 489,
    avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&h=300&fit=crop&crop=faces&q=80',
    bio: 'Pioneer in robotic total knee and hip arthroplasty with over 4,500 successful surgical procedures.',
    schedule: 'Tue, Thu, Sat | 08:30 AM - 01:30 PM',
    queueActive: true,
    currentToken: 6,
    totalTokens: 12,
    avgConsultTimeMins: 10
  },
  {
    id: 'doc_4',
    role: 'doctor',
    email: 'clara@mediarca.health',
    password: 'doc123',
    name: 'Dr. Clara Sterling',
    specialty: 'Pediatrics',
    specialtyId: 'pediatrics',
    title: 'Senior Pediatrician & Neonatologist',
    degrees: 'MBBS, DNB (Pediatrics), FIAP',
    regNumber: 'MMC-65239-REG',
    mediarcaId: 'MED-DOC-5519',
    verificationStatus: 'verified',
    experienceYears: 14,
    hospital: 'Care Children Hospital, Pediatric OPD 4',
    fee: 45,
    rating: 4.9,
    reviewsCount: 380,
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&fit=crop&crop=faces&q=80',
    bio: 'Specialized in newborn care, developmental milestones, childhood asthma, and pediatric vaccination regimens.',
    schedule: 'Daily | 09:30 AM - 03:30 PM',
    queueActive: true,
    currentToken: 1,
    totalTokens: 5,
    avgConsultTimeMins: 12
  },
  {
    id: 'doc_5',
    role: 'doctor',
    email: 'kabir@mediarca.health',
    password: 'doc123',
    name: 'Dr. Kabir Oberoi',
    specialty: 'Neurology',
    specialtyId: 'neurology',
    title: 'Consultant Neurologist & Stroke Specialist',
    degrees: 'MBBS, MD (Gen Med), DM (Neurology)',
    regNumber: 'MCI-18834-NEU',
    mediarcaId: 'MED-DOC-8924',
    verificationStatus: 'verified',
    experienceYears: 13,
    hospital: 'Neuro Care & Research Institute, Block A',
    fee: 75,
    rating: 4.85,
    reviewsCount: 194,
    avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&h=300&fit=crop&crop=faces&q=80',
    bio: 'Expert in migraines, epilepsy management, Parkinson’s disease, peripheral neuropathy, and cognitive disorders.',
    schedule: 'Mon - Fri | 11:00 AM - 05:00 PM',
    queueActive: false,
    currentToken: 0,
    totalTokens: 0,
    avgConsultTimeMins: 15
  },
  SEED_USERS[2] // doc_6 (Pending)
];

const SEED_QUEUES = {
  'doc_1': {
    doctorId: 'doc_1',
    status: 'in-session',
    currentToken: 4,
    avgConsultTimeMins: 12,
    tokens: [
      { tokenNumber: 1, patientName: 'Arthur Dent', bookingId: 'BK-1001', status: 'completed', checkInTime: '09:00 AM', symptoms: 'ECG review & palpitations' },
      { tokenNumber: 2, patientName: 'Maria Garcia', bookingId: 'BK-1002', status: 'completed', checkInTime: '09:14 AM', symptoms: 'Post-angioplasty routine check' },
      { tokenNumber: 3, patientName: 'Liam Wilson', bookingId: 'BK-1003', status: 'completed', checkInTime: '09:28 AM', symptoms: 'Blood pressure adjustment' },
      { tokenNumber: 4, patientName: 'Sarah Johnson', bookingId: 'BK-1004', status: 'in-consultation', checkInTime: '09:42 AM', symptoms: 'Occasional chest tightness during workouts', isCurrentUser: true },
      { tokenNumber: 5, patientName: 'Dev Patel', bookingId: 'BK-1005', status: 'waiting', checkInTime: '09:50 AM', symptoms: 'Cholesterol profile analysis' },
      { tokenNumber: 6, patientName: 'Hannah Abbott', bookingId: 'BK-1006', status: 'waiting', checkInTime: '09:55 AM', symptoms: 'Shortness of breath on stairs' },
      { tokenNumber: 7, patientName: 'Carlos Rossi', bookingId: 'BK-1007', status: 'waiting', checkInTime: '10:05 AM', symptoms: 'Cardiac clearance for surgery' }
    ]
  },
  'doc_2': {
    doctorId: 'doc_2',
    status: 'in-session',
    currentToken: 2,
    avgConsultTimeMins: 15,
    tokens: [
      { tokenNumber: 1, patientName: 'Sophie Turner', bookingId: 'BK-2001', status: 'completed', checkInTime: '10:00 AM', symptoms: 'Severe eczema flare-up' },
      { tokenNumber: 2, patientName: 'Amit Trivedi', bookingId: 'BK-2002', status: 'in-consultation', checkInTime: '10:16 AM', symptoms: 'Cystic acne prescription follow-up' },
      { tokenNumber: 3, patientName: 'Jessica Alba', bookingId: 'BK-2003', status: 'waiting', checkInTime: '10:25 AM', symptoms: 'Skin allergy rash on forearms' },
      { tokenNumber: 4, patientName: 'George Clark', bookingId: 'BK-2005', status: 'waiting', checkInTime: '10:35 AM', symptoms: 'Scalp psoriasis evaluation' }
    ]
  }
};

const SEED_BOOKINGS = [
  {
    bookingId: 'MED-BK-7890',
    patientId: 'pat_1',
    patientName: 'Sarah Johnson',
    patientAge: 32,
    patientGender: 'Female',
    patientPhone: '+1 (555) 234-8900',
    doctorId: 'doc_1',
    doctorName: 'Dr. Aris Thorne',
    specialty: 'Cardiology',
    hospital: 'Metro Heart Institute, Wing B - Room 304',
    mediarcaId: 'MED-DOC-1082',
    date: 'Today',
    timeSlot: '09:30 AM - 10:00 AM',
    tokenNumber: 4,
    status: 'in-consultation',
    symptoms: 'Occasional chest tightness during workouts',
    createdAt: '2026-08-16T08:00:00Z',
    prescription: {
      diagnosis: 'Mild exercise-induced tachycardia. Normal resting rhythm.',
      medications: ['Tab. Metoprolol 25mg (OD Morning)', 'Hydration & Electrolytes'],
      advice: 'Avoid excessive pre-workout stimulants. Schedule 2D Echocardiogram next week.'
    }
  }
];

class MediarcaStore {
  constructor() {
    this.subscribers = [];
    this.loadState();
  }

  loadState() {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (serialized) {
        this.state = JSON.parse(serialized);
      } else {
        this.resetToDefaults();
      }
    } catch (e) {
      console.warn('Could not parse localStorage, resetting:', e);
      this.resetToDefaults();
    }
  }

  resetToDefaults() {
    this.state = {
      users: SEED_USERS,
      doctors: SEED_DOCTORS,
      queues: SEED_QUEUES,
      bookings: SEED_BOOKINGS,
      currentUser: {
        role: 'guest',
        id: null,
        name: null
      }
    };
    this.saveState();
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notifySubscribers();
    } catch (e) {
      console.error('State save failed:', e);
    }
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  notifySubscribers() {
    this.subscribers.forEach(cb => {
      try { cb(this.state); } catch (e) { console.error('Subscriber error:', e); }
    });
  }

  // --- Authentication ---
  login(email, password) {
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanPass = (password || '').trim();

    // Check doctors array first
    const doc = this.state.doctors.find(d => d.email && d.email.toLowerCase() === cleanEmail);
    // Check users array
    const user = this.state.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

    if (!doc && !user) {
      throw new Error('No registered account found with this email address.');
    }

    let authenticated = null;

    if (doc) {
      if (doc.password && doc.password !== cleanPass) {
        throw new Error('Incorrect password. Please verify and try again.');
      }
      authenticated = { ...doc, role: 'doctor' };
    } else if (user) {
      if (user.password && user.password !== cleanPass) {
        throw new Error('Incorrect password. Please verify and try again.');
      }
      authenticated = { ...user };
    }

    this.state.currentUser = { ...authenticated };
    this.saveState();
    return this.state.currentUser;
  }

  logout() {
    this.state.currentUser = {
      role: 'guest',
      id: null,
      name: null
    };
    this.saveState();
  }

  registerPatient(data) {
    const existing = this.state.users.find(u => u.email.toLowerCase() === data.email.toLowerCase());
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const newPatient = {
      id: 'pat_' + Date.now(),
      role: 'patient',
      email: data.email,
      password: data.password,
      name: data.name,
      phone: data.phone,
      age: parseInt(data.age) || 30,
      gender: data.gender || 'Other'
    };

    this.state.users.push(newPatient);
    this.state.currentUser = { ...newPatient };
    this.saveState();
    return newPatient;
  }

  registerDoctor(docData) {
    const existingIndex = this.state.doctors.findIndex(d => d.email.toLowerCase() === docData.email.toLowerCase().trim());
    const existingUserIndex = this.state.users.findIndex(u => u.email.toLowerCase() === docData.email.toLowerCase().trim());

    if (existingIndex >= 0) {
      // Update existing doctor application
      const doc = this.state.doctors[existingIndex];
      doc.name = docData.name || doc.name;
      doc.specialty = docData.specialty || doc.specialty;
      doc.specialtyId = (docData.specialty || doc.specialty).toLowerCase().replace(/\s+/g, '');
      doc.degrees = docData.degrees || doc.degrees;
      doc.regNumber = docData.regNumber || doc.regNumber;
      doc.experienceYears = parseInt(docData.experienceYears) || doc.experienceYears;
      doc.hospital = docData.hospital || doc.hospital;
      doc.fee = parseInt(docData.fee) || doc.fee;
      doc.bio = docData.bio || doc.bio;
      if (!doc.verificationStatus) doc.verificationStatus = 'pending';

      if (existingUserIndex >= 0) {
        this.state.users[existingUserIndex] = { ...this.state.users[existingUserIndex], ...doc };
      }

      this.state.currentUser = { ...doc };

      if (window.mediarcaSupabase) {
        window.mediarcaSupabase.cloudRegisterDoctor(doc);
      }

      this.saveState();
      return doc;
    }

    const newId = 'doc_' + Date.now();
    const newDoc = {
      id: newId,
      role: 'doctor',
      email: docData.email.trim(),
      password: docData.password || 'doc123',
      name: docData.name.trim(),
      specialty: docData.specialty,
      specialtyId: docData.specialty.toLowerCase().replace(/\s+/g, ''),
      title: docData.title || 'Consultant Specialist',
      degrees: docData.degrees.trim(),
      regNumber: docData.regNumber.trim(),
      mediarcaId: null, // Pending verification
      verificationStatus: 'pending',
      experienceYears: parseInt(docData.experienceYears) || 5,
      hospital: docData.hospital.trim(),
      fee: parseInt(docData.fee) || 50,
      rating: 5.0,
      reviewsCount: 0,
      avatar: docData.avatar || 'https://images.unsplash.com/photo-1594824813501-48e02d64a27a?w=300&h=300&fit=crop&crop=faces&q=80',
      bio: docData.bio || 'Board certified practitioner.',
      schedule: 'Mon - Fri | 09:00 AM - 02:00 PM',
      queueActive: false,
      currentToken: 0,
      totalTokens: 0,
      avgConsultTimeMins: 12,
      appliedDate: new Date().toISOString().split('T')[0]
    };

    this.state.users.push(newDoc);
    this.state.doctors.unshift(newDoc);
    this.state.currentUser = { ...newDoc };

    if (window.mediarcaSupabase) {
      window.mediarcaSupabase.cloudRegisterDoctor(newDoc);
    }

    this.saveState();
    return newDoc;
  }

  verifyDoctor(doctorId, approved = true, rejectReason = '') {
    let doc = this.state.doctors.find(d => d.id === doctorId);
    let user = this.state.users.find(u => u.id === doctorId);

    if (!doc && doctorId) {
      doc = this.state.doctors.find(d => d.email && d.email.toLowerCase() === doctorId.toLowerCase());
    }
    if (!user && doc) {
      user = this.state.users.find(u => u.email && doc.email && u.email.toLowerCase() === doc.email.toLowerCase());
    }

    if (!doc) return null;

    if (approved) {
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const newMedId = `MED-DOC-${randomCode}`;
      doc.mediarcaId = newMedId;
      doc.verificationStatus = 'verified';
      doc.role = 'doctor';

      if (user) {
        user.mediarcaId = newMedId;
        user.verificationStatus = 'verified';
        user.role = 'doctor';
      } else {
        this.state.users.push({ ...doc });
      }

      if (window.mediarcaSupabase) {
        window.mediarcaSupabase.cloudVerifyDoctor(doc.id, true, newMedId);
      }

      if (!this.state.queues[doc.id]) {
        this.state.queues[doc.id] = {
          doctorId: doc.id,
          status: 'ready',
          currentToken: 0,
          avgConsultTimeMins: doc.avgConsultTimeMins || 12,
          tokens: []
        };
      }
    } else {
      doc.verificationStatus = 'rejected';
      doc.rejectReason = rejectReason || 'Credential validation mismatch.';
      if (user) user.verificationStatus = 'rejected';
      if (window.mediarcaSupabase) {
        window.mediarcaSupabase.cloudVerifyDoctor(doc.id, false, null);
      }
    }

    if (this.state.currentUser.email && doc.email && this.state.currentUser.email.toLowerCase() === doc.email.toLowerCase()) {
      this.state.currentUser = { ...doc, role: 'doctor' };
    }

    this.saveState();
    return doc;
  }

  advanceDoctorQueue(doctorId) {
    const queue = this.state.queues[doctorId];
    const doc = this.state.doctors.find(d => d.id === doctorId);
    if (!queue || !doc) return null;

    const currentTokenNum = queue.currentToken;
    const currentEntry = queue.tokens.find(t => t.tokenNumber === currentTokenNum);
    if (currentEntry) currentEntry.status = 'completed';

    const nextEntry = queue.tokens.find(t => t.tokenNumber > currentTokenNum && t.status === 'waiting') || queue.tokens.find(t => t.status === 'waiting');
    if (nextEntry) {
      nextEntry.status = 'in-consultation';
      queue.currentToken = nextEntry.tokenNumber;
      queue.status = 'in-session';
      doc.currentToken = nextEntry.tokenNumber;
      doc.queueActive = true;

      const booking = this.state.bookings.find(b => (b.doctorId === doctorId || b.doctorId === doc.id) && b.tokenNumber === nextEntry.tokenNumber);
      if (booking) booking.status = 'in-consultation';

      if (window.mediarcaSupabase) {
        window.mediarcaSupabase.cloudAdvanceQueue(doctorId, nextEntry.tokenNumber, 'in-session');
      }
    } else {
      queue.status = 'completed';
      queue.currentToken = 0;
      doc.currentToken = 0;
      doc.queueActive = false;
      if (window.mediarcaSupabase) {
        window.mediarcaSupabase.cloudAdvanceQueue(doctorId, 0, 'completed');
      }
    }

    this.saveState();
    return queue;
  }

  completeConsultationWithPrescription(doctorId, tokenNumber, rxData) {
    let booking = this.state.bookings.find(b => b.doctorId === doctorId && b.tokenNumber === tokenNumber);
    if (!booking) {
      booking = this.state.bookings.find(b => b.tokenNumber === tokenNumber && b.status !== 'completed');
    }

    if (booking) {
      booking.status = 'completed';
      booking.prescription = {
        diagnosis: rxData.diagnosis || 'Clinical evaluation completed.',
        medications: Array.isArray(rxData.medications) ? rxData.medications : [rxData.medications || 'Prescribed oral medication as directed'],
        advice: rxData.advice || 'Drink adequate fluids and schedule follow-up in 2 weeks if symptoms persist.'
      };

      if (window.mediarcaSupabase) {
        window.mediarcaSupabase.cloudSavePrescription(booking.bookingId, booking.prescription);
      }
    }

    const queue = this.state.queues[doctorId];
    if (queue) {
      const tokenEntry = queue.tokens.find(t => t.tokenNumber === tokenNumber);
      if (tokenEntry) tokenEntry.status = 'completed';
    }

    return this.advanceDoctorQueue(doctorId);
  }

  pauseDoctorQueue(doctorId) {
    const queue = this.state.queues[doctorId];
    const doc = this.state.doctors.find(d => d.id === doctorId);
    if (!queue || !doc) return null;

    queue.status = queue.status === 'paused' ? 'in-session' : 'paused';
    doc.queueActive = queue.status === 'in-session';

    if (window.mediarcaSupabase) {
      window.mediarcaSupabase.cloudAdvanceQueue(doctorId, queue.currentToken, queue.status);
    }

    this.saveState();
    return queue;
  }

  bookAppointment(bookingData) {
    const doctor = this.state.doctors.find(d => d.id === bookingData.doctorId);
    if (!doctor) throw new Error('Doctor not found');

    if (doctor.verificationStatus !== 'verified') {
      throw new Error('This doctor is currently pending verification and cannot accept bookings.');
    }

    if (!this.state.queues[doctor.id]) {
      this.state.queues[doctor.id] = {
        doctorId: doctor.id,
        status: 'in-session',
        currentToken: 0,
        avgConsultTimeMins: doctor.avgConsultTimeMins || 12,
        tokens: []
      };
    }

    const queue = this.state.queues[doctor.id];
    const nextTokenNumber = (queue.tokens.length > 0 ? Math.max(...queue.tokens.map(t => t.tokenNumber)) : 0) + 1;
    doctor.totalTokens = nextTokenNumber;

    const tokenObj = {
      tokenNumber: nextTokenNumber,
      patientName: bookingData.patientName,
      bookingId: 'MED-BK-' + Math.floor(1000 + Math.random() * 9000),
      status: queue.currentToken === 0 && nextTokenNumber === 1 ? 'in-consultation' : 'waiting',
      checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      symptoms: bookingData.symptoms || 'General Clinical Consultation',
      isCurrentUser: true
    };

    if (queue.currentToken === 0 && nextTokenNumber === 1) {
      queue.currentToken = 1;
      queue.status = 'in-session';
      doctor.currentToken = 1;
      doctor.queueActive = true;
    }

    queue.tokens.push(tokenObj);

    const newBooking = {
      bookingId: tokenObj.bookingId,
      patientId: this.state.currentUser.id || 'pat_' + Date.now(),
      patientName: bookingData.patientName,
      patientAge: bookingData.patientAge || 30,
      patientGender: bookingData.patientGender || 'Female',
      patientPhone: bookingData.patientPhone || '+1 (555) 000-0000',
      doctorId: doctor.id,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      hospital: doctor.hospital,
      mediarcaId: doctor.mediarcaId,
      date: 'Today',
      timeSlot: 'Live Session Slot',
      tokenNumber: nextTokenNumber,
      status: tokenObj.status,
      symptoms: bookingData.symptoms,
      createdAt: new Date().toISOString(),
      prescription: null
    };

    this.state.bookings.unshift(newBooking);

    if (window.mediarcaSupabase) {
      window.mediarcaSupabase.cloudBookAppointment(newBooking);
    }

    this.saveState();
    return newBooking;
  }
}

window.mediarcaStore = new MediarcaStore();
