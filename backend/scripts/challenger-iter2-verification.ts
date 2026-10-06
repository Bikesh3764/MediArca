/**
 * MediArca Milestone 3 - Challenger Iteration 2 Adversarial Stress Suite
 * 
 * Tests:
 * 1. Massive Concurrency: 20 simultaneous callers for the same doctor.
 * 2. Multi-Doctor Concurrency Isolation: 3 doctors with 5 concurrent callers each (15 total).
 * 3. Parameterized Row-Lock Query Inspection: Ensures safe parameterization and proper SQL syntax.
 * 4. Error Injection & Lock Release: Failed transaction must not deadlock subsequent transactions.
 * 5. Rapid Preemption & Re-calling: Alternating appointments back and forth.
 * 6. Non-raw Client Compatibility: Graceful execution if $executeRaw is absent.
 */

import { executeCallPatientTransaction } from '../src/controllers/consultationController';
import { executeReceptionistInConsultationTransaction } from '../src/controllers/receptionistController';

interface AppointmentRecord {
  id: string;
  doctorId: string;
  appointmentDate: string;
  status: string;
  queueNumber: number;
  patient?: any;
}

class AdvancedDoctorLockedDb {
  appointments: Map<string, AppointmentRecord> = new Map();
  doctorLocks: Map<string, Promise<void>> = new Map();
  rawQueries: { query: string; values: any[] }[] = [];
  activeInConsultationHistory: number[] = [];

  constructor(records: AppointmentRecord[]) {
    for (const r of records) {
      this.appointments.set(r.id, { ...r });
    }
  }

  getDoctorAppointments(doctorId: string): AppointmentRecord[] {
    return Array.from(this.appointments.values()).filter((a) => a.doctorId === doctorId);
  }

  getActiveConsultations(doctorId: string): AppointmentRecord[] {
    return this.getDoctorAppointments(doctorId).filter((a) => a.status === 'IN_CONSULTATION');
  }

  async $transaction(fn: (tx: any) => Promise<any>) {
    const releaseFns: (() => void)[] = [];

    const tx = {
      $executeRaw: async (strings: any, ...values: any[]) => {
        const queryStr = Array.isArray(strings) ? strings.join('?') : String(strings);
        this.rawQueries.push({ query: queryStr, values });

        if (queryStr.includes('DoctorProfile') && queryStr.includes('FOR UPDATE')) {
          const doctorId = values[0] || queryStr.match(/WHERE id = ([^\s;]+)/)?.[1];
          if (doctorId) {
            const currentLock = this.doctorLocks.get(doctorId) || Promise.resolve();
            let unlock: () => void = () => {};
            const nextLock = new Promise<void>((resolve) => {
              unlock = resolve;
            });
            this.doctorLocks.set(doctorId, nextLock);
            releaseFns.push(unlock);
            await currentLock;
          }
        }
        return 1;
      },
      appointment: {
        updateMany: async ({ where, data }: any) => {
          // Randomized jitter to simulate network/disk concurrency
          await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5) + 1));
          let count = 0;
          for (const appt of this.appointments.values()) {
            const matchDoctor = !where.doctorId || appt.doctorId === where.doctorId;
            const matchDate = !where.appointmentDate || appt.appointmentDate === where.appointmentDate;
            const matchStatus = !where.status || appt.status === where.status;
            const matchIdNot = !where.id?.not || appt.id !== where.id.not;
            const matchId = !where.id || (typeof where.id === 'string' ? appt.id === where.id : true);

            if (matchDoctor && matchDate && matchStatus && matchIdNot && matchId) {
              appt.status = data.status;
              count++;
            }
          }
          return { count };
        },
        update: async ({ where, data }: any) => {
          await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5) + 1));
          const target = this.appointments.get(where.id);
          if (!target) {
            throw new Error(`Record ${where.id} not found`);
          }
          Object.assign(target, data);
          return { ...target };
        },
      },
    };

    try {
      const result = await fn(tx);
      // Track history of active consultations at commit
      const totalActive = Array.from(this.appointments.values()).filter((a) => a.status === 'IN_CONSULTATION').length;
      this.activeInConsultationHistory.push(totalActive);
      return result;
    } finally {
      // In PostgreSQL, row locks are held until transaction completion (commit or rollback)
      releaseFns.forEach((rel) => rel());
    }
  }
}

