// Push notifications (Expo push service). Only in our own build: Expo Go on Android has no push.
// The server pushes every in-app notification ("It's your turn", "You're next", confirmed…).
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '@mediarca/shared/api';
import { inOwnBuild } from './nativeBuild';
import { appStorage } from './storage';

type NotificationsModule = typeof import('expo-notifications');

const TOKEN_KEY = 'mediarca_push_token';
let mod: NotificationsModule | null = null;

// Loaded only when supported, so Expo Go and the web preview never touch the native module
const notifications = (): NotificationsModule | null => {
  if (!inOwnBuild) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (!mod) mod = require('expo-notifications') as NotificationsModule;
  return mod;
};

export interface PushTap {
  appointmentId?: string;
  type?: string;
}

/** Show alerts while the app is open, and report taps (also the one that opened the app). */
export const setupPush = (onTap: (data: PushTap) => void): (() => void) => {
  const N = notifications();
  if (!N) return () => {};
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
  const handle = (response: { actionIdentifier: string; notification: { request: { content: { data?: unknown } } } } | null) => {
    if (!response || response.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return;
    const data = (response.notification.request.content.data || {}) as PushTap;
    onTap(data);
    N.clearLastNotificationResponse();
  };
  const sub = N.addNotificationResponseReceivedListener(handle);
  N.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => sub.remove();
};

/** Asks once for permission and saves this phone with the server. Quiet on failure. */
export const registerPush = async (): Promise<void> => {
  const N = notifications();
  if (!N) return;
  try {
    if (Platform.OS === 'android') {
      // Must exist before asking, or Android 13+ never shows the prompt
      await N.setNotificationChannelAsync('default', {
        name: 'Queue alerts',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0066cc',
      });
    }
    let { status } = await N.getPermissionsAsync();
    if (status !== 'granted') status = (await N.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return; // Not linked to EAS yet (see docs/mobile-roadmap.md)
    const { data: token } = await N.getExpoPushTokenAsync({ projectId });
    await api.registerPushToken(token, Platform.OS);
    appStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.warn('Push setup failed', error);
  }
};

/** Stops alerts for this account on this phone. Call before the sign-in token is cleared. */
export const unregisterPush = (): void => {
  const token = appStorage.getItem(TOKEN_KEY);
  if (!token) return;
  appStorage.removeItem(TOKEN_KEY);
  api.unregisterPushToken(token).catch(() => {});
};
