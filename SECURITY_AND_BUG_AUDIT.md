# MediArca — Second Bug & Security Audit

**Repository:** `Bikesh3764/MediArca`  
**Branch audited:** `main`  
**Current commit audited:** `f88f867bedca721266f85eb88f93779186369e18`  
**Previous audit commit:** `511857f725070ab9d01679ec1cdc832eb9d96fce`  
**Audit date:** 2026-09-28  
**Method:** Second-pass static audit of the current source tree, focused on the changes made after the first audit, plus re-checking all previous critical/high findings.

> **Important:** This report is a code audit, not a guarantee that every possible runtime bug has been found. The repository's current `verify-fixes.ts` suite is heavily simulation/unit oriented and does not exercise the full Express + Prisma authorization paths. The latest GitHub Actions run successfully deployed the frontend, but the workflow does not execute the backend security regression suite.

---

# Current overall status

The latest security fix commit does resolve a substantial number of the previous findings. However, the repository is **not yet at “all findings resolved” status**.

### Current priority picture

| Priority | Current status |
|---|---|
| Critical | 0 newly confirmed; previous critical findings are largely fixed |
| High | Several remain open/partially fixed |
| Medium | Several remain open |
| Low | Multiple hardening items remain |

The most important remaining items are:

1. **HIGH — JWT secret still has a hard-coded fallback and there is no startup fail-closed guard.**
2. **HIGH — Server still trusts client-supplied clock minutes for booking/queue decisions.**
3. **HIGH — Medical records can still be exposed through public storage URLs / public uploads.**
4. **HIGH — Unverified doctor profiles remain directly accessible by ID.**
5. **HIGH — Production frontend can silently replace a failed real doctor lookup with a demo doctor.**
6. **HIGH — Pending/rejected receptionist accounts are still not blocked at the backend session/authorization layer.**
7. **HIGH — Appointment detail responses still include the patient's complete medical-record collection to non-doctor roles.**
8. **HIGH — Runtime database DDL is still executed at application startup and failures are swallowed.**
9. **MEDIUM/HIGH — Multi-clinic queue/capacity logic is still not consistently clinic-scoped.**
10. **MEDIUM — Patient DOB update writes a JavaScript `Date` into a Prisma `String` field.**
11. **MEDIUM — Upload validation accepts MIME OR extension rather than validating file content.**
12. **MEDIUM — Password requirements for normal patient/doctor registration remain weak.**
13. **MEDIUM — Public APIs expose doctor contact information and reviewer identity data.**
14. **MEDIUM — Production API still returns internal error messages.**
15. **MEDIUM — Rate limiting is in-memory and covers only a few endpoints.**

---

# Findings that ARE fixed after the latest commit

The following earlier findings are now backed by concrete code changes:

### 1. Google authentication fail-closed in production — FIXED

`backend/src/controllers/authController.ts` now rejects failed Google ID-token verification when a production Google client ID is configured, instead of falling back to accepting the decoded payload.

This is a real improvement.

**Remaining caveat:** development mode still allows decoded mock credentials. That is acceptable only if the development environment cannot reach real production data.

---

### 2. Doctor profile mass assignment — FIXED

`updateProfile()` now explicitly picks doctor fields instead of blindly spreading the request body into Prisma.

Protected fields such as:
- `isVerified`
- `verificationStatus`
- `rating`
- `totalReviews`
- `userId`
- `id`

are no longer directly assignable by a doctor.

---

### 3. Receptionist queue role guard — FIXED

`receptionistRoutes.ts` now applies:

`authenticate, authorize('RECEPTIONIST')`

to receptionist operations.

This closes the previous “any authenticated user can call receptionist queue endpoints” path.

---

### 4. Receptionist appointment-status endpoint — FIXED

The controller now explicitly requires the receptionist role and checks receptionist assignment before changing appointment status.

---

### 5. Doctor patient-record relationship check — FIXED/PARTIAL

Doctor record access now requires an appointment relationship with the target patient.

This blocks the previous arbitrary-`patientId` lookup.

