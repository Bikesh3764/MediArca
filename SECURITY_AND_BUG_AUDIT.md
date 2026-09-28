# MediArca Comprehensive Bug & Security Audit

**Repository:** `Bikesh3764/MediArca`  
**Branch audited:** `main`  
**Audited commit:** `9d34ff4eee9a6d274654109a0c53b77331db24ec`  
**Audit date:** 2026-09-28  
**Method:** Static source review of backend, frontend, Prisma schema, deployment configuration, and GitHub workflows.

> **Important:** This audit does **not** claim that every possible runtime bug has been found. The repository currently has no usable backend CI/test status attached to the latest commit, so conclusions below are based on code inspection. Before production deployment, apply fixes in a staging environment and run the regression checklist in this file.

## Executive summary

The most important issues are:

1. **CRITICAL — Google authentication can accept forged/unverified credentials.**
2. **CRITICAL — Doctor profile update endpoint allows mass assignment of security-sensitive fields, including verification state.**
3. **CRITICAL — Receptionist queue endpoint is only authenticated, not receptionist-authorized, and can expose patient/appointment/prescription data to other authenticated roles.**
4. **CRITICAL — Doctor medical-record lookup does not verify the doctor is authorized to access the requested patient.**
5. **HIGH — JWT uses a hard-coded fallback secret if `JWT_SECRET` is missing.**
6. **HIGH — Medical records can be stored behind public R2 URLs / public static uploads.**
7. **HIGH — Receptionist appointment-status endpoint can be called by non-receptionists.**
8. **HIGH — Client-supplied clock time is trusted for appointment/slot decisions and can be manipulated.**
9. **HIGH — Runtime database schema mutation silently ignores failures and can leave production partially migrated.**
10. **HIGH — Several endpoints have weak state-transition rules and/or tenant-boundary checks.**
11. **MEDIUM/HIGH — No rate limiting on login, registration, Google auth, or public receptionist application.**
12. **MEDIUM — API returns internal error messages to browsers.**
13. **MEDIUM — Demo credentials and simulated Google login are shipped in the production frontend.**
14. **MEDIUM — Queue/slot capacity logic is vulnerable to concurrency overbooking and does not consistently isolate clinics.**
15. **MEDIUM — Money is stored as floating point instead of integer paise/decimal.**

---

# 1. CRITICAL — Forged Google credentials accepted

**Files**
- `backend/src/controllers/authController.ts:385-409`
- `frontend/src/pages/Auth/Login.tsx`
- `frontend/src/pages/Auth/Signup.tsx`

### Why this is dangerous

The Google auth controller correctly calls `verifyIdToken()` when a configured client ID exists, **but on verification failure it falls back to `jwt.decode()`**. When the client ID is absent it decodes the token directly. It then manually decodes the JWT payload again if needed.

That means the backend can accept an arbitrary token containing an attacker-chosen `email` and create/login an account for that identity.

The frontend also contains a simulated Google login that constructs a fake JWT-like value.

### Safe fix

Production Google auth must be fail-closed:

- Require `GOOGLE_CLIENT_ID`.
- Call `verifyIdToken()`.
- Reject if verification fails.
- Do **not** use `jwt.decode()` as authentication.
- Do **not** parse arbitrary credential payloads as proof of identity.
- Keep demo Google auth behind a strict development-only guard that cannot be enabled in production.

### Regression safety

Test:
- real Google login succeeds;
- invalid signature fails;
- wrong audience fails;
- expired credential fails;
- malformed token fails;
- production build does not expose a simulated-login path.

**Do not** replace the verification call with another decode helper.

---

# 2. CRITICAL — Doctor can mass-assign protected profile fields

**File**
- `backend/src/controllers/authController.ts:329-356`

### Why this is dangerous

`updateProfile()` does:

`const { fullName, phone, avatarUrl, ...roleSpecificData } = req.body`

and then spreads `roleSpecificData` into `doctorProfile.update()`.

This permits a doctor to submit fields that should be controlled by platform administration, for example:

- `isVerified`
- `verificationStatus`
- `rating`
- `totalReviews`
- `userId`
- `consultationFee`
- other sensitive profile fields

The spread order also allows client input to override explicitly supplied values such as `userId` during creates.

### Safe fix

Replace mass assignment with explicit allowlists.

For a doctor self-profile update, allow only fields intentionally editable by doctors, e.g.:
- fullName
- phone
- avatarUrl
- specialty
- qualifications
- experienceYears
- bio
- clinicAddress
- checking times / schedule fields where appropriate

