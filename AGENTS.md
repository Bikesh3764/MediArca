# MediArca — Agent Memory & Engineering Charter

## 1. System Charter & Core Philosophy

MediArca is an Indian healthcare outpatient appointment and live queue management system built to eliminate waiting room friction in physical clinics.

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Apple Human Interface Guidelines (`DESIGN.md`).
- **Backend**: Node.js, Express 5, TypeScript, Prisma ORM 6, PostgreSQL.
- **Authentication**: JWT authentication with role-scoped accounts (`@@unique([email, role])`), OTP email verification, and temporary password enforcement for receptionists.
- **Portals**:
  1. `PATIENT` — Doctor/clinic discovery, booking with estimated token, live queue pass with receptionist contact, QR check-in.
  2. `DOCTOR` — Real-time queue console, atomic patient calling, cabin presence toggles, shift management.
  3. `CLINIC` — Doctor onboarding, receptionist provisioning, QR code download, operational metrics.
  4. `RECEPTIONIST` — Walk-in creation, arrival check-in, fee collection & token confirmation, queue oversight.
  5. `ADMIN` — Verification queue for doctors and clinics, platform telemetry, support messages.

---

## 2. Inviolable Engineering Rules (DOs & DON'Ts)

### Strict DOs
1. **Always Verify All Gates**: Run and verify all 4 quality gates before reporting completion:
   - Backend verification suite: `npm run test:verify` (in `backend/`)
   - Backend TypeScript build: `npm run build` (in `backend/`)
   - Frontend TypeScript & Vite build: `npm run build` (in `frontend/`)
   - Frontend Biome/ESLint linter: `npm run lint` (in `frontend/`)
   - Plus, when a PostgreSQL database is available: `npm run test:flow` (in `backend/`) and `npm test` (in `frontend/`)
2. **Always Use Atomic Transactions**: Any queue status mutation (`callPatient`, `holdConsultation`, `completeConsultation`, `approveAppointment`, `rescheduleAppointment`) MUST be wrapped in a `prisma.$transaction` to prevent race conditions.
3. **Single Active Consultation Invariant**: A doctor can have at most ONE appointment in `IN_CONSULTATION` status across all clinics at any given time.
4. **Receptionist Contact & Coordination**: Always expose receptionist contact information (name and phone number) on booking confirmation and live queue tickets so patients can call directly to coordinate payment (UPI over call) or pay in-person.
5. **Localization Invariants**:
   - Currency MUST always be Indian Rupee (`₹`). Never use `$`.
   - Phone numbers MUST always be validated and formatted using the Indian standard (`+91` 10-digit).
   - Time calculations MUST respect Indian Standard Time (IST / Asia/Kolkata).
6. **Design Language**: Follow the Apple HIG system documented in `DESIGN.md`:
   - Primary Action Blue: `#0066cc` (hover `#0071e3`, active scale `0.98`)
   - Neutral backgrounds: `#f5f5f7` (subtle page canvas), pure white `#ffffff` cards
   - Borders: `#e5e5ea` or `#d2d2d7`
   - Typography: `#1d1d1f` primary text, `#86868b` secondary text
   - Corner radius: `rounded-2xl` (cards), `rounded-full` (buttons & pills)
7. **API Resilience**: Handle non-JSON responses (e.g. 502 Bad Gateway / 504 Gateway Timeout HTML pages) gracefully in `frontend/src/services/api.ts` without throwing unhandled `SyntaxError`.
8. **Physical QR Arrival Scanner Only**: Patient arrival verification at the clinic is strictly performed by scanning the physical front-desk QR code using the device camera. Always dynamically render uploaded facility branding (`avatarUrl`) across public discovery and headers.
9. **Apple HIG Weekdays & Ultra-Concise Copy**: Display calendar and roster weekdays using single-letter Apple circular discs (`M T W T F S S`) inside a parchment pill track (`WeekdayDisplay.tsx`). Use Apple `rounded-full` pill buttons (`h-11 rounded-full`) for interactive day selectors. Keep all UI text and button labels minimal, simple, and direct (e.g. `Shifts`, `Schedule`, `QR Code`, `Resume`, `Leave`, `Available`).
10. **Email-Only Account Uniqueness & Verification**: Account uniqueness is strictly enforced on `(email, role)` via `@@unique([email, role])`. Mobile number uniqueness is NOT required or enforced, permitting shared phone numbers for family members and dependents. OTP verification is performed exclusively via Email (Gmail SMTP with 6-digit numeric OTP). Phone numbers are collected and validated for the Indian standard (`+91` 10-digit mobile), but require no phone OTP or phone verification.
11. **Silent Background Updates & Zero Disruptive Polling Screens**: Background real-time polling (`useVisibilityPolling`) MUST update state silently in-place without triggering full-screen loading spinners, clearing table rosters, or flashing "Loading live queue..." banners. Loading screens are reserved strictly for the initial empty mount.
12. **Supabase Public API Stays Closed**: Row-level security is on for every table; new tables must enable it in their migration (see FIX-030).

