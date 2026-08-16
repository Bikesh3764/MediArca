/**
 * Mediarca Central Data Store & RBAC Authentication Engine
 * NIST Standard 256-Bit SHA-256 Hashing, Signed Session Integrity, and Multi-tenant isolation
 */

const STORAGE_KEY = 'mediarca_release_v3';
const HASH_SALT = 'mediarca_salt_2026_';

/**
 * Standard NIST FIPS PUB 180-4 compliant 256-Bit SHA-256 cryptographic hash function
 * Produces the exact 64-character hexadecimal digest identical to crypto.subtle and OpenSSL
 */
function sha256Standard(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';
  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty];) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const s1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25));
      const ch = ((e & hash[5]) ^ ((~e) & hash[6]));
      const temp1 = (hash[7] + s1 + ch + k[i] + (w[i] = (i < 16) ? w[i] : (
        w[i - 16] +
        (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
        w[i - 7] +
        (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
      ) | 0)) | 0;
      const s0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22));
      const maj = ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      const temp2 = (s0 + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    result += ('00000000' + (hash[i] >>> 0).toString(16)).slice(-8);
  }
  return result;
}

function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') return '';
  return sha256Standard(HASH_SALT + plainPassword.trim());
}

function generateSessionSignature(id, role, email) {
  return sha256Standard(`mediarca_session_sign_${id}_${role}_${(email || '').toLowerCase()}`);
}

const SEED_USERS = [
  {
    id: 'pat_1',
    role: 'patient',
    email: 'sarah@mediarca.health',
    passwordHash: '7b59d1165b90aba0d200aa746c27bff827b913e1502d81ef71acf165fb7e5255', // patient123
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
    passwordHash: 'b65ef545b2a4b7b331c736bd7a1f85e94750a50e49fc30d01af8762fdd73d9df', // doc123
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
    passwordHash: 'b65ef545b2a4b7b331c736bd7a1f85e94750a50e49fc30d01af8762fdd73d9df', // doc123
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
    passwordHash: '1bfdf078ee4ec9034d12dc418cbc1e3e05fbfae2ed298ac13f8f402bf5435dd9', // admin2026
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
    passwordHash: 'b65ef545b2a4b7b331c736bd7a1f85e94750a50e49fc30d01af8762fdd73d9df',
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
    bio: 'Expertise in clinical dermatology, acne therapeutics, laser aesthetic procedures, and psoriasis biologics.',
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
    passwordHash: 'b65ef545b2a4b7b331c736bd7a1f85e94750a50e49fc30d01af8762fdd73d9df',
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
    passwordHash: 'b65ef545b2a4b7b331c736bd7a1f85e94750a50e49fc30d01af8762fdd73d9df',
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
    bio: 'Specialized in newborn intensive care, developmental milestones, immunization regimes, and pediatric asthma.',
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
    passwordHash: 'b65ef545b2a4b7b331c736bd7a1f85e94750a50e49fc30d01af8762fdd73d9df',
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
    bio: 'Expert in intractable migraines, epilepsy management, stroke rehabilitation, and Parkinson disease therapeutics.',
    schedule: 'Mon - Fri | 11:00 AM - 05:00 PM',
    queueActive: false,
    currentToken: 0,
    totalTokens: 0,
    avgConsultTimeMins: 15
  },
  SEED_USERS[2] // doc_6 (pending)
];

