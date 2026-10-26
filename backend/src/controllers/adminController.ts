import { Response } from 'express';
import prisma from '../config/database';
import { findTooLong, LIMITS } from '../utils/inputLimits';
import { AuthRequest } from '../middleware/authMiddleware';
import { getLocalDateString } from '../utils/scheduleUtils';
import { createNotification } from '../services/notificationService';
import { parsePaginationParams, buildPaginationMetadata } from '../utils/pagination';

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
    const { page, limit, skip } = parsePaginationParams(req.query, 50, 100);

    const [total, doctors] = await prisma.$transaction([
      prisma.doctorProfile.count(),
      prisma.doctorProfile.findMany({
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, createdAt: true } },
          clinics: {
            include: {
              clinic: {
                select: { id: true, clinicName: true, city: true, address: true, phone: true },
              },
            },
          },
          _count: { select: { appointments: true } },
        },
        orderBy: [{ isVerified: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

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

    res.json({
      success: true,
      count: formattedDoctors.length,
      data: formattedDoctors,
      pagination: buildPaginationMetadata(total, page, limit),
    });
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

    if (!doctorId || typeof doctorId !== 'string') {
      res.status(400).json({ success: false, message: 'doctorId is required' });
      return;
    }

    let targetStatus: 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING';
    let targetIsVerified: boolean;

    if (typeof status === 'string' && ['VERIFIED', 'SUSPENDED', 'REJECTED', 'PENDING'].includes(status.toUpperCase())) {
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

    let targetDocProfile = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });
    if (!targetDocProfile) {
      targetDocProfile = await prisma.doctorProfile.findUnique({
        where: { userId: doctorId },
        select: { id: true },
      });
    }
    if (!targetDocProfile) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    const doctor = await prisma.doctorProfile.update({
      where: { id: targetDocProfile.id },
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
      let notifTitle = 'Account updated';
      let notifMessage = `Your account status is now ${String(targetStatus).toLowerCase()}.`;
      if (targetStatus === 'VERIFIED') {
        notifTitle = 'Profile approved';
        notifMessage = 'Your profile is verified. Patients can now find and book you.';
      } else if (targetStatus === 'SUSPENDED') {
        notifTitle = 'Account paused';
        notifMessage = 'Your account is paused, so patients can’t book you. Contact MediArca support for help.';
      } else if (targetStatus === 'REJECTED') {
        notifTitle = 'Profile not approved';
        notifMessage = 'We couldn’t verify your profile. Check your details or contact MediArca support.';
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

export const getAllAppointments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Paged so the list never silently stops at a fixed number; the dashboard loads page by page
    const { page, limit, skip } = parsePaginationParams(req.query, 250, 250);
    // SEC-002: Enforce PHI minimization (HIPAA / DPDP Act) for administrative operational overview.
    // Explicitly exclude clinicalNotes, vitals, symptoms, reasonForVisit, allergies,
    // existingConditions, and currentMedications from the admin overview response.
    const appointments = await prisma.appointment.findMany({
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        clinicId: true,
        appointmentDate: true,
        queueNumber: true,
        checkingWindow: true,
        estimatedTime: true,
        status: true,
        paymentStatus: true,
        approvedBy: true,
        approvedAt: true,
        slotId: true,
        isForOther: true,
        patientName: true,
        patientAge: true,
        patientGender: true,
        isCheckedIn: true,
        checkedInAt: true,
        createdAt: true,
        updatedAt: true,
        doctor: {
          select: {
            id: true,
            specialty: true,
            clinicAddress: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        patient: {
          select: {
            id: true,
            gender: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        clinic: {
          select: {
            id: true,
            clinicName: true,
            city: true,
            address: true,
            phone: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip,
      take: limit,
    });
    const total = await prisma.appointment.count();

    res.json({
      success: true,
      count: appointments.length,
      data: appointments,
      pagination: buildPaginationMetadata(total, page, limit),
    });
  } catch (error: any) {
    console.error('getAllAppointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve appointments',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

export const getClinicsList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query, 50, 100);

    const [total, clinics] = await prisma.$transaction([
      prisma.clinicProfile.count(),
      prisma.clinicProfile.findMany({
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
          doctors: {
            include: {
              doctor: {
                include: {
                  user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true } },
                },
              },
            },
          },
          _count: { select: { doctors: true, appointments: true, receptionists: true } },
        },
        orderBy: [{ isVerified: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

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

    res.json({
      success: true,
      count: formattedClinics.length,
      data: formattedClinics,
      pagination: buildPaginationMetadata(total, page, limit),
    });
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

    if (!clinicId || typeof clinicId !== 'string') {
      res.status(400).json({ success: false, message: 'clinicId is required' });
      return;
    }

    let targetStatus: 'VERIFIED' | 'SUSPENDED' | 'REJECTED' | 'PENDING';
    let targetIsVerified: boolean;

    if (typeof status === 'string' && ['VERIFIED', 'SUSPENDED', 'REJECTED', 'PENDING'].includes(status.toUpperCase())) {
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

    let targetClinicProfile = await prisma.clinicProfile.findUnique({
      where: { id: clinicId },
      select: { id: true },
    });
    if (!targetClinicProfile) {
      targetClinicProfile = await prisma.clinicProfile.findUnique({
        where: { userId: clinicId },
        select: { id: true },
      });
    }
    if (!targetClinicProfile) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    const clinic = await prisma.clinicProfile.update({
      where: { id: targetClinicProfile.id },
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
      let notifTitle = 'Clinic updated';
      let notifMessage = `${clinic.clinicName} status is now ${String(targetStatus).toLowerCase()}.`;
      if (targetStatus === 'VERIFIED') {
        notifTitle = 'Clinic approved';
        notifMessage = `${clinic.clinicName} is verified. You can now add doctors and receptionists.`;
      } else if (targetStatus === 'SUSPENDED') {
        notifTitle = 'Clinic paused';
        notifMessage = `${clinic.clinicName} is paused, so bookings and desk work are off. Contact MediArca support for help.`;
      } else if (targetStatus === 'REJECTED') {
        notifTitle = 'Clinic not approved';
        notifMessage = `We couldn’t verify ${clinic.clinicName}. Check your details or contact MediArca support.`;
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

    if ([fullName, email, message].some((v) => typeof v !== 'string') || (subject != null && typeof subject !== 'string')) {
      res.status(400).json({ success: false, message: 'Name, email, subject and message must be text.' });
      return;
    }
    const tooLong = findTooLong({
      fullName: [fullName, LIMITS.name],
      email: [email, LIMITS.email],
      phone: [phone == null ? phone : String(phone), LIMITS.phone],
      subject: [subject, LIMITS.subject],
      message: [message, LIMITS.message],
    });
    if (tooLong) {
      res.status(400).json({ success: false, message: tooLong });
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
          `New message: ${cleanSubject}`,
          `From ${cleanName} (${email})${cleanPhone ? `, ${cleanPhone}` : ''}\n\n${cleanMessage}`,
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

// Admin delete contact inquiry message
export const deleteContactMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.contactMessage.delete({
      where: { id: String(id) },
    });
    res.json({
      success: true,
      message: 'Contact message deleted successfully',
    });
  } catch (error: any) {
    console.error('deleteContactMessage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact message',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
