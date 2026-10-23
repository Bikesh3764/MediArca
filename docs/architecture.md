# MediArca Architecture Overview

## 1. System High-Level Architecture

MediArca is designed as a decoupled, multi-portal architecture serving 5 distinct healthcare roles (Patients, Doctors, Clinics, Receptionists, and Administrators).

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Client Layer (React 19 + Vite)                    │
│   ┌──────────────┬──────────────┬──────────────┬─────────┬─────────┐   │
│   │   Patient    │    Doctor    │    Clinic    │ Recep.  │  Admin  │   │
│   │   Portal     │   Console    │    Portal    │  Desk   │ Center  │   │
│   └───────┬──────┴──────┬───────┴──────┬───────┴────┬────┴────┬────┘   │
└───────────┼─────────────┼──────────────┼────────────┼─────────┼────────┘
            │             │              │            │         │
            │ HTTP / JSON API (REST with Bearer JWT Auth)        │
            ▼             ▼              ▼            ▼         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     API Gateway Layer (Express 5)                      │
│   - Rate Limiters (Auth, Contact Inquiries, General API)               │
│   - CORS Verification (strict origin matching, 403 Forbidden on fail)  │
│   - Authentication Middleware (JWT verification & Role Guards)         │
│   - Cache Headers (Vary: Authorization, 60s public catalog caching)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                  Business Logic & State Controllers                    │
│   - Appointment State Machine (`canTransition`)                        │
│   - Concurrency Locking (`prisma.$transaction`)                        │
│   - Shift & Slot Schedule Evaluator (`scheduleUtils`)                  │
│   - Phone Normalizer (`phoneUtils` - +91 standard)                     │
│   - OTP Security & Lockout System (`otpSecurity`)                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                     Data Persistence Layer (Prisma 6)                  │
│   - PostgreSQL Database (12 relational models)                         │
│   - Composite Key Indexing (`@@unique([email, role])`)                 │
│   - Relational Junctions (`ClinicDoctor`, `DoctorReceptionist`)        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Identity Management

### 2.1 Role-Scoped Multi-Tenancy
MediArca enforces per-portal account uniqueness through a Prisma composite unique constraint:
```prisma
model User {
  id         String   @id @default(uuid())
  email      String
  role       Role     // PATIENT, DOCTOR, CLINIC, RECEPTIONIST, ADMIN
  phone      String?
  ...
  @@unique([email, role])
}
```
This enables a user (e.g., a doctor or receptionist) to test or use the platform as a patient using their primary email address without collision. Uniqueness is strictly email-based per portal role; mobile number uniqueness is not required or enforced, permitting shared family contact numbers. OTP verification is strictly on email.

### 2.2 Security Lifecycle
- **JWT Tokens**: Signed with HMAC-SHA256 containing `id`, `email`, and `role`. Verified via `authenticate` and `optionalAuthenticate` middlewares.
- **Email OTP Verification**: Registration triggers a 6-digit cryptographic OTP. Failed attempts trigger exponential lockouts (`MAX_OTP_VERIFY_ATTEMPTS = 5`, 15-minute lockout). Resends enforce a 60-second cooldown.
- **Receptionist Staff Guard**: Newly provisioned receptionists are assigned temporary passwords with `mustChangePassword = true`. All desk mutation endpoints are blocked via `requireActiveReceptionist` until the password is changed.

---

## 3. Queue State Machine & Concurrency Control