**Remaining privacy concern:** the relationship is “any historical appointment”, so a doctor who treated a patient once can continue seeing all of that patient's uploaded records indefinitely. This may be intentional, but should be an explicit retention/access policy rather than an accidental side effect.

---

### 6. Provisional queue integer overflow — FIXED

The previous timestamp/random negative token could exceed PostgreSQL's signed 32-bit integer range.

The code now generates sequential negative values such as:

`-1, -2, -3...`

This is safe within the normal range.

**Remaining edge case:** the sequence should stop/reject before crossing `-2147483648`.

---

### 7. Doctor/clinic affiliation self-approval checks — FIXED

The latest code uses `requestedBy` to prevent an actor from approving an affiliation that they initiated.

---

### 8. Suspended doctor booking — FIXED

Online booking now checks:

- `isVerified`
- `verificationStatus !== 'SUSPENDED'`
- `verificationStatus !== 'REJECTED'`

before creating appointments.

---

### 9. Consultation state-machine guard — FIXED/PARTIAL

The latest code blocks calling/completing inappropriate states such as `PENDING_APPROVAL`, `COMPLETED`, and `CANCELLED`.

**Remaining issue:** the transition model is still encoded manually in multiple controllers instead of one centralized transition function.

---

### 10. Cross-clinic receptionist doctor assignment — FIXED

Doctor IDs are now filtered against the clinic's active/accepted affiliations before assignment.

---

### 11. Receptionist provisioning with inactive doctors — FIXED

The clinic's receptionist-provisioning flow now uses active/accepted affiliations.

---

### 12. Patient Medical Records routing — FIXED

`/patient/records` and `/records` now render `MedicalRecords` rather than unconditionally redirecting to appointments.

---

### 13. Pending/rejected appointment visibility — FIXED

The patient appointment page now includes:

- `PENDING_APPROVAL`
- `REJECTED`

instead of silently dropping those states.

---

### 14. Destructive production seeding — FIXED

`backend/prisma/seed.ts` now blocks production seeding unless explicitly overridden.

---

### 15. Base64 medical-record URL handling — FIXED

`getFileUrl()` now preserves `data:` URLs instead of prepending the API base URL.

---

# Remaining HIGH findings

## 16. HIGH — JWT hard-coded fallback is still present

**Files**
- `backend/src/middleware/authMiddleware.ts`
- `backend/src/controllers/authController.ts`

Current code still contains:

`process.env.JWT_SECRET || 'mediarca-fallback-jwt-secret'`

The current `server.ts` does **not** contain a production startup guard that aborts when the secret is absent.

The Render configuration generates a JWT secret, which helps the intended Render deployment, but the application code itself remains fail-open when deployed incorrectly.

### Safe fix

Require a configured JWT secret at process startup.

Production should refuse to start when:
- `JWT_SECRET` is missing;
- it equals the fallback;
- it is below an acceptable minimum strength.

Do not simply remove the fallback without ensuring deployment environment variables exist.

---

## 17. HIGH — Client-controlled clock is STILL used for booking decisions

**Files**
- `backend/src/controllers/appointmentController.ts`
- `frontend/src/services/api.ts`

The backend still receives `clientMinutes` and passes it into:

`evaluateSlotStatus(..., clientMinsNum, ...)`

The frontend also explicitly sends:

`clientMinutes = new Date().getHours() * 60 + new Date().getMinutes()`

This means the browser can alter the clock used by availability calculations.

### Safe fix

Use one server-authoritative time source on the backend.

The frontend clock should only affect display.

A client-supplied time value should be ignored for authorization/booking decisions.

---

## 18. HIGH — Unverified doctors remain accessible by direct ID

**File**
- `backend/src/controllers/doctorController.ts`

`getDoctorById()` blocks:
- `SUSPENDED`
- `REJECTED`

but does **not** block:

`isVerified === false`

The public directory uses `isVerified: true`, so the listing is protected, but direct lookup is not equivalent to the public directory.

### Impact

Anyone who obtains an unverified doctor's ID may still receive the profile response.

### Safe fix

The public detail endpoint should require the same public eligibility rule as the public directory, unless an intentionally separate authenticated “profile preview” endpoint is created.

---

