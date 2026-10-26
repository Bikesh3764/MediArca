type AddressLike = { address?: string | null; city?: string | null; state?: string | null } | null | undefined;

/**
 * Joins a clinic's address, city and state without repeating parts that are
 * already written in the address ("…, Mumbai, MH" stays as is, not "…, Mumbai, MH, Mumbai, Maharashtra").
 */
export const formatClinicAddress = (clinic: AddressLike, options: { withState?: boolean } = {}): string => {
  if (!clinic) return '';
  const { withState = true } = options;
  const address = (clinic.address || '').trim();
  const lower = address.toLowerCase();
  const parts: string[] = address ? [address] : [];

  const city = clinic.city?.trim();
  if (city && !lower.includes(city.toLowerCase())) parts.push(city);

  const state = clinic.state?.trim();
  // A short code at the end ("MH", "KA") already names the state.
  const endsWithStateCode = /,\s*[A-Z]{2,3}$/.test(address);
  if (withState && state && !endsWithStateCode && !lower.includes(state.toLowerCase())) parts.push(state);

  return parts.join(', ');
};