async function runAdversarialSuite() {
  console.log('=============================================================================');
  console.log('🛡️ EMPIRICAL CHALLENGER ITERATION 2 ADVERSARIAL STRESS SUITE');
  console.log('=============================================================================\n');

  const today = '2026-10-06';
  let totalTests = 0;
  let passedTests = 0;

  function assertTest(name: string, condition: boolean, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ PASS: ${name}`);
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      if (details) console.error(`         Reason: ${details}`);
    }
  }

  // --- Test 1: Massive Concurrency (20 concurrent callers for the same doctor) ---
  console.log('--- TEST 1: Massive Concurrency (20 Concurrent Callers, Same Doctor) ---');
  const appts20: AppointmentRecord[] = Array.from({ length: 20 }, (_, i) => ({
    id: `m-appt-${i + 1}`,
    doctorId: 'doc-heavy-1',
    appointmentDate: today,
    status: i === 0 ? 'IN_CONSULTATION' : 'WAITING',
    queueNumber: i + 1,
    patient: { user: { fullName: `Patient ${i + 1}` } },
  }));

  const db20 = new AdvancedDoctorLockedDb(appts20);

  const callers = Array.from({ length: 20 }, (_, i) => {
    const apptId = `m-appt-${i + 1}`;
    // Alternate between doctor callPatient and receptionist inConsultation
    if (i % 2 === 0) {
      return executeCallPatientTransaction(db20, 'doc-heavy-1', today, apptId);
    } else {
      return executeReceptionistInConsultationTransaction(db20, 'doc-heavy-1', today, apptId, { status: 'IN_CONSULTATION' });
    }
  });

  await Promise.all(callers);

  const finalInConsult20 = db20.getActiveConsultations('doc-heavy-1');
  assertTest(
    '20 simultaneous callers result in exactly 1 IN_CONSULTATION appointment',
    finalInConsult20.length === 1,
    `Found ${finalInConsult20.length} active consultations`
  );

  const finalWaiting20 = db20.getDoctorAppointments('doc-heavy-1').filter((a) => a.status === 'WAITING');
  assertTest(
    'Remaining 19 appointments for doc-heavy-1 are all WAITING',
    finalWaiting20.length === 19,
    `Found ${finalWaiting20.length} waiting appointments`
  );

  const rowLockQueries = db20.rawQueries.filter(
    (q) => q.query.includes('DoctorProfile') && q.query.includes('FOR UPDATE')
  );
  assertTest(
    'All 20 transactions executed row lock query with doctor ID bound',
    rowLockQueries.length === 20 && rowLockQueries.every((q) => q.values[0] === 'doc-heavy-1'),
    `Executed ${rowLockQueries.length} row lock queries`
  );

  // --- Test 2: Multi-Doctor Isolation (15 Concurrent Callers across 3 Doctors) ---
  console.log('\n--- TEST 2: Multi-Doctor Isolation (15 Concurrent Callers, 3 Doctors) ---');
  const multiAppts: AppointmentRecord[] = [];
  const doctorIds = ['doc-alpha', 'doc-beta', 'doc-gamma'];
  for (const docId of doctorIds) {
    for (let i = 1; i <= 5; i++) {
      multiAppts.push({
        id: `${docId}-appt-${i}`,
        doctorId: docId,
        appointmentDate: today,
        status: 'WAITING',
        queueNumber: i,
        patient: { user: { fullName: `Patient ${docId}-${i}` } },
      });
    }
  }

  const multiDb = new AdvancedDoctorLockedDb(multiAppts);
  const multiCallers: Promise<any>[] = [];

  for (const docId of doctorIds) {
    for (let i = 1; i <= 5; i++) {
      const apptId = `${docId}-appt-${i}`;
      if (i % 2 === 0) {
        multiCallers.push(executeCallPatientTransaction(multiDb, docId, today, apptId));
      } else {
        multiCallers.push(
          executeReceptionistInConsultationTransaction(multiDb, docId, today, apptId, { status: 'IN_CONSULTATION' })
        );
      }
    }
  }

  await Promise.all(multiCallers);

  for (const docId of doctorIds) {
    const active = multiDb.getActiveConsultations(docId);
    assertTest(
      `Doctor ${docId} has strictly 1 active consultation`,
      active.length === 1,
      `Found ${active.length} active consultations for ${docId}`
    );
    const waiting = multiDb.getDoctorAppointments(docId).filter((a) => a.status === 'WAITING');
    assertTest(
      `Doctor ${docId} has strictly 4 waiting appointments`,
      waiting.length === 4,
      `Found ${waiting.length} waiting appointments for ${docId}`
    );
  }

  const totalActiveAcrossAll = Array.from(multiDb.appointments.values()).filter((a) => a.status === 'IN_CONSULTATION');
  assertTest(
    'Total active consultations across 3 doctors equals exactly 3',
    totalActiveAcrossAll.length === 3,
    `Found ${totalActiveAcrossAll.length} total active consultations`
  );

  // --- Test 3: SQL Row Lock Query Inspection ---
  console.log('\n--- TEST 3: SQL Row Lock Query Structure & Injection Resistance ---');
  const sampleQuery = db20.rawQueries[0];
  const queryText = sampleQuery.query;
  assertTest(
    'SQL query targets "DoctorProfile" with FOR UPDATE clause',
    queryText.includes('FROM "DoctorProfile"') && queryText.includes('FOR UPDATE'),
    `Actual query text: ${queryText}`
  );
  assertTest(
    'SQL query uses parameterization (where id = ?) rather than raw string concatenation',
    sampleQuery.values.length > 0 && sampleQuery.values[0] === 'doc-heavy-1',
    `Query parameters: ${JSON.stringify(sampleQuery.values)}`
  );

  // --- Test 4: Fault Injection & Deadlock Freedom ---
  console.log('\n--- TEST 4: Fault Injection & Error Recovery (Deadlock Freedom) ---');
  const faultAppts: AppointmentRecord[] = [
    { id: 'f-1', doctorId: 'doc-fault', appointmentDate: today, status: 'WAITING', queueNumber: 1 },
    { id: 'f-2', doctorId: 'doc-fault', appointmentDate: today, status: 'WAITING', queueNumber: 2 },
  ];
  const faultDb = new AdvancedDoctorLockedDb(faultAppts);

  // Concurrently execute: a failing call (invalid appt id) and a valid call
  let errorCaught = false;
  try {
    await Promise.all([
      executeCallPatientTransaction(faultDb, 'doc-fault', today, 'non-existent-id').catch((err) => {
        errorCaught = true;
      }),
      executeCallPatientTransaction(faultDb, 'doc-fault', today, 'f-1'),
    ]);
  } catch (e) {
    // Expected error
  }

  assertTest('Fault injection caught expected missing appointment error', errorCaught);
  assertTest(
    'Valid appointment f-1 successfully reached IN_CONSULTATION despite concurrent fault',
    faultDb.appointments.get('f-1')?.status === 'IN_CONSULTATION'
  );

  // Next call must NOT deadlock
  let nextCallCompleted = false;
  try {
    await executeCallPatientTransaction(faultDb, 'doc-fault', today, 'f-2');
    nextCallCompleted = true;
  } catch (e) {
    nextCallCompleted = false;
  }
  assertTest(
    'Subsequent transaction executes without deadlock after prior error',
    nextCallCompleted && faultDb.appointments.get('f-2')?.status === 'IN_CONSULTATION'
  );

  // --- Test 5: Rapid Preemption Back-and-Forth ---
  console.log('\n--- TEST 5: Rapid Preemption Back-and-Forth Cycle ---');
  const cycleAppts: AppointmentRecord[] = [
    { id: 'c-1', doctorId: 'doc-cycle', appointmentDate: today, status: 'WAITING', queueNumber: 1 },
    { id: 'c-2', doctorId: 'doc-cycle', appointmentDate: today, status: 'WAITING', queueNumber: 2 },
  ];
  const cycleDb = new AdvancedDoctorLockedDb(cycleAppts);

  // Cycle: c-1 -> c-2 -> c-1 -> c-2
  await executeCallPatientTransaction(cycleDb, 'doc-cycle', today, 'c-1');
  await executeCallPatientTransaction(cycleDb, 'doc-cycle', today, 'c-2');
  await executeCallPatientTransaction(cycleDb, 'doc-cycle', today, 'c-1');
  await executeReceptionistInConsultationTransaction(cycleDb, 'doc-cycle', today, 'c-2', { status: 'IN_CONSULTATION' });

  assertTest(
    'End of alternating preemption cycle leaves exactly c-2 in IN_CONSULTATION',
    cycleDb.appointments.get('c-2')?.status === 'IN_CONSULTATION' &&
      cycleDb.appointments.get('c-1')?.status === 'WAITING'
  );

  // --- Test 6: Backward Compatibility without $executeRaw ---
  console.log('\n--- TEST 6: Graceful Compatibility when $executeRaw is Absent ---');
  const legacyAppts: AppointmentRecord[] = [
    { id: 'leg-1', doctorId: 'doc-leg', appointmentDate: today, status: 'WAITING', queueNumber: 1 },
    { id: 'leg-2', doctorId: 'doc-leg', appointmentDate: today, status: 'WAITING', queueNumber: 2 },
  ];
  const legacyDb = {
    $transaction: async (fn: any) => {
      // Mock tx WITHOUT $executeRaw property
      const tx = {
        appointment: {
          updateMany: async ({ where, data }: any) => {
            legacyAppts.forEach((a) => {
              if (a.id !== where.id?.not) a.status = data.status;
            });
            return { count: 1 };
          },
          update: async ({ where, data }: any) => {
            const found = legacyAppts.find((a) => a.id === where.id);
            if (found) Object.assign(found, data);
            return found;
          },
        },
      };
      return await fn(tx);
    },
  };

  let legacyDoctorOk = false;
  let legacyRecOk = false;
  try {
    await executeCallPatientTransaction(legacyDb, 'doc-leg', today, 'leg-1');
    legacyDoctorOk = legacyAppts.find((a) => a.id === 'leg-1')?.status === 'IN_CONSULTATION';
    await executeReceptionistInConsultationTransaction(legacyDb, 'doc-leg', today, 'leg-2', { status: 'IN_CONSULTATION' });
    legacyRecOk = legacyAppts.find((a) => a.id === 'leg-2')?.status === 'IN_CONSULTATION';
  } catch (e) {
    console.error('Legacy client error:', e);
  }

  assertTest(
    'executeCallPatientTransaction succeeds gracefully without $executeRaw',
    legacyDoctorOk
  );
  assertTest(
    'executeReceptionistInConsultationTransaction succeeds gracefully without $executeRaw',
    legacyRecOk
  );

  console.log('\n=============================================================================');
  console.log(`TOTAL ADVERSARIAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log('=============================================================================\n');

  if (totalTests !== passedTests) {
    process.exit(1);
  }
}

runAdversarialSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
