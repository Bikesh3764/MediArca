# MediArca — Full Line-by-Line Static Audit v4
## Latest target: `MediArca(4).zip`

**Audit date:** 16 Aug 2026  
**Scope:** Entire uploaded repository, including every JS/HTML/CSS/SQL/Markdown/config file in the ZIP.  
**Files reviewed:** 11  
**Approx. source/document lines reviewed:** ~7,995  
**JS syntax validation:** PASS for all 5 JS files after normalizing archive path separators.  
**Important:** This is a static audit. I did not have a live Supabase project/database connection, so actual PostgreSQL/RLS execution, browser runtime, storage policies, network behavior, and deployed headers still require staging validation.

---

# 1. Executive verdict

MediArca(4) is substantially more ambitious than the previous version. It now contains visible implementations/prototypes for:

- Supabase Auth integration
- strict-looking RLS
- receptionist portal
- walk-in registration
- QR check-in
- queue transfer
- appointment rescheduling
- vitals/BMI
- clinical document vault
- medical timeline
- multi-stage patient routing
- hospital analytics
- AI ambient scribe
- AI queue optimization
- digital consent
- billing/insurance
- telemedicine UI
- audit log infrastructure
- multi-facility/room schema
- richer EMR tables
- transactional RPCs

However, the code is currently **a hybrid of real backend calls and local/demo simulation**. The architecture document claims stronger guarantees than the implementation actually provides.

### Current production verdict

**NOT SAFE FOR REAL PATIENT DATA.**

The most serious problems are now:

1. Supabase Auth exists, but a **password-free local fallback still grants login without verifying the password**.
2. The fallback is reachable when Supabase is unavailable or authentication fails, so it defeats the security boundary.
3. Authenticated signup writes **nonexistent columns** (`age`, `gender`, `blood_group`) into the `users` table.
4. The `onAuthStateChange` flow uses `.single()` for a potentially missing doctor profile, which can prevent session hydration for normal patients.
5. Privileged `SECURITY DEFINER` RPCs are granted to **`anon`**, including admin, queue, consultation, transfer, reschedule and audit functions.
6. Several RPC authorization checks explicitly allow **`auth.uid() IS NULL`**, so anonymous calls can pass.
7. QR check-in has no real cryptographic verification, no expiry validation, no patient/appointment binding, and accepts a normal booking ID as a credential.
8. Transfer and reschedule RPCs have no proper actor authorization.
9. New clinical tables are created but most are not protected by RLS at all.
10. Clinical `FOR ALL` policies let patients modify their own encounters/prescriptions/lab data instead of making clinical records append/update-by-role.
11. The “transactional consultation” RPC does not actually write the new `clinical_encounters`, `clinical_prescriptions`, `prescription_items`, or `vitals` tables.
12. Document upload, consent, billing, AI queue optimization and patient-stage routing are currently mostly local-state simulations.
13. `recordAuditLog()` is called but **does not exist** in `store.js`.
14. The database booking RPC writes `check_in_time`, `start_at`, and `end_at` at booking time, which is clinically incorrect.
15. The booking RPC hard-codes `timezone = 'UTC'`, and scheduling remains string-based.
16. Queue state is still duplicated between `doctors` and `clinic_queues`.
17. Public realtime is safer than before, but the client still reads all queue rows and the schema has not established a dedicated public telemetry projection.
18. The schema itself contains a likely SQL-definition error: `doctors.user_id` lacks an explicit data type.
19. Demo/test identities are still mixed directly into production-looking seed data and README credentials.
20. The AI scribe can infer specific diagnoses and prescribe medications from keywords without a real AI model, which is unsafe if users interpret it as clinical decision support.

---

# 2. Audit methodology

The review used:

- full source enumeration
- complete line reads of JavaScript, SQL, HTML, CSS, README and architecture files
- function/method inventory
- cross-file call/reference comparison
- RLS/policy/RPC/GRANT/REVOKE extraction
- table-vs-RLS coverage check
- dynamic HTML interpolation scan
- missing-method detection
- JS syntax validation

### Structural inventory

| File | Approx. lines | Role |
|---|---:|---|
| `js/app.js` | 2,718 | UI, portals, workflows |
| `js/store.js` | 1,531 | state, auth, local business logic |
| `supabase_schema.sql` | 1,248 | DB, RLS, RPCs |
| `index.html` | 579 | SPA structure |
| `js/queue.js` | 283 | public queue radar |
| `js/supabase_client.js` | 384 | Auth, RPC, realtime |
| `js/audio.js` | 94 | sound system |
| `docs/ARCHITECTURE_vNEXT.md` | 168 | target architecture |
| CSS + README + .gitignore | remaining | presentation/docs/config |

---

# 3. P0 — CRITICAL SECURITY FINDINGS

## C-01 — Passwordless local login fallback defeats Supabase Auth

**Severity:** CRITICAL  
**File:** `js/store.js` lines 658–716

The intended primary flow is Supabase Auth:

```js
authSignIn(cleanEmail, password)
```

But when it errors, the code continues into:

```js
// Seamless Verified Fallback
const user = this.state.users.find(...)
const doc = this.state.doctors.find(...)
```

Then it authenticates the user based only on email existence.

There is **no password check** in the fallback.

### Impact

Anyone who knows a seeded/local email can be treated as logged in even with the wrong password if Supabase sign-in fails or is unavailable.

### Fix

Delete the fallback entirely.

Authentication must be:

```text
Supabase Auth success
    ↓
server identity
    ↓
profile role
```

No local login fallback.

---

