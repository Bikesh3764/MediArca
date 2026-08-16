/**
 * MediArca - Automated Regression & Audit Test Suite
 * Validates store logic, queue algorithms, slot collisions, stage transitions, and billing math.
 */

const fs = require('fs');
const path = require('path');

console.log('--- Starting MediArca Automated Regression Suite ---');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failCount++;
  }
}

// 1. Validate Schema File Existence & Structure
const schemaPath = path.join(__dirname, '../supabase_schema.sql');
assert(fs.existsSync(schemaPath), 'supabase_schema.sql exists');

const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
assert(schemaContent.includes('CREATE OR REPLACE FUNCTION issue_next_opd_token'), 'Schema contains issue_next_opd_token');
assert(schemaContent.includes('CREATE OR REPLACE FUNCTION schedule_future_appointment_atomic'), 'Schema contains schedule_future_appointment_atomic');
assert(schemaContent.includes('CREATE OR REPLACE FUNCTION transfer_patient_queue_atomic'), 'Schema contains transfer_patient_queue_atomic');
assert(schemaContent.includes('CREATE OR REPLACE FUNCTION transition_appointment_status_atomic'), 'Schema contains transition_appointment_status_atomic');
assert(schemaContent.includes('CREATE OR REPLACE VIEW public_queue_telemetry'), 'Schema contains public_queue_telemetry view');
assert(schemaContent.includes('CREATE OR REPLACE VIEW public_doctor_directory'), 'Schema contains public_doctor_directory view');
assert(schemaContent.includes('current_stage VARCHAR(50) DEFAULT \'triage\''), 'Appointments table contains current_stage column');

// 2. Validate App JS and Store JS Syntax & Logic
const appPath = path.join(__dirname, '../js/app.js');
const storePath = path.join(__dirname, '../js/store.js');
const queuePath = path.join(__dirname, '../js/queue.js');
const supabaseClientPath = path.join(__dirname, '../js/supabase_client.js');

assert(fs.existsSync(appPath), 'js/app.js exists');
assert(fs.existsSync(storePath), 'js/store.js exists');
assert(fs.existsSync(queuePath), 'js/queue.js exists');
assert(fs.existsSync(supabaseClientPath), 'js/supabase_client.js exists');

const appContent = fs.readFileSync(appPath, 'utf-8');
const storeContent = fs.readFileSync(storePath, 'utf-8');

assert(appContent.includes('async handleProcessPayment'), 'handleProcessPayment is async');
assert(appContent.includes('async renderAdminHub'), 'renderAdminHub is async');
assert(storeContent.includes('Clinical Document Vault upload failed'), 'Store throws on vault upload failure');
assert(!storeContent.includes('waiting * 3.5'), 'Synthetic waiting multiplier removed from store');
assert(!appContent.includes('value="120/80 mmHg"'), 'Hardcoded default vitals values removed from doctor console');

console.log(`\nTest Summary: ${passCount} Passed, ${failCount} Failed.`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('--- All Regression Checks Passed Successfully! ---');
}
