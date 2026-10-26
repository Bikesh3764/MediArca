# Pre-release audit — 27 Oct 2026

**Decision: NOT READY for real patients yet.** Two owner actions block release (section 1). The code itself is in good shape: no broken core flow, no data-integrity bug and no access-control hole was found.

## 1. Release blockers (owner action needed)

| # | Problem | Evidence | What to do |
|---|---------|----------|------------|
| B1 | **Public demo logins can see real patient data.** The demo receptionist `receptionist@mediarca.com` (password shown on the sign-in page) is ACTIVE at the real clinic "Bikesh Clinic" (`admin@clinic.com`), and the demo doctor `dr.sarah@mediarca.com` (also public) works there. That clinic holds 32 bookings, 10 of them from non-demo patient accounts. Anyone can press "Try demo desk" and read patient names, phones and visit reasons; the demo doctor also sees allergies and conditions. | Production read-only SQL, 27 Oct | Before launch either (a) move the demo receptionist and demo doctor to the demo clinic `clinic@mediarca.com` only, or (b) hide the demo buttons on the live site. |
| B2 | **Gmail SMTP password stored in plain text in the production database** (`SystemConfig` rows `SMTP_USER`, `SMTP_PASS`…). Emails now go through Brevo, so these rows are only a fallback. | Production read-only SQL | **Rows deleted on 27 Oct.** Still to do (owner): revoke that Gmail app password in the Google account, since it sat in the database. |

## 2. Fixed in this audit

| Area | Problem | Fix | Proof |
|------|---------|-----|-------|
| Privacy | A patient's visit details (`GET /api/appointments/:id`) included the doctor's own login email and personal mobile. | Removed for patients; staff and the doctor still see them. | New flow test + live probe |
| Desk UX | Walk-in form errors (e.g. wrong mobile) appeared at the top of the page, off screen; "Issue Token" looked dead. | Errors also show as a toast. | Checked in the browser |
| API | Doctor "Call in" returned 500 when the visit changed a moment earlier (check-in removed, already moved). | Returns 400 with the reason. | tsc + suites |
| Input | Decline reason had no type/length check (an object became "[object Object]"; unlimited text). | Text only, max 500 characters. | New flow tests |
| Input | Sign-up profile fields (clinic name, address, bio…) had no length limit. | Same caps as profile edits. | New flow test |
| Copy | Booking success button said "View My Passes". | "View Appointments". | Build |

## 3. Verified working (with evidence)

- **Gates:** backend verify suite 2104/2104, backend TypeScript build, frontend lint 0 errors, frontend unit tests 11/11, frontend production build. `npm audit`: 0 vulnerabilities (backend and frontend).
- **Real database:** all 8 migrations apply to a fresh PostgreSQL 17; schema matches `schema.prisma` (only an index-name length difference). Flow tests on a real database: 65/65 (59 existing + 6 new).
- **Browser, every portal (local copy, test data):** sign-in (wrong and right password), doctor search/filter, booking with receptionist contact shown, patient appointments, desk approval ("Mark Paid"), walk-in, doctor call-in, notes, complete, clinic dashboard and QR code (drawn in the browser), admin verify doctor, expired token → back to sign-in, no broken internal links (22 checked), no horizontal overflow at 375 px on 20 pages, 404 page.
- **Access control (API probes):** a patient cannot read, cancel or reschedule another patient's visit; another clinic and another doctor get 403; patient/doctor cannot open admin; unverified doctor cannot open the queue; forged token 401; `role`/`isVerified`/`verificationStatus` cannot be set through profile edits; public doctor and clinic lists expose only clinic business phone and address.
- **Race conditions:** 20 walk-ins at once → tokens 1–20, no duplicates; 5 approvals of one booking at once → exactly one succeeds; duplicate booking same doctor/day refused.
- **Abuse limits:** wrong password ×5 → locked (15 per account across networks); wrong email code ×5 → locked; 200 KB request → 413; bad JSON → 400.
- **Live site (read-only):** API runs in production mode (no test codes in replies); CORS refuses unknown websites; mediarca.in sends strong security headers (CSP, HSTS, no framing, camera only for itself); Supabase RLS on for every table, no public policies.

## 4. Smaller issues left open (not blocking)

- Doctor list shows "Book" for a doctor whose clinic has no receptionist; the booking page then says "Booking closed".
- Patient pass shows "You're next · Wait time Now" before the shift has started (e.g. at 1 AM for a 9 AM shift).
- Wrong password shows the same message twice (toast and in the form).
- "Mark Paid" confirms payment in one tap with no undo.
- Pending tab shows phones as "+91 9876543210" while other screens show "+91 98765 43210".
- A clinic can create a receptionist login for any email address without that person confirming it.
- Patient email addresses are written to the server log when a code email is sent.
- Rate limits, lockouts and code-email caps are kept in memory and reset when the free Render server restarts (no Redis).
- The clinic QR code never changes, so a patient who saved it could check in from elsewhere during the 3-hour window (accepted design).

## 5. Not tested (and why)

- Real email delivery through Brevo: not sent, to avoid emailing real inboxes.
- Camera QR scanning on a phone: no camera in this environment; the check-in API is covered by flow tests.
- Google sign-in: not configured on the server.
- Turnstile bot check on the live site and photo uploads to Cloudflare R2: they need live keys; not exercised.
- Load/performance on production.
