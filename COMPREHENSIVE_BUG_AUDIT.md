# Comprehensive Bug, Architecture & Security Audit: MediArca Platform
**Generated:** September 29, 2026  
**Platform Version:** MediArca 1.0 (Clinical Healthcare Queue & Teleconsultation OS)  
**Target Environment:** Fullstack (Frontend: React 19 + TypeScript + Vite; Backend: Node.js Express + TypeScript + Prisma ORM; Database: PostgreSQL on Supabase; Deployment: GitHub Pages HashRouter + Render Web Service)  
**Audit Objective:** Comprehensive, zero-modification technical investigation and inventory of all bugs, logical anomalies, runtime vulnerabilities, data inconsistencies, concurrency edge-cases, and UI/UX defects across all portals and system layers.

---

## 1. Executive Summary

A comprehensive fullstack audit of the MediArca clinical platform was conducted across all six system layers (Patient Portal, Doctor Portal, Clinic Portal, Receptionist Portal, Admin Portal, Backend API & Database). While core TypeScript compilation (`tsc` on backend, `vite build` on frontend) succeeds cleanly without syntax errors, the system suffers from severe runtime regressions, session lockouts, broken physical workflows, concurrency vulnerabilities, and orphaned database models.

This expanded audit rigorously tested and challenged prior investigations, correcting invalid findings (such as phantom prescription UI claims), uncovering critical runtime crashes in receptionist walk-ins and QR check-ins, resolving database connection exhaustion risks from client polling, and identifying severe Catch-22 logic in provider discovery.

### Key Metrics Summary
- **Total Deficiencies Identified:** 32 distinct bugs & architectural gaps
- **Critical Severity (Blocker / Data Loss / Session Lockout / Runtime Crash):** 6 issues
- **High Severity (Major Functional Breakdown / Exploitable Security Risk / Connection Starvation):** 9 issues
- **Medium Severity (Accounting Flaws / Timezone Inaccuracies / Memory Leaks / Data Desync):** 11 issues
- **Low / UI/UX Severity (Display Inaccuracies / HIG Violations / React 19 Warnings):** 6 issues

---

## 2. Severity Classification Matrix