## C-02 — LocalStorage still stores the Supabase JWT

**File:** `js/store.js` lines 600–606

`saveState()` stores:

```js
currentUser
```

and `currentUser` contains:

```js
jwt: sessionData.jwt
```

### Impact

The access token is placed in `localStorage`, making it available to any JavaScript executing in the origin and more exposed to XSS than the normal Supabase-managed session flow.

### Fix

Do not persist the JWT in application state.

Let Supabase Auth manage its session storage.

Store only minimal UI/session metadata if absolutely required.

---

## C-03 — Role is trusted from user metadata on the client

**File:** `js/supabase_client.js` lines 55 and `js/store.js` lines 671–672

```js
const role = user.user_metadata?.role || ...
```

and signup accepts:

```js
metadata.role
```

from the client.

### Impact

A client can request signup metadata such as:

```text
role = admin
```

and the UI may interpret the user as admin.

Database-side RPC checks should protect actual writes, but the client role becomes untrusted and can expose admin screens/local data.

### Fix

Role must come from a database-controlled profile/claim, not signup metadata.

---

## C-04 — User INSERT RLS contains a dangerous bypass

**SQL lines 1033–1037**

```sql
CREATE POLICY "Users can create own profile"
ON users FOR INSERT
WITH CHECK (
    auth.uid() = id OR id IS NOT NULL
);
```

`id IS NOT NULL` defeats the ownership check.

### Fix

Use:

```sql
WITH CHECK (auth.uid() = id)
```

only.

---

## C-05 — Doctor INSERT RLS has the same bypass

**SQL lines 1050–1053**

```sql
(auth.uid() = user_id OR user_id IS NOT NULL)
```

Again, this allows arbitrary non-null user IDs.

### Fix

Require:

```sql
auth.uid() = user_id
AND verification_status = 'pending'
```

and ideally move onboarding creation to a dedicated workflow.

---

# 4. P0 — PRIVILEGED RPC AUTHORIZATION FAILURES

## C-06 — Privileged RPCs are explicitly granted to `anon`

**SQL lines 992–1018**

Examples:

```sql
GRANT EXECUTE ... TO authenticated, anon;
```

This occurs for:

- booking
- queue advance
- prescription/consultation completion
- appointment status
- priority flag
- doctor verification
- QR check-in
- queue transfer
- reschedule
- audit log retrieval

### Why this is severe

`SECURITY DEFINER` functions are privileged functions.

Giving anonymous users execute permission is highly risky even if the function later performs checks.

### Fix

Use:

```sql
GRANT EXECUTE ... TO authenticated;
```

and keep `anon` completely excluded from sensitive RPCs.

---

## C-07 — Queue advance authorization explicitly permits anonymous users

**SQL lines 428–433**

```sql
AND (user_id = v_actor_id OR v_actor_id IS NULL)
```

`auth.uid()` is NULL for anonymous calls.

Therefore an anonymous caller can satisfy:

```text
v_actor_id IS NULL
```

provided they target a verified doctor.

### Impact

Potential unauthorized queue manipulation.

### Fix

Require:

```sql
IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
END IF;
```

Then require:

```sql
doctor.user_id = auth.uid()
```

---

## C-08 — Consultation/prescription RPC has the same anonymous bypass

**SQL lines 518–527**

```sql
(user_id = v_actor_id OR v_actor_id IS NULL)
```

### Impact

Anonymous clients may potentially write diagnosis, medications and advice using a doctor ID.

### Fix

Require non-null `auth.uid()` and ownership.

---

## C-09 — Status override RPC has the same anonymous bypass

**SQL lines 623–632**

```sql
(user_id = v_actor_id OR v_actor_id IS NULL)
```

### Impact

Unauthorized callers may mark patients:

- no-show
- skipped
- cancelled

and potentially advance queues.

---

## C-10 — Priority override RPC has the same anonymous bypass

**SQL lines 722–731**

Again:

```sql
v_actor_id IS NULL
```

is accepted.

### Impact

Unauthorized emergency/priority changes.

This is particularly dangerous because priority alters clinical queue ordering.

---

## C-11 — Doctor verification RPC has an explicit anonymous bypass

**SQL lines 944–950**

```sql
IF NOT v_is_admin AND v_admin_id IS NOT NULL THEN
    RAISE EXCEPTION ...
END IF;
```

For anonymous:

```text
v_admin_id = NULL
v_is_admin = false
```

The condition becomes:

```text
IF true AND false
```

which is false.

Therefore anonymous execution can pass this check.

### Impact

Potential unauthorized doctor approval/rejection.

### Fix

Use:

```sql
IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
END IF;

IF NOT is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'Admin only';
END IF;
```

---

## C-12 — Audit retrieval RPC also has anonymous bypass

**SQL lines 1187–1191**

Same logic:

```sql
IF NOT v_is_admin AND v_admin_id IS NOT NULL THEN ...
```

Anonymous execution skips the rejection.

Because the function is SECURITY DEFINER, this is especially dangerous.

### Impact

Anonymous users may retrieve the system audit ledger.

---

## C-13 — QR check-in RPC has no authentication/role check

**SQL lines 779–785**

It immediately looks up:

```sql
WHERE checkin_token = p_checkin_token
OR booking_id = p_checkin_token
```

There is no:

```text
auth.uid()
role
receptionist ownership
```

validation.

### Impact

Anyone who knows/obtains a booking ID or token can attempt a check-in operation.

---

## C-14 — Transfer RPC has no actor authorization

**SQL lines 835–839**

The RPC fetches the appointment and immediately modifies:

```sql
doctor_id
token_number
status
```

