// Adds `shiftTime` ("9:00 AM – 1:00 PM") to every visit in an API reply, so the website and the
// app can show the shift's timing instead of just "Shift 1". A visit only stores the shift's
// name/id (`checkingWindow`, `slotId`); the times come from the clinic's or the doctor's shift list.
import type { NextFunction, Request, Response } from 'express';
import prisma from '../config/database';
import { type DoctorSlot, cleanSlotName, format12Hour, parseAffiliationSlots, parseDoctorSlots } from '../utils/scheduleUtils';

type Visit = { checkingWindow?: string | null; slotId?: string | null; doctorId?: string; clinicId?: string | null; doctor?: { id?: string } | null; shiftTime?: string };

const TTL_MS = 60_000;
const doctorCache = new Map<string, { at: number; slots: DoctorSlot[] }>();
const clinicCache = new Map<string, { at: number; slots: DoctorSlot[] | null }>();
const fresh = (at: number) => Date.now() - at < TTL_MS;

const MAX_DEPTH = 6;
const MAX_VISITS = 6000;

/** Visits in the reply: any object with a shift name and a doctor. */
function collect(node: unknown, out: Visit[], depth = 0) {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH || out.length >= MAX_VISITS) return;
  if (Array.isArray(node)) {
    for (const item of node) collect(item, out, depth + 1);
    return;
  }
  const v = node as Visit & Record<string, unknown>;
  if (typeof v.checkingWindow === 'string' && (v.doctorId || v.doctor?.id)) out.push(v);
  for (const key of Object.keys(v)) {
    const child = v[key];
    if (child && typeof child === 'object') collect(child, out, depth + 1);
  }
}

const t12 = (t: string) => format12Hour(t).replace(/^0(\d)/, '$1');
const rangeOf = (s?: { startTime?: string; endTime?: string } | null) =>
  s?.startTime && s?.endTime ? `${t12(s.startTime)} – ${t12(s.endTime)}` : null;

/** Old visits stored the times in the name ("09:00 AM - 01:00 PM"). */
const timesInName = (name: string) => {
  const m = name.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*(?:-|–|to)\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
  return m ? `${t12(m[1].toUpperCase().replace(/\s+/g, ' '))} – ${t12(m[2].toUpperCase().replace(/\s+/g, ' '))}` : null;
};

const pick = (v: Visit, slots: DoctorSlot[] | null | undefined) => {
  if (!slots?.length) return null;
  if (v.slotId) {
    const byId = slots.find((s) => s.id === v.slotId);
    if (byId) return byId;
  }
  const name = cleanSlotName(v.checkingWindow, '');
  return (name && slots.find((s, i) => cleanSlotName(s.name, `Shift ${i + 1}`) === name)) || null;
};

async function annotate(body: unknown) {
  const visits: Visit[] = [];
  collect(body, visits);
  if (!visits.length) return;

  const doctorIds = new Set<string>();
  const pairs = new Map<string, { clinicId: string; doctorId: string }>();
  for (const v of visits) {
    const doctorId = (v.doctorId || v.doctor?.id) as string;
    if (!doctorCache.get(doctorId) || !fresh(doctorCache.get(doctorId)!.at)) doctorIds.add(doctorId);
    if (v.clinicId) {
      const key = `${v.clinicId}|${doctorId}`;
      const c = clinicCache.get(key);
      if (!c || !fresh(c.at)) pairs.set(key, { clinicId: v.clinicId, doctorId });
    }
  }

  try {
    await loadSlots(doctorIds, pairs);
  } catch {
    // Database busy: fall back to times written in the shift's name
  }
  fill(visits);
}

async function loadSlots(doctorIds: Set<string>, pairs: Map<string, { clinicId: string; doctorId: string }>) {
  const now = Date.now();
  if (doctorIds.size) {
    const rows = await prisma.doctorProfile.findMany({
      where: { id: { in: [...doctorIds] } },
      select: { id: true, slots: true, checkingStartTime: true, checkingEndTime: true, maxDailyPatients: true },
    });
    for (const id of doctorIds) doctorCache.set(id, { at: now, slots: [] });
    for (const r of rows) doctorCache.set(r.id, { at: now, slots: parseDoctorSlots(r) });
  }
  if (pairs.size) {
    const rows = await prisma.clinicDoctor.findMany({
      where: { OR: [...pairs.values()] },
      select: { clinicId: true, doctorId: true, slots: true },
    });
    for (const key of pairs.keys()) clinicCache.set(key, { at: now, slots: null });
    for (const r of rows) clinicCache.set(`${r.clinicId}|${r.doctorId}`, { at: now, slots: parseAffiliationSlots(r.slots) });
  }
}

function fill(visits: Visit[]) {
  for (const v of visits) {
    if (v.shiftTime) continue;
    const doctorId = (v.doctorId || v.doctor?.id) as string;
    const clinicSlots = v.clinicId ? clinicCache.get(`${v.clinicId}|${doctorId}`)?.slots : null;
    const slot = pick(v, clinicSlots) || pick(v, doctorCache.get(doctorId)?.slots);
    const time = rangeOf(slot) || timesInName(v.checkingWindow || '');
    if (time) v.shiftTime = time;
  }
}

export function shiftTimes(_req: Request, res: Response, next: NextFunction) {
  const send = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (!body || typeof body !== 'object' || res.statusCode >= 400) return send(body);
    annotate(body).then(
      () => send(body),
      () => send(body) // Times are a nice-to-have; never fail a reply over them
    );
    return res;
  }) as Response['json'];
  next();
}
