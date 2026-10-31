# MediArca Mobile App — Roadmap

The MediArca app built with **React Native + Expo** in `mobile/`: Patient, Doctor, Clinic and Receptionist.
**Admin is website-only** — the app has no admin sign-in or screens.
No Play Store / App Store release for now: testing is on a phone through Expo Go, then a test build (APK).

**Read this first in every session.** Tick items as they finish and add a line to the log at the bottom.

## How the website and app stay in sync

```
MediArca/
├── backend/   ← one server for both (unchanged)
├── frontend/  ← website
├── mobile/    ← app (from Phase 1)
└── shared/    ← code both use: API client, data types, safeFetch, +91 phone, address, Indian states
```

- `shared/` never touches the browser or React Native directly. Each side calls
  `configurePlatform()` once at startup (`frontend/src/services/platform.ts` for the website)
  to plug in the server address, storage, bot check and the "server waking up" notice.
- The website imports shared code through its old paths (`services/api.ts`, `services/safeFetch.ts`,
  `utils/phoneUtils.ts`, `utils/address.ts`, `utils/indiaStates.ts`), which now re-export from `shared/`.
- `backend/scripts/verify-fixes.ts` reads some website files as text; `SHARED_SOURCE_MOVES` makes those
  reads include the moved code. If more code moves to `shared/`, add it there.
- Every feature change updates `shared/` (if logic), the website screen and the app screen together.
- Same rules as the website: ₹ only, +91 phones, IST, no payment gateways, short copy, `DESIGN.md` colours.

## Phases

### Phase 0 — Prepare ✅
- [x] Create `shared/` and move the API client, safeFetch, phone, address and state list into it
- [x] Website uses `shared/` with no visible change; all checks pass
- [x] This roadmap
- Skipped on request: the two release blockers from the 27 Oct audit (demo logins see real clinic data; SMTP password in DB)

### Phase 1 — App foundation ✅
- [x] Expo SDK 58 app in `mobile/` with Expo Router (`src/app/`), using `shared/` (Metro `watchFolders` + tsconfig paths `@mediarca/shared`)
- [x] Platform adapter `mobile/src/lib/platform.ts`: server address (`EXPO_PUBLIC_API_URL`, default production), secure storage (`src/lib/storage.ts`, in-memory copy written through), "server waking up" banner
- [x] Turnstile bot check in a hidden web view (`src/lib/botCheck.tsx`) for sign-up and password reset
- [x] Design tokens (`src/theme`), building blocks (`src/components/ui.tsx`), MediArca app icon
- [x] Welcome, sign in (all 5 account types), create account (patient / doctor / clinic), email code, reset password, receptionist temporary-password change
- [x] Area per account type with a guard (`components/PortalGuard.tsx`); patient has tabs Home / Visits / Profile; other areas are placeholders until their phase
- To check on a real phone: sign-up bot check inside the web view, sign-in against the live server

### Phase 2 — Patient: find and book ✅
- [x] Home (`patient/index`, also `/find` for guests from Welcome → Browse doctors): search, Doctors / Clinics, specialty tiles, Filters sheet (state, city, experience, sort), endless list (`components/Discover.tsx`)
- [x] Doctor profile `doctors/[id]`: clinic choice, 90-day date strip (days off greyed), shifts with status, live token preview, About; booking blocked with the website's messages (closed, leave, day off, ended, full)
- [x] Clinic page `clinics/[id]`: photo (`avatarUrl`), address, call, its doctors with this clinic's fee
- [x] Booking `book/[id]`: myself / someone else, reason, symptoms; confirmation with receptionist name, fee and Call button. Guests are sent to sign-in and come back (`login?next=`)
- [x] Visits: upcoming / past, status, token, "Now serving", call the desk, cancel; quiet refresh 10s/15s/60s like the website (`lib/usePolling.ts`)
- [x] Profile: personal and health details, change password, delete account, sign out (`components/AccountSettings.tsx`, reusable for other roles)
- Reschedule is done by the receptionist or doctor (same as the website), so patients only cancel
- Rules live in `src/lib/booking.ts` (mirrors `DoctorDetail.tsx` / `BookAppointment.tsx`)

### Phase 3 — Patient: queue and check-in ✅
- [x] Live queue pass `visit/[id]` (`components/QueuePass.tsx`): token, now serving, ahead, wait, progress, delay notes, check-in / step out, desk call, cancel; quiet refresh 10s/15s/60s
- [x] Camera QR check-in `scan` (expo-camera, front-desk QR only, no codes to type); booking QR shows "Book here"; QR rules in `shared/src/utils/checkinQr.ts` (same as the website scanner)
- [x] Track walk-in `track` (mobile number + slip code, view only), from Welcome
- [x] Look refresh for all screens: borderless cards with soft shadows, filled fields, bigger buttons, new Welcome, filled tab icons

### Phase 4 — Notifications and Google sign-in
- [ ] "Your turn is near", called, confirmed alerts (Expo push; new table with RLS on)
- [ ] Google sign-in
- [ ] Switch from Expo Go to our own test build (APK)

### Phase 5 — Doctor
- [ ] Queue console: call next, hold, complete; cabin toggle; shifts and leave

### Phase 6 — Receptionist
- [ ] Walk-ins, arrival check-in, fee collection and token confirm, queue overview

### Phase 7 — Clinic
- [ ] Doctor onboarding, receptionist accounts, QR code download/share, metrics, profile

### Phase 8 — Admin (dropped)
- Admin stays on the website only (owner's decision, 1 Nov 2026)

### Phase 9 — Final check
- [ ] Compare app vs website feature by feature; fix gaps
- [ ] Full test on a real phone

## Not now
- Play Store / App Store release, iPhone build
- Admin portal in the app (website only)

## Trying the app
From `mobile/`: `npx expo start` and scan the QR code with Expo Go (phone on the same Wi-Fi; if it can't connect, `npx expo start --tunnel`).
The app talks to the live server by default. Browser preview: `npx expo start --web` (sign-in fails there because the server only allows the website's address).
Preview with sample doctors and clinics: launch config `mobile-web-demo` (sets `EXPO_PUBLIC_DEMO_FALLBACK=true`; development only, never in a real build).
Checks for app changes: `npm run typecheck`, `npm run lint`, `npx expo-doctor`, `npx expo export --platform android` (bundle builds).

## Log
- 2026-11-01 — Phase 0 done. `shared/` created; backend verify 2,208/2,208, backend build, frontend build, lint, frontend tests 31/31 all pass.
- 2026-11-01 — Phase 1 done. App type check, lint, expo-doctor 20/20, Android bundle build pass; screens checked in the browser preview. Website and backend checks still pass (2,208/2,208, builds, lint, 31/31).
- 2026-11-01 — Phase 2 done. Find, doctor and clinic pages, booking with call-to-pay, Visits, Profile. App type check, lint, expo-doctor 20/20, Android bundle pass; every screen clicked through in the phone-size preview with sample data (live server blocks this computer). Website lint, build, tests 31/31 pass.
- 2026-11-01 — Phase 3 done + UI refresh. Queue pass, camera QR check-in, Track walk-in; Admin removed from the app. App type check, lint, expo-doctor 20/20, Android bundle pass; screens checked at phone size with sample data. Website lint, build, tests 31/31 pass.