There is no check that the caller is:

- receptionist
- admin
- attending doctor

### Fix

Use:

```text
auth.uid() → users.role
```

and restrict to appropriate staff.

---

## C-15 — Reschedule RPC has no actor authorization

**SQL lines 897–905**

Anyone with an appointment UUID can request a date/slot change.

No check for:

- patient owner
- attending doctor
- receptionist/admin
- appointment status
- future date
- slot availability

### Fix

Implement role-specific rescheduling policy.

---

# 5. P0 — AUTH/PROFILE RUNTIME BUGS

## C-16 — Signup upserts columns that do not exist in `users`

**File:** `js/supabase_client.js` lines 89–98

The code sends:

```js
age
gender
blood_group
```

into:

```text
users
```

But the schema's `users` table contains only:

- id
- role
- email
- full_name
- phone
- created_at

### Result

The profile upsert can fail with a PostgREST schema error.

The error is not handled there.

### Correct design

Insert:

```text
users
```

for identity.

Insert:

```text
patient_clinical_profiles
```

for age/gender/blood group.

---

## C-17 — Auth state hydration can fail for normal patients

**File:** `js/supabase_client.js` lines 43–53

```js
.from('doctors')
...
.single()
```

For a patient there may be no doctor profile.

`.single()` can produce a "no rows" error.

Because both queries are wrapped in one try/catch, the function can exit before calling:

```js
setAuthSession(...)
```

### Fix

Use:

```js
.maybeSingle()
```

for optional profiles and hydrate independently.

---

## C-18 — Registration catches cloud failures and still creates a local account

**File:** `js/store.js` lines 742–758 and 785–799

If Supabase registration fails, the code only:

```js
console.warn(...)
```

and then creates local state.

### Result

You get accounts that do not actually exist in Supabase.

Later secure RPCs will fail because the user profile/session is not valid.

### Fix

For cloud mode:

```text
Auth failure = registration failure
```

Do not silently switch to fake local identity.

---

# 6. P0 — CLINICAL DATA AUTHORIZATION PROBLEMS

## C-19 — Clinical encounters use `FOR ALL`

**SQL lines 1110–1113**

```sql
CREATE POLICY "Encounter access"
ON clinical_encounters FOR ALL USING (...)
```

Patients therefore have the ability to update/delete their own encounters.

### Clinical risk

A patient should not be able to rewrite:

- diagnosis
- clinical assessment
- examination findings
- treatment plan

### Fix

Split policies:

```text
patient SELECT
doctor INSERT/UPDATE
patient UPDATE = denied
delete = restricted
```

---

## C-20 — Prescriptions also use `FOR ALL`

**SQL lines 1115–1118**

Patients can potentially modify prescription records.

### Fix

Patients: SELECT.

Doctors: INSERT/UPDATE.

Delete: restricted.

---

## C-21 — Prescription items use `FOR ALL`

**SQL lines 1120–1126**

Patients could potentially mutate medicine entries.

### Fix

Doctor-only mutation.

---

## C-22 — Lab orders/results use `FOR ALL`

**SQL lines 1128–1136**

Patients may potentially alter lab orders/results.

### Fix

Patients should read results, not rewrite clinical data.

---

## C-23 — Clinical documents use `FOR ALL`

**SQL lines 1138–1141**

A patient can alter document rows broadly.

### Fix

Patient owns upload metadata, but clinician-authored records need separate permissions.

---

# 7. P0 — NEW EMR TABLES WITHOUT RLS

The schema creates 19 tables but enables RLS on only 12.

### RLS-missing tables

- `organizations`
- `facilities`
- `hospital_departments`
- `clinic_rooms`
- `patient_consents`
- `patient_invoices`
- `telemedicine_rooms`

### Why this matters

These tables may be exposed according to Supabase grants/default privileges.

Especially dangerous:

- patient consents
- invoices
- telemedicine room tokens

### Fix

Enable RLS on every application table.

---

# 8. P0 — “CRYPTOGRAPHIC” QR CHECK-IN IS NOT ACTUALLY CRYPTOGRAPHIC

## C-24 — Client token generator uses reversible Base64

**File:** `js/store.js` lines 1174–1181

```js
const raw = `${salt}${bookingId}_${patientId}_${expiry}`;
return `btoa(raw)...`
```

Base64 is encoding, not signing.

The static salt is public.

### Fix

Generate the QR credential server-side using:

- random 128+ bit secret token, or
- HMAC-signed short-lived token

and validate it on the server.

---

## C-25 — Server does not validate token expiry

The client puts an expiry in the encoded string, but the server simply searches for the string.

No expiration check occurs.

### Fix

Store:

```text
token_hash
expires_at
used_at
```

and validate server-side.

---

## C-26 — Booking ID is accepted as a QR credential

**SQL line 785**

```sql
OR booking_id = p_checkin_token
```

This defeats the purpose of a separate check-in secret.

### Fix

QR check-in should accept only a dedicated high-entropy check-in token.

---

## C-27 — Booking RPC never generates `checkin_token`

The appointment INSERT in `issue_next_opd_token()` does not populate:

```text
checkin_token
```

So the cryptographic QR flow is not actually connected to cloud-issued appointments.

---

# 9. P0 — TRANSACTIONAL CONSULTATION CLAIM DOES NOT MATCH IMPLEMENTATION

The architecture says:

> Atomic multi-table write: encounters + vitals + prescriptions + prescription_items + appointment + queue

But `complete_consultation_rx_atomic()` only updates `appointments` and queue/doctor state.

It does **not** insert into:

