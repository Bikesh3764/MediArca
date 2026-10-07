const { execSync } = require('child_process');

/**
 * Production Prisma Migration Runner with Baseline Resolution Safety
 * Ensures pending migrations are automatically deployed on Render/production release.
 */
function runMigrations() {
  console.log('[Prisma Migrate] Checking and applying database migrations...');
  
  if (!process.env.DATABASE_URL) {
    console.warn('[Prisma Migrate] No DATABASE_URL found in environment. Skipping migration deployment.');
    return;
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
        execSync('npx prisma migrate resolve --applied 20261007000000_0001_baseline_production_schema', {
          stdio: 'inherit',
        });
        console.log('[Prisma Migrate] Baseline marked as applied. Retrying migrate deploy...');
        execSync('npx prisma migrate deploy', { stdio: 'inherit' });
        console.log('[Prisma Migrate] Migrations deployed successfully after baseline resolution.');
      } catch (baselineErr) {
        console.error('[Prisma Migrate] Failed during baseline resolution:', baselineErr.message);
        if (process.env.CI) {
          process.exit(1);
        }
      }
    } else {
      console.error('[Prisma Migrate] Migration deployment warning:', err.message);
      if (process.env.CI) {
        process.exit(1);
      }
    }
  }
}

runMigrations();
