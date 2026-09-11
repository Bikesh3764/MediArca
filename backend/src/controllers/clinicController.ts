import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';

/**
 * Get profile and statistics for currently authenticated clinic
 */
export const getMyClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        receptionists: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, phone: true, createdAt: true },
            },
            doctors: {
              include: {
                doctor: {
                  include: {
                    user: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        doctors: {
          include: {
            doctor: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    // Fetch all appointments linked to this clinic
    const clinicAppointments = await prisma.appointment.findMany({
      where: { clinicId: clinic.id },
      include: {
        patient: {
          include: {
            user: { select: { fullName: true, phone: true, email: true } },
          },
        },
        doctor: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute stats per doctor specifically for THIS clinic
    const doctorStats = clinic.doctors.map((cd) => {
      const docAppointments = clinicAppointments.filter((a) => a.doctorId === cd.doctorId);
      const activeOrCompleted = docAppointments.filter((a) => a.status !== 'CANCELLED');
      const bookingCount = docAppointments.length;
      const completedCount = docAppointments.filter((a) => a.status === 'COMPLETED').length;
      const revenue = activeOrCompleted.length * (cd.doctor.consultationFee || 0);

      return {
        affiliationId: cd.id,
        doctorId: cd.doctor.id,
        fullName: cd.doctor.user.fullName,
        email: cd.doctor.user.email,
        phone: cd.doctor.user.phone,
        avatarUrl: cd.doctor.user.avatarUrl,
        specialty: cd.doctor.specialty,
        qualifications: cd.doctor.qualifications,
        experienceYears: cd.doctor.experienceYears,
        consultationFee: cd.doctor.consultationFee,
        bookingCount,
        completedCount,
        revenue,
        status: cd.status,
        joinedAt: cd.createdAt,
      };
    });

    const totalDoctors = doctorStats.length;
    const totalBookings = clinicAppointments.length;
    const totalRevenue = doctorStats.reduce((sum, d) => sum + d.revenue, 0);

    res.json({
      success: true,
      data: {
        clinic: {
          id: clinic.id,
          clinicName: clinic.clinicName,
          address: clinic.address,
          city: clinic.city,
          phone: clinic.phone,
          isVerified: clinic.isVerified,
          createdAt: clinic.createdAt,
        },
        doctors: doctorStats,
        receptionists: (() => {
          const activeDocIds = new Set(clinic.doctors.map((cd) => cd.doctorId));
          return (clinic.receptionists || []).map((r) => {
            const validDoctors = r.doctors.filter((d) => activeDocIds.has(d.doctorId));
            return {
              id: r.id,
              userId: r.userId,
              fullName: r.user.fullName,
              email: r.user.email,
              phone: r.phone || r.user.phone || '',
              doctorIds: validDoctors.map((d) => d.doctorId),
              doctors: validDoctors.map((d) => ({
                id: d.doctor.id,
                fullName: d.doctor.user.fullName,
                specialty: d.doctor.specialty,
              })),
              createdAt: r.createdAt,
            };
          });
        })(),
        totalDoctors,
        totalBookings,
        totalRevenue,
        recentAppointments: clinicAppointments.slice(0, 15).map((a) => ({
          id: a.id,
          patientName: a.patient?.user?.fullName || 'Patient',
          patientPhone: a.patient?.user?.phone || 'N/A',
          doctorName: a.doctor?.user?.fullName || 'Doctor',
          doctorId: a.doctorId,
          date: a.appointmentDate,
          queueNumber: a.queueNumber,
          checkingWindow: a.checkingWindow,
          estimatedTime: a.estimatedTime,
          status: a.status,
          fee: a.doctor.consultationFee,
        })),
      },
    });
  } catch (error: any) {
    console.error('getMyClinic error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve clinic details', error: error.message });
  }
};

/**
 * Onboard / Affiliate a doctor to this clinic
 */
export const addDoctorToClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const { doctorEmail, doctorId } = req.body;

    if (!doctorEmail && !doctorId) {
      res.status(400).json({ success: false, message: 'Doctor email or doctor ID is required' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    let doctor: any;
    if (doctorId) {
      doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        include: { user: true },
      });
    } else if (doctorEmail) {
      const user = await prisma.user.findUnique({
        where: { email: doctorEmail.toLowerCase().trim() },
        include: { doctorProfile: true },
      });
      if (user && user.doctorProfile) {
        doctor = { ...user.doctorProfile, user };
      }
    }

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found with provided identifier' });
      return;
    }

    if (!doctor.isVerified) {
      res.status(400).json({ success: false, message: 'Doctor is not yet verified by MediArca administration' });
      return;
    }

    // Check if affiliation already exists
    const existing = await prisma.clinicDoctor.findUnique({
      where: {
        clinicId_doctorId: {
          clinicId: clinic.id,
          doctorId: doctor.id,
        },
      },
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Doctor is already affiliated with this clinic' });
      return;
    }

    const affiliation = await prisma.clinicDoctor.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        status: 'ACTIVE',
      },
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: `${doctor.user.fullName} has been onboarded to ${clinic.clinicName}`,
      data: affiliation,
    });
  } catch (error: any) {
    console.error('addDoctorToClinic error:', error);
    res.status(500).json({ success: false, message: 'Failed to onboard doctor', error: error.message });
  }
};

/**
 * Detach / Remove a doctor from this clinic
 */
export const removeDoctorFromClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const doctorId = String(req.params.doctorId);

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    // Find all receptionists belonging to this clinic
    const clinicReceptionists = await prisma.receptionistProfile.findMany({
      where: { clinicId: clinic.id },
      select: { id: true },
    });
    const recIds = clinicReceptionists.map((r) => r.id);

    await prisma.$transaction([
      prisma.clinicDoctor.deleteMany({
        where: {
          clinicId: clinic.id,
          doctorId,
        },
      }),
      ...(recIds.length > 0
        ? [
            prisma.doctorReceptionist.deleteMany({
              where: {
                doctorId,
                receptionistId: { in: recIds },
              },
            }),
          ]
        : []),
    ]);

    res.json({
      success: true,
      message: 'Doctor detached from clinic successfully',
    });
  } catch (error: any) {
    console.error('removeDoctorFromClinic error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove doctor affiliation', error: error.message });
  }
};

