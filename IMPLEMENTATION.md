# MediArca — Technical Implementation Blueprint (IMPLEMENTATION.md)

**Document Version:** 2.4.0  
**Last Updated:** October 2, 2026 (historical; for current design see `docs/architecture.md` and `docs/known-issues.md`)  
**Status:** Production Ready  
**Repository:** [Bikesh3764/MediArca](https://github.com/Bikesh3764/MediArca)  
**Frontend Deployment:** GitHub Pages (`https://bikesh3764.github.io/MediArca/`)  
**Backend API Deployment:** Render Web Service (`https://mediarca-api-sg.onrender.com`)  
**Primary Database:** Supabase Cloud PostgreSQL (`db.gibgtnzhecexgwximtpi.supabase.co`)  
**Mail Gateway:** Gmail SMTP via Nodemailer  

---

## 1. Executive Overview & System Architecture

MediArca is a modern, fullstack clinical queue and healthcare operations platform engineered strictly around **Apple Human Interface Guidelines (HIG)**. It eliminates physical waiting-room guesswork through atomic digital queue tokens, multi-venue shift management, automated doctor cabin presence tracking, and role-based operational portals.

### High-Level Architecture Diagram

```
[ Patient App / Browser ]        [ Doctor / Clinic / Desk Browser ]
          │                                     │
          ▼                                     ▼
 ┌────────────────────────────────────────────────────────┐
 │   Frontend Client (React 19, TypeScript, Vite)         │
 │   • Apple Design System (HIG, SF Pro, #f5f5f7 canvas)  │
 │   • BrowserRouter (clean addresses)                    │
 │   • Tailwind CSS + Lucide Icons + Google OAuth 2.0     │
 └──────────────────────────┬─────────────────────────────┘
                            │ HTTPS / REST API
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │   Backend Server (Node.js, Express, TypeScript)        │
 │   • Strict JWT Authentication & Role Guards            │
 │   • Pessimistic / Atomic Queue Allocator               │
 │   • Non-blocking Self-Healing Schema Migrations        │
 │   • Sliding-Window Memory Pruned Rate Limiter          │
 └─────────────┬────────────────────────────────────┬─────┘
               │                                    │
               ▼                                    ▼
 ┌──────────────────────┐            ┌───────────────┐
 │ Supabase PostgreSQL  │            │  Gmail SMTP   │
 │ • Prisma 6 ORM       │            │ Nodemailer    │
 │ • SystemConfig Table │            │ 6-digit OTP   │
 │ • Atomic Trx & RLS   │            │ Notifications │
 └──────────────────────┘            └───────────────┘
```

---

## 2. Core Operational Portals

| Portal | Route Base | Target Audience | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Patient Portal** | `/patient/*` | Patients & Caregivers | Doctor discovery, multi-venue booking (Myself or Family), live queue ticket with receptionist contact & UPI phone coordination, arrival check-in. |
| **Doctor Console** | `/doctor/*` | Practitioners | Live cabin queue, "Call Next Patient" (atomic transaction), consultation hold/complete, cabin presence toggling, multi-clinic schedule & fee management. |
| **Clinic Portal** | `/clinic/*` | Clinic Administrators | Doctor onboarding / invitations, revenue isolation per practitioner, front-desk receptionist provisioning with temporary passwords, QR standee download. |
| **Receptionist Desk** | `/receptionist/*` | Front Desk Staff | Rapid walk-in token creation, fee collection recording (cash/UPI), ticket confirmation (`PENDING_APPROVAL` → `WAITING`), desk arrival check-ins, queue oversight. |
| **Admin Control** | `/admin/*` | Platform Superadmins | Practitioner medical license verification, clinic licensing verification, platform-wide analytics and audit controls. |

---

## 3. Database Schema & Data Models

Prisma ORM connects to the PostgreSQL database with the following core entities:

### 3.1 `User` Model
```prisma
model User {
  id                            String    @id @default(uuid())
  email                         String
  passwordHash                  String
  fullName                      String
  phone                         String?
  role                          String    @default("PATIENT") // PATIENT, DOCTOR, CLINIC, RECEPTIONIST, ADMIN
  avatarUrl                     String?
  mustChangePassword            Boolean   @default(false)
  isEmailVerified               Boolean   @default(true)
  emailVerificationOtp          String?
  emailVerificationOtpExpiresAt DateTime?
  createdAt                     DateTime  @default(now())
  updatedAt                     DateTime  @updatedAt

  @@unique([email, role])
  @@index([email])
  @@index([phone])
}
```

### 3.2 Clinical Profiles & Relationships (12 Models)
- **`DoctorProfile`** (`1:1 User`): Holds medical qualifications, specialties (34+ categories), clinical experience, primary clinic, verification status (`PENDING`, `VERIFIED`, `SUSPENDED`, `REJECTED`), cabin status (`IN_CABIN`, `STEPPED_OUT`, `NOT_IN_CABIN`), and serialized multi-slot schedules.
- **`PatientProfile`** (`1:1 User`): Holds patient demographics (`dateOfBirth`, `gender`, `bloodGroup`) and structured clinical history (`allergies`, `existingConditions`, `chronicConditions`, `pastSurgeries`, `currentMedications`, `emergencyContact`).
- **`ClinicProfile`** (`1:1 User`): Holds legal clinic name, physical address, city, state, contact phone, check-in kiosk code (`checkinCode`), and administrative verification status (`PENDING`, `VERIFIED`, `SUSPENDED`, `REJECTED`).
- **`ReceptionistProfile`** (`1:1 User`, `N:1 ClinicProfile`): Links front-desk operators to a parent clinic facility (`status`: `ACTIVE`, `PENDING`, `REJECTED`) and assigns specific doctor desks via `DoctorReceptionist`.
- **`ClinicDoctor`** (`M:N ClinicProfile <-> DoctorProfile`, `@@unique([clinicId, doctorId])`): Two-way affiliation bridge enforcing `PENDING`, `ACCEPTED`, `ACTIVE`, or `REJECTED` workflows with isolated clinic-specific consultation fees and shift configurations.
- **`DoctorReceptionist`** (`M:N DoctorProfile <-> ReceptionistProfile`, `@@unique([doctorId, receptionistId])`): Links receptionists to assigned doctors within a clinic (`ACTIVE`, `PENDING`, `REJECTED`).
- **`Appointment`** (`N:1 PatientProfile`, `N:1 DoctorProfile`, `N:1 ClinicProfile?`, `1:1 Review?`): The atomic queue unit with composite uniqueness `@@unique([clinicId, doctorId, appointmentDate, slotId, queueNumber])`, containing:
  - `appointmentDate` (`YYYY-MM-DD`), `slotId`, `queueNumber`, `status` (`PENDING_APPROVAL`, `WAITING`, `IN_CONSULTATION`, `COMPLETED`, `CANCELLED`, `REJECTED`, `EXPIRED`).
  - `isForOther`, `patientName`, `patientAge`, `patientGender`, `patientPhone`.
  - `isCheckedIn`, `checkedInAt`.
  - `paymentStatus` (strictly pay-at-clinic / zero upfront paywall).
- **`Review`** (`1:1 Appointment`, `N:1 DoctorProfile`, `N:1 User`): Verified post-consultation patient rating (`1-5`) and feedback comment.
- **`Notification`** (`N:1 User`): In-app portal notifications (`title`, `message`, `type`, `isRead`).
- **`ContactMessage`**: Public support inquiries (`fullName`, `email`, `phone`, `subject`, `message`, `status`).
- **`SystemConfig`**: Cloud environment configuration fallback table (`key @id`, `value`, `updatedAt`) allowing server processes to dynamically read runtime settings (e.g., SMTP credentials) directly from the database.

---

## 4. Authentication, Security & Verification Engine

1. **Per-Portal Account Uniqueness & Google OAuth 2.0**:
   - Email and 10-digit Indian mobile numbers (`+91`) are scoped per portal role (`@@unique([email, role])`), allowing the same email/phone to hold distinct accounts across `PATIENT`, `DOCTOR`, `RECEPTIONIST`, and `CLINIC` portals while preventing duplicates within the same role.
   - Google Sign-In automatically authenticates users for the requested role (`PATIENT`, `DOCTOR`, or `CLINIC`) and marks `isEmailVerified: true`.
   - First-time Google accounts missing mandatory clinical information are intercepted by a Post-Auth Profile Completion modal.
2. **Email OTP Verification (Gmail SMTP)**:
   - For email/password registrations, the server generates a CSPRNG 6-digit numeric OTP (`100000 - 999999`) with a 10-minute expiry, 5-attempt lockout, and 60-second resend cooldown.
   - HTML verification emails are dispatched via Gmail SMTP (`nodemailer`) with HTML-escaped recipient names.
   - Unverified logins are blocked with HTTP 403 (`requiresVerification: true`) and auto-trigger a fresh code.
3. **Receptionist Provisioning & Mandatory Password Change**:
   - Receptionists are provisioned by Clinic Admins with temporary credentials (`mustChangePassword: true`) or via verified clinic application approval.
   - On first login, receptionists must establish a permanent password (min. 8 characters) before accessing any clinical desk or report operations.

---

## 5. Live Queue Allocation & Clinical Algorithms

1. **Atomic Token Generation & Row Locking**:
   - Token numbers are allocated sequentially per Doctor + Clinic + Date + Shift inside `prisma.$transaction` using PostgreSQL `SELECT id FROM "DoctorProfile" WHERE id = ... FOR UPDATE` row-level locks and retry loops (`maxAttempts = 3`).
   - Concurrent bookings, approvals, reschedules, and consultation calls are protected against race conditions and cross-clinic active consultation conflicts.
2. **Dynamic Consultation Time Calculation**:
   - Shift Pace: `Average Minutes = Floor(Shift Duration in Minutes / Max Patient Capacity)`.
   - Estimated Start Time: `Shift Start Time + (Queue Number - 1) * Average Minutes`.
   - If slot time has already passed today, the UI and backend prevent past-time scheduling.
3. **Cabin Presence & Return Times**:
   - Doctors and authorized receptionists can toggle presence: `IN_CABIN`, `STEPPED_OUT` (with estimated return time), or `NOT_IN_CABIN`.

---

## 6. API Routing Directory

| Endpoint | Method | Role Guard | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | Public (Rate-Limited) | Register new user per role; dispatches 6-digit OTP. |
| `/api/auth/verify-otp` | `POST` | Public (Rate-Limited) | Validates 6-digit OTP for `(email, role)` and issues JWT. |
| `/api/auth/resend-otp` | `POST` | Public (Rate-Limited) | Resends fresh 6-digit OTP code for `(email, role)`. |
| `/api/auth/login` | `POST` | Public (Rate-Limited) | Authenticates credentials (scoped by portal `role`). |
| `/api/auth/google` | `POST` | Public (Rate-Limited) | Google OAuth token verification and role-scoped sync. |
| `/api/auth/me` & `/api/auth/profile` | `GET / PUT` | Authenticated | Fetches or updates authenticated user & role profile. |
| `/api/doctors` & `/api/doctors/:id` | `GET` | Public | Search verified practitioners, clinics, shifts, & reviews. |
| `/api/doctors/schedule` & `/api/doctors/cabin-status` | `PUT` | `DOCTOR` (`/ RECEPTIONIST`) | Updates shift schedules (with cross-clinic overlap lock) & cabin presence. |
| `/api/doctors/me/report` | `GET` | `DOCTOR` (Verified) | Generates categorized clinical & revenue report. |
| `/api/appointments/queue-preview` | `GET` | Public / Cached | Calculates live token number, shift status, and ETA. |
| `/api/appointments/book` | `POST` | `PATIENT / DOCTOR` | Atomically creates queue pass (`PENDING_APPROVAL` or walk-in `WAITING`). |
| `/api/appointments/check-in` | `POST` | `PATIENT` | Verifies QR arrival check-in at clinic facility. |
| `/api/appointments/:id/cancel` & `/:id/review` | `PATCH / POST` | Authenticated / `PATIENT` | Cancels booking via state machine or submits verified review. |
| `/api/consultations/queue` & `/call-patient` | `GET / POST` | `DOCTOR` (Verified) | Fetches live queue and atomically calls patient into cabin. |
| `/api/consultations/update-notes` & `/complete` & `/hold` | `PUT / POST` | `DOCTOR` (Verified) | Saves vitals/notes, completes consultation, or places on hold. |
| `/api/clinic/my-clinic` & `/api/clinic/report` | `GET` | `CLINIC` (Active) | Retrieves clinic dashboard roster, metrics, and PDF/CSV reports. |
| `/api/clinic/doctors` & `/api/clinic/receptionists` | `POST / PUT / DELETE` | `CLINIC` (Active) | Manages doctor affiliations and provisions desk receptionists. |
| `/api/receptionists/queue/:doctorId` & `/book-walkin` | `GET / POST` | `RECEPTIONIST` (Active) | Manages live doctor queue and issues walk-in tokens. |
| `/api/receptionists/pending-appointments` & `/:id/approve` | `GET / PATCH` | `RECEPTIONIST` (Active) | Lists, approves, or rejects online booking requests. |
| `/api/receptionists/appointments/:id/reschedule` | `POST` | `RECEPTIONIST / DOCTOR` | Atomically reschedules appointment to a new date/shift. |
| `/api/admin/stats`, `/doctors`, `/clinics`, `/appointments` | `GET / POST` | `ADMIN` | Platform analytics, practitioner/clinic verification, & support inbox. |
| `/api/notifications` & `/api/health` | `GET / PUT` | Authenticated / Public | User notifications and database health liveness check. |

---

## 7. Verification & Automated Test Suite

MediArca maintains an automated end-to-end verification test suite located at `backend/scripts/verify-fixes.ts`:
- **Total Assertions:** 2,020 passing assertions across unit, integration, security, and concurrency suites (0 failures).

---

## 8. Deployment Procedures

1. **Backend (Render)**:
   - Git push to `main` triggers automatic Render Web Service build (`npm install && npm run build`).
   - Startup command (`npm start`) executes `node scripts/deploy-migrations.js && node dist/server.js`, applying Prisma migrations before booting Express.
2. **Frontend (Cloudflare Pages / GitHub Pages)**:
   - Vite builds optimized production bundle into `frontend/dist/` with `_headers` disabling HTML caching (`Cache-Control: no-cache, no-store, must-revalidate`) while caching hashed `/assets/*` bundles immutable for 1 year.
