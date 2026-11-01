// Small display rules for doctor and front desk queues. Same rules as the website's
// frontend/src/pages/Doctor/dashboard/helpers.tsx and Receptionist/desk/helpers.tsx — keep in step.

/** Hides reasons that say nothing ("Consultation", "Walk-in", the patient's own name). */
export const cleanVisitReason = (reason?: string | null, patientName?: string | null): string | null => {
  if (!reason) return null;
  const r = reason.trim();
  if (!r) return null;
  const normReason = r.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normName = (patientName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normName && (normName.includes(normReason) || normReason.includes(normName))) return null;
  const lower = r.toLowerCase();
  const empty = [
    'general consultation',
    'general medical consultation',
    'routine checkup',
    'consultation',
    'checkup',
    'general visit',
    'clinic walk-in consultation',
    'rapid walk-in consultation',
  ];
  if (
    lower.includes('concurrent') ||
    lower.includes('walkin') ||
    lower.includes('walk-in') ||
    lower.includes('verification') ||
    lower.includes('approval test') ||
    empty.includes(lower)
  ) {
    return null;
  }
  return r;
};

/** Whether a visit belongs to a shift (by id, or by start time / name in its checking window). */
export const visitMatchesSlot = (
  visit: { slotId?: string | null; checkingWindow?: string | null },
  slot: { id?: string; name?: string; startTime?: string }
): boolean => {
  if (visit.slotId && slot.id && visit.slotId === slot.id) return true;
  const windowText = (visit.checkingWindow || '').toLowerCase();
  if (!windowText) return false;
  if (slot.startTime && windowText.includes(slot.startTime.toLowerCase())) return true;
  if (slot.name && windowText.includes(slot.name.toLowerCase())) return true;
  return false;
};

/** "Walk-in · 34y" or "Family · 8y" for visits booked for someone else; null otherwise. */
export const visitTag = (visit: { isForOther?: boolean; reasonForVisit?: string | null; patientAge?: string | null }): string | null => {
  if (!visit.isForOther) return null;
  const kind = (visit.reasonForVisit || '').toLowerCase().includes('walk-in') ? 'Walk-in' : 'Family';
  return visit.patientAge ? `${kind} · ${visit.patientAge}y` : kind;
};
