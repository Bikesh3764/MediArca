# Stress test — 27 Oct 2026

**Verdict: NOT READY yet, because of one owner decision.** The three speed problems below were fixed the same day (FIX-049) and re-tested. The only thing left is the demo-account blocker. Otherwise the app is solid: no wrong data, no double bookings, no security holes found.

Heavy load ran only on a local copy (backend in production mode plus a local Postgres). The live site got light, read-only checks.

## Blocker (owner decision)

- The demo doctor `dr.sarah@mediarca.com` and the demo receptionist `receptionist@mediarca.com` are still linked to the real "Bikesh Clinic" in production (checked with SQL today). Their passwords are public, so anyone can read that clinic's patients. Fix: unlink them or hide the demo buttons.

## Problems found (fixed in FIX-049)

| # | What happens | Where | Why it matters on Render (0.15 CPU) |
|---|---|---|---|
| 1 | Each new walk-in patient gets a throwaway password scrambled at strength 12. That costs ~225 ms of CPU on a fast PC and blocks the whole server. | `backend/src/controllers/appointment/booking.ts:217` and `receptionist/walkin.ts:211` | About 1.5 s freeze for every user, per walk-in. |
| 2 | Password checks (`bcryptjs`, pure JavaScript) block the server. 60 logins at once froze even `/api/health` for 3.4 s locally. | `auth/login.ts` | One login costs ~0.4 s on Render, so 10 logins at once freeze the server for ~4 s. |
| 3 | 400 bookings for one doctor in the same second: 23 failed with 500 "Unable to start a transaction in the given time". The booking transaction uses Prisma's default 2 s wait for a database connection. | `appointment/booking.ts:446` | Rare at launch scale, but users get a confusing error instead of "busy, try again". |

### Re-test after FIX-049 (local, production mode)

- **Booking:** 400 at once all succeeded (was 23 × 500), with no duplicate tokens.
- **Sign-ins:** 60 at once finished in 3.9 s. `/api/health` kept answering in a median of 2 ms and at most 95 ms (was frozen for 3.4 s).
- **Walk-ins:** 30 at once all succeeded in 0.65 s.
- **Suites:** verify 2142/2142, flow 67/67, and the 54 security checks unchanged.

## What passed

- **Gates:**
  - `test:verify` 2124/2124
  - `test:flow` 67/67
  - frontend tests 14/14
  - backend tsc
  - frontend build
  - lint
- **Public pages under 100 parallel users (local):**

  | Page | Requests per second | p95 |
  |---|---|---|
  | Doctor list | 2,000 | 93 ms |
  | Clinic list | 4,200 | 35 ms |
  | Doctor page | 5,000 | 30 ms |

  All returned 200.
- **Booking rush:** 400 patients booked one doctor at once. No duplicate token numbers.
- **Capacity:** 400 requests competed for a 20-seat shift. The desk approved all of them at once and exactly 20 were confirmed; the other 380 expired automatically.
- **Double-tap Book ×10:** 1 booking, 9 × 409.
- **Doctor presses Call for 20 patients at once:** exactly 1 in the cabin.
- **Busy clinic for 40 s:**
  - Load: 400 phones polling the live pass, 400 live streams, desk and doctor screens, public browsing, and the doctor working through the queue.
  - Results: zero errors, live pass p95 41 ms, and every stream received every update.
- **Wait estimates:** never go backwards along the queue (60 tokens checked).
- **Rate limits:**
  - Wrong-password burst gets 429 after 4 tries.
  - One IP flooding the doctor list is capped at 300 per minute.
  - Forgot-password, sign-up and OTP guessing are all limited.
- **Security (54 checks):**
  - Logins: no login, forged, expired or "alg:none" logins are all rejected.
  - Role and clinic walls: wrong roles are blocked, and nobody can read or change another patient's or clinic's data.
  - Hostile input: SQL-injection text, broken JSON, 2 MB bodies, path tricks, wrong value types, past or impossible dates and bad phone numbers are all handled.
  - Responses: security headers and CORS are correct, and private data is marked no-store.
- **Live site:**
  - API answers in about 0.3–0.5 s, including 20 requests at once.
  - No server errors (5xx) in the last 7 days.
  - Memory use is 57 of 512 MB.
  - All pages return 200, the JS bundle is compressed (br) and cached for a year, and security headers are present.
  - Phone layout has no sideways scroll.
- **Supabase advisors:**
  - Info-level only. "RLS on, no policy" is intended (the public API stays closed).
  - One missing index on `ReceptionistProfile.clinicId` (minor).

Not from the site: on this PC, curl fails HTTPS revocation checks, port 80 is blocked, and Chrome shows occasional `ERR_HTTP2_PING_FAILED`.

Scripts used: `stress.js`, `stress2.js` and `security.js` in the session scratchpad (local only, they clean up after themselves).
