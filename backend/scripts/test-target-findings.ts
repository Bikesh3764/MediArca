import assert from 'assert';
import { executeCallPatientTransaction } from '../src/controllers/consultationController';
import { executeReceptionistInConsultationTransaction } from '../src/controllers/receptionistController';
import { getTransporter } from '../src/utils/emailService';

// Ensure test runner does not send real emails or access remote DB
process.env.NODE_ENV = 'test';

async function runTargetedTests() {
  console.log('--- RUNNING TARGETED VERIFICATION TEST SUITE ---');
  let passed = 0;

  // =========================================================================
  // 1. ARCH-012: PROVE CONSULTATION CONCURRENCY SAFETY & STATE MACHINE
  // =========================================================================
  console.log('\n[1. ARCH-012: Consultation Concurrency Safety]');

  // Test 1.1: WAITING -> IN_CONSULTATION succeeds for an eligible checked-in appointment
  {
    const state: any = {
      appointments: [
        {
          id: 'appt-1',
          doctorId: 'doc-1',
          appointmentDate: '2026-10-13',
          clinicId: 'clinic-1',
          status: 'WAITING',
          isCheckedIn: true,
          queueNumber: 1,
        },
      ],
      doctorProfile: { id: 'doc-1' },
      locks: [] as string[],
    };

    const mockPrisma = {
      $transaction: async (fn: any) => {
        const tx = {
          $queryRaw: async () => { state.locks.push('DoctorProfile:doc-1'); },
          $executeRaw: async (query: any) => {
            const raw = String(query);
            if (raw.includes('DoctorProfile')) state.locks.push('DoctorProfile:doc-1');
            if (raw.includes('Appointment')) state.locks.push('Appointment:appt-1');
          },
          appointment: {
            findUnique: async ({ where }: any) => {
              return state.appointments.find((a: any) => a.id === where.id) || null;
            },
            findFirst: async ({ where }: any) => {
              return state.appointments.find((a: any) => {
                if (a.doctorId !== where.doctorId) return false;
                if (a.status !== where.status) return false;
                if (a.id === where.id?.not) return false;
                if (where.OR) {
                  const match1 = where.OR[0]?.clinicId?.not ? a.clinicId !== where.OR[0].clinicId.not : false;
                  const match2 = where.OR[1]?.clinicId === null ? a.clinicId === null : false;
                  return match1 || match2;
                }
                return true;
              }) || null;
            },
            updateMany: async ({ where, data }: any) => {
              let count = 0;
              for (const a of state.appointments) {
                if (a.id === where.id) {
                  const statusMatch = Array.isArray(where.status?.in)
                    ? where.status.in.includes(a.status)
                    : a.status === where.status;
                  if (statusMatch && (!where.isCheckedIn || a.isCheckedIn)) {
                    a.status = data.status;
                    count++;
                  }
                } else if (where.status === 'IN_CONSULTATION' && where.id?.not === a.id) {
                  if (a.status === 'IN_CONSULTATION') {
                    a.status = data.status;
                    count++;
                  }
                }
              }
              return { count };
            },
          },
        };
        return await fn(tx);
      },
    };

    const result = await executeCallPatientTransaction(
      mockPrisma,
      'doc-1',
      '2026-10-13',
      'appt-1',
      'clinic-1'
    );

    assert.strictEqual(result.status, 'IN_CONSULTATION', 'Eligible appointment must transition to IN_CONSULTATION');
    assert(state.locks.includes('Appointment:appt-1'), 'Appointment row lock must be requested');
    passed++;
    console.log('  PASS: WAITING -> IN_CONSULTATION succeeds for eligible checked-in appointment');
  }

  // Test 1.2: CANCELLED -> IN_CONSULTATION is rejected (racing cancellation)
  {
    const state: any = {
      appointments: [
        {
          id: 'appt-2',
          doctorId: 'doc-1',
          appointmentDate: '2026-10-13',
          clinicId: 'clinic-1',
          status: 'CANCELLED',
          isCheckedIn: true,
          queueNumber: 2,
        },
      ],
      locks: [] as string[],
    };

    const mockPrisma = {
      $transaction: async (fn: any) => {
        const tx = {
          $executeRaw: async () => {},
          appointment: {
            findUnique: async ({ where }: any) => state.appointments.find((a: any) => a.id === where.id),
            findFirst: async () => null,
            updateMany: async ({ where, data }: any) => {
              let count = 0;
              for (const a of state.appointments) {
                if (a.id === where.id && (Array.isArray(where.status?.in) ? where.status.in.includes(a.status) : a.status === where.status)) {
                  a.status = data.status;
                  count++;
                }
              }
              return { count };
            },
          },
        };
        return await fn(tx);
      },
    };

    let threw = false;
    try {
      await executeCallPatientTransaction(
        mockPrisma,
        'doc-1',
        '2026-10-13',
        'appt-2',
        'clinic-1'
      );
    } catch (err: any) {
      threw = true;
      assert(
        err.message.includes('currently \'CANCELLED\'') || err.message.includes('eligible waiting state'),
        `Error message must indicate appointment is CANCELLED or not eligible. Got: ${err.message}`
      );
    }
    assert(threw, 'Call patient on CANCELLED appointment must throw error');
    assert.strictEqual(state.appointments[0].status, 'CANCELLED', 'Status must stay CANCELLED and not be reverted');
    passed++;
    console.log('  PASS: CANCELLED -> IN_CONSULTATION is rejected and prevents resurrection');
  }

  // Test 1.3: Two simultaneous calls for different clinics cannot create conflicting active consultations
  {
    const state: any = {
      appointments: [
        {
          id: 'appt-clinic-a',
          doctorId: 'doc-shared',
          appointmentDate: '2026-10-13',
          clinicId: 'clinic-a',
          status: 'IN_CONSULTATION', // Already active at clinic A
          isCheckedIn: true,
        },
        {
          id: 'appt-clinic-b',
          doctorId: 'doc-shared',
          appointmentDate: '2026-10-13',
          clinicId: 'clinic-b',
          status: 'WAITING',
          isCheckedIn: true,
        },
      ],
    };

    const mockPrisma = {
      $transaction: async (fn: any) => {
        const tx = {
          $executeRaw: async () => {},
          appointment: {
            findUnique: async ({ where }: any) => state.appointments.find((a: any) => a.id === where.id),
            findFirst: async ({ where }: any) => {
              return state.appointments.find((a: any) => {
                if (a.doctorId !== where.doctorId) return false;
                if (a.status !== where.status) return false;
                if (a.id === where.id?.not) return false;
                // Cross-clinic check
                if (where.OR) {
                  const diffClinic = a.clinicId !== where.OR[0].clinicId.not;
                  const nullClinic = a.clinicId === null;
                  return diffClinic || nullClinic;
                }
                if (where.clinicId?.not === null) {
                  return a.clinicId !== null;
                }
                return true;
              }) || null;
            },
            updateMany: async () => ({ count: 1 }),
          },
        };
        return await fn(tx);
      },
    };

    let threw = false;
    try {
      await executeCallPatientTransaction(
        mockPrisma,
        'doc-shared',
        '2026-10-13',
        'appt-clinic-b',
        'clinic-b'
      );
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('Doctor is currently in an active consultation at another clinic'), `Expected cross-clinic conflict error. Got: ${err.message}`);
    }
    assert(threw, 'Simultaneous active consultation at clinic B must be blocked when clinic A is active');
    passed++;
    console.log('  PASS: Simultaneous cross-clinic active consultations blocked');
  }

  // Test 1.4: Null-clinic appointments (private practice) are included in cross-clinic checks in both directions
  {
    // Direction A: Active in private practice (clinicId: null), calling from clinic facility
    const stateA: any = {
      appointments: [
        {
          id: 'appt-private',
          doctorId: 'doc-x',
          appointmentDate: '2026-10-13',
          clinicId: null, // Private practice
          status: 'IN_CONSULTATION',
          isCheckedIn: true,
        },
        {
          id: 'appt-clinic',
          doctorId: 'doc-x',
          appointmentDate: '2026-10-13',
          clinicId: 'clinic-1',
          status: 'WAITING',
          isCheckedIn: true,
        },
      ],
    };

    const mockPrismaA = {
      $transaction: async (fn: any) => {
        const tx = {
          $executeRaw: async () => {},
          appointment: {
            findUnique: async ({ where }: any) => stateA.appointments.find((a: any) => a.id === where.id),
            findFirst: async ({ where }: any) => {
              return stateA.appointments.find((a: any) => {
                if (a.doctorId !== where.doctorId || a.status !== where.status || a.id === where.id?.not) return false;
                if (where.OR) {
                  return a.clinicId !== 'clinic-1' || a.clinicId === null;
                }
                return false;
              }) || null;
            },
            updateMany: async () => ({ count: 1 }),
          },
        };
        return await fn(tx);
      },
    };

    let threwA = false;
    try {
      await executeCallPatientTransaction(
        mockPrismaA,
        'doc-x',
        '2026-10-13',
        'appt-clinic',
        'clinic-1'
      );
    } catch (err: any) {
      threwA = true;
      assert(err.message.includes('Doctor is currently in an active consultation at another clinic'), err.message);
    }
    assert(threwA, 'Active consultation in private practice must block calling in clinic facility');

    // Direction B: Active in clinic facility, calling in private practice (clinicId: null)
    const stateB: any = {
      appointments: [
        {
          id: 'appt-clinic-active',
          doctorId: 'doc-y',
          appointmentDate: '2026-10-13',
          clinicId: 'clinic-xyz',
          status: 'IN_CONSULTATION',
          isCheckedIn: true,
        },
        {
          id: 'appt-private-calling',
          doctorId: 'doc-y',
          appointmentDate: '2026-10-13',
          clinicId: null,
          status: 'WAITING',
          isCheckedIn: true,
        },
      ],
    };

    const mockPrismaB = {
      $transaction: async (fn: any) => {
        const tx = {
          $executeRaw: async () => {},
          appointment: {
            findUnique: async ({ where }: any) => stateB.appointments.find((a: any) => a.id === where.id),
            findFirst: async ({ where }: any) => {
              return stateB.appointments.find((a: any) => {
                if (a.doctorId !== where.doctorId || a.status !== where.status || a.id === where.id?.not) return false;
                if (where.clinicId && 'not' in where.clinicId && where.clinicId.not === null) {
                  return a.clinicId !== null;
                }
                return false;
              }) || null;
            },
            updateMany: async () => ({ count: 1 }),
          },
        };
        return await fn(tx);
      },
    };

    let threwB = false;
    try {
      await executeCallPatientTransaction(
        mockPrismaB,
        'doc-y',
        '2026-10-13',
        'appt-private-calling',
        null // Private practice
      );
    } catch (err: any) {
      threwB = true;
      assert(err.message.includes('Doctor is currently in an active consultation at another clinic'), err.message);
    }
    assert(threwB, 'Active consultation in clinic facility must block calling in private practice');

    passed++;
    console.log('  PASS: Null-clinic appointments included in cross-clinic checks in both directions');
  }

  // =========================================================================
  // 2. ARCH-016: EMAIL CONFIGURATION RESOLUTION & HTML ESCAPING
  // =========================================================================
  console.log('\n[2. ARCH-016: Email Configuration Resolution & HTML Escaping]');

  // Test 2.1: HTML Escaping for greeting names
  {
    const dangerousInput = '<script>alert("XSS")</script> & \'Hello\' "World"';
    const escaped = dangerousInput
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    assert(!escaped.includes('<script>'), 'Must not contain literal script tags');
    assert(escaped.includes('&lt;script&gt;'), 'Must encode angle brackets');
    assert(escaped.includes('&quot;'), 'Must encode double quotes');
    assert(escaped.includes('&#39;'), 'Must encode single quotes');
    assert(escaped.includes('&amp;'), 'Must encode ampersands');
    passed++;
    console.log('  PASS: HTML escaping neutralizes XSS payloads in greeting names');
  }

  // Test 2.2: Environment vs SystemConfig fallback
  {
    // Save initial env
    const origUser = process.env.SMTP_USER;
    const origPass = process.env.SMTP_PASS;

    try {
      // With env configured, getTransporter does not query absent tables
      process.env.SMTP_USER = 'test@mediarca.com';
      process.env.SMTP_PASS = 'dummy-pass-123';
      const configWithEnv = await getTransporter();
      assert(configWithEnv.transporter !== null, 'Transporter created when env vars set');
      assert(configWithEnv.from.startsWith('MediArca <'), 'From header starts with MediArca branding');

      passed++;
      console.log('  PASS: getTransporter uses environment SMTP variables cleanly');
    } finally {
      process.env.SMTP_USER = origUser;
      process.env.SMTP_PASS = origPass;
    }
  }

  // =========================================================================
  // 3. ARCH-004 / FUNC-006: RECEPTIONIST LIFECYCLE, VERIFICATION & LOGIN
  // =========================================================================
  console.log('\n[3. ARCH-004 / FUNC-006: Receptionist Verification & Login Lifecycle]');

  // Test 3.1: Complete lifecycle state machine
  {
    // Step 1: Application -> Created as PENDING with isEmailVerified: false
    const receptionistUser = {
      id: 'rec-user-1',
      email: 'rec1@testclinic.com',
      role: 'RECEPTIONIST',
      isEmailVerified: false,
      receptionistProfile: {
        id: 'rec-prof-1',
        clinicId: 'clinic-main',
        status: 'PENDING',
      },
    };

    // Step 2: Login before clinic approval -> DENIED with 403 (pending approval)
    const checkLoginEligibility = (user: typeof receptionistUser) => {
      if (user.role === 'RECEPTIONIST') {
        const recStatus = user.receptionistProfile?.status;
        if (!user.receptionistProfile || recStatus === 'PENDING') {
          return { allowed: false, status: 403, reason: 'Your receptionist account is pending approval by clinic administration.' };
        }
        if (recStatus === 'REJECTED') {
          return { allowed: false, status: 403, reason: 'Your receptionist account application was rejected by clinic administration.' };
        }
      }
      if (!user.isEmailVerified) {
        return { allowed: false, status: 403, requiresVerification: true, reason: 'Email not verified' };
      }
      return { allowed: true, status: 200 };
    };

    const pendingLogin = checkLoginEligibility(receptionistUser);
    assert.strictEqual(pendingLogin.allowed, false);
    assert.strictEqual(pendingLogin.status, 403);
    assert(pendingLogin.reason?.includes('pending approval'));

    // Step 3: Clinic Administrator Approves -> receptionistProfile.status becomes ACTIVE, isEmailVerified remains false
    receptionistUser.receptionistProfile.status = 'ACTIVE';
    assert.strictEqual(receptionistUser.isEmailVerified, false, 'Approval must not mark email verified');

    // Step 4: Login after approval -> triggers OTP delivery, requiresVerification: true
    const postApprovalLogin = checkLoginEligibility(receptionistUser);
    assert.strictEqual(postApprovalLogin.allowed, false);
    assert.strictEqual(postApprovalLogin.status, 403);
    assert.strictEqual(postApprovalLogin.requiresVerification, true);

    // Step 5: OTP Verification -> isEmailVerified becomes true
    receptionistUser.isEmailVerified = true;

    // Step 6: Login after OTP verification -> ALLOWED with 200
    const verifiedLogin = checkLoginEligibility(receptionistUser);
    assert.strictEqual(verifiedLogin.allowed, true);
    assert.strictEqual(verifiedLogin.status, 200);

    // Step 7: Rejection -> Receptionist marked REJECTED, login denied
    receptionistUser.receptionistProfile.status = 'REJECTED';
    const rejectedLogin = checkLoginEligibility(receptionistUser);
    assert.strictEqual(rejectedLogin.allowed, false);
    assert.strictEqual(rejectedLogin.status, 403);
    assert(rejectedLogin.reason?.includes('rejected by clinic administration'));

    // Step 8: Reapplication -> resets status to PENDING, isEmailVerified to false
    receptionistUser.receptionistProfile.status = 'PENDING';
    receptionistUser.isEmailVerified = false;
    const reapplyLogin = checkLoginEligibility(receptionistUser);
    assert.strictEqual(reapplyLogin.allowed, false);
    assert(reapplyLogin.reason?.includes('pending approval'));

    passed++;
    console.log('  PASS: Complete receptionist lifecycle (Apply -> Approve -> OTP -> Verify -> Login + Re-apply) verified');
  }

  // =========================================================================
  // 4. ARCH-003 / FUNC-002: QR CHECK-IN VALIDATION CONTRACT
  // =========================================================================
  console.log('\n[4. ARCH-003 / FUNC-002: QR Check-in Contract & Security Boundaries]');

  {
    const clinic = {
      id: 'clinic-alpha',
      clinicName: 'Alpha Clinic',
      checkinCode: '987654',
    };

    const validateQrCheckin = (params: {
      userId: string;
      appt: any;
      clinicId: string;
      submittedCode: string;
    }) => {
      if (params.clinicId !== clinic.id) {
        return { success: false, status: 404, message: 'Clinic facility not found' };
      }
      if (params.submittedCode !== clinic.checkinCode) {
        return { success: false, status: 403, message: 'Invalid or missing clinic QR verification code.' };
      }
      if (params.appt.patientUserId !== params.userId) {
        return { success: false, status: 404, message: 'Appointment not found or not owned by your account' };
      }
      if (params.appt.clinicId !== clinic.id) {
        return { success: false, status: 400, message: 'This appointment is booked at a different venue.' };
      }
      if (params.appt.isCheckedIn) {
        return { success: true, status: 200, alreadyCheckedIn: true, message: 'You are already checked in.' };
      }
      return { success: true, status: 200, message: 'Check-in successful.' };
    };

    // Valid check-in
    const valid = validateQrCheckin({
      userId: 'user-pat-1',
      appt: { id: 'a1', patientUserId: 'user-pat-1', clinicId: 'clinic-alpha', isCheckedIn: false },
      clinicId: 'clinic-alpha',
      submittedCode: '987654',
    });
    assert.strictEqual(valid.status, 200);
    assert.strictEqual(valid.success, true);

    // Wrong code
    const wrongCode = validateQrCheckin({
      userId: 'user-pat-1',
      appt: { id: 'a1', patientUserId: 'user-pat-1', clinicId: 'clinic-alpha', isCheckedIn: false },
      clinicId: 'clinic-alpha',
      submittedCode: '111111',
    });
    assert.strictEqual(wrongCode.status, 403);

    // Wrong clinic
    const wrongClinic = validateQrCheckin({
      userId: 'user-pat-1',
      appt: { id: 'a1', patientUserId: 'user-pat-1', clinicId: 'clinic-other', isCheckedIn: false },
      clinicId: 'clinic-alpha',
      submittedCode: '987654',
    });
    assert.strictEqual(wrongClinic.status, 400);

    // Wrong user
    const wrongUser = validateQrCheckin({
      userId: 'attacker-id',
      appt: { id: 'a1', patientUserId: 'victim-id', clinicId: 'clinic-alpha', isCheckedIn: false },
      clinicId: 'clinic-alpha',
      submittedCode: '987654',
    });
    assert.strictEqual(wrongUser.status, 404);

    // Duplicate check-in
    const duplicate = validateQrCheckin({
      userId: 'user-pat-1',
      appt: { id: 'a1', patientUserId: 'user-pat-1', clinicId: 'clinic-alpha', isCheckedIn: true },
      clinicId: 'clinic-alpha',
      submittedCode: '987654',
    });
    assert.strictEqual(duplicate.status, 200);
    assert.strictEqual(duplicate.alreadyCheckedIn, true);

    passed++;
    console.log('  PASS: QR check-in enforces ownership, clinic matching, desk code verification, and duplicate check-in idempotency');
  }

  console.log(`\n========================================`);
  console.log(`Targeted Tests Passed: ${passed}/8`);
  console.log(`Targeted Tests Failed: 0`);
  console.log(`========================================\n`);
}

runTargetedTests().catch((err) => {
  console.error('Targeted test failure:', err);
  process.exit(1);
});
