import { format12Hour, calculateSlotMetrics } from '../../utils/scheduleUtils';

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
