/**
 * End-to-end behaviour tests against a real PostgreSQL database.
 *
 * Unlike verify-fixes.ts (mostly unit checks and source-text checks), these drive
 * the real HTTP API through a full visit and assert on what actually happened:
 *   patient books → receptionist approves → receptionist checks in → doctor calls → doctor completes
 * plus the live update stream, demo-account lock, sign-out after password change,
 * the public discovery cache and the NULL-safe queue-number constraint.
 *
 * Needs DATABASE_URL pointing at a throwaway database with migrations applied
 * (CI does this). It creates its own rows with a unique prefix and deletes them after.
 *
 *   npm run test:flow
 */
process.env.MEDIARCA_TEST_SUITE = 'true';
process.env.DEMO_ACCOUNT_LOCK = 'true';

import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../src/server';
import prisma from '../src/config/database';
import { getJwtSecret } from '../src/middleware/authMiddleware';
import { getLocalDateString, getIndianTimeMinutes, MAX_BOOKING_DAYS_AHEAD } from '../src/utils/scheduleUtils';
import { getCheckInWindow } from '../src/controllers/appointment/checkIn';
import { expireStalePendingAppointments } from '../src/utils/maintenance';

let passed = 0;
let failed = 0;
const check = (condition: unknown, label: string, detail?: unknown) => {
  if (condition) {
    passed += 1;
    console.log(`✅ PASS: ${label}`);
  } else {
    failed += 1;
    console.log(`❌ FAIL: ${label}`, detail !== undefined ? JSON.stringify(detail).slice(0, 400) : '');
  }
};

const RUN = `flow${Date.now().toString(36)}`;
const email = (who: string) => `${who}.${RUN}@flowtest.mediarca.dev`;

const sign = (user: { id: string; email: string; role: string; fullName: string }, iatOffsetSeconds = 0) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.fullName, iat: Math.floor(Date.now() / 1000) + iatOffsetSeconds },
    getJwtSecret(),
    { expiresIn: '1h' }
  );

let baseUrl = '';
const call = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json, headers: res.headers };
};

/** Opens the live stream and records event names until closed. */
const openLiveStream = async (token: string) => {
  const events: string[] = [];
  const controller = new AbortController();
  const res = await fetch(`${baseUrl}/api/events`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal,
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  (async () => {
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        for (const m of buffer.matchAll(/event: (\w+)/g)) events.push(m[1]);
        buffer = buffer.slice(buffer.lastIndexOf('\n\n') + 2);
      }
    } catch {
      /* aborted */
    }
  })();
  return { status: res.status, events, close: () => controller.abort() };
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/** A shift running from 2h before to 2h after "now" (IST), kept inside today. */
async function currentShift() {
  // Within 3 minutes of IST midnight the shift would end almost immediately: wait for the new day
  if (getIndianTimeMinutes(new Date()) >= 24 * 60 - 3) {
    while (getIndianTimeMinutes(new Date()) >= 24 * 60 - 3) await wait(5000);
  }
  const now = getIndianTimeMinutes(new Date());
  const start = Math.max(0, now - 120);
  const end = Math.min(24 * 60 - 1, now + 120);
  return [{ id: 'slot_all_day', name: 'Test Shift', startTime: hhmm(start), endTime: hhmm(end), maxPatients: 200, avgConsultationMinutes: 5 }];
}