| Bug ID | Title | Severity | Component / Layer | Primary Impact |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | Prescribed Medicines Discarded by Backend & Severed in Frontend UI | **CRITICAL** | Backend & Frontend (`consultationController.ts`, `ConsultationView.tsx`) | Clinical Data Loss; Patient never receives prescribed medications |
| **BUG-02** | Permanent Receptionist Desk Lockout After Mandatory Password Change | **CRITICAL** | Fullstack (`api.ts`, `ReceptionistAuth.tsx`, `ReceptionistDashboard.tsx`) | Complete failure of receptionist desk operations; permanent HTTP 403 |
| **BUG-03** | Physical QR Arrival Check-In Broken: Compounding Null Code & Response Unpack Bugs | **CRITICAL** | Fullstack (`ClinicCheckIn.tsx`, `authController.ts`, `seed.ts`) | Total failure of clinic arrival check-in flow platform-wide |
| **BUG-04** | Independent Doctors Invisibility & Clinic Affiliation Discovery Catch-22 | **CRITICAL** | Backend & Frontend (`doctorController.ts`, `ClinicDashboard.tsx`) | Doctor accounts without external clinic affiliations cannot be discovered or onboarded |
| **BUG-05** | Pessimistic Concurrency Lock Swallowing Causes PostgreSQL Transaction Abort | **CRITICAL** | Backend (`receptionistController.ts`) | Race conditions; queue collisions and PostgreSQL transaction abort errors |
| **BUG-06** | Receptionist Walk-In Booking UI Crash (`res.data.queueNumber` on Unwrapped Response) | **CRITICAL** | Frontend (`ReceptionistDashboard.tsx`) | Runtime TypeError; token pass modal never renders; form fails to reset |
| **BUG-07** | Complete Deletion of Medical Vault & Historical Prescriptions (`21f695c` Regression) | **HIGH** | Fullstack (`schema.prisma`, `App.tsx`, `documentOptimizer.ts`) | Feature regression; dead code references; vault routes redirected to appointments |
| **BUG-08** | Orphaned Review Model with Zero Runtime Creation/Query Endpoints | **HIGH** | Fullstack (`schema.prisma`, `appointmentController.ts`, `LiveQueueTicket.tsx`) | Feature abandoned; patient reviews cannot be created or updated; rating is static |
| **BUG-09** | Suspended Clinic Receptionists Retain Full Desk Access & Queue Powers | **HIGH** | Backend (`authMiddleware.ts`) | Security violation; deactivated/suspended clinics can still book and approve visits |
| **BUG-10** | Memory Leak in Long-Running Node Process via Unbounded Rate Limiting Cache | **HIGH** | Backend (`server.ts`) | Eventual Node.js process Out-Of-Memory (OOM) crash on Render web service |
| **BUG-11** | Inability for Doctors Without Clinics to Configure Shifts or Consultation Fees | **HIGH** | Frontend (`ManageSchedule.tsx`) | Doctors without clinic affiliations are completely locked out of schedule management |
| **BUG-12** | Walk-In Patient History Orphaned Upon Portal Account Registration | **HIGH** | Backend (`authController.ts`, `appointmentController.ts`) | Patients cannot view past walk-in passes or consultations after registering |
| **BUG-13** | Orphaned `Notification` Model with Zero Endpoints and Zero Frontend UI | **HIGH** | Backend & Database (`schema.prisma`, `backend/src/routes`) | Dead schema model; clinical notifications never stored or delivered |
| **BUG-14** | N+1 Polling Query Explosion in `getPatientAppointments` Causing Supabase Connection Pool Exhaustion | **HIGH** | Backend & Frontend (`appointmentController.ts`, `MyAppointments.tsx`) | Database connection exhaustion under normal patient polling |
| **BUG-15** | Receptionist Doctor Assignment Crash Due to Unwrapped Response in Clinic Portal | **HIGH** | Fullstack (`clinicController.ts`, `ClinicDashboard.tsx`) | Runtime TypeError on updating receptionist doctor assignments |
| **BUG-16** | Overstated Clinic and Doctor Revenue Accounting on Cancelled/Rejected Visits | **MEDIUM** | Backend (`clinicController.ts`, `doctorController.ts`) | Financial reporting distortion; cancelled appointments counted as earned revenue |
| **BUG-17** | Phone Number Normalization Mismatch with Seeded Database Records | **MEDIUM** | Backend (`receptionistController.ts`, `phoneUtils.ts`, `seed.ts`) | Duplicate synthetic walk-in accounts created for existing patients |
| **BUG-18** | Base64 Avatar Text Bloat Stored Directly in PostgreSQL Column | **MEDIUM** | Backend (`authController.ts`, `uploadMiddleware.ts`) | Database bloat; high memory consumption during user serialization |
| **BUG-19** | Clinic Name Search Broken in Patient Doctor Discovery Directory | **MEDIUM** | Backend (`doctorController.ts`) | Search query omits clinic table relations; clinic search returns empty |
| **BUG-20** | Unhandled Negative/Zero Queue Numbers in Doctor Queue Queries | **MEDIUM** | Backend (`consultationController.ts`) | Pending appointments with queueNumber <= 0 can surface into active queue |
| **BUG-21** | Inconsistent Admin Portal Redirection Leading to Generic User Login | **MEDIUM** | Frontend (`AdminDashboard.tsx`, `App.tsx`) | Admin users bounced to patient/doctor login lacking secret key fields |
| **BUG-22** | Patient Medical Vitals, Allergies & Medications Omitted from Doctor View | **MEDIUM** | Frontend (`ConsultationView.tsx`, `PatientProfile.tsx`) | Clinical risk; doctor cannot review known allergies or active medications |
| **BUG-23** | 5.5-Hour UTC vs. IST Timezone Boundary Anomaly in Appointment "Today" Calculation | **MEDIUM** | Backend (`appointmentController.ts`) | Appointments from yesterday treated as "today" between 00:00 UTC and 05:30 IST |
| **BUG-24** | Avatar Upload 404 URL Discrepancy Between Route Serving and Generator | **MEDIUM** | Backend (`authController.ts`, `server.ts`) | Non-R2 avatars saved to `/uploads/...` 404 immediately |
| **BUG-25** | Receptionist Dashboard UI Exposes Non-Permitted "Completed" Status Action | **MEDIUM** | Fullstack (`ReceptionistDashboard.tsx`, `appointmentStateMachine.ts`) | Receptionist clicking "Completed" always triggers HTTP 400 alert popup |
| **BUG-26** | Receptionist Desk Arrival Toggle Fails to Update UI Due to False Falsy Guard | **MEDIUM** | Fullstack (`ReceptionistDashboard.tsx`, `api.ts`) | Checkbox stays unchanged after receptionist clicks arrival toggle |
| **BUG-27** | Patient Age Calculation Inaccuracy (Calendar Year Difference vs DOB) | **LOW** | Frontend (`ConsultationView.tsx`) | Incorrect age displayed if birthday has not occurred in current calendar year |
| **BUG-28** | Completed Consultations Lack Diagnosis & Clinical Notes in Patient Pass | **LOW** | Frontend (`LiveQueueTicket.tsx`) | Patients cannot review doctor's diagnosis, notes, or advice on completed passes |
| **BUG-29** | 17 React 19 Oxlint Warnings Regarding Synchronous setState in useEffect | **LOW** | Frontend (Multiple Dashboard Pages) | Unnecessary cascading re-renders; React Compiler bails out on component optimization |
| **BUG-30** | Missing Cache-Control Headers on Static and Dynamic API Responses | **LOW** | Backend (`server.ts`) | Unpredictable client-side caching of volatile live queue status |
| **BUG-31** | Dead References to 1MB Medical Vault in `documentOptimizer.ts` and `api.ts` | **LOW** | Frontend (`documentOptimizer.ts`, `api.ts`) | Dead utility functions and dead CDN URL handling |
| **BUG-32** | Unsanitized Plaintext Doctor Notes Rendering Risk | **LOW** | Frontend (`LiveQueueTicket.tsx`, `ConsultationView.tsx`) | Missing markdown/sanitization rendering wrappers for clinical notes |

---

## 3. Deep-Dive Bug Reports: Critical Severity

### BUG-01: Prescribed Medicines Discarded by Backend & Severed in Frontend UI
- **Severity:** CRITICAL
- **Component:** Fullstack Consultation & Prescription Flow
- **Source Files:**
  - `backend/src/controllers/consultationController.ts` (Lines 282-356, 373)
  - `frontend/src/pages/Doctor/ConsultationView.tsx` (Lines 117-147)
  - `frontend/src/services/api.ts` (Lines 1264-1279)
- **Root Cause & Investigation Correction:**
  - *Prior Investigation Claim:* The prior report claimed `ConsultationView.tsx` lines 117-147 passes `medicines` and the doctor fills out medications in the UI.
  - *Code Reality:* Verification reveals that git commit `21f695c` removed the prescription UI from `ConsultationView.tsx`. The doctor currently has **no input fields** in the UI to enter medications.
  - *Backend Flaw:* Despite removing the UI, `consultationController.ts` still extracts `medicines` from `req.body`:
    ```typescript
    const { appointmentId, diagnosis, medicines, advice, followUpDate, clinicalNotes, vitals } = req.body;
    ```
    However, `medicines` is completely dropped from the Prisma update query. Only `status`, `clinicalNotes`, and `vitals` are updated. Furthermore, `export const completeWithPrescription = completeConsultation;` confirms there is no dedicated prescription persistence handler.
- **Clinical Impact:** Practitioners are unable to prescribe medications through the platform, and any external API caller attempting to pass `medicines` loses all prescription records silently.
- **Remediation:**
  Restore a clean prescription entry UI on `ConsultationView.tsx` and serialize the prescription list into `Appointment.clinicalNotes` or store it in a dedicated JSON/structured column on `Appointment`.

---