Never accept:
- userId
- role
- isVerified
- verificationStatus
- rating
- totalReviews
- createdAt / updatedAt
- any future administrative fields

### Regression safety

Before deployment:
- verify an unverified doctor cannot set `isVerified=true`;
- verify a doctor cannot alter their role;
- verify their profile still saves normal editable fields;
- verify admin verification continues to work.

**Important:** Do not “fix” this by simply deleting all doctor profile fields from the request. Use an explicit allowlist so legitimate profile editing keeps working.

---

# 3. CRITICAL — Receptionist queue endpoint leaks clinical data to other authenticated roles

**Files**
- `backend/src/routes/receptionistRoutes.ts:14-31`
- `backend/src/controllers/receptionistController.ts` (`getDoctorQueue`)

### Why this is dangerous

The route only applies `authenticate`.

Inside `getDoctorQueue()`, assignment checks happen only when `req.user.role === 'RECEPTIONIST'`. Other authenticated roles can continue through the function.

The response includes:
- patient names
- phone numbers
- email addresses
- symptoms
- reason for visit
- prescriptions

This creates an authenticated-but-unauthorized data disclosure path.

### Safe fix

Enforce the role at the route:

`router.get('/doctors/:doctorId/queue', authenticate, authorize('RECEPTIONIST'), getDoctorQueue)`

and keep the controller assignment + clinic checks as defense in depth.

### Regression safety

Verify:
- receptionist assigned to doctor: succeeds;
- receptionist not assigned: 403;
- patient: 403;
- doctor: 403;
- clinic: 403 unless an intentionally separate endpoint exists;
- admin: 403 unless a separate admin endpoint is designed.

---

# 4. CRITICAL — Doctor patient-record endpoint lacks patient relationship authorization

**File**
- `backend/src/controllers/recordController.ts:85-123`

### Why this is dangerous

A doctor may submit an arbitrary `patientId`. The controller checks only that the role is `DOCTOR`; it does not verify that the doctor is actually authorized to access that patient's records.

The query then returns all records for that ID.

### Safe fix

For doctors, permit access only when there is an explicit authorized relationship, such as:
- an appointment between the doctor and patient;
- optionally the same clinic/tenant if your business rules require it.

Prefer a direct relationship check before reading records.

Also consider adding an audit log for record access.

### Regression safety

Verify:
- assigned/treated patient records are visible;
- unrelated patient records return 403;
- patient can still see own records;
- admin access works as intended.

---

# 5. HIGH — Hard-coded JWT fallback secret

**Files**
- `backend/src/authController.ts:10`
- `backend/src/middleware/authMiddleware.ts`

### Problem

Both use:

`process.env.JWT_SECRET || 'mediarca-fallback-jwt-secret'`

If a production environment is misconfigured, an attacker can potentially mint valid tokens.

### Safe fix

Fail startup when the secret is absent.

Example policy:
- production: missing/weak secret = startup failure;
- development: use a clearly local-only secret if needed.

### Regression safety

This change invalidates tokens if the production secret changes. Plan for re-login/token invalidation before switching secrets.

---

# 6. HIGH — Medical documents can become publicly accessible

**Files**
- `backend/src/server.ts`
- `backend/src/config/r2.ts`
- `backend/src/controllers/recordController.ts`

### Problem

The backend serves `/uploads` as a public static directory, and R2 is configured around a public URL.

Medical records are sensitive clinical data. A public object URL means access control can be bypassed by anyone who gets the URL.

### Safe fix

Use:
- private R2 bucket/object visibility;
- authenticated download endpoint;
- short-lived signed URLs if the frontend needs direct object access;
- never expose a permanent public URL for clinical documents.

Avatars can remain public if that is intentional.

### Regression safety

Test:
- patient can download own document;
- unauthorized user cannot download by guessing/copying URL;
- expired signed URL stops working;
- deleted record no longer downloads;
- avatar URLs still work.

---

# 7. HIGH — Receptionist status endpoint is not role-protected

**File**
- `backend/src/routes/receptionistRoutes.ts`
- `backend/src/controllers/receptionistController.ts:647-740`

### Problem

The route is behind `authenticate`, but the controller only performs receptionist-specific authorization **inside** an `if (role === 'RECEPTIONIST')` block. Non-receptionist authenticated users can reach the final appointment update.

That can allow unauthorized status changes such as:
- WAITING
- IN_CONSULTATION
- COMPLETED
- CANCELLED

