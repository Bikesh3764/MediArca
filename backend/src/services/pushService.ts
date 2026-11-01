import prisma from '../config/database';

/*
 * Phone push notifications through Expo's push service (the app sends us its Expo push token).
 * Every in-app notification is also pushed to the person's phones. Sending never blocks or
 * fails the request that caused it; tokens Expo reports as gone are deleted.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/;
const MAX_TOKENS_PER_USER = 10;

export const isExpoPushToken = (token: unknown): token is string => typeof token === 'string' && TOKEN_PATTERN.test(token.trim());

export interface PushData {
  appointmentId?: string;
  type?: string;
}

/** Saves this phone's push token for the signed-in person (moves it if another account had it). */
export const savePushToken = async (userId: string, token: string, platform: string): Promise<void> => {
  const clean = token.trim();
  const safePlatform = platform === 'ios' ? 'ios' : 'android';
  await prisma.pushToken.upsert({
    where: { token: clean },
    create: { userId, token: clean, platform: safePlatform },
    update: { userId, platform: safePlatform },
  });
  // Keep only the newest few per person
  const extra = await prisma.pushToken.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    skip: MAX_TOKENS_PER_USER,
    select: { id: true },
  });
  if (extra.length) await prisma.pushToken.deleteMany({ where: { id: { in: extra.map((t) => t.id) } } });
};

/** Removes the token on sign-out, only if it belongs to this person. */
export const removePushToken = async (userId: string, token: string): Promise<void> => {
  await prisma.pushToken.deleteMany({ where: { userId, token: token.trim() } });
};

export const sendPushToUser = async (userId: string, title: string, body: string, data: PushData = {}): Promise<void> => {
  if (process.env.PUSH_DISABLED === 'true') return;
  const tokens = await prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    sound: 'default',
    priority: 'high',
    channelId: 'default',
    data: { ...data },
  }));

  const headers: Record<string, string> = {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate',
    'content-type': 'application/json',
  };
  if (process.env.EXPO_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.warn(`Push send failed (${res.status})`);
    return;
  }
  const json: any = await res.json().catch(() => null);
  const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
  const gone = tickets
    .map((ticket, i) => (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered' ? messages[i]?.to : null))
    .filter((t): t is string => Boolean(t));
  if (gone.length) await prisma.pushToken.deleteMany({ where: { token: { in: gone } } });
};
