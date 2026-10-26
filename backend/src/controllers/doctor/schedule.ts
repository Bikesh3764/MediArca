import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { parseDoctorSlots, validateDoctorSlots, timeToMinutes, getLocalDateString, cleanSlotName, cleanWorkingDays, parseDoctorWorkingDays, parseDoctorLeaves, isDoctorOnLeave, isDoctorWorkingOnDate, DoctorLeave, isValidAppointmentDate, parseAffiliationSlots } from '../../utils/scheduleUtils';
import { isDoctorEligibleForClinicalPractice, verifyReceptionistDoctorAccess, isClinicActive } from '../../utils/authGuards';
import { createNotification, formatVisitDate, withDr } from '../../services/notificationService';

export const updateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'DOCTOR') {
      res.status(403).json({ success: false, message: 'Only doctors can update checking schedule' });
      return;
    }

    const {
      clinicId,
      slots,
      checkingStartTime,
      checkingEndTime,
      avgConsultationMinutes,
      maxDailyPatients,
      consultationFee,
      clinicAddress,
      bio,
    } = req.body;

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

    if (consultationFee !== undefined) {
      const numFee = Number(consultationFee);
      if (!Number.isFinite(numFee) || isNaN(numFee) || numFee < 0) {
        res.status(400).json({ success: false, message: 'Consultation fee must be a valid, finite non-negative number.' });
        return;
      }
    }

    let formattedSlots: any[] = [];
    let derivedStartTime = checkingStartTime;
    let derivedEndTime = checkingEndTime;
    let derivedMaxPatients = maxDailyPatients;
    let derivedAvgMinutes = avgConsultationMinutes;

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (checkingStartTime !== undefined) {
      if (typeof checkingStartTime !== 'string' || !timeRegex.test(checkingStartTime.trim())) {
        res.status(400).json({
          success: false,
          message: 'Invalid checkingStartTime format. Expected valid 24-hour time string in HH:mm format (e.g. 09:00).',
        });
        return;
      }
      derivedStartTime = checkingStartTime.trim();
    }

    if (checkingEndTime !== undefined) {
      if (typeof checkingEndTime !== 'string' || !timeRegex.test(checkingEndTime.trim())) {
        res.status(400).json({
          success: false,
          message: 'Invalid checkingEndTime format. Expected valid 24-hour time string in HH:mm format (e.g. 13:00).',
        });
        return;
      }
      derivedEndTime = checkingEndTime.trim();
    }

    if (derivedStartTime && derivedEndTime) {
      const [sh, sm] = derivedStartTime.split(':').map(Number);
      const [eh, em] = derivedEndTime.split(':').map(Number);
      if (eh * 60 + em <= sh * 60 + sm) {
        res.status(400).json({
          success: false,
          message: 'Invalid schedule times: checkingEndTime must be strictly after checkingStartTime.',
        });
        return;
      }
    }

    if (slots) {
      let parsed: any;
      try {
        parsed = typeof slots === 'string' ? JSON.parse(slots) : slots;
      } catch {
        res.status(400).json({ success: false, message: 'Invalid slots format: JSON parsing failed.' });
        return;
      }

      const validation = validateDoctorSlots(parsed);
      if (!validation.valid) {
        res.status(400).json({ success: false, message: validation.error });
        return;
      }

      formattedSlots = validation.formatted!;
      derivedStartTime = formattedSlots[0].startTime;
      derivedEndTime = formattedSlots[formattedSlots.length - 1].endTime;
      derivedMaxPatients = formattedSlots.reduce((acc, cur) => acc + cur.maxPatients, 0);
      derivedAvgMinutes = formattedSlots[0].avgConsultationMinutes;
    }

    // If clinicId is provided, update the clinic-specific schedule on ClinicDoctor
    if (clinicId) {
      const clinicAffiliation = await prisma.clinicDoctor.findUnique({
        where: {
          clinicId_doctorId: {
            clinicId,
            doctorId: doctor.id,
          },
        },
        include: { clinic: true },
      });

      if (!clinicAffiliation || (clinicAffiliation.status !== 'ACTIVE' && clinicAffiliation.status !== 'ACCEPTED')) {
        res.status(403).json({
          success: false,
          message: 'Active clinic affiliation required to configure clinic-specific schedule.',
        });
        return;
      }

      const clinicCheck = isClinicActive(clinicAffiliation.clinic);
      if (!clinicCheck.active) {
        res.status(403).json({
          success: false,
          message: clinicCheck.reason || 'Clinic facility is not verified or is currently suspended from practice.',
        });
        return;
      }

      // Prevent physical doctor from configuring overlapping shifts across multiple clinics simultaneously (Issue 7 / Fix #8, Finding 7)
      const clinicUpdateData: any = {};
      await prisma.$transaction(async (tx) => {
        // Concurrency lock on DoctorProfile (BUG-05, A-02)
        if (typeof (tx as any).$queryRaw === 'function') {
          await (tx as any).$queryRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctor.id} FOR UPDATE;`;
        } else if (typeof (tx as any).$executeRaw === 'function') {
          await (tx as any).$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctor.id} FOR UPDATE;`;
        }

        if (formattedSlots.length > 0) {
          const currentWorkingDays = req.body.workingDays
            ? parseDoctorWorkingDays(req.body.workingDays)
            : parseDoctorWorkingDays(clinicAffiliation.workingDays);

          const otherAffiliations = await tx.clinicDoctor.findMany({
            where: {
              doctorId: doctor.id,
              clinicId: { not: clinicId },
              status: { in: ['ACTIVE', 'ACCEPTED'] },
              slots: { not: null },
            },
            include: { clinic: true },
          });

          for (const otherAff of otherAffiliations) {
            if (!isClinicActive(otherAff.clinic).active) continue;
            let otherSlots: any[] = [];
            try {
              const parsed = typeof otherAff.slots === 'string' ? JSON.parse(otherAff.slots) : otherAff.slots;
              if (Array.isArray(parsed)) otherSlots = parsed;
            } catch {}

            const otherWorkingDays = parseDoctorWorkingDays(otherAff.workingDays);

            for (const newSlot of formattedSlots) {
              const daysA = (Array.isArray((newSlot as any).days) && (newSlot as any).days.length > 0)
                ? cleanWorkingDays((newSlot as any).days)
                : (Array.isArray((newSlot as any).workingDays) && (newSlot as any).workingDays.length > 0)
                ? cleanWorkingDays((newSlot as any).workingDays)
                : currentWorkingDays;

              const startA = timeToMinutes(newSlot.startTime);
              let endA = timeToMinutes(newSlot.endTime);
              if (endA <= startA) endA += 24 * 60;

              for (const existingSlot of otherSlots) {
                if (!existingSlot?.startTime || !existingSlot?.endTime) continue;

                const daysB = (Array.isArray(existingSlot.days) && existingSlot.days.length > 0)
                  ? cleanWorkingDays(existingSlot.days)
                  : (Array.isArray(existingSlot.workingDays) && existingSlot.workingDays.length > 0)
                  ? cleanWorkingDays(existingSlot.workingDays)
                  : otherWorkingDays;

                const hasCommonDays = daysA.some((d: string) => daysB.includes(d));
                if (!hasCommonDays) {
                  // No day intersection - doctor sits on different days at these clinics
                  continue;
                }

                const startB = timeToMinutes(existingSlot.startTime);
                let endB = timeToMinutes(existingSlot.endTime);
                if (endB <= startB) endB += 24 * 60;

                if (startA < endB && startB < endA) {
                  const err: any = new Error(
                    `Shift '${newSlot.name}' (${newSlot.startTime}–${newSlot.endTime}) overlaps with your active shift '${existingSlot.name || 'Shift'}' (${existingSlot.startTime}–${existingSlot.endTime}) at ${otherAff.clinic?.clinicName || 'another clinic'}. A practitioner cannot have simultaneous physical shifts at two clinics.`
                  );
                  err.status = 400;
                  throw err;
                }
              }
            }
          }
        }

        if (formattedSlots.length > 0) {
          clinicUpdateData.slots = JSON.stringify(formattedSlots);
        }
        if (consultationFee !== undefined && Number.isFinite(Number(consultationFee)) && Number(consultationFee) >= 0) {
          clinicUpdateData.consultationFee = Math.round(Number(consultationFee) * 100) / 100; // ₹ to the paisa
        }
        if (req.body.workingDays && Array.isArray(req.body.workingDays)) {
          const cleanedDays = cleanWorkingDays(req.body.workingDays);
          clinicUpdateData.workingDays = JSON.stringify(cleanedDays);
        }

        await tx.clinicDoctor.update({
          where: { id: clinicAffiliation.id },
          data: clinicUpdateData,
        });

        // Sync upcoming waiting appointments with updated checkingWindow
        if (formattedSlots.length > 0) {
          const todayStr = getLocalDateString();
          const upcomingAppts = await tx.appointment.findMany({
            where: {
              doctorId: doctor.id,
              clinicId: clinicAffiliation.clinicId,
              appointmentDate: { gte: todayStr },
              status: { in: ['WAITING', 'PENDING_APPROVAL'] },
            },
            select: { id: true, slotId: true },
          });

          for (const appt of upcomingAppts) {
            const matchedSlot = (appt.slotId && formattedSlots.find((s: any) => s.id === appt.slotId)) || formattedSlots[0];
            if (matchedSlot) {
              await tx.appointment.update({
                where: { id: appt.id },
                data: {
                  slotId: matchedSlot.id,
                  checkingWindow: cleanSlotName(matchedSlot.name, 'Shift 1'),
                },
              });
            }
          }
        }
      });

      res.json({
        success: true,
        message: `Schedule and consultation fee for ${clinicAffiliation.clinic.clinicName} updated successfully`,
        data: {
          clinicId,
          clinicName: clinicAffiliation.clinic.clinicName,
          consultationFee: clinicUpdateData.consultationFee ?? (clinicAffiliation as any).consultationFee ?? doctor.consultationFee,
          slots: formattedSlots.length > 0 ? formattedSlots : parseDoctorSlots(doctor),
          workingDays: clinicUpdateData.workingDays ? JSON.parse(clinicUpdateData.workingDays) : parseDoctorWorkingDays((clinicAffiliation as any).workingDays),
        },
      });
      return;
    }

    const updateData: any = {
      ...(derivedStartTime !== undefined && { checkingStartTime: derivedStartTime }),
      ...(derivedEndTime !== undefined && { checkingEndTime: derivedEndTime }),
      ...(derivedAvgMinutes !== undefined && !isNaN(Number(derivedAvgMinutes)) && {
        avgConsultationMinutes: Math.max(1, Math.round(Number(derivedAvgMinutes))),
      }),
      ...(derivedMaxPatients !== undefined && !isNaN(Number(derivedMaxPatients)) && {
        maxDailyPatients: Math.max(1, Number(derivedMaxPatients)),
      }),
      ...(consultationFee !== undefined && Number.isFinite(Number(consultationFee)) && Number(consultationFee) >= 0 && {
        consultationFee: Math.round(Number(consultationFee) * 100) / 100,
      }),
      ...(clinicAddress !== undefined && { clinicAddress }),
      ...(bio !== undefined && { bio }),
    };

    if (formattedSlots.length > 0) {
      const activeAffiliations = await prisma.clinicDoctor.findMany({
        where: {
          doctorId: doctor.id,
          status: { in: ['ACTIVE', 'ACCEPTED'] },
          slots: { not: null },
        },
        include: { clinic: true },
      });

      const profileWorkingDays = req.body.workingDays && Array.isArray(req.body.workingDays)
        ? cleanWorkingDays(req.body.workingDays)
        : parseDoctorWorkingDays((doctor as any).workingDays);

      for (const aff of activeAffiliations) {
        if (!isClinicActive(aff.clinic).active) continue;
        let affSlots: any[] = [];
        try {
          const parsed = typeof aff.slots === 'string' ? JSON.parse(aff.slots) : aff.slots;
          if (Array.isArray(parsed)) affSlots = parsed;
        } catch {}

        const affWorkingDays = aff.workingDays ? parseDoctorWorkingDays(aff.workingDays) : profileWorkingDays;

        for (const sNew of formattedSlots) {
          const daysA = (Array.isArray((sNew as any).days) && (sNew as any).days.length > 0)
            ? cleanWorkingDays((sNew as any).days)
            : (Array.isArray((sNew as any).workingDays) && (sNew as any).workingDays.length > 0)
            ? cleanWorkingDays((sNew as any).workingDays)
            : profileWorkingDays;

          const newStart = timeToMinutes(sNew.startTime);
          let newEnd = timeToMinutes(sNew.endTime);
          if (newEnd <= newStart) newEnd += 24 * 60;

          for (const sAff of affSlots) {
            if (!sAff?.startTime || !sAff?.endTime) continue;

            const daysB = (Array.isArray(sAff.days) && sAff.days.length > 0)
              ? cleanWorkingDays(sAff.days)
              : (Array.isArray(sAff.workingDays) && sAff.workingDays.length > 0)
              ? cleanWorkingDays(sAff.workingDays)
              : affWorkingDays;

            const commonDays = daysA.filter((d: string) => daysB.includes(d));
            if (commonDays.length === 0) continue;

            const affStart = timeToMinutes(sAff.startTime);
            let affEnd = timeToMinutes(sAff.endTime);
            if (affEnd <= affStart) affEnd += 24 * 60;

            if (newStart < affEnd && affStart < newEnd) {
              res.status(400).json({
                success: false,
                message: `Configured practice hours (${sNew.startTime}–${sNew.endTime}) overlap with an active shift (${sAff.startTime}–${sAff.endTime}) at ${aff.clinic?.clinicName || 'another affiliated clinic'} on common day(s): ${commonDays.join(', ')}. Practitioners cannot practice at multiple clinics simultaneously.`,
              });
              return;
            }
          }
        }
      }

      updateData.slots = JSON.stringify(formattedSlots);
    }
    if (req.body.workingDays && Array.isArray(req.body.workingDays)) {
      const cleanedDays = cleanWorkingDays(req.body.workingDays);
      updateData.workingDays = JSON.stringify(cleanedDays);
    }

    const updated = await prisma.doctorProfile.update({
      where: { id: doctor.id },
      data: updateData,
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true, role: true },
        },
      },
    });

    res.json({
      success: true,
      message: 'Schedule and checking slots updated successfully',
      data: {
        ...updated,
        slots: parseDoctorSlots(updated),
        workingDays: updated.workingDays ? JSON.parse(updated.workingDays) : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      },
    });
  } catch (error: any) {
    console.error('updateSchedule error:', error);
    if (error.status === 400) {
      res.status(400).json({
        success: false,
        message: error.message || 'Schedule conflict: shifts cannot overlap across clinical facilities.',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update schedule',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};

/**
 * Get comprehensive doctor schedule configuration, working days, and leave records
 */
export const getDoctorScheduleConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    let doctorId = req.params.doctorId ? String(req.params.doctorId) : undefined;
    let clinicId = req.query.clinicId ? String(req.query.clinicId) : undefined;

    if (req.user.role === 'DOCTOR') {
      const docProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
      if (!docProfile) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
      doctorId = docProfile.id;
    } else if (req.user.role === 'RECEPTIONIST') {
      if (!doctorId) {
        res.status(400).json({ success: false, message: 'doctorId is required for receptionist' });
        return;
      }
      const recProfile = await prisma.receptionistProfile.findUnique({
        where: { userId: req.user.id },
        select: { clinicId: true },
      });
      if (!clinicId && recProfile?.clinicId) {
        clinicId = recProfile.clinicId;
      }
      const access = await verifyReceptionistDoctorAccess(req.user.id, doctorId, clinicId || null);
      if (!access.authorized) {
        res.status(403).json({ success: false, message: access.reason || 'Unauthorized for this practitioner' });
        return;
      }
    } else if (req.user.role === 'CLINIC') {
      if (!doctorId) {
        res.status(400).json({ success: false, message: 'doctorId is required' });
        return;
      }
      const ownClinic = await prisma.clinicProfile.findUnique({ where: { userId: req.user.id } });
      if (!ownClinic || (clinicId && clinicId !== ownClinic.id)) {
        res.status(403).json({ success: false, message: 'Unauthorized for another clinic facility' });
        return;
      }
      const affiliation = await prisma.clinicDoctor.findUnique({
        where: { clinicId_doctorId: { clinicId: ownClinic.id, doctorId } },
      });
      if (!affiliation || !['ACTIVE', 'ACCEPTED'].includes(affiliation.status)) {
        res.status(403).json({ success: false, message: 'Doctor is not actively affiliated with your clinic' });
        return;
      }
      if (!clinicId) {
        clinicId = ownClinic.id;
      }
    } else if (req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: {
        user: { select: { fullName: true, email: true, phone: true, avatarUrl: true } },
        clinics: {
          include: { clinic: { select: { id: true, clinicName: true, address: true, city: true } } },
        },
      },
    });

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    let targetAffiliation: any = null;
    if (clinicId) {
      targetAffiliation = doctor.clinics?.find((c) => c.clinicId === clinicId);
    }

    const workingDays = targetAffiliation?.workingDays
      ? parseDoctorWorkingDays(targetAffiliation.workingDays)
      : parseDoctorWorkingDays((doctor as any).workingDays);

    const clinicLeaves = targetAffiliation
      ? (targetAffiliation.leaves ? parseDoctorLeaves(targetAffiliation.leaves) : [])
      : (doctor.clinics || []).flatMap((cd: any) =>
          cd.leaves
            ? parseDoctorLeaves(cd.leaves).map((l) => ({
                ...l,
                clinicId: l.clinicId || cd.clinicId,
                clinicName: l.clinicName || cd.clinic?.clinicName,
              }))
            : []
        );
    const globalLeaves = (doctor as any).leaves ? parseDoctorLeaves((doctor as any).leaves) : [];
    const allLeaves = [...globalLeaves, ...clinicLeaves];

    const todayStr = getLocalDateString();
    const todayLeaveCheck = isDoctorOnLeave(allLeaves, todayStr, clinicId || null);
    const todayWorkingCheck = isDoctorWorkingOnDate(workingDays, todayStr);

    res.json({
      success: true,
      data: {
        doctorId: doctor.id,
        doctorName: doctor.user.fullName,
        clinicId: clinicId || null,
        clinicName: targetAffiliation?.clinic?.clinicName || null,
        workingDays,
        leaves: allLeaves,
        slots: targetAffiliation?.slots ? parseDoctorSlots(targetAffiliation) : parseDoctorSlots(doctor),
        consultationFee: targetAffiliation?.consultationFee ?? doctor.consultationFee,
        isOnLeaveToday: todayLeaveCheck.isOnLeave,
        todayLeave: todayLeaveCheck.leave || null,
        isWorkingToday: todayWorkingCheck.isWorking,
      },
    });
  } catch (error: any) {
    console.error('getDoctorScheduleConfig error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve doctor schedule config' });
  }
};

