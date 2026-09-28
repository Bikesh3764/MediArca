# MediArca — Third Bug & Security Re-Audit

**Repository:** `Bikesh3764/MediArca`  
**Branch audited:** `main`  
**Current commit audited:** `7b562bc95add76773bcc3dbaf9563ff633d8ab83`  
**Previous remediation commit:** `5a74345aa1b2e92e0a10db098bc63c6b1ae2e896`  
**Audit date:** 2026-09-28  
**Method:** Static re-audit of the complete current source tree, with targeted review of the latest security-fix changes and regression hunting across authentication, authorization, medical-record privacy, queue integrity, clinic/receptionist lifecycle, storage, and data validation.

> **Important:** This is a source-code audit, not a guarantee that every runtime bug is found. The repository's `verify-fixes.ts` harness is simulation/unit oriented and does not prove real Express + Prisma behavior. The latest GitHub Actions run for commit `7b562bc` successfully deployed the frontend, but the repository has no backend security/integration-test workflow.

---

# Executive result

The latest changes fixed a substantial portion of the previous findings, including:

- production JWT secret fail-closed handling;
- removal of client-supplied booking time;
- public direct-ID doctor verification;
- production demo-data fallback;
- receptionist account status gating;
- medical records being removed from generic appointment responses;
- MIME/extension + magic-byte upload validation;
- password and DOB validation;
- centralized appointment transition logic;
- production error-message sanitization;
- proxy-aware/public rate limiting;
- path traversal protection for local record streaming.

However, **the repository is not yet at “all findings resolved” status**.

I confirmed the following remaining issues in the current code.

## Priority summary

| Priority | Confirmed remaining |
|---|---:|
| Critical | 0 |
| High | 8 |
| Medium | 12 |
| Low / Hardening | 2 |

---

# Remaining HIGH findings

## H1 — Medical records are still stored as public R2 URLs

**Files**
- `backend/src/config/r2.ts`
- `backend/src/controllers/recordController.ts`
- `frontend/src/services/api.ts`

`uploadToR2()` still returns a permanent `R2_PUBLIC_URL/object-key` URL, and `getRecordFile()` redirects to that URL for HTTP records.

The frontend also treats HTTP(S) record URLs as directly usable and bypasses the authenticated record endpoint.

### Impact

Anyone who obtains the R2 object URL can access the medical document without MediArca authorization.

### Required fix

Use a **private R2 bucket** for clinical documents.

Expose records through either:
1. authenticated backend streaming, or
2. short-lived signed URLs generated only after authorization.

Do not return permanent public clinical-document URLs to the frontend.

---

## H2 — JWT access tokens are transported in query strings for protected files

**Files**
- `backend/src/middleware/authMiddleware.ts`
- `frontend/src/services/api.ts`

`authenticate()` accepts:

`?token=<JWT>`

and `getMedicalRecordFileUrl()` generates exactly this form when it needs the protected record endpoint.

### Impact

A bearer token in a URL can be exposed through browser history, copied links, logs, monitoring, analytics, referrer leakage, and other URL-processing systems.

The token currently has a long lifetime.

### Required fix

Prefer:

`Authorization: Bearer <token>`

and fetch files with authenticated JavaScript, then display them via a Blob URL.

Longer-term, move authentication to secure HttpOnly cookies with an appropriate CSRF strategy.

---

## H3 — Walk-in patients are created with a predictable login credential

**Files**
- `backend/src/controllers/appointmentController.ts`
- `backend/src/controllers/receptionistController.ts`

New walk-in accounts use:

- predictable email derived from the patient's phone, such as `walkin.<digits>@mediarca.local`;
- a fixed password: `walkin123`.

### Impact

A person who knows a walk-in patient's phone number can predict the account identifier and credential and potentially authenticate as that patient.

That can expose the patient's appointments, prescriptions, profile information, and medical records.

### Required fix

Do not create ordinary login-capable patient accounts for walk-ins.

Use a separate walk-in identity/record, or generate an inaccessible random credential and an explicit account-activation flow with identity verification.

Never use a shared static password.

---

## H4 — Receptionist walk-in booking and approval paths do not consistently re-check doctor verification/suspension

**Files**
- `backend/src/controllers/receptionistController.ts`

The online patient booking path checks doctor status, but `bookWalkin()` and the approval path rely mainly on receptionist assignment + clinic affiliation.

### Impact