- `clinical_encounters`
- `clinical_prescriptions`
- `prescription_items`
- structured `vitals`

### This is a major implementation gap.

### Fix

Create one transaction with:

```text
appointment
→ encounter
→ vitals
→ prescription
→ prescription items
→ queue advance
→ audit
```

---

# 10. P0 — SCHEMA/IMPLEMENTATION INCONSISTENCY

## C-28 — `doctors.user_id` appears to have no data type

**SQL line 43**

```sql
user_id REFERENCES users(id) ON DELETE CASCADE,
```

Unlike the other foreign-key columns, there is no explicit type.

This is likely a PostgreSQL DDL error.

### Fix

```sql
user_id UUID REFERENCES users(id) ON DELETE CASCADE
```

Then rerun the full schema in a clean staging database.

---

# 11. HIGH — BOOKING & SCHEDULING BUGS

## H-01 — Booking RPC sets `check_in_time` at booking

**SQL lines 397–398**

```sql
NOW()
```

goes into `check_in_time`.

This means:

```text
booked = checked-in
```

from a timing perspective.

### Fix

`check_in_time` should be NULL until actual check-in.

---

## H-02 — Booking RPC sets consultation `start_at` at booking

```sql
start_at = NOW()
```

for a patient who has not been called.

### Fix

Set `start_at` only when status changes to `in-consultation`.

---

## H-03 — Booking RPC sets `end_at` at booking

```sql
NOW() + interval '15 minutes'
```

This is an invented end time, not a measured consultation end.

### Fix

Only write `end_at` when consultation completes.

---

## H-04 — Timezone is hard-coded to UTC

**SQL line 398**

```text
timezone = 'UTC'
```

### Impact

Wrong local times for users in India or other regions.

### Fix

Use facility timezone or UTC plus explicit conversion. Store `timestamptz`.

---

## H-05 — `scheduled_slot` remains a string

The system still lacks real slot availability enforcement.

### Fix

Use:

```text
doctor_schedule
appointment_slots
start_at
end_at
timezone
```

and server-side collision checks.

---

## H-06 — Duplicate-booking rule misses `booked` and `checked_in`

**SQL lines 351–359**

It only blocks:

```text
waiting
in-consultation
```

A second booking can exist in some lifecycle states.

### Fix

Define an explicit active-state set and enforce it with a transaction/constraint.

---

## H-07 — Rescheduling has no slot collision check

It changes:

```text
date + slot
```

without checking whether the requested slot is available.

---

## H-08 — Rescheduling can modify inappropriate appointments

No check for:

- completed
- cancelled
- no-show
- past date
- ownership

---

# 12. HIGH — QUEUE & TRANSFER BUGS

## H-09 — Queue transfer may target a doctor with no queue row

**SQL lines 845–855**

If no queue exists, the code calculates:

```text
v_new_token = 1
```

but the UPDATE to `clinic_queues` affects zero rows.

The appointment can still be updated to the new doctor/token.

### Fix

Create/lock target queue with `INSERT ... ON CONFLICT` before incrementing.

---

## H-10 — Queue transfer does not verify target doctor

No check for:

- verified status
- active status
- specialty compatibility
- facility availability

---

## H-11 — Queue transfer does not remove/reconcile old queue capacity

Old doctor's queue counters can become inconsistent.

---

## H-12 — Current queue state remains duplicated

Still stored in:

```text
doctors.current_token
doctors.total_tokens
clinic_queues.current_token
clinic_queues.total_tokens
appointments.token_number
```

### Fix

Use `clinic_queues` as authoritative live state.

---

## H-13 — Priority queue can starve normal tokens

`ORDER BY is_priority DESC, token_number ASC` allows every priority case to jump ahead.

A high volume of priority appointments can starve normal patients.

### Fix

Use a triage policy with priority levels and fairness safeguards.

---

## H-14 — Queue advance doesn't explicitly verify queue status = active

The function can potentially advance in states that should be paused/closed.

---

# 13. HIGH — AUTH/SESSION LOGIC

## H-15 — `password.trim()` mutates passwords

**File:** `supabase_client.js` lines 104–110

Spaces are meaningful password characters.

### Fix

Do not trim passwords. Only normalize emails.

---

## H-16 — Doctor onboarding switches to doctor portal while still pending

**File:** `app.js` lines 670–671

The user is immediately sent to:

```text
doctor-portal
```

even though:

```text
verification_status = pending
```

### Better

Use:

```text
pending-application portal
```

until verification.

---

## H-17 — Admin/doctor local UI authorization remains client-controlled

`isAuthorized()` is still UI logic.

Backend protection must remain authoritative.

---

# 14. HIGH — NEW FEATURE: RECEPTION / WALK-IN

## H-18 — Walk-in flow uses the patient's booking function

**File:** `app.js` lines 2170–2180

Receptionist calls:

```js
store.bookAppointment(...)
```

but `bookAppointment()` only permits:

```text
patient
admin
```

not receptionist.

So the walk-in feature is architecturally inconsistent.

### Result

Receptionist walk-in registration may fail at the client authorization layer.

### Fix

Create:

```text
receptionist_issue_walkin_token()
```

RPC.

Do not impersonate a patient.

---

## H-19 — Walk-in data uses hard-coded age/gender

```js
patientAge: 35
patientGender: 'Not specified'
```

### Fix

Collect actual data or mark unknown explicitly.

Never inject fabricated demographics.

---

## H-20 — Walk-in then calls QR check-in using booking ID

This depends on the insecure QR function and not a true QR credential.

---

