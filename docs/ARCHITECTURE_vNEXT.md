# MediArca Healthcare Platform — vNext Architecture Specification

```
            +-------------------+
            |   Supabase Auth   |
            +-------------------+
                      |
                auth.uid() only
                      |
        +-------------+-------------+
        |             |             |
     patients      doctors     staff/admin
        |             |             |
        +-------------+-------------+
                      |
                  STRICT RLS
                      |
        +-------------+-------------+
        |             |             |
   appointments   encounters   prescriptions
        |             |             |
   +----+----+        |        +----+----+
   |         |        |        |         |
 queue    check-in  vitals  medications
   |         |        |        |
   +---------+--------+--------+
                      |
                  SECURE RPCs
                      |
        +-------------+-------------+
        |             |             |
     Booking    Queue control  Consultation
        |             |             |
        +-------------+-------------+
                      |
                Audit + Events
                      |
             Privacy-safe Realtime
```

---

## 1. Authentication Layer (`Supabase Auth` -> `auth.uid() only`)

All authentication, session management, token issuance, and password hashing (bcrypt / Argon2) are delegated entirely to **Supabase Auth** (`auth.users`).

### Invariants:
1. **Zero Application Password Storage**: The `users` table contains zero password columns (`password_hash` is eliminated).
2. **Canonical Root of Trust**: `auth.uid()` is the immutable anchor for all authorization checks.
3. **Partitioned Actor Entities**:
   - `users`: Core identity linking `id = auth.uid()`, role (`patient`, `doctor`, `admin`, `receptionist`), and email.
   - `patient_clinical_profiles`: Medical demographics, allergies, blood group, emergency contact, and insurance policies.
   - `doctors`: Clinical credential profile, medical license registration (`reg_number`), hospital affiliation, and accredited Mediarca ID.

---

## 2. Access Control Layer (`STRICT RLS`)

Every database table is protected by PostgreSQL **Row-Level Security (RLS)** with `RESTRICTIVE` policies:

```sql
-- Appointments Isolation
CREATE POLICY appointments_patient_select ON appointments
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid());

CREATE POLICY appointments_doctor_select ON appointments
    FOR SELECT TO authenticated
    USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));

-- Clinical Encounters Isolation
CREATE POLICY encounters_patient_select ON clinical_encounters
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid());

CREATE POLICY encounters_doctor_manage ON clinical_encounters
    FOR ALL TO authenticated
    USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));

-- Prescriptions & Medications Isolation
CREATE POLICY prescriptions_patient_select ON clinical_prescriptions
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid());

CREATE POLICY prescriptions_doctor_manage ON clinical_prescriptions
    FOR ALL TO authenticated
    USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));
```

---

## 3. Normalized Domain Entities

The relational model strictly separates operational flow, clinical examination, and medication regimens:

### 3.1 Operations & Queue Flow
- `appointments`: Scheduled dates, slots, booking tokens, and lifecycle state (`booked`, `checked_in`, `in-consultation`, `completed`, `no-show`, `skipped`).
- `clinic_queues`: Authoritative live token state keyed by `(doctor_id, queue_date)`.
- `check_ins`: QR-based cryptographically signed check-in verification tokens (`checkin_token`).

### 3.2 Clinical Encounters & Biometrics
- `clinical_encounters`: Chief complaint, examination findings, clinical assessment, treatment plan, follow-up date.
- `vitals`: Longitudinal telemetry (`bp`, `pulse`, `temp`, `spo2`, `weight`, `height`, `bmi`, `respiratory_rate`).

### 3.3 Prescriptions & Pharmacy
- `clinical_prescriptions`: Diagnostic summary, dietary advice, follow-up schedule.
- `prescription_items`: Itemized pharmacology with structured `drug_name`, `dosage`, `frequency`, `route`, `duration`, and `instructions`.

---

## 4. Business Logic via Secure RPCs (`SECURE RPCs`)

Direct client mutations to critical state are prohibited. All operational mutations execute inside `SECURITY DEFINER` stored procedures with atomic transactions and row-level locks:

### 4.1 Booking RPC (`book_appointment`)
- Locks the daily queue counter row using `SELECT ... FOR UPDATE`.
- Allocates the next sequential token atomically without concurrency race conditions.
- Generates a cryptographic QR check-in token and records an audit log entry.

### 4.2 Queue Control RPC (`advance_doctor_queue`, `pause_doctor_queue`, `flag_priority`)
- Validates practitioner identity (`auth.uid() = doctor.user_id`).
- Transitions token status (`waiting` ➔ `in-consultation` ➔ `completed`).
- Handles emergency priority elevation with mandatory audit justification.

### 4.3 Consultation RPC (`complete_consultation_encounter`)
- Atomic multi-table write: commits `clinical_encounters`, inserts `vitals`, creates `clinical_prescriptions`, inserts itemized `prescription_items`, updates `appointments.status = 'completed'`, and advances `clinic_queues.current_token`.

---

## 5. Audit & Compliance Ledger (`Audit + Events`)

All state modifications generate immutable, append-only records in `audit_logs`:

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id UUID,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Privacy-Safe Real-time Streaming (`Privacy-safe Realtime`)

Websocket channels broadcast only sanitized, zero-PII queue telemetry to public listeners:

```json
{
  "event": "QUEUE_ADVANCED",
  "doctor_id": "d0000000-0000-0000-0000-000000000001",
  "current_token": 4,
  "status": "in-session",
  "avg_wait_mins": 14,
  "timestamp": "2026-08-16T17:27:00Z"
}
```

*Patient names, symptoms, diagnoses, and medical histories are never transmitted on public real-time channels.*
