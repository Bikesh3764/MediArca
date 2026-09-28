# MediArca — Fourth Bug & Security Re-Audit

**Repository:** `Bikesh3764/MediArca`  
**Branch audited:** `main`  
**Current audited commit:** `5bbab6052d63ea11cfeba948a9133d38f4ecf3eb`  
**Previous remediation commit:** `b34dd79306a611d3b1c0744744149a3438d83fb2`  
**Audit date:** 2026-09-28  
**Method:** Static re-audit of the current source tree after the latest remediation commits, with targeted review of authentication, authorization, medical-record storage/access, queue concurrency, clinic/receptionist lifecycle, API error handling, accounting logic, and frontend session behavior.

> **Important:** This is a source-code audit, not proof that every runtime defect has been found. The repository claims 723 passing assertions across 140 test suites, but those tests were not independently executed against the current head in this audit. The existing verification harness is primarily simulation/unit oriented rather than full Express + Prisma integration testing.

---

# Executive result

The latest remediation commits successfully addressed nearly all of the previous audit's major findings, including:

- private `r2://` storage for newly uploaded clinical documents;
- removal of query-string JWT transport;
- random inaccessible walk-in credentials;
- centralized doctor/receptionist/clinic authorization guards;
- active affiliation/status checks;
- strict doctor eligibility on booking/queue paths;
- strict appointment-date validation;
- exact public doctor verification state;
- completed-consultation note protection;
- strict CORS allowlisting;
- health-response minimization;
- safer R2 streaming;
- improved multi-clinic scoping.

However, **the repository should not yet be marked “all findings resolved.”**

## Current priority picture

| Priority | Confirmed / material remaining |
|---|---:|
| Critical | 0 |
| High / High-impact | 2 |
| Medium | 8 |
| Functional / Hardening | 4 |

Some items below are configuration-dependent or policy-dependent; those are explicitly identified rather than overstated.

---

# Remaining HIGH / HIGH-IMPACT findings

## H1 — Clinical-document privacy still depends on R2 bucket configuration and legacy data cleanup

**Files**
- `backend/src/config/r2.ts`
- `backend/src/controllers/recordController.ts`
- `frontend/src/services/api.ts`

New uploads now use `r2://records/...` and are streamed through the authenticated backend endpoint. That is a major improvement.

However:

- `R2_PUBLIC_URL` still points to a public `r2.dev` domain;
- the frontend's generic `getFileUrl()` still converts `r2://...` into the public CDN URL;
- legacy medical records created before the private-storage migration may still contain public HTTP/R2 URLs;
- the source code does not prove that the R2 bucket itself is configured so that `records/*` is inaccessible anonymously.

### Required remediation

Use a genuinely private clinical-document bucket/prefix with no public anonymous access.

Keep public R2 access limited to avatars/public assets, ideally in a different bucket.

Migrate or invalidate legacy public clinical-document URLs and verify anonymous access is denied.

---

## H2 — Receptionist password-change leaves the old JWT with `mustChangePassword=true`

**Files**
- `frontend/src/pages/Receptionist/ReceptionistAuth.tsx`
- `backend/src/middleware/authMiddleware.ts`
- `backend/src/controllers/receptionistController.ts`

The receptionist first logs in and receives a JWT containing:

`mustChangePassword: true`

After changing the password, the backend updates the database to:

`mustChangePassword: false`

but the password-change response does not issue a new JWT, and the frontend does not replace the existing token.

Clinical receptionist operations check both:
- the current database flag; and
- `req.user.mustChangePassword` from the old JWT.

Therefore the same session can remain blocked from desk operations even though the password has successfully been changed.

### Impact

This is a real session-state regression.

### Required remediation

After successful password change:

1. issue a fresh JWT with `mustChangePassword: false`, or
2. force logout and require a new login.

The frontend and backend should use one authoritative session state.

---

# Remaining MEDIUM findings

## M1 — Production booking errors still expose `error.message`

**File**
- `backend/src/controllers/appointmentController.ts`

The booking catch block still returns:

`message: error.message`

Other production controller responses have been sanitized.

### Impact

Internal sentinel/database error messages can reach the client. For example, duplicate-booking logic intentionally throws a message beginning with `DUPLICATE_ACTIVE_BOOKING:`.

### Remediation

Return stable user-facing messages/status codes and log the internal error server-side.