## 19. HIGH — Production frontend silently substitutes demo doctor data after real API failure

**File**
- `frontend/src/services/api.ts`

`getDoctorById()` catches API errors and returns:

- the requested demo doctor if IDs happen to match; otherwise
- `DEMO_DOCTORS[0]`

### Why this is especially dangerous

In a booking flow:

1. real doctor lookup fails;
2. UI receives a demo doctor;
3. user sees the wrong doctor;
4. the booking call uses `doctor.id` from that returned object.

That can turn an outage, 403, or 404 into a booking against a different doctor.

The same architectural problem exists in:
- `getDoctors()`
- `getQueuePreview()`

because they can fall back to demo data on API failure.

### Safe fix

Production must fail visibly and safely when the backend is unavailable.

Demo fallback should be behind an explicit development/demo flag.

---

## 20. HIGH — Pending/rejected receptionist accounts are not enforced server-side

**Files**
- `backend/src/controllers/authController.ts`
- `backend/src/controllers/receptionistController.ts`
- `frontend/src/pages/Receptionist/ReceptionistAuth.tsx`

`applyReceptionist()` creates the user with:

`receptionistProfile.status = 'PENDING'`

But normal login creates a JWT without checking the receptionist status.

`getMyReceptionist()` checks the role but does not check:

`receptionist.status === 'ACTIVE'`

### Why this matters

The frontend can hide some access, but the backend is the actual security boundary.

A pending/rejected receptionist should not be able to access protected receptionist operations merely because the credentials are correct.

There is an additional issue: rejecting an existing receptionist does not remove the existing `DoctorReceptionist` assignments.

### Safe fix

For receptionist endpoints require:
- role = RECEPTIONIST;
- profile exists;
- status = ACTIVE;
- temporary password rule satisfied.

For rejected profiles, remove or disable all doctor assignments in the same transaction.

---

## 21. HIGH — Appointment detail endpoint exposes full medical records to clinic/receptionist users

**File**
- `backend/src/controllers/appointmentController.ts`

The appointment query includes:

`patient.medicalRecords`

The endpoint then authorizes:
- patient;
- doctor;
- admin;
- clinic;
- receptionist.

Therefore an authorized clinic/receptionist can receive a patient's uploaded medical documents merely by viewing an appointment detail response.

This is broader than the intended queue/appointment workflow.

### Safe fix

Do not include `medicalRecords` in the generic appointment response.

Create a separate medical-record access path with explicit clinical authorization.

---

## 22. HIGH — Medical-record storage is still public

**Files**
- `backend/src/config/r2.ts`
- `backend/src/controllers/recordController.ts`
- `backend/src/server.ts`

The R2 helper returns a permanent public URL and the application still exposes `/uploads` as static files.

For healthcare documents this is unsafe.

### Safe architecture

Store clinical records privately and expose them only through an authenticated backend endpoint or short-lived signed URLs.

Patient ownership must be checked before generating a URL.

---

## 23. HIGH — Runtime database schema mutation is still present

**File**
- `backend/src/server.ts`

`ensureSchema()` still executes multiple:
- `ALTER TABLE`
- `CREATE TABLE`
- `UPDATE`

statements at application startup.

Many failures are swallowed by empty catch blocks.

### Why the previous “migration fixed” claim is not supported

The current code still performs runtime DDL. There is no evidence in the audited source that this architecture was replaced by a proper Prisma migration workflow.

### Safe fix

Use versioned Prisma migrations and run:

`prisma migrate deploy`

during deployment.

Only start the application after the migration succeeds.

---

# Remaining MEDIUM findings

## 24. MEDIUM/HIGH — Multi-clinic queue logic is still inconsistent

Several queue/capacity queries use:

- `doctorId`
- `appointmentDate`

without consistently adding `clinicId`.

Examples include:
- booking capacity;
- approval capacity;
- next queue-number selection;
- consultation reset operations.

Yet clinic-specific schedules and fees exist.

### Risk

A doctor working at Clinic A and Clinic B can have:
- shared queue numbers;
- shared capacity calculations;
- one clinic affecting the other's active consultation state.

### Safe fix

Decide the business rule first:

