import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getLocalDateString, getIndianTimeMinutes } from '../../utils/scheduleUtils';
import { canTransition } from '../../utils/appointmentStateMachine';
import { verifyReceptionistDoctorAccess } from '../../utils/authGuards';
import { createNotification, formatVisitDate, withDr } from '../../services/notificationService';

export const executeReceptionistInConsultationTransaction = async (
  prismaClient: any,
  doctorId: string,
  appointmentDate: string,
  appointmentId: string,
  updatePayload: any,
  clinicId?: string | null
) => {
  return await prismaClient.$transaction(async (tx: any) => {
    // Concurrency control: acquire exclusive row lock on DoctorProfile and Appointment to serialize queue transitions (BUG-05, A-02, ARCH-012)
    if (typeof (tx as any).$queryRaw === 'function') {
      await (tx as any).$queryRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctorId} FOR UPDATE;`;
    } else if (typeof (tx as any).$executeRaw === 'function') {
      await (tx as any).$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${doctorId} FOR UPDATE;`;
    }
    if (typeof (tx as any).$executeRaw === 'function') {
      await (tx as any).$executeRaw`SELECT id FROM "Appointment" WHERE id = ${appointmentId} FOR UPDATE;`;
    }

    // Re-verify target appointment inside transaction under DoctorProfile lock (ARCH-012)
    if (typeof tx.appointment?.findUnique === 'function') {
      const currentAppt = await tx.appointment.findUnique({
        where: { id: appointmentId },
      });
      if (!currentAppt) {
        throw new Error('Cannot call patient into consultation: Appointment not found.');
      }
      if (currentAppt.doctorId && currentAppt.doctorId !== doctorId) {
        throw new Error('Cannot call patient into consultation: Appointment belongs to another practitioner.');
      }
      if (clinicId && currentAppt.clinicId && currentAppt.clinicId !== clinicId) {
        throw new Error('Cannot call patient into consultation: Appointment belongs to another clinic facility.');
      }
      if (currentAppt.isCheckedIn === false) {
        throw new Error('Cannot call patient into consultation: Patient is no longer checked in at the clinic.');
      }
      if (currentAppt.status && currentAppt.status !== 'WAITING' && currentAppt.status !== 'IN_CONSULTATION') {
        throw new Error(`Cannot call patient into consultation: Appointment status is '${currentAppt.status}'.`);
      }
    }

    // Guard: ensure practitioner is not actively consulting a patient at another facility or private practice (Issue 7 / ARCH-012)
    if (typeof tx.appointment?.findFirst === 'function') {
      const activeInOtherClinic = await tx.appointment.findFirst({
        where: {
          doctorId,
          status: 'IN_CONSULTATION',
          ...(clinicId
            ? { OR: [{ clinicId: { not: clinicId } }, { clinicId: null }] }
            : { clinicId: { not: null } }),
          id: { not: appointmentId },
        },
        include: { clinic: true },
      });

      if (activeInOtherClinic) {
        throw new Error(
          `Cannot call patient into consultation: Doctor is currently in an active consultation at another clinic (${activeInOtherClinic.clinic?.clinicName || 'another facility'}). Only one consultation can be active at a time.`
        );
      }
    }

    // Reset any other active consultations for this doctor to WAITING at this facility (Finding 2)
    await tx.appointment.updateMany({
      where: {
        doctorId,
        status: 'IN_CONSULTATION',
        id: { not: appointmentId },
        ...(clinicId !== undefined ? { clinicId } : {}),
      },
      data: { status: 'WAITING' },
    });

    // Concurrency guard: conditional atomic update ensures the appointment is strictly in an eligible state (WAITING or IN_CONSULTATION)
    const updateResult = await tx.appointment.updateMany({
      where: {
        id: appointmentId,
        status: { in: ['WAITING', 'IN_CONSULTATION'] },
        isCheckedIn: true,
      },
      data: updatePayload,
    });

    if (updateResult.count === 0) {
      throw new Error('Cannot call patient into consultation: appointment is no longer in an eligible waiting state.');
    }

    return await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        clinic: true,
        doctor: { include: { user: { select: { fullName: true } } } },
        patient: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      },
    });
  });
};

/**
 * Update appointment status (WAITING -> IN_CONSULTATION -> COMPLETED / CANCELLED)
 */