### Safe fix

Require `authorize('RECEPTIONIST')` at route level and keep ownership/assignment checks.

Also enforce legal state transitions.

---

# 8. HIGH — Client-controlled clock is used for security/business decisions

**Files**
- `backend/src/controllers/appointmentController.ts:384`
- `frontend/src/services/api.ts:1008-1016, 1089+`

### Problem

The frontend sends `clientMinutes`, and the backend passes that value into `evaluateSlotStatus()`.

A client can change this value.

That means a malicious caller may attempt to:
- pretend a slot is still open;
- manipulate current-time calculations;
- alter queue/slot decisions.

### Safe fix

Use server-side time as the authority.

If IST is the business timezone, calculate IST on the backend and use the frontend clock only for display.

### Regression safety

Test from clients with intentionally wrong clocks:
- client set 2 hours ahead;
- client set 2 hours behind;
- no clientMinutes;
- invalid values.

Server-side behavior should remain correct.

---

# 9. HIGH — Runtime database DDL is unsafe operationally

**File**
- `backend/src/server.ts:17+`

### Problem

`ensureSchema()` runs many `ALTER TABLE` and `CREATE TABLE` commands at application startup.

Failures are often swallowed with empty catch blocks.

This can result in:
- partially migrated production state;
- startup race conditions;
- schema drift from Prisma;
- difficult-to-debug deployments.

### Safe fix

Move schema evolution to Prisma migrations.

Deployment should:
1. build;
2. `prisma migrate deploy`;
3. start the server.

Remove runtime DDL after the migration path is proven.

### Regression safety

Do this in staging first:
- backup database;
- run migrations against a copy;
- run application;
- verify old records;
- verify new columns/tables;
- verify rollback/recovery procedure.

**Do not blindly replace this with `prisma db push` in production.**

---

# 10. HIGH — Consultation state transitions are too permissive

**File**
- `backend/src/controllers/consultationController.ts`

### Problem

`callPatient()` rejects only CANCELLED/COMPLETED, so a `PENDING_APPROVAL` appointment can potentially be moved into consultation if its ID is known.

`completeConsultation()` similarly allows completion of states other than CANCELLED.

This can bypass the intended receptionist/payment workflow.

### Safe state model

Enforce:

- `PENDING_APPROVAL -> WAITING`
- `WAITING -> IN_CONSULTATION`
- `IN_CONSULTATION -> COMPLETED`
- cancellation only from states where cancellation is allowed
- rejected/pending requests cannot be consulted

Also verify `paymentStatus` when the business rule requires payment before consultation.

---

# 11. HIGH — Clinic/tenant boundary is inconsistent when viewing appointments

**File**
- `backend/src/controllers/appointmentController.ts:589-618`

### Problem

For receptionist access, authorization is true if either:
- appointment clinic matches receptionist clinic, **or**
- receptionist is assigned to the doctor.

For a multi-clinic doctor this can allow one clinic's receptionist to view another clinic's appointment.

### Safe fix

When `appointment.clinicId` is present, require the receptionist's clinic to match it **and** require doctor assignment.

Use the same tenant rule everywhere in the application.

---

# 12. HIGH — Clinic can assign a receptionist to doctors outside the clinic

**File**
- `backend/src/controllers/clinicController.ts:836-898`

### Problem

`respondToReceptionistRequest()` creates `DoctorReceptionist` rows directly from the supplied `doctorIds` without checking that those doctors belong to the clinic.

Another function (`updateClinicReceptionistDoctors`) does perform this validation, so the protections are inconsistent.

### Safe fix

Before creating assignments:
- load clinic's active/accepted doctor IDs;
- filter/validate the submitted IDs;
- reject cross-clinic IDs;
- perform the whole change in one transaction.

Also validate `action` strictly as ACCEPT/REJECT.

---

# 13. MEDIUM/HIGH — Receptionist provisioning can include inactive affiliations

**File**
- `backend/src/controllers/clinicController.ts:590-614`

### Problem

`addClinicReceptionist()` validates only that a doctor is present in the clinic's affiliation list, not that the affiliation status is active/accepted.

### Safe fix

Only allow doctors whose clinic affiliation is in an operational state.

---

# 14. HIGH — Slot capacity can be exceeded under concurrency

**Files**
- `backend/src/controllers/appointmentController.ts`
- `backend/src/controllers/receptionistController.ts`

### Problem

Capacity is checked by reading a count and then creating an appointment. Concurrent transactions can both observe available capacity.