### 3.1 Appointment Lifecycle States
```
                      ┌──────────────────────┐
                      │  PENDING_APPROVAL    │ (Estimated Token #)
                      └──────────┬───────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │ (Recep Confirms/    │ (Patient Cancels/   │ (Clinic Rejects)
           │  Fee Collected)     │  Withdraws)         │
           ▼                     ▼                     ▼
┌──────────────────────┐ ┌──────────────┐     ┌──────────────┐
│       WAITING        │ │  CANCELLED   │     │   REJECTED   │
└──────────┬───────────┘ └──────────────┘     └──────────────┘
           │
           ├────────────────────────────┐
           ▼ (Doctor Calls to Cabin)    ▼ (Patient Absent at Shift End)
┌──────────────────────┐          ┌──────────────┐
│   IN_CONSULTATION    │          │   NO_SHOW    │
└──────────┬───────────┘          └──────────────┘
           │
     ┌─────┴─────────────────────┐
     ▼ (Consultation Done)       ▼ (Doctor Holds Patient)
┌──────────────┐          ┌──────────────┐
│  COMPLETED   │          │   WAITING    │
└──────────────┘          └──────────────┘
```

### 3.2 State Transition Matrix (`canTransition`)
The backend strictly evaluates transitions before executing any update:

| From State | Allowed Target States |
|------------|-----------------------|
| `PENDING_APPROVAL` | `WAITING`, `CANCELLED`, `REJECTED`, `EXPIRED` |
| `WAITING` | `IN_CONSULTATION`, `CANCELLED`, `NO_SHOW`, `EXPIRED`, `WAITING` (reschedule) |
| `IN_CONSULTATION` | `COMPLETED`, `WAITING` (hold consultation) |
| `COMPLETED` | *(Terminal)* |
| `CANCELLED` | *(Terminal)* |
| `REJECTED` | *(Terminal)* |
| `EXPIRED` | *(Terminal)* |
| `NO_SHOW` | *(Terminal)* |

### 3.3 Atomic Concurrency Invariant
To prevent race conditions where two patients are simultaneously called into a consultation, or where a doctor consulting across clinics opens conflicting sessions:

```typescript
// Inside executeCallPatientTransaction:
await prisma.$transaction(async (tx) => {
  // 1. Check if doctor already has an active consultation in ANY clinic
  const existingConsultation = await tx.appointment.findFirst({
    where: {
      doctorId,
      status: 'IN_CONSULTATION',
      id: { not: targetAppointmentId },
    },
  });
  if (existingConsultation) {
    throw new Error('Doctor already has an active consultation in progress');
  }

  // 2. Safely transition target appointment to IN_CONSULTATION
  return await tx.appointment.update({
    where: { id: targetAppointmentId },
    data: { status: 'IN_CONSULTATION', consultationStartTime: new Date() },
  });
});
```

---

## 4. Zero-Upfront Payment & Receptionist Coordination Architecture

MediArca replaces third-party payment gateways with a direct human-assisted payment flow:

1. **Patient Request**:
   - Patient selects a doctor, date, and shift window on the frontend.
   - Submits booking with zero upfront payment details required.
   - Server creates an appointment with status `PENDING_APPROVAL` and computes an `estimatedQueueNumber`.

2. **Receptionist Contact Surface**:
   - The backend `resolveReceptionistContact` utility locates the primary active receptionist assigned to the doctor or clinic.
   - Attaches `receptionistName` and `receptionistPhone` directly to the appointment payload.
   - The frontend `LiveQueueTicket` renders an action button: `Call Receptionist: +91 XXXXX XXXXX`.

3. **Payment Coordination & Token Locking**:
   - The patient can call the receptionist directly (e.g., to pay via UPI over phone) or pay cash/UPI at the clinic front desk.
   - The receptionist verifies payment in the Receptionist Desk and clicks **Confirm**.
   - The server atomically shifts status to `WAITING` and assigns the official `queueNumber`.

---

## 5. Frontend Polling & State Synchronization

- **Live Queue Polling**: The `LiveQueueTicket` component executes lightweight polling every 10 seconds during active clinic hours.
- **Adaptive Timeout & Retry**: If the network times out or returns a non-JSON reverse proxy error (502/504), the API client records a failed cycle without cascading retries or crashing the application.
- **Cabin Presence Sync**: The doctor's live status (`IN_CABIN`, `STEPPED_OUT`, `NOT_IN_CABIN`) is polled and synchronized directly into patient tickets, showing expected return times when the doctor steps out.

