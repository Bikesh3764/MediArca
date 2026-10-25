import { useEffect, useRef } from 'react';
import type { Appointment } from '../services/api';

/**
 * Alerts a waiting patient when they become next in line or are called in.
 * Shows an in-app toast, vibrates the phone, and (if the patient allowed it)
 * a system notification so it's noticed even when the tab is in the background.
 */
type Stage = 0 | 1 | 2; // 0 = waiting, 1 = next, 2 = go in

const getStage = (appt: Appointment): Stage => {
  const live: any = (appt as any).liveQueue;
  if (appt.status === 'IN_CONSULTATION' || live?.isYourTurn) return 2;
  if (appt.status === 'WAITING' && live?.isShiftActive && live?.patientsAway === 0) return 1;
  return 0;
};

/** Ask once for notification permission. Call from a tap (e.g. opening the QR scanner). */
export const requestTurnAlertPermission = (): void => {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch {
    /* unsupported browser */
  }
};

const showSystemNotification = (title: string, body: string) => {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body, icon: `${import.meta.env.BASE_URL}brand/mediarca-icon.png`, tag: 'mediarca-turn' });
    }
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
};

export function useTurnAlerts(
  appointments: Appointment[],
  onAlert: (title: string, message: string) => void
): void {
  const seen = useRef(new Map<string, Stage>());
  const alertRef = useRef(onAlert);
  useEffect(() => {
    alertRef.current = onAlert;
  }, [onAlert]);

  useEffect(() => {
    for (const appt of appointments) {
      const stage = getStage(appt);
      const prev = seen.current.get(appt.id);
      seen.current.set(appt.id, stage);
      // First sighting (page load) never alerts; only real changes do
      if (prev === undefined || stage <= prev) continue;

      const doctorName = (appt as any).doctor?.user?.fullName || 'the doctor';
      const title = stage === 2 ? 'Your turn' : "You're next";
      const message = stage === 2 ? `Please go in to see ${doctorName}.` : `${doctorName} will call you next.`;
      alertRef.current(title, message);
      showSystemNotification(title, message);
      try {
        navigator.vibrate?.(stage === 2 ? [300, 150, 300] : 200);
      } catch {
        /* vibration unsupported */
      }
    }
  }, [appointments]);
}