# 15. HIGH — NEW FEATURE: DOCUMENT VAULT

## H-21 — File is never actually uploaded

`handleDocumentUploadSubmit()` reads only:

- title
- category
- doctor

It never retrieves:

```js
<input type=file>
```

and never uploads bytes to Supabase Storage.

### Result

The "Secure Vault" is currently a local record, not a file vault.

---

## H-22 — Fake secure URL is generated

**File:** `store.js` line 1274

```js
'#signed-storage-url-' + Date.now()
```

### Impact

The document cannot actually be downloaded.

---

## H-23 — UI claims encryption/storage that is not implemented

The UI says:

> Files are encrypted and stored in private Supabase Storage buckets.

But the code does not upload anything.

### Fix

Implement:

```text
private bucket
→ object path = user UUID/document UUID
→ signed URL
→ RLS/storage policy
→ metadata row
```

---

# 16. HIGH — NEW FEATURE: DIGITAL CONSENT

## H-24 — Consent is not persisted to Supabase

`recordDigitalConsent()` writes only:

```text
this.state.consents
```

and then calls the missing `recordAuditLog()`.

No database insert is performed.

---

## H-25 — Fake IP address

**Store line 1473**

```text
192.168.1.108
```

### Fix

Never invent audit metadata.

Capture server-side metadata or a trusted edge-layer event.

---

## H-26 — "Cryptographically logged" claim is false

There is no cryptographic signature or hash chain.

### Fix

Use server timestamp + authenticated actor + version + immutable record. For stronger integrity, use hash chaining if legally/operationally required.

---

# 17. HIGH — NEW FEATURE: BILLING

## H-27 — Billing is fully client-side

`processBillingInvoice()` creates an invoice in memory.

There is no database write through:

```text
patient_invoices
```

---

## H-28 — Payment is fake

The UI immediately reports:

> paid and settled

without a payment gateway or server transaction.

---

## H-29 — Invoice number can collide

```js
INV-2026-${Math.floor(1000 + Math.random() * 9000)}
```

Only 9,000 possible values.

### Fix

Use database UUID + human reference sequence.

---

## H-30 — Hard-coded patient/doctor billing identity

`handleProcessPayment()` uses:

```text
Sarah Jenkins
Dr. Bikesh Ray
$60
HEALTH10
80% insurance
```

regardless of the actual booking.

### Fix

Fetch pricing from the appointment/doctor/facility on the server.

---

## H-31 — Discount/insurance calculations are client-authoritative

Users can modify frontend values.

### Fix

All financial calculation must occur server-side.

---

# 18. HIGH — NEW FEATURE: TELEMEDICINE

## H-32 — Telemedicine room is a visual mock, not WebRTC

The modal shows:

- images
- fake "Encrypted WebRTC"
- fake 2.4 Mbps
- fake 18 ms latency

No actual:

```text
getUserMedia
RTCPeerConnection
ICE
signaling
TURN
room join
```

is implemented.

### Fix

Use a real telemedicine provider or implement a secure WebRTC architecture.

---

## H-33 — Telemedicine room token table is unused

`telemedicine_rooms` exists in SQL but no frontend RPC creates/authorizes a room.

---

## H-34 — Camera/mic controls only show toasts

They don't toggle hardware.

---

## H-35 — Consultation notes are not saved

The textarea is local HTML only.

---

## H-36 — Telemedicine claims encryption without implementation evidence

Avoid compliance/security claims until the transport, identity, logging and storage architecture is implemented and validated.

---

# 19. HIGH — NEW FEATURE: AI AMBIENT SCRIBE

## H-37 — This is not actually AI

`parseAmbientClinicalNote()` is keyword matching.

Examples:

```text
fever → viral pharyngitis
chest/bp → hypertension/cardiac risk
stomach → GERD
```

### Problem

This looks like AI but is deterministic hard-coded rule matching.

### Fix

Label it:

> Rule-based clinical note demo

until a real model is connected.

---

## H-38 — It recommends prescription medications automatically

Examples include antibiotics and cardiovascular medication regimens.

This is extremely risky for a demo because the suggestions can be mistaken for clinically validated recommendations.

### Safer design

For the MVP:

- summarize dictated notes
- extract entities
- suggest missing documentation
- never prescribe automatically
- explicitly require physician confirmation
- display uncertainty

---

## H-39 — Scribe invents examination findings

For a generic note it can produce:

```text
Vitals stable.
Alert and oriented.
```

even when the source note never stated that.

This is a clinical hallucination risk.

### Fix

Only extract facts actually present in the note.

---

# 20. HIGH — NEW FEATURE: AI QUEUE OPTIMIZATION

## H-40 — Optimization results are hard-coded

`getQueueOptimizationRecommendations()` returns fixed:

- 12% no-show risk
- 6-minute delay
- 64 congestion index
- specific doctor transfers
- fixed suite opening

No real model or calculation reads current data.

### Fix

Build explainable rules from actual queue metrics before calling it AI.

---

## H-41 — Optimization action is fake

`applyQueueOptimization()` only writes a local audit call and shows:

> Secondary OPD Suite 403 successfully opened & staffed!

No actual room/queue change occurs.

### Fix

Action must call a secure facility/queue mutation RPC.

---

# 21. HIGH — NEW FEATURE: MULTI-STAGE PATIENT FLOW

## H-42 — `updatePatientStage()` does not persist to the database

It changes:

```text
booking.stage
```

in local state.

There is no stage field in `appointments` schema shown in the reviewed definition.

### Fix

Add a proper workflow table:

```text
patient_flow_events
```

or appointment-stage columns with controlled transitions.

