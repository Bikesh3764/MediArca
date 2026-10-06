/**
 * MediArca Milestone 3 - Challenger 1 Empirical Stress Harness
 * 
 * Adversarial Testing Scope:
 * 1. Concurrency Stress: Interleaved parallel transactions competing for IN_CONSULTATION per doctor
 * 2. Sequential vs Concurrent Verification: Demonstrating why Test 161 masked the concurrency gap
 * 3. Serialization Mitigation Proof: Proving that row locking or serialization eliminates the race
 * 4. Atomic CAS Completion: Concurrent double-completion and cancellation race resistance
 * 5. Reschedule Target Invariants Fuzzing: 1,920 boundary and type permutations
 * 6. CORS Policy & Subdomain Smuggling: Comprehensive penetration checks
 * 7. Process Crash Resilience: Process event handlers verification
 */

process.env.MEDIARCA_TEST_SUITE = 'true';
import { executeCallPatientTransaction, executeCompleteConsultationAtomic } from '../src/controllers/consultationController';
import { executeReceptionistInConsultationTransaction, determineRescheduleTarget } from '../src/controllers/receptionistController';
import { checkCorsOrigin, registerProcessHandlers } from '../src/server';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(category: string, name: string, passed: boolean, details?: string) {
  results.push({ category, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${icon}: [${category}] ${name}`);
  if (details && !passed) {
    console.log(`         Details: ${details}`);
  }
}

// Database Simulator supporting both standard Read-Committed (unlocked) and Serialized/Locked modes
class DatabaseSimulator {
  appointments: Map<string, any> = new Map();
  doctorLocks: Map<string, Promise<void>> = new Map();
  mode: 'READ_COMMITTED_UNLOCKED' | 'SERIALIZED_OR_LOCKED';

  constructor(initialAppointments: any[] = [], mode: 'READ_COMMITTED_UNLOCKED' | 'SERIALIZED_OR_LOCKED' = 'READ_COMMITTED_UNLOCKED') {
    this.mode = mode;
    for (const appt of initialAppointments) {
      this.appointments.set(appt.id, { ...appt });
    }
  }

  // Mutex simulation for SERIALIZED_OR_LOCKED
  private mutexChain: Promise<any> = Promise.resolve();

  async $transaction(fn: (tx: any) => Promise<any>) {
    if (this.mode === 'SERIALIZED_OR_LOCKED') {
      const current = this.mutexChain;
      let release: () => void = () => {};
      this.mutexChain = new Promise<void>((resolve) => {
        release = resolve;
      });
      await current;
      try {
        return await this.executeTx(fn);
      } finally {
        release();
      }
    } else {
      // READ_COMMITTED_UNLOCKED: allows concurrent execution with network/disk jitter
      return await this.executeTx(fn);
    }
  }

  private async executeTx(fn: (tx: any) => Promise<any>) {
    const tx = {
      appointment: {
        updateMany: async ({ where, data }: any) => {
          // Simulate query execution time
          await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 4) + 1));
          let count = 0;
          for (const record of this.appointments.values()) {
            const matchDoctor = !where.doctorId || record.doctorId === where.doctorId;
            const matchDate = !where.appointmentDate || record.appointmentDate === where.appointmentDate;
            const matchStatus = !where.status || record.status === where.status;
            const matchIdNot = !where.id?.not || record.id !== where.id.not;
            const matchId = !where.id || (typeof where.id === 'string' ? record.id === where.id : true);

            if (matchDoctor && matchDate && matchStatus && matchIdNot && matchId) {
              Object.assign(record, data);
              count++;
            }
          }
          return { count };
        },
        update: async ({ where, data }: any) => {
          await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 4) + 1));
          const record = this.appointments.get(where.id);
          if (!record) throw new Error(`Appointment ${where.id} not found`);
          Object.assign(record, data);
          return { ...record };
        },
        findUnique: async ({ where }: any) => {
          await new Promise((r) => setTimeout(r, 1));
          const record = this.appointments.get(where.id);
          return record ? { ...record } : null;
        },
      },
    };

    return await fn(tx);
  }

  get appointment() {
    return {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const record of this.appointments.values()) {
          const matchDoctor = !where.doctorId || record.doctorId === where.doctorId;
          const matchId = !where.id || record.id === where.id;
          const matchStatus = !where.status || record.status === where.status;
          if (matchDoctor && matchId && matchStatus) {
            Object.assign(record, data);
            count++;
          }
        }
        return { count };
      },
      findUnique: async ({ where }: any) => {
        const record = this.appointments.get(where.id);
        return record ? { ...record } : null;
      },
    };
  }
}

async function runEmpiricalStressSuite() {
  console.log('=============================================================================');
  console.log('🔍 MEDIARCA EMPIRICAL STRESS TEST & ADVERSARIAL CHALLENGER SUITE (M3)');
  console.log('=============================================================================\n');

  const today = '2026-10-06';

  // -------------------------------------------------------------------------
  // SECTION 1: Sequential Concurrency Test (Baseline Test Suite 161 Reproduction)
  // -------------------------------------------------------------------------
  console.log('--- SECTION 1: Reproduction of Worker Suite 161 (Sequential Transactions) ---');
  const seqAppts = [
    { id: 'seq-1', doctorId: 'doc-1', appointmentDate: today, status: 'IN_CONSULTATION', queueNumber: 1, patient: { user: { fullName: 'A' } } },
    { id: 'seq-2', doctorId: 'doc-1', appointmentDate: today, status: 'WAITING', queueNumber: 2, patient: { user: { fullName: 'B' } } },
    { id: 'seq-3', doctorId: 'doc-1', appointmentDate: today, status: 'WAITING', queueNumber: 3, patient: { user: { fullName: 'C' } } },
  ];
  const dbSeq = new DatabaseSimulator(seqAppts, 'READ_COMMITTED_UNLOCKED');

  // Step 1: Doctor calls seq-2 sequentially
  await executeCallPatientTransaction(dbSeq, 'doc-1', today, 'seq-2');
  const seqInConsult1 = Array.from(dbSeq.appointments.values()).filter((a) => a.status === 'IN_CONSULTATION');
  recordTest(
    'Sequential Baseline',
    'Sequential callPatient transitions seq-2 to IN_CONSULTATION and resets seq-1 to WAITING',
    seqInConsult1.length === 1 && seqInConsult1[0].id === 'seq-2'
  );

  // Step 2: Receptionist calls seq-3 sequentially
  await executeReceptionistInConsultationTransaction(dbSeq, 'doc-1', today, 'seq-3', { status: 'IN_CONSULTATION' });
  const seqInConsult2 = Array.from(dbSeq.appointments.values()).filter((a) => a.status === 'IN_CONSULTATION');
  recordTest(
    'Sequential Baseline',
    'Sequential receptionist call transitions seq-3 to IN_CONSULTATION and resets seq-2 to WAITING',
    seqInConsult2.length === 1 && seqInConsult2[0].id === 'seq-3'
  );

  // -------------------------------------------------------------------------
  // SECTION 2: Adversarial Concurrent Race (Why Unlocked Transactions Suffer Write Skew)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Adversarial Concurrent Race Condition Challenge ---');
  const raceAppts = [
    { id: 'race-1', doctorId: 'doc-1', appointmentDate: today, status: 'IN_CONSULTATION', queueNumber: 1, patient: { user: { fullName: 'A' } } },
    { id: 'race-2', doctorId: 'doc-1', appointmentDate: today, status: 'WAITING', queueNumber: 2, patient: { user: { fullName: 'B' } } },
    { id: 'race-3', doctorId: 'doc-1', appointmentDate: today, status: 'WAITING', queueNumber: 3, patient: { user: { fullName: 'C' } } },
    { id: 'race-4', doctorId: 'doc-1', appointmentDate: today, status: 'WAITING', queueNumber: 4, patient: { user: { fullName: 'D' } } },
  ];
  // Under PostgreSQL default Read Committed isolation, multiple transactions interleaved without row lock on DoctorProfile
  const dbUnlocked = new DatabaseSimulator(raceAppts, 'READ_COMMITTED_UNLOCKED');

  // Doctor calls race-2 while Receptionist calls race-3 at the exact same millisecond
  await Promise.all([
    executeCallPatientTransaction(dbUnlocked, 'doc-1', today, 'race-2'),
    executeReceptionistInConsultationTransaction(dbUnlocked, 'doc-1', today, 'race-3', { status: 'IN_CONSULTATION' }),
  ]);

  const concurrentInConsult = Array.from(dbUnlocked.appointments.values()).filter((a) => a.status === 'IN_CONSULTATION');
  const unlockedHasMultipleActive = concurrentInConsult.length > 1;

  recordTest(
    'Adversarial Concurrency',
    'EMPIRICAL FINDING: Unlocked concurrent transactions without Doctor row-lock produce phantom multiple active consultations under Read Committed',
    unlockedHasMultipleActive, // We test and confirm this failure mode exists!
    `Found ${concurrentInConsult.length} active consultations simultaneously: ${concurrentInConsult.map((a) => a.id).join(', ')}`
  );

  // -------------------------------------------------------------------------
  // SECTION 3: Serialized / Row-Locked Mitigation Verification
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Mitigation Verification (Serialized / FOR UPDATE Row-Locking) ---');
  const lockedAppts = [
    { id: 'lock-1', doctorId: 'doc-1', appointmentDate: today, status: 'IN_CONSULTATION', queueNumber: 1, patient: { user: { fullName: 'A' } } },
    { id: 'lock-2', doctorId: 'doc-1', appointmentDate: today, status: 'WAITING', queueNumber: 2, patient: { user: { fullName: 'B' } } },
    { id: 'lock-3', doctorId: 'doc-1', appointmentDate: today, status: 'WAITING', queueNumber: 3, patient: { user: { fullName: 'C' } } },
    { id: 'lock-4', doctorId: 'doc-1', appointmentDate: today, status: 'WAITING', queueNumber: 4, patient: { user: { fullName: 'D' } } },
  ];
  const dbLocked = new DatabaseSimulator(lockedAppts, 'SERIALIZED_OR_LOCKED');

  // Concurrent calls under serialized isolation / row-locked doctor
  await Promise.all([
    executeCallPatientTransaction(dbLocked, 'doc-1', today, 'lock-2'),
    executeReceptionistInConsultationTransaction(dbLocked, 'doc-1', today, 'lock-3', { status: 'IN_CONSULTATION' }),
    executeCallPatientTransaction(dbLocked, 'doc-1', today, 'lock-4'),
  ]);

  const lockedInConsult = Array.from(dbLocked.appointments.values()).filter((a) => a.status === 'IN_CONSULTATION');
  recordTest(
    'Mitigation Proof',
    'With transaction serialization or DoctorProfile FOR UPDATE lock, strictly 1 active consultation is guaranteed',
    lockedInConsult.length === 1,
    `Active consultation: ${lockedInConsult.map((a) => a.id).join(', ')}`
  );

  // -------------------------------------------------------------------------
  // SECTION 4: Atomic CAS Complete Consultation Verification
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Atomic CAS Complete Consultation Verification ---');
  const dbCAS = new DatabaseSimulator([
    {
      id: 'cas-appt-1',
      doctorId: 'doc-alpha',
      appointmentDate: today,
      status: 'IN_CONSULTATION',
      clinicalNotes: '',
    },
  ]);

  // 10 concurrent complete attempts (CAS simulation)
  const completePromises = Array.from({ length: 10 }, (_, i) =>
    executeCompleteConsultationAtomic(dbCAS, 'doc-alpha', 'cas-appt-1', {
      clinicalNotes: `Notes from attempt ${i}`,
    })
  );
  const casResults = await Promise.all(completePromises);
  const successes = casResults.filter((r) => r !== null);

  recordTest(
    'Atomic CAS Complete',
    'CAS updateMany ensures exactly 1 successful complete operation among 10 concurrent calls',
    successes.length === 1
  );

  recordTest(
    'Atomic CAS Complete',
    'Subsequent completion on already COMPLETED appointment returns null (prevents duplicate completion)',
    (await executeCompleteConsultationAtomic(dbCAS, 'doc-alpha', 'cas-appt-1', { clinicalNotes: 'Late note' })) === null
  );

  // Cancellation race test
  dbCAS.appointments.set('cas-appt-2', {
    id: 'cas-appt-2',
    doctorId: 'doc-alpha',
    appointmentDate: today,
    status: 'CANCELLED',
  });
  const cancelAttempt = await executeCompleteConsultationAtomic(dbCAS, 'doc-alpha', 'cas-appt-2', { clinicalNotes: 'Late' });
  recordTest(
    'Atomic CAS Complete',
    'executeCompleteConsultationAtomic rejects CANCELLED appointment without overwriting status',
    cancelAttempt === null && dbCAS.appointments.get('cas-appt-2').status === 'CANCELLED'
  );

  // -------------------------------------------------------------------------
  // SECTION 5: determineRescheduleTarget Fuzzing
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 5: determineRescheduleTarget Exhaustive Fuzzing ---');
  const statuses = ['PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED'];
  const paymentStatuses = ['PAID', 'PENDING', 'UNPAID', 'REFUNDED', undefined, ''];
  const minNegativeVals = [null, undefined, -1, -2, -10, -999, 0, 5];
  const maxPositiveVals = [null, undefined, 0, 1, 5, 50, 999, -5];

  let fuzzViolations = 0;
  let totalFuzzCases = 0;

  for (const s of statuses) {
    for (const p of paymentStatuses) {
      for (const minNeg of minNegativeVals) {
        for (const maxPos of maxPositiveVals) {
          totalFuzzCases++;
          const res = determineRescheduleTarget(s, minNeg, maxPos, p);
          const isPendingExpected = s === 'PENDING_APPROVAL' || (p !== undefined && p !== 'PAID');

          if (isPendingExpected) {
            if (res.targetStatus !== 'PENDING_APPROVAL' || res.queueNumber >= 0) {
              fuzzViolations++;
            }
          } else {
            if (res.targetStatus !== 'WAITING' || res.queueNumber <= 0) {
              fuzzViolations++;
            }
          }
        }
      }
    }
  }

  recordTest(
    'Reschedule Fuzzing',
    `Fuzzed all ${totalFuzzCases} input combinations with 0 invariant violations`,
    fuzzViolations === 0,
    `Violations found: ${fuzzViolations}`
  );

  // -------------------------------------------------------------------------
  // SECTION 6: CORS Penetration & HTTP Status Code 403
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 6: CORS Origin Rejection & HTTP 403 Status Code ---');
  const allowed = ['https://mediarca.vercel.app', 'http://localhost:5173'];
  const attackOrigins = [
    'https://mediarca.vercel.app.attacker.io',
    'https://spoofed-mediarca.vercel.app',
    'http://localhost:5173.evil.org',
    'http://127.0.0.1:9999',
    'null',
  ];

  let allAttacksBlockedWith403 = true;
  for (const origin of attackOrigins) {
    checkCorsOrigin(origin, true, allowed, (err: any, allow?: boolean) => {
      if (!err || (err as any).status !== 403 || allow) {
        allAttacksBlockedWith403 = false;
      }
    });
  }

  recordTest(
    'CORS Policy',
    'All unauthorized/smuggled origins rejected with explicit status 403 in production',
    allAttacksBlockedWith403
  );

  let legitPassed = false;
  checkCorsOrigin('https://mediarca.vercel.app', true, allowed, (err: any, allow?: boolean) => {
    legitPassed = !err && !!allow;
  });
  recordTest('CORS Policy', 'Whitelisted production origin passes CORS check', legitPassed);

  let missingOriginPassed = false;
  checkCorsOrigin(undefined, true, allowed, (err: any, allow?: boolean) => {
    missingOriginPassed = !err && !!allow;
  });
  recordTest('CORS Policy', 'Non-browser / mobile requests without origin header pass CORS check', missingOriginPassed);

  let devModePassed = false;
  checkCorsOrigin('http://anything.test', false, allowed, (err: any, allow?: boolean) => {
    devModePassed = !err && !!allow;
  });
  recordTest('CORS Policy', 'Development mode bypasses CORS restrictions', devModePassed);

  // -------------------------------------------------------------------------
  // SECTION 7: Node.js Process Crash Resilience Listeners
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Process Crash Resilience Event Listeners ---');
  registerProcessHandlers();
  const unhandledRejCount = process.listenerCount('unhandledRejection');
  const uncaughtExcCount = process.listenerCount('uncaughtException');

  recordTest('Process Resilience', 'Top-level unhandledRejection listener registered', unhandledRejCount >= 1);
  recordTest('Process Resilience', 'Top-level uncaughtException listener registered', uncaughtExcCount >= 1);

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n=============================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('=============================================================================\n');
}

runEmpiricalStressSuite().catch((e) => {
  console.error('Empirical harness execution error:', e);
  process.exit(1);
});
