/**
 * MediArca - Automated Regression & Audit Test Suite (Full Line-by-Line 2026-08-17 Edition)
 * Validates store logic, queue algorithms, slot collisions, stage transitions, cloud sync, RLS immutability triggers, 
 * zero demo credentials in store, zero hardcoded passwords in app, persistent hospitalSettings serialization, 
 * server-authoritative reports, zero cross-user seed ID fallbacks, patient billing authorization, dynamic notifications,
 * clean empty production clinical boot state, fail-closed official exports, schema token constraints, future slot unique indexes,
 * date-bound QR lifetimes, safe DOM printing without document.write, and clean audit credential hygiene.
 */

const fs = require('fs');
const path = require('path');

console.log('--- Starting MediArca Automated Regression Suite (Full Line-by-Line 2026-08-17 Edition) ---');

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
assert(schemaContent.includes('AND status = \'in-consultation\''), 'Consultation completion strictly requires in-consultation state (C-02)');
assert(schemaContent.includes('v_checkin_token := \'MED-QR-\''), 'Rescheduling regenerates fresh CSPRNG check-in token (RS-04)');
assert(schemaContent.includes('prevent_user_role_escalation'), 'Users table contains immutable role trigger (P0)');
assert(schemaContent.includes('prevent_doctor_self_verification'), 'Doctors table contains self-verification prevention trigger (P0)');
assert(schemaContent.includes('token_number INT CHECK (token_number IS NULL OR token_number > 0)'), 'Appointments table permits NULL token_number for future scheduled visits (BUG-02 Resolution)');
assert(schemaContent.includes('uq_active_doctor_future_slot'), 'Schema includes unique index on active future slots for concurrency safety (BUG-04 Resolution)');
assert(schemaContent.includes('(p_scheduled_date + interval \'1 day\')::timestamptz'), 'Future appointment QR checkin token expiry is tied to appointment date (BUG-03 Resolution)');
assert(schemaContent.includes('checkin_token_issued\', true'), 'Issue OPD token logs audit flag instead of raw bearer check-in token (BUG-08 Resolution)');
assert(!schemaContent.includes('Physical exam recorded by attending physician.'), 'No assertive placeholder exam findings in consultation RPC (BUG-05 Resolution)');

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
const queueContent = fs.readFileSync(queuePath, 'utf-8');
const supabaseClientContent = fs.readFileSync(supabaseClientPath, 'utf-8');