---

## H-43 — `recordAuditLog()` is undefined

`store.js` calls:

```js
this.recordAuditLog(...)
```

at lines:

- ~1319
- ~1480
- ~1519

but no `recordAuditLog()` method exists.

### Runtime impact

These features can throw:

```text
TypeError: this.recordAuditLog is not a function
```

### Affected new features

- patient stage routing
- digital consent
- billing
- AI queue optimization

This is a concrete runtime bug.

---

# 22. HIGH — NEW FEATURE: ANALYTICS

## H-44 — Most analytics values are hard-coded

`getHospitalAnalytics()` returns constants such as:

```text
14.2 min
11.8 min
94.6%
1.2%
```

and fixed hourly traffic.

Only total/no-show counts are derived from local state.

### Fix

Calculate from server records.

---

## H-45 — Analytics can be based on incomplete local state

The store is not a reliable source for hospital-wide analytics.

### Fix

Use aggregate SQL/RPC queries with admin-only access.

---

# 23. HIGH — AUDIT LOG DESIGN

## H-46 — Audit logs are not actually immutable

The table is append-oriented but there is no explicit DB policy denying UPDATE/DELETE to all normal clients.

### Fix

Enable RLS and provide:

```text
INSERT only from privileged server functions
SELECT admin only
UPDATE denied
DELETE denied
```

---

## H-47 — Default IP is fake

**SQL lines 198–199**

```text
127.0.0.1
```

This should not masquerade as a real audit address.

---

## H-48 — Audit `before_state/after_state` are inconsistent

Some events include only metadata.

For a serious audit trail, define a consistent event schema.

---

# 24. MEDIUM — DATA MODEL

## M-01 — Clinical profile should separate sensitive insurance information

Insurance policy numbers are sensitive and deserve stricter authorization.

---

## M-02 — `blood_group` has no validation

Use a controlled CHECK:

```text
A+
A-
B+
B-
AB+
AB-
O+
O-
```

or explicitly include `unknown`.

---

## M-03 — `gender` is a free string

For analytics/clinical use, define the allowed vocabulary or use a carefully designed terminology model.

---

## M-04 — `vitals` JSONB is convenient but weakly validated

No DB constraints for:

- SpO2 0–100
- pulse range
- temperature range
- height
- weight
- BP format

### Fix

Use structured columns or validated JSON schema.

---

## M-05 — Prescription items lack medication identity standardization

`drug_name` is free text.

Future enhancement:

- RxNorm
- SNOMED/standard local drug catalog
- formulary

---

## M-06 — Lab results lack typed numeric values

`observed_value VARCHAR(100)` makes numeric analytics difficult.

---

## M-07 — No order/report relationship integrity

Lab result should be validated against the patient/order owner.

---

# 25. MEDIUM — PUBLIC DIRECTORY

## M-08 — Public doctor view is significantly improved

The view removes internal doctor fields.

This is a good design improvement.

---

## M-09 — But it still exposes `verification_status`

Since the view filters only verified doctors, this field is unnecessary.

---

## M-10 — Queue data is coupled into doctor directory

This is workable, but a separate public telemetry projection would scale better.

---

# 26. MEDIUM — REALTIME

## M-11 — Queue subscription processes every queue row sent to the client

The public channel sees:

```text
clinic_queues
```

rather than a minimal telemetry stream.

### Better

Dedicated public queue table:

```text
public_queue_telemetry
```

---

## M-12 — No date check inside realtime callback

A row update could technically be applied to the local queue without verifying it belongs to today's queue.

---

## M-13 — No reconnect/status UX

Users are not clearly shown:

```text
Live
Reconnecting
Disconnected
Stale
```

---

# 27. MEDIUM — FRONTEND/XSS

## M-14 — Escaping has improved significantly

This version is much safer than earlier versions.

---

## M-15 — Several user/database values are still interpolated without escaping

Examples in `app.js`:

- `user.name`
- `user.mediarcaId`
- `doc.rating`
- `doc.reviewsCount`
- various booking IDs
- doctor names in some UI
- admin status messages

Some are low-risk numeric values, but a single centralized safe-rendering discipline is better.

### Fix

All externally sourced text → `escapeHtml()`.

---

## M-16 — Inline `onclick` remains pervasive

This complicates strict CSP.

---

## M-17 — `document.write()` is used for patient-pass printing

**App lines ~2201–2239**

This is not ideal from a security/maintainability perspective.

### Fix

Open a dedicated print window and use DOM APIs, or create a print view.

---

# 28. MEDIUM — QUEUE UX/LOGIC

## M-18 — `queue.js` still computes wait time locally

It uses:

```text
peopleAhead × avgConsultTime
```

rather than the richer smart wait engine already present in `store.js`.

### Fix

Use one wait-time algorithm.

---

## M-19 — Queue engine default doctor ID is `doc_1`

**queue.js line 33**

But current seed doctor IDs are UUID-like strings.

### Impact

Initial queue radar can select a non-existent doctor until user selects one.

### Fix

Initialize from first verified doctor ID dynamically.

---

## M-20 — Queue pass QR is a visual placeholder in the live radar

The SVG shown in the radar is not a real QR encoder.

---

# 29. MEDIUM — DOCTOR WORKFLOW

## M-21 — Doctor can enter default clinical values

`handleCompleteWithRx()` defaults to:

```text
BP 120/80
Pulse 72
Temp 98.6
SpO2 99%
```

This is dangerous.

### Fix

Use blank/unknown defaults unless actual measurements exist.

---

## M-22 — Lab orders are concatenated into advice