Retries handle queue-number uniqueness, but do not guarantee that slot capacity itself stays below the limit.

### Safe fix

Use a durable concurrency-control strategy, for example:
- a slot/date booking counter row with atomic increment;
- row locking;
- serializable transaction + retry;
- another proven atomic capacity design.

Test with concurrent booking requests.

---

# 15. MEDIUM/HIGH — Slot/queue capacity is not consistently clinic-scoped

**File**
- `backend/src/controllers/appointmentController.ts`

Some capacity/queue queries use only:
- doctorId
- appointmentDate

even though the application also supports clinic-specific schedules and clinic-specific fees.

This can merge capacity across multiple clinics for the same doctor.

### Safe fix

Decide explicitly whether a doctor's queue is:
- global across all clinics, or
- independent per clinic.

Then encode that choice consistently in:
- queries;
- unique indexes;
- queue assignment;
- capacity checks;
- receptionist views.

If queues are per clinic, the current uniqueness model is likely insufficient.

---

# 16. MEDIUM — Invalid slot IDs silently fall back to another slot

**File**
- `backend/src/controllers/appointmentController.ts:386-391`

### Problem

If a caller supplies a bad `slotId`, the backend silently picks the first available slot.

This is surprising and can create an appointment in a different slot from the user's request.

### Safe fix

If `slotId` is supplied:
- validate that it exists in the authoritative server-side slot set;
- reject invalid slot IDs with 400.

Only auto-select a slot when the caller intentionally omits slotId.

---

# 17. MEDIUM — Appointment date is accepted as an arbitrary string

**Files**
- `backend/src/controllers/appointmentController.ts`
- `backend/src/controllers/receptionistController.ts`

### Problem

`appointmentDate` is not strictly validated as a real calendar date.

String comparisons can also behave unexpectedly for malformed dates.

### Safe fix

Validate strict `YYYY-MM-DD` and real calendar validity.
Reject malformed dates and dates outside the allowed booking window.

---

# 18. MEDIUM — Walk-in account identity collision risk

**Files**
- `backend/src/controllers/appointmentController.ts`
- `backend/src/controllers/receptionistController.ts`

Walk-in lookup searches users by phone across all user roles.

A phone number shared with another account type could accidentally bind a walk-in appointment to that account.

### Safe fix

When linking by phone:
- only reuse users with `role='PATIENT'`;
- otherwise require explicit patient identity handling.

Also consider a dedicated walk-in patient entity instead of creating synthetic login accounts.

---

# 19. MEDIUM — Weak synthetic walk-in credentials

Walk-in accounts are created with a known password `walkin123`.

Even if those accounts are intended to be internal-only, reusable credentials are unsafe.

### Safe fix

Use a random high-entropy unusable password or a non-login walk-in identity model.

---

# 20. MEDIUM/HIGH — No rate limiting on authentication endpoints

**Files**
- `backend/src/server.ts`
- `backend/src/routes/authRoutes.ts`
- `backend/src/routes/receptionistRoutes.ts`

There is no visible rate limiter for:
- login;
- registration;
- Google auth;
- receptionist application.

### Safe fix

Add IP/account-aware rate limiting, especially to auth and public application endpoints.

Do not rate-limit legitimate patient queue refreshes as aggressively as authentication.

---

# 21. MEDIUM — Production API leaks internal error messages

Many controllers return patterns such as:

`error: error.message`

This can disclose Prisma/database details to clients.

### Safe fix

Production responses should return:
- stable safe message;
- optional error code/request ID.

Log the detailed error server-side.

Keep detailed errors available only in development.

---

# 22. MEDIUM — Demo credentials are committed into the frontend

**File**
- `frontend/src/pages/Auth/Login.tsx`

The UI contains one-click credentials for patient, doctor, and receptionist accounts.

### Risk

If those accounts ever contain real or privileged data, anyone can log in using public source code.

### Safe fix

For production:
- remove demo credentials entirely; or
- enable demo mode only in development/staging;
- ensure demo data is isolated and non-sensitive.

The current code should not be used against real patient data.

---

# 23. MEDIUM — Simulated Google login exists in production frontend

**Files**
- `frontend/src/pages/Auth/Login.tsx`
- `frontend/src/pages/Auth/Signup.tsx`

The UI can construct a fake Google token for demo sign-in.

Even after fixing the backend, this is confusing in production and can create an unsafe authentication path later.

### Safe fix

Compile/feature-flag demo auth out of production builds.

---

