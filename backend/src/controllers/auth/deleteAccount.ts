import { Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/authMiddleware';
import { verifyPassword } from '../../utils/passwords';
import { securityStore, SecurityStoreUnavailableError } from '../../utils/securityStore';
import { markPasswordChanged } from '../../utils/sessionRevocation';
import { getLocalDateString } from '../../utils/scheduleUtils';
import { ownAvatarKey } from '../../utils/avatarUrl';
import { deleteFromR2 } from '../../config/r2';
import { invalidateDoctorQueueCache } from '../../utils/queueStateCache';
import { publishQueueChange } from '../../utils/liveEvents';

/**
 * Self-service account deletion (FIX-056).
 *
 * Safety rules:
 * - The user must type their current password; 5 wrong tries lock deletion for 15 minutes
 *   (its own counter, so a stolen session can't lock the owner out of signing in).
 * - Accounts with live bookings (today or later) can't be deleted until those are cleared,
 *   so no patient silently loses a token and no doctor's queue vanishes mid-shift.
 * - The only admin can't delete themselves (the platform would have nobody to verify clinics).
 * - A clinic takes its front-desk accounts with it; doctors stay and keep their history.
 * - Demo accounts are blocked by the route's demo guard.
 * Everything runs in one transaction with the doctor rows locked, the same lock bookings take.
 */
const DELETE_NAMESPACE = 'del:acct';
const MAX_DELETE_ATTEMPTS = 5;
const DELETE_LOCKOUT_SECONDS = 15 * 60;
const ACTIVE_STATUSES = ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION'];

class Blocked extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const lockDoctors = async (tx: any, doctorIds: string[]) => {
  // Same row lock that booking, calling and walk-ins take, in a fixed order to avoid deadlocks
  for (const id of [...doctorIds].sort()) {
    await tx.$queryRaw`SELECT id FROM "DoctorProfile" WHERE id = ${id} FOR UPDATE;`;
  }
};

/** DELETE /api/auth/account — permanently deletes the signed-in user's own account. */
export const deleteOwnAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Please sign in again.' });
      return;
    }
    const { password } = req.body || {};
    if (typeof password !== 'string' || !password || password.length > 128) {
      res.status(400).json({ success: false, message: 'Enter your password.' });
      return;
    }

    const userId = req.user.id;
    const lock = await securityStore.checkLockout(DELETE_NAMESPACE, userId);
    if (lock.isLocked) {
      res.setHeader('Retry-After', String(lock.remainingLockoutSeconds));
      res.status(429).json({ success: false, code: 'DELETE_LOCKED', message: 'Too many wrong passwords. Try again in 15 minutes.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, passwordHash: true, avatarUrl: true },
    });
    // The token's role must still match the account (ids are never reused, but be strict)
    if (!user || user.role !== req.user.role) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      const attempt = await securityStore.recordFailedAttempt(DELETE_NAMESPACE, userId, null, MAX_DELETE_ATTEMPTS, DELETE_LOCKOUT_SECONDS);
      if (attempt.isLocked) {
        res.status(429).json({ success: false, code: 'DELETE_LOCKED', message: 'Too many wrong passwords. Try again in 15 minutes.' });
        return;
      }
      res.status(400).json({ success: false, code: 'WRONG_PASSWORD', message: 'Wrong password.' });
      return;
    }

    const today = getLocalDateString();
    const touchedDoctors = new Set<string>();
    const staffAvatars: { id: string; avatarUrl: string | null }[] = [];

    await prisma.$transaction(async (tx) => {
      if (user.role === 'ADMIN') {
        const admins = await tx.user.count({ where: { role: 'ADMIN' } });
        if (admins <= 1) throw new Blocked('LAST_ADMIN', 'You are the only admin. Add another admin first.');
      }

      if (user.role === 'PATIENT') {
        const profile = await tx.patientProfile.findUnique({ where: { userId }, select: { id: true } });
        if (profile) {
          const live = await tx.appointment.findMany({
            where: { patientId: profile.id, status: { in: ACTIVE_STATUSES }, appointmentDate: { gte: today } },
            select: { doctorId: true },
          });
          if (live.length > 0) throw new Blocked('ACTIVE_BOOKINGS', 'Cancel your upcoming tokens first.');
          const todays = await tx.appointment.findMany({ where: { patientId: profile.id, appointmentDate: today }, select: { doctorId: true } });
          todays.forEach((a) => touchedDoctors.add(a.doctorId));
        }
      }

      if (user.role === 'DOCTOR') {
        const doctor = await tx.doctorProfile.findUnique({ where: { userId }, select: { id: true } });
        if (doctor) {
          await lockDoctors(tx, [doctor.id]);
          const live = await tx.appointment.count({
            where: { doctorId: doctor.id, status: { in: ACTIVE_STATUSES }, appointmentDate: { gte: today } },
          });
          if (live > 0) throw new Blocked('ACTIVE_BOOKINGS', 'Patients are booked with you. Ask the front desk to cancel them first.');
          touchedDoctors.add(doctor.id);
        }
      }

      if (user.role === 'CLINIC') {
        const clinic = await tx.clinicProfile.findUnique({
          where: { userId },
          select: { id: true, doctors: { select: { doctorId: true } }, receptionists: { select: { userId: true } } },
        });
        if (clinic) {
          const doctorIds = clinic.doctors.map((d) => d.doctorId);
          await lockDoctors(tx, doctorIds);
          const live = await tx.appointment.count({
            where: { clinicId: clinic.id, status: { in: ACTIVE_STATUSES }, appointmentDate: { gte: today } },
          });
          if (live > 0) throw new Blocked('ACTIVE_BOOKINGS', 'Patients are booked at your clinic. Cancel them first.');
          doctorIds.forEach((id) => touchedDoctors.add(id));

          // Front-desk logins belong to the clinic: remove them too, or they'd be left without a clinic
          const staffIds = clinic.receptionists.map((r) => r.userId);
          if (staffIds.length > 0) {
            const staff = await tx.user.findMany({
              where: { id: { in: staffIds }, role: 'RECEPTIONIST' },
              select: { id: true, avatarUrl: true },
            });
            staffAvatars.push(...staff);
            await tx.user.deleteMany({ where: { id: { in: staff.map((s) => s.id) }, role: 'RECEPTIONIST' } });
          }
        }
      }

      // Cascades to the role profile, notifications, links and (patient/doctor) their visits
      await tx.user.delete({ where: { id: userId } });
    });

    // Old sessions (other phones, other tabs) stop working right away. One second ahead so a
    // token issued in this same second (tokens count whole seconds) is cut off too.
    const now = new Date(Date.now() + 1000);
    markPasswordChanged(userId, now);
    staffAvatars.forEach((s) => markPasswordChanged(s.id, now));
    await securityStore.clearLockout(DELETE_NAMESPACE, userId).catch(() => {});

    // Photos: only this account's own uploads, never anything else in the bucket
    for (const owner of [{ id: user.id, avatarUrl: user.avatarUrl }, ...staffAvatars]) {
      const key = ownAvatarKey(owner.avatarUrl, owner.id);
      if (key) await deleteFromR2(key);
    }

    for (const doctorId of touchedDoctors) {
      invalidateDoctorQueueCache(doctorId);
      publishQueueChange(doctorId);
    }

    res.json({ success: true, message: 'Account deleted.' });
  } catch (error: any) {
    if (error instanceof Blocked) {
      res.status(409).json({ success: false, code: error.code, message: error.message });
      return;
    }
    if (error instanceof SecurityStoreUnavailableError || error?.code === 'SECURITY_STORE_UNAVAILABLE') {
      res.setHeader('Retry-After', '15');
      res.status(503).json({ success: false, code: 'SECURITY_STORE_UNAVAILABLE', message: 'Please try again in a moment.' });
      return;
    }
    console.error('deleteOwnAccount error:', error);
    res.status(500).json({ success: false, message: 'Could not delete the account. Please try again.' });
  }
};