/**
 * Update working days (e.g. ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']) for doctor or clinic affiliation
 * Accessible by DOCTOR and RECEPTIONIST
 */
export const updateDoctorWorkingDays = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['DOCTOR', 'RECEPTIONIST'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Access denied: doctor or receptionist role required' });
      return;
    }

    let doctorId = req.params.doctorId ? String(req.params.doctorId) : undefined;
    let clinicId = req.body.clinicId ? String(req.body.clinicId) : undefined;
    const rawDays = req.body.workingDays;

    if (!Array.isArray(rawDays) || rawDays.length === 0) {
      res.status(400).json({
        success: false,
        message: 'workingDays must be a non-empty array of days (e.g. ["MON", "TUE", "WED"])',
      });
      return;
    }

    const cleanedDays = cleanWorkingDays(rawDays);
    let targetClinicId: string | null = clinicId || null;

    if (req.user.role === 'DOCTOR') {
      const docProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
      if (!docProfile) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
      doctorId = docProfile.id;
    } else {
      // RECEPTIONIST
      const dbRecUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { mustChangePassword: true },
      });
      const mustChangePassword = Boolean(dbRecUser?.mustChangePassword || (req.user as any).mustChangePassword);
      if (mustChangePassword) {
        res.status(403).json({
          success: false,
          message: 'Temporary password must be changed before accessing clinical desk operations.',
        });
        return;
      }
      if (!doctorId) {
        res.status(400).json({ success: false, message: 'doctorId is required' });
        return;
      }
      const recProfile = await prisma.receptionistProfile.findUnique({ where: { userId: req.user.id } });
      if (!recProfile || !recProfile.clinicId) {
        res.status(403).json({ success: false, message: 'Receptionist is not assigned to an active clinic facility' });
        return;
      }
      targetClinicId = recProfile.clinicId;
      const access = await verifyReceptionistDoctorAccess(req.user.id, doctorId, targetClinicId);
      if (!access.authorized) {
        res.status(403).json({ success: false, message: access.reason || 'Unauthorized for this practitioner' });
        return;
      }
    }

    const doctorRec = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctorRec) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    if (targetClinicId) {
      const cd = await prisma.clinicDoctor.findUnique({
        where: { clinicId_doctorId: { clinicId: targetClinicId, doctorId } },
        include: { clinic: true },
      });
      if (!cd) {
        res.status(404).json({ success: false, message: 'Doctor clinic affiliation not found' });
        return;
      }

      // Enforce cross-clinic shift overlap validation
      let thisSlots = parseDoctorSlots(doctorRec);
      if (cd.slots) {
        try {
          const p = typeof cd.slots === 'string' ? JSON.parse(cd.slots) : cd.slots;
          if (Array.isArray(p) && p.length > 0) thisSlots = p;
        } catch {}
      }

      const otherAffiliations = await prisma.clinicDoctor.findMany({
        where: {
          doctorId,
          clinicId: { not: targetClinicId },
          status: { in: ['ACTIVE', 'ACCEPTED'] },
        },
        include: { clinic: true },
      });

      for (const otherAff of otherAffiliations) {
        if (!isClinicActive(otherAff.clinic).active) continue;
        let otherSlots = parseDoctorSlots(doctorRec);
        if (otherAff.slots) {
          otherSlots = parseAffiliationSlots(otherAff.slots) ?? otherSlots;
        }
        const otherWorkingDays = otherAff.workingDays
          ? parseDoctorWorkingDays(otherAff.workingDays)
          : parseDoctorWorkingDays(doctorRec.workingDays);

        for (const newSlot of thisSlots) {
          const daysA = (Array.isArray((newSlot as any).days) && (newSlot as any).days.length > 0)
            ? cleanWorkingDays((newSlot as any).days)
            : (Array.isArray((newSlot as any).workingDays) && (newSlot as any).workingDays.length > 0)
            ? cleanWorkingDays((newSlot as any).workingDays)
            : cleanedDays;

          const startA = timeToMinutes(newSlot.startTime);
          let endA = timeToMinutes(newSlot.endTime);
          if (endA <= startA) endA += 24 * 60;

          for (const existingSlot of otherSlots) {
            if (!existingSlot?.startTime || !existingSlot?.endTime) continue;

            const daysB = (Array.isArray((existingSlot as any).days) && (existingSlot as any).days.length > 0)
              ? cleanWorkingDays((existingSlot as any).days)
              : (Array.isArray((existingSlot as any).workingDays) && (existingSlot as any).workingDays.length > 0)
              ? cleanWorkingDays((existingSlot as any).workingDays)
              : otherWorkingDays;

            const commonDays = daysA.filter((d: string) => daysB.includes(d));
            if (commonDays.length === 0) continue;

            const startB = timeToMinutes(existingSlot.startTime);
            let endB = timeToMinutes(existingSlot.endTime);
            if (endB <= startB) endB += 24 * 60;

            if (startA < endB && startB < endA) {
              res.status(400).json({
                success: false,
                message: `Working days update would create an overlapping shift conflict: Shift '${newSlot.name || 'Shift'}' (${newSlot.startTime}–${newSlot.endTime}) at ${cd.clinic?.clinicName || 'this clinic'} overlaps with shift '${existingSlot.name || 'Shift'}' (${existingSlot.startTime}–${existingSlot.endTime}) at ${otherAff.clinic?.clinicName || 'another clinic'} on common day(s): ${commonDays.join(', ')}. A practitioner cannot have simultaneous physical shifts across multiple clinics.`,
              });
              return;
            }
          }
        }
      }

      await prisma.clinicDoctor.update({
        where: { id: cd.id },
        data: { workingDays: JSON.stringify(cleanedDays) },
      });
    } else {
      const doctorAffiliations = await prisma.clinicDoctor.findMany({
        where: {
          doctorId,
          status: { in: ['ACTIVE', 'ACCEPTED'] },
        },
        include: { clinic: true },
      });

      for (let i = 0; i < doctorAffiliations.length; i++) {
        const affA = doctorAffiliations[i];
        if (!isClinicActive(affA.clinic).active) continue;
        const daysA = affA.workingDays ? parseDoctorWorkingDays(affA.workingDays) : cleanedDays;
        let slotsA = parseDoctorSlots(doctorRec);
        if (affA.slots) {
          try {
            const p = typeof affA.slots === 'string' ? JSON.parse(affA.slots) : affA.slots;
            if (Array.isArray(p) && p.length > 0) slotsA = p;
          } catch {}
        }

        for (let j = i + 1; j < doctorAffiliations.length; j++) {
          const affB = doctorAffiliations[j];
          if (!isClinicActive(affB.clinic).active) continue;
          const daysB = affB.workingDays ? parseDoctorWorkingDays(affB.workingDays) : cleanedDays;
          let slotsB = parseDoctorSlots(doctorRec);
          if (affB.slots) {
            try {
              const p = typeof affB.slots === 'string' ? JSON.parse(affB.slots) : affB.slots;
              if (Array.isArray(p) && p.length > 0) slotsB = p;
            } catch {}
          }

          for (const slotA of slotsA) {
            const daysSlotA = (Array.isArray((slotA as any).days) && (slotA as any).days.length > 0)
              ? cleanWorkingDays((slotA as any).days)
              : (Array.isArray((slotA as any).workingDays) && (slotA as any).workingDays.length > 0)
              ? cleanWorkingDays((slotA as any).workingDays)
              : daysA;

            const startA = timeToMinutes(slotA.startTime);
            let endA = timeToMinutes(slotA.endTime);
            if (endA <= startA) endA += 24 * 60;

            for (const slotB of slotsB) {
              if (!slotB?.startTime || !slotB?.endTime) continue;
              const daysSlotB = (Array.isArray((slotB as any).days) && (slotB as any).days.length > 0)
                ? cleanWorkingDays((slotB as any).days)
                : (Array.isArray((slotB as any).workingDays) && (slotB as any).workingDays.length > 0)
                ? cleanWorkingDays((slotB as any).workingDays)
                : daysB;

              const commonDays = daysSlotA.filter((d: string) => daysSlotB.includes(d));
              if (commonDays.length === 0) continue;

              const startB = timeToMinutes(slotB.startTime);
              let endB = timeToMinutes(slotB.endTime);
              if (endB <= startB) endB += 24 * 60;

              if (startA < endB && startB < endA) {
                res.status(400).json({
                  success: false,
                  message: `Working days update would create an overlapping shift conflict between ${affA.clinic?.clinicName || 'Clinic 1'} (${slotA.startTime}–${slotA.endTime}) and ${affB.clinic?.clinicName || 'Clinic 2'} (${slotB.startTime}–${slotB.endTime}) on common day(s): ${commonDays.join(', ')}.`,
                });
                return;
              }
            }
          }
        }
      }

      await prisma.doctorProfile.update({
        where: { id: doctorId },
        data: { workingDays: JSON.stringify(cleanedDays) },
      });
    }

    res.json({
      success: true,
      message: 'Doctor working days updated successfully',
      data: {
        doctorId,
        clinicId: targetClinicId,
        workingDays: cleanedDays,
      },
    });
  } catch (error: any) {
    console.error('updateDoctorWorkingDays error:', error);
    res.status(500).json({ success: false, message: 'Failed to update working days' });
  }
};

