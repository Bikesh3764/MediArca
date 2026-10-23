# MediArca Known Issues, Defect Ledger & Engineering Lessons

## 1. Resolved Defects Ledger (FIX-001 through FIX-028)

The following defect resolutions have been implemented and verified by 2,023+ automated regression tests in `backend/scripts/verify-fixes.ts`:

| Fix ID | Subsystem | Description & Resolution |
|--------|-----------|--------------------------|
| **FIX-001** | Database Config | Reconciled PostgreSQL database connection strings (`DATABASE_URL`, `DIRECT_URL`) and ensured schema synchronization across environments. |
| **FIX-002** | Queue Concurrency | Wrapped `callPatient` in atomic transaction (`prisma.$transaction`) enforcing single active `IN_CONSULTATION` per doctor across all facilities. |
| **FIX-003** | Server Runtime | Added top-level process handlers (`unhandledRejection`, `uncaughtException`) to prevent abrupt server crashes on unhandled asynchronous errors. |
| **FIX-004** | API Gateway | Reclassified CORS rejection failures to return standard HTTP `403 Forbidden` instead of generic 500 error. |
| **FIX-005** | Receptionist Desk | Fixed reschedule flow so unapproved `PENDING_APPROVAL` appointments remain unapproved upon reschedule rather than auto-escalating to `WAITING`. |
| **FIX-006** | Admin Dashboard | Fixed consultation fee display from dollar sign (`$`) to Indian Rupee (`₹`). |
| **FIX-007** | Concurrency Guard | Prevented simultaneous cross-clinic consultations for doctors practicing at multiple locations (HTTP 400 rejection). |
| **FIX-008** | Schedule Engine | Added schedule validation preventing overlapping shifts for the same practitioner across different clinics on the same day. |
| **FIX-009** | Staff Security | Enforced receptionist temporary password guard (`mustChangePassword = true`) blocking mutation endpoints until password change. |
| **FIX-010** | Access Control | Hardened `verifyReceptionistDoctorAccess` to restrict clinic fallback to general staff and block cross-clinic doctor access. |
| **FIX-011** | Clinic Onboarding | Restricted doctor-clinic affiliation acceptance to active, verified doctors and approved clinic facilities. |
| **FIX-012** | Cabin State | Enforced doctor eligibility checks on cabin status updates (`IN_CABIN`, `STEPPED_OUT`, `NOT_IN_CABIN`). |
| **FIX-013** | Review Integrity | Added status verification on doctor reviews and enabled user profile ID fallback. |
| **FIX-014** | Date Arithmetic | Fixed `isValidDobDate` and appointment date math to evaluate against Indian Standard Time (IST / Asia/Kolkata) calendar day. |
| **FIX-015** | Phone Lifecycle | Updated `findExistingAccountByPhone` to release unverified phone reservations upon legitimate verified user registration. |
| **FIX-016** | Catalog Filtering | Verified that public clinic and doctor catalogs strictly filter verified and active practitioners. |
| **FIX-017** | UI Consistency | Formatted PatientProfile date of birth with ISO synchronization and added standard `+91` phone badge. |
| **FIX-018** | Consultation Flow | Implemented `holdConsultation` endpoint (`POST /consultations/hold`) allowing doctors to safely return in-cabin patients to `WAITING`. |
| **FIX-019** | Doctor Console | Strictly filtered clinic appointments without cross-clinic leakage; prevented duplicate shift name creation. |
| **FIX-020** | Clinic Metrics | Excluded cancelled, rejected, and expired visits from total bookings and clinic dashboard counts. |
| **FIX-021** | Desk Reschedule | Fixed receptionist walk-in consultation date picker to lock past dates using `min={getLocalDateString()}` and safe calendar math. |
| **FIX-022** | Admin Telemetry | Added affiliated clinics in doctor inspection, affiliated doctors in clinic inspection, and implemented message deletion. |
| **FIX-023** | User Resilience | Added dedicated Apple-styled NotFound page with recovery CTAs; added live offline connectivity banner. |
| **FIX-024** | Clinic Profile | Added clinic profile settings page with logo crop & auto-compression, atomic User & ClinicProfile synchronization, Indian phone validation, and dashboard integration. |
| **FIX-025** | Schedule & Absence | Added independent weekly sitting days (Mon-Sun) selection and leave management (Today toggle + Date Range leave) for both Doctors and Receptionists, enforced in slot availability, walk-in tokens, and patient booking. |
| **FIX-026** | Touchless QR Arrival & Discovery Branding | Eliminated manual 6-digit code entry; streamlined CameraQrScannerModal to pure camera viewfinder; removed printed desk code from standee; dynamically mapped uploaded clinic photos (`avatarUrl`) across discovery cards and headers; purged technical database IDs from clinic settings. |
| **FIX-027** | Apple HIG Weekdays & Copy Minimalism | Replaced cluttered rectangular weekday badges (`[Mon] [Tue] [Wed]`) with Apple HIG circular day discs (`WeekdayDisplay.tsx`) and rounded-full capsule selectors; streamlined copy across doctor and receptionist portals to direct 1–2 word actions (`Shifts`, `Schedule`, `Standee`, `Resume`, `Leave`, `Available`). |
| **FIX-028** | QR Arrival Synchronization & Scanner Lifecycle | Synchronized instant QR arrival check-in with 0ms optimistic UI state transition to "Checked In at Clinic • Waiting Area"; preserved target appointment across modal unmount via `selectedApptRef`; reset `presenceOverride` upon prop change in `LiveQueueTicket`; added cache-busting timestamp `_t` and `Cache-Control: no-cache, no-store` to `getPatientAppointments`; auto-cleared `scannedFeedback` and old arrival banners upon scanner open and step-out. |
| **FIX-029** | Silent Polling Updates & Apple Design System | Eliminated periodic background polling loading flickers across all portals (Receptionist live queue, Doctor queue, Clinic roster, Patient visits); implemented silent in-place reactive updates; refined all user-facing "Standee" text to "QR Code" / "View QR Code"; removed "Auto-generate" password and wordy boilerplate helper copy; embedded authentic Apple SF Pro webfont and tactile Apple pill buttons. |

