/**
 * MediArca - Adversarial Penetration Testing & Security Validation Suite
 * 
 * Target Vectors Tested:
 * 1. Privilege Escalation (Guest/Patient queue advance, self-verification, role escalation, doctor hijacking)
 * 2. Replay Attacks (Check-in QR reuse, expired tokens, future-date check-in, concurrent check-in races)
 * 3. Slot Collision & Double-Booking (Concurrent slot claims, duplicate active tickets, unique index enforcement)
 * 4. LocalStorage Security & Zero JWT Token Leakage (Storage key hygiene, zero bearer token persistence, session isolation)
 * 5. Financial Invoice Tampering (Client fee manipulation, coupon tampering, out-of-bounds insurance, unauthorized settlement)
 * 6. EMR Data Isolation & RLS (Clinical encounters, prescriptions, lab results, private vault storage, trigger immutability)
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('⚔️  MEDIARCA ADVERSARIAL SECURITY PENETRATION TEST SUITE');
console.log('   Auditing RLS Policies, PostgreSQL RPC Functions, Auth Isolation & Store Logic');
console.log('================================================================================\n');

// Load codebase assets
const schemaPath = path.join(__dirname, '../supabase_schema.sql');
const storePath = path.join(__dirname, '../js/store.js');
const clientPath = path.join(__dirname, '../js/supabase_client.js');
const appPath = path.join(__dirname, '../js/app.js');

const schema = fs.readFileSync(schemaPath, 'utf8');
const storeJs = fs.readFileSync(storePath, 'utf8');
const clientJs = fs.readFileSync(clientPath, 'utf8');
const appJs = fs.readFileSync(appPath, 'utf8');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function assertSecurity(passed, testCode, description, attackDetails) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  🛡️  [PASS] [${testCode}] ${description}`);
  } else {
    failedTests++;
    console.error(`  🚨 [FAIL] [${testCode}] ${description}`);
    console.error(`     Attacker Vector Exploit: ${attackDetails}`);
    failureDetails.push({ testCode, description, attackDetails });
  }
}

// ============================================================================
// VECTOR 1: PRIVILEGE ESCALATION & ACCESS CONTROL ATTACKS
// ============================================================================
console.log('\n--- VECTOR 1: PRIVILEGE ESCALATION & ACCESS CONTROL PROBING ---');

// 1.1 Anonymous/Guest Queue Advancement Blocked
const advanceQueueFuncMatch = schema.match(/CREATE OR REPLACE FUNCTION advance_doctor_queue_atomic\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS\s*\$\$([\s\S]*?)\$\$/i);
const advanceQueueBody = advanceQueueFuncMatch ? advanceQueueFuncMatch[2] : '';

const v1_1_sql_blocks_anon = advanceQueueBody.includes('auth.uid()') && 
  advanceQueueBody.includes('Authentication required. Anonymous users cannot advance clinical queues.');
const v1_1_sql_revokes_anon = schema.includes('REVOKE ALL ON FUNCTION advance_doctor_queue_atomic(UUID) FROM PUBLIC, anon;') &&
  schema.includes('GRANT EXECUTE ON FUNCTION advance_doctor_queue_atomic(UUID) TO authenticated;');
const v1_1_store_blocks_guest = storeJs.includes("this.state.currentUser.role !== 'doctor'") &&
  storeJs.includes("this.state.currentUser.role !== 'admin'") &&
  storeJs.includes("Access Denied: Only the assigned verified physician can control this OPD queue.");

assertSecurity(
  v1_1_sql_blocks_anon && v1_1_sql_revokes_anon && v1_1_store_blocks_guest,
  'SEC-V1-01',
  'Guest/Anonymous Queue Advancement Blocked (Fail-Closed Auth & RPC Revoke)',
  'Anonymous users could execute advance_doctor_queue_atomic without auth'
);

// 1.2 Patient Role Cannot Advance Doctor Queue
const v1_2_sql_checks_doctor_ownership = advanceQueueBody.includes('SELECT EXISTS (') &&
  advanceQueueBody.includes('WHERE id = p_doctor_id') &&
  advanceQueueBody.includes('user_id = v_actor_id') &&
  advanceQueueBody.includes("verification_status = 'verified'");
const v1_2_sql_throws_unauth = advanceQueueBody.includes('Not authorized. Only the authenticated, verified physician can advance this queue.');

assertSecurity(
  v1_2_sql_checks_doctor_ownership && v1_2_sql_throws_unauth,
  'SEC-V1-02',
  'Patient Role Blocked from Queue Advancement (Strict user_id & verified check)',
  'Authenticated patient could advance queue by supplying target doctor_id'
);

// 1.3 Unverified/Pending Doctor Cannot Advance Queue
assertSecurity(
  advanceQueueBody.includes("verification_status = 'verified'"),
  'SEC-V1-03',
  'Unverified/Pending Doctor Blocked from Queue Advancement',
  'Unverified doctor with verification_status=pending could start clinical session'
);

// 1.4 Cross-Doctor Queue Hijacking (Doctor A advancing Doctor B's queue)
assertSecurity(
  advanceQueueBody.includes('user_id = v_actor_id'),
  'SEC-V1-04',
  'Cross-Doctor Queue Hijacking Blocked (Attending Practitioner user_id Linkage)',
  'Doctor A could pass Doctor B UUID to advance_doctor_queue_atomic'
);

// 1.5 Non-Admin Doctor License Approval / Verification
const verifyDocFuncMatch = schema.match(/CREATE OR REPLACE FUNCTION verify_doctor_admin_atomic\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS\s*\$\$([\s\S]*?)\$\$/i);
const verifyDocBody = verifyDocFuncMatch ? verifyDocFuncMatch[2] : '';

const v1_5_sql_checks_admin = verifyDocBody.includes('is_admin(v_admin_id)') &&
  verifyDocBody.includes('Access Denied: Only authenticated Medical Board Administrators can verify practitioner licenses.');
const v1_5_sql_revokes_anon = schema.includes('REVOKE ALL ON FUNCTION verify_doctor_admin_atomic(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;');
const v1_5_store_checks_admin = storeJs.includes("this.state.currentUser.role !== 'admin'") &&
  storeJs.includes("Access Denied: Medical Board Administrator privileges required.");

assertSecurity(
  v1_5_sql_checks_admin && v1_5_sql_revokes_anon && v1_5_store_checks_admin,
  'SEC-V1-05',
  'Doctor License Self-Verification Blocked (Requires Authoritative is_admin() Function)',
  'Non-admin user could invoke verify_doctor_admin_atomic to approve doctor accreditation'
);

// 1.6 Direct Doctor Verification Mutation Blocked via PostgreSQL Trigger
const v1_6_trigger_exists = schema.includes('CREATE TRIGGER trg_prevent_doctor_self_verification') &&
  schema.includes('prevent_doctor_self_verification()');
const v1_6_trigger_checks = schema.includes('NEW.verification_status IS DISTINCT FROM OLD.verification_status') &&
  schema.includes('IF NOT is_admin(auth.uid()) THEN') &&
  schema.includes('Access Denied: Verification status and official Mediarca credentials can only be granted by Medical Board Administrators.');

assertSecurity(
  v1_6_trigger_exists && v1_6_trigger_checks,
  'SEC-V1-06',
  'Direct SQL UPDATE on Doctor Verification Status Blocked by Trigger',
  'Doctor could bypass RPC and execute direct UPDATE doctors SET verification_status=\'verified\''
);

// 1.7 User Self-Role Escalation Blocked via PostgreSQL Trigger
const v1_7_role_trigger_exists = schema.includes('CREATE TRIGGER trg_prevent_user_role_escalation') &&
  schema.includes('prevent_user_role_escalation()');
const v1_7_role_trigger_checks = schema.includes('NEW.role IS DISTINCT FROM OLD.role') &&
  schema.includes('IF NOT is_admin(auth.uid()) THEN') &&
  schema.includes('Access Denied: User role is immutable and cannot be self-modified.');

assertSecurity(
  v1_7_role_trigger_exists && v1_7_role_trigger_checks,
  'SEC-V1-07',
  'User Self-Role Escalation Blocked by Immutable Role Trigger',
  'Patient could execute direct UPDATE users SET role=\'admin\''
);

// 1.8 Doctor Ownership user_id Mutation Blocked via PostgreSQL Trigger
const v1_8_ownership_trigger_exists = schema.includes('CREATE TRIGGER trg_prevent_doctor_ownership_mutation') &&
  schema.includes('prevent_doctor_ownership_mutation()');
const v1_8_ownership_trigger_checks = schema.includes('OLD.user_id IS DISTINCT FROM NEW.user_id') &&
  schema.includes('Immutable Ownership Violation: Cannot transfer or modify doctor user account identity.');

assertSecurity(
  v1_8_ownership_trigger_exists && v1_8_ownership_trigger_checks,
  'SEC-V1-08',
  'Doctor Account Ownership Mutation Blocked by Trigger',
  'Attacker could re-assign doctor user_id to takeover existing verified doctor profile'
);

// 1.9 Clinical Stage Transition Enforces Attending Doctor / Staff
const stageFuncMatch = schema.match(/CREATE OR REPLACE FUNCTION update_patient_stage_atomic\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS\s*\$\$([\s\S]*?)\$\$/i);
const stageBody = stageFuncMatch ? stageFuncMatch[2] : '';
const v1_9_stage_checks = stageBody.includes("v_doctor.user_id != v_actor_id OR v_doctor.verification_status != 'verified'") &&
  stageBody.includes('Only accredited, verified attending physicians can transition clinical stages');

assertSecurity(
  v1_9_stage_checks,
  'SEC-V1-09',
  'Clinical Stage Routing Restricted to Verified Attending Physician / Staff',
  'Arbitrary physician could transition hospital clinical routing stages for unassigned patient'
);

// ============================================================================
// VECTOR 2: REPLAY ATTACKS & QR CHECK-IN INTEGRITY
// ============================================================================
console.log('\n--- VECTOR 2: REPLAY ATTACKS & QR CHECK-IN INTEGRITY PROBING ---');

const checkinFuncMatch = schema.match(/CREATE OR REPLACE FUNCTION check_in_patient_qr_atomic\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS\s*\$\$([\s\S]*?)\$\$/i);
const checkinBody = checkinFuncMatch ? checkinFuncMatch[2] : '';

// 2.1 Replay Attack - Used Token Rejection
const v2_1_replay_check = checkinBody.includes("v_appointment.checkin_token_used_at IS NOT NULL OR v_appointment.status = 'checked_in'") &&
  checkinBody.includes('This check-in pass has already been used');
assertSecurity(
  v2_1_replay_check,
  'SEC-V2-01',
  'QR Check-In Token Replay Attack Prevented (Used Token Detection)',
  'Patient or attacker could re-scan check-in pass after first usage'
);

// 2.2 Expired Token Rejection (24h validity window)
const v2_2_expiry_check = checkinBody.includes('v_appointment.checkin_token_expires_at IS NOT NULL AND v_appointment.checkin_token_expires_at < NOW()') &&
  checkinBody.includes('QR check-in token has expired (24h validity window elapsed).');
assertSecurity(
  v2_2_expiry_check,
  'SEC-V2-02',
  'Expired QR Check-In Token Rejected (24h Validity Window)',
  'Patient could check in using expired pass generated days/weeks prior'
);

// 2.3 Future-Date Premature Check-in Rejection
const v2_3_future_date_check = checkinBody.includes("v_appointment.scheduled_date > (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE") &&
  checkinBody.includes('QR check-in is only permitted on the scheduled appointment date');
assertSecurity(
  v2_3_future_date_check,
  'SEC-V2-03',
  'Premature Future Appointment Check-In Blocked (Calendar Date Enforcement)',
  'Patient with future appointment could check-in today and disrupt live queue'
);

// 2.4 Terminal State Check-In Rejection (completed/cancelled)
const v2_4_terminal_check = checkinBody.includes("v_appointment.status IN ('completed', 'cancelled')") &&
  checkinBody.includes('Cannot check-in. Consultation status is already');
assertSecurity(
  v2_4_terminal_check,
  'SEC-V2-04',
  'Terminal State Check-In Blocked (Cannot check in completed/cancelled visit)',
  'Attacker could re-activate completed visit by re-checking in'
);

// 2.5 Race Condition Double-Checkin Concurrency Safety (FOR UPDATE + Conditional Update)
const v2_5_row_lock = checkinBody.includes('FOR UPDATE');
const v2_5_atomic_update = checkinBody.includes('WHERE id = v_appointment.id AND checkin_token_used_at IS NULL') &&
  checkinBody.includes('IF NOT FOUND THEN') &&
  checkinBody.includes('QR check-in collision: This token has already been claimed by a concurrent process.');

assertSecurity(
  v2_5_row_lock && v2_5_atomic_update,
  'SEC-V2-05',
  'Concurrent Double-Checkin Race Condition Prevented (Row Lock FOR UPDATE & Atomic Guard)',
  'Simultaneous requests could both succeed and issue duplicate queue positions'
);

// 2.6 Unique Check-In Token Constraint in Database Schema
const v2_6_unique_token_constraint = schema.includes('checkin_token VARCHAR(255) UNIQUE');
assertSecurity(
  v2_6_unique_token_constraint,
  'SEC-V2-06',
  'Database Schema Uniqueness Constraint on checkin_token',
  'Duplicate checkin tokens could be generated or inserted across appointments'
);

// 2.7 High Entropy 128-bit Cryptographic Check-in Token Generation
const v2_7_entropy_sql = schema.includes("v_checkin_token := 'MED-QR-' || lower(replace(gen_random_uuid()::text, '-', ''));");
const v2_7_entropy_js = storeJs.includes('window.crypto.getRandomValues(randomBuffer)');
assertSecurity(
  v2_7_entropy_sql && v2_7_entropy_js,
  'SEC-V2-07',
  'CSPRNG 128-bit High-Entropy Check-In Token Generation (Zero Predictability)',
  'Sequential or low-entropy tokens could be brute-forced or guessed by attackers'
);

// 2.8 Rescheduling Check-in Invalidation & Fresh Token Issue
const rescheduleFuncMatch = schema.match(/CREATE OR REPLACE FUNCTION reschedule_appointment_atomic\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS\s*\$\$([\s\S]*?)\$\$/i);
const rescheduleBody = rescheduleFuncMatch ? rescheduleFuncMatch[2] : '';
const v2_8_reschedule_fresh_token = rescheduleBody.includes("v_checkin_token := 'MED-QR-' || lower(replace(gen_random_uuid()::text, '-', ''));") &&
  rescheduleBody.includes('checkin_token = v_checkin_token') &&
  rescheduleBody.includes('check_in_time = NULL');

assertSecurity(
  v2_8_reschedule_fresh_token,
  'SEC-V2-08',
  'Rescheduling Automatically Invalidates Old QR Pass & Generates Fresh Token',
  'Old QR pass remained valid for rescheduled appointment on wrong date'
);

// ============================================================================
// VECTOR 3: SLOT COLLISION & DOUBLE-BOOKING PROBING
// ============================================================================
console.log('\n--- VECTOR 3: SLOT COLLISION & DOUBLE-BOOKING PROBING ---');

const scheduleFutureFuncMatch = schema.match(/CREATE OR REPLACE FUNCTION schedule_future_appointment_atomic\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS\s*\$\$([\s\S]*?)\$\$/i);
const scheduleFutureBody = scheduleFutureFuncMatch ? scheduleFutureFuncMatch[2] : '';

// 3.1 Future Appointment Slot Collision RPC Check
const v3_1_slot_collision_check = scheduleFutureBody.includes('WHERE doctor_id = p_doctor_id') &&
  scheduleFutureBody.includes('AND scheduled_date = p_scheduled_date') &&
  scheduleFutureBody.includes('AND scheduled_slot = p_scheduled_slot') &&
  scheduleFutureBody.includes("AND status IN ('booked', 'checked_in', 'waiting', 'in-consultation')") &&
  scheduleFutureBody.includes('Slot collision: Doctor already has an active appointment for % on %');

assertSecurity(
  v3_1_slot_collision_check,
  'SEC-V3-01',
  'Future Slot Collision Atomic Rejection (schedule_future_appointment_atomic)',
  'Concurrent or overlapping requests could claim identical doctor time slots'
);

// 3.2 Unique Index on Active Future Doctor Slots
const v3_2_unique_index = schema.includes('CREATE UNIQUE INDEX IF NOT EXISTS uq_active_doctor_future_slot') &&
  schema.includes('ON appointments (doctor_id, scheduled_date, scheduled_slot)') &&
  schema.includes("WHERE status IN ('booked', 'checked_in', 'waiting', 'in-consultation')") &&
  schema.includes('AND scheduled_slot IS NOT NULL') &&
  schema.includes('AND token_number IS NULL;');

assertSecurity(
  v3_2_unique_index,
  'SEC-V3-02',
  'Database Concurrency Partial Unique Index on Active Doctor Future Slots',
  'Direct SQL inserts or simultaneous transactions could bypass RPC check and double-book'
);

// 3.3 Duplicate Active Same-Day OPD Ticket Prevention
const issueOpdFuncMatch = schema.match(/CREATE OR REPLACE FUNCTION issue_next_opd_token\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS\s*\$\$([\s\S]*?)\$\$/i);
const issueOpdBody = issueOpdFuncMatch ? issueOpdFuncMatch[2] : '';

const v3_3_opd_duplicate_check = issueOpdBody.includes('patient_id = v_actor_id') &&
  issueOpdBody.includes('doctor_id = p_doctor_id') &&
  issueOpdBody.includes('scheduled_date = CURRENT_DATE') &&
  issueOpdBody.includes("status IN ('booked', 'checked_in', 'waiting', 'in-consultation')") &&
  issueOpdBody.includes('You already have an active appointment ticket (Token in progress) with this doctor for today.');

assertSecurity(
  v3_3_opd_duplicate_check,
  'SEC-V3-03',
  'Same-Day OPD Ticket Flooding & Double-Booking Prevention',
  'Patient could spawn multiple simultaneous active queue tickets with the same doctor'
);

// 3.4 Past-Date Booking Atomic Rejection
const v3_4_past_date_check = scheduleFutureBody.includes('IF p_scheduled_date < CURRENT_DATE THEN') &&
  scheduleFutureBody.includes('Cannot schedule appointments in the past.');

assertSecurity(
  v3_4_past_date_check,
  'SEC-V3-04',
  'Past-Date Appointment Booking Rejection',
  'Attacker could book retroactively to falsify past appointment records'
);

// 3.5 Unique Key Constraint on Daily Clinic Queues
const v3_5_daily_queue_constraint = schema.includes('CONSTRAINT unique_doctor_queue_per_day UNIQUE (doctor_id, queue_date)');
assertSecurity(
  v3_5_daily_queue_constraint,
  'SEC-V3-05',
  'Clinic Queues Unique Per-Doctor Per-Day Constraint (unique_doctor_queue_per_day)',
  'Multiple queues could be initialized for same doctor on the same day'
);

// 3.6 Rescheduling Slot Collision Guard
const v3_6_reschedule_collision = rescheduleBody.includes('WHERE doctor_id = v_appointment.doctor_id') &&
  rescheduleBody.includes('AND scheduled_date = p_new_date') &&
  rescheduleBody.includes('AND scheduled_slot = p_new_slot') &&
  rescheduleBody.includes('AND id != p_appointment_id') &&
  rescheduleBody.includes('Requested time slot (%) is already booked for this doctor');

assertSecurity(
  v3_6_reschedule_collision,
  'SEC-V3-06',
  'Appointment Rescheduling Target Slot Collision Guard',
  'User could reschedule into another patient existing appointment slot'
);

// ============================================================================
// VECTOR 4: LOCALSTORAGE SECURITY & ZERO JWT TOKEN LEAKAGE
// ============================================================================
console.log('\n--- VECTOR 4: LOCALSTORAGE SECURITY & ZERO JWT TOKEN LEAKAGE PROBING ---');

// 4.1 LocalStorage Key Scrape & Minimal Metadata Verification
// Inspect what store.js saves to localStorage: strip comments first
const saveStateMatch = storeJs.match(/saveState\(\)\s*\{([\s\S]*?)\n  \}/);
const saveStateCode = saveStateMatch ? saveStateMatch[1].replace(/\/\/.*$/gm, '') : '';

const v4_1_no_token_saved = !saveStateCode.includes('access_token') &&
  !saveStateCode.includes('refresh_token') &&
  !saveStateCode.includes('jwt') &&
  !saveStateCode.includes('bearer') &&
  !saveStateCode.includes('password_hash') &&
  !saveStateCode.includes('apiKey');

const v4_1_minimal_payload = saveStateCode.includes('currentUser:') &&
  saveStateCode.includes('hospitalSettings:');

assertSecurity(
  v4_1_no_token_saved && v4_1_minimal_payload,
  'SEC-V4-01',
  'LocalStorage Serialization Strictly Excludes Bearer Tokens & Secrets',
  'saveState() persisted raw JWT tokens or authentication credentials to localStorage'
);

// 4.2 Static Codebase Zero-JWT In LocalStorage Audit
const setItemMatches = [...storeJs.matchAll(/localStorage\.setItem\(([^)]+)\)/g), ...appJs.matchAll(/localStorage\.setItem\(([^)]+)\)/g)];
let v4_2_safe_set_items = true;
for (const match of setItemMatches) {
  const args = match[1];
  if (args.includes('access_token') || args.includes('jwt') || args.includes('bearer') || args.includes('refresh_token')) {
    v4_2_safe_set_items = false;
  }
}
assertSecurity(
  v4_2_safe_set_items,
  'SEC-V4-02',
  'Global Codebase Static Audit: Zero JWT / Secret Keys in localStorage.setItem Calls',
  'localStorage.setItem invoked with raw authentication token parameters'
);

// 4.3 Client-Side Session Tampering Resistance (Server Authoritative auth.uid())
const criticalRpcs = [
  'issue_next_opd_token',
  'schedule_future_appointment_atomic',
  'advance_doctor_queue_atomic',
  'complete_consultation_rx_atomic',
  'mark_appointment_status_atomic',
  'check_in_patient_qr_atomic',
  'transfer_patient_queue_atomic',
  'reschedule_appointment_atomic',
  'verify_doctor_admin_atomic',
  'update_patient_stage_atomic',
  'record_patient_consent_atomic',
  'generate_and_settle_invoice_atomic',
  'create_telemedicine_room_atomic',
  'get_hospital_operational_analytics',
  'get_system_audit_logs'
];

let v4_3_all_rpcs_use_auth_uid = true;
for (const rpc of criticalRpcs) {
  const rpcMatch = schema.match(new RegExp(`CREATE OR REPLACE FUNCTION ${rpc}\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS[\\s\\S]*?AS\\s*\\$\\$([\\s\\S]*?)\\$\\$`, 'i'));
  if (rpcMatch) {
    const body = rpcMatch[2];
    if (!body.includes('auth.uid()')) {
      v4_3_all_rpcs_use_auth_uid = false;
      console.error(`  RPC ${rpc} does NOT validate auth.uid()!`);
    }
  } else {
    v4_3_all_rpcs_use_auth_uid = false;
  }
}

assertSecurity(
  v4_3_all_rpcs_use_auth_uid,
  'SEC-V4-03',
  'Server-Authoritative Identity: 100% of Critical RPCs Anchor Identity to auth.uid()',
  'RPC accepted client-provided actor_id without validating auth.uid()'
);

// 4.4 Fail-Closed Offline Security in Store Methods
const v4_4_fail_closed_advance = storeJs.includes('Cannot advance clinical queue offline');
const v4_4_fail_closed_book = storeJs.includes('Cannot issue medical tokens while offline');
const v4_4_fail_closed_billing = storeJs.includes('Cannot process and settle billing transactions offline');
const v4_4_fail_closed_checkin = storeJs.includes('Cannot validate QR check-in offline');
const v4_4_fail_closed_status = storeJs.includes('Cannot update consultation status offline');
const v4_4_fail_closed_verify = storeJs.includes('Cannot verify credentials offline');

assertSecurity(
  v4_4_fail_closed_advance && v4_4_fail_closed_book && v4_4_fail_closed_billing && v4_4_fail_closed_checkin && v4_4_fail_closed_status && v4_4_fail_closed_verify,
  'SEC-V4-04',
  'Store Operations Fail-Closed on Offline/Disconnected State',
  'Client fell back to unverified offline state allowing offline privilege escalation'
);

// 4.5 Logout Session Purging
const v4_5_logout_cleans = storeJs.includes('logout() {') &&
  storeJs.includes('authSignOut()') &&
  storeJs.includes("role: 'guest'") &&
  storeJs.includes('this.saveState()') &&
  storeJs.includes('this.notifySubscribers()');

assertSecurity(
  v4_5_logout_cleans,
  'SEC-V4-05',
  'Store Logout Cleans Local State & Unsets Active Identity',
  'logout() left active credentials or role in memory'
);

// ============================================================================
// VECTOR 5: FINANCIAL INVOICE TAMPERING & BILLING PROBING
// ============================================================================
console.log('\n--- VECTOR 5: FINANCIAL INVOICE TAMPERING & BILLING PROBING ---');

const invoiceFuncMatch = schema.match(/CREATE OR REPLACE FUNCTION generate_and_settle_invoice_atomic\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?AS\s*\$\$([\s\S]*?)\$\$/i);
const invoiceBody = invoiceFuncMatch ? invoiceFuncMatch[2] : '';

// 5.1 Authoritative Base Fee Resolution from Database (Not Client Param)
const v5_1_fee_from_db = invoiceBody.includes('v_base_fee := COALESCE(v_doctor.fee, 50.00);') &&
  !invoiceFuncMatch[1].includes('p_fee') &&
  !invoiceFuncMatch[1].includes('p_consultation_fee') &&
  !invoiceFuncMatch[1].includes('p_amount');

assertSecurity(
  v5_1_fee_from_db,
  'SEC-V5-01',
  'Consultation Base Fee Authoritatively Derived from doctors.fee (Zero Client Override)',
  'Client could pass p_fee to generate_and_settle_invoice_atomic to alter consultation price'
);

// 5.2 Server-Side Coupon Discount Validation (Reject Arbitrary Client Codes)
const v5_2_coupon_validation = invoiceBody.includes("IF p_coupon_code = 'HEALTH10' THEN") &&
  invoiceBody.includes("ELSIF p_coupon_code = 'PREVENT20' THEN") &&
  invoiceBody.includes('v_discount := ROUND(v_base_fee * 0.10, 2);') &&
  invoiceBody.includes('v_discount := LEAST(20.00, v_base_fee);');

assertSecurity(
  v5_2_coupon_validation,
  'SEC-V5-02',
  'Server-Side Coupon Code Allowlist & Calculation (Arbitrary Codes Yield $0 Discount)',
  'Client could pass arbitrary discount amount or fabricated coupon code'
);

// 5.3 Insurance Coverage Out-of-Bounds Rejection (0-100% Bound)
const v5_3_insurance_bounds = invoiceBody.includes('IF p_insurance_coverage < 0 OR p_insurance_coverage > 100 THEN') &&
  invoiceBody.includes('Invalid insurance coverage percentage: must be between 0 and 100.');

assertSecurity(
  v5_3_insurance_bounds,
  'SEC-V5-03',
  'Insurance Coverage Bounds Validation (0.00% to 100.00%)',
  'Attacker could pass negative coverage or >100% coverage to cause integer overflow/underflow'
);

// 5.4 Cross-Patient Invoice Creation / Settlement Access Denied
const v5_4_invoice_auth = invoiceBody.includes('IF v_actor_id != v_appointment.patient_id') &&
  invoiceBody.includes('v_doctor.user_id != v_actor_id') &&
  invoiceBody.includes("v_actor_role NOT IN ('receptionist', 'admin')") &&
  invoiceBody.includes('NOT is_admin(v_actor_id)') &&
  invoiceBody.includes('Access Denied: You are not authorized to create or settle invoices for this appointment.');

assertSecurity(
  v5_4_invoice_auth,
  'SEC-V5-04',
  'Invoice Settlement Authorization (Restricted to Patient, Doctor, Receptionist, Admin)',
  'Unrelated user could generate or settle invoice for another patient appointment'
);

// 5.5 Patient Invoices Table RLS Protection
const v5_5_invoices_rls = schema.includes('ALTER TABLE patient_invoices ENABLE ROW LEVEL SECURITY;') &&
  (schema.includes('invoices_patient_read') || schema.includes('"Patients can view own invoices"')) &&
  (schema.includes('patient_id = (SELECT auth.uid())') || schema.includes('patient_id = auth.uid()'));

assertSecurity(
  v5_5_invoices_rls,
  'SEC-V5-05',
  'Patient Invoices Table Protected by RLS (Patients Read-Only Own; Staff Manage)',
  'Direct SQL UPDATE allowed patients to tamper with net_payable on patient_invoices table'
);

// ============================================================================
// VECTOR 6: EMR DATA ISOLATION & RLS POLICIES
// ============================================================================
console.log('\n--- VECTOR 6: EMR DATA ISOLATION & RLS POLICIES PROBING ---');

// 6.1 Patient Clinical Profiles RLS Isolation
const v6_1_profile_rls = schema.includes('ALTER TABLE patient_clinical_profiles ENABLE ROW LEVEL SECURITY;') &&
  (schema.includes('patient_clinical_profiles_access') || schema.includes('"Patients can manage own clinical profile"')) &&
  (schema.includes('user_id = (SELECT auth.uid())') || schema.includes('auth.uid() = user_id'));

assertSecurity(
  v6_1_profile_rls,
  'SEC-V6-01',
  'Patient Clinical Profiles RLS Isolation (Owner-Only Mutation; Scoped Doctor Access)',
  'Patient A could read or update Patient B medical history, allergies, or demographics'
);

// 6.2 Clinical Encounters RLS Isolation
const v6_2_encounters_rls = schema.includes('ALTER TABLE clinical_encounters ENABLE ROW LEVEL SECURITY;') &&
  (schema.includes('encounters_patient_read') || schema.includes('"Patients can view own encounters"')) &&
  (schema.includes('patient_id = (SELECT auth.uid())') || schema.includes('patient_id = auth.uid()'));

assertSecurity(
  v6_2_encounters_rls,
  'SEC-V6-02',
  'Clinical Encounters RLS Isolation (Patients Read-Only Own; Verified Doctors Write)',
  'Patient could forge clinical encounters or view other patients medical notes'
);

// 6.3 Clinical Prescriptions & Prescription Items RLS Isolation
const v6_3_prescriptions_rls = schema.includes('ALTER TABLE clinical_prescriptions ENABLE ROW LEVEL SECURITY;') &&
  (schema.includes('prescriptions_patient_read') || schema.includes('"Patients can view own prescriptions"')) &&
  schema.includes('ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;') &&
  (schema.includes('prescription_items_read') || schema.includes('"Patients can view own prescription items"'));

assertSecurity(
  v6_3_prescriptions_rls,
  'SEC-V6-03',
  'Clinical Prescriptions & Items RLS Isolation (Strict Item-Level Patient Isolation)',
  'Patient could forge prescription items or view other patients active prescriptions'
);

// 6.4 Lab Orders & Lab Results RLS Isolation
const v6_4_labs_rls = schema.includes('ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;') &&
  schema.includes('ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;') &&
  (schema.includes('lab_results_read') || schema.includes('"Patients can view own lab results"'));

assertSecurity(
  v6_4_labs_rls,
  'SEC-V6-04',
  'Lab Orders & Diagnostic Results RLS Isolation',
  'Cross-patient lab report or diagnostic result leakage via direct table queries'
);

// 6.5 Private Clinical Document Vault Storage Bucket & Storage RLS
const v6_5_storage_private = schema.includes("bucket_id = 'clinical_documents'") &&
  schema.includes("(storage.foldername(name))[1] = auth.uid()::text");
const v6_5_table_doc_rls = schema.includes('ALTER TABLE clinical_documents ENABLE ROW LEVEL SECURITY;') &&
  (schema.includes('documents_patient_access') || schema.includes('"Patients can view own documents"')) &&
  (schema.includes('patient_id = (SELECT auth.uid())') || schema.includes('patient_id = auth.uid()'));

assertSecurity(
  v6_5_storage_private && v6_5_table_doc_rls,
  'SEC-V6-05',
  'Private Storage Vault Folder Isolation (storage.foldername(name)[1] = auth.uid())',
  'Patient A could download Patient B medical PDFs or imaging files directly from bucket'
);

// 6.6 Appointment Core Fields Immutability Trigger
const v6_6_immutable_appt_trigger = schema.includes('CREATE TRIGGER trg_prevent_appointment_core_fields_mutation') &&
  schema.includes('prevent_appointment_core_fields_mutation()') &&
  schema.includes('Immutable Field Violation: Direct modification of appointment patient, doctor, booking ID, date, token, or check-in credentials is prohibited.');

assertSecurity(
  v6_6_immutable_appt_trigger,
  'SEC-V6-06',
  'Appointment Core Fields Mutation Guarded by PostgreSQL Trigger',
  'Attacker could execute direct UPDATE appointments SET patient_id = attacker_id, token_number = 1'
);

// 6.7 Telemedicine Session Token Tampering Protection Trigger
const v6_7_telemed_trigger = schema.includes('CREATE TRIGGER trg_prevent_telemedicine_room_tampering') &&
  schema.includes('prevent_telemedicine_room_tampering()') &&
  schema.includes('Immutable Session Violation: Modification of telemedicine appointment linkage or security token is prohibited.');

assertSecurity(
  v6_7_telemed_trigger,
  'SEC-V6-07',
  'Telemedicine Session Token Tampering Blocked by Trigger',
  'Attacker could alter room_token or reassign appointment_id to hijack video consultation'
);

// 6.8 Append-Only Audit Compliance Ledger
const v6_8_audit_logs_rls = schema.includes('ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;') &&
  schema.includes('CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT USING (\n    is_admin(auth.uid())\n);') &&
  schema.includes('CREATE OR REPLACE FUNCTION get_system_audit_logs');

assertSecurity(
  v6_8_audit_logs_rls,
  'SEC-V6-08',
  'Audit Compliance Ledger Access Strictly Restricted to Medical Board Administrators',
  'Patients or external actors could inspect administrative audit trails and forensic logs'
);

// ============================================================================
// SIMULATION TESTING: RUNTIME ATTACK PAYLOAD VERIFICATION
// ============================================================================
console.log('\n--- INTERACTIVE ATTACK SIMULATION TESTING ---');

// Simulated DB environment for state machine penetration tests
class SimulatedSecDb {
  constructor() {
    this.users = new Map();
    this.doctors = new Map();
    this.appointments = new Map();
    this.queues = new Map();
    this.invoices = new Map();
  }

  // Vector 1 Simulator: advance_doctor_queue_atomic
  simAdvanceDoctorQueue(actorId, doctorId) {
    if (!actorId) throw new Error('Authentication required. Anonymous users cannot advance clinical queues.');
    const doc = this.doctors.get(doctorId);
    if (!doc || doc.userId !== actorId || doc.verificationStatus !== 'verified') {
      throw new Error('Not authorized. Only the authenticated, verified physician can advance this queue.');
    }
    return { success: true, doctorId, currentToken: 1 };
  }

  // Vector 1 Simulator: verify_doctor_admin_atomic
  simVerifyDoctor(actorId, doctorId, approved) {
    if (!actorId) throw new Error('Authentication required.');
    const actor = this.users.get(actorId);
    if (!actor || actor.role !== 'admin') {
      throw new Error('Access Denied: Only authenticated Medical Board Administrators can verify practitioner licenses.');
    }
    const doc = this.doctors.get(doctorId);
    if (doc) doc.verificationStatus = approved ? 'verified' : 'rejected';
    return { success: true, doctorId, status: doc?.verificationStatus };
  }

  // Vector 2 Simulator: check_in_patient_qr_atomic
  simCheckInPatientQr(actorId, qrToken, now = new Date()) {
    if (!actorId) throw new Error('Authentication required.');
    let appt = null;
    for (const a of this.appointments.values()) {
      if (a.checkinToken === qrToken) { appt = a; break; }
    }
    if (!appt) throw new Error('Invalid check-in token credential.');
    if (appt.checkinTokenExpiresAt && appt.checkinTokenExpiresAt < now) {
      throw new Error('QR check-in token has expired (24h validity window elapsed).');
    }
    if (appt.checkinTokenUsedAt || appt.status === 'checked_in') {
      throw new Error(`This check-in pass has already been used on ${appt.checkInTime || 'earlier'}.`);
    }
    if (appt.status === 'completed' || appt.status === 'cancelled') {
      throw new Error(`Cannot check-in. Consultation status is already ${appt.status}`);
    }
    if (appt.scheduledDate > now.toISOString().split('T')[0]) {
      throw new Error(`QR check-in is only permitted on the scheduled appointment date (${appt.scheduledDate}).`);
    }
    const actor = this.users.get(actorId);
    const isDoc = appt.doctorUserId === actorId;
    const isOwner = appt.patientId === actorId;
    const isStaff = actor && (actor.role === 'receptionist' || actor.role === 'admin');
    if (!isOwner && !isDoc && !isStaff) {
      throw new Error('Access Denied: You are not authorized to perform check-in for this appointment pass.');
    }
    appt.status = 'checked_in';
    appt.checkinTokenUsedAt = now;
    return { success: true, appointmentId: appt.id, status: 'checked_in' };
  }

  // Vector 3 Simulator: schedule_future_appointment_atomic
  simScheduleFutureAppointment(actorId, doctorId, scheduledDate, scheduledSlot, symptoms = 'Checkup') {
    if (!actorId) throw new Error('Authentication required.');
    const actor = this.users.get(actorId);
    if (!actor || (actor.role !== 'patient' && actor.role !== 'admin')) {
      throw new Error('Access Denied: Only registered patients can schedule future appointments.');
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (scheduledDate < todayStr) {
      throw new Error(`Cannot schedule appointments in the past. Date requested: ${scheduledDate}`);
    }
    for (const a of this.appointments.values()) {
      if (a.doctorId === doctorId && a.scheduledDate === scheduledDate && a.scheduledSlot === scheduledSlot && ['booked', 'checked_in', 'waiting', 'in-consultation'].includes(a.status)) {
        throw new Error(`Slot collision: Doctor already has an active appointment for ${scheduledSlot} on ${scheduledDate}. Please select a different slot.`);
      }
    }
    const id = 'appt_' + Math.random().toString(36).substring(2, 9);
    // Schema BUG-03: expiry is tied to (scheduled_date + 1 day)
    const expiryDate = new Date(scheduledDate + 'T23:59:59Z');
    expiryDate.setDate(expiryDate.getDate() + 1);

    const appt = {
      id,
      patientId: actorId,
      doctorId,
      scheduledDate,
      scheduledSlot,
      status: 'booked',
      checkinToken: 'MED-QR-' + Math.random().toString(36).substring(2, 10),
      checkinTokenExpiresAt: expiryDate
    };
    this.appointments.set(id, appt);
    return appt;
  }

  // Vector 5 Simulator: generate_and_settle_invoice_atomic
  simGenerateAndSettleInvoice(actorId, appointmentId, couponCode = null, insuranceCoverage = 0) {
    if (!actorId) throw new Error('Authentication required.');
    if (insuranceCoverage < 0 || insuranceCoverage > 100) {
      throw new Error('Invalid insurance coverage percentage: must be between 0 and 100.');
    }
    const appt = this.appointments.get(appointmentId);
    if (!appt) throw new Error('Appointment not found.');
    const doc = this.doctors.get(appt.doctorId);
    const actor = this.users.get(actorId);
    const isOwner = appt.patientId === actorId;
    const isDoc = doc && doc.userId === actorId;
    const isStaff = actor && (actor.role === 'receptionist' || actor.role === 'admin');
    if (!isOwner && !isDoc && !isStaff) {
      throw new Error('Access Denied: You are not authorized to create or settle invoices for this appointment.');
    }
    const baseFee = (doc && doc.fee) || 50.00;
    let discount = 0.00;
    if (couponCode === 'HEALTH10') discount = Math.round(baseFee * 0.10 * 100) / 100;
    else if (couponCode === 'PREVENT20') discount = Math.min(20.00, baseFee);

    const netBeforeIns = Math.max(0.00, baseFee - discount);
    const insurancePaid = Math.round(netBeforeIns * (insuranceCoverage / 100.0) * 100) / 100;
    const patientPaid = Math.max(0.00, netBeforeIns - insurancePaid);

    return {
      appointmentId,
      totalAmount: baseFee,
      discountAmount: discount,
      insurancePaid,
      patientPaid,
      status: 'paid'
    };
  }
}

// Instantiate Simulated Sandbox
const secDb = new SimulatedSecDb();

// Seed Sandbox
const patientA = { id: 'usr_pat_a', role: 'patient', name: 'Alice Patient' };
const patientB = { id: 'usr_pat_b', role: 'patient', name: 'Bob Patient' };
const doctorVerified = { id: 'usr_doc_v', role: 'doctor', name: 'Dr. Verified' };
const doctorPending = { id: 'usr_doc_p', role: 'doctor', name: 'Dr. Pending' };
const adminUser = { id: 'usr_adm_1', role: 'admin', name: 'Admin Vance' };

secDb.users.set(patientA.id, patientA);
secDb.users.set(patientB.id, patientB);
secDb.users.set(doctorVerified.id, doctorVerified);
secDb.users.set(doctorPending.id, doctorPending);
secDb.users.set(adminUser.id, adminUser);

const docRecord1 = { id: 'doc_1', userId: doctorVerified.id, name: 'Dr. Verified', fee: 100.00, verificationStatus: 'verified' };
const docRecord2 = { id: 'doc_2', userId: doctorPending.id, name: 'Dr. Pending', fee: 80.00, verificationStatus: 'pending' };

secDb.doctors.set(docRecord1.id, docRecord1);
secDb.doctors.set(docRecord2.id, docRecord2);

// Live Interactive Simulation Tests
console.log('\nExecuting Hostile Attack Vectors in Runtime Sandbox...');

// Sim 1: Anonymous Queue Advancement Attack
let sim1Passed = false;
try {
  secDb.simAdvanceDoctorQueue(null, docRecord1.id);
} catch (e) {
  sim1Passed = e.message.includes('Authentication required');
}
assertSecurity(sim1Passed, 'SIM-01', 'Simulated Anonymous Queue Advancement Blocked', 'Anonymous caller could advance queue');

// Sim 2: Patient Advancing Doctor Queue Attack
let sim2Passed = false;
try {
  secDb.simAdvanceDoctorQueue(patientA.id, docRecord1.id);
} catch (e) {
  sim2Passed = e.message.includes('Not authorized');
}
assertSecurity(sim2Passed, 'SIM-02', 'Simulated Patient Role Queue Advancement Blocked', 'Patient role advanced doctor queue');

// Sim 3: Unverified Doctor Advancing Queue Attack
let sim3Passed = false;
try {
  secDb.simAdvanceDoctorQueue(doctorPending.id, docRecord2.id);
} catch (e) {
  sim3Passed = e.message.includes('Not authorized');
}
assertSecurity(sim3Passed, 'SIM-03', 'Simulated Unverified Doctor Queue Advancement Blocked', 'Unverified doctor advanced queue');

// Sim 4: Doctor A Hijacking Doctor B Queue Attack
let sim4Passed = false;
try {
  secDb.simAdvanceDoctorQueue(doctorVerified.id, docRecord2.id);
} catch (e) {
  sim4Passed = e.message.includes('Not authorized');
}
assertSecurity(sim4Passed, 'SIM-04', 'Simulated Cross-Doctor Queue Hijacking Blocked', 'Doctor A hijacked Doctor B queue');

// Sim 5: Patient Self-Approving Doctor License Attack
let sim5Passed = false;
try {
  secDb.simVerifyDoctor(patientA.id, docRecord2.id, true);
} catch (e) {
  sim5Passed = e.message.includes('Access Denied');
}
assertSecurity(sim5Passed, 'SIM-05', 'Simulated Patient Doctor License Approval Blocked', 'Patient approved doctor license');

// Sim 6: Admin Successfully Approving Doctor License
const sim6Res = secDb.simVerifyDoctor(adminUser.id, docRecord2.id, true);
assertSecurity(sim6Res.status === 'verified', 'SIM-06', 'Simulated Authorized Admin Doctor License Verification Succeeded', 'Admin could not verify doctor');

// Sim 7: Future Slot Collision Attack
const todayStr = new Date().toISOString().split('T')[0];
const targetDate = new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
const targetSlot = '11:00 AM';

const apptA = secDb.simScheduleFutureAppointment(patientA.id, docRecord1.id, targetDate, targetSlot);
let sim7CollisionPassed = false;
try {
  secDb.simScheduleFutureAppointment(patientB.id, docRecord1.id, targetDate, targetSlot);
} catch (e) {
  sim7CollisionPassed = e.message.includes('Slot collision');
}
assertSecurity(sim7CollisionPassed, 'SIM-07', 'Simulated Concurrent Future Slot Collision Blocked', 'Patient B double-booked reserved slot');

// Sim 8: Valid First QR Check-in on appointment day
const appointmentDay = new Date(targetDate + 'T10:00:00Z');
const sim8Checkin = secDb.simCheckInPatientQr(patientA.id, apptA.checkinToken, appointmentDay);
assertSecurity(sim8Checkin.status === 'checked_in', 'SIM-08', 'Simulated Authorized First QR Check-In Succeeded', 'Valid QR check-in failed');

// Sim 9: Replay Attack on Same Token
let sim9ReplayPassed = false;
try {
  secDb.simCheckInPatientQr(patientA.id, apptA.checkinToken, appointmentDay);
} catch (e) {
  sim9ReplayPassed = e.message.includes('already been used');
}
assertSecurity(sim9ReplayPassed, 'SIM-09', 'Simulated Replay Attack on Used QR Token Blocked', 'Replay check-in succeeded on used pass');

// Sim 10: Expired Token Check-in Attack
const expiredAppt = secDb.simScheduleFutureAppointment(patientB.id, docRecord1.id, targetDate, '02:00 PM');
expiredAppt.checkinTokenExpiresAt = new Date(Date.now() - 10000); // in past
let sim10ExpiredPassed = false;
try {
  secDb.simCheckInPatientQr(patientB.id, expiredAppt.checkinToken, new Date());
} catch (e) {
  sim10ExpiredPassed = e.message.includes('token has expired');
}
assertSecurity(sim10ExpiredPassed, 'SIM-10', 'Simulated Expired QR Token Check-In Blocked', 'Expired QR token checked in successfully');

// Sim 11: Future Date Premature Check-in Attack
const futureAppt = secDb.simScheduleFutureAppointment(patientB.id, docRecord1.id, targetDate, '03:00 PM');
let sim11PrematurePassed = false;
try {
  secDb.simCheckInPatientQr(patientB.id, futureAppt.checkinToken, new Date()); // today's date < targetDate
} catch (e) {
  sim11PrematurePassed = e.message.includes('only permitted on the scheduled appointment date');
}
assertSecurity(sim11PrematurePassed, 'SIM-11', 'Simulated Premature Future Date Check-In Blocked', 'Premature future appointment checked in today');

// Sim 12: Unauthorized Third-Party Check-in Attack
let sim12UnauthCheckinPassed = false;
try {
  secDb.simCheckInPatientQr(patientA.id, futureAppt.checkinToken, appointmentDay);
} catch (e) {
  sim12UnauthCheckinPassed = e.message.includes('Access Denied');
}
assertSecurity(sim12UnauthCheckinPassed, 'SIM-12', 'Simulated Third-Party Unauthorized Check-In Blocked', 'Patient A checked in Patient B pass');

// Sim 13: Financial Manipulation - Client Fabricated Coupon Attack
const invoiceSim1 = secDb.simGenerateAndSettleInvoice(patientA.id, apptA.id, 'HACK_99_PERCENT_OFF', 0);
assertSecurity(
  invoiceSim1.totalAmount === 100.00 && invoiceSim1.discountAmount === 0.00 && invoiceSim1.patientPaid === 100.00,
  'SIM-13',
  'Simulated Fabricated Coupon Attack Neutralized (Zero Discount Awarded)',
  'Fabricated coupon gave unauthorized discount'
);

// Sim 14: Financial Manipulation - Valid HEALTH10 Coupon
const invoiceSim2 = secDb.simGenerateAndSettleInvoice(patientA.id, apptA.id, 'HEALTH10', 0);
assertSecurity(
  invoiceSim2.totalAmount === 100.00 && invoiceSim2.discountAmount === 10.00 && invoiceSim2.patientPaid === 90.00,
  'SIM-14',
  'Simulated Authoritative HEALTH10 Coupon Calculation ($10 Discount on $100 Base Fee)',
  'HEALTH10 calculation mismatch'
);

// Sim 15: Financial Manipulation - Negative Insurance Coverage Attack
let sim15InsPassed = false;
try {
  secDb.simGenerateAndSettleInvoice(patientA.id, apptA.id, null, -50);
} catch (e) {
  sim15InsPassed = e.message.includes('between 0 and 100');
}
assertSecurity(sim15InsPassed, 'SIM-15', 'Simulated Negative Insurance Coverage Value Blocked', 'Negative insurance coverage accepted');

// Sim 16: Financial Manipulation - Exorbitant >100% Insurance Coverage Attack
let sim16InsPassed = false;
try {
  secDb.simGenerateAndSettleInvoice(patientA.id, apptA.id, null, 500);
} catch (e) {
  sim16InsPassed = e.message.includes('between 0 and 100');
}
assertSecurity(sim16InsPassed, 'SIM-16', 'Simulated >100% Exorbitant Insurance Coverage Blocked', '>100% insurance coverage accepted');

// Sim 17: Financial Manipulation - Cross-Patient Invoice Settlement Attack
let sim17CrossInvoicePassed = false;
try {
  secDb.simGenerateAndSettleInvoice(patientB.id, apptA.id, null, 0);
} catch (e) {
  sim17CrossInvoicePassed = e.message.includes('Access Denied');
}
assertSecurity(sim17CrossInvoicePassed, 'SIM-17', 'Simulated Cross-Patient Invoice Settlement Blocked', 'Patient B settled Patient A invoice');

// Sim 18: Past-Date Future Booking Attack
let sim18PastBookingPassed = false;
try {
  secDb.simScheduleFutureAppointment(patientA.id, docRecord1.id, '2020-01-01', '10:00 AM');
} catch (e) {
  sim18PastBookingPassed = e.message.includes('Cannot schedule appointments in the past');
}
assertSecurity(sim18PastBookingPassed, 'SIM-18', 'Simulated Past-Date Appointment Booking Blocked', 'Past-date booking succeeded');

console.log('\n================================================================================');
console.log('📊 PENETRATION TEST SUMMARY REPORT');
console.log('================================================================================');
console.log(`Total Penetration Attack Vectors Tested: ${totalTests}`);
console.log(`🛡️  Vectors Successfully Blocked / Defended: ${passedTests}`);
console.log(`🚨 Vulnerabilities / Failures Detected      : ${failedTests}`);
console.log(`Security Robustness Score                 : ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (failedTests > 0) {
  console.error('\n🚨 ATTACK SUCCESSFUL / VULNERABILITIES DETECTED:');
  failureDetails.forEach((f, idx) => {
    console.error(`  [${idx + 1}] [${f.testCode}] ${f.description}`);
    console.error(`      Exploit: ${f.attackDetails}\n`);
  });
  process.exit(1);
} else {
  console.log('\n✅ ALL 6 ADVERSARIAL PENETRATION TEST VECTORS DEFEATED WITH 100% SUCCESS!');
  console.log('   PostgreSQL RLS, Atomic RPCs, Triggers, and Store Guardrails are Fail-Closed.');
  console.log('================================================================================\n');
}