### BUG-02: Permanent Receptionist Desk Lockout After Mandatory Password Change
- **Severity:** CRITICAL
- **Component:** Fullstack Authentication & Session Management
- **Source Files:**
  - `frontend/src/services/api.ts` (Lines 891-897, 1501-1508)
  - `frontend/src/pages/Receptionist/ReceptionistAuth.tsx` (Lines 78-95)
  - `frontend/src/pages/Receptionist/ReceptionistDashboard.tsx` (Lines 235-252)
  - `backend/src/controllers/receptionistController.ts` (Lines 350-360, 828-834)
- **Root Cause:**
  When a receptionist updates their temporary password, `receptionistController.ts` issues a new JWT token containing `{ mustChangePassword: false }`:
  ```typescript
  res.json({
    success: true,
    message: 'Password updated successfully. Desk access unlocked.',
    token,
    data: safeUser,
    user: safeUser,
  });
  ```
  However, `frontend/src/services/api.ts#handleResponse` extracts and returns only `data.data`:
  ```typescript
  async function handleResponse<T>(res: Response): Promise<T> {
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'API request failed');
    }
    return data.data; // <--- Discards top-level 'token' field!
  }
  ```
  Consequently, `res.token` is `undefined` in both `ReceptionistAuth.tsx` and `ReceptionistDashboard.tsx`. The browser continues to send the old JWT token with `mustChangePassword: true` in `Authorization: Bearer ...`.
  In `receptionistController.ts`:
  ```typescript
  if (userRec?.mustChangePassword || req.user.mustChangePassword) {
    res.status(403).json({
      success: false,
      message: 'Temporary password must be changed before accessing clinical desk operations.',
    });
    return;
  }
  ```
  Because `req.user.mustChangePassword` is decoded from the old JWT, all subsequent desk requests fail with HTTP 403 indefinitely.
- **Remediation:**
  Return `{ user: safeUser, token }` under `data` in `receptionistController.ts#changeReceptionistPassword`, or update `api.ts#changeReceptionistPassword` to capture `token` before unwrapping.

---

### BUG-03: Physical QR Arrival Check-In Broken: Compounding Null Code & Response Unpack Bugs
- **Severity:** CRITICAL
- **Component:** Fullstack Clinic Arrival & Verification
- **Source Files:**
  - `backend/src/controllers/authController.ts` (Lines 174-181)
  - `backend/prisma/seed.ts` (Lines 262-271, 283-292)
  - `frontend/src/pages/Clinic/ClinicDashboard.tsx` (Line 1567)
  - `frontend/src/pages/Patient/ClinicCheckIn.tsx` (Lines 50, 79)
  - `frontend/src/services/api.ts` (Lines 1186-1198)
- **Root Cause (Compounding Double Failure):**
  1. *Uninitialized `checkinCode`:* Neither `authController.ts#register` nor `seed.ts` populates `ClinicProfile.checkinCode`. It defaults to `null`. The QR poster printed in `ClinicDashboard.tsx` encodes `code=`, resulting in an empty security code.
  2. *False Failure Banner in Patient Screen:* Even if `checkinCode` is valid, `ClinicCheckIn.tsx` contains a fatal response parsing bug:
     ```typescript
     const res = await api.checkInWithQR({ clinicId, code, appointmentId });
     if (res.success && res.data) {
       setSuccessData(res.data);
     } else {
       setErrorMessage(res.message || 'Failed to check in.');
     }
     ```
     Because `api.ts#handleResponse` unwraps `data.data`, `res` is already the `Appointment` object. `res.success` is `undefined` (falsy). The condition **always** fails, causing `ClinicCheckIn.tsx` to display a red error banner (`"Failed to check in."`) even when the check-in actually succeeded on the backend!
- **Remediation:**
  1. Auto-generate `checkinCode = crypto.randomBytes(4).toString('hex').toUpperCase()` upon clinic creation.
  2. Correct `ClinicCheckIn.tsx` to inspect `if (res?.id)` rather than `res.success`.

---

### BUG-04: Independent Doctors Invisibility & Clinic Affiliation Discovery Catch-22
- **Severity:** CRITICAL
- **Component:** Backend Provider Discovery & Clinic Onboarding
- **Source Files:**
  - `backend/src/controllers/doctorController.ts` (Lines 38-47)
  - `frontend/src/pages/Clinic/ClinicDashboard.tsx` (Lines 83-90, 997-1049)
- **Root Cause:**
  In `doctorController.ts#getDoctors`, all queries enforce:
  ```typescript
  const whereClause: any = {
    isVerified: true,
    verificationStatus: 'VERIFIED',
    clinics: {
      some: {
        status: { in: ['ACTIVE', 'ACCEPTED'] },
        clinic: { isVerified: true, verificationStatus: 'VERIFIED' },
      },
    },
  };
  ```
  This creates a total Catch-22:
  1. When a doctor registers independently and is verified by Admin, they have zero clinic affiliations.
  2. `ClinicDashboard.tsx#fetchAvailableDoctors` calls `api.getDoctors()` to populate the "Available Practitioners to Invite" directory.
  3. Because newly registered doctors have no affiliations, `getDoctors` excludes them.
  4. Clinics can never discover or invite new practitioners from the directory.
  5. The doctor can never obtain an affiliation, permanently locking them out of discovery.
- **Remediation:**
  Remove the mandatory clinic affiliation requirement in `getDoctors`, or add a dedicated endpoint (`GET /doctors/directory/unaffiliated`) for clinic managers to recruit verified doctors.

---

### BUG-05: Pessimistic Concurrency Lock Swallowing Causes PostgreSQL Transaction Abort
- **Severity:** CRITICAL
- **Component:** Backend Concurrency & Transaction Management
- **Source Files:**
  - `backend/src/controllers/receptionistController.ts` (Lines 1020-1022)
- **Root Cause:**
  In `receptionistController.ts#approveAppointment`:
  ```typescript
  // Pessimistic concurrency control: lock practitioner row for this approval
  try {
    await tx.$executeRaw`SELECT id FROM "DoctorProfile" WHERE id = ${appointment.doctorId} FOR UPDATE;`;
  } catch {}
  ```
  The raw query error is swallowed with an empty `catch {}`. In PostgreSQL, when an error occurs inside a transaction block (such as a lock timeout or query syntax failure), the transaction is marked as `ABORTED`.
  Swallowing the error in JavaScript does **not** reset PostgreSQL's transaction state. Subsequent operations (`tx.appointment.findFirst`, `tx.appointment.update`) immediately fail with PostgreSQL code `25P02`: `"current transaction is aborted, commands ignored until end of transaction block"`.
