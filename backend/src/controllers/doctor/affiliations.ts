import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { parseDoctorSlots, getLocalDateString, parseDoctorWorkingDays, parseDoctorLeaves, isDoctorOnLeave, isDoctorWorkingOnDate } from '../../utils/scheduleUtils';
import { isDoctorEligibleForClinicalPractice, isClinicActive } from '../../utils/authGuards';

/**
 * Get doctor's affiliated clinics and linked receptionists
 */
export const getDoctorAffiliations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        clinics: {
          include: {
            clinic: {
              include: {
                user: { select: { email: true, phone: true } },
              },
            },
          },
        },
        receptionists: {
          include: {
            receptionist: {
              include: {
                clinic: true,
                user: { select: { fullName: true, email: true, phone: true } },
              },
            },
          },
        },
      },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    // Gate affiliation operations if doctor is suspended or unverified (Finding M3)
    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
      return;
    }

    // Partition affiliations by status & direction
    const activeClinics = doctor.clinics.filter(
      (cd) => cd.status === 'ACCEPTED' || cd.status === 'ACTIVE'
    );
    const incomingClinicRequests = doctor.clinics.filter(
      (cd) => cd.status === 'PENDING' && (cd as any).requestedBy === 'CLINIC'
    );
    const outgoingClinicRequests = doctor.clinics.filter(
      (cd) => cd.status === 'PENDING' && (cd as any).requestedBy === 'DOCTOR'
    );

    // Get clinic-specific stats for each affiliated clinic
    const clinicsWithStats = await Promise.all(
      activeClinics.map(async (cd) => {
        const bookingCount = await prisma.appointment.count({
          where: {
            doctorId: doctor.id,
            clinicId: cd.clinicId,
            status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED'] },
          },
        });

        // Finding F2: Count revenue only on completed consultations or paid transactions without loading rows
        const paidOrCompletedCount = await prisma.appointment.count({
          where: {
            doctorId: doctor.id,
            clinicId: cd.clinicId,
            OR: [
              { paymentStatus: 'PAID' },
              { status: 'COMPLETED' },
            ],
            status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED'] },
          },
        });
        const clinicFee = (cd as any).consultationFee ?? doctor.consultationFee;
        const revenue = paidOrCompletedCount * clinicFee;

        let clinicSlots = parseDoctorSlots(doctor);
        if ((cd as any).slots) {
          try {
            const parsed = typeof (cd as any).slots === 'string' ? JSON.parse((cd as any).slots) : (cd as any).slots;
            if (Array.isArray(parsed) && parsed.length > 0) {
              clinicSlots = parsed;
            }
          } catch {}
        }

        const workingDays = (cd as any).workingDays
          ? parseDoctorWorkingDays((cd as any).workingDays)
          : parseDoctorWorkingDays((doctor as any).workingDays);
        const leaves = [
          ...parseDoctorLeaves((doctor as any).leaves),
          ...((cd as any).leaves ? parseDoctorLeaves((cd as any).leaves) : []),
        ];
        const todayStr = getLocalDateString();
        const todayLeaveCheck = isDoctorOnLeave(leaves, todayStr, cd.clinic.id);
        const todayWorkingCheck = isDoctorWorkingOnDate(workingDays, todayStr);

        return {
          affiliationId: cd.id,
          clinicId: cd.clinic.id,
          clinicName: cd.clinic.clinicName,
          address: cd.clinic.address,
          city: cd.clinic.city,
          phone: cd.clinic.phone || cd.clinic.user.phone,
          email: cd.clinic.user.email,
          checkinCode: isClinicActive(cd.clinic).active ? (cd.clinic as any).checkinCode || undefined : undefined,
          bookingCount,
          revenue,
          consultationFee: clinicFee,
          slots: clinicSlots,
          workingDays,
          leaves,
          isOnLeaveToday: todayLeaveCheck.isOnLeave,
          todayLeave: todayLeaveCheck.leave || null,
          isWorkingToday: todayWorkingCheck.isWorking,
          status: cd.status,
          requestedBy: (cd as any).requestedBy || 'CLINIC',
          joinedAt: cd.createdAt,
        };
      })
    );

    const mapClinicReq = (cd: typeof doctor.clinics[0]) => ({
      affiliationId: cd.id,
      clinicId: cd.clinic.id,
      clinicName: cd.clinic.clinicName,
      address: cd.clinic.address,
      city: cd.clinic.city,
      phone: cd.clinic.phone || cd.clinic.user.phone,
      email: cd.clinic.user.email,
      status: cd.status,
      requestedBy: (cd as any).requestedBy || 'CLINIC',
      requestedAt: cd.createdAt,
    });

    // Only include receptionists whose parent clinic is actively affiliated with this doctor
    const affiliatedClinicIds = new Set(activeClinics.map((cd) => cd.clinicId));
    const receptionists = doctor.receptionists
      .filter((dr) => dr.receptionist.clinicId && affiliatedClinicIds.has(dr.receptionist.clinicId))
      .map((dr) => ({
        affiliationId: dr.id,
        receptionistId: dr.receptionist.id,
        fullName: dr.receptionist.user.fullName,
        email: dr.receptionist.user.email,
        phone: dr.receptionist.phone || dr.receptionist.user.phone,
        clinicId: dr.receptionist.clinicId,
        clinicName: dr.receptionist.clinic?.clinicName,
        status: dr.status,
        joinedAt: dr.createdAt,
      }));

    res.json({
      success: true,
      data: {
        clinics: clinicsWithStats,
        incomingRequests: incomingClinicRequests.map(mapClinicReq),
        outgoingRequests: outgoingClinicRequests.map(mapClinicReq),
        receptionists,
      },
    });
  } catch (error: any) {
    console.error('getDoctorAffiliations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve affiliations',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Doctor requests to affiliate with a clinic
 */
export const addDoctorClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const { clinicId, clinicEmail } = req.body;
    if (!clinicId && !clinicEmail) {
      res.status(400).json({ success: false, message: 'Clinic ID or clinic email is required' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
      return;
    }

    let clinic: any;
    if (clinicId) {
      clinic = await prisma.clinicProfile.findUnique({ where: { id: clinicId } });
    } else if (clinicEmail) {
      const user = await prisma.user.findUnique({
        where: {
          email_role: {
            email: clinicEmail.toLowerCase().trim(),
            role: 'CLINIC',
          },
        },
        include: { clinicProfile: true },
      });
      if (user?.clinicProfile) clinic = user.clinicProfile;
    }

    if (!clinic) {
      res.status(404).json({ success: false, message: 'Clinic not found' });
      return;
    }

    const clinicCheck = isClinicActive(clinic);
    if (!clinicCheck.active) {
      res.status(400).json({
        success: false,
        message: clinicCheck.reason || 'Cannot affiliate with an unverified or suspended clinic. Please wait for administrative verification.',
      });
      return;
    }

    const sanitizeClinicAffiliation = (aff: any) => {
      if (!aff || !aff.clinic) return aff;
      const { checkinCode: _secret, ...safeClinic } = aff.clinic;
      return { ...aff, clinic: safeClinic };
    };

    const existing = await prisma.clinicDoctor.findUnique({
      where: { clinicId_doctorId: { clinicId: clinic.id, doctorId: doctor.id } },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED' || existing.status === 'ACTIVE') {
        res.status(400).json({ success: false, message: 'Already affiliated with this clinic' });
        return;
      }
      if (existing.status === 'PENDING') {
        if ((existing as any).requestedBy === 'CLINIC') {
          // Clinic already requested doctor, auto-accept
          const accepted = await prisma.clinicDoctor.update({
            where: { id: existing.id },
            data: { status: 'ACCEPTED' },
            include: { clinic: true },
          });
          res.status(200).json({
            success: true,
            message: `Affiliation with ${clinic.clinicName} accepted successfully`,
            data: sanitizeClinicAffiliation(accepted),
          });
          return;
        }
        res.status(400).json({
          success: false,
          message: 'An affiliation request has already been sent to this clinic and is pending acceptance',
        });
        return;
      }
      if (existing.status === 'REJECTED') {
        const renewed = await prisma.clinicDoctor.update({
          where: { id: existing.id },
          data: { status: 'PENDING', requestedBy: 'DOCTOR' },
          include: { clinic: true },
        });
        res.status(201).json({
          success: true,
          message: `Affiliation request sent to ${clinic.clinicName}. Waiting for clinic acceptance.`,
          data: sanitizeClinicAffiliation(renewed),
        });
        return;
      }
    }

    const link = await prisma.clinicDoctor.create({
      data: {
        clinicId: clinic.id,
        doctorId: doctor.id,
        status: 'PENDING',
        requestedBy: 'DOCTOR',
      },
      include: { clinic: true },
    });

    res.status(201).json({
      success: true,
      message: `Affiliation request sent to ${clinic.clinicName}. Waiting for clinic acceptance.`,
      data: sanitizeClinicAffiliation(link),
    });
  } catch (error: any) {
    console.error('addDoctorClinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to affiliate clinic',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Respond to an affiliation request from a clinic (ACCEPT or REJECT)
 */
export const respondToClinicAffiliation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const affiliationId = String(req.params.affiliationId);
    const { action } = req.body;

    if (!action || !['ACCEPT', 'REJECT'].includes(action.toUpperCase())) {
      res.status(400).json({ success: false, message: 'Action must be ACCEPT or REJECT' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
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
        doctorId: doctor.id,
      },
      include: { clinic: true },
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

    if (normalizedAction === 'ACCEPT' && affiliation.requestedBy === 'DOCTOR') {
      res.status(403).json({
        success: false,
        message: 'Cannot accept an affiliation request initiated by yourself. Awaiting clinic approval.',
      });
      return;
    }

    const clinicName = affiliation.clinic.clinicName;

    if (normalizedAction === 'ACCEPT') {
      const clinicCheck = isClinicActive(affiliation.clinic);
      if (!clinicCheck.active) {
        res.status(400).json({
          success: false,
          message: clinicCheck.reason || 'Cannot accept affiliation with an unverified or suspended clinic.',
        });
        return;
      }

      const updated = await prisma.clinicDoctor.update({
        where: { id: affiliation.id },
        data: { status: 'ACCEPTED' },
      });
      res.json({
        success: true,
        message: `Accepted affiliation with ${clinicName}. It is now in your active clinics roster.`,
        data: updated,
      });
    } else {
      await prisma.clinicDoctor.delete({
        where: { id: affiliation.id },
      });
      res.json({
        success: true,
        message: `Rejected affiliation request from ${clinicName}.`,
      });
    }
  } catch (error: any) {
    console.error('respondToClinicAffiliation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process affiliation response',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Doctor detaches from a clinic
 */
export const removeDoctorClinic = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const clinicId = String(req.params.clinicId);
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
      return;
    }

    // Find all receptionists belonging to the detached clinic
    const clinicReceptionists = await prisma.receptionistProfile.findMany({
      where: { clinicId },
      select: { id: true },
    });
    const recIds = clinicReceptionists.map((r) => r.id);

    const todayStr = getLocalDateString();
    await prisma.$transaction([
      prisma.clinicDoctor.deleteMany({
        where: { clinicId, doctorId: doctor.id },
      }),
      ...(recIds.length > 0
        ? [
            prisma.doctorReceptionist.deleteMany({
              where: {
                doctorId: doctor.id,
                receptionistId: { in: recIds },
              },
            }),
          ]
        : []),
      ...(typeof (prisma.appointment as any)?.updateMany === 'function'
        ? [
            prisma.appointment.updateMany({
              where: {
                clinicId,
                doctorId: doctor.id,
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

    res.json({ success: true, message: 'Clinic affiliation removed successfully' });
  } catch (error: any) {
    console.error('removeDoctorClinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detach clinic',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Doctor links a receptionist
 */
export const addDoctorReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(400).json({
    success: false,
    message: 'Direct receptionist linking by doctors is disabled. Receptionists are provisioned and assigned by your affiliated Clinic Administrator.',
  });
};

/**
 * Doctor removes a receptionist
 */
export const removeDoctorReceptionist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Access denied: doctor role required' });
      return;
    }

    const receptionistId = String(req.params.receptionistId);
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    const docCheck = isDoctorEligibleForClinicalPractice(doctor);
    if (!docCheck.eligible) {
      res.status(403).json({ success: false, message: docCheck.reason });
      return;
    }

    await prisma.doctorReceptionist.deleteMany({
      where: {
        doctorId: doctor.id,
        receptionistId,
      },
    });

    res.json({ success: true, message: 'Receptionist unlinked successfully' });
  } catch (error: any) {
    console.error('removeDoctorReceptionist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove receptionist',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
