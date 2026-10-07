export type AppointmentStatus =
  | 'PENDING_APPROVAL'
  | 'WAITING'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED';

export type UserRole = 'PATIENT' | 'DOCTOR' | 'RECEPTIONIST' | 'CLINIC' | 'ADMIN';

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Centralized Appointment State Machine
 * Defines valid transitions and actor permissions across the application.
 */
export const canTransition = (
  fromStatus: string,
  toStatus: string,
  actorRole: UserRole
): TransitionResult => {
  const from = fromStatus.toUpperCase() as AppointmentStatus;
  const to = toStatus.toUpperCase() as AppointmentStatus;

  // Terminal states cannot transition to anything
  if (from === 'COMPLETED') {
    return { allowed: false, reason: 'Completed consultations are finalized and cannot be modified.' };
  }
  if (from === 'CANCELLED') {
    return { allowed: false, reason: 'Cancelled appointments cannot be updated or reactivated.' };
  }
  if (from === 'REJECTED') {
    return { allowed: false, reason: 'Rejected appointments cannot be updated or reactivated.' };
  }
  if (from === 'EXPIRED') {
    return { allowed: false, reason: 'Expired appointments cannot be updated or reactivated.' };
  }

  // Idempotent transitions (same state)
  if (from === to) {
    return { allowed: true };
  }

  switch (from) {
    case 'PENDING_APPROVAL':
      if (to === 'EXPIRED') {
        return { allowed: true };
      }
      if (to === 'WAITING') {
        if (['RECEPTIONIST', 'CLINIC', 'ADMIN'].includes(actorRole)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Only desk staff or clinic administration can approve booking requests.' };
      }
      if (to === 'REJECTED') {
        if (['RECEPTIONIST', 'CLINIC', 'ADMIN'].includes(actorRole)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Only desk staff or clinic administration can reject booking requests.' };
      }
      if (to === 'CANCELLED') {
        // Patient can cancel their pending request, as well as staff
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Invalid transition: Pending approval appointments cannot transition directly to '${to}'.`,
      };

    case 'WAITING':
      if (to === 'EXPIRED') {
        return { allowed: true };
      }
      if (to === 'IN_CONSULTATION') {
        if (['DOCTOR', 'RECEPTIONIST', 'CLINIC'].includes(actorRole)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Only practitioners or desk staff can call a patient into consultation.' };
      }
      if (to === 'COMPLETED') {
        return {
          allowed: false,
          reason: 'Patient must be called into consultation before the consultation can be completed. Direct transition from WAITING to COMPLETED is not permitted.',
        };
      }
      if (to === 'CANCELLED') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Invalid transition: Waiting appointments cannot transition to '${to}'.`,
      };

    case 'IN_CONSULTATION':
      if (to === 'COMPLETED') {
        if (['DOCTOR', 'RECEPTIONIST'].includes(actorRole)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Only the examining doctor or receptionist desk can complete a consultation.' };
      }
      if (to === 'WAITING') {
        // Doctor puts patient back on hold/waiting
        if (['DOCTOR', 'RECEPTIONIST'].includes(actorRole)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Only doctors or desk staff can return an in-progress consultation to waiting status.' };
      }
      if (to === 'CANCELLED') {
        if (['DOCTOR', 'ADMIN'].includes(actorRole)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'In-consultation visits can only be cancelled by the examining doctor or admin.' };
      }
      return {
        allowed: false,
        reason: `Invalid transition: Active consultations cannot transition to '${to}'.`,
      };

    default:
      return { allowed: false, reason: `Unknown appointment status '${from}'.` };
  }
};