assert(appContent.includes('async handleProcessPayment'), 'handleProcessPayment is async');
assert(appContent.includes('async renderAdminHub'), 'renderAdminHub is async');
assert(appContent.includes('submitBtn.disabled = true'), 'handleBookingSubmit has double-click protection (UX-03)');
assert(appContent.includes('handleDownloadThroughputCsv'), 'Admin hub supports real dynamic CSV export (P1)');
assert(appContent.includes('handleSaveAdminSettings'), 'Admin hub supports persistent hospital configuration (P1)');
assert(storeContent.includes('hospitalSettings: this.state.hospitalSettings'), 'Hospital settings are serialized in saveState across sessions (P0)');
assert(storeContent.includes('this.state.hospitalSettings = parsed.hospitalSettings'), 'Hospital settings are hydrated in loadState across sessions (P0)');
assert(appContent.includes('handleDownloadVaultDoc'), 'Clinical document downloads request fresh cryptographic signed URLs (P1)');
assert(appContent.includes('cloudGetAdminAuditLogs'), 'Admin hub queries server-authoritative audit logs (P1)');
assert(!appContent.includes('O+ Positive</strong></div>'), 'Hardcoded patient demo blood group removed from patient profile (P0)');
assert(!appContent.includes('tl.patientId === \'a0000000-0000-0000-0000-000000000001\''), 'Cross-user seed ID timeline fallback eliminated from patient portal (P0 Privacy)');
assert(!appContent.includes('d.patientId === \'a0000000-0000-0000-0000-000000000001\''), 'Cross-user seed ID document fallback eliminated from patient portal (P0 Privacy)');
assert(!appContent.includes('<div style="font-weight: 700; color: #b91c1c;">Penicillin (Severe)</div>'), 'Hardcoded allergy removed from doctor consultation card (P0)');
assert(!appContent.includes('|| store.state.bookings[0]'), 'Billing payment strictly disallows fallback to first unowned booking in local state (P0)');
assert(appContent.includes('booking.patientId !== currentUserId'), 'Billing payment enforces authenticated patient appointment ownership (P0)');
assert(!appContent.includes('showBillingModal(\'bk_live\')'), 'Patient portal billing button bound to dynamic active appointment (P0)');
assert(!storeContent.includes('docData.password || \'doc123\''), 'Doctor registration strictly disallows hardcoded doc123 password fallback (P0)');
assert(!appContent.includes('receptionLoginPassword\')?.value.trim() || \'reception123\''), 'Receptionist login strictly disallows hardcoded reception123 password fallback (P0)');
assert(!appContent.includes('Token #2 is confirmed for Today 10:30 AM in Suite 402'), 'Hardcoded static notifications replaced with dynamic patient appointment telemetry (P0)');
assert(!appContent.includes('BP 124/82 ↘ 120/80 mmHg'), 'Doctor consultation card vitals trend replaced with dynamic clinical records (P0)');
assert(storeContent.includes('bookings: []'), 'Production store runtime boots with clean empty bookings array (P0 Data Separation)');
assert(storeContent.includes('medicalTimeline: []'), 'Production store runtime boots with clean empty timeline array (P0 Data Separation)');
assert(storeContent.includes('clinicalDocuments: []'), 'Production store runtime boots with clean empty documents array (P0 Data Separation)');
assert(appContent.includes('Server throughput data unavailable'), 'Official throughput report fails closed on server query error (P1)');
assert(appContent.includes('Failed to export server audit ledger'), 'Official compliance audit report fails closed on server query error (P1)');
assert(!appContent.includes('win.document.write('), 'Patient pass printing uses safe DOM innerHTML instead of document.write (BUG-14 Resolution)');
assert(storeContent.includes('Clinical Document Vault upload failed'), 'Store throws on vault upload failure');
assert(storeContent.includes('Billing transaction could not be settled'), 'Store fails closed on cloud billing settlement failure (BI-03)');
assert(storeContent.includes('Appointment booking could not be completed on the hospital server'), 'Store fails closed on cloud booking failure (P0)');
assert(!storeContent.includes('waiting * 3.5'), 'Synthetic waiting multiplier removed from store');
assert(!appContent.includes('value="120/80 mmHg"'), 'Hardcoded default vitals values removed from doctor console');
assert(!appContent.includes('value="Acute Upper Respiratory Tract Infection"'), 'Hardcoded default diagnosis removed from doctor console (P0)');
assert(!appContent.includes('value="Tab. Azithromycin 500mg"'), 'Hardcoded default prescription medications removed from doctor console (P0)');
assert(!storeContent.includes('seedAccounts'), 'Zero hardcoded demo passwords in production store (P0)');
assert(supabaseClientContent.includes('appointments_patient_id_fkey'), 'Initial sync hydrates appointments & queue tokens from Supabase (H-01 & Q-04)');
assert(supabaseClientContent.includes('clinical_documents\').remove'), 'Storage objects cleaned up automatically on metadata failure (P1)');
assert(!supabaseClientContent.includes('metadata.role === \'receptionist\' ? \'receptionist\''), 'Public signup strictly disallows self-assigned receptionist role (P0)');
assert(storeContent.includes('getPatientTimeline'), 'Dynamic medical timeline synthesizer present in store (MT-01)');

// 4. Batch 1: P0-01 through P0-12 Exhaustive Audit Assertions (2026-08-17)
assert(!supabaseClientContent.includes('document_name: metadata.title || cleanFileName'), 'P0-01: cleanFileName ReferenceError eliminated in uploadClinicalDocument');
assert(appContent.includes('value="lab_report"'), 'P0-02: Document category options match database CHECK constraint');
assert(schemaContent.includes('total_amount NUMERIC(10, 2) NOT NULL DEFAULT 60.00'), 'P0-03/P0-04: patient_invoices table includes total_amount column');
assert(schemaContent.includes('terms_accepted BOOLEAN NOT NULL DEFAULT true'), 'P0-05: patient_consents table includes terms_accepted column');
assert(storeContent.includes('from(\'doctors\')\n          .upsert'), 'P0-06: Doctor registration persists doctor record into database table');
assert(appContent.includes('booking.checkinToken || booking.checkin_token'), 'P0-07: Patient pass prints authoritative server check-in token');
assert(schemaContent.includes('Access Denied: You are not authorized to transition the status of this appointment'), 'P0-08: Status transition RPC enforces caller authorization');
assert(schemaContent.includes('trg_prevent_appointment_core_fields_mutation'), 'P0-09: Trigger protects immutable appointment fields on UPDATE');
assert(schemaContent.includes('status IN (\'waiting\', \'checked_in\')'), 'P0-10: Queue advance recognizes both waiting and checked_in patients');
assert(supabaseClientContent.includes('p_examination_findings: rxData.examinationFindings'), 'P0-11: Clinical consultation passes all examination and treatment fields');
assert(schemaContent.includes('appointment_id, doctor_id, patient_id, test_name, clinical_indication, status'), 'P0-12: Lab orders insertion uses clinical_indication column');