Map expected business errors to 400/409 rather than generic 500.

---

## M2 — Suspended clinics can still call `GET /my-clinic`

**Files**
- `backend/src/routes/clinicRoutes.ts`
- `backend/src/controllers/clinicController.ts`

Most clinic-management routes now use `requireActiveClinic`, but:

`GET /clinics/my-clinic`

is mounted before that middleware.

`getMyClinic()` returns clinic information plus appointment/patient contact data.

### Impact

If suspension is intended to immediately disable clinic portal access, a suspended clinic can still read sensitive operational data.

### Remediation

Apply `requireActiveClinic` to `/my-clinic`, or explicitly document that suspension permits read-only access.

---

## M3 — Doctor affiliation portal is not gated by active doctor status

**File**
- `backend/src/controllers/doctorController.ts`

`getDoctorAffiliations()` checks only the DOCTOR role.

It does not enforce `isDoctorEligibleForClinicalPractice()`.

### Impact

A suspended/rejected doctor can still access their affiliation/receptionist information.

### Remediation

Decide whether suspended doctors retain read-only profile/affiliation access. If not, use the canonical doctor eligibility guard.

---

## M4 — Runtime DDL still exists as an optional application-startup path

**File**
- `backend/src/server.ts`

`ensureSchema()` still contains raw:
- `ALTER TABLE`
- `CREATE TABLE`
- `UPDATE`

The latest code disables it by default in production unless `AUTO_SCHEMA_SYNC=true`.

### Status

Not an active default-production vulnerability on the intended Render configuration, but still a deployment reliability/architecture risk.

### Remediation

Remove runtime schema mutation completely and use versioned Prisma migrations before app startup.

---

## M5 — Concurrency lock failure is silently swallowed

**Files**
- `backend/src/controllers/appointmentController.ts`
- `backend/src/controllers/receptionistController.ts`

The row-lock statement:

`SELECT id FROM "DoctorProfile" ... FOR UPDATE`

is wrapped in an empty `catch {}`.

### Impact

If the lock operation fails, the transaction continues without the concurrency guarantee the code relies upon.

### Remediation

Do not silently ignore the locking failure. Abort/retry the transaction when the lock cannot be acquired.

---

## M6 — Queue-number scope remains a deliberate design decision that should be enforced consistently

**Files**
- `backend/src/controllers/appointmentController.ts`
- `backend/src/controllers/receptionistController.ts`
- `backend/prisma/schema.prisma`

The DB uniqueness rule is:

`@@unique([doctorId, appointmentDate, queueNumber])`

so queue numbers are globally unique per doctor/day.

Capacity checks, however, are clinic-scoped.

### Status

This is not necessarily wrong. It becomes a bug only if the intended product behavior is a separate queue per clinic.

### Remediation

Explicitly choose and document one of:

- one global queue per doctor/day; or
- one queue per doctor/clinic/day.

Then keep preview, capacity, numbering, consultation reset, and UI reporting consistent with that rule.

---

## M7 — Doctor registration does not use the same strong validation as later schedule updates

**File**
- `backend/src/controllers/authController.ts`

During doctor registration, fields such as:
- `experienceYears`
- `consultationFee`
- `checkingStartTime`
- `checkingEndTime`
- `avgConsultationMinutes`

are accepted with weaker normalization than `updateSchedule()`.

Examples include direct copies of checking times and permissive numeric coercion.

### Remediation

Use the same centralized validation functions for initial doctor creation and later updates.

---

## M8 — Slot validator does not reject non-finite numeric values

**File**
- `backend/src/utils/scheduleUtils.ts`

Checks use `isNaN(...)`, which does not reject values such as `Infinity`.

Although JSON request bodies normally cannot contain a literal JavaScript Infinity, defensive validation should still require finite numbers before persisting schedule data.

### Remediation

Use `Number.isFinite()` and explicit bounds for:
- maxPatients;
- avgConsultationMinutes;
- consultationFee;
- experience.

---

# FUNCTIONAL / ACCOUNTING BUGS

## F1 — Clinic dashboard revenue is currently overstated

**File**
- `backend/src/controllers/clinicController.ts`

Current logic effectively treats every non-cancelled appointment as revenue:

`revenue = nonCancelledAppointments × fee`

That includes statuses such as:
- `PENDING_APPROVAL`
- potentially `REJECTED`

