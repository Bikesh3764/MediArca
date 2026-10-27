/**
 * Password hashing and checking, run on a background thread (FIX-049).
 *
 * bcryptjs is plain JavaScript. One check takes ~60 ms on a fast PC and ~0.4 s on the live
 * server's 0.15 CPU, and while it runs the server can't answer anyone else. Ten people
 * signing in together used to freeze the live queue for ~4 s. The work now runs in a worker
 * thread, so the API keeps answering while passwords are checked.
 *
 * If the worker can't start or dies, the same work runs in-process, so sign-in never breaks.
 */
import { Worker } from 'worker_threads';
import crypto from 'crypto';
import os from 'os';
import bcrypt from 'bcryptjs';

type Job = { op: 'compare' | 'hash'; a: string; b: string | number };
type Pending = Job & { resolve: (v: any) => void; reject: (e: Error) => void };

const WORKER_SOURCE = `
const { parentPort } = require('worker_threads');
const bcrypt = require(${JSON.stringify(require.resolve('bcryptjs'))});
parentPort.on('message', ({ id, op, a, b }) => {
  try {
    const result = op === 'compare' ? bcrypt.compareSync(a, b) : bcrypt.hashSync(a, b);
    parentPort.postMessage({ id, result });
  } catch (e) {
    parentPort.postMessage({ id, error: String((e && e.message) || e) });
  }
});
`;

// Two threads: a burst of sign-ins finishes as fast as before, and the main thread stays free.
const POOL_SIZE = Math.max(1, Math.min(2, (os.availableParallelism?.() ?? os.cpus().length) - 1));

type Slot = { worker: Worker; busy: number };
const pool: Slot[] = [];
let workerBroken = false;
let nextId = 0;
const pending = new Map<number, Pending & { slot: Slot }>();

const runInline = (job: Job): Promise<any> =>
  job.op === 'compare' ? bcrypt.compare(job.a, job.b as string) : bcrypt.hash(job.a, job.b as number);

const startWorker = (): Slot | null => {
  try {
    const w = new Worker(WORKER_SOURCE, { eval: true });
    const slot: Slot = { worker: w, busy: 0 };
    w.on('message', (m: { id: number; result?: any; error?: string }) => {
      const job = pending.get(m.id);
      if (!job) return;
      pending.delete(m.id);
      slot.busy -= 1;
      if (slot.busy === 0) w.unref();
      if (m.error !== undefined) job.reject(new Error(m.error));
      else job.resolve(m.result);
    });
    let failed = false;
    const recover = (err: unknown) => {
      if (failed) return;
      failed = true;
      workerBroken = true;
      const i = pool.indexOf(slot);
      if (i >= 0) pool.splice(i, 1);
      console.error('[passwords] background thread failed, checking passwords in-process:', (err as any)?.message || err);
      // Finish whatever was waiting on the dead thread
      for (const [id, job] of pending) {
        if (job.slot !== slot) continue;
        pending.delete(id);
        runInline(job).then(job.resolve, job.reject);
      }
    };
    w.on('error', recover);
    w.on('exit', (code) => recover(new Error(`exited with code ${code}`)));
    w.unref();
    return slot;
  } catch (err) {
    workerBroken = true;
    console.error('[passwords] could not start background thread:', (err as any)?.message || err);
    return null;
  }
};

/** The least busy thread, starting threads up to the pool size; null means run in-process. */
const pickSlot = (): Slot | null => {
  if (workerBroken || process.env.PASSWORD_WORKER === 'off') return null;
  const idle = pool.find((p) => p.busy === 0);
  if (idle) return idle;
  if (pool.length < POOL_SIZE) {
    const slot = startWorker();
    if (slot) pool.push(slot);
    return slot;
  }
  return pool.reduce((a, b) => (b.busy < a.busy ? b : a));
};

const run = (job: Job): Promise<any> => {
  const slot = pickSlot();
  if (!slot) return runInline(job);
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { ...job, resolve, reject, slot });
    slot.busy += 1;
    try {
      slot.worker.ref(); // keep the process alive while a check is waiting
      slot.worker.postMessage({ id, op: job.op, a: job.a, b: job.b });
    } catch {
      // Values the thread can't receive: do it here instead
      pending.delete(id);
      slot.busy -= 1;
      if (slot.busy === 0) slot.worker.unref();
      runInline(job).then(resolve, reject);
    }
  });
};

/** Does `plain` match the stored bcrypt `hash`? */
export const verifyPassword = (plain: string, hash: string): Promise<boolean> => run({ op: 'compare', a: plain, b: hash });

/** bcrypt hash of `plain` (10 rounds unless told otherwise). */
export const hashPassword = (plain: string, rounds = 10): Promise<string> => run({ op: 'hash', a: plain, b: rounds });

/**
 * Hash for accounts nobody signs in to with a password (walk-ins). The secret is 256 random
 * bits that are never stored or shown, so guessing it is impossible whatever the bcrypt cost;
 * 4 rounds keeps it at ~1 ms instead of the ~1.5 s that 12 rounds took on the live server.
 */
export const createUnusablePasswordHash = (): string => bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 4);