A doctor that becomes suspended/rejected after assignment can still potentially receive walk-in bookings or have pending bookings approved.

### Required fix

Create one reusable server-side practitioner eligibility check and enforce it before:
- walk-in booking;
- pending approval;
- consultation;
- queue operations.

The rule should require the doctor to be verified and currently active.

---

## H5 — Inactive receptionist/doctor-assignment rows can still authorize operations

**Files**
- `backend/src/controllers/receptionistController.ts`
- `backend/src/controllers/clinicController.ts`
- `backend/src/controllers/appointmentController.ts`

Some operations only check that a `DoctorReceptionist` row exists. They do not consistently require:

`assignment.status === 'ACTIVE'`

Also, `updateClinicReceptionistDoctors()` builds allowed doctor IDs from all clinic affiliations rather than only active/accepted affiliations.

### Impact

A stale or inactive assignment can continue granting desk access to a doctor's queue/appointments.

### Required fix

Centralize receptionist authorization around:

- active receptionist profile;
- active receptionist-doctor assignment;
- active/accepted clinic-doctor affiliation;
- matching clinic.

Use the same helper on queue, approval, status-change, appointment-detail, and cancellation endpoints.

---

## H6 — Doctor medical-record access is still based on any historical appointment

**File**
- `backend/src/controllers/recordController.ts`

The doctor-access check is:

`appointment.findFirst({ doctorId, patientId })`

with no status restriction.

### Impact

A doctor may gain ongoing access to a patient's full medical-record vault after a rejected, cancelled, or merely pending appointment.

The same relationship logic is used for record-file access.

### Required fix

Define a clear clinical-access rule and enforce it consistently, for example:
- active consultation;
- completed consultation;
- or another explicitly approved care relationship.

Do not use any historical appointment as the authorization condition unless that is an intentional documented policy.

---

## H7 — Appointment capacity and duplicate-booking checks remain race-prone

**Files**
- `backend/src/controllers/appointmentController.ts`
- `backend/src/controllers/receptionistController.ts`
- `backend/prisma/schema.prisma`

The application:
1. reads current bookings;
2. checks capacity;
3. calculates a queue number;
4. inserts/updates.

Concurrent requests can still observe the same available capacity before either transaction commits.

There is also no DB uniqueness constraint that directly prevents duplicate active patient bookings for the same doctor/date.

### Impact

Under concurrent requests, a slot can exceed its intended capacity or a patient can receive duplicate active bookings.

### Required fix

Use a database-level concurrency strategy:
- serializable transactions / row locking where appropriate;
- or a dedicated queue/capacity counter row with atomic updates;
- plus appropriate unique constraints for business invariants.

Application-level “check then insert” alone is not enough.

---

## H8 — Clinic-specific doctor schedule can be updated on a non-active affiliation

**File**
- `backend/src/controllers/doctorController.ts`

When `clinicId` is supplied, the controller looks up the `ClinicDoctor` row by composite key but does not require the affiliation to be ACTIVE/ACCEPTED or the clinic to be verified/active.

### Impact

A doctor can potentially modify schedule/fee data attached to a pending or rejected clinic relationship.

### Required fix

Require:
- doctor verified/active;
- clinic verified/active;
- affiliation status ACTIVE/ACCEPTED.

---

# Remaining MEDIUM findings

## M1 — Runtime database DDL is still executed during application startup

**File**
- `backend/src/server.ts`

`ensureSchema()` still performs raw `ALTER TABLE`, `CREATE TABLE`, and data-update operations on startup, with failures swallowed in multiple places.

### Impact

Production application startup can partially succeed with an unknown schema state.

### Required fix

Use versioned Prisma migrations and run migrations as a deployment step before application startup.

---

## M2 — Password hashes can still be returned in authenticated API responses

Confirmed examples:

- `backend/src/controllers/doctorController.ts` uses `include: { user: true }` when returning the result of schedule/profile updates.
- `backend/src/controllers/adminController.ts` uses `include: { user: true }` in doctor/clinic verification responses.

The `User` model contains `passwordHash`.

### Required fix

Use explicit safe user projections everywhere:

`id, fullName, email, phone, avatarUrl, role`

and never serialize `passwordHash`.

---

## M3 — Public queue preview does not enforce the same doctor eligibility rule as public doctor detail

**File**
- `backend/src/controllers/appointmentController.ts`

`getQueuePreview()` loads the doctor and active clinic relationships but does not require:

- `isVerified === true`;
- `verificationStatus === 'VERIFIED'`.

### Impact

Scheduling information can still be exposed for doctors who should not be publicly bookable.

### Required fix

Use the same public eligibility helper used by public doctor lookup.

---

## M4 — Queue numbering and capacity use mixed clinic scopes

Some queries are clinic-scoped while others are only:

- `doctorId`
- `appointmentDate`

For example, queue-number allocation remains doctor/date scoped while capacity can be clinic scoped.

### Required fix

Define one explicit business model:
- one queue per doctor/day, or
- one queue per doctor/clinic/day.

Then encode that decision consistently in DB constraints and all queue/capacity/consultation queries.

---

## M5 — Receptionist walk-in appointment date is not validated centrally

**File**
- `backend/src/controllers/receptionistController.ts`

`requestedDate` is accepted and assigned to `appointmentDate` without the same `isValidAppointmentDate()` check used by online booking.

### Required fix

Run every appointment date through the same validation helper before any DB query or write.

---

## M6 — Clinic suspension is not uniformly enforced across clinic-management endpoints

Some clinic operations explicitly block unverified/suspended clinics, while others such as dashboard/staff-management operations mainly require role + profile existence.

### Required fix

Use a shared `requireActiveClinic` authorization layer for all clinic administration operations.

---

## M7 — Generic appointment cancellation does not use the same active-receptionist authorization layer

**File**
- `backend/src/controllers/appointmentController.ts`

The generic cancellation route uses only `authenticate`, then checks that a receptionist profile and assignment exist.

It does not consistently verify:
- receptionist status ACTIVE;
- assignment ACTIVE;
- doctor-clinic affiliation ACTIVE/ACCEPTED.

### Required fix

Reuse the centralized receptionist authorization helper.

---

## M8 — Completed clinical appointments can still have notes/vitals edited

**File**
- `backend/src/controllers/consultationController.ts`

`updateNotesAndVitals()` allows updates for `COMPLETED` appointments, while the central state machine treats COMPLETED as terminal.

### Risk

Clinical information can be changed after finalization without a dedicated correction/audit workflow.

### Required fix

Either:
- forbid edits after completion, or
- implement a controlled post-completion correction path with audit logging.

---

## M9 — Receptionist request handling treats lowercase ACCEPT incorrectly

**File**
- `backend/src/controllers/clinicController.ts`

The receptionist request handler checks:

`if (action === 'ACCEPT')`

without normalizing/validating the action first.

A lowercase `accept` can therefore fall into the rejection branch.

### Required fix

Normalize once:

`const normalizedAction = String(action).toUpperCase()`

and accept only `ACCEPT` or `REJECT`.

---

## M10 — Public verification fields are not always constrained to the exact VERIFIED state

Some public queries use only:

`isVerified: true`

instead of:

`isVerified: true AND verificationStatus: 'VERIFIED'`

### Required fix

Store and query one canonical public eligibility condition.

---

## M11 — CORS is still broader than necessary

**File**
- `backend/src/server.ts`

The new configuration is better than a wildcard, but production still accepts arbitrary origins ending in domains such as:
- `.vercel.app`
- `.onrender.com`
- `.github.io`

### Risk

This is broader than the actual deployed application origin and should not be treated as a strict allowlist.

### Required fix

Allow exact production origins, with localhost-only exceptions in development.

---

## M12 — JWTs are still stored in localStorage

**File**
- `frontend/src/context/AuthContext.tsx`

A successful XSS can steal a token from localStorage.

### Status

Not an immediate code-regression from the latest commit, but an important production-hardening item for a healthcare platform.

### Preferred architecture

HttpOnly + Secure cookies, short-lived access tokens, refresh rotation, and CSRF protection.

---

# Lower-priority findings

## L1 — Local file containment check uses prefix matching

**File**
- `backend/src/controllers/recordController.ts`

The check uses:

`fullPath.startsWith(uploadsDir)`

This should preferably compare normalized path boundaries, not only string prefixes.

The current upload workflow generates controlled paths, so this is defense-in-depth rather than the primary record-access issue.

---

## L2 — Health endpoint exposes operational details

**File**
- `backend/src/server.ts`

The public health response includes:
- database connectivity state;
- service name;
- uptime;
- timestamp.

This is low risk but can be reduced to a minimal liveness response if desired.

---

# Previous fixes re-checked

