import { formatClinicAddress } from '../../utils/address';

export const getClinicLocationDisplay = (clinic?: { address?: string; city?: string | null; state?: string | null } | null): string => {
  return formatClinicAddress(clinic) || 'Clinic';
};