- **Remediation:**
  Do not swallow errors inside `$transaction`. Properly handle lock acquisition retries or propagate the concurrency failure to trigger a transaction retry.

---

### BUG-06: Receptionist Walk-In Booking UI Crash (`res.data.queueNumber` on Unwrapped Response)
- **Severity:** CRITICAL
- **Component:** Frontend Receptionist Portal
- **Source Files:**
  - `frontend/src/pages/Receptionist/ReceptionistDashboard.tsx` (Lines 282, 300, 311)
  - `frontend/src/services/api.ts` (Lines 891-897, 1471-1490)
  - `backend/src/controllers/receptionistController.ts` (Lines 646-650)
- **Root Cause:**
  In `receptionistController.ts#bookWalkin`, the backend returns:
  ```typescript
  res.status(201).json({
    success: true,
    message: `Token #${newAppointment.queueNumber} created successfully`,
    data: newAppointment,
  });
  ```
  `api.ts#handleResponse` unwraps `data.data` and returns `newAppointment` directly.
  However, in `ReceptionistDashboard.tsx`:
  ```typescript
  const res = await api.bookWalkinAppointment({ ... });
  setBookedPass({
    queueNumber: res.data.queueNumber, // <--- res.data is undefined!
    ...
  });
  setSuccessMsg(`Token #${res.data.queueNumber} assigned to ${savedPatientName}`);
  ```
  Accessing `res.data.queueNumber` throws an unhandled `TypeError: Cannot read properties of undefined (reading 'queueNumber')`.
- **Runtime Failure Sequence:**
  1. Receptionist submits a walk-in patient booking.
  2. The appointment is successfully written to PostgreSQL and token allocated.
  3. The JavaScript TypeError aborts execution and jumps to `catch (err: any)`.
  4. The screen displays an error banner: `"Cannot read properties of undefined (reading 'queueNumber')"`.
  5. The booked pass modal is never rendered.
  6. The form fields are not cleared, leading receptionist staff to believe the booking failed and attempt duplicate bookings.
- **Remediation:**
  Change `res.data.queueNumber` to `res.queueNumber` (or `res?.queueNumber || res?.data?.queueNumber`) across `ReceptionistDashboard.tsx`.

---

## 4. Deep-Dive Bug Reports: High Severity

### BUG-07: Complete Deletion of Medical Vault & Historical Prescriptions (`21f695c` Regression)
- **Severity:** HIGH
- **Component:** Fullstack Clinical Records & Vault Architecture
- **Source Files:**
  - `backend/prisma/schema.prisma`
  - `frontend/src/App.tsx` (Lines 43-45)
  - `frontend/src/services/api.ts` (Lines 11-24)
  - `frontend/src/utils/documentOptimizer.ts` (Lines 1-84)
- **Root Cause:**
  Commit `21f695c1f57e4bad0cbc65b1b43f3689ee3a399a` removed `MedicalRecord` and `Prescription` models from `schema.prisma`.
  Dead code remains throughout the frontend:
  1. `App.tsx` redirects `/patient/vault` and `/records` to `/patient/appointments`.
  2. `api.ts#getFileUrl` still contains dead rules blocking `records/` paths.
  3. `documentOptimizer.ts` contains dead canvas-based image compression code for medical documents.
- **Remediation:**
  Either restore a secure, compliant document storage model or cleanly excise all remaining dead code and navigation redirects.

---

### BUG-08: Orphaned `Review` Model with Zero Runtime Creation/Query Endpoints
- **Severity:** HIGH
- **Component:** Fullstack Reviews & Ratings
- **Source Files:**
  - `backend/prisma/schema.prisma` (Lines 114-132)
  - `frontend/src/components/queue/LiveQueueTicket.tsx` (Lines 290-330)
- **Root Cause:**
  `schema.prisma` defines a full `Review` model with `rating`, `comment`, `doctorId`, and `patientId`. However, there are zero backend routes (`POST /reviews`, `GET /reviews`) to create or list reviews.
  The ratings displayed on doctor cards (e.g. `rating: 5.0`) are hardcoded or static seed values that patients cannot modify.
- **Remediation:**
  Implement `createReview` and `getDoctorReviews` endpoints and connect them to `LiveQueueTicket.tsx` upon consultation completion.

---

### BUG-09: Suspended Clinic Receptionists Retain Full Desk Access & Queue Powers
- **Severity:** HIGH
- **Component:** Backend Authorization Middleware
- **Source Files:**
  - `backend/src/middleware/authMiddleware.ts` (Lines 108-144)
  - `backend/src/controllers/authController.ts` (Lines 235-345)
- **Root Cause:**
  `requireActiveReceptionist` only checks `receptionistProfile.status === 'ACTIVE'`. It does not join `receptionistProfile.clinic` to check if the clinic facility itself has been `SUSPENDED` or `REJECTED` by MediArca administration.
  When an admin suspends a rogue or unverified clinic, the clinic's front desk staff can continue logging in, issuing tokens, approving appointments, and seeing patient medical data.
- **Remediation:**
  In `requireActiveReceptionist` and `authController.ts#login`, join `clinic` and reject requests if `clinic.verificationStatus !== 'VERIFIED'`.

---

### BUG-10: Memory Leak in Long-Running Node Process via Unbounded Rate Limiting Cache
- **Severity:** HIGH
- **Component:** Backend Architecture & Stability
- **Source Files:**
  - `backend/src/server.ts` (Lines 421-443)
- **Root Cause:**
  `rateLimitMap` is declared as a global in-memory `Map<string, { count: number; resetTime: number }>()`.
  When a rate-limited endpoint is hit, entries are added with `rateLimitMap.set(...)`. There is no expiration job, LRU eviction, or `setInterval` to prune keys. On a production Render web service receiving continuous scans or user traffic, the map will grow unbounded until Node.js crashes with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
- **Remediation:**
  Add a periodic cleanup timer (`setInterval(() => { ... }, 60000)`) or adopt Redis/`express-rate-limit`.

