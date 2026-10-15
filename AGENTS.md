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
  3. `CLINIC` — Doctor onboarding, receptionist provisioning, QR standee download, operational metrics.
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

### Strict DON'Ts
1. **NO Online Payment Gateways**: NEVER introduce Stripe, Razorpay, PayPal, or automated upfront credit/debit card checkout. MediArca operates under a zero-upfront payment policy where patients coordinate payment directly with the receptionist.
2. **NO Telemedicine / Video Consultations**: MediArca is exclusively for physical in-person clinic visits.
3. **NO Digital Prescription Builders**: Do not bloat the system with prescription drafting engines; physical scripts are provided at the clinic.
4. **NO Cloud Medical Document Vault**: Do not create file upload vaults for medical records.
5. **NO Test Weakening**: NEVER comment out, delete, or weaken test assertions in `backend/scripts/verify-fixes.ts` to make a test pass.
6. **NO Cross-Clinic Shift Overlaps**: Doctors cannot have conflicting shift windows across different clinics on the same day.
7. **NO Bypassing State Machine**: Never transition appointment statuses without verifying `canTransition(currentStatus, targetStatus)`.

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
│   ├── known-issues.md                # Fix ledger (FIX-001..FIX-024), active edge cases, anti-patterns
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