/**
 * Public listing of verified clinics
 */
export const getPublicClinics = async (req: any, res: Response): Promise<void> => {
  try {
    const { search, city } = req.query || {};
    const whereClause: any = { isVerified: true };

    if (city && typeof city === 'string' && city.trim()) {
      whereClause.city = { contains: city.trim(), mode: 'insensitive' };
    }

    if (search && typeof search === 'string' && search.trim()) {
      whereClause.OR = [
        { clinicName: { contains: search.trim(), mode: 'insensitive' } },
        { address: { contains: search.trim(), mode: 'insensitive' } },
        { city: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const clinics = await prisma.clinicProfile.findMany({
      where: whereClause,
      select: {
        id: true,
        clinicName: true,
        address: true,
        city: true,
        phone: true,
        isVerified: true,
        _count: {
          select: { doctors: true },
        },
      },
      orderBy: { clinicName: 'asc' },
    });

    res.json({
      success: true,
      data: clinics,
    });
  } catch (error: any) {
    console.error('getPublicClinics error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve clinics', error: error.message });
  }
};

/**
 * Provision / Create a Receptionist account for this Clinic
 */
export const addClinicReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const { fullName, email, password, phone, doctorIds = [] } = req.body;

    if (!fullName || !email || !password) {
      res.status(400).json({ success: false, message: 'Receptionist name, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: { doctors: true },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      res.status(400).json({ success: false, message: 'An account with this email already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Validate that provided doctorIds belong to this clinic
    const clinicDoctorIds = new Set(clinic.doctors.map((cd) => cd.doctorId));
    const validDoctorIds = (Array.isArray(doctorIds) ? doctorIds : []).filter((id: string) =>
      clinicDoctorIds.has(id)
    );

    const newReceptionist = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: cleanEmail,
        passwordHash,
        phone: phone ? String(phone).trim() : null,
        role: 'RECEPTIONIST',
        receptionistProfile: {
          create: {
            clinicId: clinic.id,
            phone: phone ? String(phone).trim() : null,
            doctors: {
              create: validDoctorIds.map((docId: string) => ({
                doctorId: docId,
                status: 'ACTIVE',
              })),
            },
          },
        },
      },
      include: {
        receptionistProfile: {
          include: {
            doctors: {
              include: {
                doctor: {
                  include: {
                    user: { select: { fullName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const { passwordHash: _, ...safeUser } = newReceptionist;
    res.status(201).json({
      success: true,
      message: `Receptionist credentials for ${fullName} created successfully`,
      data: {
        user: safeUser,
        receptionist: {
          id: newReceptionist.receptionistProfile?.id,
          fullName: newReceptionist.fullName,
          email: newReceptionist.email,
          phone: newReceptionist.phone,
          clinicId: clinic.id,
          doctors: newReceptionist.receptionistProfile?.doctors || [],
        },
      },
    });
  } catch (error: any) {
    console.error('addClinicReceptionist error:', error);
    res.status(500).json({ success: false, message: 'Failed to provision receptionist', error: error.message });
  }
};

/**
 * Get all receptionists provisioned by this clinic
 */
export const getClinicReceptionists = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: { doctors: true },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const activeDoctorIds = new Set(clinic.doctors.map((cd) => cd.doctorId));

    const receptionists = await prisma.receptionistProfile.findMany({
      where: { clinicId: clinic.id },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
        doctors: {
          include: {
            doctor: {
              include: {
                user: { select: { fullName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: receptionists.map((r) => {
        const validDoctors = r.doctors.filter((d) => activeDoctorIds.has(d.doctorId));
        return {
          id: r.id,
          userId: r.userId,
          fullName: r.user.fullName,
          email: r.user.email,
          phone: r.phone || r.user.phone || '',
          doctorIds: validDoctors.map((d) => d.doctorId),
          doctors: validDoctors.map((d) => ({
            id: d.doctor.id,
            fullName: d.doctor.user.fullName,
            specialty: d.doctor.specialty,
          })),
          createdAt: r.createdAt,
        };
      }),
    });
  } catch (error: any) {
    console.error('getClinicReceptionists error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve receptionists', error: error.message });
  }
};

/**
 * Update doctor assignments for a receptionist
 */
export const updateClinicReceptionistDoctors = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const receptionistId = String(req.params.receptionistId);
    const { doctorIds } = req.body;

    if (!Array.isArray(doctorIds)) {
      res.status(400).json({ success: false, message: 'doctorIds must be an array of doctor IDs' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
      include: { doctors: true },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findFirst({
      where: { id: receptionistId, clinicId: clinic.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist not found at this clinic' });
      return;
    }

    // Filter doctorIds to only those affiliated with this clinic
    const clinicDoctorIds = new Set(clinic.doctors.map((cd) => cd.doctorId));
    const validDoctorIds = doctorIds.filter((id) => clinicDoctorIds.has(id));

    // Transactionally update doctor assignments
    await prisma.$transaction([
      prisma.doctorReceptionist.deleteMany({
        where: { receptionistId: receptionist.id },
      }),
      ...validDoctorIds.map((doctorId) =>
        prisma.doctorReceptionist.create({
          data: {
            doctorId,
            receptionistId: receptionist.id,
            status: 'ACTIVE',
          },
        })
      ),
    ]);

    res.json({
      success: true,
      message: 'Receptionist doctor assignments updated successfully',
    });
  } catch (error: any) {
    console.error('updateClinicReceptionistDoctors error:', error);
    res.status(500).json({ success: false, message: 'Failed to update assignments', error: error.message });
  }
};

/**
 * Remove a receptionist from this clinic
 */
export const removeClinicReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const receptionistId = String(req.params.receptionistId);

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const receptionist = await prisma.receptionistProfile.findFirst({
      where: { id: receptionistId, clinicId: clinic.id },
    });

    if (!receptionist) {
      res.status(404).json({ success: false, message: 'Receptionist not found at this clinic' });
      return;
    }

    // Deleting the user cascades to ReceptionistProfile and DoctorReceptionist
    await prisma.user.delete({
      where: { id: receptionist.userId },
    });

    res.json({
      success: true,
      message: 'Receptionist removed successfully',
    });
  } catch (error: any) {
    console.error('removeClinicReceptionist error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove receptionist', error: error.message });
  }
};