**A. One global queue per doctor/day**, or  
**B. Separate queue per clinic/doctor/day.**

Then enforce the same rule in:
- DB unique indexes;
- queue assignment;
- capacity checks;
- approvals;
- consultation state;
- receptionist reporting.

Do not “patch” individual queries independently.

---

## 25. MEDIUM — Patient DOB update type mismatch

**File**
- `backend/src/controllers/authController.ts`

The controller currently converts:

`dateOfBirth ? new Date(dateOfBirth) : null`

But the Prisma schema defines:

`dateOfBirth String?`

The use of `any` prevents TypeScript from catching this.

### Impact

A normal patient profile update containing date of birth can fail at runtime because Prisma expects a string, not a Date object.

### Safe fix

Either:
- keep the schema as `String` and store a validated ISO date string, or
- migrate the schema column to `DateTime`.

For the current design, the least disruptive fix is to store a validated `YYYY-MM-DD` string.

---

## 26. MEDIUM — Doctor profile numeric validation is incomplete

`updateProfile()` accepts values such as:
- decimal `avgConsultationMinutes` even though schema uses `Int`;
- negative consultation fee;
- negative experience;
- invalid max-patient values.

`updateSchedule()` has some clamping but does not validate the complete slot structure.

### Safe fix

Validate:
- integers where Prisma expects Int;
- finite/non-negative fees;
- sensible consultation durations;
- positive max patients;
- valid `HH:mm` times;
- non-overlapping slots;
- start/end ordering.

---

## 27. MEDIUM — Upload validation uses MIME OR extension

**File**
- `backend/src/middleware/uploadMiddleware.ts`

The filter accepts a file when:

`allowed MIME || allowed extension`

A malicious file can therefore pass by using a permitted extension with an untrusted content type.

### Safe fix

Use:
- MIME + extension consistency;
- file-signature/magic-byte validation;
- safe server-generated filenames;
- private storage for medical documents.

Do not trust `originalname` alone.

---

## 28. MEDIUM — Registration password policy is weaker than receptionist provisioning

Normal patient/doctor registration does not visibly enforce a minimum password length, while receptionist provisioning requires 6 characters.

### Safe fix

Apply a consistent password policy to all password-based account creation.

---

## 29. MEDIUM — Public doctor responses expose personal contact information

**Files**
- `backend/src/controllers/doctorController.ts`

Public doctor APIs select:
- email;
- phone.

These are included in public responses.

A public directory normally only needs professional contact channels or clinic contact information.

---

## 30. MEDIUM — Public doctor responses expose reviewer identity

Doctor listing/detail queries include recent reviews with:
- reviewer full name;
- reviewer avatar.

In a healthcare application, tying identifiable people to a doctor review can create privacy concerns.

### Safe fix

Use:
- anonymous review identity;
- pseudonym;
- explicit user opt-in for public name display.

---

## 31. MEDIUM — API exposes internal error messages

Many controllers still return:

`error: error.message`

This can expose Prisma/database details.

### Safe fix

Production responses should return a stable public message and a request/error ID.

Detailed stack/database information should remain server-side.

---

## 32. MEDIUM — CORS is still wildcard

**File**
- `backend/src/server.ts`

Current configuration is effectively:

`origin: '*'`

while also enabling credentials.

The backend already defines `FRONTEND_URL` in deployment configuration, but it is not being used to restrict allowed origins.

### Safe fix

Allow only the deployed frontend origin(s).

Keep development localhost origins separate.

---

## 33. MEDIUM — Rate limiter is too narrow for production protection

The new in-memory limiter is useful, but it only protects:
- login;
- register;
- Google auth;
- receptionist application.

It does not protect expensive public endpoints such as:
- doctor search;
- doctor detail;
- queue preview;
- public clinic listing.

It is also process-local, so:
- restarting the process resets it;
- multiple instances do not share limits.

### Safe fix

Use a shared rate-limit store when scaling and add appropriate limits to public expensive endpoints.

---

## 34. MEDIUM — Rate limiter keying behind a proxy needs verification

The limiter relies on `req.ip`, but the server does not show an explicit `trust proxy` configuration.

