import type { AppNotification } from '../../services/api';

/** Where a notification takes you when you tap it. */
export const getNotificationLink = (role: string | undefined, n: AppNotification): string | null => {
  const title = (n.title || '').toLowerCase();
  switch (role) {
    case 'PATIENT':
      return '/patient/appointments';
    case 'DOCTOR':
      if (/invite|request|joined|clinic/.test(title)) return '/doctor/dashboard?tab=affiliations';
      return '/doctor/dashboard';
    case 'CLINIC':
      if (title.includes('receptionist')) return '/clinic/dashboard?tab=receptionists';
      return '/clinic/dashboard?tab=doctors';
    case 'RECEPTIONIST':
      if (title.includes('request')) return '/receptionist/dashboard?tab=pending';
      return '/receptionist/dashboard?tab=queue';
    case 'ADMIN':
      if (n.type === 'CONTACT_INQUIRY' || title.startsWith('new message')) return '/admin?tab=messages';
      if (title.includes('clinic')) return '/admin?tab=clinics';
      if (title.includes('doctor')) return '/admin?tab=doctors';
      return '/admin';
    default:
      return null;
  }
};
