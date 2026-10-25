import { Doctor } from './types';

// Sample doctors for the dev-only offline fallback (VITE_ENABLE_DEMO_FALLBACK=true).
export const DEMO_DOCTORS: Doctor[] = [
  {
    id: 'doc_sarah_01',
    userId: 'usr_sarah_02',
    specialty: 'Cardiology',
    qualifications: 'MD',
    experienceYears: 14,
    consultationFee: 800,
    bio: 'Specialist in preventive cardiology, hypertension, coronary artery disease, and heart failure management with over 14 years of clinical experience.',
    clinicAddress: 'City Heart & Vascular Institute, Suite 402, Bandra West, Mumbai, MH',
    isVerified: true,
    checkingStartTime: '09:00',
    checkingEndTime: '20:00',
    avgConsultationMinutes: 2.7,
    maxDailyPatients: 110,
    slots: [
      {
        id: 'slot_sarah_1',
        name: 'Shift 1',
        startTime: '09:00',
        endTime: '11:00',
        maxPatients: 50,
        avgConsultationMinutes: 2.4, // 120 mins / 50 = 2.4 mins
      },
      {
        id: 'slot_sarah_2',
        name: 'Shift 2',
        startTime: '17:00',
        endTime: '20:00',
        maxPatients: 60,
        avgConsultationMinutes: 3.0, // 180 mins / 60 = 3.0 mins
      },
    ],
    clinics: [
      {
        id: 'cd_sarah_1',
        clinicId: 'clinic_demo_1',
        clinic: {
          id: 'clinic_demo_1',
          clinicName: 'City Heart & Vascular Institute',
          address: 'Suite 402, Hill Road, Bandra West',
          city: 'Mumbai',
          phone: '+91 98200 12345',
          isVerified: true,
        },
      },
      {
        id: 'cd_sarah_2',
        clinicId: 'clinic_demo_2',
        clinic: {
          id: 'clinic_demo_2',
          clinicName: 'Mumbai Specialty Outpatient Clinic',
          address: 'Floor 3, Linking Road, Khar West',
          city: 'Mumbai',
          phone: '+91 98200 54321',
          isVerified: true,
        },
      },
    ],
    user: {
      id: 'usr_sarah_02',
      fullName: 'Dr. Sarah Jenkins',
      email: 'dr.sarah@mediarca.com',
      avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=256&q=80',
    },
  },
  {
    id: 'doc_arjun_02',
    userId: 'usr_arjun_03',
    specialty: 'Dermatology',
    qualifications: 'MD',
    experienceYears: 10,
    consultationFee: 650,
    bio: 'Consultant dermatologist focusing on acne, eczema, psoriasis, skin cancer screening, and cosmetic laser treatments.',
    clinicAddress: 'Apex Skin & Aesthetics Clinic, Floor 2, Indiranagar, Bengaluru, KA',
    isVerified: true,
    checkingStartTime: '10:00',
    checkingEndTime: '18:30',
    avgConsultationMinutes: 4.4,
    maxDailyPatients: 75,
    slots: [
      {
        id: 'slot_arjun_1',
        name: 'Shift 1',
        startTime: '10:00',
        endTime: '13:00',
        maxPatients: 45,
        avgConsultationMinutes: 4.0, // 180 mins / 45 = 4.0 mins
      },
      {
        id: 'slot_arjun_2',
        name: 'Shift 2',
        startTime: '16:00',
        endTime: '18:30',
        maxPatients: 30,
        avgConsultationMinutes: 5.0, // 150 mins / 30 = 5.0 mins
      },
    ],
    clinics: [
      {
        id: 'cd_arjun_1',
        clinicId: 'clinic_demo_3',
        clinic: {
          id: 'clinic_demo_3',
          clinicName: 'Apex Skin & Aesthetics Clinic',
          address: 'Floor 2, 100 Feet Road, Indiranagar',
          city: 'Bengaluru',
          phone: '+91 98450 11223',
          isVerified: true,
        },
      },
    ],
    user: {
      id: 'usr_arjun_03',
      fullName: 'Dr. Arjun Patel',
      email: 'dr.arjun@mediarca.com',
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=256&q=80',
    },
  },
  {
    id: 'doc_elena_03',
    userId: 'usr_elena_04',
    specialty: 'Pediatrics',
    qualifications: 'MD',
    experienceYears: 12,
    consultationFee: 700,
    bio: 'Dedicated pediatrician providing comprehensive child wellness care, developmental tracking, vaccinations, and adolescent healthcare.',
    clinicAddress: 'Little Steps Children Care, Building B, Vasant Vihar, New Delhi, DL',
    isVerified: true,
    checkingStartTime: '08:30',
    checkingEndTime: '18:00',
    avgConsultationMinutes: 4.5,
    maxDailyPatients: 80,
    slots: [
      {
        id: 'slot_elena_1',
        name: 'Shift 1',
        startTime: '08:30',
        endTime: '11:30',
        maxPatients: 40,
        avgConsultationMinutes: 4.5, // 180 mins / 40 = 4.5 mins
      },
      {
        id: 'slot_elena_2',
        name: 'Shift 2',
        startTime: '15:00',
        endTime: '18:00',
        maxPatients: 40,
        avgConsultationMinutes: 4.5, // 180 mins / 40 = 4.5 mins
      },
    ],
    clinics: [
      {
        id: 'cd_elena_1',
        clinicId: 'clinic_demo_4',
        clinic: {
          id: 'clinic_demo_4',
          clinicName: 'Little Steps Children Care',
          address: 'Building B, Community Centre, Vasant Vihar',
          city: 'New Delhi',
          phone: '+91 98110 33445',
          isVerified: true,
        },
      },
      {
        id: 'cd_elena_2',
        clinicId: 'clinic_demo_5',
        clinic: {
          id: 'clinic_demo_5',
          clinicName: 'Metro Pediatric Center',
          address: 'Suite 104, Palam Marg, Vasant Vihar',
          city: 'New Delhi',
          phone: '+91 98110 55667',
          isVerified: true,
        },
      },
    ],
    user: {
      id: 'usr_elena_04',
      fullName: 'Dr. Elena Rostova',
      email: 'dr.elena@mediarca.com',
      avatarUrl: 'https://images.unsplash.com/photo-1594824813576-0f723652f146?auto=format&fit=crop&w=256&q=80',
    },
  },
];