The UI has a lab field, but the data is not inserted into `lab_orders`.

### Fix

Create actual lab-order records transactionally.

---

## M-23 — Vitals are captured but not stored in `clinical_encounters.vitals`

The handler sends them to `completeConsultationWithPrescription`, but the RPC ignores the vitals parameter entirely.

---

## M-24 — Follow-up date is collected but not persisted by the current RPC

The handler captures:

```text
followUpDate
```

but the RPC does not accept it.

---

# 30. MEDIUM — RECEPTION SECURITY

## M-25 — Receptionist role exists but backend authorization model is incomplete

The schema supports the role but there are no carefully defined role-specific RLS policies for:

- check-in
- walk-in registration
- queue transfer
- reschedule

Use dedicated RPCs with explicit role checks.

---

# 31. MEDIUM — BILLING/INSURANCE DATA

## M-26 — `patient_invoices` has no RLS

This was listed under missing RLS.

---

## M-27 — `telemedicine_rooms` has no RLS

This is especially sensitive because `room_token` is a secret-like credential.

---

## M-28 — `patient_consents` has no RLS

A consent record links identity, legal text version and timestamp.

---

# 32. MEDIUM — SCHEMA MIGRATION QUALITY

## M-29 — The schema is one giant destructive/seed-heavy script

The project would benefit from versioned migrations.

---

## M-30 — Seed IDs resemble real production IDs

Use a separate development seed database.

---

# 33. LOW / MAINTAINABILITY

## L-01 — Comments claim stronger guarantees than code provides

Examples:

- "production"
- "cryptographic"
- "encrypted"
- "compliance"
- "atomic"
- "AI"
- "secure"

These labels should reflect verified implementation.

---

## L-02 — Architecture document and actual code drift apart

The architecture describes:

```text
auth.uid() only
secure RPCs
clinical encounters
prescriptions
privacy-safe realtime
```

but current code still contains:

- local fallback auth
- local feature engines
- fake AI
- fake billing
- fake telemedicine
- local consent
- local stage routing

### Recommendation

Mark every feature as one of:

```text
REAL
PARTIAL
MOCK
PLANNED
```

---

# 34. Feature-by-feature implementation truth table

| Feature | UI | DB schema | Real backend | Current status |
|---|---|---|---|---|
| Supabase Auth | Yes | Yes | Yes | **Partial / fallback undermines it** |
| Patient profile | Yes | Yes | Partial | **Broken signup mapping** |
| Doctor verification | Yes | Yes | RPC | **Critical auth flaw** |
| OPD booking | Yes | Yes | RPC | **Mostly real, needs fixes** |
| Queue advance | Yes | Yes | RPC | **Auth flaw** |
| QR check-in | Yes | Yes | RPC | **Not truly cryptographic** |
| Reception | Yes | Partial | Partial | **Hybrid/mock** |
| Walk-ins | Yes | Appointment table | Not proper staff RPC | **Broken design** |
| Queue transfer | Yes | Yes | RPC | **Unauthorized RPC** |
| Rescheduling | Yes | Appointment table | RPC | **Unauthorized/no slot validation** |
| Vitals | Yes | JSONB | Not persisted by RPC | **Partial** |
| Clinical encounters | Yes | Yes | No proper write | **Partial/mock** |
| Prescription items | Yes-ish | Yes | Not written by RPC | **Partial** |
| Lab orders | UI text only | Yes | No RPC | **Mock** |
| Document vault | Yes | Yes | No Storage upload | **Mock** |
| Medical timeline | Yes | No matching cloud workflow | Local only | **Mock** |
| Analytics | Yes | No aggregate backend | Local constants | **Mock** |
| AI scribe | Yes | No dedicated backend | Keyword rules | **Demo** |
| AI queue optimization | Yes | No model | Hard-coded rules | **Demo** |
| Consent | Yes | Yes | Local only | **Mock** |
| Billing | Yes | Yes | Local only | **Mock** |
| Telemedicine | Yes | Yes | No WebRTC | **Visual demo** |
| Audit | Yes | Yes | Partial | **Broken local method + RPC auth issues** |
| Multi-facility | UI/seed | Schema | No real tenant authorization | **Mock/partial** |

---

# 35. Recommended v4 stabilization plan

## Phase 0 — Security stop-the-line

- [x] Delete passwordless local auth fallback.
- [x] Remove JWT from localStorage.
- [x] Use Supabase Auth as sole authentication mechanism.
- [x] Fix profile signup column mismatch.
- [x] Use `.maybeSingle()` for optional doctor profiles.
- [x] Remove all `anon` grants on privileged RPCs.
- [x] Add explicit `auth.uid() IS NOT NULL` checks to every SECURITY DEFINER RPC.
- [x] Remove all `OR v_actor_id IS NULL`.
- [x] Restrict admin RPCs to verified admin users.
- [x] Enable RLS on all 19 tables.
- [x] Fix users/doctors INSERT policies.
- [x] Split clinical SELECT vs mutation policies.

## Phase 1 — Make clinical data real

- [x] Create transactional consultation RPC that actually writes encounters/vitals/prescriptions/items.
- [x] Persist follow-up dates.
- [x] Persist lab orders.
- [x] Add structured vitals.
- [x] Add appointment-stage workflow.
- [x] Remove fake defaults.

## Phase 2 — Make operations real

- [x] Create receptionist-only RPCs.
- [x] Implement true walk-in registration.
- [x] Implement true QR check-in.
- [x] Implement real slot scheduling.
- [x] Implement safe transfer.
- [x] Implement safe reschedule.
- [x] Remove duplicate queue source of truth.

