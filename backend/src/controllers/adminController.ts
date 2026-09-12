import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';

export const getStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    const [
      totalPatients,
      totalDoctors,
      pendingDoctors,
      totalClinics,
      pendingClinics,
      totalAppointments,
      todayAppointments,
    ] = await Promise.all([
      prisma.patientProfile.count(),
      prisma.doctorProfile.count(),
      prisma.doctorProfile.count({
        where: {
          OR: [
            { verificationStatus: 'PENDING' },
            { isVerified: false, verificationStatus: { notIn: ['VERIFIED', 'SUSPENDED', 'REJECTED'] } },
          ],
        },
      }),
      prisma.clinicProfile.count(),
      prisma.clinicProfile.count({
        where: {
          OR: [
            { verificationStatus: 'PENDING' },
            { isVerified: false, verificationStatus: { notIn: ['VERIFIED', 'SUSPENDED', 'REJECTED'] } },
          ],
        },
      }),
      prisma.appointment.count(),
      prisma.appointment.count({ where: { appointmentDate: todayStr } }),
    ]);

    res.json({
      success: true,
      data: {
        totalPatients,
        totalDoctors,
        pendingDoctors,
        totalClinics,
        pendingClinics,
        totalAppointments,
        todayAppointments,
      },
    });
  } catch (error: any) {
    console.error('getStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve stats', error: error.message });
  }
};

export const getDoctorsList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctors = await prisma.doctorProfile.findMany({
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, createdAt: true } },
        _count: { select: { appointments: true, reviews: true } },
      },
      orderBy: [{ isVerified: 'asc' }, { createdAt: 'desc' }],
    });

    const formattedDoctors = doctors.map((doc: any) => {
      let status = doc.verificationStatus;
      if (!status || status === 'PENDING') {
        status = doc.isVerified ? 'VERIFIED' : (doc.verificationStatus || 'PENDING');
      }
      return {
        ...doc,
        verificationStatus: status,
      };
    });

    res.json({ success: true, count: formattedDoctors.length, data: formattedDoctors });
  } catch (error: any) {
    console.error('getDoctorsList error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve doctors', error: error.message });
  }
};

export const verifyDoctor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { doctorId, isVerified, status } = req.body;

    if (!doctorId) {
      res.status(400).json({ success: false, message: 'doctorId is required' });
      return;
    }

    let targetStatus: 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING';
    let targetIsVerified: boolean;

    if (status && ['VERIFIED', 'SUSPENDED', 'REJECTED', 'PENDING'].includes(status.toUpperCase())) {
      targetStatus = status.toUpperCase() as any;
      targetIsVerified = targetStatus === 'VERIFIED';
    } else if (typeof isVerified === 'boolean') {
      targetIsVerified = isVerified;
      targetStatus = isVerified ? 'VERIFIED' : 'SUSPENDED';
    } else {
      res.status(400).json({
        success: false,
        message: 'Valid status ("VERIFIED" | "SUSPENDED" | "REJECTED" | "PENDING") or boolean isVerified is required',
      });
      return;
    }

    const doctor = await prisma.doctorProfile.update({
      where: { id: doctorId },
      data: {
        isVerified: targetIsVerified,
        verificationStatus: targetStatus,
      },
      include: { user: true },
    });

    res.json({
      success: true,
      message: `Doctor ${doctor.user.fullName} is now ${targetStatus}`,
      data: {
        ...doctor,
        verificationStatus: targetStatus,
      },
    });
  } catch (error: any) {
    console.error('verifyDoctor error:', error);
    res.status(500).json({ success: false, message: 'Failed to update doctor verification status', error: error.message });
  }
};

export const getAllAppointments = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        doctor: { include: { user: { select: { fullName: true } } } },
        patient: { include: { user: { select: { fullName: true, email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ success: true, count: appointments.length, data: appointments });
  } catch (error: any) {
    console.error('getAllAppointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve appointments', error: error.message });
  }
};

export const getClinicsList = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clinics = await prisma.clinicProfile.findMany({
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
        _count: { select: { doctors: true, appointments: true, receptionists: true } },
      },
      orderBy: [{ isVerified: 'asc' }, { createdAt: 'desc' }],
    });

    const formattedClinics = clinics.map((c: any) => {
      let status = c.verificationStatus;
      if (!status || status === 'PENDING') {
        status = c.isVerified ? 'VERIFIED' : (c.verificationStatus || 'PENDING');
      }
      return {
        ...c,
        verificationStatus: status,
        doctorsCount: c._count?.doctors || 0,
        appointmentsCount: c._count?.appointments || 0,
        receptionistsCount: c._count?.receptionists || 0,
      };
    });

    res.json({ success: true, count: formattedClinics.length, data: formattedClinics });
  } catch (error: any) {
    console.error('getClinicsList error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve clinics', error: error.message });
  }
};

export const verifyClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { clinicId, isVerified, status } = req.body;

    if (!clinicId) {
      res.status(400).json({ success: false, message: 'clinicId is required' });
      return;
    }

    let targetStatus: 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING';
    let targetIsVerified: boolean;

    if (status && ['VERIFIED', 'SUSPENDED', 'REJECTED', 'PENDING'].includes(status.toUpperCase())) {
      targetStatus = status.toUpperCase() as any;
      targetIsVerified = targetStatus === 'VERIFIED';
    } else if (typeof isVerified === 'boolean') {
      targetIsVerified = isVerified;
      targetStatus = isVerified ? 'VERIFIED' : 'SUSPENDED';
    } else {
      res.status(400).json({
        success: false,
        message: 'Valid status ("VERIFIED" | "SUSPENDED" | "REJECTED" | "PENDING") or boolean isVerified is required',
      });
      return;
    }

    const clinic = await prisma.clinicProfile.update({
      where: { id: clinicId },
      data: {
        isVerified: targetIsVerified,
        verificationStatus: targetStatus,
      },
      include: { user: true },
    });

    res.json({
      success: true,
      message: `Clinic ${clinic.clinicName} is now ${targetStatus}`,
      data: {
        ...clinic,
        verificationStatus: targetStatus,
      },
    });
  } catch (error: any) {
    console.error('verifyClinic error:', error);
    res.status(500).json({ success: false, message: 'Failed to update clinic verification status', error: error.message });
  }
};
