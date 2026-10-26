/**
 * Maximum lengths for free-text fields. Stops someone filling the database
 * (and staff screens and notifications) with huge text.
 */
export const LIMITS = {
  name: 100,
  email: 254,
  phone: 20,
  password: 128,
  subject: 150,
  shortText: 300,
  reason: 500,
  symptoms: 1000,
  message: 3000,
  bio: 2000,
  notes: 10000,
} as const;

const LABELS: Record<string, string> = {
  fullName: 'Name',
  patientName: 'Patient name',
  email: 'Email',
  phone: 'Phone',
  patientPhone: 'Phone',
  password: 'Password',
  subject: 'Subject',
  message: 'Message',
  reasonForVisit: 'Reason for visit',
  symptoms: 'Symptoms',
  clinicalNotes: 'Notes',
  diagnosis: 'Diagnosis',
  advice: 'Advice',
  bio: 'About',
  address: 'Address',
  clinicName: 'Clinic name',
};

/**
 * Returns a user-facing error for the first field that is too long, or null.
 * Non-string values are ignored here (type checks happen in the controller).
 */
export const findTooLong = (fields: Record<string, [unknown, number]>): string | null => {
  for (const [key, [value, max]] of Object.entries(fields)) {
    if (typeof value === 'string' && value.length > max) {
      return `${LABELS[key] || key} is too long (max ${max} characters).`;
    }
  }
  return null;
};

/**
 * Profile forms send many optional text fields. Names stay short; every other
 * text value (bio, address, history notes...) is capped at `otherMax`.
 */
export const findTooLongInBody = (body: unknown, otherMax: number = LIMITS.bio): string | null => {
  if (!body || typeof body !== 'object') return null;
  const shortKeys: Record<string, number> = {
    fullName: LIMITS.name,
    clinicName: 150,
    email: LIMITS.email,
    phone: LIMITS.phone,
    city: LIMITS.name,
    state: LIMITS.name,
    pincode: 12,
  };
  // Structured fields (schedules, images) are validated by their own handlers
  const skip = new Set(['slots', 'workingDays', 'leaves', 'avatarUrl', 'clinicSlots', 'schedule']);
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (skip.has(key)) continue;
    const max = shortKeys[key] ?? otherMax;
    if (typeof value === 'string' && value.length > max) {
      return `${LABELS[key] || key} is too long (max ${max} characters).`;
    }
    if (Array.isArray(value) && value.some((v) => typeof v === 'string' && v.length > otherMax)) {
      return `${LABELS[key] || key} has an entry that is too long.`;
    }
  }
  return null;
};
