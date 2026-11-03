// Drops a doctor's "back at" time from API replies once that time has passed (FIX-069).
// A doctor who stepped out at night with "Back 12:41 AM" and never came back kept showing
// "Back 12:41 AM" all the next day. The time is stored as text ("12:41 AM" or "in 15 mins"),
// so it is read against the moment the doctor stepped out (`cabinStatusUpdatedAt`).
// With the time gone, screens show "Stepped Out" / "Back soon" instead.
import type { NextFunction, Request, Response } from 'express';
import prisma from '../config/database';
import { getIndianTimeMinutes } from '../utils/scheduleUtils';

type CabinInfo = {
  id?: unknown;
  cabinStatus?: unknown;
  expectedReturnTime?: unknown;
  cabinStatusUpdatedAt?: unknown;
};

const MAX_DEPTH = 6;
const MAX_ITEMS = 2000;
const DAY_MINS = 24 * 60;
/** A time we can't read is dropped after this long. */
const UNREADABLE_TTL_MINS = 8 * 60;

function collect(node: unknown, out: CabinInfo[], depth = 0) {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH || out.length >= MAX_ITEMS) return;
  if (node instanceof Date) return;
  if (Array.isArray(node)) {
    for (const item of node) collect(item, out, depth + 1);
    return;
  }
  const v = node as CabinInfo & Record<string, unknown>;
  if (typeof v.expectedReturnTime === 'string' && v.expectedReturnTime.trim()) out.push(v);
  for (const key of Object.keys(v)) {
    const child = v[key];
    if (child && typeof child === 'object') collect(child, out, depth + 1);
  }
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * When the doctor said they would be back, as a Date. "in 15 mins" counts from the moment
 * they stepped out; "12:41 AM" (India time) is the first 12:41 AM after that moment.
 */
export function returnDeadline(text: string, steppedOutAt: Date): Date | null {
  const rel = text.match(/(\d{1,3})\s*(?:min|mins|minute|minutes)\b/i);
  if (rel && !/\d{1,2}:\d{2}/.test(text)) {
    return new Date(steppedOutAt.getTime() + parseInt(rel[1], 10) * 60_000);
  }
  const m = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  const backMins = h * 60 + min;
  const outMins = getIndianTimeMinutes(steppedOutAt);
  // A few minutes "earlier" than stepping out is a typo for now, not tomorrow
  let ahead = backMins - outMins;
  if (ahead < -10) ahead += DAY_MINS;
  return new Date(steppedOutAt.getTime() + Math.max(0, ahead) * 60_000);
}

/** Is this "back at" time over (or meaningless because the doctor is no longer out)? */
export function isReturnTimeOver(item: CabinInfo, now: Date = new Date()): boolean {
  if (typeof item.cabinStatus === 'string' && item.cabinStatus !== 'STEPPED_OUT') return true;
  const since = toDate(item.cabinStatusUpdatedAt);
  if (!since) return false;
  const deadline = returnDeadline(String(item.expectedReturnTime), since);
  if (deadline) return now.getTime() > deadline.getTime();
  return now.getTime() - since.getTime() > UNREADABLE_TTL_MINS * 60_000;
}

async function clean(body: unknown) {
  const items: CabinInfo[] = [];
  collect(body, items);
  if (!items.length) return;

  // Replies that carry the time but not when it was set: look that up by doctor id
  const lookedUp = new Map<CabinInfo, Date>();
  const missing = items.filter((i) => !toDate(i.cabinStatusUpdatedAt) && typeof i.id === 'string');
  if (missing.length) {
    try {
      const rows = await prisma.doctorProfile.findMany({
        where: { id: { in: [...new Set(missing.map((i) => i.id as string))] } },
        select: { id: true, cabinStatusUpdatedAt: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r.cabinStatusUpdatedAt]));
      for (const i of missing) {
        const at = byId.get(i.id as string);
        if (at) lookedUp.set(i, at);
      }
    } catch {
      // Database busy: leave those times as they are
    }
  }

  const now = new Date();
  for (const i of items) {
    const at = lookedUp.get(i);
    const check = at ? { ...i, cabinStatusUpdatedAt: at } : i;
    if (isReturnTimeOver(check, now)) i.expectedReturnTime = null;
  }
}

export function staleReturnTimes(_req: Request, res: Response, next: NextFunction) {
  const send = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (!body || typeof body !== 'object' || res.statusCode >= 400) return send(body);
    clean(body).then(
      () => send(body),
      () => send(body) // Never fail a reply over this
    );
    return res;
  }) as Response['json'];
  next();
}
