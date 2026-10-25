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
import { getLocalDateString, getIndianTimeMinutes } from '../src/utils/scheduleUtils';

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

    const inCabin = await prisma.appointment.count({ where: { doctorId: s.doctor.id, status: 'IN_CONSULTATION' } });
    check(inCabin === 1, 'Only one patient is in the cabin for this doctor', inCabin);

    const patientView = await call('GET', '/api/appointments/patient?status=active', patientToken);
    const mine = (patientView.json?.data || patientView.json || []).find?.((a: any) => a.id === appointmentId);
    check(mine?.status === 'IN_CONSULTATION', 'Patient sees "in cabin" right away (no stale queue cache)', mine?.status);

    const completed = await call('POST', '/api/consultations/complete', doctorToken, { appointmentId, clinicalNotes: 'Rest and fluids' });
    appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    check(completed.status === 200 && appt?.status === 'COMPLETED', 'Doctor completes the visit', completed.json);

    const reCall = await call('POST', '/api/consultations/call-patient', doctorToken, { appointmentId });
    check(reCall.status >= 400, 'A completed visit cannot be called again', reCall.status);
    live.close();

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