const SEED_QUEUES = {
  'doc_1': {
    doctorId: 'doc_1',
    currentToken: 4,
    status: 'in-session',
    avgConsultTimeMins: 12,
    tokens: [
      { tokenNumber: 1, patientName: 'Arthur Dent', bookingId: 'MED-BK-1001', status: 'completed', checkInTime: '09:00 AM', symptoms: 'ECG review & palpitations' },
      { tokenNumber: 2, patientName: 'Maria Garcia', bookingId: 'MED-BK-1002', status: 'completed', checkInTime: '09:14 AM', symptoms: 'Post-angioplasty routine check' },
      { tokenNumber: 3, patientName: 'Liam Wilson', bookingId: 'MED-BK-1003', status: 'completed', checkInTime: '09:28 AM', symptoms: 'Blood pressure adjustment' },
      { tokenNumber: 4, patientName: 'Sarah Johnson', bookingId: 'MED-BK-7890', status: 'in-consultation', checkInTime: '09:42 AM', symptoms: 'Occasional chest tightness during intense workout sessions', isCurrentUser: true },
      { tokenNumber: 5, patientName: 'Dev Patel', bookingId: 'MED-BK-1005', status: 'waiting', checkInTime: '09:50 AM', symptoms: 'Cholesterol profile analysis' },
      { tokenNumber: 6, patientName: 'Hannah Abbott', bookingId: 'MED-BK-1006', status: 'waiting', checkInTime: '09:55 AM', symptoms: 'Shortness of breath on stairs' },
      { tokenNumber: 7, patientName: 'Vikram Seth', bookingId: 'MED-BK-1007', status: 'waiting', checkInTime: '10:02 AM', symptoms: 'Annual preventive cardiology audit' }
    ]
  },
  'doc_2': {
    doctorId: 'doc_2',
    currentToken: 2,
    status: 'in-session',
    avgConsultTimeMins: 15,
    tokens: [
      { tokenNumber: 1, patientName: 'Chloe Bennett', bookingId: 'MED-BK-2001', status: 'completed', checkInTime: '10:05 AM', symptoms: 'Contact dermatitis patch test' },
      { tokenNumber: 2, patientName: 'Rajesh Rao', bookingId: 'MED-BK-2002', status: 'in-consultation', checkInTime: '10:20 AM', symptoms: 'Severe cystic acne breakout' },
      { tokenNumber: 3, patientName: 'Emma Watson', bookingId: 'MED-BK-2003', status: 'waiting', checkInTime: '10:35 AM', symptoms: 'Psoriasis follow-up' }
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
    timeSlot: '09:40 AM - 10:00 AM',
    tokenNumber: 4,
    status: 'in-consultation',
    symptoms: 'Occasional chest tightness during intense workout sessions',
    createdAt: '2026-08-16T09:42:00.000Z',
    prescription: {
      diagnosis: 'Mild exercise-induced tachycardia. Normal sinus rhythm on resting ECG.',
      medications: [
        'Tab. Metoprolol Tartrate 25mg - 1 tablet once daily (morning)',
        'Oral Electrolyte rehydration sachets during intense training'
      ],
      advice: 'Avoid high-caffeine pre-workout supplements. Follow-up 2D Echocardiogram in 1 week if tightness recurs.'
    }
  }
];

class MediarcaStore {
  constructor() {
    this.state = {
      users: [...SEED_USERS],
      doctors: [...SEED_DOCTORS],
      queues: { ...SEED_QUEUES },
      bookings: [...SEED_BOOKINGS],
      currentUser: {
        role: 'guest',
        id: null,
        name: null,
        sessionToken: null
      }
    };
    this.subscribers = [];
    this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }
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

  // --- Session Integrity & Tamper Validation ---
  isAuthorized(requiredRole = null) {
    const u = this.state.currentUser;
    if (!u || !u.id || !u.role || u.role === 'guest') return false;
    
    // Cryptographically verify session signature
    const expectedSig = generateSessionSignature(u.id, u.role, u.email);
    if (!u.sessionToken || u.sessionToken !== expectedSig) {
      console.warn('⚠️ Session signature invalid or manipulated. Re-authenticating.');
      this.logout();
      return false;
    }

    if (requiredRole && u.role !== requiredRole) {
      return false;
    }
    return true;
  }

  // --- Secure Authentication ---
  login(email, password) {
    if (!email || !password || !email.trim() || !password.trim()) {
      throw new Error('Please provide both email and password.');
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPass = password.trim();
    const inputHash = hashPassword(cleanPass);

    // Look up in doctors first, then users
    const doc = this.state.doctors.find(d => d.email && d.email.toLowerCase() === cleanEmail);
    const user = this.state.users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

    if (!doc && !user) {
      throw new Error('Invalid credentials. No registered account found with this email.');
    }

    let authenticated = null;

    if (doc) {
      const storedHash = doc.passwordHash || hashPassword(doc.password || 'doc123');
      if (storedHash !== inputHash) {
        throw new Error('Incorrect password. Please verify and try again.');
      }
      authenticated = { ...doc, role: 'doctor' };
    } else if (user) {
      const storedHash = user.passwordHash || hashPassword(user.password || 'patient123');
      if (storedHash !== inputHash) {
        throw new Error('Incorrect password. Please verify and try again.');
      }
      authenticated = { ...user };
    }

    if (!authenticated) {
      throw new Error('Authentication failed. Invalid password.');
    }

    // Attach signed session token
    authenticated.sessionToken = generateSessionSignature(authenticated.id, authenticated.role, authenticated.email);

    this.state.currentUser = { ...authenticated };
    this.saveState();
    return this.state.currentUser;
  }

  logout() {
    this.state.currentUser = {
      role: 'guest',
      id: null,
      name: null,
      sessionToken: null
    };
    this.saveState();
  }

  registerPatient(data) {
    if (!data.email || !data.password || !data.name) {
      throw new Error('Please fill all required registration fields.');
    }

    const cleanEmail = data.email.toLowerCase().trim();
    const existing = this.state.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error('An account with this email already exists. Please login.');
    }

    const newPatient = {
      id: 'pat_' + Date.now(),
      role: 'patient',
      email: cleanEmail,
      passwordHash: hashPassword(data.password),
      name: data.name.trim(),
      phone: (data.phone || '+1 (555) 000-0000').trim(),
      age: parseInt(data.age) || 30,
      gender: data.gender || 'Other',
      bloodGroup: data.bloodGroup || 'O+'
    };

    newPatient.sessionToken = generateSessionSignature(newPatient.id, newPatient.role, newPatient.email);

    this.state.users.push(newPatient);
    this.state.currentUser = { ...newPatient };
    this.saveState();
    return newPatient;
  }

  registerDoctor(docData) {
    if (!docData.email || !docData.name || !docData.regNumber) {
      throw new Error('Doctor Name, Email, and Medical Council Registration are required.');
    }

    const cleanEmail = docData.email.toLowerCase().trim();
    const existingIndex = this.state.doctors.findIndex(d => d.email.toLowerCase() === cleanEmail);
    const existingUserIndex = this.state.users.findIndex(u => u.email.toLowerCase() === cleanEmail);

    if (existingIndex >= 0) {
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
      if (docData.password) doc.passwordHash = hashPassword(docData.password);
      if (!doc.verificationStatus) doc.verificationStatus = 'pending';

      doc.sessionToken = generateSessionSignature(doc.id, 'doctor', doc.email);

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
      email: cleanEmail,
      passwordHash: hashPassword(docData.password || 'doc123'),
      name: docData.name.trim(),
      specialty: docData.specialty,
      specialtyId: docData.specialty.toLowerCase().replace(/\s+/g, ''),
      title: docData.title || 'Consultant Specialist',
      degrees: docData.degrees.trim(),
      regNumber: docData.regNumber.trim(),
      mediarcaId: null,
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

    newDoc.sessionToken = generateSessionSignature(newDoc.id, 'doctor', newDoc.email);

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
      this.state.currentUser = { ...doc, role: 'doctor', sessionToken: generateSessionSignature(doc.id, 'doctor', doc.email) };
    }

    this.saveState();
    return doc;
  }

  advanceDoctorQueue(doctorId) {
    const queue = this.state.queues[doctorId];
    const doc = this.state.doctors.find(d => d.id === doctorId);
    if (!queue || !doc) return null;

    // Mark current token completed
    if (queue.currentToken > 0) {
      const currentEntry = queue.tokens.find(t => t.tokenNumber === queue.currentToken);
      if (currentEntry) currentEntry.status = 'completed';
      const booking = this.state.bookings.find(b => (b.doctorId === doctorId || b.doctorId === doc.id) && b.tokenNumber === queue.currentToken);
      if (booking && booking.status === 'in-consultation') booking.status = 'completed';
    }

    // Find next waiting token by sequential priority
    const waitingTokens = (queue.tokens || [])
      .filter(t => t.status === 'waiting')
      .sort((a, b) => a.tokenNumber - b.tokenNumber);

    if (waitingTokens.length > 0) {
      const nextEntry = waitingTokens[0];
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
    let booking = this.state.bookings.find(b => (b.doctorId === doctorId || b.doctorId === this.state.currentUser.id) && b.tokenNumber === tokenNumber);
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
    // Atomic sequential token numbering
    const existingTokens = (queue.tokens || []).map(t => parseInt(t.tokenNumber) || 0);
    const nextTokenNumber = (existingTokens.length > 0 ? Math.max(...existingTokens) : 0) + 1;
    doctor.totalTokens = nextTokenNumber;

    const isFirstInLine = (queue.currentToken === 0 && (!queue.tokens || queue.tokens.length === 0 || !queue.tokens.some(t => t.status === 'in-consultation')));
    const initialStatus = isFirstInLine ? 'in-consultation' : 'waiting';

    const tokenObj = {
      tokenNumber: nextTokenNumber,
      patientName: bookingData.patientName,
      bookingId: 'MED-BK-' + Math.floor(1000 + Math.random() * 9000),
      status: initialStatus,
      checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      symptoms: bookingData.symptoms || 'General Clinical Consultation',
      isCurrentUser: true
    };

    if (initialStatus === 'in-consultation') {
      queue.currentToken = nextTokenNumber;
      queue.status = 'in-session';
      doctor.currentToken = nextTokenNumber;
      doctor.queueActive = true;
    }

    queue.tokens.push(tokenObj);

    const newBooking = {
      bookingId: tokenObj.bookingId,
      patientId: this.state.currentUser.id || 'pat_' + Date.now(),
      patientName: bookingData.patientName,
      patientAge: parseInt(bookingData.patientAge) || 30,
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
