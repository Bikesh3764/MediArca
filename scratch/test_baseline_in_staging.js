// Test Baseline Migration in Staging Schema
const fs = require('fs');

const migrationSql = fs.readFileSync('backend/prisma/migrations/20261007000000_0001_baseline_production_schema/migration.sql', 'utf8');

// Prepend setting search_path to staging_test
const testSql = `
CREATE SCHEMA IF NOT EXISTS staging_test;
SET search_path TO staging_test;

${migrationSql}
`;

fs.writeFileSync('scratch/staging_baseline_exec.sql', testSql, 'utf8');
console.log('Created scratch/staging_baseline_exec.sql with length:', testSql.length);
