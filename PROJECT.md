# Project: MediArca Fullstack Defect Remediation & Platform Hardening

## Architecture
MediArca is an Indian healthcare patient appointment and live queue management system built on:
- **Backend**: Node.js, Express, TypeScript, Prisma ORM (PostgreSQL), JWT authentication, role-based access control.
- **Frontend**: React 18 / 19, TypeScript, Vite, Tailwind CSS, Lucide icons, Apple Human Interface Guidelines (`DESIGN.md`).
- **Database**: PostgreSQL (Prisma schema with models for User, DoctorProfile, PatientProfile, ClinicProfile, ReceptionistProfile, Appointment, Queue, Notification).
- **Core Guardrails**: Zero-upfront payment (pay-at-clinic preserved), no prescription builder, demo credentials preserved, +91 Indian phone standard lock.

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

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Concurrency & Runtime Resilience | Database env, atomic transactions, process error handlers, CORS status, reschedule logic | none | DONE (1,202/1,202 tests pass, build pass) |
| M2 | Frontend Portals, Localization & Design Compliance | Admin INR currency, live ticket state sync, API resilience, lint hygiene, Action Blue palette | none | DONE (build pass, lint pass 0 errors / 0 warnings) |
| M3 | Fullstack Gate Verification & Forensic Audit | Verification suite run, full builds, challenger stress test, forensic audit | M1, M2 | DONE (1,209/1,209 tests pass, builds clean, linter clean, forensic audit clean) |

## Interface Contracts
### Queue Concurrency Contract
- Function: `callPatient(req, res)`
- Guarantee: Only one appointment per doctor can have status `IN_CONSULTATION` at any given time.
- Transaction: All resets and the target update must be executed inside a single `prisma.$transaction`.

### API Response Contract
- Client: `frontend/src/services/api.ts`
- Expected: Must not throw unhandled `SyntaxError` when backend or reverse proxy returns 502/504 with HTML error body; must return a clean `Error` with helpful status message.

### Localization & Currency Contract
- Symbol: Indian Rupee `₹` across all user portals (Patient, Doctor, Clinic, Receptionist, Admin).
- Phone: `+91` 10-digit format locked.

## Code Layout
### Backend Files Owned by M1:
- `backend/.env`
- `backend/src/server.ts`
- `backend/src/controllers/consultationController.ts`
- `backend/src/controllers/receptionistController.ts`
- `backend/scripts/verify-fixes.ts`

### Frontend Files Owned by M2:
- `frontend/src/pages/Admin/AdminDashboard.tsx`
- `frontend/src/components/queue/LiveQueueTicket.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/components/common/CameraQrScannerModal.tsx`
- `frontend/src/pages/Receptionist/ReceptionistDashboard.tsx`
- `frontend/src/components/layout/DashboardLayout.tsx`
- `frontend/src/pages/Clinic/ClinicDashboard.tsx`
- `frontend/src/pages/Clinic/ClinicAuth.tsx`
- `frontend/src/components/common/ErrorBoundary.tsx`

### Verification Owned by M3:
- Read-only verification and test executions across `backend/` and `frontend/`.