async function seed() {
  const hash = await bcrypt.hash('Temp-Pass-123', 4);
  const allDaySlot = await currentShift();
  const today = getLocalDateString();

  const clinicUser = await prisma.user.create({
    data: { email: email('clinic'), passwordHash: hash, fullName: `Flow Clinic ${RUN}`, role: 'CLINIC', phone: '+91 9800000001' },
  });
  const clinic = await prisma.clinicProfile.create({
    data: { userId: clinicUser.id, clinicName: `Flow Clinic ${RUN}`, address: '1 Test Road', city: 'Pune', state: 'Maharashtra', isVerified: true, verificationStatus: 'VERIFIED', checkinCode: '482913' },
  });

  const doctorUser = await prisma.user.create({
    data: { email: email('doctor'), passwordHash: hash, fullName: `Dr Flow ${RUN}`, role: 'DOCTOR', phone: '+91 9800000002' },
  });
  const doctor = await prisma.doctorProfile.create({
    data: {
      userId: doctorUser.id,
      specialty: 'General Physician',
      qualifications: 'MBBS',
      consultationFee: 300,
      isVerified: true,
      verificationStatus: 'VERIFIED',
      slots: JSON.stringify(allDaySlot),
      workingDays: JSON.stringify(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']),
      cabinStatus: 'IN_CABIN',
    },
  });
  await prisma.clinicDoctor.create({
    data: { clinicId: clinic.id, doctorId: doctor.id, status: 'ACTIVE', consultationFee: 300, slots: JSON.stringify(allDaySlot), workingDays: JSON.stringify(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']) },
  });

  const recUser = await prisma.user.create({
    data: { email: email('desk'), passwordHash: hash, fullName: `Desk ${RUN}`, role: 'RECEPTIONIST', phone: '+91 9800000003', mustChangePassword: true },
  });
  const receptionist = await prisma.receptionistProfile.create({
    data: { userId: recUser.id, clinicId: clinic.id, status: 'ACTIVE', phone: '+91 9800000003' },
  });
  await prisma.doctorReceptionist.create({ data: { doctorId: doctor.id, receptionistId: receptionist.id, status: 'ACTIVE' } });

  const patientUser = await prisma.user.create({
    data: { email: email('patient'), passwordHash: hash, fullName: `Patient ${RUN}`, role: 'PATIENT', phone: '+91 9800000004' },
  });
  await prisma.patientProfile.create({ data: { userId: patientUser.id, dateOfBirth: '1990-01-01', gender: 'Female' } });

  return { today, clinic, clinicUser, doctor, doctorUser, recUser, patientUser };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: `.${RUN}@flowtest.mediarca.dev` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const doctors = await prisma.doctorProfile.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await prisma.appointment.deleteMany({ where: { doctorId: { in: doctors.map((d) => d.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  // Walk-in records the tests created (synthetic emails, named after this run)
  await prisma.user.deleteMany({ where: { email: { endsWith: '@mediarca.local' }, fullName: { contains: RUN } } });
  await prisma.contactMessage.deleteMany({ where: { email: email('contact') } });
}

/**
 * FIX-052: bugs found in the 27 Oct bug hunt (docs/audits/2026-10-27-bug-hunt.md).
 * Uses its own clinics, doctors and patients so it can't disturb the main visit flow above.
 */
async function bugHuntChecks() {
  const hash = await bcrypt.hash('Temp-Pass-123', 4);
  const days = JSON.stringify(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
  const now = getIndianTimeMinutes(new Date());
  const live = { id: 'bh_live', name: 'Live Shift', startTime: hhmm(Math.max(0, now - 60)), endTime: hhmm(Math.min(24 * 60 - 1, now + 120)), maxPatients: 50, avgConsultationMinutes: 5 };
  const dayOffset = (n: number) => getLocalDateString(new Date(Date.now() + n * 86400000));
  const today = getLocalDateString();
  const tomorrow = dayOffset(1);
  let n = 0;
  const user = (who: string, role: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { email: email(`bh${++n}${who}`), passwordHash: hash, fullName: `${who} ${RUN} ${n}`, role, phone: '+91 9800000001', ...extra } });
  const clinicWithDesk = async (tag: string) => {
    const cu = await user(`clinic${tag}`, 'CLINIC');
    const clinic = await prisma.clinicProfile.create({ data: { userId: cu.id, clinicName: `BH ${tag} ${RUN}`, address: 'x', city: 'Pune', state: 'Maharashtra', isVerified: true, verificationStatus: 'VERIFIED', checkinCode: `bh-${tag}-${RUN}` } });
    const ru = await user(`desk${tag}`, 'RECEPTIONIST');
    const rec = await prisma.receptionistProfile.create({ data: { userId: ru.id, clinicId: clinic.id, status: 'ACTIVE', phone: '+91 9800000003' } });
    return { cu, clinic, ru, rec, clinicToken: sign(cu), deskToken: sign(ru) };
  };
  const doctorWith = async (tag: string, slots: any[]) => {
    const du = await user(`doc${tag}`, 'DOCTOR');
    const doctor = await prisma.doctorProfile.create({ data: { userId: du.id, specialty: 'General Physician', qualifications: 'MBBS', consultationFee: 300, isVerified: true, verificationStatus: 'VERIFIED', slots: JSON.stringify(slots), workingDays: days, cabinStatus: 'IN_CABIN' } });
    return { du, doctor, token: sign(du) };
  };
  const join = async (c: any, d: any, slots?: any[]) => {
    await prisma.clinicDoctor.create({ data: { clinicId: c.clinic.id, doctorId: d.doctor.id, status: 'ACTIVE', consultationFee: 300, slots: slots ? JSON.stringify(slots) : null, workingDays: days } });
    await prisma.doctorReceptionist.create({ data: { doctorId: d.doctor.id, receptionistId: c.rec.id, status: 'ACTIVE' } });
  };
  const patient = async (tag: string) => {
    const pu = await user(`pat${tag}`, 'PATIENT');
    await prisma.patientProfile.create({ data: { userId: pu.id, dateOfBirth: '1990-01-01', gender: 'Female' } });
    return { pu, token: sign(pu) };
  };

  const A = await clinicWithDesk('A');
  const D = await doctorWith('A', [live]);
  await join(A, D, [live]);
  const bookAt = (t: string, extra: Record<string, unknown> = {}) =>
    call('POST', '/api/appointments/book', t, { doctorId: D.doctor.id, clinicId: A.clinic.id, appointmentDate: today, slotId: live.id, ...extra });

  // Desk can't confirm an unpaid request through the status button
  const P1 = await patient('1');
  const pend = await bookAt(P1.token);
  const viaStatus = await call('PATCH', `/api/receptionist/appointments/${pend.json?.data?.id}/status`, A.deskToken, { status: 'WAITING' });
  check(viaStatus.status === 400, 'FIX-052: desk "status=WAITING" on a request is refused (Approve gives the token)', viaStatus);

  // Desk walk-in: the doctor gets no notification
  const before = await prisma.notification.count({ where: { userId: D.du.id } });
  const walk = await call('POST', '/api/receptionist/book-walkin', A.deskToken, { doctorId: D.doctor.id, patientName: `Walk ${RUN}`, patientPhone: '9811100001', slotId: live.id });
  await wait(300);
  check(walk.status === 201 && (await prisma.notification.count({ where: { userId: D.du.id } })) === before, 'FIX-052: desk walk-in sends the doctor no notification', walk.status);

  // Doctor-made walk-in: "token booked" goes to the patient record, not the doctor
  const docBook = await call('POST', '/api/appointments/book', D.token, { clinicId: A.clinic.id, appointmentDate: today, slotId: live.id, patientName: `DocWalk ${RUN}`, patientPhone: '9811100002' });
  await wait(300);
  const docNotes = await prisma.notification.count({ where: { userId: D.du.id } });
  const walkUserNotes = await prisma.notification.count({ where: { user: { fullName: `DocWalk ${RUN}` }, title: 'Token booked' } });
  check(docBook.status === 201 && docNotes === before && walkUserNotes === 1, 'FIX-052: doctor walk-in token notice goes to the patient, not the doctor', [docBook.status, docNotes - before, walkUserNotes]);

  // Estimated token on the Appointments page matches the token the desk then gives
  const P2 = await patient('2');
  const pend2 = await bookAt(P2.token);
  const list = await call('GET', '/api/appointments/patient?status=active', P2.token);
  const shown = (list.json?.data || []).find((a: any) => a.id === pend2.json?.data?.id)?.estimatedQueueNumber;
  const approved = await call('POST', `/api/receptionist/appointments/${pend2.json?.data?.id}/approve`, A.deskToken, {});
  check(approved.status === 200 && shown === approved.json?.data?.queueNumber && pend2.json?.data?.estimatedQueueNumber === shown, 'FIX-052: estimated token (booking, Appointments page) equals the token given on approval', [pend2.json?.data?.estimatedQueueNumber, shown, approved.json?.data?.queueNumber]);

  // Patient can't move a confirmed token by API
  const moved = await call('POST', `/api/appointments/${pend2.json?.data?.id}/reschedule`, P2.token, { newDate: tomorrow, newSlotId: live.id });
  check(moved.status === 403, 'FIX-052: patient cannot move a confirmed token themselves', moved);

  // Patient cancel: desk notification carries the patient's name
  await call('PATCH', `/api/appointments/${pend2.json?.data?.id}/cancel`, P2.token);
  await wait(300);
  const cancelNote = await prisma.notification.findFirst({ where: { userId: A.ru.id, title: 'Booking cancelled' }, orderBy: { createdAt: 'desc' } });
  check(Boolean(cancelNote?.message?.startsWith(P2.pu.fullName)), 'FIX-052: desk "booking cancelled" notice names the patient', cancelNote?.message);

  // History: declined requests show in Past; missed visits get closed and show there too
  const prof = await prisma.patientProfile.findUnique({ where: { userId: P1.pu.id } });
  const missed = await prisma.appointment.create({ data: { patientId: prof!.id, doctorId: D.doctor.id, clinicId: A.clinic.id, appointmentDate: dayOffset(-3), queueNumber: 7, slotId: live.id, checkingWindow: live.name, estimatedTime: '10:00 AM', status: 'WAITING', paymentStatus: 'PAID' } });
  const declined = await prisma.appointment.create({ data: { patientId: prof!.id, doctorId: D.doctor.id, clinicId: A.clinic.id, appointmentDate: dayOffset(-2), queueNumber: -9, slotId: live.id, checkingWindow: live.name, estimatedTime: '10:00 AM', status: 'REJECTED', paymentStatus: 'FAILED' } });
  await expireStalePendingAppointments(true);
  const missedAfter = await prisma.appointment.findUnique({ where: { id: missed.id } });
  const past = await call('GET', '/api/appointments/patient?status=past&limit=50', P1.token);
  const pastIds = (past.json?.data || []).map((a: any) => a.id);
  check(missedAfter?.status === 'EXPIRED' && pastIds.includes(missed.id), 'FIX-052: a missed visit from an earlier day is closed and shows in Past', [missedAfter?.status, pastIds.includes(missed.id)]);
  check(pastIds.includes(declined.id), 'FIX-052: a declined request shows in Past');

  // Bad input: clear 400s, no crashes, no stored junk
  const spaced = await bookAt(P1.token, { appointmentDate: `${tomorrow} ` });
  check(spaced.status === 400, 'FIX-052: a date with a trailing space is refused', spaced.status);
  const badMinExp = await call('GET', '/api/doctors?minExp=abc');
  const badPage = await call('GET', '/api/appointments/patient?status=past&page=abc', P1.token);
  const twice = await call('GET', `/api/consultations/queue?clinicId=${A.clinic.id}&clinicId=x`, D.token);
  check(badMinExp.status === 200 && badPage.status === 200 && twice.status === 200, 'FIX-052: bad or repeated query values no longer crash (500)', [badMinExp.status, badPage.status, twice.status]);
  const longBack = await call('PUT', '/api/doctors/cabin-status', D.token, { status: 'STEPPED_OUT', expectedReturnTime: 'x'.repeat(500) });
  const longLeave = await call('POST', '/api/doctors/me/leaves', D.token, { type: 'DATE_RANGE', startDate: dayOffset(40), endDate: dayOffset(40), reason: 'x'.repeat(5000) });
  check(longBack.status === 400 && longLeave.status === 400, 'FIX-052: "back by" text and leave reason have length limits', [longBack.status, longLeave.status]);

  // Photos only through upload; removing is fine
  const outside = await call('PUT', '/api/auth/profile', A.clinicToken, { avatarUrl: 'https://tracker.example.com/p.gif' });
  const outsideClinic = await call('PUT', '/api/clinics/profile', A.clinicToken, { avatarUrl: 'https://tracker.example.com/p.gif' });
  const removePhoto = await call('PUT', '/api/auth/profile', P1.token, { avatarUrl: null });
  check(outside.status === 400 && outsideClinic.status === 400 && removePhoto.status === 200, 'FIX-052: profile photo can only be uploaded, not set to a link', [outside.status, outsideClinic.status, removePhoto.status]);

  // Receptionist's new phone reaches patients
  const P3 = await patient('3');
  const b3 = await bookAt(P3.token);
  const newPhone = await call('PUT', '/api/auth/profile', A.deskToken, { phone: '9876501234' });
  const seen = await call('GET', `/api/appointments/${b3.json?.data?.id}`, P3.token);
  check(newPhone.status === 200 && seen.json?.data?.receptionistPhone === '+91 9876501234', 'FIX-052: patients see the receptionist\'s updated phone', seen.json?.data?.receptionistPhone);

  // Two shifts can't share a name
  const dupNames = await call('PUT', '/api/doctors/schedule', D.token, { slots: [{ id: 'a', name: 'Morning', startTime: '06:00', endTime: '07:00', maxPatients: 5 }, { id: 'b', name: 'morning', startTime: '07:30', endTime: '08:00', maxPatients: 5 }] });
  check(dupNames.status === 400, 'FIX-052: two shifts with the same name are refused', dupNames.json?.message);

  // A shift with bookings can't be removed (used to fail with 500)
  if (now + 300 < 24 * 60) {
    const S = await clinicWithDesk('S');
    const morning = { ...live, id: 'sm', name: 'Morning' };
    const evening = { id: 'se', name: 'Evening', startTime: hhmm(now + 180), endTime: hhmm(now + 240), maxPatients: 20, avgConsultationMinutes: 5 };
    const DS = await doctorWith('S', [morning, evening]);
    await join(S, DS, [morning, evening]);
    await call('POST', '/api/receptionist/book-walkin', S.deskToken, { doctorId: DS.doctor.id, patientName: `Eve ${RUN}`, patientPhone: '9811100012', slotId: 'se', appointmentDate: tomorrow });
    const drop = await call('PUT', '/api/doctors/schedule', DS.token, { clinicId: S.clinic.id, slots: [morning] });
    check(drop.status === 400 && /booking/i.test(drop.json?.message || ''), 'FIX-052: removing a shift that has bookings gives a clear message, not a crash', [drop.status, drop.json?.message]);
  }

  // Doctor in two clinics at the same hours
  const B = await clinicWithDesk('B');
  const C = await clinicWithDesk('C');
  const shared = { ...live, id: 'slot_1', name: 'Shift 1' };
  const DM = await doctorWith('M', [shared]);
  await join(B, DM); // clinic B uses the doctor's default hours
  const invite = await call('POST', '/api/clinic/doctors', C.clinicToken, { doctorId: DM.doctor.id });
  const accept = await call('PUT', `/api/doctors/me/affiliations/${invite.json?.data?.id}/respond`, DM.token, { action: 'ACCEPT' });
  check(accept.status === 200 && Boolean(accept.json?.warning), 'FIX-052: joining a clinic with clashing hours warns the doctor', accept.json?.message);
  await prisma.doctorReceptionist.create({ data: { doctorId: DM.doctor.id, receptionistId: C.rec.id, status: 'ACTIVE' } });
  const PB = await patient('B'), PC = await patient('C');
  const atB = await call('POST', '/api/appointments/book', PB.token, { doctorId: DM.doctor.id, clinicId: B.clinic.id, appointmentDate: today, slotId: 'slot_1' });
  const atC = await call('POST', '/api/appointments/book', PC.token, { doctorId: DM.doctor.id, clinicId: C.clinic.id, appointmentDate: today, slotId: 'slot_1' });
  check(atB.status === 201 && atC.status === 409, 'FIX-052: the later clinic can\'t take bookings for hours that clash with the first clinic', [atB.status, atC.status]);
  const clashing = await call('PUT', '/api/doctors/schedule', DM.token, { clinicId: C.clinic.id, slots: [{ ...shared, id: 'c1', name: 'C shift' }] });
  check(clashing.status === 400, 'FIX-052: clinic hours that clash with a clinic on default hours are refused', clashing.json?.message);

  // A desk can't remove another clinic's leave for a shared doctor
  const leave = await call('POST', `/api/doctors/${DM.doctor.id}/leaves`, C.deskToken, { type: 'DATE_RANGE', startDate: dayOffset(5), endDate: dayOffset(6), reason: 'Conference' });
  const otherDesk = await call('DELETE', `/api/doctors/${DM.doctor.id}/leaves/${leave.json?.data?.id}`, B.deskToken);
  const ownDesk = await call('DELETE', `/api/doctors/${DM.doctor.id}/leaves/${leave.json?.data?.id}`, C.deskToken);
  check(leave.status === 200 && otherDesk.status === 404 && ownDesk.status === 200, 'FIX-052: only the clinic that set a leave (or the doctor) can remove it', [leave.status, otherDesk.status, ownDesk.status]);

  // Doctor leaving a clinic: patients whose visits are cancelled are told
  await call('POST', `/api/receptionist/appointments/${atB.json?.data?.id}/approve`, B.deskToken, {});
  const notesBefore = await prisma.notification.count({ where: { userId: PB.pu.id } });
  const leaveClinic = await call('DELETE', `/api/doctors/me/clinics/${B.clinic.id}`, DM.token);
  await wait(300);
  const visitAfter = await prisma.appointment.findUnique({ where: { id: atB.json?.data?.id } });
  const toldPatient = await prisma.notification.findFirst({ where: { userId: PB.pu.id, title: 'Visit cancelled' } });
  check(leaveClinic.status === 200 && visitAfter?.status === 'CANCELLED' && Boolean(toldPatient) && (await prisma.notification.count({ where: { userId: PB.pu.id } })) > notesBefore, 'FIX-052: patients are told when a doctor leaving the clinic cancels their visit', [leaveClinic.status, visitAfter?.status]);

  // Code endpoints answer the same for real and unknown emails
  const resendReal = await call('POST', '/api/auth/resend-otp', undefined, { email: P1.pu.email, role: 'PATIENT' });
  const resendNone = await call('POST', '/api/auth/resend-otp', undefined, { email: email('nobody'), role: 'PATIENT' });
  const verifyReal = await call('POST', '/api/auth/verify-otp', undefined, { email: P3.pu.email, otp: '123456', role: 'PATIENT' });
  const verifyNone = await call('POST', '/api/auth/verify-otp', undefined, { email: email('nobody2'), otp: '123456', role: 'PATIENT' });
  check(
    resendReal.status === resendNone.status && resendReal.json?.message === resendNone.json?.message &&
      verifyReal.status === verifyNone.status && verifyReal.json?.message === verifyNone.json?.message,
    'FIX-052: resend/verify code replies don\'t reveal which emails have accounts',
    [resendReal.status, resendNone.status, verifyReal.status, verifyNone.status]
  );
}

async function main() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const s = await seed();
    const patientToken = sign({ ...s.patientUser });
    const doctorToken = sign({ ...s.doctorUser });
    const clinicToken = sign({ ...s.clinicUser });

    // ---- Sign-out after password change -------------------------------------
    const oldDeskToken = sign({ ...s.recUser }, -60); // issued a minute ago, before the change
    const changed = await call('PUT', '/api/receptionist/change-password', oldDeskToken, {
      currentPassword: 'Temp-Pass-123',
      newPassword: 'New-Desk-Pass-456',
    });
    check(changed.status === 200 && changed.json?.token, 'Receptionist can change the temporary password', changed.json);
    const oldTokenAfter = await call('GET', '/api/auth/me', oldDeskToken);
    check(oldTokenAfter.status === 401, 'Login from before the password change is signed out (401)', oldTokenAfter);
    const deskToken: string = changed.json?.token;
    const newTokenAfter = await call('GET', '/api/auth/me', deskToken);
    check(newTokenAfter.status === 200, 'New login issued at password change still works', newTokenAfter.status);

    // ---- Live stream ---------------------------------------------------------
    const unauthStream = await fetch(`${baseUrl}/api/events`);
    check(unauthStream.status === 401, 'Live stream requires sign-in');
    const live = await openLiveStream(doctorToken);
    check(live.status === 200, 'Doctor can open the live stream');

    // ---- Full visit ----------------------------------------------------------
    const booked = await call('POST', '/api/appointments/book', patientToken, {
      doctorId: s.doctor.id,
      clinicId: s.clinic.id,
      appointmentDate: s.today,
      slotId: 'slot_all_day',
      reasonForVisit: 'Fever',
    });
    const appointmentId: string = booked.json?.data?.id || booked.json?.appointment?.id || booked.json?.id;
    check(booked.status === 201 || booked.status === 200, 'Patient books an appointment', booked.json);
    let appt = appointmentId ? await prisma.appointment.findUnique({ where: { id: appointmentId } }) : null;
    check(appt?.status === 'PENDING_APPROVAL', 'New online booking waits for receptionist approval', appt?.status);
    check(appt?.paymentStatus === 'PENDING', 'No payment is taken upfront', appt?.paymentStatus);

    await wait(600);
    check(live.events.includes('queue'), 'Booking pushes a live "queue" event', live.events);

    const approved = await call('POST', `/api/receptionist/appointments/${appointmentId}/approve`, deskToken, { paymentStatus: 'PAID' });
    appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    check(approved.status === 200 && appt?.status === 'WAITING', 'Receptionist approval moves the visit to WAITING', approved.json);
    check((appt?.queueNumber ?? 0) > 0, 'Approved visit gets a real token number', appt?.queueNumber);

    const checkedIn = await call('PATCH', `/api/receptionist/appointments/${appointmentId}/check-in`, deskToken, { isCheckedIn: true });
    appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    check(checkedIn.status === 200 && appt?.isCheckedIn === true, 'Receptionist marks the patient as arrived', checkedIn.json);

    const called = await call('POST', '/api/consultations/call-patient', doctorToken, { appointmentId });
    appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    check(called.status === 200 && appt?.status === 'IN_CONSULTATION', 'Doctor calls the patient into the cabin', called.json);
    check(appt?.calledAt instanceof Date, 'Call-in time is saved for the live wait estimate (FIX-048)', appt?.calledAt);

    const inCabin = await prisma.appointment.count({ where: { doctorId: s.doctor.id, status: 'IN_CONSULTATION' } });
    check(inCabin === 1, 'Only one patient is in the cabin for this doctor', inCabin);

    const patientView = await call('GET', '/api/appointments/patient?status=active', patientToken);
    const mine = (patientView.json?.data || patientView.json || []).find?.((a: any) => a.id === appointmentId);
    check(mine?.status === 'IN_CONSULTATION', 'Patient sees "in cabin" right away (no stale queue cache)', mine?.status);

    const completed = await call('POST', '/api/consultations/complete', doctorToken, { appointmentId, clinicalNotes: 'Rest and fluids' });
    appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    check(completed.status === 200 && appt?.status === 'COMPLETED', 'Doctor completes the visit', completed.json);
    check(
      appt?.completedAt instanceof Date && appt?.calledAt instanceof Date && appt.completedAt >= appt.calledAt,
      'Finish time is saved after the call-in time (FIX-048)',
      { calledAt: appt?.calledAt, completedAt: appt?.completedAt }
    );

    const reCall = await call('POST', '/api/consultations/call-patient', doctorToken, { appointmentId });
    check(reCall.status >= 400, 'A completed visit cannot be called again', reCall.status);
    live.close();

    // ---- Audit 2026-10-27: privacy and input checks ---------------------------
    const patientDetail = await call('GET', `/api/appointments/${appointmentId}`, patientToken);
    const docUser = patientDetail.json?.data?.doctor?.user || {};
    check(
      patientDetail.status === 200 && docUser.fullName && docUser.email === undefined && docUser.phone === undefined,
      "Patient's visit details never include the doctor's own email or mobile",
      docUser
    );
    const doctorDetail = await call('GET', `/api/appointments/${appointmentId}`, doctorToken);
    check(doctorDetail.status === 200 && doctorDetail.json?.data?.doctor?.user?.email, 'The doctor still sees their own details on the visit', doctorDetail.status);

    const toDecline = await call('POST', '/api/appointments/book', patientToken, {
      doctorId: s.doctor.id,
      clinicId: s.clinic.id,
      appointmentDate: s.today,
      slotId: 'slot_all_day',
    });
    const declineId: string = toDecline.json?.data?.id;
    const objReason = await call('POST', `/api/receptionist/appointments/${declineId}/reject`, deskToken, { reason: { x: 1 } });
    check(objReason.status === 400, 'Declining with a non-text reason returns 400', objReason.json);
    const hugeReason = await call('POST', `/api/receptionist/appointments/${declineId}/reject`, deskToken, { reason: 'x'.repeat(600) });
    check(hugeReason.status === 400, 'Declining with a 600-character reason returns 400', hugeReason.json);
    const declined = await call('POST', `/api/receptionist/appointments/${declineId}/reject`, deskToken, { reason: 'Doctor away' });
    check(declined.status === 200, 'Declining with a short reason works', declined.json);

    const longSignup = await call('POST', '/api/auth/register', undefined, {
      email: email('longclinic'),
      password: 'Long-Clinic-123',
      fullName: 'Long Clinic',
      role: 'CLINIC',
      clinicName: 'C'.repeat(400),
      address: 'Somewhere',
    });
    check(longSignup.status === 400, 'Sign-up refuses a 400-character clinic name', longSignup.json);

    // ---- Demo account lock ---------------------------------------------------
    // The lock runs before any database work, so a token carrying the demo email is enough
    const demoToken = sign({ id: `demo-${RUN}`, email: 'john.doe@gmail.com', role: 'PATIENT', fullName: 'Demo Patient' });
    const demoEdit = await call('PUT', '/api/auth/profile', demoToken, { fullName: 'Vandalised' });
    check(demoEdit.status === 403 && demoEdit.json?.code === 'DEMO_ACCOUNT_LOCKED', 'Demo accounts cannot be renamed', demoEdit.json);    const normalEdit = await call('PUT', '/api/auth/profile', patientToken, { fullName: `Patient ${RUN} Renamed` });
    check(normalEdit.status === 200, 'Normal accounts can still edit their profile', normalEdit.json);

    // ---- Public discovery cache ---------------------------------------------
    const first = await call('GET', '/api/doctors?limit=5');
    const second = await call('GET', '/api/doctors?limit=5');
    check(first.status === 200 && second.headers.get('x-cache') === 'HIT', 'Repeat doctor list is served from memory', second.headers.get('x-cache'));
    await call('PUT', '/api/clinic/profile', clinicToken, { address: '2 Test Road' });
    const third = await call('GET', '/api/doctors?limit=5');
    check(third.headers.get('x-cache') === 'MISS', 'Any successful write refreshes the cached list', third.headers.get('x-cache'));
    const signedIn = await call('GET', '/api/doctors?limit=5', patientToken);
    check(!signedIn.headers.get('x-cache'), 'Signed-in requests skip the shared cache', signedIn.headers.get('x-cache'));

    // ---- NULL-safe token numbers --------------------------------------------
    const base = {
      patientId: (await prisma.patientProfile.findUnique({ where: { userId: s.patientUser.id } }))!.id,
      doctorId: s.doctor.id,
      appointmentDate: '2099-01-01',
      queueNumber: 7,
      checkingWindow: '09:00 AM - 01:00 PM',
      estimatedTime: '09:30 AM',
    };
    await prisma.appointment.create({ data: base });
    const dup = await prisma.appointment.create({ data: base }).then(() => 'created').catch((e: any) => e.code);
    check(dup === 'P2002', 'Two visits without clinic/shift cannot share a token number', dup);

    // ---- Status values are enforced by the database -------------------------
    const badStatus = await prisma.appointment
      .create({ data: { ...base, queueNumber: 8, status: 'TELEPORTED' } })
      .then(() => 'created')
      .catch(() => 'rejected');
    check(badStatus === 'rejected', 'Database rejects unknown appointment statuses', badStatus);

    // ---- Walk-ins don't reveal who owns a phone number -----------------------
    const strangerWalkin = await call('POST', '/api/appointments/book', doctorToken, {
      clinicId: s.clinic.id,
      appointmentDate: s.today,
      slotId: 'slot_all_day',
      patientName: `Stranger ${RUN}`,
      patientPhone: '9800000004', // the test patient's phone
    });
    check(strangerWalkin.status === 201, 'Doctor can add a walk-in with any phone number', strangerWalkin.json);
    const swData = strangerWalkin.json?.data || {};
    check(!JSON.stringify(swData).includes(s.patientUser.email), "Walk-in reply never contains the phone owner's email", swData?.patient?.user);
    check(swData?.patient?.user?.fullName !== s.patientUser.fullName, "Walk-in reply never shows the phone owner's name", swData?.patient?.user?.fullName);
    const patientProfileId = (await prisma.patientProfile.findUnique({ where: { userId: s.patientUser.id } }))!.id;
    check(swData?.patientId && swData.patientId !== patientProfileId, "A walk-in with a different name is not added to the phone owner's account", swData?.patientId);

    const deskWalkin = await call('POST', '/api/receptionist/book-walkin', deskToken, {
      doctorId: s.doctor.id,
      clinicId: s.clinic.id,
      slotId: 'slot_all_day',
      patientName: `Desk Stranger ${RUN}`,
      patientPhone: '9800000004',
    });
    check(deskWalkin.status === 201, 'Desk can add a walk-in with any phone number', deskWalkin.json);
    check(deskWalkin.json?.data?.patientId !== patientProfileId, "Desk walk-in with a different name stays off the owner's account", deskWalkin.json?.data?.patientId);

    // Use the name as it is now (an earlier step renamed this patient)
    const ownerNow = await prisma.user.findUnique({ where: { id: s.patientUser.id }, select: { fullName: true } });
    const ownerWalkin = await call('POST', '/api/receptionist/book-walkin', deskToken, {
      doctorId: s.doctor.id,
      clinicId: s.clinic.id,
      slotId: 'slot_all_day',
      patientName: ownerNow?.fullName,
      patientPhone: '9800000004',
    });
    check(
      ownerWalkin.status === 201 && ownerWalkin.json?.data?.patientId === patientProfileId,
      "Walk-in with the same name and phone joins the patient's own account",
      ownerWalkin.json?.data?.patientId
    );
    if (ownerWalkin.json?.data?.id) {
      await prisma.appointment.update({ where: { id: ownerWalkin.json.data.id }, data: { status: 'CANCELLED' } });
    }

    // ---- Booking limits ------------------------------------------------------
    const farDate = getLocalDateString(new Date(Date.now() + (MAX_BOOKING_DAYS_AHEAD + 30) * 864e5));
    const tooFar = await call('POST', '/api/appointments/book', patientToken, { doctorId: s.doctor.id, clinicId: s.clinic.id, appointmentDate: farDate, slotId: 'slot_all_day' });
    check(tooFar.status === 400, `Bookings more than ${MAX_BOOKING_DAYS_AHEAD} days ahead are refused`, tooFar.json);

    const longReason = await call('POST', '/api/appointments/book', patientToken, {
      doctorId: s.doctor.id, clinicId: s.clinic.id, appointmentDate: s.today, slotId: 'slot_all_day',
      isForOther: true, patientName: `Long ${RUN}`, patientAge: '30', reasonForVisit: 'x'.repeat(5000),
    });
    check(longReason.status === 400, 'A 5,000-character reason for visit is refused', longReason.json);

    const familyStatuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await call('POST', '/api/appointments/book', patientToken, {
        doctorId: s.doctor.id, clinicId: s.clinic.id, appointmentDate: s.today, slotId: 'slot_all_day',
        isForOther: true, patientName: `Family ${i} ${RUN}`, patientAge: '30',
      });
      familyStatuses.push(r.status);
    }
    check(familyStatuses.slice(0, 4).every((st) => st === 201), 'A patient can book for a few family members on one day', familyStatuses);
    check(familyStatuses[4] === 429, 'The 5th active booking on one day is refused', familyStatuses);
    await prisma.appointment.updateMany({ where: { patientId: patientProfileId, isForOther: true, status: 'PENDING_APPROVAL' }, data: { status: 'CANCELLED' } });

    const bigContact = await call('POST', '/api/contact', undefined, { fullName: 'Flow', email: email('contact'), message: 'y'.repeat(4000) });
    check(bigContact.status === 400, 'A 4,000-character contact message is refused', bigContact.json);
    const okContact = await call('POST', '/api/contact', undefined, { fullName: 'Flow', email: email('contact'), message: 'Hello' });
    check(okContact.status === 201, 'A normal contact message is accepted', okContact.json);

    // ---- QR check-in only near the visit -------------------------------------
    const win = await getCheckInWindow({
      doctorId: s.doctor.id,
      slotId: 'evening',
      doctor: { slots: JSON.stringify([{ id: 'evening', name: 'Evening', startTime: '18:00', endTime: '20:00', maxPatients: 10 }]) },
    });
    check(win?.opensAt === 15 * 60 && win?.closesAt === 20 * 60, 'QR check-in opens 3 hours before an 18:00 shift and closes at 20:00', win);

    const qrBooking = await call('POST', '/api/appointments/book', patientToken, { doctorId: s.doctor.id, clinicId: s.clinic.id, appointmentDate: s.today, slotId: 'slot_all_day' });
    const qrId: string = qrBooking.json?.data?.id;
    await call('POST', `/api/receptionist/appointments/${qrId}/approve`, deskToken, { paymentStatus: 'PAID' });
    const qrWrong = await call('POST', '/api/appointments/check-in', patientToken, { clinicId: s.clinic.id, code: '000000' });
    check(qrWrong.status === 403, 'Scanning with a wrong clinic code is refused', qrWrong.json);
    const qrOk = await call('POST', '/api/appointments/check-in', patientToken, { clinicId: s.clinic.id, code: '482913', appointmentId: qrId });
    check(qrOk.status === 200, 'Scanning the clinic QR during the shift checks the patient in', qrOk.json);

    // ---- Bad input is a clear 400, not a crash -------------------------------
    const adminToken = sign({ id: `admin-${RUN}`, email: email('admin'), role: 'ADMIN', fullName: 'Flow Admin' });
    const badStatusType = await call('POST', '/api/admin/verify-doctor', adminToken, { doctorId: s.doctor.id, status: 123 });
    check(badStatusType.status === 400, 'Admin verify with a non-text status returns 400', badStatusType.status);
    const badNotes = await call('PUT', '/api/consultations/notes', doctorToken, { appointmentId: qrId, diagnosis: 5 });
    check(badNotes.status === 400, 'Doctor notes with a non-text diagnosis return 400', badNotes.status);

    const pageOne = await call('GET', '/api/admin/appointments?page=1&limit=1', adminToken);
    check(
      pageOne.status === 200 && pageOne.json?.data?.length === 1 && pageOne.json?.pagination?.total >= 1,
      'Admin bookings list is paged (no silent 250 cap)',
      pageOne.json?.pagination
    );

    // ---- Sign-in rules -------------------------------------------------------
    await prisma.doctorProfile.update({ where: { id: s.doctor.id }, data: { verificationStatus: 'SUSPENDED', isVerified: false } });
    const suspendedLogin = await call('POST', '/api/auth/login', undefined, { email: s.doctorUser.email, password: 'Temp-Pass-123', role: 'DOCTOR' });
    check(suspendedLogin.status === 403, 'A suspended doctor cannot sign in with a password', suspendedLogin.json);
    await prisma.doctorProfile.update({ where: { id: s.doctor.id }, data: { verificationStatus: 'VERIFIED', isVerified: true } });

    const demoAdminEmail = email('demoadmin');
    await prisma.user.create({
      data: { email: demoAdminEmail, passwordHash: await bcrypt.hash('Demo-Admin-123', 4), fullName: `Demo Admin ${RUN}`, role: 'ADMIN', isEmailVerified: true },
    });
    const savedDemoList = process.env.DEMO_ACCOUNT_EMAILS;
    process.env.DEMO_ACCOUNT_EMAILS = `john.doe@gmail.com,${demoAdminEmail}`;
    const demoAdminLogin = await call('POST', '/api/auth/login', undefined, { email: demoAdminEmail, password: 'Demo-Admin-123', role: 'ADMIN' });
    if (savedDemoList === undefined) delete process.env.DEMO_ACCOUNT_EMAILS;
    else process.env.DEMO_ACCOUNT_EMAILS = savedDemoList;
    check(demoAdminLogin.status === 403 && demoAdminLogin.json?.code === 'DEMO_ADMIN_DISABLED', 'The public demo admin cannot open the admin panel', demoAdminLogin.json);

    const recRejectedEmail = email('rejected');
    const rejUser = await prisma.user.create({
      data: { email: recRejectedEmail, passwordHash: await bcrypt.hash('Their-Own-Pass-1', 4), fullName: `Rejected ${RUN}`, role: 'RECEPTIONIST' },
    });
    await prisma.receptionistProfile.create({ data: { userId: rejUser.id, clinicId: s.clinic.id, status: 'REJECTED' } });
    const hijack = await call('POST', '/api/receptionists/apply', undefined, { fullName: 'Someone Else', email: recRejectedEmail, password: 'Stranger-Pass-9', clinicId: s.clinic.id });
    check(hijack.status === 409, "A stranger cannot re-apply with a rejected receptionist's email and replace the password", hijack.json);
    const stillOwn = await prisma.user.findUnique({ where: { id: rejUser.id } });
    check(Boolean(stillOwn && (await bcrypt.compare('Their-Own-Pass-1', stillOwn.passwordHash))), 'The rejected receptionist keeps their password', null);

    // ---- Forgot and change password -----------------------------------------
    const unknownReset = await call('POST', '/api/auth/forgot-password', undefined, { email: email('nobody'), role: 'PATIENT' });
    check(unknownReset.status === 200, 'Forgot password gives the same reply for unknown emails', unknownReset.json);
    const resetReq = await call('POST', '/api/auth/forgot-password', undefined, { email: s.patientUser.email, role: 'PATIENT' });
    const devOtp: string = resetReq.json?.data?.devOtp || '';
    check(resetReq.status === 200 && /^\d{6}$/.test(devOtp), 'Forgot password sends a 6-digit code', resetReq.json);
    const stored = await prisma.user.findUnique({ where: { id: s.patientUser.id }, select: { emailVerificationOtp: true } });
    check(
      Boolean(stored?.emailVerificationOtp?.startsWith('h1:')) && !stored?.emailVerificationOtp?.includes(devOtp),
      'Email codes are stored hashed, not as plain digits',
      null
    );
    const wrongCode = await call('POST', '/api/auth/reset-password', undefined, {
      email: s.patientUser.email, role: 'PATIENT', otp: devOtp === '111111' ? '222222' : '111111', newPassword: 'Brand-New-Pass-1',
    });
    check(wrongCode.status === 400, 'A wrong reset code is refused', wrongCode.json);
    await wait(1100); // tokens record whole seconds; make sure the old one is older than the reset
    const reset = await call('POST', '/api/auth/reset-password', undefined, { email: s.patientUser.email, role: 'PATIENT', otp: devOtp, newPassword: 'Brand-New-Pass-1' });
    check(reset.status === 200, 'The right code sets a new password', reset.json);
    const oldPatientSession = await call('GET', '/api/auth/me', patientToken);
    check(oldPatientSession.status === 401, 'Resetting the password signs out old sessions', oldPatientSession.status);
    const newLogin = await call('POST', '/api/auth/login', undefined, { email: s.patientUser.email, password: 'Brand-New-Pass-1', role: 'PATIENT' });
    check(newLogin.status === 200 && newLogin.json?.data?.token, 'Patient signs in with the new password', newLogin.json?.message);
    const reuse = await call('POST', '/api/auth/reset-password', undefined, { email: s.patientUser.email, role: 'PATIENT', otp: devOtp, newPassword: 'Another-Pass-22' });
    check(reuse.status === 400, 'A reset code works only once', reuse.json);

    const newToken: string = newLogin.json?.data?.token;
    await wait(1100);
    const badCurrent = await call('PUT', '/api/auth/change-password', newToken, { currentPassword: 'wrong-one', newPassword: 'Changed-Pass-33' });
    check(badCurrent.status === 400, 'Change password needs the current password', badCurrent.json);
    const changedOwn = await call('PUT', '/api/auth/change-password', newToken, { currentPassword: 'Brand-New-Pass-1', newPassword: 'Changed-Pass-33' });
    check(changedOwn.status === 200 && changedOwn.json?.data?.token, 'Signed-in patient can change their password', changedOwn.json);
    const afterChangeOld = await call('GET', '/api/auth/me', newToken);
    const afterChangeNew = await call('GET', '/api/auth/me', changedOwn.json?.data?.token);
    check(
      afterChangeOld.status === 401 && afterChangeNew.status === 200,
      'Changing the password keeps this device signed in and signs out the others',
      [afterChangeOld.status, afterChangeNew.status]
    );
    const demoChange = await call('PUT', '/api/auth/change-password', demoToken, { currentPassword: 'x', newPassword: 'Whatever-123' });
    check(demoChange.status === 403, 'Demo accounts cannot change their password', demoChange.status);

    // ---- Bug hunt fixes (FIX-052) ---------------------------------------------
    await bugHuntChecks();

    // ---- Long reports are complete (FIX-051: used to stop at 2000 without saying so) ----
    {
      const profile = await prisma.patientProfile.findUnique({ where: { userId: s.patientUser.id } });
      const dayStr = (back: number) => {
        const d = new Date(`${s.today}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - back);
        return d.toISOString().slice(0, 10);
      };
      const rows: any[] = [];
      for (let day = 10; day < 51; day++) {
        for (let q = 1; q <= 50; q++) {
          rows.push({
            patientId: profile!.id, doctorId: s.doctor.id, clinicId: s.clinic.id, appointmentDate: dayStr(day),
            queueNumber: q, slotId: 'flow-report', checkingWindow: 'Shift 1', estimatedTime: '10:00 AM',
            status: 'COMPLETED', paymentStatus: 'PAID', patientName: `Report ${RUN} ${q}`,
          });
        }
      }
      await prisma.appointment.createMany({ data: rows });
      const range = `startDate=${dayStr(60)}&endDate=${s.today}`;
      const expected = await prisma.appointment.count({ where: { doctorId: s.doctor.id, appointmentDate: { gte: dayStr(60), lte: s.today } } });
      check(expected > 2000, 'Report test has more than 2000 visits', expected);
      for (const [who, path, token] of [
        ['Doctor', `/api/doctors/me/report?${range}`, doctorToken],
        ['Clinic', `/api/clinics/report?${range}`, clinicToken],
        ['Desk', `/api/receptionist/report?${range}`, deskToken],
      ] as const) {
        const r = await call('GET', path, token);
        const ok = r.status === 200 && r.json?.appointments?.length === expected && r.json?.summary?.totalBookings === expected && r.json?.truncated === false;
        check(ok, `${who} report includes all ${expected} visits, not just 2000`, [r.status, r.json?.appointments?.length, r.json?.summary?.totalBookings, r.json?.truncated, r.json?.message]);
      }
      const doctorReport = await call('GET', `/api/doctors/me/report?${range}`, doctorToken);
      check(doctorReport.json?.summary?.totalRevenue >= 2050 * 300, 'Report earnings count every paid visit', doctorReport.json?.summary?.totalRevenue);
    }
  } finally {
    await cleanup().catch((e) => console.error('cleanup failed', e));
    server.close();
    await prisma.$disconnect();
  }

  console.log('\n========================================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('========================================');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Flow tests crashed:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
