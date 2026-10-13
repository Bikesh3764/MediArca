const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Production Prisma Migration Runner with Baseline Resolution Safety
 * Ensures pending migrations are automatically deployed on Render/production release.
 */
function getMigrationDirectories() {
  try {
    const migrationsDir = path.join(__dirname, '../prisma/migrations');
    if (!fs.existsSync(migrationsDir)) return ['20261007000000_0001_baseline_production_schema'];
    const dirs = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    return dirs.length > 0 ? dirs : ['20261007000000_0001_baseline_production_schema'];
  } catch {
    return ['20261007000000_0001_baseline_production_schema'];
  }
}

function runMigrations() {
  console.log('[Prisma Migrate] Checking and applying database migrations...');
  
  if (!process.env.DATABASE_URL) {
    console.warn('[Prisma Migrate] No DATABASE_URL found in environment. Skipping migration deployment.');
    return;
  }

  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }

  try {
    const output = execSync('npx prisma migrate deploy', { stdio: 'pipe', encoding: 'utf8' });
    console.log(output);
    console.log('[Prisma Migrate] Migrations deployed successfully.');
  } catch (err) {
    const errorMsg = (err.stdout || '') + (err.stderr || '') + (err.message || '');
    console.warn('[Prisma Migrate] Standard migrate deploy returned notice/error:', errorMsg);

    // If the database was created prior to migrations and requires baseline marking
    if (errorMsg.includes('P3005') || errorMsg.includes('database is not empty') || errorMsg.includes('baseline')) {
      console.log('[Prisma Migrate] Existing un-baselined database detected. Resolving baseline migration...');
      try {
        const migrationDirs = getMigrationDirectories();
        const baselineDir = migrationDirs[0] || '20261007000000_0001_baseline_production_schema';
        execSync(`npx prisma migrate resolve --applied ${baselineDir}`, {
          stdio: 'inherit',
        });
        console.log('[Prisma Migrate] Baseline marked as applied. Retrying migrate deploy...');
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        console.log('[Prisma Migrate] Migrations deployed successfully after baseline resolution.');
      } catch (baselineErr) {
        console.error('[Prisma Migrate] Failed during baseline resolution:', baselineErr.message);
        if (process.env.CI || process.env.NODE_ENV === 'production') {
          process.exit(1);
        }
      }
    } else {
      console.error('[Prisma Migrate] Migration deployment warning:', err.message);
      if (process.env.CI || process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}

async function syncCompositeIndexes() {
  if (!process.env.DATABASE_URL) return;
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";');
      await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "User_email_key";');
      await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "User_email_role_key" ON "User"("email", "role");');
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");');
      await prisma.$executeRawUnsafe('ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_doctorId_appointmentDate_queueNumber_key";');
      await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "Appointment_doctorId_appointmentDate_queueNumber_key";');
      await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "Appointment_clinicId_doctorId_appointmentDate_queueNumber_key";');
      await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_clinicId_doctorId_appointmentDate_slotId_queueNumber_key" ON "Appointment"("clinicId", "doctorId", "appointmentDate", "slotId", "queueNumber");');
      console.log('[Prisma Migrate] Composite uniqueness indexes verified.');
    } finally {
      await prisma.$disconnect();
    }
  } catch (err) {
    console.warn('[Prisma Migrate] Non-fatal notice during index verification:', err.message);
  }
}

async function main() {
  runMigrations();
  await syncCompositeIndexes();
}

main();