---

### BUG-11: Inability for Doctors Without Clinics to Configure Shifts or Consultation Fees
- **Severity:** HIGH
- **Component:** Frontend Doctor Portal
- **Source Files:**
  - `frontend/src/pages/Doctor/ManageSchedule.tsx` (Lines 60-95)
- **Root Cause:**
  `ManageSchedule.tsx` assumes all practice slots are clinic-affiliated. If a doctor has no active clinic affiliations (`activeClinics.length === 0`), the shift configuration UI is blocked or renders an empty selector with disabled inputs. The doctor cannot configure their independent practice hours, consultation fees, or daily patient quotas.
- **Remediation:**
  Allow an "Independent Practice / Telehealth" option when `activeClinics` is empty, targeting `doctorProfile` directly.

---

### BUG-12: Walk-In Patient History Orphaned Upon Portal Account Registration
- **Severity:** HIGH
- **Component:** Backend Authentication & Patient Identity
- **Source Files:**
  - `backend/src/controllers/authController.ts` (Lines 100-145)
  - `backend/src/controllers/receptionistController.ts` (Lines 440-475)
- **Root Cause:**
  When a receptionist books a walk-in patient, a synthetic user account and `PatientProfile` are created with a random email (`walkin-<phone>@mediarca.internal`).
  When the real patient later registers on the MediArca portal using their personal email and mobile number, `authController.ts#register` creates a brand new `User` and `PatientProfile`. It never associates past appointments linked to the synthetic walk-in account. The patient's queue history, past prescriptions, and consultation logs remain orphaned.
- **Remediation:**
  During patient registration, check for existing synthetic accounts matching `phone` and reassign existing `Appointment` records to the new user.

---

### BUG-13: Orphaned `Notification` Model with Zero Endpoints and Zero Frontend UI
- **Severity:** HIGH
- **Component:** Backend Architecture & Notification Subsystem
- **Source Files:**
  - `backend/prisma/schema.prisma` (Lines 134-145)
  - `backend/src/routes/`
- **Root Cause:**
  `schema.prisma` includes a `Notification` model with `userId`, `title`, `message`, `type`, and `isRead`. However, there are no database queries in any controller that create notifications on key events (e.g. appointment approved, called into cabin, consultation completed), no Express notification routes, and no notification drawer or bell icon in the frontend.
- **Remediation:**
  Implement a central `NotificationService` that creates notifications during queue state transitions, and expose `GET /api/notifications` and `PATCH /api/notifications/:id/read`.

---

### BUG-14: N+1 Polling Query Explosion in `getPatientAppointments` Causing Supabase Connection Pool Exhaustion
- **Severity:** HIGH
- **Component:** Backend Performance & Database Stability
- **Source Files:**
  - `backend/src/controllers/appointmentController.ts` (Lines 815-848)
  - `frontend/src/pages/Patient/MyAppointments.tsx` (Polling interval)
- **Root Cause:**
  In `appointmentController.ts#getPatientAppointments`, the backend loops through every appointment in the patient's record using `Promise.all`:
  For each active appointment, it executes two separate queries:
  1. `prisma.appointment.findFirst(...)` to determine the current serving token.
  2. `prisma.appointment.count(...)` to count patients ahead in the slot.
  `MyAppointments.tsx` polls this endpoint every 15 seconds. For a patient with multiple visits, every polling tick fires 10-15 independent database queries. Multiple concurrent active patients will quickly exhaust Supabase's connection pooler limits (typically 15-20 max connections on free/micro instances), leading to connection timeouts and 500 errors across the application.
- **Remediation:**
  Batch compute queue statistics in a single aggregated SQL query (`GROUP BY doctorId, appointmentDate, slotId`) before mapping appointments.

---

### BUG-15: Receptionist Doctor Assignment Crash Due to Unwrapped Response in Clinic Portal
- **Severity:** HIGH
- **Component:** Fullstack Clinic Staffing Administration
- **Source Files:**
  - `backend/src/controllers/clinicController.ts` (Lines 906-909)
  - `frontend/src/services/api.ts` (Lines 891-897, 1399-1405)
  - `frontend/src/pages/Clinic/ClinicDashboard.tsx` (Lines 244-245)
- **Root Cause:**
  In `clinicController.ts#updateClinicReceptionistDoctors`, the backend responds with `{ success: true, message: '...' }` without a `data` field.
  `api.ts#handleResponse` returns `data.data`, which evaluates to `undefined`.
  In `ClinicDashboard.tsx`:
  ```typescript
  const res = await api.updateClinicReceptionistDoctors(editingRec.id, editDoctorIds);
  setSuccessMsg(res.message || 'Assigned doctor permissions updated successfully.');
  ```
  Accessing `res.message` throws `TypeError: Cannot read properties of undefined (reading 'message')`.
  The error jumps to `catch (err: any)`, displaying an error banner to the clinic manager even though the database assignments were saved successfully.
- **Remediation:**
  Return `data: { success: true }` in `clinicController.ts` or update `ClinicDashboard.tsx` to guard against `res?.message`.

---

## 5. Deep-Dive Bug Reports: Medium Severity

### BUG-16: Overstated Clinic and Doctor Revenue Accounting on Cancelled/Rejected Visits
- **Severity:** MEDIUM
- **Component:** Backend Financial Accounting & Analytics
- **Source Files:**
  - `backend/src/controllers/clinicController.ts` (Lines 121-127)
  - `backend/src/controllers/doctorController.ts` (Lines 440-444)
- **Root Cause:**
  Both controllers compute revenue by filtering appointments with:
  ```typescript
  const paidOrCompleted = appointments.filter(
    (a) => a.paymentStatus === 'PAID' || a.status === 'COMPLETED'
  );
  ```
  If an appointment was paid or approved by reception, but subsequently `CANCELLED` or `REJECTED`, it remains in `paidOrCompleted`. Cancelled appointments are incorrectly counted towards total clinic and doctor revenue metrics.
- **Remediation:**
  Add `&& a.status !== 'CANCELLED' && a.status !== 'REJECTED'` to the filter.

---

