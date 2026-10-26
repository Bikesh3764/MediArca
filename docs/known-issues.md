# MediArca Known Issues, Defect Ledger & Engineering Lessons

## 1. Resolved Defects Ledger (FIX-001 through FIX-045)

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
| **FIX-030** | Database Exposure | Supabase's public REST API (PostgREST) could read every table: RLS was off and the `anon` role had SELECT on `User`. Migration `20261025120000_lock_down_public_api_access` enables RLS on all `public` tables and revokes `anon`/`authenticated` access. The backend connects as the table owner (BYPASSRLS), so app behaviour is unchanged. Applied live on 2026-10-25. |
| **FIX-031** | Demo Accounts | Demo logins stay visible on purpose. In production, `blockDemoAccountChanges` (`utils/demoAccounts.ts`) blocks renaming, phone/photo edits, password changes and staff/doctor removal for the public demo accounts so visitors can't deface or lock out the demo. |
| **FIX-032** | Session Security | Password changes now record `User.passwordChangedAt`; `authenticate` rejects tokens issued before it (`utils/sessionRevocation.ts`, zero extra queries, reloaded on startup). |
| **FIX-033** | Google Sign-In | Removed the fake "Continue with Google" button that sent an unsigned token when `VITE_GOOGLE_CLIENT_ID` was missing (it always failed). The Google section is hidden until configured. |
| **FIX-034** | API Latency | Prisma `relationJoins` loads relations in one SQL query; signed-out discovery lists are cached in memory for 15s and cleared on any successful write (`middleware/publicResponseCache.ts`); public rate limiting no longer waits on Redis. Third-party SF Pro web fonts removed (licence + render blocking). |
| **FIX-035** | Live Updates | Added a Server-Sent Events stream (`GET /api/events`). Every successful queue write pushes a `queue` event and clears the 4s queue snapshot (several call/complete paths never invalidated it). Patient, doctor and receptionist screens refresh instantly; polling remains as backup. Patients get a "You're next" / "Your turn" alert. |
| **FIX-036** | Data Integrity | Migration `20261025122000_data_integrity_rules`: phones normalised to `+91 XXXXXXXXXX`; CHECK constraints on appointment status, payment status, user role and non-negative fees; queue-number uniqueness now `NULLS NOT DISTINCT` (walk-ins without clinic/shift could share a token). Raw fee writes rounded to the paisa. |
| **FIX-037** | Tests & Monitoring | New `scripts/flow-tests.ts` (`npm run test:flow`) drives the real API end to end on PostgreSQL; frontend unit tests (`npm test`, Vitest); frontend CI workflow. Failed/slow requests and browser crashes are logged (`[HTTP]`, `[ClientError]`). |
| **FIX-038** | Hosting Region | API moved from Render Oregon (USA) to Render Singapore (`mediarca-api-sg`) and database from Supabase Seoul to Supabase Singapore (`MediArca-SG`), with a dedicated `prisma` database login. All data copied and checksum-verified. |
| **FIX-039** | Code Structure | Large files split by area: backend controllers into `controllers/<area>/`, `services/api.ts` into `services/api/`, and the Receptionist/Doctor/Clinic/Admin dashboards and Home page into a state hook plus one file per tab or modal. The original files remain as entry points; `verify-fixes.ts` reads each split folder as one unit (no assertion changed). |
| **FIX-040** | Design Consistency | Applied `DESIGN.md` across the app: no shadows on cards/buttons (floating menus, toasts and sticky bars keep one soft shadow), weights 400/600 only, Apple status colors via `success`/`danger`/`warning` tokens, 18px card radius, minimum 11px text and 13px small text, consistent page titles (`SubNav` width matches content), Admin on the shared `DashboardLayout`, no duplicate menus or Refresh buttons, cleaner queue rows, ~90 messages shortened. The white global nav is kept as the brand header. |
| **FIX-041** | Mobile UX | Fixed phone overflow (doctor queue rows, Shifts clinic picker, admin filter rows and booking filters) and enlarged small tap targets (show-password, date chips, presets, filters, bell, footer links). Checked every portal at 390px. |
| **FIX-042** | Loading UX | Public doctor/clinic lists cached for 30s in the browser; a "Connecting…" notice appears when any request waits more than 4s; all loading text unified to "Loading…". |
| **FIX-043** | Security / Rate Limits | Every per-IP limit could be skipped by sending a fake `X-Forwarded-For` header (tested live: 24 requests with fake IPs, none blocked). Limits now key on Cloudflare's `CF-Connecting-IP` (`utils/clientIp.ts`), which clients can't fake; path variants like `/API/Auth/Login/` share one bucket. |
| **FIX-044** | Security / OTP Spam | Code emails had only a 60s cooldown per (email, role), so one inbox could get codes all day and one visitor could mail any number of addresses. `utils/otpEmailBudget.ts` now caps all code emails together: 5/hour and 10/day per inbox, 10/hour and 30/day per visitor, `OTP_EMAIL_DAILY_CAP` (default 400) site-wide. Sign-up limited to 10/hour per visitor. Resend no longer reveals whether an email has an account. |
| **FIX-045** | Security / Bots | Cloudflare Turnstile (widget "MediArca forms") on sign-up, forgot password, contact form and receptionist applications (`middleware/requireHuman.ts`, `frontend/src/services/botCheck.ts`). Invisible for most people. On only when `TURNSTILE_SECRET_KEY` is set on Render. Contact form also has a hidden trap field. |
| **FIX-043** | Plain Words & UX | ~400 labels, headings, toasts and errors rewritten in plain words (no "Practitioner", "Facility", "Affiliate", "Provision", "Console"; "Couldn’t … Try again." instead of "Failed to …"). Same names everywhere: patient nav/tab bar/footer say "Appointments"; doctor nav says "Queue / Clinics / Profile"; receptionist "Pending". Green/red/orange action buttons (Resume, Leave, Accept, Hold) are now blue or white. Dates show as "Today", "Tomorrow" or "Tue, 27 Oct" (`formatDisplayDate`), Indian locale everywhere. Addresses no longer repeat city/state (`utils/address.ts`). Broken profile photos fall back to an initial (`components/ui/AvatarImage.tsx`). Bugs fixed: doctor page showed "Booking closed" for an open clinic (stale queue-preview reply overwrote the right one; booking page had the same race); receptionist shift helper dropped "Morning/Evening", merging different shifts into one group; walk-in form started on an ended shift; doctor queue showed "Shift 1" instead of the shift name; How It Works/FAQ wrongly said no payment was needed to confirm a token. |
| **FIX-044** | Notifications | Only useful notifications are sent, in plain words with "Tue, 27 Oct" dates (`formatVisitDate`, `withDr` in `services/notificationService.ts`, which lists what each role gets). Removed noise: doctors no longer get a notification for every booking, arrival, walk-in or cancellation (their queue is live); patients no longer get "Doctor has not yet arrived". Added missing ones: clinic is told when a doctor or receptionist asks to join or answers an invite; admins are told when a new doctor/clinic needs verifying. Unread count now counts all unread, not just the latest 50. One shared panel (`components/notifications/`) is used by the site nav, portal header and receptionist tab: full text always visible, grouped Today/Yesterday/Earlier, tap opens the right page, and a notification is marked read after ~1 s on screen (sent in one `PATCH /api/notifications/read` call); new items keep their blue look until the panel closes. |
| **FIX-045** | Security Audit Fixes | **Walk-ins:** a walk-in only joins an existing patient account when the typed name matches (`utils/walkinMatch.ts`), and booking replies no longer include the patient's email, so a phone number can't be used to look up who owns it. **Passwords:** new `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (6-digit email code, same reply for unknown emails, lockout after 5 wrong codes) and `PUT /api/auth/change-password` (signs out other devices); "Forgot password?" on every sign-in page, `/forgot-password` page, and a Password card on patient, doctor and clinic profiles. Email codes are stored hashed (`utils/otpHash.ts`; old plain codes still accepted until they expire). **Sign-in:** the demo admin is refused on the live site and its button only shows in local development; suspended or rejected doctors and clinics can't sign in with a password (same as Google). **Abuse limits:** bookings, walk-ins and reschedules are limited to 90 days ahead; 4 active bookings per patient per day; length limits on all free text (`utils/inputLimits.ts`); QR check-in only works from 3 hours before the shift until it ends; re-applying as a rejected receptionist needs that account's password. **Other:** desk status changes lock the row (no overwrite of a doctor's call); wrong input types give 400 not 500; production CORS no longer trusts localhost; admin bookings list is paged; clinic booking counts exclude unpaid requests; the backend no longer turns a medicine list into notes (no prescription builder); the clinic QR is drawn in the browser instead of sending the check-in code to api.qrserver.com; mediarca.in sends security headers (no framing, CSP, HSTS, camera only for this site); www redirects to mediarca.in; robots.txt, sitemap and share image added; labels linked to form fields with autofill hints; small links enlarged; phone numbers shown one way; browser storage failures no longer crash sign-in. Covered by 35 new checks in `scripts/flow-tests.ts` and 3 frontend tests. |
| **FIX-046** | Email Delivery | Render's free plan blocks outbound SMTP ports (25, 465, 587) since 26 Sep 2025, so Gmail SMTP timed out and no OTP emails arrived. Emails now go through Brevo's HTTPS API (`utils/brevoMail.ts`) when `BREVO_API_KEY` is set (sender: `BREVO_SENDER_EMAIL`, which must be verified in Brevo; name: `BREVO_SENDER_NAME`, default MediArca). If Brevo fails, Gmail SMTP is still tried. Free Brevo plan: 300 emails/day. Live setup: sender noreply@mediarca.in; mediarca.in authenticated in Brevo via Cloudflare DNS (brevo-code TXT, brevo1/brevo2._domainkey CNAMEs, DMARC rua=mailto:rua@dmarc.brevo.com added, policy still p=none). Startup no longer logs a FATAL line when `REQUIRE_REDIS=false` (one server needs no Redis). |

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
7. **Anti-Pattern: Leaving Supabase's Public API Open**
   - *Lesson*: Every new table in `public` is reachable through Supabase's REST API unless RLS is on. Any migration that creates a table must also `ENABLE ROW LEVEL SECURITY` on it.
8. **Anti-Pattern: Tests That Only Grep Source Code**
   - *Lesson*: An assertion like `content.includes('prisma.$transaction')` passes even when the feature is broken. New behaviour must be covered in `scripts/flow-tests.ts` by calling the real API.

## 5. Open Items (need an owner decision)
- ~~Database region~~ **Done 2026-10-26**: API and database both moved to Singapore (the old API was actually in Oregon, USA). See `docs/operations/database-region-move.md`.
- **Render free plan** sleeps after 15 minutes idle. Mitigated by a Cloudflare Worker cron (every 5 min) plus the GitHub keep-alive job. Render Starter ($7/month) removes sleep entirely.
- ~~Leftover tables~~ **Done**: `Prescription`, `MedicalRecord` and `staging_test` were not carried into the new Singapore database. They remain only in the old Seoul backup project.
- **Email OTP** is sent from a personal Gmail account (500/day limit, spam risk).
- **Redis not set up in production**: rate limits, code email caps and login lockouts live in memory and reset whenever the free server restarts. Adding a Redis URL (`REDIS_URL`) fixes this; it needs an account with a Redis provider.
- **Demo doctor linked to a real clinic** in production (owner decision: kept on purpose).
- **Page addresses use `#/`** (HashRouter), which a test protects for GitHub Pages. Search engines only see the home page; switching to normal addresses needs the owner to agree to change that test.

