import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MediArca database with production demo data...');

  // Clear existing
  await prisma.review.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const doctorPassword = await bcrypt.hash('doctor123', salt);
  const patientPassword = await bcrypt.hash('patient123', salt);

  // 1. Create Admin
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@mediarca.com',
      passwordHash: adminPassword,
      fullName: 'MediArca Administrator',
      phone: '+1 555-0100',
      role: 'ADMIN',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    },
  });

  // 2. Create Doctors
  // Doctor 1 - Dr. Sarah Jenkins (Cardiology)
  const drSarahUser = await prisma.user.create({
    data: {
      email: 'dr.sarah@mediarca.com',
      passwordHash: doctorPassword,
      fullName: 'Dr. Sarah Jenkins',
      phone: '+1 555-0101',
      role: 'DOCTOR',
      avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=256&q=80',
      doctorProfile: {
        create: {
          specialty: 'Cardiology',
          qualifications: 'MD - Harvard Medical School, FACC',
          experienceYears: 14,
          consultationFee: 80.0,
          bio: 'Specialist in preventive cardiology, hypertension, coronary artery disease, and heart failure management with over 14 years of clinical experience.',
          clinicAddress: 'City Heart & Vascular Institute, Suite 402, New York, NY',
          isVerified: true,
          checkingStartTime: '09:00',
          checkingEndTime: '13:00',
          avgConsultationMinutes: 20,
          maxDailyPatients: 25,
          rating: 4.9,
          totalReviews: 128,
        },
      },
    },
    include: { doctorProfile: true },
  });

  // Doctor 2 - Dr. Arjun Patel (Dermatology)
  const drArjunUser = await prisma.user.create({
    data: {
      email: 'dr.arjun@mediarca.com',
      passwordHash: doctorPassword,
      fullName: 'Dr. Arjun Patel',
      phone: '+1 555-0102',
      role: 'DOCTOR',
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=256&q=80',
      doctorProfile: {
        create: {
          specialty: 'Dermatology',
          qualifications: 'MD - Stanford Medicine, Board Certified',
          experienceYears: 10,
          consultationFee: 65.0,
          bio: 'Consultant dermatologist focusing on acne, eczema, psoriasis, skin cancer screening, and cosmetic laser treatments.',
          clinicAddress: 'Apex Skin & Aesthetics Clinic, Floor 2, San Francisco, CA',
          isVerified: true,
          checkingStartTime: '10:00',
          checkingEndTime: '14:00',
          avgConsultationMinutes: 15,
          maxDailyPatients: 30,
          rating: 4.8,
          totalReviews: 94,
        },
      },
    },
    include: { doctorProfile: true },
  });

  // Doctor 3 - Dr. Elena Rostova (Pediatrics)
  const drElenaUser = await prisma.user.create({
    data: {
      email: 'dr.elena@mediarca.com',
      passwordHash: doctorPassword,
      fullName: 'Dr. Elena Rostova',
      phone: '+1 555-0103',
      role: 'DOCTOR',
      avatarUrl: 'https://images.unsplash.com/photo-1594824813576-0f723652f146?auto=format&fit=crop&w=256&q=80',
      doctorProfile: {
        create: {
          specialty: 'Pediatrics',
          qualifications: 'MD, FAAP - Johns Hopkins University',
          experienceYears: 12,
          consultationFee: 70.0,
          bio: 'Dedicated pediatrician providing comprehensive child wellness care, developmental tracking, vaccinations, and adolescent healthcare.',
          clinicAddress: 'Little Steps Children Care, Building B, Chicago, IL',
          isVerified: true,
          checkingStartTime: '08:30',
          checkingEndTime: '12:30',
          avgConsultationMinutes: 15,
          maxDailyPatients: 28,
          rating: 5.0,
          totalReviews: 150,
        },
      },
    },
    include: { doctorProfile: true },
  });

  // Doctor 4 - Dr. Marcus Vance (Unverified - for Admin approval test)
  const drMarcusUser = await prisma.user.create({
    data: {
      email: 'dr.marcus@mediarca.com',
      passwordHash: doctorPassword,
      fullName: 'Dr. Marcus Vance',
      phone: '+1 555-0104',
      role: 'DOCTOR',
      avatarUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=256&q=80',
      doctorProfile: {
        create: {
          specialty: 'Orthopedics',
          qualifications: 'DO - Chicago College of Osteopathic Medicine',
          experienceYears: 7,
          consultationFee: 90.0,
          bio: 'Specialist in joint preservation, sports injuries, fracture management, and minimally invasive orthopedic surgery.',
          clinicAddress: 'Vance Orthopedic Care, Boston, MA',
          isVerified: false, // PENDING ADMIN APPROVAL
          checkingStartTime: '09:00',
          checkingEndTime: '13:00',
          avgConsultationMinutes: 20,
          maxDailyPatients: 20,
          rating: 5.0,
          totalReviews: 0,
        },
      },
    },
    include: { doctorProfile: true },
  });

  // 3. Create Patient
  const patientUser = await prisma.user.create({
    data: {
      email: 'john.doe@gmail.com',
      passwordHash: patientPassword,
      fullName: 'John Doe',
      phone: '+1 555-0199',
      role: 'PATIENT',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
      patientProfile: {
        create: {
          dateOfBirth: '1990-05-14',
          gender: 'Male',
          bloodGroup: 'O+',
          allergies: 'Penicillin, Dust mites',
          existingConditions: 'Mild Hypertension',
          currentMedications: 'Amlodipine 5mg OD',
          emergencyContact: 'Jane Doe (+1 555-0198)',
        },
      },
    },
    include: { patientProfile: true },
  });

  // 4. Create Appointments & Queue Numbers
  const todayStr = new Date().toISOString().split('T')[0];

  // Appointment 1: Active Waiting Queue #1 with Dr. Sarah Jenkins
  const appt1 = await prisma.appointment.create({
    data: {
      patientId: patientUser.patientProfile!.id,
      doctorId: drSarahUser.doctorProfile!.id,
      appointmentDate: todayStr,
      queueNumber: 1,
      checkingWindow: '09:00 AM - 01:00 PM',
      estimatedTime: '09:00 AM',
      status: 'WAITING',
      reasonForVisit: 'Routine cardiac checkup and BP review',
      symptoms: 'Occasional mild palpitations in evening',
      vitals: JSON.stringify({ bp: '128/84', pulse: '76 bpm', temp: '98.4 F', weight: '74 kg' }),
    },
  });

  // Appointment 2: Active Waiting Queue #2 with Dr. Sarah Jenkins (another patient)
  const patient2User = await prisma.user.create({
    data: {
      email: 'emily.clark@gmail.com',
      passwordHash: patientPassword,
      fullName: 'Emily Clark',
      phone: '+1 555-0205',
      role: 'PATIENT',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      patientProfile: {
        create: {
          dateOfBirth: '1994-08-22',
          gender: 'Female',
          bloodGroup: 'A+',
          allergies: 'None',
        },
      },
    },
    include: { patientProfile: true },
  });

  const appt2 = await prisma.appointment.create({
    data: {
      patientId: patient2User.patientProfile!.id,
      doctorId: drSarahUser.doctorProfile!.id,
      appointmentDate: todayStr,
      queueNumber: 2,
      checkingWindow: '09:00 AM - 01:00 PM',
      estimatedTime: '09:20 AM',
      status: 'WAITING',
      reasonForVisit: 'Chest discomfort evaluation',
      symptoms: 'Shortness of breath on stairs',
    },
  });

  // Appointment 3: Past Completed Appointment with Dr. Elena + Digital Prescription
  const pastAppt = await prisma.appointment.create({
    data: {
      patientId: patientUser.patientProfile!.id,
      doctorId: drElenaUser.doctorProfile!.id,
      appointmentDate: '2026-08-15',
      queueNumber: 3,
      checkingWindow: '08:30 AM - 12:30 PM',
      estimatedTime: '09:00 AM',
      status: 'COMPLETED',
      reasonForVisit: 'Acute seasonal allergic rhinitis and dry cough',
      symptoms: 'Sneezing, itchy eyes, dry cough for 4 days',
      vitals: JSON.stringify({ bp: '120/80', pulse: '72 bpm', temp: '98.6 F', weight: '73 kg' }),
      clinicalNotes: 'Clear lung sounds bilaterally. Nasal mucosa mildly erythematous. No wheezing.',
    },
  });

  // Create Digital Prescription for past appointment
  await prisma.prescription.create({
    data: {
      appointmentId: pastAppt.id,
      diagnosis: 'Allergic Rhinitis with Mild Reactive Airway',
      medicines: JSON.stringify([
        {
          name: 'Cetirizine 10mg',
          dosage: '1 Tablet',
          frequency: 'Once daily at bedtime',
          duration: '7 Days',
          instructions: 'Take with water after dinner. May cause mild drowsiness.',
        },
        {
          name: 'Fluticasone Propionate Nasal Spray 50mcg',
          dosage: '1 Spray in each nostril',
          frequency: 'Twice daily',
          duration: '14 Days',
          instructions: 'Gently shake before use. Avoid blowing nose immediately after.',
        },
      ]),
      advice: 'Avoid exposure to heavy dust and dry cold air. Use steam inhalation twice daily.',
      followUpDate: '2026-08-25',
    },
  });

  // Create Review for past appointment
  await prisma.review.create({
    data: {
      appointmentId: pastAppt.id,
      doctorId: drElenaUser.doctorProfile!.id,
      patientId: patientUser.id,
      rating: 5,
      comment: 'Dr. Elena was exceptionally attentive and explained the allergy triggers in detail. Recovered within 3 days!',
    },
  });

  // 5. Create Medical Records for John Doe
  await prisma.medicalRecord.createMany({
    data: [
      {
        patientId: patientUser.patientProfile!.id,
        title: 'Complete Blood Count (CBC) & Lipid Profile',
        category: 'Lab Report',
        fileUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80',
        fileType: 'pdf',
      },
      {
        patientId: patientUser.patientProfile!.id,
        title: 'Resting ECG & Rhythm Strip',
        category: 'Scan',
        fileUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80',
        fileType: 'pdf',
      },
    ],
  });

  console.log('Database seeded successfully!');
  console.log('--- DEMO ACCOUNTS ---');
  console.log('Admin:   admin@mediarca.com   / admin123');
  console.log('Doctor:  dr.sarah@mediarca.com / doctor123');
  console.log('Doctor:  dr.arjun@mediarca.com / doctor123');
  console.log('Doctor:  dr.marcus@mediarca.com / doctor123 (Unverified)');
  console.log('Patient: john.doe@gmail.com   / patient123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