On Render/reverse-proxy infrastructure, the real client IP handling should be explicitly configured and tested.

Otherwise rate limiting can become:
- too broad;
- ineffective;
- dependent on proxy behavior.

---

## 35. MEDIUM — Appointment date is still treated as a free-form string

The schema stores:

`appointmentDate String`

and booking endpoints do not visibly validate strict calendar semantics before processing.

A malformed date can therefore enter queue/business logic.

### Safe fix

Validate:
- exact `YYYY-MM-DD`;
- real calendar date;
- allowed booking horizon;
- server timezone policy.

---

## 36. MEDIUM — Slot validation is incomplete

A doctor can submit arbitrary slot JSON.

There is no clear central validation that:
- slots are non-overlapping;
- times are valid;
- maxPatients is sane;
- consultation duration is positive;
- slot IDs are unique;
- a slot's custom pace is compatible with its duration/capacity.

### Safe fix

Build one shared server-side `validateSchedule()` function and use it everywhere schedule data enters the system.

---

## 37. MEDIUM — Doctor suspension is not uniformly enforced on clinical operations

Booking blocks suspended doctors, but consultation endpoints primarily authorize by role + doctor ownership.

There is no single shared “doctor must currently be active” policy.

### Decision required

If suspension is intended to immediately stop all clinical operations, enforce it in:
- queue retrieval;
- call patient;
- notes/vitals;
- completion/prescription;
- future appointment handling.

If suspension only prevents new bookings, document that policy explicitly.

---

## 38. MEDIUM — Appointment state changes are still distributed across controllers

Receptionist, doctor, and cancellation paths each implement pieces of the state machine.

This makes future regressions likely.

### Safe fix

Centralize allowed transitions, e.g.:

`canTransition(from, to, actor)`

and use it everywhere.

---

## 39. MEDIUM — Currency is still stored as Float

**File**
- `backend/prisma/schema.prisma`

`consultationFee Float`

This is risky for financial calculations.

### Safe fix

Use:
- integer paise, or
- Prisma `Decimal`.

---

## 40. MEDIUM — Payment model is still not production-grade

Current appointment payment state is primarily:

- `PENDING`
- `PAID`
- `FAILED`

There is no dedicated payment transaction record containing things such as:
- provider;
- order ID;
- transaction/payment ID;
- amount snapshot;
- verified timestamp;
- refund status;
- webhook idempotency key.

### Safe fix

Create a dedicated payment entity before connecting a real payment provider.

Never let a frontend request be sufficient evidence that money was received.

---

# Frontend reliability findings

## 41. HIGH — Demo fallback should never run during production outages

Affected APIs include:
- doctor search;
- doctor detail;
- queue preview.

This can create a false representation of live clinical state.

### Required rule

**Production:** backend failure = clear error state.  
**Demo/dev:** optional demo fallback.

Use a build-time or runtime mode flag.

---

# Security architecture finding

## 42. MEDIUM — Bearer JWTs remain in localStorage

**File**
- `frontend/src/context/AuthContext.tsx`

The current application stores the access token in localStorage.

This is common for prototypes, but any XSS can expose the token.

### Long-term hardening

For a production healthcare platform, consider:
- HttpOnly secure cookies;
- SameSite controls;
- CSRF protection;
- short-lived access tokens;
- refresh-token rotation.

This should be a separate architecture change, not mixed into a queue bug fix.

---

# Testing / verification finding

## 43. HIGH — “428 passed” does NOT prove all security fixes are tested

**File**
- `backend/scripts/verify-fixes.ts`

The test file imports utility functions and constructs simulated authorization/state scenarios.

It does not appear to:
- instantiate the Express app;
- send real HTTP requests;
- connect to Prisma;
- execute real database authorization queries;
- test real route middleware composition.

Therefore tests such as “doctor cannot view another patient's records” are mostly simulations of intended logic, not end-to-end proof that the route/database path enforces it.

### Safe fix

Add real integration tests with a test database or isolated test environment.

At minimum test:
- forged JWT;
- each role against each protected endpoint;
- cross-clinic appointment access;
- pending/rejected receptionist access;
- actual Prisma ownership queries;
- concurrent queue booking.