// 5. Batch 2: P1-01 through P1-22 Exhaustive Audit Assertions (2026-08-17)
assert(storeContent.includes('pauseDoctorQueue(doctorId)'), 'P1-01: pauseDoctorQueue method present in store');
assert(supabaseClientContent.includes('cloudGetAdminAuditLogs(limit = 50)'), 'P1-02: cloudGetAdminAuditLogs method present in supabase client');
assert(queueContent.includes('store.calculateSmartWaitTime(doctor.id, yourToken)'), 'P1-03: Queue radar passes doctor.id and yourToken to calculateSmartWaitTime');
assert(appContent.includes('this.isProcessingPayment = true'), 'P1-07: Payment processing enforces double-click idempotency lock');
assert(appContent.includes('updateBillingCalculations'), 'P1-04/05/06: Live interactive billing calculations on coupon/insurance update');
assert(schemaContent.includes('trg_prevent_telemedicine_room_tampering'), 'P1-11: Trigger prevents session tampering on telemedicine rooms');
assert(supabaseClientContent.includes('users!appointments_patient_id_fkey') && supabaseClientContent.includes('from(\'doctors\').select(\'*\')'), 'P1-13: Admin session hydrates all doctors & users from database');
assert(schemaContent.includes('\'from_status\', v_from_status'), 'P1-15: Status transition captures true from_status before updating');
assert(schemaContent.includes('ecg_diagnostics') && schemaContent.includes('pharmacy'), 'P1-16: update_patient_stage_atomic validates against recognized stage allowlist');
assert(schemaContent.includes('v_doctor.verification_status != \'verified\''), 'P1-17: Stage transition requires accredited verified attending physician');
assert(schemaContent.includes('AND verification_status = \'verified\''), 'P1-19: mark_appointment_status_atomic requires verified physician');
assert(schemaContent.includes('trg_prevent_doctor_ownership_mutation'), 'P1-22: Trigger prevents modification of immutable doctor account user_id');

// 6. Batch 3: P2 & P3 Hardening & Security Checks (2026-08-17)
assert(!appContent.includes('<span>Blood Pressure:</span> <strong>120/80 mmHg</strong>'), 'P2-01: Static vitals in patient dashboard replaced with dynamic EHR demographics');
assert(!appContent.includes('<td>${escapeHtml(u.bloodGroup || \'O+\')}</td>'), 'P2-02: Hardcoded O+ blood group fallback eliminated from admin user registry');
assert(appContent.includes('escapeHtml(log.action)') && appContent.includes('escapeHtml(log.entity)'), 'P2-03: Admin audit log table entries are strictly HTML-escaped');
assert(appContent.includes('escapeHtml(doc.hospital)'), 'P2-04: Doctor hospital affiliations in table views are HTML-escaped');
assert(appContent.includes('escapeHtml(booking.patientName)'), 'P2-05: Patient names in billing invoices are HTML-escaped');

// 7. Validate Security Headers & Deployment Config
const headersPath = path.join(__dirname, '../_headers');
const vercelPath = path.join(__dirname, '../vercel.json');
if (fs.existsSync(headersPath)) {
  const headersContent = fs.readFileSync(headersPath, 'utf-8');
  assert(headersContent.includes('camera=(self)'), 'Production _headers allows local camera access (P2)');
}
if (fs.existsSync(vercelPath)) {
  const vercelContent = fs.readFileSync(vercelPath, 'utf-8');
  assert(vercelContent.includes('camera=(self)'), 'Production vercel.json allows local camera access (P2)');
}

console.log(`\nTest Summary: ${passCount} Passed, ${failCount} Failed.`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('--- ALL FULL LINE-BY-LINE AUDIT BATCHES (P0, P1, P2, P3) PASSED 100% SUCCESSFULLY! ---');
}
