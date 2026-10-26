import { Appointment, getLocalDateString, cleanSlotName } from '../../../services/api';

export const getYesterdayDateString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
};
export const getCleanReason = (reason?: string | null, patientName?: string | null): string | null => {
  if (!reason) return null;
  const r = reason.trim();
  if (!r) return null;

  const normReason = r.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normName = (patientName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // If redundant with patient's name
  if (normName && (normName.includes(normReason) || normReason.includes(normName))) {
    return null;
  }

  const lower = r.toLowerCase();
  // If matches test noise, placeholders, or generic boilerplate
  if (
    lower.includes('concurrent') ||
    lower.includes('walkin') ||
    lower.includes('walk-in') ||
    lower.includes('verification') ||
    lower.includes('approval test') ||
    lower === 'general consultation' ||
    lower === 'general medical consultation' ||
    lower === 'routine checkup' ||
    lower === 'consultation' ||
    lower === 'checkup' ||
    lower === 'general visit' ||
    lower === 'clinic walk-in consultation' ||
    lower === 'rapid walk-in consultation'
  ) {
    return null;
  }
  return r;
};
export const matchesSlot = (appt: Appointment, slotId: string, slotObj?: any): boolean => {
  if (slotId === 'all') return true;
  if (appt.slotId && appt.slotId === slotId) return true;
  if (slotObj) {
    if (slotObj.id && appt.slotId && appt.slotId === slotObj.id) return true;
    if (slotObj.startTime && appt.checkingWindow?.includes(slotObj.startTime)) return true;
    if (slotObj.name && appt.checkingWindow?.toLowerCase().includes(slotObj.name.toLowerCase())) return true;
    if (slotObj.shiftName && appt.checkingWindow?.toLowerCase().includes(slotObj.shiftName.toLowerCase())) return true;
    if (slotObj.name) {
      const match = slotObj.name.match(/(Shift\s*\d+)/i);
      if (match && appt.checkingWindow?.toLowerCase().includes(match[1].toLowerCase())) return true;
    }
  }
  return false;
};
export const getSlotShortLabel = (appt: Appointment, slots: any[]): string => {
  if (appt.slotId) {
    const matched = slots.find((s) => s.id === appt.slotId);
    if (matched) {
      return cleanSlotName(matched.name, `Shift ${slots.indexOf(matched) + 1}`);
    }
  }
  if (appt.checkingWindow) {
    const matched = slots.find((s) => s.startTime && appt.checkingWindow?.includes(s.startTime));
    if (matched) {
      return cleanSlotName(matched.name, `Shift ${slots.indexOf(matched) + 1}`);
    }
    return cleanSlotName(appt.checkingWindow);
  }
  return 'Shift';
};
