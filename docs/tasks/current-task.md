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

- [x] **Alignment & Automated Gates**:
  - [x] Update `PROJECT.md` to reflect current state and completed milestones.
  - [x] Backend verification suite: `npm run test:verify` (2,020 / 2,020 tests PASS).
  - [x] Backend compilation: `npm run build` (tsc PASS).
  - [x] Frontend lint: `npm run lint` (0 errors PASS).
  - [x] Frontend build: `npm run build` (Vite PASS).
