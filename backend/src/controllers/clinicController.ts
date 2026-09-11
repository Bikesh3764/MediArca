import { Response } from 'express';
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
          createdAt: clinic.createdAt,
        },
        doctors: doctorStats,
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

    await prisma.clinicDoctor.deleteMany({
      where: {
        clinicId: clinic.id,
        doctorId,
      },
    });

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
 * Public listing of clinics
 */
export const getPublicClinics = async (_req: any, res: Response): Promise<void> => {
  try {
    const clinics = await prisma.clinicProfile.findMany({
      select: {
        id: true,
        clinicName: true,
        address: true,
        city: true,
        phone: true,
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
