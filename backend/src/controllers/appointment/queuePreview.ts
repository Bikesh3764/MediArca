import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { parseDoctorSlots, evaluateSlotStatus, SlotStatusResult, isValidAppointmentDate, isDoctorOnLeave, isDoctorWorkingOnDate, parseDoctorWorkingDays, parseDoctorLeaves } from '../../utils/scheduleUtils';

export const getQueuePreview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { doctorId, appointmentDate, slotId, clinicId } = req.query;

    if (!doctorId || !appointmentDate) {
      res.status(400).json({ success: false, message: 'doctorId and appointmentDate are required' });
      return;
    }

    if (!isValidAppointmentDate(appointmentDate)) {
      res.status(400).json({
        success: false,
        message: 'Invalid appointment date format. Expected valid calendar date in YYYY-MM-DD format.',
      });
      return;
    }

    const doctorInclude = {
      user: { select: { fullName: true } },
      clinics: {
        where: { clinic: { isVerified: true, verificationStatus: 'VERIFIED' }, status: { in: ['ACTIVE', 'ACCEPTED'] } },
        include: {
          clinic: {
            include: {
              receptionists: {
                where: { status: 'ACTIVE' },
                select: {
                  id: true,
                  status: true,
                  doctors: { select: { doctorId: true, status: true } },
                },
              },
            },
          },
        },
      },
    };

    let doctor = await prisma.doctorProfile.findUnique({
      where: { id: String(doctorId) },
      include: doctorInclude,
    });

    if (!doctor) {
      doctor = await prisma.doctorProfile.findUnique({
        where: { userId: String(doctorId) },
        include: doctorInclude,
      });
    }

    if (!doctor) {
      res.status(404).json({ success: false, message: 'Doctor not found' });
      return;
    }

    const isOwner = req.user?.role === 'DOCTOR' && doctor.userId === req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      if (!doctor.isVerified || doctor.verificationStatus !== 'VERIFIED') {
        res.status(404).json({
          success: false,
          message: 'Doctor profile is not publicly available or pending verification',
        });
        return;
      }
    }

    const dateStr = String(appointmentDate);
    const activeClinics = doctor.clinics || [];

    // Resolve target clinic affiliation
    let selectedAffiliation: any = null;
    if (clinicId) {
      selectedAffiliation = activeClinics.find((c: any) => c.clinicId === String(clinicId));
    }
    if (!selectedAffiliation && activeClinics.length === 1) {
      selectedAffiliation = activeClinics[0];
    }

    // Determine slots: prioritize clinic-specific slots if available
    let slots = parseDoctorSlots(doctor);
    if (selectedAffiliation?.slots) {
      try {
        const parsed = typeof selectedAffiliation.slots === 'string' ? JSON.parse(selectedAffiliation.slots) : selectedAffiliation.slots;
        if (Array.isArray(parsed) && parsed.length > 0) {
          slots = parsed;
        }
      } catch {}
    }

    const effectiveConsultationFee = selectedAffiliation?.consultationFee ?? doctor.consultationFee;

    // Fetch all active appointments for this doctor on this date, clinic-scoped if clinic selected
    const dayAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        appointmentDate: dateStr,
        ...(selectedAffiliation?.clinicId ? { clinicId: selectedAffiliation.clinicId } : {}),
        status: { in: ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION', 'COMPLETED'] },
      },
      select: {
        id: true,
        queueNumber: true,
        slotId: true,
        checkingWindow: true,
        status: true,
      },
    });

    // Highest positive queue number on this date across appointments for this clinic (FIX-014)
    const maxQueueAppt = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        appointmentDate: dateStr,
        ...(selectedAffiliation?.clinicId ? { clinicId: selectedAffiliation.clinicId } : {}),
        queueNumber: { gt: 0 },
      },
      orderBy: { queueNumber: 'desc' },
      select: { queueNumber: true },
    });
    const highestQueue = maxQueueAppt && maxQueueAppt.queueNumber > 0 ? maxQueueAppt.queueNumber : 0;
    const nextQueueNumber = Math.max(1, highestQueue + 1);

    const targetClinicId = selectedAffiliation?.clinicId || null;
    const workingDays = selectedAffiliation?.workingDays
      ? parseDoctorWorkingDays(selectedAffiliation.workingDays)
      : parseDoctorWorkingDays((doctor as any).workingDays);
    const doctorLeaves = [
      ...parseDoctorLeaves((doctor as any).leaves),
      ...(selectedAffiliation?.leaves ? parseDoctorLeaves(selectedAffiliation.leaves) : []),
    ];

    const leaveCheck = isDoctorOnLeave(doctorLeaves, dateStr, targetClinicId);
    const workingCheck = isDoctorWorkingOnDate(workingDays, dateStr);

    // Evaluate status for each slot using authoritative server time
    const availableSlots: SlotStatusResult[] = slots.map((slot) => {
      const bookedInSlot = dayAppointments.filter((a) => {
        if (a.status === 'PENDING_APPROVAL') return false;
        if (a.slotId) return a.slotId === slot.id;
        if (a.checkingWindow) return a.checkingWindow.includes(slot.startTime);
        return slots.length === 1;
      }).length;

      const waitingInSlot = dayAppointments.filter((a) => {
        if (a.status !== 'WAITING' && a.status !== 'IN_CONSULTATION') return false;
        if (a.slotId) return a.slotId === slot.id;
        if (a.checkingWindow) return a.checkingWindow.includes(slot.startTime);
        return slots.length === 1;
      }).length;

      return evaluateSlotStatus(
        slot,
        dateStr,
        bookedInSlot,
        new Date(),
        undefined,
        waitingInSlot,
        leaveCheck.isOnLeave ? { isOnLeave: true, leaveReason: leaveCheck.leave?.reason } : undefined,
        !workingCheck.isWorking ? { isDayOff: true, dayName: workingCheck.dayName } : undefined
      );
    });

    // Target slot selection: chosen slotId if valid and not passed, or first non-passed and non-full slot, or first slot
    let selectedSlotStatus: SlotStatusResult | undefined;
    if (slotId) {
      selectedSlotStatus = availableSlots.find((s) => s.slot.id === String(slotId));
      if (selectedSlotStatus && selectedSlotStatus.isPassed) {
        const alt = availableSlots.find((s) => !s.isPassed && !s.isFull);
        if (alt) selectedSlotStatus = alt;
      }
    }
    if (!selectedSlotStatus) {
      selectedSlotStatus = availableSlots.find((s) => !s.isPassed && !s.isFull) || availableSlots[0];
    }

    // Shift-specific token number: count how many patients are already confirmed in this specific shift (queueNumber > 0)
    // Matching bookAppointment logic where estimatedQueueNumber = count(queueNumber > 0 in slot) + 1
    const confirmedInSlotCount = dayAppointments.filter((a) => {
      if (a.queueNumber <= 0) return false;
      if (selectedSlotStatus?.slot.id && a.slotId) return a.slotId === selectedSlotStatus.slot.id;
      if (selectedSlotStatus?.slot.startTime && a.checkingWindow) return a.checkingWindow.includes(selectedSlotStatus.slot.startTime);
      return slots.length === 1;
    }).length;

    const nextSlotQueueNumber = Math.max(1, confirmedInSlotCount + 1);

    // Clean shift name (stripping any legacy period descriptors like "(Afternoon)" or "(Morning)")
    const rawShiftName = selectedSlotStatus?.slot?.name || 'Shift';
    const cleanShiftName = rawShiftName.replace(/\s*\([^)]*\)/g, '').trim() || 'Shift';

    res.json({
      success: true,
      data: {
        doctorId: doctor.id,
        doctorName: doctor.user.fullName,
        appointmentDate: dateStr,
        selectedSlotId: selectedSlotStatus.slot.id,
        selectedSlot: selectedSlotStatus,
        availableSlots,
        checkingWindow: cleanShiftName,
        checkingStartTime: selectedSlotStatus.slot.startTime,
        checkingEndTime: selectedSlotStatus.slot.endTime,
        avgConsultationMinutes: selectedSlotStatus.slot.avgConsultationMinutes,
        maxDailyPatients: selectedSlotStatus.slot.maxPatients,
        totalBooked: selectedSlotStatus.totalBooked,
        nextQueueNumber: nextSlotQueueNumber,
        slotQueueNumber: nextSlotQueueNumber,
        dailyQueueNumber: nextQueueNumber,
        patientsAhead: selectedSlotStatus.patientsAhead,
        estimatedTime: selectedSlotStatus.estimatedTime,
        isFull: selectedSlotStatus.isFull,
        isPassed: selectedSlotStatus.isPassed,
        isInProgress: selectedSlotStatus.isInProgress,
        statusLabel: selectedSlotStatus.statusLabel,
        isOnLeave: leaveCheck.isOnLeave,
        leaveReason: leaveCheck.leave?.reason || null,
        isDayOff: !workingCheck.isWorking,
        dayName: workingCheck.dayName,
        workingDays,
        leaves: doctorLeaves,
        consultationFee: effectiveConsultationFee,
        clinicId: selectedAffiliation?.clinicId || null,
        clinicName: selectedAffiliation?.clinic?.clinicName || null,
        hasReceptionist: (() => {
          const recs = selectedAffiliation?.clinic?.receptionists || [];
          return recs.some((r: any) =>
            !r.doctors || r.doctors.length === 0 ||
            r.doctors.some((d: any) => d.doctorId === doctor.id && (d.status === 'ACTIVE' || !d.status))
          );
        })(),
        selectedClinic: selectedAffiliation
          ? {
              clinicId: selectedAffiliation.clinicId,
              clinicName: selectedAffiliation.clinic.clinicName,
              address: selectedAffiliation.clinic.address,
              city: selectedAffiliation.clinic.city,
              phone: selectedAffiliation.clinic.phone,
              consultationFee: effectiveConsultationFee,
              hasReceptionist: (selectedAffiliation.clinic.receptionists || []).some((r: any) =>
                !r.doctors || r.doctors.length === 0 ||
                r.doctors.some((d: any) => d.doctorId === doctor.id && (d.status === 'ACTIVE' || !d.status))
              ),
            }
          : null,
        hasClinics: activeClinics.length > 0,
        clinicsCount: activeClinics.length,
        clinics: activeClinics.map((c: any) => {
          let cSlots = parseDoctorSlots(doctor);
          if (c.slots) {
            try {
              const p = typeof c.slots === 'string' ? JSON.parse(c.slots) : c.slots;
              if (Array.isArray(p) && p.length > 0) cSlots = p;
            } catch {}
          }
          const cHasReceptionist = (c.clinic?.receptionists || []).some((r: any) =>
            !r.doctors || r.doctors.length === 0 ||
            r.doctors.some((d: any) => d.doctorId === doctor.id && (d.status === 'ACTIVE' || !d.status))
          );
          return {
            clinicId: c.clinicId,
            clinicName: c.clinic.clinicName,
            address: c.clinic.address,
            city: c.clinic.city,
            phone: c.clinic.phone,
            consultationFee: c.consultationFee ?? doctor.consultationFee,
            slots: cSlots,
            hasReceptionist: cHasReceptionist,
          };
        }),
      },
    });
  } catch (error: any) {
    console.error('getQueuePreview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate queue preview',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
