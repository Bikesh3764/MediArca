# Current Task: MediArca Specification Alignment & Agent Memory System

## Task Overview
Reconcile MediArca feature specifications with active codebase reality, document the pay-to-receptionist coordination architecture, establish the complete hierarchical Agent Memory system, and verify all automated fullstack quality gates.

---

## Checklist & Execution Status

- [x] **Receptionist Payment & Contact Flow**:
  - [x] Document zero-upfront payment policy and pay-to-receptionist coordination.
  - [x] Expose receptionist contact info (full name, direct phone number) on booking confirmation and live queue tickets.
  - [x] Enable patients to call receptionist directly to coordinate online payment (UPI) or pay at the desk.
  - [x] Ensure desk contact accessibility is available for confirmed waiting tickets.

- [x] **Feature Specification Pruning**:
  - [x] Rewrite `MediArca_Feature_Specification.md` to eliminate bloated/deprecated features (telemedicine video calls, digital prescription builder, medical records vault, pharmacy/lab integrations).
  - [x] Accurately document the 5 active portals: Patient Portal, Doctor Console, Clinic Portal, Receptionist Desk, Admin Center.

- [x] **Agent Memory & Documentation Structure**:
  - [x] Root `AGENTS.md` (core charter, strict DOs & DON'Ts, commands, file map).
  - [x] `docs/architecture.md` (React 19, Express 5, Prisma 6 PostgreSQL, JWT auth, queue state machine).
  - [x] Architecture Decision Records (`docs/decisions/`):
    - [x] `001-pay-to-receptionist-coordination.md`
    - [x] `002-role-scoped-account-uniqueness.md`
    - [x] `003-queue-atomic-transactions.md`
    - [x] `004-currency-localization-inr.md`
    - [x] `005-api-resilience-and-caching.md`
  - [x] `docs/known-issues.md` (FIX-001..FIX-023 ledger, ARCH/FUNC audit invariants, edge cases, anti-patterns).
  - [x] `docs/tasks/current-task.md` (this file).
  - [x] `backend/AGENTS.md` (scoped backend rules).
  - [x] `frontend/AGENTS.md` (scoped frontend rules).

- [x] **Fix 24: Clinic Profile Settings & Facility Logo Management**:
  - [x] Create dedicated Clinic Settings & Profile page (`frontend/src/pages/Clinic/ClinicProfile.tsx`) with Apple HIG design language.
  - [x] Enable clinic photo / exterior / logo upload with interactive frame crop (`AvatarCropModal`), auto-compression (`optimizeAvatarImage`), and backend R2/disk storage.
  - [x] Synchronize clinic facility name, address, state, city, and +91 Indian contact phone via atomic transaction (`updateClinicProfile`).
  - [x] Expose `avatarUrl`, `email`, and `fullName` on `getMyClinic` endpoint and public clinic directories.
  - [x] Update `DashboardLayout` user capsule card to render live avatar with initial fallback and direct profile linking.
  - [x] Integrate Clinic Settings into `ClinicDashboard` sidebar navigation (`navItems`), dashboard header actions, and register route `/clinic/profile` in `App.tsx`.

- [x] **Fix 25: Doctor Working Days Selection & Absence/Leave Management**:
  - [x] Add `workingDays` and `leaves` to `DoctorProfile` and `ClinicDoctor` Prisma schema with migration.
  - [x] Implement schedule and absence utilities (`scheduleUtils.ts`) with date arithmetic, IST day-of-week parsing, and leave duration evaluation.
  - [x] Implement backend controllers & endpoints for getting schedule config, updating working days, adding leaves (Today / Date Range), and cancelling leaves with receptionist clinic-scoped access guards.
  - [x] Gate slot availability and booking transactions (`bookAppointment`, `bookWalkin`) against doctor working days and active leaves.
  - [x] Create reusable Apple HIG `DoctorScheduleLeaveModal` supporting Mon-Sun weekday pills, presets, today toggle, date-range form, and active leaves list.
  - [x] Integrate schedule and leave management into Receptionist Desk (`ReceptionistDashboard` practitioner cards, walk-in warnings, queue alerts, and modal).
  - [x] Integrate schedule and leave management into Doctor Portal (`ManageSchedule` weekly practice days selector, leaves card, modal, and `DoctorDashboard` clinic cards & queue alert).

- [x] **Fix 26: Touchless Camera QR Check-In & Dynamic Clinic Discovery Branding**:
  - [x] Remove manual 6-digit code entry tab and input form from `CameraQrScannerModal.tsx`; configure as pure camera QR viewfinder.
  - [x] Strip printed desk code from `ClinicQrStandeeModal.tsx` to maintain a clean physical counter poster without confusing numbers.
  - [x] Remove "QR Check-in Code" and technical "Facility Identifier" database ID cards from `ClinicProfile.tsx`; add accreditation status and direct standee modal print action.
  - [x] Dynamically render uploaded clinic logo/photo (`avatarUrl`) with `clinicLobbyBg` fallback across Home page clinic catalog (`Home.tsx`) and Doctor/Clinic Discovery (`DoctorDiscovery.tsx`).
  - [x] Add clinic photo thumbnail to selected clinic headers on both Home and Discovery pages.
  - [x] Update all engineering charters, specifications, architecture docs, and known-issue ledgers.

- [x] **Fix 27: Apple HIG Weekday Controls & Copy Minimalism Protocol**:
  - [x] Replace cluttered rectangular bootstrap-style weekday tags (`[Mon] [Tue] [Wed]`) with reusable Apple HIG `WeekdayDisplay.tsx` component.
  - [x] Render calendar and roster weekdays as single-letter Apple circular discs (`M T W T F S S`) inside a parchment pill track, highlighting active days in solid ink `#1d1d1f` and current day with an Action Blue focus ring.
  - [x] Redesign interactive weekday selector in `DoctorScheduleLeaveModal.tsx` and `ManageSchedule.tsx` using Apple `rounded-full` pill buttons (`h-11 rounded-full`), eliminating stacked redundant text ("Mon/Monday", "Sits/Off").
  - [x] Streamline copy across Doctor and Receptionist portals to be ultra-concise: `Shifts`, `Schedule`, `Standee`, `Resume`, `Leave`, `Available`.
  - [x] Update all engineering charters (`AGENTS.md`, `DESIGN.md`, `PROJECT.md`, `docs/`) with Apple HIG Weekday specifications and strict copy conciseness rules.

- [x] **Alignment & Automated Gates**:
  - [x] Update `PROJECT.md` to reflect current state and completed milestones.
  - [x] Backend verification suite passes with 0 failures (`npm run test:verify` -> 2,023/2,023 PASS).
  - [x] Backend compiles clean (`npm run build`).
  - [x] Frontend linter clean with 0 errors (`npm run lint`).
  - [x] Frontend compiles and builds production bundle (`npm run build`).
  - [x] Backend verification suite: `npm run test:verify` (2,023 / 2,023 tests PASS).
  - [x] Backend compilation: `npm run build` (tsc PASS).
  - [x] Frontend lint: `npm run lint` (0 errors PASS).
  - [x] Frontend build: `npm run build` (Vite PASS).
