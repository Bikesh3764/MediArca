# MediArca — Product & Feature Specification

## 1. Product Overview

MediArca is a specialized, high-performance in-clinic queue management and outpatient appointment booking platform tailored specifically for Indian healthcare practitioners, polyclinics, and patients.

The platform eliminates crowded clinic waiting rooms and chaotic physical queues through **real-time token dispatching**, **live cabin presence tracking**, and **direct front-desk receptionist coordination**.

### Core Architecture Philosophy
- **Physical Clinic Focus**: MediArca is built strictly for physical outpatient departments (OPD) and clinics. Telemedicine, video consultations, and digital prescription builders are explicitly excluded to keep the software fast, intuitive, and laser-focused on queue efficiency.
- **Zero-Upfront Payment Policy**: Patients book appointments without paying upfront via automated credit/debit card payment gateways. Instead, online bookings generate an estimated queue token. The patient coordinates payment directly with the clinic receptionist (either over the phone via UPI, or in-person at the front desk upon arrival). The receptionist confirms payment and assigns the official live queue number.
- **Role-Scoped Access Control**: Distinct, secure portals for Patients, Doctors, Clinics, Receptionists, and System Administrators, allowing multi-role access with one email via `@@unique([email, role])`. Account uniqueness is strictly enforced on `(email, role)`; mobile number uniqueness is not required or enforced, permitting shared family contact numbers. OTP verification is handled strictly via email.
- **Atomic Queue Concurrency**: Hard database transactions prevent race conditions, ensuring only one patient per doctor can be inside a consultation cabin at any single instant.
- **Localization**: Strictly formatted for Indian phone numbers (`+91`), Indian Rupee (`₹`), and Indian Standard Time (IST / Asia/Kolkata).

---

## 2. Platform Roles & Exact Feature Scope

```
┌─────────────────────────────────────────────────────────────────┐
│                           MediArca                              │
└────────────────────────────────┬────────────────────────────────┘
                                 │
     ┌──────────────┬────────────┼─────────────┬─────────────┐
     ▼              ▼            ▼             ▼             ▼
  Patient         Doctor       Clinic     Receptionist     Admin
   Portal        Console       Portal         Desk        Center
```

### 2.1 Patient Portal
Designed with an Apple Human Interface Guidelines aesthetic to provide an effortless, transparent clinic visit experience.

1. **Practitioner & Clinic Discovery**:
   - Search by doctor name, medical specialty, clinic name, or city.
   - Comprehensive doctor profiles displaying qualification, years of experience, languages spoken, consultation fee (`₹`), and verified clinic affiliations.
   - Real-time indicator of the doctor's current cabin presence (`In Cabin`, `Stepped Out`, `Not In Cabin`).

2. **Appointment Booking & Token Generation**:
   - Slot selection based on practitioner's defined shift windows (e.g., Morning Shift, Evening Shift).
   - Booking for self or family members/dependents (capturing dependent name, age, and gender).
   - Zero-upfront payment barrier: Generates an appointment request with status `PENDING_APPROVAL` and an estimated token number.

3. **Live Queue Ticket & Receptionist Coordination**:
   - **Receptionist Contact Card**: Full name and direct phone number of the assigned receptionist or front desk staff.
   - **Direct Call Action**: One-tap phone button enabling the patient to call the receptionist immediately to coordinate online payment (UPI) or confirm their arrival.
   - **Real-Time Queue Tracker**: Displays currently serving token, patients ahead in line, and dynamic estimated wait time in minutes based on clinic pace.
   - **Live Cabin Presence Sync**: Real-time badge indicating if the doctor is actively consulting in the cabin, stepped out (with estimated return time), or not yet in the cabin.
   - **Touchless Camera QR Check-In**: Camera QR scanner to confirm physical arrival in the waiting area upon scanning the clinic's front-desk QR standee. Pure touchless scanner without manual code entry.
   - **Token Management**: Ability to withdraw or cancel an appointment prior to entering consultation.

4. **Patient Profile & Medical History**:
   - Profile management including name, contact phone number (`+91` 10-digit), email, date of birth, blood group, allergies, existing chronic conditions, and emergency contact (phone numbers are collected and formatted for clinic communication, without phone OTP verification).

---

### 2.2 Doctor Console
Tailored for healthcare practitioners to manage their OPD flow efficiently without screen clutter.

1. **Queue Management & Patient Calling**:
   - Real-time queue view categorizing patients by shift and arrival status (`Waiting`, `Checked In`, `In Cabin`, `Completed`).
   - **Atomic Call to Cabin**: Calling a patient to the cabin runs an atomic database transaction (`prisma.$transaction`) that guarantees only one patient can hold status `IN_CONSULTATION` per practitioner. Any prior open consultation is cleanly closed or transitioned.
   - **Hold Consultation**: Ability to place an active consultation on hold (returning the patient safely to `WAITING` status) if diagnostic tests, vitals, or dressing are needed.
   - **Complete Consultation**: Transition visit to `COMPLETED` with optional brief clinical summary notes.

2. **Cabin Presence Toggling**:
   - Direct switch between three states:
     - `IN_CABIN`: Doctor is ready and actively seeing patients.
     - `STEPPED_OUT`: Doctor has temporarily stepped out (prompts for expected return time in minutes).
     - `NOT_IN_CABIN`: Doctor is off-duty or has not yet arrived.
   - Immediately broadcasts status updates to all waiting patient tickets.

