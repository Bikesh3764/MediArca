import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { parseDoctorSlots, getLocalDateString, getIndianTimeMinutes, timeToMinutes, minutesTo12Hour, isValidAppointmentDate, cleanSlotName } from '../../utils/scheduleUtils';
import { verifyReceptionistDoctorAccess } from '../../utils/authGuards';

/**
 * Get live queue for a specific linked doctor on a date
 */
export const getDoctorQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const doctorId = String(req.params.doctorId);
    const appointmentDate = String(req.query.date || getLocalDateString());

    if (req.query.date && !isValidAppointmentDate(String(req.query.date))) {
      res.status(400).json({
        success: false,
        message: 'Invalid appointment date format. Expected valid calendar date in YYYY-MM-DD format.',
      });
      return;
    }

    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({
        success: false,
        message: 'Access denied: Receptionist role required to access clinical queue.',
      });
      return;
    }

    // requireActiveReceptionist (on every desk route) already checked the password flag
    // and loaded the profile; only look them up here if it didn't run.
    if (!req.deskAccessVerified) {
      const userRec = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { mustChangePassword: true },
      });
      if (userRec?.mustChangePassword || req.user.mustChangePassword) {
        res.status(403).json({
          success: false,
          message: 'Temporary password must be changed before accessing clinical desk operations.',
        });
        return;
      }
    }

    const recProfile =
      req.receptionistProfile ||
      (await prisma.receptionistProfile.findUnique({
        where: { userId: req.user.id },
        include: { clinic: true },
      }));

    // Loaded once here and shared with the access check
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: { select: { fullName: true, email: true } } },
    });

    const access = await verifyReceptionistDoctorAccess(req.user.id, doctorId, recProfile?.clinicId || null, {
      receptionist: recProfile,
      doctor,
    });
    if (!access.authorized) {
      res.status(403).json({ success: false, message: access.reason });
      return;
    }

    const receptionist = access.receptionist;

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctorId,
        appointmentDate: appointmentDate,
        queueNumber: { gt: 0 },
        ...(receptionist?.clinicId ? { clinicId: receptionist.clinicId } : {}),
      },
      include: {
        patient: {
          include: {
            user: { select: { fullName: true, phone: true, email: true } },
          },
        },
      },
      orderBy: { queueNumber: 'asc' },
    });

    let targetAffiliation: any = null;
    let slots = parseDoctorSlots(doctor);
    if (receptionist?.clinicId) {
      // The access check already loaded this clinic-doctor link
      targetAffiliation =
        access.affiliation && access.affiliation.clinicId === receptionist.clinicId && access.affiliation.doctorId === doctorId
          ? access.affiliation
          : await prisma.clinicDoctor.findUnique({
              where: {
                clinicId_doctorId: {
                  clinicId: receptionist.clinicId,
                  doctorId,
                },
              },
            });
      if (targetAffiliation?.slots) {
        try {
          const parsed = typeof targetAffiliation.slots === 'string' ? JSON.parse(targetAffiliation.slots) : targetAffiliation.slots;
          if (Array.isArray(parsed) && parsed.length > 0) {
            slots = parsed;
          }
        } catch {}
      }
    }

    const getApptStartMins = (a: any): number => {
      if (a.slotId && Array.isArray(slots)) {
        const matched = slots.find((s: any) => s && s.id === a.slotId);
        if (matched?.startTime) return timeToMinutes(matched.startTime);
      }
      if (a.checkingWindow && Array.isArray(slots)) {
        const cleanW = cleanSlotName(a.checkingWindow, '').toLowerCase();
        const matchedByName = slots.find((s: any) => s && cleanSlotName(s.name, '').toLowerCase() === cleanW);
        if (matchedByName?.startTime) return timeToMinutes(matchedByName.startTime);
      }
      if (a.checkingWindow) {
        const match = a.checkingWindow.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
        if (match) return timeToMinutes(match[1]);
      }
      return 0;
    };

    // Chronologically order appointments by slot window start time, then queueNumber (Finding 4 / ARCH-006 / FUNC-009)
    appointments.sort((a, b) => {
      const aSlotMins = getApptStartMins(a);
      const bSlotMins = getApptStartMins(b);
      if (aSlotMins !== bSlotMins) {
        return aSlotMins - bSlotMins;
      }
      return a.queueNumber - b.queueNumber;
    });

    res.json({
      success: true,
      data: {
        doctor: {
          id: doctor.id,
          fullName: doctor.user.fullName,
          specialty: doctor.specialty,
          consultationFee: targetAffiliation?.consultationFee ?? doctor.consultationFee,
          slots,
          cabinStatus: (doctor as any).cabinStatus || 'IN_CABIN',
          expectedReturnTime: (doctor as any).expectedReturnTime || null,
          cabinStatusUpdatedAt: (doctor as any).cabinStatusUpdatedAt || null,
        },
        appointmentDate,
        totalPatients: appointments.length,
        waitingCount: appointments.filter((a) => a.status === 'WAITING').length,
        inConsultationCount: appointments.filter((a) => a.status === 'IN_CONSULTATION').length,
        completedCount: appointments.filter((a) => a.status === 'COMPLETED').length,
        cancelledCount: appointments.filter((a) => a.status === 'CANCELLED').length,
        appointments: appointments.map((a) => {
          let resolvedEstTime = a.estimatedTime;
          if (a.status === 'IN_CONSULTATION') {
            resolvedEstTime = 'In Cabin';
          } else if (a.status === 'WAITING' && a.queueNumber > 0) {
            const matchedSlot = (a.slotId && slots.find((s: any) => s.id === a.slotId)) || slots[0];
            if (matchedSlot?.startTime) {
              const [sh, sm] = matchedSlot.startTime.split(':').map(Number);
              const slotStartMins = sh * 60 + sm;
              let slotEndMins = matchedSlot.endTime ? timeToMinutes(matchedSlot.endTime) : slotStartMins + 240;
              if (slotEndMins <= slotStartMins) slotEndMins += 24 * 60;
              const pace = matchedSlot.avgConsultationMinutes || 3.0;
              const aheadCount = appointments.filter((other) =>
                other.status === 'WAITING' &&
                other.queueNumber > 0 &&
                other.queueNumber < a.queueNumber &&
                (a.slotId ? other.slotId === a.slotId : true)
              ).length;

              const todayStr = getLocalDateString();
              const currentMins = getIndianTimeMinutes();
              let effectiveBaseMins = slotStartMins;
              if (a.appointmentDate === todayStr && currentMins > slotStartMins && currentMins < slotEndMins) {
                effectiveBaseMins = currentMins;
              }
              resolvedEstTime = minutesTo12Hour(effectiveBaseMins + Math.round(aheadCount * pace));
            }
          }
          return {
            id: a.id,
            doctorId: a.doctorId,
            queueNumber: a.queueNumber,
            patientName: a.patientName || a.patient?.user?.fullName || 'Walk-in Patient',
            registeredUserName: a.patient?.user?.fullName,
            patientPhone: a.patient?.user?.phone || 'N/A',
            walkInCode: a.walkInCode || null,
            gender: a.patientGender || a.patient?.gender,
            bloodGroup: a.patient?.bloodGroup,
            checkingWindow: a.checkingWindow,
            estimatedTime: resolvedEstTime || a.estimatedTime,
            slotId: a.slotId,
            status: a.status,
            isCheckedIn: Boolean(a.isCheckedIn),
            checkedInAt: a.checkedInAt || null,
            reasonForVisit: a.reasonForVisit,
            symptoms: a.symptoms,
            isForOther: Boolean(a.isForOther),
            patientAge: a.patientAge,
            appointmentDate: a.appointmentDate,
            createdAt: a.createdAt,
          };
        }),
      },
    });
  } catch (error: any) {
    console.error('getDoctorQueue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve doctor queue',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