/**
 * Record a leave for doctor (Today or Date range)
 * Accessible by DOCTOR and RECEPTIONIST
 */
export const addDoctorLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['DOCTOR', 'RECEPTIONIST'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Access denied: doctor or receptionist role required' });
      return;
    }

    let doctorId = req.params.doctorId ? String(req.params.doctorId) : undefined;
    const { type = 'TODAY', reason, clinicId: reqClinicId } = req.body;
    let { startDate, endDate } = req.body;

    const todayStr = getLocalDateString();

    if (type === 'TODAY') {
      startDate = todayStr;
      endDate = todayStr;
    } else if (type === 'DATE_RANGE') {
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, message: 'startDate and endDate are required for DATE_RANGE leave' });
        return;
      }
      if (!isValidAppointmentDate(startDate) || !isValidAppointmentDate(endDate)) {
        res.status(400).json({ success: false, message: 'Invalid date format (must be YYYY-MM-DD)' });
        return;
      }
      if (startDate > endDate) {
        res.status(400).json({ success: false, message: 'startDate cannot be after endDate' });
        return;
      }
      if (endDate < todayStr) {
        res.status(400).json({ success: false, message: 'Cannot schedule leave in the past' });
        return;
      }
    } else {
      res.status(400).json({ success: false, message: 'Invalid leave type. Must be TODAY or DATE_RANGE' });
      return;
    }

    let targetClinicId: string | null = reqClinicId || null;
    const creatorName = req.user.fullName || 'Desk Staff';

    if (req.user.role === 'DOCTOR') {
      const docProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
      if (!docProfile) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
      doctorId = docProfile.id;
    } else {
      // RECEPTIONIST
      const dbRecUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { mustChangePassword: true },
      });
      const mustChangePassword = Boolean(dbRecUser?.mustChangePassword || (req.user as any).mustChangePassword);
      if (mustChangePassword) {
        res.status(403).json({
          success: false,
          message: 'Temporary password must be changed before accessing clinical desk operations.',
        });
        return;
      }
      if (!doctorId) {
        res.status(400).json({ success: false, message: 'doctorId is required' });
        return;
      }
      const recProfile = await prisma.receptionistProfile.findUnique({ where: { userId: req.user.id } });
      if (!recProfile || !recProfile.clinicId) {
        res.status(403).json({ success: false, message: 'Receptionist is not assigned to an active clinic facility' });
        return;
      }
      targetClinicId = recProfile.clinicId;
      const access = await verifyReceptionistDoctorAccess(req.user.id, doctorId, targetClinicId);
      if (!access.authorized) {
        res.status(403).json({ success: false, message: access.reason || 'Unauthorized for this practitioner' });
        return;
      }
    }

    let clinicName: string | undefined;
    if (targetClinicId) {
      const clinic = await prisma.clinicProfile.findUnique({ where: { id: targetClinicId }, select: { clinicName: true } });
      clinicName = clinic?.clinicName;
    }

    const newLeave: DoctorLeave = {
      id: `leave_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      startDate,
      endDate,
      reason: reason && typeof reason === 'string' && reason.trim() ? reason.trim() : undefined,
      clinicId: targetClinicId,
      clinicName,
      createdAt: new Date().toISOString(),
      createdByRole: req.user.role as any,
      createdByName: creatorName,
    };

    if (targetClinicId) {
      const cd = await prisma.clinicDoctor.findUnique({
        where: { clinicId_doctorId: { clinicId: targetClinicId, doctorId } },
      });
      if (!cd) {
        res.status(404).json({ success: false, message: 'Doctor clinic affiliation not found' });
        return;
      }
      const existing = parseDoctorLeaves((cd as any).leaves).filter(
        (l) => !(l.startDate === startDate && l.endDate === endDate && (type === 'TODAY' ? l.type === 'TODAY' : true))
      );
      const updatedLeaves = [...existing, newLeave];
      await prisma.clinicDoctor.update({
        where: { id: cd.id },
        data: { leaves: JSON.stringify(updatedLeaves) },
      });
    } else {
      const doc = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
      if (!doc) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
      const existing = parseDoctorLeaves((doc as any).leaves).filter(
        (l) => !(l.startDate === startDate && l.endDate === endDate && (type === 'TODAY' ? l.type === 'TODAY' : true))
      );
      const updatedLeaves = [...existing, newLeave];
      await prisma.doctorProfile.update({
        where: { id: doctorId },
        data: { leaves: JSON.stringify(updatedLeaves) },
      });
    }

    // Notify patients with active bookings during the scheduled leave window
    try {
      const affectedAppts = await prisma.appointment.findMany({
        where: {
          doctorId,
          ...(targetClinicId ? { clinicId: targetClinicId } : {}),
          appointmentDate: { gte: startDate, lte: endDate },
          status: { in: ['PENDING_APPROVAL', 'WAITING'] },
        },
        include: {
          patient: { select: { userId: true } },
          doctor: { include: { user: { select: { fullName: true } } } },
        },
      });
      for (const appt of affectedAppts) {
        if (appt.patient?.userId) {
          createNotification(
            appt.patient.userId,
            'Doctor on leave',
            `${withDr(appt.doctor?.user?.fullName)} is on leave on ${formatVisitDate(appt.appointmentDate)}. The clinic will help you pick a new time.`,
            'APPOINTMENT'
          ).catch(() => {});
        }
      }
    } catch {
      // Non-blocking notification dispatch
    }

    res.json({
      success: true,
      message: type === 'TODAY' ? 'Doctor marked on leave for today' : `Doctor leave scheduled from ${startDate} to ${endDate}`,
      data: newLeave,
    });
  } catch (error: any) {
    console.error('addDoctorLeave error:', error);
    res.status(500).json({ success: false, message: 'Failed to record doctor leave' });
  }
};

/**
 * Cancel/remove a scheduled leave for a doctor
 * Accessible by DOCTOR and RECEPTIONIST
 */
export const cancelDoctorLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['DOCTOR', 'RECEPTIONIST'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Access denied: doctor or receptionist role required' });
      return;
    }

    let doctorId = req.params.doctorId ? String(req.params.doctorId) : undefined;
    const leaveId = String(req.params.leaveId);

    if (req.user.role === 'DOCTOR') {
      const docProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
      if (!docProfile) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
      doctorId = docProfile.id;
    } else {
      // RECEPTIONIST
      const dbRecUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { mustChangePassword: true },
      });
      const mustChangePassword = Boolean(dbRecUser?.mustChangePassword || (req.user as any).mustChangePassword);
      if (mustChangePassword) {
        res.status(403).json({
          success: false,
          message: 'Temporary password must be changed before accessing clinical desk operations.',
        });
        return;
      }
      if (!doctorId) {
        res.status(400).json({ success: false, message: 'doctorId is required' });
        return;
      }
      const recProfile = await prisma.receptionistProfile.findUnique({ where: { userId: req.user.id } });
      if (!recProfile || !recProfile.clinicId) {
        res.status(403).json({ success: false, message: 'Receptionist is not assigned to an active clinic facility' });
        return;
      }
      const access = await verifyReceptionistDoctorAccess(req.user.id, doctorId, recProfile.clinicId);
      if (!access.authorized) {
        res.status(403).json({ success: false, message: access.reason || 'Unauthorized for this practitioner' });
        return;
      }
    }

    // Check both ClinicDoctor affiliations and DoctorProfile
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { clinics: true },
    });
    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor profile not found' });
      return;
    }

    let removed = false;

    const todayStr = getLocalDateString();

    // Check DoctorProfile.leaves
    const docLeaves = parseDoctorLeaves((doctor as any).leaves);
    const targetDocLeave = docLeaves.find((l) => l.id === leaveId);
    const filteredDocLeaves = docLeaves.filter(
      (l) => l.id !== leaveId && !(targetDocLeave?.type === 'TODAY' && l.type === 'TODAY' && l.startDate === todayStr)
    );
    if (filteredDocLeaves.length !== docLeaves.length) {
      await prisma.doctorProfile.update({
        where: { id: doctorId },
        data: { leaves: JSON.stringify(filteredDocLeaves) },
      });
      removed = true;
    }

    // Check each clinic affiliation
    for (const cd of doctor.clinics) {
      const cdLeaves = parseDoctorLeaves((cd as any).leaves);
      const targetCdLeave = cdLeaves.find((l) => l.id === leaveId);
      const filteredCdLeaves = cdLeaves.filter(
        (l) => l.id !== leaveId && !(targetCdLeave?.type === 'TODAY' && l.type === 'TODAY' && l.startDate === todayStr)
      );
      if (filteredCdLeaves.length !== cdLeaves.length) {
        await prisma.clinicDoctor.update({
          where: { id: cd.id },
          data: { leaves: JSON.stringify(filteredCdLeaves) },
        });
        removed = true;
      }
    }

    if (!removed) {
      res.status(404).json({ success: false, message: 'Leave record not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Doctor leave cancelled successfully',
    });
  } catch (error: any) {
    console.error('cancelDoctorLeave error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel doctor leave' });
  }
};
