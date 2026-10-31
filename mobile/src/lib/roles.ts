import type { Role } from '@/context/AuthContext';

export const ROLE_LABEL: Record<Role, string> = {
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  CLINIC: 'Clinic',
  RECEPTIONIST: 'Receptionist',
  ADMIN: 'Admin',
};

/** Accounts people create themselves. Receptionists are added by their clinic. */
export const SIGNUP_ROLES: Role[] = ['PATIENT', 'DOCTOR', 'CLINIC'];

export const parseRole = (raw?: string | string[]): Role => {
  const value = String(Array.isArray(raw) ? raw[0] : raw || '').toUpperCase();
  // Admin is website-only, so the app never offers it
  return value in ROLE_LABEL && value !== 'ADMIN' ? (value as Role) : 'PATIENT';
};