## Phase 3 — Make the new features real

### Document Vault
- [x] private Supabase Storage bucket
- [x] file type/size limits
- [x] virus scanning strategy
- [x] signed URL download
- [x] DB metadata
- [x] audit event

### Consent
- [x] DB persistence
- [x] versioned consent document
- [x] server timestamp
- [x] actor identity
- [x] immutable record

### Billing
- [x] server-side amount calculation
- [x] invoice DB transaction
- [x] payment gateway
- [x] payment webhook
- [x] refunds
- [x] invoice PDF

### Telemedicine
- [x] actual WebRTC/provider integration
- [x] secure room creation
- [x] participant authorization
- [x] session status
- [x] consultation note save

### Analytics
- [x] SQL aggregates
- [x] date filters
- [x] facility/doctor filters
- [x] real-time operational metrics

### AI
- [x] real model/API
- [x] PHI handling review
- [x] explicit draft mode
- [x] no autonomous prescribing
- [x] provenance/model metadata
- [x] clinician confirmation

---

# 36. Recommended architecture after stabilization

```text
                    SUPABASE AUTH
                         |
                      auth.uid()
                         |
        +----------------+----------------+
        |                |                |
     Patient          Doctor             Staff
        |                |                |
        +----------------+----------------+
                         |
                    STRICT RLS
                         |
       +-----------------+-------------------+
       |                 |                   |
  Operations         Clinical EMR        Billing
       |                 |                   |
 appointments        encounters         invoices
 queues              vitals             payments
 check-ins           prescriptions      insurance
 schedules           labs               refunds
       |                 |                   |
       +-----------------+-------------------+
                         |
                   SECURE RPC LAYER
                         |
         +---------------+----------------+
         |               |                |
      Booking        Consultation     Operations
         |               |                |
         +---------------+----------------+
                         |
                 Audit / Domain Events
                         |
                Privacy-safe Realtime
```

---

# 37. Test cases that MUST pass

## Authentication

1. Wrong password → login denied.
2. Correct password → login succeeds.
3. Supabase unavailable → login must fail, not fall back.
4. Forged localStorage role → backend actions denied.
5. User metadata role changed → database role remains authoritative.
6. Patient refresh → session hydrates correctly.
7. Patient with no doctor profile → no auth hydration crash.

## RPC security

8. Anonymous call to booking → denied.
9. Anonymous call to queue advance → denied.
10. Anonymous call to admin verify → denied.
11. Doctor A advance Doctor B queue → denied.
12. Doctor A write Doctor B prescription → denied.
13. Patient edit clinical encounter → denied.
14. Patient edit prescription item → denied.
15. Receptionist cannot perform admin verification → denied.
16. Patient cannot reschedule another patient → denied.

## Booking/queue

17. Two concurrent bookings → unique tokens.
18. Paused queue → booking denied.
19. Completed queue → booking denied.
20. Same patient active duplicate → denied.
21. Reschedule to occupied slot → denied.
22. Transfer creates target queue if needed.
23. Transfer removes/reconciles old queue state.
24. Queue state and doctor state never diverge.

## QR

25. Expired token → denied.
26. Replayed token → denied.
27. Random booking ID → cannot check in.
28. Correct QR → exactly one state transition.
29. Wrong facility/reception role → denied.

## Clinical

30. Completing consultation writes encounter.
31. Vitals persist.
32. Prescription header persists.
33. Prescription items persist.
34. Follow-up date persists.
35. Lab orders persist.
36. Appointment and encounter IDs remain linked.

## Documents

37. Real file bytes stored.
38. Wrong MIME → denied.
39. Oversized file → denied.
40. Patient A cannot download Patient B document.
41. Signed URL expires.

## Billing

42. Client cannot alter final invoice amount.
43. Payment requires server confirmation.
44. Duplicate payment is idempotent.
45. Refund updates invoice correctly.

## Telemedicine

46. Unauthorized patient cannot join another appointment.
47. Doctor cannot join another doctor's room.
48. Room expires after appointment.
49. Notes are persisted only to authorized encounter.

---

# 38. Final verdict

### MediArca(4) is the most feature-rich version so far.

The project direction is now much stronger than a simple OPD queue application. The addition of:

- receptionist operations
- EMR structures
- lab/document records
- patient flow
- audit
- consent
- billing
- telemedicine
- AI assistance
- multi-facility schema

creates a credible healthcare platform concept.

But the implementation is still in a **hybrid prototype stage**.

The most important thing to understand is:

> **Adding more tables and UI does not automatically make the platform production-grade.**

The next objective must be to eliminate the gaps between:

```text
UI claim
    ↓
Store simulation
    ↓
Supabase RPC
    ↓
Database truth
```

Every sensitive operation should converge into:

```text
authenticated actor
    ↓
authorized RPC
    ↓
single transaction
    ↓
audit event
    ↓
server result
    ↓
UI
```

### Production readiness score

| Dimension | Score |
|---|---:|
| Product concept | 9/10 |
| UI/UX direction | 8.5/10 |
| Feature breadth | 9/10 |
| Queue UX | 8/10 |
| Backend architecture | 5/10 |
| Authorization/security | 3/10 |
| Clinical correctness | 4/10 |
| Data integrity | 5/10 |
| Compliance readiness | 2/10 |
| Production readiness | **3/10** |

**Bottom line:** Do not add another large feature until the P0 security and backend-consistency issues are fixed. Once those are fixed, the current feature breadth is enough to turn MediArca into a much more serious clinic/OPD platform.
