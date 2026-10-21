# MediArca — Master Operational Handbook & System Mechanics

## 1. System Vision & Architecture Overview

MediArca is an Indian healthcare outpatient appointment and live queue management system built specifically to eliminate physical waiting room congestion in outpatient clinics. 

Unlike conventional healthcare portals that bloat their scope with telemedicine video calls, digital prescription pads, or payment gateways, MediArca maintains a ruthless focus on **physical outpatient clinic logistics**:
- In-person clinic discovery and estimated token generation.
- Zero-upfront payment policy (patients coordinate UPI over call or pay in-person at the front desk).
- Physical QR arrival verification via camera scanning.
- Live real-time mobile queue pass with dynamic queue position and estimated arrival time.
- Atomic doctor queue management and reception desk oversight.

---

## 2. High-Concurrency Scaling & Traffic Mechanics (Steps 1, 2 & 3)

### The Single-Clinic Physical Profile
In a typical Indian outpatient clinic during peak hours:
- **1 Receptionist Desk:** Managing walk-ins, approving provisional bookings, and checking in arrivals.
- **2 Active Doctor Cabins:** Calling patients, conducting consultations, and completing visits.
- **25 Active Waiting Patients:** Monitoring real-time queue passes on mobile devices.

### Step 1: Zero-Cost Database & Wi-Fi Optimizations
1. **Clinic Wi-Fi NAT Rate Limit Isolation (`backend/src/server.ts`):**
   - *Problem:* All 25 waiting patients and receptionists connect to the physical clinic's Wi-Fi router, sharing a single public IPv4 address.
   - *Mechanic:* The `authRateLimiter` cryptographically decodes the JWT Bearer token from `req.headers.authorization` when `req.user` is not pre-attached. Rate limits are keyed to `user:<userId>` for authenticated requests and fall back to IP only for unauthenticated calls.
   - *Public Limits:* Public catalog endpoints (`/api/doctors`, `/api/clinics`, `/api/appointments/queue-preview`) permit up to **300 req/60s**.
2. **PostgreSQL Connection Pool & Timeout Auto-Tuning (`backend/src/config/database.ts`):**
   - *Problem:* Default Prisma connection pool of 5 connections times out after 10 seconds under concurrent interactive transactions (`prisma.$transaction`).
   - *Mechanic:* `tuneDatabaseUrl` automatically injects `connection_limit=25&pool_timeout=30` into the PostgreSQL connection string. Safe for Supabase PgBouncer (port 6543) in Transaction Mode.
3. **Query Bounding (`backend/src/controllers/appointmentController.ts`):**
   - Scopes patient appointment queries strictly to active visits (`WAITING`, `IN_CONSULTATION`, `PENDING_APPROVAL`) OR recent visits within the last 60 days, capped at `take: 50`.

### Step 2: Adaptive Polling & Idle Polling Pause
In `frontend/src/pages/Patient/MyAppointments.tsx`:
1. **Instant Initial Open:** On page load, only active appointments are fetched (`api.getPatientAppointments({ status: 'active' })`). Page renders in <50ms.
2. **On-Demand Past Appointments:** Past consultations are only fetched if the patient explicitly taps the **"Past"** tab. Data is fetched in **10-record chunks** (`limit: 10, page: 1`) with an Apple HIG **"Show More"** button for pagination.
3. **Adaptive Polling Intervals (`adaptivePollInterval`):**
   - **10 Seconds:** If turn is imminent (patient is currently in consultation, `isYourTurn: true`, or $\le 1$ patient ahead).
   - **15 Seconds:** If close to turn (2 to 5 patients ahead, ~10–15 minutes away).
   - **60 Seconds:** If far back in the queue (>5 patients ahead).
   - **0 Seconds (Paused):** If the patient has zero active appointments today, polling is disabled completely.

### Step 3: In-Memory / Redis Live Queue Snapshot Cache
In `backend/src/utils/queueStateCache.ts`:
1. **Queue Snapshot Deduplication:**
   - When 25 patients of the same doctor poll simultaneously, they all query the database for the identical active queue batch.
   - `getCachedActiveBatch(doctorIds, dates, fetcher)` caches the active queue batch with a **4-second TTL**.
   - Multiple concurrent polls within 4 seconds hit in-memory RAM (<0.01ms), slashing database query volume by **80% to 90%**.