### BUG-17: Phone Number Normalization Mismatch with Seeded Database Records
- **Severity:** MEDIUM
- **Component:** Backend Phone Normalization
- **Source Files:**
  - `backend/prisma/seed.ts` (Lines 39, 52, 148, 236)
  - `backend/src/utils/phoneUtils.ts`
  - `backend/src/controllers/receptionistController.ts` (Lines 410-435)
- **Root Cause:**
  `seed.ts` seeds phone numbers with spaced formatting: `'+91 98765 43210'`.
  However, `formatIndianPhone` in `phoneUtils.ts` normalizes phone numbers to unspaced E.164: `'+919876543210'`.
  When a receptionist looks up an existing patient by mobile number during walk-in booking, the database query fails to find the spaced seeded record, resulting in duplicate user accounts.
- **Remediation:**
  Store normalized unspaced phone numbers (`+919876543210`) consistently across `seed.ts` and all API endpoints.

---

### BUG-18: Base64 Avatar Text Bloat Stored Directly in PostgreSQL Column
- **Severity:** MEDIUM
- **Component:** Backend Storage & User Model
- **Source Files:**
  - `backend/src/controllers/authController.ts` (Line 826)
  - `backend/prisma/schema.prisma` (Line 17)
- **Root Cause:**
  When Cloudflare R2 is unconfigured or credentials fail, `authController.ts#uploadAvatar` falls back to base64 encoding:
  `avatarUrl = 'data:' + file.mimetype + ';base64,' + file.buffer.toString('base64');`
  Storing 1MB–3MB strings directly in the `User.avatarUrl` column severely bloats PostgreSQL page cache and dramatically slows down every query that selects `User` without column masking.
- **Remediation:**
  Enforce image resizing/compression (max 64KB) before generating base64 strings, or fall back to local disk storage.

---

### BUG-19: Clinic Name Search Broken in Patient Doctor Discovery Directory
- **Severity:** MEDIUM
- **Component:** Backend Search & Discovery
- **Source Files:**
  - `backend/src/controllers/doctorController.ts` (Lines 61-68)
- **Root Cause:**
  In `doctorController.ts#getDoctors`, the search query filters across:
  `user.fullName`, `specialty`, `clinicAddress`, and `bio`.
  It completely omits `clinics.some.clinic.clinicName`. If a patient searches for doctors at "Metropolis Polyclinic", the search returns zero results unless the doctor manually typed the clinic name into their personal bio.
- **Remediation:**
  Add `{ clinics: { some: { clinic: { clinicName: { contains: search, mode: 'insensitive' } } } } }` to `whereClause.OR`.

---

### BUG-20: Unhandled Negative/Zero Queue Numbers in Doctor Queue Queries
- **Severity:** MEDIUM
- **Component:** Backend Queue Engine
- **Source Files:**
  - `backend/src/controllers/consultationController.ts` (Lines 30-70)
- **Root Cause:**
  When an appointment is initially booked online, it is assigned a placeholder queue number (such as `0` or `-1`) until approved by desk staff.
  Certain queue queries in `consultationController.ts` filter by `status: 'WAITING'` without enforcing `queueNumber: { gt: 0 }`. If an appointment's status is improperly updated without token allocation, it surfaces into the active queue with token #0.
- **Remediation:**
  Add `queueNumber: { gt: 0 }` to all active consultation queue queries.

---

### BUG-21: Inconsistent Admin Portal Redirection Leading to Generic User Login
- **Severity:** MEDIUM
- **Component:** Frontend Navigation & Routing
- **Source Files:**
  - `frontend/src/pages/Admin/AdminDashboard.tsx` (Lines 45-60)
  - `frontend/src/App.tsx`
- **Root Cause:**
  When an admin's token expires while on `/admin/dashboard`, the auth check redirects to generic `/login` rather than `/admin/login`.
  The generic login screen lacks the "Admin Passkey" field required for administrator authentication, requiring the admin to manually navigate back to the admin login URL.
- **Remediation:**
  Update unauthorized redirects in admin routes to point explicitly to `/admin/login`.

---

### BUG-22: Patient Medical Vitals, Allergies & Medications Omitted from Doctor View
- **Severity:** MEDIUM
- **Component:** Frontend Clinical Consultation Console
- **Source Files:**
  - `frontend/src/pages/Doctor/ConsultationView.tsx` (Lines 220-280)
  - `frontend/src/pages/Patient/PatientProfile.tsx`
- **Root Cause:**
  `PatientProfile` records in the database store `bloodGroup`, `allergies`, `existingConditions`, and `currentMedications`.
  However, `ConsultationView.tsx` does not display the patient's known allergies or medical history, presenting a significant clinical risk if a doctor prescribes contraindicated medications without seeing prior adverse reactions.
- **Remediation:**
  Display a "Patient Medical History & Allergies" card prominently in the sidebar of `ConsultationView.tsx`.

---

### BUG-23: 5.5-Hour UTC vs. IST Timezone Boundary Anomaly in Appointment "Today" Calculation
- **Severity:** MEDIUM
- **Component:** Backend Date/Timezone Logic
- **Source Files:**
  - `backend/src/controllers/appointmentController.ts` (Lines 856-861)
- **Root Cause:**
  In `appointmentController.ts`:
  ```typescript
  const now = new Date();
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localDay = String(now.getDate()).padStart(2, '0');
  const localTodayStr = `${localYear}-${localMonth}-${localDay}`;
  const istTodayStr = getLocalDateString(now);
  const isToday = appt.appointmentDate === localTodayStr || appt.appointmentDate === istTodayStr;
  ```
  When the server runs in UTC (default on Render):
  Between 00:00 UTC and 05:30 UTC:
  - `localTodayStr` is UTC day (e.g. 2026-09-30).
  - But at 23:00 UTC on Sept 29, `localTodayStr` is 2026-09-29 while in IST (UTC+5:30) it is already 04:30 AM on 2026-09-30 (`istTodayStr`).
  Because of the logical OR (`||`), both yesterday's and today's appointments are flagged as `isToday = true` for 5.5 hours every single day, causing yesterday's appointments to evaluate against today's shift clock and miscalculating wait estimates.
