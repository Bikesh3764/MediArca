# Project: MediArca Fullstack Defect Remediation & Platform Hardening

## Architecture
MediArca is an Indian healthcare patient appointment and live queue management system built on:
- **Backend**: Node.js, Express 5, TypeScript, Prisma ORM 6 (PostgreSQL), JWT authentication, role-based access control.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, Apple Human Interface Guidelines (`DESIGN.md`).
- **Database**: PostgreSQL (Prisma schema with 12 models: `User`, `DoctorProfile`, `PatientProfile`, `ClinicProfile`, `ReceptionistProfile`, `ClinicDoctor`, `DoctorReceptionist`, `Appointment`, `Review`, `Notification`, `SystemConfig`, `ContactMessage`).
- **Core Guardrails**: Zero-upfront payment (pay-to-receptionist coordination via UPI/desk), physical clinic queue focus (no telemedicine / no prescription builder / no cloud vault), demo credentials preserved, +91 Indian phone standard lock, per-portal role-scoped account uniqueness (`@@unique([email, role])`).

## Feature Inventory
| # | Feature / Area | Description | Milestone | Source |
|---|----------------|-------------|-----------|--------|
| 1 | Database Connection & Seed Setup | Reconcile PostgreSQL connection URL in `backend/.env` with Prisma schema | M1 | Survey Obs 3 & 6 |
| 2 | Queue Consultation Concurrency | Wrap `callPatient` and queue updates in atomic transactions to guarantee single active consultation | M1 | Survey Obs 6 |
| 3 | Process Runtime Resilience | Add top-level `unhandledRejection` and `uncaughtException` process handlers in `server.ts` | M1 | Survey Obs 7 |
| 4 | CORS Error Classification | Ensure CORS rejection responds with HTTP 403 Forbidden rather than generic 500 | M1 | Survey Obs 8 |
| 5 | Receptionist Reschedule Flow | Prevent unapproved `PENDING_APPROVAL` appointments from auto-escalating to `WAITING` during reschedule | M1 | Survey Obs 5 |
| 6 | Admin Currency Symbol | Fix dollar sign `$` to Indian Rupee `₹` for doctor consultation fees in `AdminDashboard.tsx` | M2 | Survey Obs 2 |
| 7 | Live Queue Ticket Cabin Presence | Sync `presenceOverride` with `appointment.doctor?.cabinStatus` on polling updates | M2 | Survey Obs 3 |
| 8 | Router Navigation in Queue Ticket | Replace raw hash anchors with React Router `<Link>` components in `LiveQueueTicket.tsx` | M2 | Survey Obs 3 |
| 9 | API Gateway Response Resilience | Handle non-JSON HTML error responses (502/504) gracefully in `frontend/src/services/api.ts` | M2 | Survey Obs 4 |
| 10 | Frontend Linter Hygiene | Address synchronous `setState` in effect warnings in `CameraQrScannerModal.tsx` and `ReceptionistDashboard.tsx` | M2 | Survey Obs 4 |
| 11 | Apple HIG Design Accent Consistency | Standardize accidental `#0088e8` cyan instances to Action Blue `#0066cc` per `DESIGN.md` | M2 | Survey Obs 1 |
| 12 | End-to-End Automated Gates | Verify 100% pass on backend `npm run test:verify`, backend `npm run build`, frontend `npm run build`, and frontend `npm run lint` | M3 | Acceptance Criteria |
| 13 | Forensic Integrity Verification | Perform independent forensic audit confirming genuine implementation without test cheating or mocks | M3 | Acceptance Criteria |
| 14 | Receptionist Payment Coordination | Expose receptionist contact info on passes and booking screens; enable patients to call receptionist directly to coordinate online payment (UPI) or pay at desk | M4 | User Requirement |
| 15 | Feature Specification Pruning | Prune bloated features from `MediArca_Feature_Specification.md` to reflect exact active 5-portal scope | M4 | User Requirement |
| 16 | Agent Memory & Rules Architecture | Establish `AGENTS.md`, `docs/architecture.md`, ADRs 001-005, `docs/known-issues.md`, and hierarchical rules | M4 | User Requirement |
| 17 | Clinic Profile & Facility Settings | Full Clinic Profile page with exterior/logo upload, frame crop, auto-compression, name/address sync, and sidebar navigation | M5 | User Requirement |
| 18 | Doctor Practice Days & Absence Management | Independent weekly practice days (Mon-Sun) and absence/leave management for doctors and receptionists | M6 | User Requirement |
| 19 | Pure Camera QR Arrival & Dynamic Clinic Branding | Eliminate manual 6-digit code entry; pure camera QR scanner modal; dynamic clinic photo rendering across discovery and headers; remove raw facility IDs | M7 | User Requirement |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Concurrency & Runtime Resilience | Database env, atomic transactions, process error handlers, CORS status, reschedule logic | none | DONE (2,000/2,000 tests pass, build pass) |
| M2 | Frontend Portals, Localization & Design Compliance | Admin INR currency, live ticket state sync, API resilience, lint hygiene, Action Blue palette | none | DONE (build pass, lint pass 0 errors) |
| M3 | Fullstack Gate Verification & Forensic Audit | Verification suite run, full builds, challenger stress test, forensic audit | M1, M2 | DONE (2,020/2,020 tests pass, builds clean, linter clean, forensic audit clean) |
| M4 | Specification Alignment & Agent Memory System | Prune specs, pay-to-receptionist coordination, complete `docs/` ADRs, `AGENTS.md` hierarchy | M3 | DONE (2,020 tests pass, clean builds, 0 lint errors) |
| M5 | Clinic Profile & Facility Branding | Dedicated clinic settings, photo/logo crop & compression, atomic address & name sync, portal navigation | M4 | DONE (2,023/2,023 tests pass, builds clean, 0 lint errors) |
| M6 | Doctor Practice Days & Leave Management | Weekly days selector, today leave toggle, custom date-range absence modal, doctor & receptionist dashboards | M5 | DONE (2,023/2,023 tests pass, builds clean, 0 lint errors) |
| M7 | Camera QR Scanner & Dynamic Branding Alignment | Pure camera scanner, QR standee cleanup, Home & Discovery dynamic clinic avatars, ClinicProfile credentials overhaul | M6 | DONE (2,023/2,023 tests pass, builds clean, 0 lint errors) |