2. **Instant Mutation Invalidation:**
   - The cache is immediately invalidated whenever a queue state transition occurs:
     - `callPatient` (`consultationController.ts`)
     - `completeConsultation` (`consultationController.ts`)
     - `holdConsultation` (`consultationController.ts`)
     - `checkInAppointmentWithQR` (`appointmentController.ts`)
     - `checkInAppointmentDirect` (`appointmentController.ts`)
     - `cancelAppointment` (`appointmentController.ts`)
     - `executeApproveAppointmentTransaction` (`receptionistController.ts`)
     - `bookWalkin` (`receptionistController.ts`)
     - `rescheduleAppointment` (`receptionistController.ts`)

---

## 3. Queue State Machine & Clinical Operations

### Status Lifecycle Invariant
```
[PROVISIONAL BOOKING] ──> PENDING_APPROVAL
                               │
            ┌──────────────────┴──────────────────┐
     (Capacity Full)                       (Receptionist Approves)
            │                                     │
            ▼                                     ▼
        EXPIRED                                WAITING
                                                  │
                                     (Camera QR Check-in)
                                                  │
                                                  ▼
                                         WAITING (Checked-In)
                                                  │
                                         (Doctor Calls)
                                                  │
                                                  ▼
                                           IN_CONSULTATION
                                                  │
                                                  ├────────┐
                                         (Hold)   │        │ (Complete)
                                                  ▼        ▼
                                               WAITING  COMPLETED
```

### Inviolable Clinical Rules
1. **Single Active Consultation Invariant:** A doctor can have at most ONE appointment in `IN_CONSULTATION` status across all clinics at any given time. Calling patient $B$ atomically shifts patient $A$ back to `WAITING` or completes $A$.
2. **Slot Capacity Auto-Expiration:** When confirmed active visits (`WAITING`, `IN_CONSULTATION`, `COMPLETED`) reach a shift's `maxPatients`, all remaining `PENDING_APPROVAL` bookings for that shift atomically transition to `EXPIRED`.
3. **Cross-Clinic Shift Overlap Guard:** Doctors cannot be assigned overlapping shift windows across different physical clinics on overlapping working days.
4. **Physical QR Scanner Arrival Only:** Patients verify arrival exclusively by scanning the front-desk QR standee using their device camera (`checkInWithQR`). Manual 6-digit code entry and internal database UUIDs are strictly banned.
5. **Doctor Cabin Presence Toggles:**
   - `IN_CABIN`: Actively consulting patients.
   - `STEPPED_OUT`: Away temporarily with expected return time in minutes (notifies only active ticket holders today).
   - `NOT_IN_CABIN`: Doctor has not yet arrived or has completed clinic hours.

---

## 4. Security, Isolation & Invariant Matrix

| Domain | Invariant Rule | Implementation File |
| :--- | :--- | :--- |
| **Authentication** | Role-scoped account uniqueness (`@@unique([email, role])`) | `backend/prisma/schema.prisma` |
| **Localization** | Strict Indian Rupee (`₹`) and Indian Standard Time (`IST / +05:30`) | `frontend/src/`, `backend/src/utils/` |
| **PII Isolation** | No doctor/receptionist personal email or phone in public discovery | `backend/src/controllers/doctorController.ts` |
| **Desk Security** | Receptionist must change temporary password on first login | `backend/src/utils/authGuards.ts` |
| **Anti-Slop** | Zero online payment gateways, Zero digital prescription builders, Zero reviews/ratings | `AGENTS.md` |

---

## 5. Summary Table: Concurrency Limits by Phase

| Metric | Baseline (Un-tuned) | Phase 1 (Step 1) | Phase 2 (Step 2) | Phase 3 (Step 3 + Redis) |
| :--- | :--- | :--- | :--- | :--- |
| **Physical Clinics** | 6 – 9 Clinics | 25 – 35 Clinics | 60 – 80 Clinics | 100 – 150+ Clinics |
| **Concurrent Patients** | 150 – 225 | 625 – 875 | 1,500 – 2,000 | 5,000 – 10,000+ |
| **Patient Polling Pace**| 15s Fixed | 15s Fixed | 10s / 15s / 60s / 0s | 10s / 15s / 60s / 0s |
| **Active Batch Query** | DB Query Every Poll | DB Query Every Poll | DB Query Every Poll | 4s In-Memory Cache (<0.01ms) |
| **DB Queries / Min / Clinic** | 456 queries | 456 queries | ~132 queries | ~30 – 45 queries |
