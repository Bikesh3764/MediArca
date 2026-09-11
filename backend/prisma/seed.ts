import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding MediArca database with production demo data...');

  // Clear existing
  await prisma.clinicDoctor.deleteMany();
  await prisma.doctorReceptionist.deleteMany();
  await prisma.review.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.clinicProfile.deleteMany();
  await prisma.receptionistProfile.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const doctorPassword = await bcrypt.hash('doctor123', salt);
  const patientPassword = await bcrypt.hash('patient123', salt);
  const clinicPassword = await bcrypt.hash('clinic123', salt);
  const receptionistPassword = await bcrypt.hash('receptionist123', salt);

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
          checkingEndTime: '20:00',
          avgConsultationMinutes: 2.7,
          maxDailyPatients: 110,
          rating: 4.9,
          totalReviews: 128,
          slots: JSON.stringify([
            {
              id: 'slot_sarah_1',
              name: 'Morning Shift (09:00 AM – 11:00 AM)',
              startTime: '09:00',
              endTime: '11:00',
              maxPatients: 50,
              avgConsultationMinutes: 2.4, // 120 mins / 50 patients = 2.4 mins
            },
            {
              id: 'slot_sarah_2',
              name: 'Evening Shift (05:00 PM – 08:00 PM)',
              startTime: '17:00',
              endTime: '20:00',
              maxPatients: 60,
              avgConsultationMinutes: 3.0, // 180 mins / 60 patients = 3.0 mins
            },
          ]),
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
          checkingEndTime: '18:30',
          avgConsultationMinutes: 4.4,
          maxDailyPatients: 75,
          rating: 4.8,
          totalReviews: 94,
          slots: JSON.stringify([
            {
              id: 'slot_arjun_1',
              name: 'Morning Clinic (10:00 AM – 01:00 PM)',
              startTime: '10:00',
              endTime: '13:00',
              maxPatients: 45,
              avgConsultationMinutes: 4.0, // 180 mins / 45 = 4.0 mins
            },
            {
              id: 'slot_arjun_2',
              name: 'Afternoon Clinic (04:00 PM – 06:30 PM)',
              startTime: '16:00',
              endTime: '18:30',
              maxPatients: 30,
              avgConsultationMinutes: 5.0, // 150 mins / 30 = 5.0 mins
            },
          ]),
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
          checkingEndTime: '18:00',
          avgConsultationMinutes: 4.5,
          maxDailyPatients: 80,
          rating: 5.0,
          totalReviews: 150,
          slots: JSON.stringify([
            {
              id: 'slot_elena_1',
              name: 'Morning Wellness (08:30 AM – 11:30 AM)',
              startTime: '08:30',
              endTime: '11:30',
              maxPatients: 40,
              avgConsultationMinutes: 4.5, // 180 mins / 40 = 4.5 mins
            },
            {
              id: 'slot_elena_2',
              name: 'Afternoon Consults (03:00 PM – 06:00 PM)',
              startTime: '15:00',
              endTime: '18:00',
              maxPatients: 40,
              avgConsultationMinutes: 4.5, // 180 mins / 40 = 4.5 mins
            },
          ]),
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
          avgConsultationMinutes: 6.0,
          maxDailyPatients: 40,
          rating: 5.0,
          totalReviews: 0,
          slots: JSON.stringify([
            {
              id: 'slot_marcus_1',
              name: 'Orthopedic Shift (09:00 AM – 01:00 PM)',
              startTime: '09:00',
              endTime: '13:00',
              maxPatients: 40,
              avgConsultationMinutes: 6.0, // 240 mins / 40 = 6.0 mins
            },
          ]),
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

  // 4. Create Demo Clinic & Receptionist
  const clinicUser = await prisma.user.create({
    data: {
      email: 'clinic@mediarca.com',
      passwordHash: clinicPassword,
      fullName: 'Metropolis Polyclinic & Diagnostic',
      phone: '+1 555-0199',
      role: 'CLINIC',
      clinicProfile: {
        create: {
          clinicName: 'Metropolis Polyclinic & Diagnostic',
          address: 'Floor 3, 100 Broadway, New York, NY',
          city: 'New York',
          phone: '+1 555-0199',
        },
      },
    },
    include: { clinicProfile: true },
  });

  const receptionistUser = await prisma.user.create({
    data: {
      email: 'receptionist@mediarca.com',
      passwordHash: receptionistPassword,
      fullName: 'Clara Oswald',
      phone: '+1 555-0188',
      role: 'RECEPTIONIST',
      receptionistProfile: {
        create: {
          phone: '+1 555-0188',
        },
      },
    },
    include: { receptionistProfile: true },
  });

  // Link Dr. Sarah Jenkins and Dr. Arjun Patel to the Clinic
  await prisma.clinicDoctor.create({
    data: {
      clinicId: clinicUser.clinicProfile!.id,
      doctorId: drSarahUser.doctorProfile!.id,
      status: 'ACTIVE',
    },
  });

  await prisma.clinicDoctor.create({
    data: {
      clinicId: clinicUser.clinicProfile!.id,
      doctorId: drArjunUser.doctorProfile!.id,
      status: 'ACTIVE',
    },
  });

  // Link Dr. Sarah Jenkins to Receptionist Clara
  await prisma.doctorReceptionist.create({
    data: {
      doctorId: drSarahUser.doctorProfile!.id,
      receptionistId: receptionistUser.receptionistProfile!.id,
      status: 'ACTIVE',
    },
  });

  // 5. Create Appointments & Queue Numbers
  const todayStr = new Date().toISOString().split('T')[0];

  // Appointment 1: Active Waiting Queue #1 with Dr. Sarah Jenkins (attributed to Metropolis Polyclinic)
  const appt1 = await prisma.appointment.create({
    data: {
      patientId: patientUser.patientProfile!.id,
      doctorId: drSarahUser.doctorProfile!.id,
      clinicId: clinicUser.clinicProfile!.id,
      appointmentDate: todayStr,
      queueNumber: 1,
      slotId: 'slot_sarah_1',
      checkingWindow: 'Morning Shift (09:00 AM – 11:00 AM)',
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
      clinicId: clinicUser.clinicProfile!.id,
      appointmentDate: todayStr,
      queueNumber: 2,
      slotId: 'slot_sarah_1',
      checkingWindow: 'Morning Shift (09:00 AM – 11:00 AM)',
      estimatedTime: '09:02 AM', // Paced at 2.4 min/patient for 50 capacity
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
  console.log('Admin:        admin@mediarca.com        / admin123');
  console.log('Doctor:       dr.sarah@mediarca.com     / doctor123');
  console.log('Doctor:       dr.arjun@mediarca.com     / doctor123');
  console.log('Doctor:       dr.marcus@mediarca.com    / doctor123 (Unverified)');
  console.log('Patient:      john.doe@gmail.com        / patient123');
  console.log('Clinic:       clinic@mediarca.com       / clinic123');
  console.log('Receptionist: receptionist@mediarca.com / receptionist123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