- **Remediation:**
  Evaluate `isToday` strictly against `istTodayStr` (the clinic's operational timezone).

---

### BUG-24: Avatar Upload 404 URL Discrepancy Between Route Serving and Generator
- **Severity:** MEDIUM
- **Component:** Backend Static Asset Handling
- **Source Files:**
  - `backend/src/controllers/authController.ts` (Line 828)
  - `backend/src/server.ts` (Line 394)
- **Root Cause:**
  `authController.ts` constructs disk avatar URLs as:
  `avatarUrl = '/uploads/' + filename;`
  However, `server.ts` only mounts:
  `app.use('/uploads/avatars', express.static(...));`
  There is no route serving `/uploads/<filename>`. Any avatar served from disk returns HTTP 404 immediately.
- **Remediation:**
  Standardize the URL path to `/uploads/avatars/<filename>` and ensure the target directory exists.

---

### BUG-25: Receptionist Dashboard UI Exposes Non-Permitted "Completed" Status Action
- **Severity:** MEDIUM
- **Component:** Fullstack Receptionist Operations & State Machine
- **Source Files:**
  - `frontend/src/pages/Receptionist/ReceptionistDashboard.tsx` (Lines 1262-1269)
  - `backend/src/utils/appointmentStateMachine.ts` (Lines 88-94)
- **Root Cause:**
  `ReceptionistDashboard.tsx` renders a "Complete" button whenever an appointment is `IN_CONSULTATION`:
  ```tsx
  {appt.status === 'IN_CONSULTATION' && (
    <button onClick={() => handleStatusChange(appt.id, 'COMPLETED')}>Complete</button>
  )}
  ```
  However, `appointmentStateMachine.ts` strictly forbids receptionists from completing consultations:
  ```typescript
  case 'IN_CONSULTATION':
    if (to === 'COMPLETED') {
      if (actorRole === 'DOCTOR') return { allowed: true };
      return { allowed: false, reason: 'Only the examining doctor can complete a consultation.' };
    }
  ```
  Clicking "Complete" at reception desk always triggers an error alert: `"Only the examining doctor can complete a consultation."`.
- **Remediation:**
  Remove the "Complete" action from `ReceptionistDashboard.tsx` or only allow returning the patient to `WAITING`.

---

### BUG-26: Receptionist Desk Arrival Toggle Fails to Update UI Due to False Falsy Guard
- **Severity:** MEDIUM
- **Component:** Fullstack Receptionist Queue Console
- **Source Files:**
  - `frontend/src/pages/Receptionist/ReceptionistDashboard.tsx` (Lines 340-357)
  - `frontend/src/services/api.ts` (Lines 1200-1211)
- **Root Cause:**
  In `ReceptionistDashboard.tsx`:
  ```typescript
  const res = await api.checkInAppointmentDirect(appointmentId, nextStatus);
  if (res.success) {
    setQueueAppointments((prev) => prev.map(...));
  }
  ```
  `api.checkInAppointmentDirect` returns the unwrapped `Appointment` object from `handleResponse`.
  Because `Appointment` has no `success` property, `res.success` is `undefined` (falsy).
  The local state update is skipped entirely. Even though the check-in succeeded in the database, the arrival toggle button fails to reflect the new state in the receptionist's browser.
- **Remediation:**
  Change `if (res.success)` to `if (res && res.id)`.

---

## 6. Deep-Dive Bug Reports: Low & UI/UX Severity

### BUG-27: Patient Age Calculation Inaccuracy (Calendar Year Difference vs DOB)
- **Severity:** LOW
- **Component:** Frontend Consultation View
- **Source Files:**
  - `frontend/src/pages/Doctor/ConsultationView.tsx` (Line 38)
- **Root Cause:**
  Age is calculated as `new Date().getFullYear() - new Date(dob).getFullYear()`.
  If a patient was born on December 30, 2000, and the consultation occurs in January 2026, the calculated age will display as 26 instead of 25.
- **Remediation:**
  Use precise month/day comparison logic (`hasPassedBirthday`).

---

### BUG-28: Completed Consultations Lack Diagnosis & Clinical Notes in Patient Pass
- **Severity:** LOW
- **Component:** Frontend Queue Pass
- **Source Files:**
  - `frontend/src/components/queue/LiveQueueTicket.tsx` (Lines 180-250)
- **Root Cause:**
  When an appointment transitions to `COMPLETED`, `LiveQueueTicket.tsx` displays "Consultation Completed", but omits the doctor's entered diagnosis, clinical advice, and follow-up date. Patients are unable to review post-visit instructions from their digital pass.
- **Remediation:**
  Render a "Doctor's Advice & Summary" accordion on completed passes.

---

### BUG-29: 17 React 19 Oxlint Warnings Regarding Synchronous setState in useEffect
- **Severity:** LOW
- **Component:** Frontend Dashboards
- **Source Files:**
  - `frontend/src/pages/Doctor/DoctorDashboard.tsx`
  - `frontend/src/pages/Receptionist/ReceptionistDashboard.tsx`
  - `frontend/src/pages/Clinic/ClinicDashboard.tsx`
- **Root Cause:**
  Multiple components call synchronous `setState` inside `useEffect` bodies without dependency guards, triggering React 19 compiler warnings and cascading re-renders.
- **Remediation:**
  Derive state during render or wrap in proper condition guards.

---

### BUG-30: Missing Cache-Control Headers on Static and Dynamic API Responses
- **Severity:** LOW
- **Component:** Backend HTTP Headers
- **Source Files:**
  - `backend/src/server.ts`
- **Root Cause:**
  Live queue status endpoints lack explicit `Cache-Control: no-cache, no-store, must-revalidate` headers. Mobile safari/chrome aggressive caching can cause users to see outdated token positions.
- **Remediation:**
  Add a global `Cache-Control: no-store` header on all `/api/*` routes.

---

### BUG-31: Dead References to 1MB Medical Vault in `documentOptimizer.ts` and `api.ts`
- **Severity:** LOW
- **Component:** Frontend Utility Code
- **Source Files:**
  - `frontend/src/utils/documentOptimizer.ts`
  - `frontend/src/services/api.ts` (Lines 17-19)
- **Root Cause:**
  Post-removal of the medical vault in commit `21f695c`, `documentOptimizer.ts` contains 84 lines of dead canvas compression code that is never imported by any active page.
- **Remediation:**
  Delete `documentOptimizer.ts` or archive it.

---

### BUG-32: Unsanitized Plaintext Doctor Notes Rendering Risk
- **Severity:** LOW
- **Component:** Frontend Note Containers
- **Source Files:**
  - `frontend/src/components/queue/LiveQueueTicket.tsx`
  - `frontend/src/pages/Doctor/ConsultationView.tsx`
- **Root Cause:**
  Clinical notes entered with multiple lines collapse into single-line text due to missing `whitespace-pre-wrap` CSS classes.
- **Remediation:**
  Add `whitespace-pre-wrap break-words` to note display blocks.

---

## 7. Portal-by-Portal Audit Summary

### 1. Patient Portal
- **Discovery:** Independent doctors missing from results; clinic search parameter ignored by backend.
- **Booking:** Booking fails for independent doctors; dependent bookings do not reflect in patient age calculation.
- **Arrival Check-In:** QR code check-in displays false failure error due to response unpacking flaw; clinic check-in code is null.
- **Queue Pass:** Completed passes lack doctor diagnosis/advice; polling triggers N+1 database queries.
- **Profile:** Allergies, existing conditions, and emergency contacts cannot be viewed or updated.

### 2. Doctor Portal
- **Consultation View:** Prescribed medicines are discarded upon completion; no prescription UI exists in the frontend; patient allergies/conditions are hidden; age calculation is inaccurate.
- **Queue Console:** Negative/zero queue tokens can leak into active queue if status is misaligned.
- **Schedule:** Doctors without clinic affiliations cannot configure practice hours or fees.
- **Revenue:** Revenue metrics include cancelled and rejected appointments.

### 3. Clinic Portal
- **QR Check-in:** Generated QR codes lack `checkinCode`, breaking arrival verification platform-wide.
- **Staffing:** Updating receptionist doctor assignments crashes the UI (`TypeError: Cannot read properties of undefined (reading 'message')`).
- **Doctor Recruitment:** Catch-22 prevents clinics from discovering and inviting new unverified/unaffiliated doctors.
- **Revenue:** Overstates earnings by including cancelled visits.
- **Security:** Suspending a clinic does not prevent its receptionists from continuing desk operations.

### 4. Receptionist Portal
- **Authentication:** Mandatory password change causes permanent HTTP 403 desk lockout due to token unrolling bug.
- **Walk-in Booking:** Walk-in submission crashes UI with `TypeError: Cannot read properties of undefined (reading 'queueNumber')`; phone number lookup fails against seeded records with spaces.
- **Approvals:** Concurrency lock swallows database errors, causing transaction aborts (25P02) under load.
- **Desk Check-In:** Manual arrival toggle button fails to update UI due to `res.success` falsy check.
- **Queue Actions:** Exposes "Complete" button which is strictly forbidden by the backend state machine.

### 5. Admin Portal
- **Redirection:** Session expiry on Admin Dashboard incorrectly redirects to generic `/login` instead of `/admin/login`.
- **Reviews:** Review model exists in database but has no administrative or public endpoints.
- **Notifications:** Notification model exists in database but has no endpoints or trigger handlers.

### 6. Backend API & Core Architecture
- **N+1 Polling:** `getPatientAppointments` triggers 2 queries per appointment every 15 seconds, risking Supabase connection exhaustion.
- **Timezone Boundary:** 5.5-hour UTC vs. IST discrepancy treats yesterday's appointments as "today".
- **Memory Leak:** Unbounded `rateLimitMap` in `server.ts` permanently stores IP addresses.
- **Avatars:** Base64 fallback stores >1MB strings directly in PostgreSQL text columns; static route `/uploads/` returns 404.
- **Cache Control:** Live queue endpoints lack `no-cache` headers, causing stale token positions in mobile browsers.

---

## 8. Prioritized Remediation Roadmap

1. **Phase 1: Critical Operational & Auth Blockers (Immediate)**
   - Fix receptionist password change token synchronization (`api.ts#changeReceptionistPassword`).
   - Fix walk-in booking response unpacking crash (`ReceptionistDashboard.tsx#res.data.queueNumber`).
   - Fix arrival check-in response unpacking flaw (`ClinicCheckIn.tsx#res.success`).
   - Initialize and generate `ClinicProfile.checkinCode` across registration and seed scripts.
   - Fix doctor assignment crash in clinic portal (`clinicController.ts#updateClinicReceptionistDoctors`).
   - Allow independent doctors to be discovered and recruited by clinics (`doctorController.ts#getDoctors`).
   - Fix concurrency lock error handling in `receptionistController.ts#approveAppointment`.

2. **Phase 2: Security & Resource Stability (Next Priority)**
   - Batch queue statistics in `getPatientAppointments` to eliminate N+1 query explosion and save database connections.
   - Fix 5.5-hour UTC vs. IST timezone discrepancy in appointment date matching.
   - Add periodic TTL pruning to `rateLimitMap` in `server.ts` to prevent memory leaks.
   - Enforce clinic verification checks in `requireActiveReceptionist` middleware.
   - Correct revenue calculations in `clinicController.ts` and `doctorController.ts` to exclude cancelled/rejected visits.
   - Compress avatars before storing as Base64 or enforce file storage.
   - Fix receptionist arrival toggle UI update guard (`ReceptionistDashboard.tsx#res.success`).
   - Remove forbidden "Complete" status button from receptionist dashboard.

3. **Phase 3: Clinical Data & UX Enhancements (Final Phase)**
   - Restore prescription form and serialization logic in `ConsultationView.tsx` and `consultationController.ts`.
   - Add allergy/medication fields to `PatientProfile.tsx` and display them in `ConsultationView.tsx`.
   - Correct patient age calculation in `ConsultationView.tsx`.
   - Display diagnosis and doctor notes on completed `LiveQueueTicket.tsx`.
   - Either implement complete review endpoints for `Review` model or deprecate cleanly.
   - Implement `Notification` triggers and UI or drop model.
   - Fix 17 Oxlint cascading render warnings in dashboard components.

---
*Report compiled and certified following fullstack code inspection across all MediArca repositories.*