export const updateAppointmentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const appointmentId = String(req.params.appointmentId);
    const { status } = req.body;

    const validStatuses = ['WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const targetAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          select: { id: true, cabinStatus: true, expectedReturnTime: true },
        },
      },
    });

    if (!targetAppointment) {
      res.status(404).json({ success: false, message: 'Appointment not found' });
      return;
    }

    const transition = canTransition(targetAppointment.status, status, req.user?.role || 'RECEPTIONIST');
    if (!transition.allowed) {
      res.status(400).json({
        success: false,
        message: transition.reason || `Cannot transition appointment from ${targetAppointment.status} to ${status}.`,
      });
      return;
    }

    if (!req.user || req.user.role !== 'RECEPTIONIST') {
      res.status(403).json({
        success: false,
        message: 'Access denied: Receptionist role required to update clinical desk appointments.',
      });
      return;
    }

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

    const access = await verifyReceptionistDoctorAccess(req.user.id, targetAppointment.doctorId, targetAppointment.clinicId);
    if (!access.authorized) {
      res.status(403).json({
        success: false,
        message: access.reason || 'Access denied: You are not authorized to update appointments for this doctor.',
      });
      return;
    }

    if (status === 'IN_CONSULTATION') {
      // Verify doctor is physically present in the cabin (cannot call if stepped out or not in cabin)
      if (targetAppointment.doctor?.cabinStatus && targetAppointment.doctor.cabinStatus !== 'IN_CABIN') {
        const statusLabel = targetAppointment.doctor.cabinStatus === 'STEPPED_OUT'
          ? `stepped out${targetAppointment.doctor.expectedReturnTime ? ` (expected return ~${targetAppointment.doctor.expectedReturnTime})` : ''}`
          : 'not in cabin';
        res.status(400).json({
          success: false,
          message: `Doctor has ${statusLabel}. Patient cannot be called into consultation while doctor is away from cabin.`,
        });
        return;
      }
    }

    if (status === 'IN_CONSULTATION' || status === 'COMPLETED') {
      const todayIso = getLocalDateString();
      const yesterdayIso = getLocalDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const currentMins = getIndianTimeMinutes(new Date());
      const isOvernightCarryover = targetAppointment.appointmentDate === yesterdayIso && currentMins < 6 * 60 && targetAppointment.isCheckedIn;
      if (targetAppointment.appointmentDate !== todayIso && !isOvernightCarryover) {
        res.status(400).json({
          success: false,
          message: `Cannot update an appointment scheduled for ${targetAppointment.appointmentDate} to '${status}' today. Status updates are only allowed on the scheduled consultation date.`,
        });
        return;
      }

      if (!targetAppointment.isCheckedIn) {
        res.status(400).json({
          success: false,
          message: `Patient has not checked in at the clinic yet. Patient must arrive at the clinic before appointment can be updated to '${status}'.`,
        });
        return;
      }
    }

    const updatePayload: any = { status };
    let updated: any;

    if (status === 'IN_CONSULTATION') {
      updated = await executeReceptionistInConsultationTransaction(
        prisma,
        targetAppointment.doctorId,
        targetAppointment.appointmentDate,
        appointmentId,
        updatePayload,
        targetAppointment.clinicId
      );
    } else {
      updated = await prisma.$transaction(async (tx) => {
        const current = await tx.appointment.findUnique({
          where: { id: appointmentId },
          select: { status: true, isCheckedIn: true, doctorId: true, clinicId: true, appointmentDate: true },
        });
        if (!current) {
          throw new Error('Appointment not found');
        }
        const stateCheck = canTransition(current.status, status, req.user?.role || 'RECEPTIONIST');
        if (!stateCheck.allowed) {
          throw new Error(stateCheck.reason || `Cannot transition appointment from ${current.status} to ${status}.`);
        }
        return await tx.appointment.update({
          where: { id: appointmentId },
          data: updatePayload,
          include: {
            doctor: { include: { user: { select: { fullName: true } } } },
            patient: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
          },
        });
      });
    }

    if (updated?.patient) {
      const patientUserId = (updated.patient as any).userId || (updated.patient.user as any)?.id;
      const docName = withDr(updated.doctor?.user?.fullName);

      if (status === 'CANCELLED' && patientUserId) {
        createNotification(
          patientUserId,
          'Visit cancelled',
          `The clinic cancelled your visit with ${docName} on ${formatVisitDate(updated.appointmentDate)}. Call the clinic if you have questions.`,
          'APPOINTMENT'
        ).catch(() => {});
      } else if (status === 'IN_CONSULTATION' && patientUserId) {
        createNotification(
          patientUserId,
          "It's your turn",
          `${docName} is ready for you. Please go in now. Token #${updated.queueNumber}.`,
          'QUEUE'
        ).catch(() => {});
      } else if (status === 'COMPLETED' && patientUserId) {
        createNotification(
          patientUserId,
          'Visit complete',
          `Your visit with ${docName} is done. Collect your prescription and advice at the clinic desk.`,
          'APPOINTMENT'
        ).catch(() => {});
      }
    }

    res.json({
      success: true,
      message: `Appointment status updated to ${status}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('updateAppointmentStatus error:', error);
    if (error?.message?.includes('Cannot call patient into consultation')) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    if (
      error?.message?.includes('Cannot transition appointment') ||
      error?.message?.includes('Appointment not found')
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment status',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
