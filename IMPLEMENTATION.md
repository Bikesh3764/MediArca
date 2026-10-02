# MediArca — Technical Implementation Blueprint (IMPLEMENTATION.md)

**Document Version:** 2.4.0  
**Last Updated:** October 2, 2026  
**Status:** Production Ready  
**Repository:** [Bikesh3764/MediArca](https://github.com/Bikesh3764/MediArca)  
**Frontend Deployment:** GitHub Pages (`https://bikesh3764.github.io/MediArca/`)  
**Backend API Deployment:** Render Web Service (`https://mediarca-mdwk.onrender.com`)  
**Primary Database:** Supabase Cloud PostgreSQL (`db.gibgtnzhecexgwximtpi.supabase.co`)  
**Media Vault:** Cloudflare R2 Cloud Object Storage  
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
 │   • HashRouter (GitHub Pages SPA Compatibility)        │
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
 └─────────────┬──────────────────┬─────────────────┬─────┘
               │                  │                 │
               ▼                  ▼                 ▼
 ┌──────────────────────┐ ┌───────────────┐ ┌───────────────┐
 │ Supabase PostgreSQL  │ │ Cloudflare R2 │ │  Gmail SMTP   │
 │ • Prisma 6 ORM       │ │ Object Store  │ │ Nodemailer    │
 │ • SystemConfig Table │ │ Prescriptions │ │ 6-digit OTP   │
 │ • Atomic Trx & RLS   │ │ Clinical Data │ │ Notifications │
 └──────────────────────┘ └───────────────┘ └───────────────┘
```

---

## 2. Core Operational Portals

| Portal | Route Base | Target Audience | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Patient Portal** | `/patient/*` | Patients & Caregivers | Doctor discovery, multi-venue booking (Myself or Family), live digital queue wallet passes, consultation history, emergency contacts. |
| **Doctor Console** | `/doctor/*` | Practitioners | Live cabin queue, "Call Next Patient", digital consultation builder, multi-clinic schedule & fee configuration, clinic requests. |
| **Clinic Portal** | `/clinic/*` | Clinic Administrators | Doctor onboarding / invitations, revenue isolation per practitioner, front-desk receptionist provisioning with temporary passwords. |
| **Receptionist Desk** | `/receptionist/*` | Front Desk Staff | Rapid walk-in patient queue registration, physical queue token printing, live queue table management, desk check-ins. |
| **Admin Control** | `/admin/*` | Platform Superadmins | Practitioner medical license verification, clinic licensing verification, platform-wide analytics and audit controls. |

---

## 3. Database Schema & Data Models

Prisma ORM connects to the PostgreSQL database with the following core entities:

### 3.1 `User` Model
```prisma
model User {
  id                            String    @id @default(uuid())
  email                         String    @unique
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
}
```

### 3.2 Clinical Profiles & Relationships
- **`DoctorProfile`**: Holds medical qualifications, specialties (34+ categories), clinical experience, primary clinic, verification status (`PENDING`, `VERIFIED`, `REJECTED`), cabin status (`IN_CABIN`, `STEPPED_OUT`, `NOT_IN_CABIN`), and serialized multi-slot schedules.
- **`ClinicProfile`**: Holds legal clinic name, physical address, city, state, contact phone, check-in kiosk code (`checkinCode`), and administrative verification status.
- **`ReceptionistProfile`**: Links front-desk operators to a parent clinic facility and assigns specific doctor desks.
- **`ClinicDoctor`**: Two-way affiliation bridge between Clinics and Doctors. Enforces `PENDING`, `ACCEPTED`, or `REJECTED` workflows with isolated clinic-specific consultation fees and shift configurations.
- **`Appointment`**: The atomic queue unit containing:
  - `date`, `slotId`, `queueNumber`, `status` (`WAITING`, `IN_CONSULTATION`, `COMPLETED`, `CANCELLED`).
  - `isForOther`, `patientName`, `patientAge`, `patientGender`.
  - `isCheckedIn`, `checkedInAt`.
  - `paymentStatus` (strictly pay-at-clinic / zero upfront paywall).
- **`SystemConfig`**: Cloud environment configuration fallback table (`key`, `value`, `updatedAt`) allowing server processes to dynamically read runtime settings (e.g., SMTP credentials) directly from the database.

---

## 4. Authentication, Security & Verification Engine

1. **Google OAuth 2.0**:
   - Google Sign-In automatically authenticates users and marks `isEmailVerified: true`.
   - First-time Google accounts missing mandatory clinical information (e.g. phone, DOB, gender for patients; qualifications for doctors; address for clinics) are smoothly intercepted by a Post-Auth Profile Completion modal.
2. **Email OTP Verification (Gmail SMTP)**:
   - For email/password registrations, the server generates a 6-digit numeric OTP (`100000 - 999999`) with a 10-minute expiry.
   - HTML verification emails are dispatched via Gmail SMTP (`nodemailer`) with Apple typography and branded container.
   - Unverified logins are blocked with HTTP 403 (`requiresVerification: true`) and auto-trigger a fresh code.
   - Frontend features an Apple 6-digit single-box OTP modal with auto-focus, paste support, and 60-second cooldown timer.
3. **Receptionist Provisioning & Mandatory Password Change**:
   - Receptionists are created only by Clinic Admins with temporary credentials (`mustChangePassword: true`).
   - On first login, receptionists are forced to establish a permanent private password (min. 8 characters) before gaining desk access.

---

## 5. Live Queue Allocation & Clinical Algorithms

1. **Atomic Token Generation**:
   - Token numbers are allocated sequentially per Doctor + Clinic + Date + Shift using atomic database transactions.
   - Concurrent bookings are protected against race conditions and duplicates.
2. **Dynamic Consultation Time Calculation**:
   - Shift Pace: `Average Minutes = Floor(Shift Duration in Minutes / Max Patient Capacity)`.
   - Estimated Start Time: `Shift Start Time + (Queue Number - 1) * Average Minutes`.
   - If slot time has already passed today, the UI alerts the patient and prevents past-time scheduling.
3. **Cabin Presence & Return Times**:
   - Doctors can toggle presence: `IN_CABIN`, `STEPPED_OUT` (with estimated return time), or `NOT_IN_CABIN`.
   - Patients viewing live queue passes receive real-time updates on doctor availability.

---

## 6. API Routing Directory

| Endpoint | Method | Role Guard | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | Public | Register new user; dispatches OTP for non-Google. |
| `/api/auth/verify-otp` | `POST` | Public | Validates 6-digit OTP and issues JWT auth token. |
| `/api/auth/resend-otp` | `POST` | Public | Resends fresh 6-digit OTP code. |
| `/api/auth/login` | `POST` | Public | Authenticates credentials; checks verification status. |
| `/api/auth/google` | `POST` | Public | Google OAuth token verification and account sync. |
| `/api/doctors` | `GET` | Public | Search verified practitioners by specialty, city, query. |
| `/api/appointments/preview`| `GET` | Authenticated | Calculates live token number and estimated time. |
| `/api/appointments/book` | `POST` | `PATIENT` | Atomically creates queue pass for myself or family. |
| `/api/consultations/call-next`| `POST` | `DOCTOR` | Calls the next waiting patient into the cabin. |
| `/api/clinics/receptionists`| `POST` | `CLINIC` | Provisions new front-desk desk operator credentials. |
| `/api/receptionist/walkin`| `POST` | `RECEPTIONIST`| Books immediate walk-in patient at physical clinic. |

---

## 7. Verification & Automated Test Suite

MediArca maintains an automated end-to-end verification test suite located at `backend/scripts/verify-fixes.ts`:
- **Total Tests:** 1055+ assertions passing (100% success rate).
- **Coverage Areas:**
  - Phone validation & Indian +91 normalization.
  - Multi-slot shift bounds & capacity calculations.
  - State machine transitions (`WAITING` -> `IN_CONSULTATION` -> `COMPLETED`).
  - Google OAuth payload normalization & post-auth profile guards.
  - 6-digit numeric OTP generation, validation, and expiry.
  - Dynamic SMTP credential resolution (Environment variables with database fallback).

---

## 8. Deployment Procedures

1. **Backend (Render)**:
   - Git push to `main` triggers automatic Render Web Service build (`npm install && npm run build`).
   - Server runs self-healing schema migrations (`ensureSchema()`) upon boot.
   - Production secrets are stored securely in Supabase `SystemConfig` and Render dashboard.
2. **Frontend (GitHub Pages)**:
   - Vite builds optimized production bundle into `frontend/dist/`.
   - GitHub Actions workflow deploys SPA bundle to GitHub Pages at `https://bikesh3764.github.io/MediArca/`.