---

## 6. Clinic Profile, Facility Settings & Photo Architecture

To support physical clinic branding and discovery:

1. **Brand Identity & Auto-Compressed Logo**:
   - Clinic accounts upload logo or facility exterior photos via `/api/auth/avatar`.
   - The frontend passes raw images through the interactive `AvatarCropModal` (aspect ratio 1:1 or 4:3) and optimizes the cropped blob using `optimizeAvatarImage` before upload.
   - Files are stored on Cloudflare R2 (or disk fallback under `/uploads/avatars/`), and the URL is saved to `User.avatarUrl`.
   - Public clinic endpoints (`/api/clinics/public` and `/api/clinics/public/:id`) and authenticated dashboard (`/api/clinics/my-clinic`) expose `avatarUrl` for clinic cards and live queue headers.

2. **Atomic Synchronization (`updateClinicProfile`)**:
   - Clinic settings updates modify facility name, street address, city, state, contact phone, and avatar.
   - Modifications to clinic name and phone number atomically synchronize both the `ClinicProfile` model and the parent `User` record inside a `prisma.$transaction`.
   - Phone numbers are validated against the Indian standard (`+91` 10-digit mobile). Mobile number uniqueness is not required or enforced; account uniqueness is strictly email-scoped.
   - Base64 image data URLs are strictly rejected to prevent database bloat.

---

## 7. Physical QR Arrival Verification & Standee Protocol

1. **Touchless Camera Scanning (No Manual Codes)**:
   - Verification of patient arrival at the clinic counter is strictly camera-driven via `CameraQrScannerModal` or mobile camera browser redirection.
   - The user is never prompted for manual 6-digit desk codes, eliminating friction and human typing errors.
   - Front-desk printable posters generated by `ClinicQrStandeeModal` contain high-resolution QR codes linking directly to the arrival endpoint with cryptographic verification tokens embedded inside the QR payload (`&code=...`).
   - Technical database keys (e.g. `cp_demo_clinic`, internal UUIDs) are concealed from clinic operators; the profile presents clear accreditation status and one-click standee printing.

---

## 8. Apple HIG Weekday Controls & Copy Minimalism Protocol

1. **Weekday Representation & Dot Strips (`WeekdayDisplay.tsx`)**:
   - Clinic cards in `DoctorDashboard` and practitioner rosters in `ReceptionistDashboard` represent schedule availability via a minimalist 7-day strip.
   - Days are displayed as single-letter Apple discs (`M T W T F S S`) inside a parchment pill track (`#f5f5f7`, `rounded-xl`).
   - Active consultation days use solid Apple ink (`#1d1d1f`) with white text; off days use transparent discs with muted secondary text (`#86868b`).
   - The current calendar day is marked with a 2px Action Blue focus ring (`ring-2 ring-[#0066cc]`), allowing doctors and staff to immediately discern if a practitioner is practicing today.
   - Generic rectangular colored badge tags (`[Mon] [Tue] [Wed]`) are strictly prohibited.

2. **Interactive Day Selection (`DoctorScheduleLeaveModal` & `ManageSchedule`)**:
   - Interactive day pickers use Apple `rounded-full` pill buttons (`h-11 rounded-full`) with 3-letter day codes (`Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun`).
   - Selected states use Action Blue (`#0066cc`) with white text; unselected states use parchment `#f5f5f7` with ink text.
   - Buttons do not stack redundant full names or labels (no "Mon / Monday", no "Sits / Off").
   - 1-click presets provide instant configuration: `Mon – Sat`, `Mon – Fri`, `All Days`.

3. **Copywriting Minimalism**:
   - Interfaces strictly use simple, direct 1–2 word labels: `Shifts`, `Schedule`, `Standee`, `Resume`, `Leave`, `Available`.
   - Boilerplate explanations and redundant descriptive paragraphs are removed to keep UI hierarchy crisp and clean.

