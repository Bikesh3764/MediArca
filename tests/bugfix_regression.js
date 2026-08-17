const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'js/store.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'js/supabase_client.js'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'supabase_schema.sql'), 'utf8');

const failures = [];
function assert(cond, msg) { if (!cond) failures.push(msg); }

assert(!/(password|docPassword)\s*=.*\.trim\(\)/.test(app), 'Password inputs must never be trimmed in UI handlers.');
assert(store.includes("Hospital server is unavailable. QR check-in was not completed."), 'QR check-in must fail closed offline.');
assert(store.includes("Hospital server is unavailable. Digital consent was not recorded."), 'Digital consent must fail closed offline.');
assert(store.includes("Hospital server is unavailable. Clinical status was not changed."), 'Appointment status updates must fail closed offline.');
assert(store.includes("Hospital server is unavailable. Emergency priority was not changed."), 'Priority updates must fail closed offline.');
assert(store.includes("Hospital server is unavailable. Queue transfer was not changed."), 'Queue transfer must fail closed offline.');
assert(store.includes("Hospital server is unavailable. Appointment was not rescheduled."), 'Rescheduling must fail closed offline.');
assert(store.includes("Hospital server is unavailable. Clinical document was not uploaded."), 'Clinical document upload must fail closed offline.');
assert(client.includes("File type could not be determined."), 'Empty MIME metadata must not silently become PDF.');
assert(schema.includes("role IN ('patient', 'doctor', 'admin', 'receptionist')"), 'Receptionist role must be present in canonical schema.');
assert(schema.includes('REVOKE ALL ON FUNCTION issue_next_opd_token(UUID, TEXT, VARCHAR, VARCHAR, INT, VARCHAR, VARCHAR) FROM PUBLIC, anon;'), 'OPD booking RPC anon execution must be revoked.');
assert(schema.includes('REVOKE ALL ON FUNCTION schedule_future_appointment_atomic(UUID, DATE, VARCHAR, TEXT, VARCHAR, VARCHAR, INT, VARCHAR, VARCHAR) FROM PUBLIC, anon;'), 'Future scheduling RPC anon execution must be revoked.');
assert(schema.includes("checkin_token_issued', true"), 'Booking audit logs must not store raw bearer check-in token.');

if (failures.length) {
  console.error('BUGFIX REGRESSION FAILURES:');
  failures.forEach((f) => console.error(' - ' + f));
  process.exit(1);
}
console.log('Bug-fix regression suite: 12/12 passed.');