# 24. MEDIUM — Frontend stores bearer JWT in localStorage

**File**
- `frontend/src/context/AuthContext.tsx`

A token stored in localStorage is accessible to JavaScript running on the page. If the app ever has an XSS vulnerability, the token can be stolen.

### Safe long-term architecture

Consider secure, HttpOnly, SameSite cookies plus a CSRF strategy.

This is a larger architectural change and should be implemented separately from the immediate bug fixes.

---

# 25. MEDIUM — Public R2 URL is hard-coded as a default

**File**
- `backend/src/config/r2.ts`

The code contains a fallback public R2 domain.

Even though the URL itself is not a secret, production should not silently inherit a public storage destination.

### Safe fix

Make production configuration explicit:
- require `R2_PUBLIC_URL` only for public assets;
- use private storage for medical records;
- fail clearly when a required storage setting is missing.

---

# 26. MEDIUM — Money stored as Float

**File**
- `backend/prisma/schema.prisma`

`consultationFee Float`

Floating point is not ideal for currency.

### Safe fix

Use:
- integer paise (e.g. ₹500.00 = 50000), or
- Prisma Decimal.

This becomes especially important once a real payment gateway is integrated.

---

# 27. MEDIUM — Appointment/payment model lacks payment transaction identity

**File**
- `backend/prisma/schema.prisma`

There is only:
- `paymentStatus`

There is no:
- gateway order ID;
- transaction ID;
- provider;
- amount snapshot;
- verified timestamp;
- refund state.

### Why this matters

For a real gateway integration, a boolean-ish payment status is not sufficient for reconciliation or webhook idempotency.

### Safe fix

Add a dedicated payment model or equivalent transaction fields before integrating production payment processing.

Do not let the frontend decide `PAID`.

---

# 28. LOW/MEDIUM — Status fields are free-form strings

The schema uses strings for values such as:
- appointment status;
- payment status;
- verification status;
- receptionist status;
- affiliation status.

This makes invalid states easier to introduce.

### Safe fix

Use Prisma enums where practical, or add centralized validation constants and DB constraints.

---

# 29. LOW/MEDIUM — Appointment cancellation does not model refunds/payment reversal

**File**
- `backend/src/controllers/appointmentController.ts`

A paid appointment can be cancelled without a payment/refund workflow.

This is mostly a business-flow gap today, but it becomes important as soon as real gateway payments are enabled.

---

# 30. LOW/MEDIUM — Patient appointment UI hides PENDING_APPROVAL/REJECTED states

**File**
- `frontend/src/pages/Patient/MyAppointments.tsx`

The UI's "upcoming" filter includes only:
- WAITING
- IN_CONSULTATION

The "past" filter includes:
- COMPLETED
- CANCELLED

So an online booking request in `PENDING_APPROVAL` (and a rejected request) may disappear from both tabs.

### Safe fix

Create an explicit pending/requests state and show:
- pending payment/approval;
- rejected;
- cancellation reason where appropriate.

---

# 31. LOW/MEDIUM — API offline demo fallback can show fake production data

**File**
- `frontend/src/services/api.ts`

Some API failures fall back to `DEMO_DOCTORS` and offline queue calculations.

### Risk

During a real backend outage, the frontend can display fake doctors/fees/availability.

This can be especially dangerous for a healthcare booking application.

### Safe fix

In production, fail clearly when the backend is unavailable.

Keep demo fallback behind an explicit development/demo flag.

---

# 32. LOW — Misleading authentication/security wording

**File**
- `frontend/src/pages/Auth/AdminLogin.tsx`

The UI says “256-bit encrypted JWT”.

JWTs are generally signed, not automatically encrypted.

### Safe fix

Use accurate wording such as “Signed JWT session token”.

---

# 33. LOW — Public health endpoint reveals operational metadata

**File**
- `backend/src/server.ts`

The public health response includes:
- service name;
- uptime;
- database connectivity state;
- timestamp.

This is not a critical issue, but keep public health output minimal.

---

# Recommended remediation order

## Phase 0 — Before touching production

1. Create a staging database.
2. Back up current production data.
3. Disable use of real patient data in demos.
4. Record the current production environment variables.
5. Keep the current main branch intact.

## Phase 1 — Security blockers

Fix these first:

1. Google credential verification.
2. Doctor mass-assignment / self-verification.
3. Receptionist queue authorization.
4. Doctor patient-record authorization.
5. JWT fallback secret.
6. Private medical-document access.
7. Receptionist status authorization.
8. Server-authoritative appointment time.