3. **Schedule & Shift Management**:
   - Configure recurring weekly shifts (e.g., Mon–Sat, 10:00 AM – 02:00 PM; 05:00 PM – 09:00 PM).
   - Define average consultation duration per patient (used for queue time estimation).
   - Set consultation fees in Indian Rupees (`₹`).
   - Overlap validation: Server rejects overlapping shifts for the same doctor across clinics.

4. **Walk-In Creation & Clinic Switcher**:
   - Add immediate walk-in patients directly from the console during an active OPD session.
   - Multi-clinic switcher for practitioners affiliated with multiple facilities.

---

### 2.3 Clinic Portal
Dedicated facility dashboard for clinic administrators and polyclinic operators.

1. **Doctor Roster & Affiliation Management**:
   - Invite and onboard verified doctors to the clinic.
   - Manage practitioner affiliations (`ACCEPTED`, `ACTIVE`, `INACTIVE`).
   - Configure clinic-specific doctor schedules and consultation fees.
   - Clean detachment: Detaching a doctor safely cancels/reschedules non-terminal appointments within a transaction.

2. **Receptionist Provisioning**:
   - Provision staff accounts with role `RECEPTIONIST`.
   - Granular doctor assignment: Assign receptionists to either cover the entire clinic or a specific subset of practitioners.
   - Password reset and staff lifecycle management.

3. **Physical Check-In Standee**:
   - Generates and downloads high-resolution clinic QR code standees designed for front-desk counters (pure camera scan, no printed desk codes).
   - Standee URL contract embeds `clinicId` and secure verification token for instantaneous patient arrival scanning.

4. **Facility Profile, Branding & Settings**:
   - Dedicated clinic settings (`/clinic/profile`) with clinic logo / exterior photo upload, interactive frame crop, auto-compression, and public discovery branding.
   - Atomic synchronization of clinic name, street address, city, state, and `+91` Indian contact phone number.
   - Direct access to front-desk QR standee preview and high-resolution printing.
   - Live analytics on daily footfall, active OPD queues, and completed visits.

---

### 2.4 Receptionist Desk
Optimized for high-speed front-desk operations, walk-in management, and cash/UPI collection.

1. **Patient Arrival & QR Check-In**:
   - Rapid patient arrival check-in using phone number search or token lookup.
   - Dedicated camera QR scanner for scanning patient mobile passes at the desk.

2. **Payment Collection & Token Confirmation**:
   - **Payment Recording**: Receptionist marks consultation fee as `PAID` (cash or UPI).
   - **Queue Escalation**: Approves online booking requests (`PENDING_APPROVAL` → `WAITING`), locking the patient's official queue number in the live order of confirmed payments.

3. **Walk-In Token Dispatching**:
   - Instant booking for walk-in patients without requiring prior registration.
   - Inputs patient name, phone number, doctor, shift, and reason for visit.
   - Automatically issues the next sequential token for the target shift.

4. **Queue Orchestration & Rescheduling**:
   - Monitor live queue flow across all assigned doctors simultaneously.
   - Reschedule visits across dates and shift windows with atomic slot validation.
   - Enforces the rule that unapproved requests (`PENDING_APPROVAL`) remain unapproved upon reschedule until payment is confirmed.

---

### 2.5 Admin Center
Platform governance, integrity enforcement, and platform-wide monitoring.

1. **Doctor Verification Queue**:
   - Inspect medical registration numbers, medical council certificates, and qualifications.
   - Approve, reject, or request information with audit logging.

2. **Clinic Verification Queue**:
   - Review facility commercial registration, clinical establishment licenses, and physical address.
   - Approve or reject facility onboarding.

3. **Platform Metrics**:
   - Real-time counts of registered patients, active doctors, verified clinics, daily visits, and queue throughput.

4. **Contact & Inquiries Management**:
   - Review contact submissions and support inquiries from the public portal.
   - Delete resolved contact messages.

---

## 3. Explicit Non-Goals & Pruned Features

To guarantee platform performance, clinical ergonomics, and legal simplicity, the following features are **explicitly excluded** from MediArca:

| Excluded Feature | Rationale | Replacement / Current Behavior |
|------------------|-----------|--------------------------------|
| **Telemedicine / Video Calls** | Focus is physical clinic queue management and OPD arrival flow. | Physical in-person consultations with live cabin status. |
| **Digital Prescription Builder** | Doctors prefer clinic EHRs or paper scripts; complex drug databases add friction. | Optional plain-text clinical summary notes on visit completion. |
| **Medical Records Cloud Vault** | Patient data liabilities and heavy file storage overhead. | Core patient profile stores chronic conditions, allergies, and blood group. |
| **Integrated Payment Gateway** | High transaction drop-offs and complex refund disputes. | Direct payment to receptionist via UPI or cash; zero upfront fees. |
| **Pharmacy / Lab Marketplace** | Dilutes core product focus. | None (out of scope). |
| **Public Ratings & Social Feeds**| Prevents review manipulation and fake accounts. | Private post-consultation 1–5 star experience rating. |

---

## 4. Key Business & Operational Rules

1. **Queue Fairness**: Token numbers are sequential per doctor, per shift window, per date.
2. **Payment Priority**: First-come, first-confirmed. An online booking request (`PENDING_APPROVAL`) holds an estimated token, but the official queue position is cemented only when the receptionist confirms payment.
3. **Overtime Shift Protection**: If a shift window elapses while patients remain in the queue, tokens remain valid for overtime consultation. If the practitioner concludes the OPD session, patients are guided to the front desk to reschedule.
4. **Account Multi-Tenancy**: A single individual can act as a Patient and a Doctor (or Receptionist) using the same email address, segregated cleanly via role-scoped authentication.