### Strict DON'Ts
1. **NO Online Payment Gateways**: NEVER introduce Stripe, Razorpay, PayPal, or automated upfront credit/debit card checkout. MediArca operates under a zero-upfront payment policy where patients coordinate payment directly with the receptionist.
2. **NO Telemedicine / Video Consultations**: MediArca is exclusively for physical in-person clinic visits.
3. **NO Digital Prescription Builders**: Do not bloat the system with prescription drafting engines; physical scripts are provided at the clinic.
4. **NO Cloud Medical Document Vault**: Do not create file upload vaults for medical records.
5. **NO Test Weakening**: NEVER comment out, delete, or weaken test assertions in `backend/scripts/verify-fixes.ts` to make a test pass.
6. **NO Cross-Clinic Shift Overlaps**: Doctors cannot have conflicting shift windows across different clinics on the same day.
7. **NO Bypassing State Machine**: Never transition appointment statuses without verifying `canTransition(currentStatus, targetStatus)`.
8. **NO Manual Check-in Code Entry or Internal ID Exposure**: Do not present users with manual numeric 6-digit code entry options, printed desk codes on physical posters, or raw internal database IDs (`cp_demo_clinic`, internal UUIDs). Queue arrival is strictly camera-scanned.
9. **NO Cluttered Weekday Badges or Verbose UI Copy**: Never use clunky rectangular bootstrap-like badge tags (`[Mon] [Tue] [Wed]`), stacked labels ("Mon/Monday", "Sits/Off"), or wordy dual-action descriptions and boilerplate sentences. Keep all copy clean, direct, and minimal.
10. **NO Mobile Uniqueness or Phone OTP Verification**: Never block accounts from registering or updating due to existing phone numbers, and never introduce phone/SMS OTP verification. Uniqueness is strictly email-based (`@@unique([email, role])`) and OTP verification is strictly on email.
11. **NO Polling Loading Flickers**: Never unmount or replace existing active queues, appointments, or dashboard tables with full loading placeholders or pulsing skeleton blocks during periodic background polling.

---

## 3. Standard Verification & Build Commands

```bash
# 1. Backend Verification Suite (2,023+ tests covering concurrency, state machine, auth, guards)
cd backend && npm run test:verify

# 2. Backend TypeScript Compilation
cd backend && npm run build

# 3. Frontend Quality Linter (Biome / ESLint)
cd frontend && npm run lint

# 4. Frontend Production Build (Vite & tsc)
cd frontend && npm run build
```

---

## 4. Repository File Map

```
MediArca/
├── AGENTS.md                          # Root engineering charter and rules (this file)
├── PROJECT.md                         # Active project context, milestones, and contracts
├── DESIGN.md                          # Apple HIG design tokens, colors, typography, layout
├── MediArca_Feature_Specification.md  # Pruned product specification matching exact code scope
│
├── docs/                              # Architecture and institutional memory
│   ├── architecture.md                # System design, data flow, queue state machine
│   ├── known-issues.md                # Fix ledger (FIX-001..FIX-029), active edge cases, anti-patterns
│   ├── decisions/                     # Architecture Decision Records (ADRs)
│   │   ├── 001-pay-to-receptionist-coordination.md
│   │   ├── 002-role-scoped-account-uniqueness.md
│   │   ├── 003-queue-atomic-transactions.md
│   │   ├── 004-currency-localization-inr.md
│   │   └── 005-api-resilience-and-caching.md
│   └── tasks/
│       └── current-task.md            # Active sprint checklist and test execution log
│
├── backend/                           # Express 5 + Prisma 6 + TypeScript Backend
│   ├── AGENTS.md                      # Scoped backend engineering rules
│   ├── prisma/
│   │   └── schema.prisma              # Database schema (PostgreSQL)
│   ├── src/
│   │   ├── server.ts                  # HTTP server, process handlers, CORS, rate limits
│   │   ├── controllers/               # Route controllers (appointment, consultation, receptionist, etc.)
│   │   ├── middleware/                # Auth, role guards, cache, uploads
│   │   ├── routes/                    # API route definitions
│   │   └── utils/                     # Queue state machine, schedule utils, phone utils, auth guards
│   └── scripts/
│       └── verify-fixes.ts            # Master automated verification suite (2,023+ tests)
│
└── frontend/                          # React 19 + Vite + Tailwind CSS Frontend
    ├── AGENTS.md                      # Scoped frontend engineering rules
    └── src/
        ├── App.tsx                    # Route definitions and portal guards
        ├── components/
        │   ├── common/                # Reusable Apple HIG UI components, modals, filters
        │   ├── layout/                # GlobalNav, SubNav, DashboardLayout, Footer, MobileTabBar
        │   └── queue/                 # LiveQueueTicket, CabinStatusBadge, QueueDisplay
        ├── context/                   # AuthContext (multi-portal token management)
        ├── pages/                     # Portal pages (Patient, Doctor, Clinic, Receptionist, Admin)
        ├── services/                  # api.ts (HTTP client with caching and error normalization)
        └── utils/                     # Phone utils, date/time calculations, lazy loading
```
