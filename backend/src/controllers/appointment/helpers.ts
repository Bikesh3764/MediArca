import { format12Hour, calculateSlotMetrics } from '../../utils/scheduleUtils';
import prisma from '../../config/database';

/**
 * Token an unconfirmed request will most likely get: the next number after the highest
 * token already given in that doctor's shift (any status), which is exactly what the desk
 * assigns on approval. Booking, the Appointments page and the visit page all use this.
 */
export const estimateNextToken = async (
  doctorId: string,
  appointmentDate: string,
  clinicId?: string | null,
  slotId?: string | null,
  slotName?: string | null
): Promise<number> => {
  const slotFilter = slotId
    ? { OR: [{ slotId }, ...(slotName ? [{ checkingWindow: slotName }] : [])] }
    : slotName
    ? { checkingWindow: slotName }
    : {};
  const highest = await prisma.appointment.findFirst({
    where: {
      doctorId,
      appointmentDate,
      ...(clinicId ? { clinicId } : {}),
      queueNumber: { gt: 0 },
      ...slotFilter,
    },
    orderBy: { queueNumber: 'desc' },
    select: { queueNumber: true },
  });
  return Math.max(1, (highest?.queueNumber || 0) + 1);
};

// Helper to calculate estimated time given start time "09:00" and offset minutes (retained for backward compatibility)
export const calculateEstimatedTime = (startTime24: string, offsetMinutes: number): string => {
  if (!startTime24) startTime24 = '09:00';
  const { durationMinutes } = calculateSlotMetrics(startTime24, '23:59', 10);
  const startParts = startTime24.replace(/\s*(AM|PM)/i, '').split(':');
  let startHour = parseInt(startParts[0], 10) || 9;
  if (startTime24.toUpperCase().includes('PM') && startHour < 12) startHour += 12;
  if (startTime24.toUpperCase().includes('AM') && startHour === 12) startHour = 0;
  const startTotalMinutes = startHour * 60 + parseInt(startParts[1] || '0', 10);
  const totalMinutes = startTotalMinutes + offsetMinutes;
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return format12Hour(`${hours24}:${minutes.toString().padStart(2, '0')}`);
};

/**
 * Resolves active receptionist contact details for an appointment at a clinic
 */
export const resolveReceptionistContact = (
  clinic: any,
  doctorId?: string,
  doctor?: any
): { phone: string | null; name: string | null } => {
  if (clinic?.receptionists && Array.isArray(clinic.receptionists) && clinic.receptionists.length > 0) {
    if (doctorId) {
      const assigned = clinic.receptionists.find((r: any) =>
        r.doctors?.some((d: any) => d.doctorId === doctorId && (d.status === 'ACTIVE' || !d.status))
      );
      if (assigned) {
        const phone = assigned.phone || assigned.user?.phone || null;
        const name = assigned.user?.fullName || assigned.fullName || null;
        if (phone || name) return { phone, name };
      }
    }
    // Check for general receptionist covering this clinic without doctor restriction
    const general = clinic.receptionists.find((r: any) => !r.doctors || r.doctors.length === 0);
    if (general) {
      const phone = general.phone || general.user?.phone || null;
      const name = general.user?.fullName || general.fullName || null;
      if (phone || name) return { phone, name };
    }
  }

  // Fallback to doctor's assigned receptionists matching this clinic
  if (doctor?.receptionists && Array.isArray(doctor.receptionists) && doctor.receptionists.length > 0) {
    const docRec = doctor.receptionists.find(
      (dr: any) =>
        (!dr.receptionist?.clinicId || !clinic?.id || dr.receptionist.clinicId === clinic.id) &&
        (dr.receptionist?.phone || dr.receptionist?.user?.phone || dr.receptionist?.user?.fullName)
    );
    if (docRec?.receptionist) {
      return {
        phone: docRec.receptionist.phone || docRec.receptionist.user?.phone || null,
        name: docRec.receptionist.user?.fullName || null,
      };
    }
  }

  // Strictly return null if no actual receptionist is assigned; never substitute clinic phone
  return { phone: null, name: null };
};
