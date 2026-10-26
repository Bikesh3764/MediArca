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