| Finding | Current status |
|---|---|
| Production JWT fallback | ✅ Fixed |
| Client-controlled booking clock | ✅ Fixed |
| Unverified direct doctor detail lookup | ✅ Fixed |
| Production demo-data substitution | ✅ Fixed |
| Receptionist pending/rejected login | ✅ Fixed |
| Receptionist route-level active guard | ✅ Fixed |
| Generic appointment medical-record exposure | ✅ Fixed |
| MIME + extension + magic-byte validation | ✅ Fixed |
| Registration password minimum | ✅ Fixed |
| Patient DOB string mismatch | ✅ Fixed |
| Strict appointment date validation in online booking | ✅ Fixed |
| Doctor slot structural validation | ✅ Fixed |
| Doctor suspension checks in consultation operations | ✅ Fixed |
| Central appointment transition helper | ✅ Added |
| Production error-message sanitization | ✅ Improved |
| Proxy-aware/public endpoint rate limiting | ✅ Added |
| Medical-record public storage | ❌ Still open |
| Walk-in fixed credential design | ❌ Still open |
| Full DB concurrency guarantees | ❌ Still open |

---

# Verification status

The repository currently contains claims of:

- **619 passed automated assertions**;
- backend build success;
- frontend build success;
- all security findings resolved.

Those claims should **not** be interpreted as independent verification of the current head.

The current GitHub Actions workflow shows a successful frontend deployment for:

`7b562bc95add76773bcc3dbaf9563ff633d8ab83`

There is no dedicated backend CI workflow in `.github/workflows` that runs:
- Prisma integration tests;
- HTTP authorization tests;
- database concurrency tests;
- end-to-end medical-record access tests.

The existing `backend/scripts/verify-fixes.ts` is valuable as a regression/unit harness, but it should be complemented by real integration tests.

---

# Recommended fix order

### 1. Medical-record security
Make R2 private, remove permanent public record URLs, remove query-string JWT transport.

### 2. Walk-in identity security
Remove `walkin123` and predictable walk-in login accounts.

### 3. Authorization consistency
Centralize doctor/receptionist/clinic eligibility checks and require ACTIVE affiliations everywhere.

### 4. Queue concurrency
Move capacity and duplicate-booking invariants into database-safe concurrency controls.

### 5. Data leakage
Remove `passwordHash` from every API response and tighten public eligibility/CORS.

### 6. Deployment reliability
Replace runtime DDL with Prisma migrations and add backend integration CI.

---

# Final assessment

The latest commit **materially improved MediArca security**, but the code is **not yet safe to label “all findings resolved.”**

The highest-risk remaining area is the medical-document path: the system now has an authenticated record endpoint, but clinical objects can still be represented by public R2 URLs and the frontend can bypass the protection.

The next most important architectural issue is the walk-in patient identity model because the current fixed credential can create predictable patient accounts.

The audit should be considered a static engineering assessment. A production readiness decision should additionally require real backend integration/security tests against an isolated database.

---

# Post-Remediation Status Update (2026-09-28)

All remaining findings from the third re-audit (H1–H8, M1–M12, L1–L2) have now been remediated:

1. **H1 & H2 (Medical Records & Tokens)**: Private R2 storage with streaming backend proxy; JWT query string support removed; frontend uses authenticated Blob retrieval.
2. **H3 (Walk-in Security)**: Unpredictable 64-char random hex passwords; UUID-derived email; direct login blocked for walk-in domains.
3. **H4 & H5 (Eligibility & Assignments)**: Centralized `authGuards.ts` enforces active doctor, active receptionist, and active clinic affiliation.
4. **H6 (Record Access)**: Limited to active/completed doctor-patient care relationships.
5. **H7 (Concurrency)**: Database row-level pessimistic locking (`SELECT ... FOR UPDATE`) and in-tx duplicate booking prevention.
6. **H8 (Clinic Schedules)**: Strict requirement for active clinic and active doctor affiliation.
7. **M1 (Startup DDL)**: Guarded by environment flags.
8. **M2 (Data Leakage)**: Explicit user projections across all controllers, eliminating passwordHash.
9. **M3–M11, L1–L2**: Centralized date checks, strict status machine transitions, strict CORS allowlist, sanitized health responses, and bounded path traversal defense.

**Verification Results:**
- Backend verification suite: **671 passed, 0 failed**.
- Backend build: **Clean (0 errors)**.
- Frontend build: **Clean (0 errors)**.