---

# Deployment verification

The latest GitHub Actions frontend deployment run for commit `f88f867bedca721266f85eb88f93779186369e18` completed successfully.

That confirms the frontend deployment workflow can build/deploy the current frontend.

It does **not** establish that:
- backend security tests ran;
- Prisma integration tests ran;
- production database migrations ran;
- backend authorization paths were exercised.

A dedicated backend CI workflow should be added.

---

# Previous finding → current status matrix

| Previous finding | Current status |
|---|---|
| Forged Google auth | ✅ Fixed in production path |
| Doctor mass assignment | ✅ Fixed |
| Receptionist queue role bypass | ✅ Fixed |
| Doctor arbitrary patient-record lookup | ✅ Fixed, but historical-access scope remains broad |
| Provisional queue integer overflow | ✅ Fixed |
| Receptionist status role bypass | ✅ Fixed |
| Doctor self-affiliation approval | ✅ Fixed |
| Clinic self-affiliation approval | ✅ Fixed |
| Suspended doctor new booking | ✅ Fixed |
| Consultation invalid states | ✅ Fixed/strengthened |
| Concurrent pending capacity issue | ⚠️ Improved, but multi-clinic scope still needs review |
| Data URI handling | ✅ Fixed |
| Cross-clinic staff assignment | ✅ Fixed |
| Inactive doctor receptionist assignment | ✅ Fixed |
| Receptionist appointment privacy scope | ✅ Improved |
| JWT production fallback | ❌ Still open |
| Destructive production seed | ✅ Fixed |
| Client clock manipulation | ❌ Still open |
| Completed-patient wait calculation | ✅ Fixed |
| Medical Records routing | ✅ Fixed |
| Pending/rejected appointment UI | ✅ Fixed |
| Auth rate limiting | ⚠️ Added, production-hardening still needed |
| Receptionist temporary-password enforcement | ✅ Mostly fixed |
| Prescription vault upload | ✅ Fixed |
| Shift capacity display | ✅ Fixed |
| Custom consultation pacing | ✅ Improved |

---

# Safest remediation order

## Phase 1 — Do these before any real patient-data deployment

1. Remove JWT fallback secret and fail startup if secret is missing.
2. Remove client time from all server-side booking decisions.
3. Make medical-record storage private.
4. Remove demo fallback from production.
5. Require verified status for public doctor detail.
6. Enforce receptionist `ACTIVE` status server-side.
7. Stop including medical records in generic appointment responses.
8. Replace runtime DDL with Prisma migrations.

## Phase 2 — Prevent data-integrity regressions

1. Decide whether queues are per doctor/day or per clinic/doctor/day.
2. Apply that decision consistently to unique indexes and queue queries.
3. Fix DOB string/date mismatch.
4. Centralize appointment state transitions.
5. Validate schedule input centrally.
6. Validate appointment dates centrally.

## Phase 3 — Production hardening

1. Strict upload-content validation.
2. Strong password policy.
3. Restrictive CORS.
4. Safe error responses.
5. Shared rate limiting.
6. Currency-safe storage.
7. Dedicated payment entity.
8. HttpOnly session architecture.
9. Real integration tests.
10. Backend CI.

---

# Regression rule for every future fix

Before merging a security fix, verify three things:

**1. The intended exploit is closed.**  
Example: a non-receptionist receives 403.

**2. The legitimate workflow still works.**  
Example: an assigned active receptionist can still approve an appointment.

**3. The fix cannot be bypassed through another route.**  
Example: protecting the route but forgetting the duplicate `/api/receptionist` mount is not sufficient.

---

# Final assessment

The latest commit is a meaningful improvement and removes many of the original critical authorization defects.

However, the current repository should **not yet be described as having “all critical/high/medium findings resolved.”** The strongest remaining concerns are JWT fallback behavior, client-controlled time, public clinical-document storage, demo-data failover, receptionist lifecycle authorization, appointment-detail medical-record exposure, and runtime schema mutation.

The next round of changes should be small and independently testable. Avoid combining authentication, storage, migrations, and queue architecture into one large patch.
