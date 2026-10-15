# MediArca Backend — Scoped Agent Rules

## 1. Backend Charter & Technologies
The MediArca backend is an Express 5 REST API built with Node.js, TypeScript, and Prisma ORM 6 connected to PostgreSQL.

- **Framework**: Express 5.2.1
- **ORM**: Prisma 6.4.1
- **Database**: PostgreSQL (Prisma schema in `prisma/schema.prisma`)
- **Authentication**: JWT (`jsonwebtoken`), `bcryptjs`, email OTP (`nodemailer`)
- **Key Modules**:
  - `src/controllers/` — Request handlers for appointments, consultations, receptionists, clinics, auth, etc.
  - `src/utils/appointmentStateMachine.ts` — Authoritative queue state machine (`canTransition`).
  - `src/utils/authGuards.ts` — Role and clinic eligibility guards.
  - `src/utils/phoneUtils.ts` — Canonical `+91` phone validation and sanitization.
  - `src/utils/scheduleUtils.ts` — Shift window and IST timezone calculations.
  - `src/utils/otpSecurity.ts` — Cryptographic OTP tracking and rate limiting.

---

## 2. Strict Backend Invariants

1. **Mandatory Atomic Transactions**:
   All state transitions for appointments (`callPatient`, `holdConsultation`, `completeConsultation`, `approveAppointment`, `rescheduleAppointment`) MUST be wrapped in `prisma.$transaction`. Never perform non-transactional queue mutations.
2. **Single Active Consultation per Doctor**:
   `executeCallPatientTransaction` and `executeReceptionistInConsultationTransaction` must query for existing `IN_CONSULTATION` records for the doctor and throw HTTP 400 if another visit is active.
3. **Queue State Machine Verification**:
   Always call `canTransition(currentStatus, targetStatus)` before applying status changes. If disallowed, respond with HTTP 400.
4. **Zero-Upfront Payment Policy**:
   Never introduce online payment gateway endpoints (e.g. Stripe, Razorpay). Appointments are created as `PENDING_APPROVAL` with estimated tokens. Receptionists confirm tickets to `WAITING` after payment coordination.
5. **Role-Scoped Multi-Tenancy**:
   Users are identified uniquely by `(email, role)` via `@@unique([email, role])`. Queries must include `role` alongside `email`.
6. **Phone Number Standardization**:
   All mobile numbers must be validated with `isValidIndianPhone` and stored in canonical E.164 format `+91XXXXXXXXXX`.
7. **Receptionist Security Guard**:
   Enforce `requireActiveReceptionist` on all desk mutation endpoints to verify `mustChangePassword === false`.
8. **IST Timezone Discipline**:
   Always compute calendar dates using `getLocalDateString()` based on Asia/Kolkata (`UTC+05:30`).

---

## 3. Verification & Build Commands

```bash
# Run the master automated verification suite (2,023+ regression tests)
npm run test:verify

# Compile TypeScript and generate Prisma client
npm run build
```