which should not count as collected revenue.

### Correct business basis

Revenue should normally be based on actual paid/completed transactions, depending on the future payment model.

---

## F2 — Doctor affiliation dashboard revenue uses the same flawed calculation

**File**
- `backend/src/controllers/doctorController.ts`

The doctor dashboard similarly calculates revenue from all non-cancelled appointments rather than actual paid/settled consultations.

This can disagree with real payment state.

---

## F3 — Booking business errors are returned as HTTP 500

**File**
- `backend/src/controllers/appointmentController.ts`

Expected business outcomes such as:
- duplicate booking;
- slot full;
- slot already ended;

are thrown as errors and fall into the generic 500 handler.

### Impact

A normal user/business conflict appears as a server failure.

### Remediation

Use explicit typed business errors:
- 400 for invalid booking request;
- 409 for duplicate/conflicting booking;
- appropriate status for closed/full slots.

---

## F4 — Receptionist password-change UI still says “minimum 6 characters”

**File**
- `frontend/src/pages/Receptionist/ReceptionistAuth.tsx`

The backend requires 8 characters, while the frontend validation/help text still uses 6.

### Impact

A 6–7 character password can pass the frontend and then fail on the server.

### Remediation

Synchronize frontend and backend validation to the same password policy.

---

# Re-checked findings that are now FIXED

| Previous finding | Current status |
|---|---|
| Public R2 URL generation for new clinical uploads | ✅ Reworked to private `r2://` storage |
| Query-string JWT transport | ✅ Removed |
| Predictable walk-in password | ✅ Replaced with random high-entropy credential |
| Walk-in direct login | ✅ Blocked |
| Receptionist inactive assignment access | ✅ Centralized active assignment guard |
| Doctor suspended booking | ✅ Canonical doctor eligibility guard |
| Receptionist doctor/status operations | ✅ Centralized authorization guard |
| Doctor direct-ID verification bypass | ✅ Exact public eligibility check |
| Production demo fallback | ✅ DEV-only |
| Appointment medical-record exposure to staff | ✅ Removed for generic staff responses |
| Doctor medical-record relationship | ✅ Active/completed relationship requirement |
| Completed clinical note edits | ✅ Blocked |
| Lowercase ACCEPT bug | ✅ Fixed |
| Public verification inconsistency in main doctor/clinic listings | ✅ Exact VERIFIED checks added |
| CORS wildcard/suffix matching | ✅ Replaced by explicit production allowlist |
| Health endpoint detail leakage | ✅ Minimized |
| Magic-byte file validation | ✅ Added |
| DOB type mismatch | ✅ Fixed |
| Appointment-date validation | ✅ Centralized |
| Slot structure validation | ✅ Added |
| Path traversal | ✅ Strengthened |
| Password hash serialization in reviewed responses | ✅ Safe projections used |
| Multi-clinic receptionist authorization | ✅ Centralized facility/affiliation checks |
| Doctor/clinic schedule-affiliation validation | ✅ Fixed |

---

# Testing / CI status

The repository currently reports:

- **723 passed assertions**
- **0 failed**
- **140 test suites**
- backend TypeScript/Prisma build success
- frontend build success

Those numbers were **not independently reproduced in this audit environment**.

The verification script remains primarily simulation/unit-oriented. The repository still does not contain a dedicated backend CI workflow that proves:

- real HTTP authorization;
- real Prisma ownership queries;
- real R2 access behavior;
- concurrent appointment creation against PostgreSQL;
- session/token behavior after receptionist password changes.

The latest GitHub Actions frontend deployment for commit `5bbab605...` succeeded, and the scheduled keep-alive run also succeeded.

---

# Final assessment

The current codebase is substantially more secure than the previous audit versions.

**The previous 22 residual findings are largely closed.**

The main remaining issues are now:

1. **R2 bucket-level privacy / legacy record cleanup**
2. **stale receptionist JWT after password change**
3. production booking error leakage
4. suspended-clinic read access policy
5. optional runtime DDL architecture
6. concurrency-lock fail-open behavior
7. revenue/accounting calculation errors
8. booking business errors incorrectly returned as 500
9. a few validation-consistency issues

The repository should therefore be treated as **“major audit findings remediated, but final hardening and integration verification still required,”** rather than “all bugs resolved.”
