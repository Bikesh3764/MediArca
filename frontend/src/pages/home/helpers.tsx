
export const getClinicLocationDisplay = (clinic?: { address?: string; city?: string | null; state?: string | null } | null): string => {
  if (!clinic) return 'Clinical Facility';
  const addressParts: string[] = [];
  const addrLower = (clinic.address || '').toLowerCase();
  if (clinic.address) addressParts.push(clinic.address);
  if (clinic.city && !addrLower.includes(clinic.city.toLowerCase())) {
    addressParts.push(clinic.city);
  }
  if (clinic.state && !addrLower.includes(clinic.state.toLowerCase())) {
    addressParts.push(clinic.state);
  }
  return addressParts.join(', ') || 'Clinical Facility';
};