---

## 2. Sprint Quality Audit Gates (ARCH & FUNC Invariants)

The master test suite additionally verifies:
- `ARCH-002` / `FUNC-005`: Average consultation minutes bounded and rounded to integer.
- `ARCH-003` / `FUNC-002`: Standee check-in URL contract matches scanner payload (`clinicId` and `checkinCode`).
- `ARCH-004` / `FUNC-006`: Rejected receptionist accounts can re-apply; clinic approval activates verified account atomically.
- `ARCH-005` / `FUNC-011`: Stale auth credentials cleared on 401 Unauthorized.
- `ARCH-006` / `FUNC-009`: Schedule updates synchronize both slot ID and canonical shift window name.
- `ARCH-007` / `FUNC-015`: OTP security records are role-scoped and expire cleanly.
- `ARCH-011`: Stale closures in dashboard polling intervals eliminated via React refs.
- `ARCH-012`: Consultation transitions locked inside transactions, validate state machine, and handle `clinicId: null`.
- `ARCH-016`: Email service safely escapes HTML greeting names to prevent email injection.
- `ARCH-017` / `FIX-024`: Clinic profile updates synchronize both ClinicProfile and parent User atomically; rejects base64 data URLs in profile payload.
- `ARCH-018` / `FIX-025`: Doctor working days (`workingDays`) and leave periods (`leaves`) strictly gate slot availability and booking transactions; verified receptionist access control scopes updates to linked clinic facilities.
- `ARCH-019` / `FIX-026`: Pure camera QR arrival verification invariant; UI screens must not expose manual numeric code entry or internal facility keys. Discovery catalogs must render dynamic facility photos.
- `ARCH-020` / `FIX-027`: Cluttered weekday badges (`[Mon] [Tue] [Wed]`) and verbose copy replaced with Apple HIG single-letter circular day discs (`WeekdayDisplay.tsx`) and concise action buttons (`Shifts`, `Schedule`, `Standee`, `Resume`, `Leave`, `Available`).
- `ARCH-021` / `FIX-028`: QR Check-In Instant State Synchronization & Scanner Lifecycle: Patient check-in via QR standee optimistically updates ticket state to "Checked In at Clinic • Waiting Area" with zero lag; `selectedApptRef` guarantees appointment tracking across modal teardown; `LiveQueueTicket` clears `presenceOverride` upon `appointment.isCheckedIn` changes; `getPatientAppointments` enforces cache-busting timestamp `_t` and `Cache-Control: no-cache, no-store`; `CameraQrScannerModal` completely resets feedback states and camera frames on every modal re-open.

---

## 3. Active Edge Cases & Mitigations

### 3.1 Late Night Clinic Shifts (IST Midnight Crossover)
- **Edge Case**: In Indian OPDs, doctors sometimes consult past 11:30 PM. At 12:00 AM IST, the calendar date shifts.
- **Mitigation**: Live queue tickets for confirmed `WAITING` patients carry over during active shift windows. The doctor's console allows calling carryover patients from the immediately preceding shift.

### 3.2 Dual Role Accounts with Same Email
- **Edge Case**: A doctor logging in to book an appointment for themselves as a patient.
- **Mitigation**: Schema enforces `@@unique([email, role])`. Auth endpoints check both `email` and `role`. Login forms provide role-specific contexts.

### 3.3 Receptionist Network Disconnection During Cash Recording
- **Edge Case**: Receptionist marks a patient as PAID and confirms token, but connection drops.
- **Mitigation**: Token assignment is idempotent inside `prisma.$transaction`. If already confirmed, repeat clicks return existing token without duplicating queue numbers.

---

## 4. Engineering Lessons Learned & Anti-Patterns to Avoid

1. **Anti-Pattern: Raw Dollar Symbols in Templates**
   - *Lesson*: Never copy-paste US-centric templates using `$`. Always use the Indian Rupee symbol (`₹`).
2. **Anti-Pattern: Non-Atomic Queue Updates**
   - *Lesson*: Two fast clicks can create dual `IN_CONSULTATION` states. Always wrap queue transitions in `prisma.$transaction`.
3. **Anti-Pattern: Stale Closures in Polling `setInterval`**
   - *Lesson*: In React, `setInterval` callbacks capture component state at closure creation. Use `useRef` to store latest state variables or trigger re-fetches via stable function refs.
4. **Anti-Pattern: Blind `res.json()` on Reverse Proxy Errors**
   - *Lesson*: Cloudflare/Nginx return HTML on 502/504 errors. Always inspect `Content-Type` before parsing JSON.
5. **Anti-Pattern: Bootstrap-Style Weekday Badges & Verbose UI Verbiage**
   - *Lesson*: Never render 7 rectangular colored badge tags with borders or dual-verb labels like "Manage Schedule & Leaves". Always use minimalist Apple circular day pips (`M T W T F S S`), rounded-full capsule toggles, and concise 1–2 word labels.
6. **Anti-Pattern: Enforcing Uniqueness on Mobile Numbers or Forcing Phone OTP**
   - *Lesson*: In Indian physical outpatient clinics, family members (parents booking for children) or multi-role users frequently share a common mobile phone number. Do not enforce uniqueness constraints on mobile numbers; uniqueness is strictly on `(email, role)`. Moreover, OTP verification is strictly via Email; phone numbers are collected and validated for clinic contact without requiring phone OTP verification.
