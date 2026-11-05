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

### Phase 4 — Notifications and Google sign-in (code done; needs the owner's account steps below)
- [x] Phone alerts: every in-app notification is also pushed (Expo push). New "You're next" alert when the patient ahead is called. Table `PushToken` (RLS on); `POST/DELETE /api/notifications/push-token`; `backend/src/services/pushService.ts`; app `src/lib/push.ts`. Tapping an alert opens that visit.
- [x] Google sign-in (Patient, Doctor, Clinic) on Sign in and Create account: `src/lib/google.ts`, `components/GoogleButton.tsx`. Same server check as the website.
- [x] Test build setup: `mobile/eas.json` (profile `preview` = APK)
- [x] Owner steps (one time), then build the APK — all done; the APK works on the owner's phone (Expo project `bikesh_1435`, Firebase project `mediarca-3`, `google-services.json` committed so the cloud build can see it):
  1. Make a free account at expo.dev. In `mobile/`: `npx eas-cli@latest login`, then `npx eas-cli@latest init` (adds the project ID to `app.json`).
  2. Firebase console → new project → add Android app `in.mediarca.app` → download `google-services.json` into `mobile/`, and add `"googleServicesFile": "./google-services.json"` under `android` in `app.json`. Then `npx eas-cli@latest credentials` → Android → upload the FCM V1 service account key (Firebase → Project settings → Service accounts → Generate key).
  3. Google Cloud console (project of the website's Google sign-in client) → Credentials → Create OAuth client → Android, package `in.mediarca.app`, SHA-1 from `npx eas-cli@latest credentials` (Android → Keystore).
  4. Build: `npx eas-cli@latest build -p android --profile preview` → open the link on the phone and install the APK.
- Push and Google sign-in don't run in Expo Go or the browser preview (the Google button is hidden there); everything else still does.

### Phase 5 — Doctor ✅
- [x] Queue (`app/doctor/index.tsx`): cabin switch (In cabin / Stepped out with 15m–1h / Away), Today / Tomorrow / Upcoming, clinic filter, patient in cabin with Complete and Hold, Mark arrived, Start consultation (arrived patients only), Move to another day, Cancel
- [x] Walk-in (`app/walkin.tsx`) with next token, time and tracking code; Share slip
- [x] Shifts (`app/doctor/shifts.tsx`): per clinic — on leave today, planned leave (add/remove), working days (M T W T F S S), shifts (times, max patients, mins per patient), fee in ₹
- [x] Account: password, sign out, delete account
- Website only for now: joining/leaving clinics, profile photo and details, clinic QR

### Phase 6 — Receptionist ✅
- [x] Queue (`app/receptionist/index.tsx`): Doctor card with cabin pill (switch doctor always offered), Today / Tomorrow, in cabin with Complete and Hold, Waiting and Done lists, Mark arrived, Start consultation, Move, Cancel, call the patient
- [x] Walk-in (`app/receptionist/walkin.tsx`): doctor, day, shift with next token and time, Self / Family, name, +91 mobile, age, gender; token pass with tracking code and Share slip
- [x] Requests (`app/receptionist/requests.tsx`, badge on the tab): fee in ₹, call the patient, Mark paid (confirms the token), Change date, Decline
- [x] Account: password, sign out
- Shared parts: `components/QueueRow`, `InCabinCard`, `CabinControl`, `ShiftChips`, `CodeCard`, `DoctorBar`, `MoveSheet`, `WalkinForm`, `ActionMenu`, `DayPills`, `tabs`; desk data in `context/DeskContext.tsx`; display rules in `shared/src/utils/queueDisplay.ts`
- Doctors tab, notifications and QR print were added later (see Extras)

### Phase 7 — Clinic ✅
- [x] Home (`app/clinic/index.tsx`): verification notices, "Add location", Doctors / Bookings / Revenue (₹), recent bookings
- [x] Doctors (`app/clinic/doctors.tsx`, badge = join requests): Accept / Decline requests, invites sent with Cancel, doctor list (fee, bookings, revenue), Call, Remove; Invite by email or pick a verified doctor
- [x] Staff (`app/clinic/staff.tsx`): add receptionist (+91 mobile, temporary password, doctors) then Share login; change their doctors; Remove; call
- [x] QR Code (`app/clinic/qr.tsx`): Check-in and Booking QR drawn on the phone (`components/QrCode.tsx`, `qrcode` encoder only); Share image (`react-native-view-shot` + `expo-sharing`), Share link for booking. Links in `src/lib/site.ts`
- [x] Account (`app/clinic/account.tsx`): clinic details (name, address, state, city, phone) via `components/ClinicDetailsSheet.tsx`, password, sign out, delete account
- Clinic data in `context/ClinicContext.tsx` (refreshes every 30s)
- Reports, clinic photo and QR print were added later (see Extras)

### Extras ✅ (after Phase 7)
- [x] Notifications list (`app/notifications.tsx`, `context/NotificationContext.tsx`, `components/NotificationBell.tsx`): bell with red count on every home screen; read after 1.2s on screen; tap opens the right tab; refreshes every 30s
- [x] Photo upload (`components/PhotoPicker.tsx`): doctor and clinic, same as the website (patients and front desk have none there either). Pick, crop square, shrink to 600px JPEG, upload; Remove photo. Stored on R2 like the website
- [x] Reports (`components/ReportSheet.tsx`): clinic Home, doctor and desk Account. 7 days / 30 days / 3 months, filter by doctor or clinic, Share PDF and Print (`src/lib/print.ts`, `expo-print`). PDF uses full dates, never "Today"
- [x] QR print (`app/clinic/qr.tsx`): A4 poster with clinic name, QR, one line, MediArca; QR as SVG via `qrSvg()`. No code printed as text
- [x] Doctors join clinics (`app/doctor/clinics.tsx`, new Clinics tab): requests from clinics (Accept / Decline), waiting requests, my clinics (fee, bookings, revenue, Leave clinic), Join a clinic by search
- [x] Front desk leave (`app/receptionist/doctors.tsx`, new Doctors tab): Available / Day off / On leave, leave-today switch, working days and planned leave per doctor. Shared pieces in `components/LeaveTools.tsx` (also used by the doctor's Shifts)

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
- 2026-11-01 — Phase 4 code done. Push alerts (new `PushToken` table, RLS on), "You're next" alert, Google sign-in, APK build profile. Backend verify 2,217/2,217 (FIX-065), backend build; app type check, lint, expo-doctor 20/20, Android bundle; website lint, build, tests 31/31. Not tested on a phone yet (needs the owner steps).
- 2026-11-01 — Phases 5 and 6 done. Doctor and front desk screens. App type check, lint, expo-doctor 20/20, Android bundle; every screen clicked through at phone size with sample data. Backend verify 2,217/2,217, backend build; website lint, build, tests 31/31.
- 2026-11-01 — Phase 7 done. Clinic screens: Home, Doctors, Staff, QR Code, Account. App type check, lint, expo-doctor 20/20, Android bundle; every tab clicked through at phone size with sample data. Backend verify 2,217/2,217, backend build; website lint, build, tests 31/31.
- 2026-11-01 — Extras done: notifications list, doctor and clinic photo, reports with PDF and print, QR print, doctors join clinics, front desk leave. App type check, lint, expo-doctor 20/20, Android bundle; each feature clicked through at phone size with sample data. Backend verify 2,217/2,217, backend build; website lint, build, tests 31/31. Not tried on a real phone yet.
- 2026-11-01 — UI polish: Apple-style slide between screens on Android, soft shift between tabs with a tap feel, screens ease in on first open, pulsing Live dot on the queue pass, same-size round header buttons, code boxes match other fields, stray colours moved to `src/theme`. Font: Apple system font on iPhone, Inter (400 and 600) on Android and web, through `components/AppText.tsx`; Account pages use settings rows (`ListGroup`/`ListRow` in kit), today's date above home titles, status dots on the cabin switch, clinic Home with stat icons, tidier walk-in shift list, visit cards without repeated status, birth-date pickers fit — import `Text`/`TextInput` from there, not from react-native. App type check, lint, Android bundle pass.
- 2026-11-01 — Phone feedback fixes: camera permission added to `app.json` (Android never showed the Allow popup) and the scanner asks on open; "See more" on clinic addresses (`components/MoreText.tsx`); symptoms box sized right; new Stepped out card; doctors edit their profile in the app (`components/DoctorProfileSheet.tsx`); reports get Today, shift and status filters and Excel export (`src/lib/excel.ts`, real .xlsx, no extra library; uses `expo-file-system`). App type check, lint, Android bundle pass; checked at phone size in the browser preview.
- 2026-11-01 — Report custom From–To dates (`components/RangeCalendar.tsx`, up to 90 days back), centred staff chips on Welcome, animations (`src/lib/motion.tsx`: sliding Segmented thumb, spring press, fade-ins), polls skip redraws when nothing changed (`keepIfSame`). Then FIX-066: shift timings instead of "Shift 1" everywhere (server adds `shiftTime`), walk-in code on queue rows, errors hide on their own, no Self/Family on walk-in.
- 2026-11-05 — FIX-071: "Call in" replaced by Start consultation on arrived patients (doctor and front desk, website and app); app doctor's big "Call #N" button removed. App type check and lint pass; checked at 375 and 360 px in the browser preview. App not built (owner asked to wait). Backend verify 2,240/2,240, backend build; website lint, build, tests 31/31.
- 2026-11-05 — Front desk gets Hold on the In cabin card (website and app), same as the doctor. Website tested locally; app type check and lint pass. Backend verify 2,240/2,240.
- 2026-11-05 — FIX-072: booking has no Reason/Symptoms and Age is optional; blood group removed from the profile. Booking screen checked at phone size; app type check and lint pass.
- 2026-11-05 — FIX-073: profile has no date of birth; walk-in form has no Reason and Age is optional. Profile checked at phone size; app type check and lint pass.
- 2026-11-05 — FIX-074: emergency contact removed. Checked by page text and size at 375 px (pane was hidden, no screenshot). App type check and lint pass.
- 2026-11-05 — FIX-075 app clean-up: `DoctorBar` + `CabinPill` on queues and walk-in, rows without reason/shift/code (code in ⋯), shift headings only when needed, Shifts screen with one-line shifts, visit pass shows the live queue. Every portal clicked through at 375 px with screenshots. App type check and lint pass.
- 2026-11-05 — FIX-076: cabin slider back (`CabinControl`), shift chips on doctor and desk queues, ⋯ → Show code instead of print slips, no "Family" label. Checked at 375 px.
