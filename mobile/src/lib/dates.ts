import { formatDisplayDate, getLocalDateString } from '@mediarca/shared/api';

// Midday IST in UTC, so the day is right whatever the phone's time zone.
/** The next `count` days from today (IST), labelled "Today", "Tomorrow", "Tue, 3 Nov". */
export const nextDays = (count: number, from = 0): { value: string; label: string }[] => {
  const today = getLocalDateString();
  const [y, m, d] = today.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const value = getLocalDateString(new Date(Date.UTC(y, m - 1, d + from + i, 6, 30)));
    return { value, label: formatDisplayDate(value) };
  });
};

export const isToday = (ymd?: string | null) => ymd === getLocalDateString();

/** Yesterday's date (IST); checked-in patients from last night can still be called before 6 AM. */
export const yesterday = () => {
  const [y, m, d] = getLocalDateString().split('-').map(Number);
  return getLocalDateString(new Date(Date.UTC(y, m - 1, d - 1, 6, 30)));
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Today in IST as "Sunday, 1 November" (shown above the title on home screens). */
export const todayLong = () => {
  const [y, m, d] = getLocalDateString().split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[day]}, ${d} ${MONTHS[m - 1]}`;
};
