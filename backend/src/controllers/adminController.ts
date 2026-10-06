import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/authMiddleware';
import { getLocalDateString } from '../utils/scheduleUtils';
import { createNotification } from '../services/notificationService';

export const getStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const todayStr = getLocalDateString();

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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve stats',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve doctors',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
        },
      },
    });

    if (doctor?.user?.id) {
      let notifTitle = 'Practitioner Status Updated';
      let notifMessage = `Your practitioner account status is now ${targetStatus}.`;
      if (targetStatus === 'VERIFIED') {
        notifTitle = 'Practitioner Profile Approved';
        notifMessage = 'Congratulations! Your practitioner profile has been approved and verified by MediArca administration.';
      } else if (targetStatus === 'SUSPENDED') {
        notifTitle = 'Practitioner Profile Suspended';
        notifMessage = 'Your practitioner account has been suspended by administration. Practice shifts and online bookings are temporarily disabled.';
      } else if (targetStatus === 'REJECTED') {
        notifTitle = 'Practitioner Application Declined';
        notifMessage = 'Your practitioner verification request has been declined by MediArca administration.';
      }
      createNotification(doctor.user.id, notifTitle, notifMessage, 'SYSTEM').catch(() => {});
    }

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
    res.status(500).json({
      success: false,
      message: 'Failed to update doctor verification status',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const getAllAppointments = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
          },
        },
        patient: {
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
          },
        },
        clinic: {
          select: { id: true, clinicName: true, city: true, address: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });

    res.json({ success: true, count: appointments.length, data: appointments });
  } catch (error: any) {
    console.error('getAllAppointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve appointments',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve clinics',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
        },
      },
    });

    if (clinic?.user?.id) {
      let notifTitle = 'Clinic Facility Status Updated';
      let notifMessage = `Your clinic profile status is now ${targetStatus}.`;
      if (targetStatus === 'VERIFIED') {
        notifTitle = 'Clinic Facility Approved';
        notifMessage = `Congratulations! ${clinic.clinicName} has been approved and verified by MediArca administration.`;
      } else if (targetStatus === 'SUSPENDED') {
        notifTitle = 'Clinic Facility Suspended';
        notifMessage = `${clinic.clinicName} has been suspended by administration. Reception desk operations are temporarily locked.`;
      } else if (targetStatus === 'REJECTED') {
        notifTitle = 'Clinic Registration Declined';
        notifMessage = `The registration request for ${clinic.clinicName} has been declined by MediArca administration.`;
      }
      createNotification(clinic.user.id, notifTitle, notifMessage, 'SYSTEM').catch(() => {});
    }

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
    res.status(500).json({
      success: false,
      message: 'Failed to update clinic verification status',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

// Public contact form submission
export const submitContactMessage = async (req: any, res: Response): Promise<void> => {
  try {
    const { fullName, email, phone, subject, message } = req.body;

    if (!fullName || !email || !message) {
      res.status(400).json({
        success: false,
        message: 'Name, email, and message are required.',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
      return;
    }

    const cleanSubject = subject ? String(subject).trim() : 'General Inquiry';
    const cleanMessage = String(message).trim();
    const cleanName = String(fullName).trim();
    const cleanPhone = phone ? String(phone).trim() : null;

    const contactMsg = await prisma.contactMessage.create({
      data: {
        fullName: cleanName,
        email: String(email).trim().toLowerCase(),
        phone: cleanPhone,
        subject: cleanSubject,
        message: cleanMessage,
        status: 'NEW',
      },
    });

    // Notify all admin users
    try {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      for (const admin of admins) {
        await createNotification(
          admin.id,
          `New Contact Inquiry: ${cleanSubject}`,
          `From: ${cleanName} (${email})${cleanPhone ? ` | Phone: ${cleanPhone}` : ''}\n\n${cleanMessage}`,
          'CONTACT_INQUIRY'
        );
      }
    } catch (notifErr) {
      console.error('Failed to dispatch admin notification for contact message:', notifErr);
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been received. Our team will get back to you shortly.',
      data: contactMsg,
    });
  } catch (error: any) {
    console.error('submitContactMessage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact message. Please try again.',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

// Admin retrieve contact inquiries
export const getContactMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    console.error('getContactMessages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contact messages',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

// Admin mark message as read
export const markContactMessageRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await prisma.contactMessage.update({
      where: { id: String(id) },
      data: { status: 'READ' },
    });
    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('markContactMessageRead error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact message status',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
