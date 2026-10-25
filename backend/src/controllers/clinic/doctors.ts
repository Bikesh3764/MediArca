import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { isDoctorEligibleForClinicalPractice } from '../../utils/authGuards';
import { createNotification } from '../../services/notificationService';
import { getLocalDateString } from '../../utils/scheduleUtils';

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

    if (!clinic.isVerified || clinic.verificationStatus === 'SUSPENDED') {
      res.status(400).json({
        success: false,
        message: 'Cannot affiliate with an unverified or suspended clinic. Please wait for administrative verification.',
      });
      return;
    }

    let doctor: any;
    if (doctorId) {
      doctor = await prisma.doctorProfile.findUnique({
        where: { id: doctorId },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
          },
        },
      });
      if (!doctor) {
        doctor = await prisma.doctorProfile.findUnique({
          where: { userId: doctorId },
          include: {
            user: {
              select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
            },
          },
        });
      }
    } else if (doctorEmail) {
      const user = await prisma.user.findUnique({
        where: {
          email_role: {
            email: doctorEmail.toLowerCase().trim(),
            role: 'DOCTOR',
          },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
          doctorProfile: true,
        },
      });
      if (user && user.doctorProfile) {
        const { doctorProfile, ...safeUser } = user;
        doctor = { ...doctorProfile, user: safeUser };
      }
    }

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found with provided identifier' });
      return;
    }

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(400).json({
        success: false,
        message: docCheck.reason || 'Doctor is pending administrative verification. Unverified doctors cannot be affiliated with clinics.',
      });
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
      if (existing.status === 'ACCEPTED' || existing.status === 'ACTIVE') {
        res.status(400).json({ success: false, message: 'Doctor is already affiliated with this clinic' });
        return;
      }
      if (existing.status === 'PENDING') {
        if ((existing as any).requestedBy === 'DOCTOR') {
          // Doctor already requested, auto-accept
          const accepted = await prisma.clinicDoctor.update({
            where: { id: existing.id },
            data: { status: 'ACCEPTED' },
            include: {
              doctor: {
                include: { user: { select: { fullName: true, email: true, phone: true } } },
              },
            },
          });
          createNotification(
            doctor.userId,
            'Affiliation Request Accepted',
            `${clinic.clinicName} has accepted your clinic affiliation request.`,
            'SYSTEM'
          ).catch(() => {});

          res.status(200).json({
            success: true,
            message: `Accepted affiliation request from Dr. ${doctor.user.fullName}`,
            data: accepted,
          });
          return;
        }
        res.status(400).json({
          success: false,
          message: 'An affiliation request has already been sent to this doctor and is pending their acceptance',
        });
        return;
      }
      if (existing.status === 'REJECTED') {
        const renewed = await prisma.clinicDoctor.update({
          where: { id: existing.id },
          data: { status: 'PENDING', requestedBy: 'CLINIC' },
          include: {
            doctor: {
              include: { user: { select: { fullName: true, email: true, phone: true } } },
            },
          },
        });

        createNotification(
          doctor.userId,
          'Clinic Affiliation Invitation',
          `${clinic.clinicName} has invited you to affiliate with their clinic facility.`,
          'SYSTEM'
        ).catch(() => {});

        res.status(201).json({
          success: true,
          message: `Affiliation request sent to Dr. ${doctor.user.fullName}. They must accept before appearing in active staff.`,
          data: renewed,
        });
        return;
      }
    }

    const affiliation = await prisma.clinicDoctor.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        status: 'PENDING',
        requestedBy: 'CLINIC',
      },
      include: {
        doctor: {
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
          },
        },
      },
    });

    createNotification(
      doctor.userId,
      'Clinic Affiliation Invitation',
      `${clinic.clinicName} has invited you to affiliate with their clinic facility.`,
      'SYSTEM'
    ).catch(() => {});

    res.status(201).json({
      success: true,
      message: `Affiliation request sent to Dr. ${doctor.user.fullName}. They must accept before appearing in active staff.`,
      data: affiliation,
    });
  } catch (error: any) {
    console.error('addDoctorToClinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to onboard doctor',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Respond to an incoming affiliation request from a doctor (ACCEPT or REJECT)
 */
export const respondToDoctorAffiliation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'CLINIC') {
      res.status(403).json({ success: false, message: 'Access denied: clinic role required' });
      return;
    }

    const affiliationId = String(req.params.affiliationId);
    const { action } = req.body;

    if (!action || !['ACCEPT', 'REJECT'].includes(action.toUpperCase())) {
      res.status(400).json({ success: false, message: 'Action must be ACCEPT or REJECT' });
      return;
    }

    const clinic = await prisma.clinicProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic profile not found' });
      return;
    }

    if (!clinic.isVerified || clinic.verificationStatus === 'SUSPENDED') {
      res.status(400).json({
        success: false,
        message: 'Cannot affiliate with an unverified or suspended clinic. Please wait for administrative verification.',
      });
      return;
    }

    const normalizedAction = String(action || '').trim().toUpperCase();
    if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
      res.status(400).json({ success: false, message: 'Action must be either ACCEPT or REJECT' });
      return;
    }

    const affiliation = await prisma.clinicDoctor.findFirst({
      where: {
        id: affiliationId,
        clinicId: clinic.id,
      },
      include: {
        doctor: {
          include: { user: { select: { fullName: true } } },
        },
      },
    });

    if (!affiliation) {
      res.status(404).json({ success: false, message: 'Affiliation request not found' });
      return;
    }

    if (affiliation.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: `Affiliation request is already ${affiliation.status.toLowerCase()}. Only pending requests can be responded to.`,
      });
      return;
    }

    if (normalizedAction === 'ACCEPT' && affiliation.requestedBy === 'CLINIC') {
      res.status(403).json({
        success: false,
        message: 'Cannot accept an affiliation request initiated by your clinic. Awaiting doctor acceptance.',
      });
      return;
    }

    const docName = affiliation.doctor.user.fullName;

    if (normalizedAction === 'ACCEPT') {
      const docCheck = isDoctorEligibleForClinicalPractice(affiliation.doctor);
      if (!docCheck.eligible) {
        res.status(400).json({
          success: false,
          message: docCheck.reason || 'Doctor is not eligible for clinical practice or affiliation.',
        });
        return;
      }

      const updated = await prisma.clinicDoctor.update({
        where: { id: affiliation.id },
        data: { status: 'ACCEPTED' },
      });

      const docProf = await prisma.doctorProfile.findUnique({
        where: { id: affiliation.doctorId },
        select: { userId: true },
      });
      if (docProf?.userId) {
        createNotification(
          docProf.userId,
          'Affiliation Request Accepted',
          `Your affiliation request with ${clinic.clinicName} was accepted. You are now active on their roster.`,
          'SYSTEM'
        ).catch(() => {});
      }

      res.json({
        success: true,
        message: `Accepted affiliation with Dr. ${docName}. Doctor is now in your active roster.`,
        data: updated,
      });
    } else {
      await prisma.clinicDoctor.delete({
        where: { id: affiliation.id },
      });

      const docProf = await prisma.doctorProfile.findUnique({
        where: { id: affiliation.doctorId },
        select: { userId: true },
      });
      if (docProf?.userId) {
        createNotification(
          docProf.userId,
          'Affiliation Request Declined',
          `Your affiliation request with ${clinic.clinicName} was not accepted.`,
          'SYSTEM'
        ).catch(() => {});
      }

      res.json({
        success: true,
        message: `Rejected affiliation request from Dr. ${docName}.`,
      });
    }
  } catch (error: any) {
    console.error('respondToDoctorAffiliation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process affiliation response',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
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

    const todayStr = getLocalDateString();
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
      ...(typeof (prisma.appointment as any)?.updateMany === 'function'
        ? [
            prisma.appointment.updateMany({
              where: {
                clinicId: clinic.id,
                doctorId,
                appointmentDate: { gte: todayStr },
                status: { in: ['PENDING_APPROVAL', 'WAITING'] },
              },
              data: {
                status: 'CANCELLED',
                isCheckedIn: false,
                checkedInAt: null,
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
    res.status(500).json({
      success: false,
      message: 'Failed to remove doctor affiliation',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
