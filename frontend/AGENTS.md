# MediArca Frontend — Scoped Agent Rules

## 1. Frontend Charter & Technologies
The MediArca frontend is an ultra-fast, mobile-first web application built with React 19, TypeScript, Vite, and Tailwind CSS, adhering strictly to the Apple Human Interface Guidelines documented in `DESIGN.md`.

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Design System**: Apple HIG (`DESIGN.md`)
- **Key Modules**:
  - `src/components/queue/LiveQueueTicket.tsx` — Real-time queue pass, cabin presence sync, and receptionist contact card.
  - `src/pages/Patient/` — Doctor discovery, profile, and appointment booking with receptionist coordination.
  - `src/pages/Doctor/` — Doctor dashboard, queue console, consultation view, and shift schedule management.
  - `src/pages/Clinic/` — Clinic dashboard, clinic profile & facility settings, doctor onboarding, and receptionist provisioning.
  - `src/pages/Receptionist/` — Desk dashboard, walk-in creation, check-in, and fee collection.
  - `src/pages/Admin/` — Admin verification dashboard and platform statistics.
  - `src/services/api.ts` — HTTP client with caching, error normalization, and non-JSON body resilience.

---

## 2. Strict Frontend Invariants

1. **Apple HIG Design System Consistency (`DESIGN.md`)**:
   - **Primary Action Blue**: `#0066cc` (hover `#0071e3`, active `active:scale-[0.98]`). Never use `#0088e8`, `#2563eb`, or random shades of blue.
   - **Backgrounds**: Canvas `#f5f5f7`, cards pure white `#ffffff`.
   - **Borders**: `#e5e5ea` (subtle separation) or `#d2d2d7` (inputs).
   - **Typography**: `#1d1d1f` (primary headings/text), `#86868b` (labels/subtitles).
   - **Geometry**: `rounded-2xl` for content cards, `rounded-full` for action buttons, badges, and filter pills.
2. **Receptionist Payment & Contact Accessibility**:
   - Live queue tickets and booking confirmation screens MUST display the receptionist's name and direct contact phone number.
   - Always provide a direct phone link (`tel:+91...`) so patients can call the receptionist to coordinate payment (UPI over call) or ask queue questions.
3. **Currency Invariant**:
   - Always display fees in Indian Rupee (`₹`). Never use `$`.
4. **Phone Formatting**:
   - Render static `+91` country code badges for mobile number inputs. Validate for exactly 10 Indian digits starting with 6-9. Phone numbers are required on signup, but OTP verification is strictly via Email (`EmailVerificationModal`). No phone OTP or phone uniqueness checks are imposed.
5. **API Response Resilience**:
   - `frontend/src/services/api.ts` must inspect `Content-Type` before calling `.json()` to gracefully handle reverse proxy HTML errors (502 Bad Gateway / 504 Gateway Timeout) without throwing unhandled `SyntaxError`.
6. **Linter & Build Hygiene**:
   - Maintain 0 errors on `npm run lint`.
   - Avoid synchronous `setState` calls inside `useEffect` that trigger cascading renders or compiler bailouts.
   - Use React Router `<Link>` or `useNavigate()` instead of raw hash anchor tags (`<a href="#...">`).
7. **Physical QR Scanner Only (No Manual Code Entry)**:
   - Patient arrival verification is strictly camera-driven (`CameraQrScannerModal`).
   - Do NOT offer manual numeric code entry or display printed desk codes on standees.
   - Do NOT expose internal technical database IDs (e.g. `cp_demo_clinic`, raw UUIDs) in user-facing settings.
8. **Dynamic Facility Photography & Logo Support**:
   - Discovery cards, clinic profiles, and headers MUST dynamically render the clinic's uploaded `avatarUrl` (using `getFileUrl(clinic.avatarUrl)`) with `clinicLobbyBg` as fallback.
   - Never hardcode stock images when facility branding is available in the profile payload.
9. **Apple HIG Weekdays & Minimalist Copy**:
   - Render calendar and roster weekdays using single-letter Apple circular discs (`M T W T F S S`) inside a parchment pill track (`WeekdayDisplay.tsx`), with active days in solid ink `#1d1d1f` and the current day highlighted with an Action Blue ring.
   - Use Apple `rounded-full` pill buttons (`h-11 rounded-full`) for interactive weekday selectors.
   - Keep all UI copy, button labels, and status badges direct, simple, and minimal (e.g. `Shifts`, `Schedule`, `Standee`, `Resume`, `Leave`, `Available`). Eliminate wordy sentences, redundant explanations, and dual-verb labels.

10. **Live Refresh, Not Faster Polling**:
   To react to queue changes use `useLiveEvent('queue', handler)` from `utils/liveEvents.ts` alongside the existing `useVisibilityPolling` backup. Never shorten polling intervals to get "real-time" behaviour.
12. **Design Tokens & Consistency (FIX-040)**:
   - Status colors use Tailwind tokens, never raw hex: `text-success`/`bg-success-soft`/`border-success-line`/`bg-success-dot` (same for `danger`, `warning`; `primary` for blue).
   - No `shadow-*` on cards, buttons or inputs. Floating layers (dropdowns, popovers, toasts, sticky bars) may use `shadow-[0_12px_32px_rgba(0,0,0,0.12)]`.
   - Font weights: `font-normal` (400) and `font-semibold` (600) only. No `font-medium`, no `font-bold`.
   - `text-xs` is 13px (tailwind.config). Nothing smaller than `text-[11px]`.
   - Cards `rounded-2xl` (18px), inner elements `rounded-xl`, buttons and chips `rounded-full`.
   - The global nav stays white and frosted (brand decision); don't change it to black.
   - Page titles use `SubNav` with a `width` matching the page content; portals use `DashboardLayout` (including Admin).
   - On phones, tap targets should be at least 36px tall and nothing may overflow the screen width; check at 390px.
   - Action buttons are blue (`#0066cc`) or white with a hairline border. Only destructive confirms (Delete, Cancel appointment) may be red. Green/orange are for status dots and chips, never buttons (FIX-043).
13. **Shared Display Helpers (FIX-043)**:
   - Dates: `formatDisplayDate(yyyy-mm-dd)` from `services/api` ("Today", "Tomorrow", "Tue, 27 Oct"). Never print raw ISO dates or call `toLocaleDateString()` without `'en-IN'`.
   - Addresses: `formatClinicAddress(clinic)` from `utils/address.ts` (skips city/state already in the address).
   - Profile photos: `<AvatarImage>` from `components/ui/AvatarImage.tsx` (falls back to the initial).
   - Shift names: `cleanSlotName` keeps the doctor's own name ("Morning Shift"); don't strip it to "Shift 1".
   - Words: say Doctor, Clinic, Join, Remove, Receptionist, Appointments — not Practitioner, Facility, Affiliate, Detach, Provision, Console, Passes.
11. **Typography**:
   Do not load SF Pro from third-party CDNs (licence + render blocking). Apple devices get SF Pro via `-apple-system`; others use Inter.

---

## 3. Verification & Build Commands

```bash
# Run Biome / ESLint quality checks (must pass with 0 errors)
npm run lint

# Unit tests (Vitest)
npm test

# Compile TypeScript and create production bundle with Vite
npm run build
```
