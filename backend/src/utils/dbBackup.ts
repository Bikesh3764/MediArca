/**
 * Nightly database backup to a private Cloudflare R2 bucket (FIX-050).
 *
 * Supabase's free plan has no backup the owner can download. Once a day (after 3 AM IST)
 * the server runs pg_dump on the `public` schema and saves the file as
 * `daily/YYYY-MM-DD.dump` in the private bucket. The last 14 days are kept.
 * A missed night is made up the next time the server checks.
 *
 * Restore steps: docs/operations/database-backup.md
 */
import { spawn } from 'child_process';
import { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, isR2Configured } from '../config/r2';

export const BACKUP_BUCKET = process.env.DB_BACKUP_BUCKET || 'mediarca-db-backups';
export const BACKUP_KEEP_DAYS = 14;
export const BACKUP_HOUR_IST = 3;
const CHECK_EVERY_MS = 30 * 60 * 1000;
const FIRST_CHECK_MS = 2 * 60 * 1000;
const DUMP_TIMEOUT_MS = 5 * 60 * 1000;

/** YYYY-MM-DD in Indian time. */
export const istDate = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Hour 0–23 in Indian time. */
export const istHour = (d: Date = new Date()): number =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(d));

export const backupKey = (date: string): string => `daily/${date}.dump`;

const keyDate = (key: string): string | null => key.match(/^daily\/(\d{4}-\d{2}-\d{2})\.dump$/)?.[1] ?? null;

/** Backups older than the last `keepDays` days (today counts as one). */
export const keysToDelete = (keys: string[], today: string, keepDays = BACKUP_KEEP_DAYS): string[] => {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (keepDays - 1));
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  return keys.filter((k) => {
    const d = keyDate(k);
    return d !== null && d < cutoffDate;
  });
};

/** Run after 3 AM IST, once per Indian day. */
export const shouldBackUpNow = (now: Date, lastBackupDate: string | null): boolean =>
  istHour(now) >= BACKUP_HOUR_IST && lastBackupDate !== istDate(now);

/**
 * Connection string pg_dump understands. Prisma-only options (pgbouncer, connection_limit…)
 * are dropped, and the Supabase transaction pooler (6543) is swapped for session mode (5432),
 * which pg_dump needs.
 */
export const pgDumpUrl = (raw: string): string => {
  const u = new URL(raw);
  const keep = new URLSearchParams();
  const sslmode = u.searchParams.get('sslmode');
  if (sslmode) keep.set('sslmode', sslmode);
  u.search = keep.toString();
  if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') u.port = '5432';
  return u.toString();
};

const runPgDump = (url: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'pg_dump',
      ['--format=custom', '--no-owner', '--no-privileges', '--schema=public', `--dbname=${url}`],
      { env: { ...process.env, PGCONNECT_TIMEOUT: '20' } }
    );
    const out: Buffer[] = [];
    let err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), DUMP_TIMEOUT_MS);
    child.stdout.on('data', (c: Buffer) => out.push(c));
    child.stderr.on('data', (c: Buffer) => {
      err += c.toString();
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`pg_dump exited with ${code}: ${err.trim().slice(0, 500)}`));
    });
  });

const listBackupKeys = async (): Promise<string[]> => {
  const client = getR2Client();
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: BACKUP_BUCKET, Prefix: 'daily/', ContinuationToken: token })
    );
    for (const o of page.Contents || []) if (o.Key) keys.push(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
};

/** Latest backup date already in the bucket, or null. */
export const latestBackupDate = async (): Promise<string | null> => {
  const dates = (await listBackupKeys()).map(keyDate).filter((d): d is string => d !== null).sort();
  return dates.length ? dates[dates.length - 1] : null;
};

/** Dump, upload, prune. Returns the saved key and size. */
export const runDbBackup = async (now: Date = new Date()): Promise<{ key: string; bytes: number }> => {
  const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!raw) throw new Error('no database URL');
  const dump = await runPgDump(pgDumpUrl(raw));
  if (dump.length === 0) throw new Error('pg_dump produced an empty file');

  const today = istDate(now);
  const key = backupKey(today);
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({ Bucket: BACKUP_BUCKET, Key: key, Body: dump, ContentType: 'application/octet-stream' })
  );

  for (const old of keysToDelete(await listBackupKeys(), today)) {
    await client.send(new DeleteObjectCommand({ Bucket: BACKUP_BUCKET, Key: old })).catch(() => {});
  }
  return { key, bytes: dump.length };
};

let timer: NodeJS.Timeout | null = null;

/** Start the daily check. Live server only; DB_BACKUP=off turns it off. */
export const startDbBackupSchedule = (): void => {
  if (timer || process.env.NODE_ENV !== 'production' || process.env.DB_BACKUP === 'off') return;
  if (!isR2Configured()) {
    console.warn('[backup] R2 is not configured; nightly database backup is off');
    return;
  }

  let lastDate: string | null | undefined; // undefined = not looked up yet
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      if (lastDate === undefined) lastDate = await latestBackupDate();
      const now = new Date();
      if (!shouldBackUpNow(now, lastDate)) return;
      const started = Date.now();
      const { key, bytes } = await runDbBackup(now);
      lastDate = istDate(now);
      console.log(`[backup] saved ${key} (${Math.round(bytes / 1024)} KB, ${Date.now() - started} ms)`);
    } catch (e: any) {
      if (e?.code === 'ENOENT') {
        stopped = true;
        console.error('[backup] pg_dump is not installed; nightly database backup is off');
      } else {
        console.error('[backup] failed, will retry in 30 min:', e?.message || e);
      }
    } finally {
      running = false;
    }
  };

  setTimeout(() => void tick(), FIRST_CHECK_MS).unref();
  timer = setInterval(() => void tick(), CHECK_EVERY_MS);
  timer.unref();
};
