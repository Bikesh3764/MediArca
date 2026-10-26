import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { getIndianTimeMinutes, minutesTo12Hour, getLocalDateString } from '../../utils/scheduleUtils';
import { isDoctorEligibleForClinicalPractice, verifyReceptionistDoctorAccess } from '../../utils/authGuards';
import { createNotification } from '../../services/notificationService';

/**
 * Update Doctor Presence / Cabin Status
 * Accessible by:
 * - DOCTOR: updates own presence
 * - RECEPTIONIST: updates assigned doctor's presence
 */
export const updateCabinStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !['DOCTOR', 'RECEPTIONIST'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Access denied: doctor or receptionist role required' });
      return;
    }

    const { status, expectedReturnTime, returnEstimateMinutes, doctorId: targetDoctorId } = req.body;

    const validStatuses = ['IN_CABIN', 'STEPPED_OUT', 'NOT_IN_CABIN'];
    const normalizedStatus = String(status || '').toUpperCase().trim();
    if (!validStatuses.includes(normalizedStatus)) {
      res.status(400).json({
        success: false,
        message: 'Invalid cabin status. Must be IN_CABIN, STEPPED_OUT, or NOT_IN_CABIN',
      });
      return;
    }

    let doctor: any;

    if (req.user.role === 'DOCTOR') {
      doctor = await prisma.doctorProfile.findUnique({
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
    } else {
      // RECEPTIONIST
      let mustChangePassword = Boolean((req.user as any).mustChangePassword);
      if (!mustChangePassword && typeof (prisma.user as any)?.findUnique === 'function') {
        const recUser = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { mustChangePassword: true },
        });
        if (recUser?.mustChangePassword) {
          mustChangePassword = true;
        }
      }
      if (mustChangePassword) {
        res.status(403).json({
          success: false,
          message: 'Temporary password must be changed before accessing clinical desk operations.',
        });
        return;
      }

      if (!targetDoctorId) {
        res.status(400).json({ success: false, message: 'doctorId is required for receptionist updates' });
        return;
      }

      const recProfile = await prisma.receptionistProfile.findUnique({
        where: { userId: req.user.id },
        select: { clinicId: true },
      });

      const access = await verifyReceptionistDoctorAccess(req.user.id, targetDoctorId, recProfile?.clinicId || null);
      if (!access.authorized) {
        res.status(403).json({ success: false, message: access.reason || 'Unauthorized for this practitioner' });
        return;
      }

      doctor = await prisma.doctorProfile.findUnique({
        where: { id: targetDoctorId },
      });
      if (!doctor) {
        res.status(404).json({ success: false, message: 'Doctor profile not found' });
        return;
      }
    }

    // Determine expected return time formatting
    let cleanReturnTime: string | null = null;
    if (normalizedStatus === 'STEPPED_OUT') {
      if (expectedReturnTime && typeof expectedReturnTime === 'string' && expectedReturnTime.trim()) {
        cleanReturnTime = expectedReturnTime.trim();
      } else if (returnEstimateMinutes && Number.isFinite(Number(returnEstimateMinutes))) {
        const mins = Math.max(1, Math.min(480, Math.floor(Number(returnEstimateMinutes))));
        const nowMinutes = getIndianTimeMinutes(new Date());
        cleanReturnTime = minutesTo12Hour(nowMinutes + mins);
      }
    }

    const updated = await prisma.doctorProfile.update({
      where: { id: doctor.id },
      data: {
        cabinStatus: normalizedStatus,
        expectedReturnTime: cleanReturnTime,
        cabinStatusUpdatedAt: new Date(),
      },
      select: {
        id: true,
        cabinStatus: true,
        expectedReturnTime: true,
        cabinStatusUpdatedAt: true,
      },
    });

    const statusLabels: Record<string, string> = {
      IN_CABIN: 'Doctor has arrived and is in cabin',
      STEPPED_OUT: cleanReturnTime
        ? `Doctor stepped out (expected back around ${cleanReturnTime})`
        : 'Doctor has stepped out',
      NOT_IN_CABIN: 'Doctor has not yet arrived in cabin',
    };

    const statusActuallyChanged =
      doctor.cabinStatus !== normalizedStatus ||
      (normalizedStatus === 'STEPPED_OUT' && doctor.expectedReturnTime !== cleanReturnTime);

    // Smart Notification: Notify patient about doctor cabin status ONLY if the status actually changed AND patient has an active appointment/token with that specific doctor on that day
    if (statusActuallyChanged) {
      try {
        const istTodayStr = getLocalDateString(new Date());
        const activeVisits = await prisma.appointment.findMany({
          where: {
            doctorId: doctor.id,
            appointmentDate: istTodayStr,
            status: { in: ['WAITING', 'IN_CONSULTATION'] },
            queueNumber: { gt: 0 },
          },
          include: {
            patient: {
              select: { userId: true },
            },
          },
        });

        const uniquePatientUserIds = Array.from(
          new Set(
            activeVisits
              .map((v) => v.patient?.userId)
              .filter((uid): uid is string => Boolean(uid))
          )
        );

        if (uniquePatientUserIds.length > 0) {
          const docUser = await prisma.user.findUnique({
            where: { id: doctor.userId },
            select: { fullName: true },
          });
          const docName = docUser?.fullName
            ? (docUser.fullName.startsWith('Dr.') ? docUser.fullName : `Dr. ${docUser.fullName}`)
            : 'Doctor';

          // "Not in cabin" is usually the end of the day, so patients aren't told about it.
          const shouldNotify = normalizedStatus === 'STEPPED_OUT' || normalizedStatus === 'IN_CABIN';
          let notifTitle = 'Doctor is in';
          let notifMsg = `${docName} is now seeing patients.`;

          if (normalizedStatus === 'STEPPED_OUT') {
            notifTitle = 'Doctor stepped out';
            notifMsg = cleanReturnTime
              ? `${docName} will be back by ${cleanReturnTime}. Your place in line is safe.`
              : `${docName} stepped out for a short while. Your place in line is safe.`;
          }

          const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
          for (const pUserId of shouldNotify ? uniquePatientUserIds : []) {
            try {
              let alreadyNotified = false;
              if (typeof (prisma.notification as any)?.findFirst === 'function') {
                const recent = await prisma.notification.findFirst({
                  where: {
                    userId: pUserId,
                    type: 'CABIN_STATUS',
                    title: notifTitle,
                    createdAt: { gte: sixtySecondsAgo },
                  },
                });
                if (recent) alreadyNotified = true;
              }
              if (!alreadyNotified) {
                await createNotification(pUserId, notifTitle, notifMsg, 'CABIN_STATUS');
              }
            } catch {
              // Non-blocking notification dispatch
            }
          }
        }
      } catch (notifErr) {
        console.error('Failed to dispatch cabin status notifications to active patients:', notifErr);
      }
    }

    res.json({
      success: true,
      message: statusLabels[normalizedStatus] || 'Cabin status updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('updateCabinStatus error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cabin status',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
};