## Interface Contracts
### Pay-to-Receptionist Coordination Contract
- Online booking generates status `PENDING_APPROVAL` with `estimatedQueueNumber` without upfront payment gateway charge.
- Backend resolves `receptionistName` and `receptionistPhone` and attaches them to appointment payloads.
- Frontend exposes direct call action (`Call Receptionist: +91...`) so patients can call the receptionist to pay via UPI or pay at the desk upon arrival.
- Receptionist verifies payment and confirms appointment (`WAITING` + official `queueNumber`).

### Queue Concurrency Contract
- Function: `callPatient(req, res)`
- Guarantee: Only one appointment per doctor can have status `IN_CONSULTATION` across all clinics at any given time.
- Transaction: All resets and the target update must be executed inside a single `prisma.$transaction`.

### API Response Contract
- Client: `frontend/src/services/api.ts`
- Expected: Must not throw unhandled `SyntaxError` when backend or reverse proxy returns 502/504 with HTML error body; must return a clean `Error` with helpful status message.

### Localization & Currency Contract
- Symbol: Indian Rupee `₹` across all user portals (Patient, Doctor, Clinic, Receptionist, Admin).
- Phone: `+91` 10-digit format locked.
- Time: Asia/Kolkata (IST / UTC+05:30) calendar date evaluation.

## Documentation Index
- Root Charter: [AGENTS.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/AGENTS.md)
- Product Specification: [MediArca_Feature_Specification.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/MediArca_Feature_Specification.md)
- Architecture Overview: [docs/architecture.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/docs/architecture.md)
- Architecture Decision Records:
  - [001-pay-to-receptionist-coordination.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/docs/decisions/001-pay-to-receptionist-coordination.md)
  - [002-role-scoped-account-uniqueness.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/docs/decisions/002-role-scoped-account-uniqueness.md)
  - [003-queue-atomic-transactions.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/docs/decisions/003-queue-atomic-transactions.md)
  - [004-currency-localization-inr.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/docs/decisions/004-currency-localization-inr.md)
  - [005-api-resilience-and-caching.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/docs/decisions/005-api-resilience-and-caching.md)
- Defect Ledger & Anti-Patterns: [docs/known-issues.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/docs/known-issues.md)
- Active Task & Checklist: [docs/tasks/current-task.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/docs/tasks/current-task.md)
- Scoped Backend Rules: [backend/AGENTS.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/backend/AGENTS.md)
- Scoped Frontend Rules: [frontend/AGENTS.md](file:///c:/Users/Bikesh%20Ray/OneDrive/Desktop/MediArca/frontend/AGENTS.md)
