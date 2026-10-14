# MediArca Known Issues, Defect Ledger & Engineering Lessons

## 1. Resolved Defects Ledger (FIX-001 through FIX-023)

The following defect resolutions have been implemented and verified by 2,020+ automated regression tests in `backend/scripts/verify-fixes.ts`:

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