## Phase 2 — Data/tenant integrity

Then fix:

1. Runtime schema migration.
2. Clinic/receptionist cross-tenant assignment.
3. Appointment state machine.
4. Queue/slot concurrency.
5. Clinic-scoped queue/capacity rules.
6. Strict date/slot validation.
7. Walk-in identity collision.

## Phase 3 — Production hardening

Then add:

1. Rate limiting.
2. Safe production error responses.
3. Demo feature flags/removal.
4. Stronger session architecture.
5. Currency-safe storage.
6. Payment transaction model.
7. Prisma enums/constraints.
8. Audit logging for clinical-data access.

---

# Regression checklist

Run these after every security-related change.

## Authentication

- [ ] Patient login works.
- [ ] Doctor login works.
- [ ] Clinic login works.
- [ ] Receptionist login works.
- [ ] Admin login works.
- [ ] Invalid passwords fail.
- [ ] Expired JWT fails.
- [ ] Missing JWT_SECRET stops production startup.
- [ ] Forged Google token fails.
- [ ] Real Google ID token succeeds.

## Authorization

- [ ] Patient cannot open another patient's appointment.
- [ ] Patient cannot update appointment status.
- [ ] Patient cannot view another patient's records.
- [ ] Doctor cannot verify themselves.
- [ ] Doctor cannot alter rating/review totals.
- [ ] Doctor can see only authorized patient records.
- [ ] Receptionist can see only assigned doctors.
- [ ] Receptionist can see only their clinic's queue.
- [ ] Receptionist cannot access another clinic's appointment.
- [ ] Clinic cannot assign receptionist to another clinic's doctor.
- [ ] Admin functions remain admin-only.

## Appointments

- [ ] Past dates rejected.
- [ ] Invalid dates rejected.
- [ ] Invalid slot IDs rejected.
- [ ] Closed slots rejected.
- [ ] Full slots rejected.
- [ ] Concurrent bookings never exceed slot capacity.
- [ ] Queue numbers remain unique.
- [ ] Pending online bookings remain pending until the intended approval/payment event.
- [ ] Consultation cannot start from PENDING_APPROVAL.
- [ ] Consultation cannot complete from an invalid state.

## Medical documents

- [ ] Patient can upload permitted file types.
- [ ] Patient cannot upload oversized files.
- [ ] Patient can view own records.
- [ ] Unauthorized user cannot download the file URL directly.
- [ ] Signed URLs expire.
- [ ] Deleting the DB record removes storage object where intended.

## Payments (when gateway is integrated)

- [ ] Amount is calculated server-side.
- [ ] Frontend cannot choose final payable amount.
- [ ] Webhook signatures are verified.
- [ ] Webhook is idempotent.
- [ ] Duplicate webhook does not duplicate appointment/payment.
- [ ] Payment amount matches the appointment price.
- [ ] Failed payment never becomes PAID.
- [ ] Refund state is persisted.

## Deployment

- [ ] Prisma migration succeeds on a clean staging database.
- [ ] Prisma migration succeeds against a copy of production.
- [ ] No runtime DDL is required.
- [ ] Frontend production build contains no demo auth.
- [ ] Backend CI/build passes.
- [ ] Database backup and recovery procedure is tested.

---

# What I would NOT change in one giant commit

To reduce regression risk, do **not** combine these into a single “fix everything” patch:

- authentication architecture migration;
- Prisma schema migration;
- appointment queue algorithm rewrite;
- payment gateway integration;
- storage security redesign.

Ship them as small, independently testable changes.

## Suggested commit sequence

1. `fix(auth): fail closed for google identity verification`
2. `fix(auth): remove profile mass assignment`
3. `fix(authz): lock receptionist queue endpoints to assigned staff`
4. `fix(records): enforce doctor patient authorization`
5. `fix(security): require configured jwt secret`
6. `fix(storage): make medical records private`
7. `fix(appointments): use server time and strict validation`
8. `fix(clinic): enforce tenant boundaries for staff assignments`
9. `fix(schema): replace runtime ddl with prisma migrations`
10. `hardening(api): add rate limiting and safe error responses`

---

# Final assessment

The project has a solid functional structure, and several ownership checks are already present in the appointment and consultation flows. However, the current code should **not be treated as production-safe for real patient data** until the CRITICAL issues above are addressed.

The safest approach is to implement the security fixes in small commits, validate each on staging, and only then move to schema/queue/payment changes.
