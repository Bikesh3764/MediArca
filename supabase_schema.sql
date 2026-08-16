-- ========================================================================
-- MEDIARCA HEALTH SYSTEMS - PRODUCTION DATABASE & SECURITY SPECIFICATION
-- Strict Supabase Auth Integration, Role-Based Access Control, Atomic RPCs & Date Isolation
-- ========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USERS & IDENTITY PROFILES TABLE (Linked directly to Supabase auth.users - Section 11 Resolution: Receptionist Role)
-- Password security is managed 100% by Supabase Auth (bcrypt/argon2) - NO password_hash in application schema
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin', 'receptionist')),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PATIENT CLINICAL PROFILES TABLE (Section 10 Resolution: Medical Background & Clinical Demographics)
CREATE TABLE IF NOT EXISTS patient_clinical_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    age INT CHECK (age IS NULL OR (age >= 0 AND age <= 125)),
    gender VARCHAR(20),
    blood_group VARCHAR(10),
    allergies TEXT[],
    chronic_conditions TEXT[],
    past_surgeries TEXT[],
    family_history TEXT,
    emergency_contact VARCHAR(50),
    insurance_provider VARCHAR(100),
    insurance_policy_number VARCHAR(100),
    preferred_language VARCHAR(50) DEFAULT 'English',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ACCREDITED PRACTITIONERS TABLE (C-28 Resolution: Explicit UUID foreign key data type)
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    specialty_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    degrees VARCHAR(255) NOT NULL,
    reg_number VARCHAR(100) NOT NULL,
    mediarca_id VARCHAR(50) UNIQUE,
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    experience_years INT DEFAULT 5 CHECK (experience_years >= 0 AND experience_years <= 70),
    hospital VARCHAR(255) NOT NULL,
    fee NUMERIC(10, 2) DEFAULT 50.00 CHECK (fee >= 0),
    rating NUMERIC(3, 2) DEFAULT 5.00 CHECK (rating >= 0 AND rating <= 5),
    reviews_count INT DEFAULT 0 CHECK (reviews_count >= 0),
    avatar TEXT,
    bio TEXT,
    schedule VARCHAR(255) DEFAULT 'Mon - Fri | 09:00 AM - 02:00 PM',
    queue_active BOOLEAN DEFAULT false,
    current_token INT DEFAULT 0 CHECK (current_token >= 0),
    total_tokens INT DEFAULT 0 CHECK (total_tokens >= 0),
    avg_consult_time_mins INT DEFAULT 12 CHECK (avg_consult_time_mins > 0),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CLINIC LIVE QUEUES TABLE (Primary Source of Live Telemetry)
CREATE TABLE IF NOT EXISTS clinic_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID UNIQUE NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_token INT DEFAULT 0 CHECK (current_token >= 0),
    total_tokens INT DEFAULT 0 CHECK (total_tokens >= 0),
    status VARCHAR(20) DEFAULT 'idle' CHECK (status IN ('idle', 'in-session', 'paused', 'completed')),
    avg_consult_time_mins INT DEFAULT 12 CHECK (avg_consult_time_mins > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_doctor_queue_per_day UNIQUE (doctor_id, queue_date)
);

-- 6. APPOINTMENTS & TOKENS TABLE (Section 11 Resolution: Real Scheduler & Cryptographic Check-in Token)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id VARCHAR(50) UNIQUE NOT NULL,
    patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(50) NOT NULL,
    patient_age INT CHECK (patient_age IS NULL OR (patient_age >= 0 AND patient_age <= 125)),
    patient_gender VARCHAR(20),
    token_number INT NOT NULL CHECK (token_number > 0),
    status VARCHAR(20) DEFAULT 'booked' CHECK (status IN ('booked', 'checked_in', 'waiting', 'in-consultation', 'completed', 'cancelled', 'no-show', 'skipped')),
    is_priority BOOLEAN DEFAULT false,
    priority_reason TEXT,
    scheduled_slot VARCHAR(50) DEFAULT '09:00 AM',
    checkin_token VARCHAR(255),
    checkin_token_expires_at TIMESTAMPTZ DEFAULT (NOW() + interval '24 hours'),
    checkin_token_used_at TIMESTAMPTZ,
    check_in_time TIMESTAMPTZ,
    appointment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    symptoms TEXT NOT NULL,
    diagnosis TEXT,
    medications TEXT[],
    advice TEXT,
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_stage VARCHAR(50) DEFAULT 'triage',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. RICH EMR CLINICAL ENCOUNTERS (Section 10 Resolution: Chief Complaint, Vitals, Exam Findings, Assessment & Treatment)
CREATE TABLE IF NOT EXISTS clinical_encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE RESTRICT,
    doctor_id UUID REFERENCES doctors(id) ON DELETE RESTRICT,
    patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    chief_complaint TEXT,
    vitals JSONB, -- { bp: '120/80', pulse: 72, temp: '98.6', spo2: 99, weight: 70, height: 175, bmi: 22.9 }
    examination_findings TEXT,
    assessment TEXT,
    diagnosis TEXT,
    treatment_plan TEXT,
    follow_up_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. STRUCTURED ITEM-BY-ITEM PRESCRIPTIONS (Section 10 Resolution: Dosage, Frequency, Route, Duration & Instructions)
CREATE TABLE IF NOT EXISTS clinical_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID REFERENCES clinical_encounters(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE RESTRICT,
    doctor_id UUID REFERENCES doctors(id) ON DELETE RESTRICT,
    patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    diagnosis TEXT NOT NULL,
    advice TEXT,
    follow_up_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID REFERENCES clinical_prescriptions(id) ON DELETE CASCADE,
    drug_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    route VARCHAR(50) DEFAULT 'Oral',
    duration VARCHAR(100),
    instructions TEXT
);

-- 9. LAB ORDERS & DIAGNOSTIC RESULTS (Section 10 Resolution: Lab Orders & Results)
CREATE TABLE IF NOT EXISTS lab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE RESTRICT,
    doctor_id UUID REFERENCES doctors(id) ON DELETE RESTRICT,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Biochemistry',
    clinical_indication TEXT,
    priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
    status VARCHAR(20) DEFAULT 'ordered' CHECK (status IN ('ordered', 'sample-collected', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES lab_orders(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parameter_name VARCHAR(255) NOT NULL,
    observed_value VARCHAR(100) NOT NULL,
    reference_range VARCHAR(100),
    unit VARCHAR(50),
    is_abnormal BOOLEAN DEFAULT false,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. CLINICAL DOCUMENTS & IMAGING ARCHIVE (Section 15 Resolution: Private Storage Vault & Metadata)
CREATE TABLE IF NOT EXISTS clinical_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('lab_report', 'imaging_xray', 'mri_scan', 'discharge_summary', 'prescription_scan', 'other')),
    document_url TEXT NOT NULL,
    storage_path TEXT,
    file_name VARCHAR(255),
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    is_encrypted BOOLEAN DEFAULT true,
    notes TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. AUDIT COMPLIANCE & ACTIVITY LOGS TABLE (Section 15 Resolution: Append-only ledger with Before/After delta & Device IP)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id UUID,
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(45) DEFAULT '127.0.0.1',
    user_agent TEXT DEFAULT 'MediArca EMR Web Client',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. MULTI-HOSPITAL & FACILITY HIERARCHY (Section 11 & 12 Resolution)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(50) DEFAULT 'Tertiary Specialty Hospital',
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospital_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    floor_number VARCHAR(20) DEFAULT 'Level 2'
);

CREATE TABLE IF NOT EXISTS clinic_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    room_type VARCHAR(50) DEFAULT 'Consultation', -- 'Consultation', 'ECG/Triage', 'Lab Suite', 'Pharmacy'
    is_active BOOLEAN DEFAULT true
);

-- 13. STATUTORY DIGITAL CONSENT REGISTRY (Section 19 Resolution)
CREATE TABLE IF NOT EXISTS patient_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('treatment_consent', 'teleconsult_consent', 'data_sharing_consent', 'document_upload_consent')),
    version VARCHAR(20) NOT NULL DEFAULT 'v2.4-HIPAA',
    is_accepted BOOLEAN NOT NULL DEFAULT true,
    ip_address VARCHAR(45) DEFAULT '127.0.0.1',
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. PATIENT INVOICES & INSURANCE BILLING (Section 20 Resolution)
CREATE TABLE IF NOT EXISTS patient_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    consultation_fee NUMERIC(10, 2) NOT NULL DEFAULT 60.00,
    discount_code VARCHAR(50),
    discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    net_payable NUMERIC(10, 2) NOT NULL,
    insurance_provider VARCHAR(100),
    claim_number VARCHAR(100),
    claim_status VARCHAR(30) DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed', 'submitted', 'pre_authorized', 'settled', 'rejected')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'waived')),
    payment_method VARCHAR(50) DEFAULT 'Credit Card / Digital Payment',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. TELEMEDICINE SECURE VIDEO SESSIONS (Section 18 Resolution)
CREATE TABLE IF NOT EXISTS telemedicine_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    room_token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'live', 'concluded', 'abandoned')),
    doctor_joined_at TIMESTAMP WITH TIME ZONE,
    patient_joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. AUTOMATED UPDATED_AT TRIGGER FUNCTION (D-07 Resolution)
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clinic_queues_updated_at ON clinic_queues;
CREATE TRIGGER trigger_clinic_queues_updated_at
BEFORE UPDATE ON clinic_queues
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_patient_clinical_profiles_updated_at ON patient_clinical_profiles;
CREATE TRIGGER trigger_patient_clinical_profiles_updated_at
BEFORE UPDATE ON patient_clinical_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 13. HELPER FUNCTION: IS_ADMIN CHECK (C-09 Resolution)
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id AND role = 'admin'
  );
$$;

-- 9. ATOMIC TRANSACTIONAL APPOINTMENT BOOKING & TOKEN ISSUANCE RPC (H-01, H-02, H-03, H-04 & C-27 Resolution)
CREATE OR REPLACE FUNCTION issue_next_opd_token(
    p_doctor_id UUID,
    p_symptoms TEXT,
    p_timezone VARCHAR DEFAULT 'Asia/Kolkata'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_patient users%ROWTYPE;
    v_clinical patient_clinical_profiles%ROWTYPE;
    v_next_token INT;
    v_booking_id VARCHAR;
    v_checkin_token VARCHAR;
    v_initial_status VARCHAR;
    v_current_token INT;
    v_appointment appointments%ROWTYPE;
    v_doctor_verified VARCHAR;
BEGIN
    -- 1. Validate Caller Identity via auth.uid()
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Please sign in as an authenticated patient.';
    END IF;

    -- 2. Fetch authenticated patient record & clinical profile directly from database (D-02 Resolution)
    SELECT * INTO v_patient FROM users WHERE id = v_actor_id;
    IF v_patient.id IS NULL THEN
        RAISE EXCEPTION 'Patient profile not found for authenticated user ID: %', v_actor_id;
    END IF;

    SELECT * INTO v_clinical FROM patient_clinical_profiles WHERE user_id = v_actor_id;

    -- 3. Verify doctor accreditation
    SELECT verification_status INTO v_doctor_verified FROM doctors WHERE id = p_doctor_id;
    IF v_doctor_verified IS NULL OR v_doctor_verified != 'verified' THEN
        RAISE EXCEPTION 'Doctor is not verified or does not accept appointments.';
    END IF;

    -- 4. Check Duplicate Active Appointments (H-06 & C-07 Resolution: Comprehensive Active Status Set & Slot Checks)
    IF EXISTS (
        SELECT 1 FROM appointments
        WHERE patient_id = v_actor_id
          AND doctor_id = p_doctor_id
          AND scheduled_date = CURRENT_DATE
          AND status IN ('booked', 'checked_in', 'waiting', 'in-consultation')
    ) THEN
        RAISE EXCEPTION 'You already have an active appointment ticket (Token in progress) with this doctor for today.';
    END IF;

    -- 5. Upsert clinic queue with lock to guarantee concurrency safety
    INSERT INTO clinic_queues (doctor_id, queue_date, current_token, total_tokens, status)
    VALUES (p_doctor_id, CURRENT_DATE, 0, 0, 'in-session')
    ON CONFLICT (doctor_id, queue_date) DO UPDATE
    SET updated_at = NOW();

    -- 6. Acquire row lock and check queue status (H-12 Resolution)
    SELECT current_token, total_tokens, status INTO v_current_token, v_next_token, v_initial_status
    FROM clinic_queues
    WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE
    FOR UPDATE;

    IF v_initial_status = 'paused' THEN
        RAISE EXCEPTION 'This doctor OPD queue is currently paused. Please wait for the queue to resume.';
    ELSIF v_initial_status = 'completed' THEN
        RAISE EXCEPTION 'Doctor OPD consultations are concluded for today.';
    END IF;

    v_next_token := COALESCE(v_next_token, 0) + 1;
    v_booking_id := 'MED-BK-' || upper(to_hex(extract(epoch from now())::bigint)) || '-' || upper(substring(md5(random()::text) from 1 for 4));
    
    -- C-24 & C-27: Server-side cryptographic 128-bit check-in token generation
    v_checkin_token := 'MED-QR-' || lower(encode(gen_random_bytes(16), 'hex'));

    -- 7. All new same-day bookings start in 'waiting' queue line until called by doctor (H-11 Resolution)
    UPDATE clinic_queues 
    SET total_tokens = v_next_token, status = 'in-session', updated_at = NOW()
    WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE;

    UPDATE doctors
    SET total_tokens = v_next_token, queue_active = true
    WHERE id = p_doctor_id;

    -- H-01, H-02, H-03, H-04: check_in_time, start_at, end_at are strictly NULL until events occur
    INSERT INTO appointments (
        booking_id, patient_id, doctor_id, patient_name, patient_phone, patient_age, patient_gender,
        token_number, status, checkin_token, checkin_token_expires_at, check_in_time, appointment_date, scheduled_date, start_at, end_at, timezone, symptoms
    ) VALUES (
        v_booking_id,
        v_actor_id,
        p_doctor_id,
        v_patient.full_name,
        COALESCE(v_patient.phone, 'Not specified'),
        v_clinical.age,
        v_clinical.gender,
        v_next_token,
        'waiting',
        v_checkin_token,
        NOW() + interval '24 hours',
        NULL,
        CURRENT_DATE,
        CURRENT_DATE,
        NULL,
        NULL,
        COALESCE(p_timezone, 'Asia/Kolkata'),
        p_symptoms
    ) RETURNING * INTO v_appointment;

    -- Log audit trail
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'BOOK_TOKEN',
        'appointments',
        v_appointment.id,
        jsonb_build_object(
            'token_number', v_next_token,
            'doctor_id', p_doctor_id,
            'checkin_token', v_checkin_token,
            'timezone', COALESCE(p_timezone, 'Asia/Kolkata')
        )
    );

    RETURN to_jsonb(v_appointment);
END;
$$;

-- 9B. ATOMIC RECEPTION WALK-IN TOKEN ISSUANCE RPC (H-18 & H-19 Resolution)
CREATE OR REPLACE FUNCTION issue_reception_walkin_token(
    p_doctor_id UUID,
    p_patient_name VARCHAR,
    p_patient_phone VARCHAR,
    p_patient_age INT DEFAULT NULL,
    p_patient_gender VARCHAR DEFAULT NULL,
    p_symptoms TEXT DEFAULT 'General Walk-in Consultation',
    p_is_priority BOOLEAN DEFAULT false,
    p_priority_reason TEXT DEFAULT NULL,
    p_timezone VARCHAR DEFAULT 'Asia/Kolkata'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_booking_id VARCHAR;
    v_checkin_token VARCHAR;
    v_next_token INT;
    v_appointment appointments%ROWTYPE;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- H-18: Authorize strictly receptionists or administrators
    SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;
    IF v_actor_role NOT IN ('receptionist', 'admin') AND NOT is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Access Denied: Only accredited reception staff and administrators can issue walk-in tokens.';
    END IF;

    -- Verify target doctor is active and accredited
    IF NOT EXISTS (SELECT 1 FROM doctors WHERE id = p_doctor_id AND verification_status = 'verified') THEN
        RAISE EXCEPTION 'Doctor is not accredited, active, or verified.';
    END IF;

    -- Ensure queue exists and acquire row lock
    INSERT INTO clinic_queues (doctor_id, queue_date, current_token, total_tokens, status)
    VALUES (p_doctor_id, CURRENT_DATE, 0, 0, 'in-session')
    ON CONFLICT (doctor_id, queue_date) DO UPDATE SET updated_at = NOW();

    SELECT total_tokens INTO v_next_token
    FROM clinic_queues
    WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE
    FOR UPDATE;

    v_next_token := COALESCE(v_next_token, 0) + 1;
    v_booking_id := 'MED-WLK-' || upper(to_hex(extract(epoch from now())::bigint)) || '-' || upper(substring(md5(random()::text) from 1 for 4));
    v_checkin_token := 'MED-QR-' || lower(encode(gen_random_bytes(16), 'hex'));

    UPDATE clinic_queues
    SET total_tokens = v_next_token, status = 'in-session', updated_at = NOW()
    WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE;

    UPDATE doctors
    SET total_tokens = v_next_token, queue_active = true
    WHERE id = p_doctor_id;

    -- H-19: Store actual demographic values (or null if unknown) without hardcoding fictitious demographics
    INSERT INTO appointments (
        booking_id, patient_id, doctor_id, patient_name, patient_phone, patient_age, patient_gender,
        token_number, status, is_priority, priority_reason, checkin_token, checkin_token_expires_at,
        check_in_time, checkin_token_used_at, appointment_date, scheduled_date, start_at, end_at, timezone, symptoms
    ) VALUES (
        v_booking_id, NULL, p_doctor_id, p_patient_name, COALESCE(p_patient_phone, 'Not specified'),
        p_patient_age, p_patient_gender, v_next_token, 'checked_in', p_is_priority, p_priority_reason,
        v_checkin_token, NOW() + interval '24 hours', NOW(), NOW(), CURRENT_DATE, CURRENT_DATE,
        NULL, NULL, COALESCE(p_timezone, 'Asia/Kolkata'), p_symptoms
    ) RETURNING * INTO v_appointment;

    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'RECEPTION_ISSUE_WALKIN_TOKEN',
        'appointments',
        v_appointment.id,
        jsonb_build_object(
            'token_number', v_next_token,
            'doctor_id', p_doctor_id,
            'patient_name', p_patient_name,
            'is_priority', p_is_priority
        )
    );

    RETURN to_jsonb(v_appointment);
END;
$$;

-- 8B. ATOMIC FUTURE APPOINTMENT SCHEDULING & SLOT RESERVATION RPC (C-07, C-08 & C-09 Resolution)
CREATE OR REPLACE FUNCTION schedule_future_appointment_atomic(
    p_doctor_id UUID,
    p_scheduled_date DATE,
    p_scheduled_slot VARCHAR,
    p_symptoms TEXT DEFAULT 'General medical consultation',
    p_timezone VARCHAR DEFAULT 'Asia/Kolkata'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_patient users%ROWTYPE;
    v_clinical patient_clinical_profiles%ROWTYPE;
    v_booking_id VARCHAR;
    v_checkin_token VARCHAR;
    v_appointment appointments%ROWTYPE;
    v_doctor_verified VARCHAR;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Please sign in to schedule an appointment.';
    END IF;

    IF p_scheduled_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Cannot schedule appointments in the past. Date requested: %', p_scheduled_date;
    END IF;

    SELECT * INTO v_patient FROM users WHERE id = v_actor_id;
    IF v_patient.id IS NULL THEN
        RAISE EXCEPTION 'Patient profile not found.';
    END IF;

    SELECT * INTO v_clinical FROM patient_clinical_profiles WHERE user_id = v_actor_id;

    SELECT verification_status INTO v_doctor_verified FROM doctors WHERE id = p_doctor_id;
    IF v_doctor_verified IS NULL OR v_doctor_verified != 'verified' THEN
        RAISE EXCEPTION 'Doctor is not verified or currently inactive.';
    END IF;

    -- C-07 & C-08: Real slot collision check
    IF EXISTS (
        SELECT 1 FROM appointments
        WHERE doctor_id = p_doctor_id
          AND scheduled_date = p_scheduled_date
          AND scheduled_slot = p_scheduled_slot
          AND status IN ('booked', 'checked_in', 'waiting', 'in-consultation')
    ) THEN
        RAISE EXCEPTION 'Slot collision: Doctor already has an active appointment for % on %. Please select a different slot.', p_scheduled_slot, p_scheduled_date;
    END IF;

    v_booking_id := 'MED-BK-' || upper(to_hex(extract(epoch from now())::bigint)) || '-' || upper(substring(md5(random()::text) from 1 for 4));
    v_checkin_token := 'MED-QR-' || lower(encode(gen_random_bytes(16), 'hex'));

    INSERT INTO appointments (
        booking_id, patient_id, doctor_id, patient_name, patient_phone, patient_age, patient_gender,
        token_number, status, scheduled_slot, checkin_token, checkin_token_expires_at, check_in_time,
        appointment_date, scheduled_date, start_at, end_at, timezone, symptoms
    ) VALUES (
        v_booking_id,
        v_actor_id,
        p_doctor_id,
        v_patient.full_name,
        COALESCE(v_patient.phone, 'Not specified'),
        v_clinical.age,
        v_clinical.gender,
        0, -- Token is issued upon day-of check-in
        'booked',
        p_scheduled_slot,
        v_checkin_token,
        NOW() + interval '48 hours',
        NULL,
        p_scheduled_date,
        p_scheduled_date,
        NULL,
        NULL,
        COALESCE(p_timezone, 'Asia/Kolkata'),
        p_symptoms
    ) RETURNING * INTO v_appointment;

    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'SCHEDULE_FUTURE_APPOINTMENT',
        'appointments',
        v_appointment.id,
        jsonb_build_object(
            'doctor_id', p_doctor_id,
            'scheduled_date', p_scheduled_date,
            'scheduled_slot', p_scheduled_slot,
            'booking_id', v_booking_id
        )
    );

    RETURN to_jsonb(v_appointment);
END;
$$;

-- 9. ATOMIC QUEUE ADVANCEMENT & CONSULTATION RPC (H-13 & H-14 Resolution: Active Verification & Anti-Starvation Scoring)
CREATE OR REPLACE FUNCTION advance_doctor_queue_atomic(
    p_doctor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_is_authorized BOOLEAN;
    v_current_token INT;
    v_queue_status VARCHAR;
    v_next_token_id UUID;
    v_next_token_num INT;
    v_queue_res JSONB;
BEGIN
    v_actor_id := auth.uid();
    
    -- C-07 Resolution: Require non-null authenticated physician identity
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Anonymous users cannot advance clinical queues.';
    END IF;
    
    -- Verify that caller strictly owns the verified doctor profile
    SELECT EXISTS (
        SELECT 1 FROM doctors
        WHERE id = p_doctor_id 
          AND user_id = v_actor_id
          AND verification_status = 'verified'
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized. Only the authenticated, verified physician can advance this queue.';
    END IF;

    SELECT current_token, status INTO v_current_token, v_queue_status
    FROM clinic_queues
    WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE
    FOR UPDATE;

    -- H-14: Explicit queue status verification (cannot advance paused or closed queues)
    IF v_queue_status = 'paused' THEN
        RAISE EXCEPTION 'Cannot advance queue. This clinical queue is currently paused.';
    ELSIF v_queue_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot advance queue. Today''s clinical session is already concluded.';
    END IF;

    -- Complete currently active appointment strictly for CURRENT_DATE
    IF v_current_token > 0 THEN
        UPDATE appointments
        SET status = 'completed', end_at = NOW()
        WHERE doctor_id = p_doctor_id AND scheduled_date = CURRENT_DATE AND token_number = v_current_token AND status = 'in-consultation';
    END IF;

    -- Fetch next waiting patient in line strictly for CURRENT_DATE (H-13 Anti-Starvation Fair Scoring: Emergency priority + wait-time aging)
    SELECT id, token_number INTO v_next_token_id, v_next_token_num
    FROM appointments
    WHERE doctor_id = p_doctor_id AND scheduled_date = CURRENT_DATE AND status = 'waiting'
    ORDER BY 
        (CASE WHEN is_priority THEN 500 ELSE 0 END + (EXTRACT(EPOCH FROM (NOW() - created_at))/60)) DESC,
        token_number ASC
    LIMIT 1;

    IF v_next_token_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'in-consultation', start_at = NOW()
        WHERE id = v_next_token_id;

        UPDATE clinic_queues
        SET current_token = v_next_token_num, status = 'in-session', updated_at = NOW()
        WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE;

        UPDATE doctors
        SET current_token = v_next_token_num, queue_active = true
        WHERE id = p_doctor_id;
    ELSE
        UPDATE clinic_queues
        SET current_token = 0, status = 'completed', updated_at = NOW()
        WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE;

        UPDATE doctors
        SET current_token = 0, queue_active = false
        WHERE id = p_doctor_id;
    END IF;

    -- Audit logging
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (v_actor_id, 'ADVANCE_QUEUE', 'clinic_queues', p_doctor_id, jsonb_build_object('current_token', COALESCE(v_next_token_num, 0)));

    SELECT jsonb_build_object(
        'doctorId', p_doctor_id,
        'currentToken', COALESCE(v_next_token_num, 0),
        'status', CASE WHEN v_next_token_id IS NOT NULL THEN 'in-session' ELSE 'completed' END
    ) INTO v_queue_res;

    RETURN v_queue_res;
END;
$$;

-- 10. ATOMIC TRANSACTIONAL PRESCRIPTION & CONSULTATION COMPLETION RPC (C-08 & Section 9 Resolution: Multi-Table Atomic EMR Write)
CREATE OR REPLACE FUNCTION complete_consultation_rx_atomic(
    p_doctor_id UUID,
    p_token_number INT,
    p_diagnosis TEXT,
    p_medications TEXT[],
    p_advice TEXT,
    p_vitals JSONB DEFAULT NULL,
    p_chief_complaint TEXT DEFAULT NULL,
    p_examination_findings TEXT DEFAULT NULL,
    p_assessment TEXT DEFAULT NULL,
    p_treatment_plan TEXT DEFAULT NULL,
    p_follow_up_date DATE DEFAULT NULL,
    p_lab_orders TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_is_authorized BOOLEAN;
    v_appointment appointments%ROWTYPE;
    v_encounter_id UUID;
    v_prescription_id UUID;
    v_med TEXT;
    v_next_token_id UUID;
    v_next_token_num INT;
    v_result JSONB;
BEGIN
    v_actor_id := auth.uid();

    -- C-08 Resolution: Require authenticated attending physician identity
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Anonymous users cannot complete consultations or issue prescriptions.';
    END IF;

    -- Check physician authorization and ownership
    SELECT EXISTS (
        SELECT 1 FROM doctors
        WHERE id = p_doctor_id 
          AND user_id = v_actor_id
          AND verification_status = 'verified'
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized. Only the attending, verified physician can issue prescriptions.';
    END IF;

    -- 1. Update appointment with clinical prescription strictly scoped to CURRENT_DATE and active consultation state (H-09)
    UPDATE appointments
    SET diagnosis = p_diagnosis,
        medications = p_medications,
        advice = p_advice,
        status = 'completed',
        current_stage = 'pharmacy',
        end_at = NOW()
    WHERE doctor_id = p_doctor_id 
      AND scheduled_date = CURRENT_DATE 
      AND token_number = p_token_number
      AND status IN ('in-consultation', 'waiting')
    RETURNING * INTO v_appointment;

    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Active consultation record not found for Token #% on % (status must be in-consultation or waiting)', p_token_number, CURRENT_DATE;
    END IF;

    -- 2. Insert rich Clinical Encounter (H-06: No fabricated vitals)
    INSERT INTO clinical_encounters (
        appointment_id, doctor_id, patient_id, chief_complaint, vitals,
        examination_findings, assessment, diagnosis, treatment_plan, follow_up_date
    ) VALUES (
        v_appointment.id,
        p_doctor_id,
        v_appointment.patient_id,
        COALESCE(p_chief_complaint, v_appointment.symptoms, 'Clinical evaluation'),
        COALESCE(p_vitals, '{"status": "not_recorded"}'::jsonb),
        COALESCE(p_examination_findings, 'Physical exam recorded by attending physician.'),
        COALESCE(p_assessment, p_diagnosis),
        p_diagnosis,
        COALESCE(p_treatment_plan, p_advice),
        p_follow_up_date
    ) RETURNING id INTO v_encounter_id;

    -- 3. Insert Clinical Prescription Header (Section 9 Resolution)
    INSERT INTO clinical_prescriptions (
        encounter_id, appointment_id, doctor_id, patient_id, diagnosis, advice, follow_up_date
    ) VALUES (
        v_encounter_id,
        v_appointment.id,
        p_doctor_id,
        v_appointment.patient_id,
        p_diagnosis,
        p_advice,
        p_follow_up_date
    ) RETURNING id INTO v_prescription_id;

    -- 4. Insert Itemized Prescription Items (H-07: Structured prescription entries)
    IF p_medications IS NOT NULL AND array_length(p_medications, 1) > 0 THEN
        FOREACH v_med IN ARRAY p_medications LOOP
            IF trim(v_med) != '' THEN
                INSERT INTO prescription_items (
                    prescription_id, drug_name, dosage, frequency, route, duration, instructions
                ) VALUES (
                    v_prescription_id,
                    trim(v_med),
                    'As directed by physician',
                    'As scheduled',
                    'Oral / Systemic',
                    'Course duration per clinical advice',
                    p_advice
                );
            END IF;
        END LOOP;
    END IF;

    -- 4B. Insert Structured Lab Orders (H-08: Itemized one row per test)
    IF p_lab_orders IS NOT NULL AND trim(p_lab_orders) != '' THEN
        DECLARE
            v_lab_item TEXT;
        BEGIN
            FOR v_lab_item IN SELECT unnest(string_to_array(p_lab_orders, ',')) LOOP
                IF trim(v_lab_item) != '' THEN
                    INSERT INTO lab_orders (
                        appointment_id, doctor_id, patient_id, test_name, clinical_notes, status
                    ) VALUES (
                        v_appointment.id,
                        p_doctor_id,
                        v_appointment.patient_id,
                        trim(v_lab_item),
                        'Diagnostic evaluation for: ' || COALESCE(p_diagnosis, 'Clinical indication'),
                        'ordered'
                    );
                END IF;
            END LOOP;
        END;
    END IF;

    -- 5. Advance queue to next waiting patient atomically (H-13 Anti-Starvation Fair Scoring)
    SELECT id, token_number INTO v_next_token_id, v_next_token_num
    FROM appointments
    WHERE doctor_id = p_doctor_id AND scheduled_date = CURRENT_DATE AND status = 'waiting'
    ORDER BY 
        (CASE WHEN is_priority THEN 500 ELSE 0 END + (EXTRACT(EPOCH FROM (NOW() - created_at))/60)) DESC,
        token_number ASC
    LIMIT 1;

    IF v_next_token_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'in-consultation', start_at = NOW()
        WHERE id = v_next_token_id;

        UPDATE clinic_queues
        SET current_token = v_next_token_num, status = 'in-session', updated_at = NOW()
        WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE;

        UPDATE doctors
        SET current_token = v_next_token_num, queue_active = true
        WHERE id = p_doctor_id;
    ELSE
        UPDATE clinic_queues
        SET current_token = 0, status = 'completed', updated_at = NOW()
        WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE;

        UPDATE doctors
        SET current_token = 0, queue_active = false
        WHERE id = p_doctor_id;
    END IF;

    -- 6. Log comprehensive immutable audit event
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'COMPLETE_CONSULTATION_RX',
        'appointments',
        v_appointment.id,
        jsonb_build_object(
            'doctor_id', p_doctor_id,
            'token_number', p_token_number,
            'diagnosis', p_diagnosis,
            'encounter_id', v_encounter_id,
            'prescription_id', v_prescription_id,
            'lab_orders', p_lab_orders,
            'next_token', COALESCE(v_next_token_num, 0)
        )
    );

    SELECT jsonb_build_object(
        'appointmentId', v_appointment.id,
        'encounterId', v_encounter_id,
        'prescriptionId', v_prescription_id,
        'currentToken', COALESCE(v_next_token_num, 0),
        'status', CASE WHEN v_next_token_id IS NOT NULL THEN 'in-session' ELSE 'completed' END
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 11. ATOMIC NO-SHOW / SKIPPED / STATUS OVERRIDE RPC (C-09 Resolution)
CREATE OR REPLACE FUNCTION mark_appointment_status_atomic(
    p_doctor_id UUID,
    p_token_number INT,
    p_status VARCHAR,
    p_reason TEXT DEFAULT 'Status updated by clinic physician.'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_is_authorized BOOLEAN;
    v_appointment_id UUID;
    v_current_token INT;
    v_next_token_id UUID;
    v_next_token_num INT;
BEGIN
    v_actor_id := auth.uid();

    -- C-09 Resolution: Require authenticated attending physician or admin
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Anonymous users cannot update appointment status.';
    END IF;

    IF p_status NOT IN ('no-show', 'skipped', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition: %', p_status;
    END IF;

    -- Check physician authorization
    SELECT EXISTS (
        SELECT 1 FROM doctors
        WHERE id = p_doctor_id 
          AND user_id = v_actor_id
    ) INTO v_is_authorized;

    IF NOT v_is_authorized AND NOT is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Not authorized. Only the attending physician or admin can update consultation status.';
    END IF;

    -- Update the specified appointment
    UPDATE appointments
    SET status = p_status,
        end_at = NOW()
    WHERE doctor_id = p_doctor_id AND scheduled_date = CURRENT_DATE AND token_number = p_token_number
    RETURNING id INTO v_appointment_id;

    IF v_appointment_id IS NULL THEN
        RAISE EXCEPTION 'Appointment Token #% not found on %', p_token_number, CURRENT_DATE;
    END IF;

    -- Check if we need to advance the queue
    SELECT current_token INTO v_current_token
    FROM clinic_queues
    WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE
    FOR UPDATE;

    IF v_current_token = p_token_number THEN
        -- Fetch next waiting patient in line (H-13 Anti-Starvation Fair Scoring)
        SELECT id, token_number INTO v_next_token_id, v_next_token_num
        FROM appointments
        WHERE doctor_id = p_doctor_id AND scheduled_date = CURRENT_DATE AND status = 'waiting'
        ORDER BY 
            (CASE WHEN is_priority THEN 500 ELSE 0 END + (EXTRACT(EPOCH FROM (NOW() - created_at))/60)) DESC,
            token_number ASC
        LIMIT 1;

        IF v_next_token_id IS NOT NULL THEN
            UPDATE appointments
            SET status = 'in-consultation', start_at = NOW()
            WHERE id = v_next_token_id;

            UPDATE clinic_queues
            SET current_token = v_next_token_num, status = 'in-session', updated_at = NOW()
            WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE;

            UPDATE doctors
            SET current_token = v_next_token_num, queue_active = true
            WHERE id = p_doctor_id;
        ELSE
            UPDATE clinic_queues
            SET current_token = 0, status = 'completed', updated_at = NOW()
            WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE;

            UPDATE doctors
            SET current_token = 0, queue_active = false
            WHERE id = p_doctor_id;
        END IF;
    END IF;

    -- Audit log
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'MARK_APPOINTMENT_' || upper(p_status),
        'appointments',
        v_appointment_id,
        jsonb_build_object(
            'doctor_id', p_doctor_id,
            'token_number', p_token_number,
            'status', p_status,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object(
        'appointmentId', v_appointment_id,
        'status', p_status,
        'currentToken', COALESCE(v_next_token_num, v_current_token)
    );
END;
$$;

-- 12. ATOMIC EMERGENCY / PRIORITY OVERRIDE RPC (C-10 Resolution: Strict Physician/Admin Authentication)
CREATE OR REPLACE FUNCTION flag_priority_appointment_atomic(
    p_doctor_id UUID,
    p_token_number INT,
    p_reason TEXT DEFAULT 'Emergency clinical triage priority requested.'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_is_authorized BOOLEAN;
    v_appointment_id UUID;
BEGIN
    v_actor_id := auth.uid();

    -- C-10: Require non-null authenticated identity
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Anonymous users cannot flag emergency triage priority.';
    END IF;

    -- Check physician authorization or admin
    SELECT EXISTS (
        SELECT 1 FROM doctors
        WHERE id = p_doctor_id 
          AND user_id = v_actor_id
          AND verification_status = 'verified'
    ) INTO v_is_authorized;

    IF NOT v_is_authorized AND NOT is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Not authorized. Only the attending physician or medical administrators can flag emergency triage priority.';
    END IF;

    UPDATE appointments
    SET is_priority = true,
        priority_reason = p_reason
    WHERE doctor_id = p_doctor_id AND scheduled_date = CURRENT_DATE AND token_number = p_token_number
    RETURNING id INTO v_appointment_id;

    IF v_appointment_id IS NULL THEN
        RAISE EXCEPTION 'Appointment Token #% not found on %', p_token_number, CURRENT_DATE;
    END IF;

    -- Log immutable audit event for priority override
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'PRIORITY_TRIAGE_OVERRIDE',
        'appointments',
        v_appointment_id,
        jsonb_build_object(
            'doctor_id', p_doctor_id,
            'token_number', p_token_number,
            'reason', p_reason,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object(
        'appointmentId', v_appointment_id,
        'isPriority', true,
        'tokenNumber', p_token_number
    );
END;
$$;

-- 13. ATOMIC QR CODE CHECK-IN RPC (C-13, C-25 & C-26 Resolution: Expiry, Replay Protection & High-Entropy Credential Only)
CREATE OR REPLACE FUNCTION check_in_patient_qr_atomic(
    p_checkin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_appointment appointments%ROWTYPE;
    v_is_authorized BOOLEAN;
BEGIN
    v_actor_id := auth.uid();

    -- C-13: Require non-null authenticated identity
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Reception staff, attending doctors, or the patient must be authenticated to check in.';
    END IF;

    -- C-26: Strictly look up appointment by dedicated high-entropy checkin_token (never booking_id)
    SELECT * INTO v_appointment
    FROM appointments
    WHERE checkin_token = p_checkin_token;

    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Invalid check-in token credential.';
    END IF;

    -- C-25: Server-side token expiration and replay prevention checks
    IF v_appointment.checkin_token_expires_at IS NOT NULL AND v_appointment.checkin_token_expires_at < NOW() THEN
        RAISE EXCEPTION 'QR check-in token has expired (24h validity window elapsed).';
    END IF;

    IF v_appointment.checkin_token_used_at IS NOT NULL OR v_appointment.status = 'checked_in' THEN
        RAISE EXCEPTION 'This check-in pass has already been used on %.', v_appointment.check_in_time;
    END IF;

    IF v_appointment.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot check-in. Consultation status is already %', v_appointment.status;
    END IF;

    -- C-13: Authorize only receptionists, admins, attending physicians, or the patient who owns the booking
    SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;

    v_is_authorized := (
        v_actor_role IN ('receptionist', 'admin')
        OR v_appointment.patient_id = v_actor_id
        OR v_appointment.doctor_id IN (SELECT id FROM doctors WHERE user_id = v_actor_id)
        OR is_admin(v_actor_id)
    );

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: You are not authorized to perform check-in for this appointment pass.';
    END IF;

    UPDATE appointments
    SET status = 'checked_in',
        check_in_time = NOW(),
        checkin_token_used_at = NOW()
    WHERE id = v_appointment.id
    RETURNING * INTO v_appointment;

    -- Log reception audit event
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'RECEPTION_QR_CHECKIN',
        'appointments',
        v_appointment.id,
        jsonb_build_object(
            'booking_id', v_appointment.booking_id,
            'token_number', v_appointment.token_number,
            'actor_role', COALESCE(v_actor_role, 'patient'),
            'checkin_token_used_at', NOW()
        )
    );

    RETURN to_jsonb(v_appointment);
END;
$$;

-- 14. ATOMIC QUEUE TRANSFER RPC (C-14, H-09 & H-10 Resolution: Verification, Upsert & Concurrency Safety)
CREATE OR REPLACE FUNCTION transfer_patient_queue_atomic(
    p_appointment_id UUID,
    p_target_doctor_id UUID,
    p_reason TEXT DEFAULT 'Physician referral transfer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_appointment appointments%ROWTYPE;
    v_is_authorized BOOLEAN;
    v_new_token INT;
BEGIN
    v_actor_id := auth.uid();

    -- C-14: Require non-null authenticated identity
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Only clinic staff, attending physicians, or administrators can transfer queues.';
    END IF;

    SELECT * INTO v_appointment
    FROM appointments
    WHERE id = p_appointment_id;

    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment record not found.';
    END IF;

    IF v_appointment.status IN ('completed', 'cancelled', 'no-show') THEN
        RAISE EXCEPTION 'Cannot transfer appointment in % status.', v_appointment.status;
    END IF;

    -- H-10: Target Doctor Validation
    IF p_target_doctor_id = v_appointment.doctor_id THEN
        RAISE EXCEPTION 'Cannot transfer patient to the same attending physician.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM doctors WHERE id = p_target_doctor_id AND verification_status = 'verified') THEN
        RAISE EXCEPTION 'Target physician is not accredited, active, or verified.';
    END IF;

    -- C-14: Actor Authorization Check: Receptionist, Admin, or Current Attending Doctor
    SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;

    v_is_authorized := (
        v_actor_role IN ('receptionist', 'admin')
        OR v_appointment.doctor_id IN (SELECT id FROM doctors WHERE user_id = v_actor_id)
        OR is_admin(v_actor_id)
    );

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: You do not have permission to transfer patients between queues.';
    END IF;

    -- H-09: Ensure target doctor clinic queue row exists with row lock (Atomic Upsert)
    INSERT INTO clinic_queues (doctor_id, queue_date, current_token, total_tokens, status)
    VALUES (p_target_doctor_id, CURRENT_DATE, 0, 0, 'in-session')
    ON CONFLICT (doctor_id, queue_date) DO UPDATE
    SET updated_at = NOW();

    -- Allocate next sequential token on target doctor queue with row-level lock
    SELECT total_tokens INTO v_new_token
    FROM clinic_queues
    WHERE doctor_id = p_target_doctor_id AND queue_date = CURRENT_DATE
    FOR UPDATE;

    v_new_token := COALESCE(v_new_token, 0) + 1;

    UPDATE clinic_queues
    SET total_tokens = v_new_token, status = 'in-session', updated_at = NOW()
    WHERE doctor_id = p_target_doctor_id AND queue_date = CURRENT_DATE;

    -- H-11: Reconcile source doctor queue if transferred patient was currently in-consultation
    IF v_appointment.status = 'in-consultation' THEN
        DECLARE
            v_source_current_token INT;
            v_source_next_id UUID;
            v_source_next_token INT;
        BEGIN
            SELECT current_token INTO v_source_current_token
            FROM clinic_queues
            WHERE doctor_id = v_appointment.doctor_id AND queue_date = CURRENT_DATE
            FOR UPDATE;

            IF v_source_current_token = v_appointment.token_number THEN
                SELECT id, token_number INTO v_source_next_id, v_source_next_token
                FROM appointments
                WHERE doctor_id = v_appointment.doctor_id AND scheduled_date = CURRENT_DATE AND status = 'waiting' AND id != p_appointment_id
                ORDER BY 
                    (CASE WHEN is_priority THEN 500 ELSE 0 END + (EXTRACT(EPOCH FROM (NOW() - created_at))/60)) DESC,
                    token_number ASC
                LIMIT 1;

                IF v_source_next_id IS NOT NULL THEN
                    UPDATE appointments SET status = 'in-consultation', start_at = NOW() WHERE id = v_source_next_id;
                    UPDATE clinic_queues SET current_token = v_source_next_token, status = 'in-session', updated_at = NOW() WHERE doctor_id = v_appointment.doctor_id AND queue_date = CURRENT_DATE;
                    UPDATE doctors SET current_token = v_source_next_token, queue_active = true WHERE id = v_appointment.doctor_id;
                ELSE
                    UPDATE clinic_queues SET current_token = 0, status = 'idle', updated_at = NOW() WHERE doctor_id = v_appointment.doctor_id AND queue_date = CURRENT_DATE;
                    UPDATE doctors SET current_token = 0, queue_active = false WHERE id = v_appointment.doctor_id;
                END IF;
            END IF;
        END;
    END IF;

    UPDATE appointments
    SET doctor_id = p_target_doctor_id,
        token_number = v_new_token,
        status = 'waiting'
    WHERE id = p_appointment_id
    RETURNING * INTO v_appointment;

    -- Audit log transfer
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'QUEUE_PATIENT_TRANSFER',
        'appointments',
        p_appointment_id,
        jsonb_build_object(
            'source_doctor_id', v_appointment.doctor_id,
            'target_doctor_id', p_target_doctor_id,
            'new_token_number', v_new_token,
            'reason', p_reason,
            'actor_role', COALESCE(v_actor_role, 'staff')
        )
    );

    RETURN to_jsonb(v_appointment);
END;
$$;

-- 15. ATOMIC APPOINTMENT RESCHEDULING RPC (H-07 & H-08 Resolution: Slot Collision & Lifecycle Guardrails)
CREATE OR REPLACE FUNCTION reschedule_appointment_atomic(
    p_appointment_id UUID,
    p_new_date DATE,
    p_new_slot VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_appointment appointments%ROWTYPE;
    v_is_authorized BOOLEAN;
BEGIN
    v_actor_id := auth.uid();

    -- C-15: Require non-null authenticated identity
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to reschedule appointments.';
    END IF;

    -- H-08: Prevent rescheduling to past dates
    IF p_new_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Cannot reschedule appointment to a past date.';
    END IF;

    SELECT * INTO v_appointment
    FROM appointments
    WHERE id = p_appointment_id;

    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment record not found.';
    END IF;

    -- H-08: Validate appointment status allows rescheduling (block completed, cancelled, no-show)
    IF v_appointment.status IN ('completed', 'cancelled', 'no-show') THEN
        RAISE EXCEPTION 'Cannot reschedule an appointment in % status.', v_appointment.status;
    END IF;

    -- H-08: Role-specific authorization (patient owner, attending doctor, receptionist, or admin)
    SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;

    v_is_authorized := (
        v_appointment.patient_id = v_actor_id
        OR v_appointment.doctor_id IN (SELECT id FROM doctors WHERE user_id = v_actor_id)
        OR v_actor_role IN ('receptionist', 'admin')
        OR is_admin(v_actor_id)
    );

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access Denied: You are not authorized to reschedule this appointment.';
    END IF;

    -- H-07: Slot collision check for target doctor on target date & slot
    IF p_new_slot IS NOT NULL AND p_new_slot != '' THEN
        IF EXISTS (
            SELECT 1 FROM appointments
            WHERE doctor_id = v_appointment.doctor_id
              AND scheduled_date = p_new_date
              AND scheduled_slot = p_new_slot
              AND id != p_appointment_id
              AND status IN ('booked', 'checked_in', 'waiting', 'in-consultation')
        ) THEN
            RAISE EXCEPTION 'Requested time slot (%) is already booked for this doctor on %. Please select a different slot.', p_new_slot, p_new_date;
        END IF;
    END IF;

    UPDATE appointments
    SET scheduled_date = p_new_date,
        appointment_date = p_new_date,
        scheduled_slot = p_new_slot,
        status = 'booked'
    WHERE id = p_appointment_id
    RETURNING * INTO v_appointment;

    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'RESCHEDULE_APPOINTMENT',
        'appointments',
        p_appointment_id,
        jsonb_build_object(
            'new_date', p_new_date,
            'new_slot', p_new_slot,
            'rescheduled_by_role', COALESCE(v_actor_role, 'patient')
        )
    );

    RETURN to_jsonb(v_appointment);
END;
$$;

-- 16. PROTECTED ADMIN DOCTOR VERIFICATION RPC (C-09 Resolution)
CREATE OR REPLACE FUNCTION verify_doctor_admin_atomic(
    p_doctor_id UUID,
    p_approved BOOLEAN,
    p_reason TEXT DEFAULT 'Medical board credentials review concluded.'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin_id UUID;
    v_is_admin BOOLEAN;
    v_mediarca_id VARCHAR;
    v_doctor doctors%ROWTYPE;
BEGIN
    v_admin_id := auth.uid();
    
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Only authenticated administrators can verify doctor credentials.';
    END IF;

    -- Verify admin role authorization
    SELECT is_admin(v_admin_id) INTO v_is_admin;
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access Denied: Only authenticated Medical Board Administrators can verify practitioner licenses.';
    END IF;

    IF p_approved THEN
        v_mediarca_id := 'MED-DOC-' || upper(substring(md5(random()::text) from 1 for 4));
        UPDATE doctors
        SET verification_status = 'verified',
            mediarca_id = v_mediarca_id,
            verified_at = NOW()
        WHERE id = p_doctor_id
        RETURNING * INTO v_doctor;

        -- Ensure clinic queue exists for newly verified doctor
        INSERT INTO clinic_queues (doctor_id, queue_date, current_token, total_tokens, status)
        VALUES (p_doctor_id, CURRENT_DATE, 0, 0, 'idle')
        ON CONFLICT (doctor_id, queue_date) DO NOTHING;
    ELSE
        UPDATE doctors
        SET verification_status = 'rejected',
            mediarca_id = NULL
        WHERE id = p_doctor_id
        RETURNING * INTO v_doctor;
    END IF;

    -- Insert immutable audit record
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_admin_id,
        CASE WHEN p_approved THEN 'APPROVE_DOCTOR_LICENSE' ELSE 'REJECT_DOCTOR_LICENSE' END,
        'doctors',
        p_doctor_id,
        jsonb_build_object(
            'decision', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
            'reason', p_reason,
            'mediarca_id', v_mediarca_id,
            'timestamp', NOW()
        )
    );

    RETURN to_jsonb(v_doctor);
END;
$$;

-- 17. PATIENT FLOW MULTI-STAGE ROUTING RPC (C-05 Resolution: Enforce Attending Doctor / Reception Staff Authorization)
CREATE OR REPLACE FUNCTION update_patient_stage_atomic(
    p_appointment_id UUID,
    p_stage VARCHAR,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_appointment appointments%ROWTYPE;
    v_doctor doctors%ROWTYPE;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found.';
    END IF;

    SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;
    SELECT * INTO v_doctor FROM doctors WHERE id = v_appointment.doctor_id;

    -- C-05: Strict record authorization: Doctor must be the assigned attending physician, or staff must be receptionist/admin
    IF v_actor_role = 'doctor' AND v_doctor.user_id != v_actor_id THEN
        RAISE EXCEPTION 'Access Denied: Only the assigned attending physician can transition clinical stages for this appointment.';
    ELSIF v_actor_role NOT IN ('doctor', 'receptionist', 'admin') AND NOT is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Access Denied: Administrative or clinical staff privileges required.';
    END IF;

    -- H-11: State transition workflow validation
    IF COALESCE(v_appointment.current_stage, 'triage') = 'discharged' AND p_stage != 'discharged' THEN
        RAISE EXCEPTION 'Cannot transition stage: Patient has already concluded clinical episode and been discharged.';
    ELSIF COALESCE(v_appointment.current_stage, 'triage') = 'triage' AND p_stage = 'discharged' THEN
        RAISE EXCEPTION 'Invalid clinical workflow transition: Patient in triage must undergo physician consultation or evaluation prior to discharge.';
    END IF;

    -- H-10: Persist current_stage directly to appointment domain record
    UPDATE appointments
    SET current_stage = p_stage
    WHERE id = p_appointment_id;

    -- Record flow transition in audit ledger
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'PATIENT_STAGE_TRANSITION',
        'appointments',
        p_appointment_id,
        jsonb_build_object(
            'new_stage', p_stage,
            'notes', p_notes,
            'actor_role', COALESCE(v_actor_role, 'staff'),
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object('appointmentId', p_appointment_id, 'stage', p_stage, 'status', 'updated');
END;
$$;

-- 18. STATUTORY DIGITAL CONSENT RECORDING RPC (C-06 Resolution: Enforce Explicit Consent Affirmation)
CREATE OR REPLACE FUNCTION record_patient_consent_atomic(
    p_consent_type VARCHAR,
    p_version VARCHAR DEFAULT 'v2026.1',
    p_terms_accepted BOOLEAN DEFAULT true,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_consent_id UUID;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to record statutory consent.';
    END IF;

    -- C-06: Strict validation: Reject false/null terms acceptance
    IF p_terms_accepted IS NULL OR p_terms_accepted = false THEN
        RAISE EXCEPTION 'Consent not accepted: Statutory terms and HIPAA policies must be affirmatively accepted.';
    END IF;

    INSERT INTO patient_consents (
        user_id, consent_type, consent_text_version, terms_accepted, granted_at
    ) VALUES (
        v_actor_id,
        p_consent_type,
        p_version,
        p_terms_accepted,
        NOW()
    ) RETURNING id INTO v_consent_id;

    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'RECORD_DIGITAL_CONSENT',
        'patient_consents',
        v_consent_id,
        jsonb_build_object(
            'consent_type', p_consent_type,
            'version', p_version,
            'accepted', p_terms_accepted,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object('consentId', v_consent_id, 'userId', v_actor_id, 'status', 'granted', 'timestamp', NOW());
END;
$$;

-- 19. SERVER-AUTHORITATIVE BILLING & INVOICE RPC (C-02 Resolution: Enforce Patient / Staff Authorization)
CREATE OR REPLACE FUNCTION generate_and_settle_invoice_atomic(
    p_appointment_id UUID,
    p_payment_method VARCHAR DEFAULT 'Card',
    p_insurance_provider VARCHAR DEFAULT NULL,
    p_insurance_coverage NUMERIC DEFAULT 0.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_appointment appointments%ROWTYPE;
    v_doctor doctors%ROWTYPE;
    v_base_fee NUMERIC;
    v_insurance_paid NUMERIC;
    v_patient_paid NUMERIC;
    v_invoice_num VARCHAR;
    v_invoice patient_invoices%ROWTYPE;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found.';
    END IF;

    SELECT * INTO v_doctor FROM doctors WHERE id = v_appointment.doctor_id;
    SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;

    -- C-02: Strict record authorization: Must be appointment patient, attending doctor, receptionist, or admin
    IF v_actor_id != v_appointment.patient_id 
       AND v_doctor.user_id != v_actor_id 
       AND v_actor_role NOT IN ('receptionist', 'admin') 
       AND NOT is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Access Denied: You are not authorized to create or settle invoices for this appointment.';
    END IF;

    -- Fetch authoritative doctor fee from database
    v_base_fee := COALESCE(v_doctor.fee, 50.00);

    -- Calculate server-authoritative insurance breakdown
    v_insurance_paid := ROUND(v_base_fee * (COALESCE(p_insurance_coverage, 0.00) / 100.0), 2);
    v_patient_paid := v_base_fee - v_insurance_paid;

    v_invoice_num := 'INV-2026-' || upper(to_hex(extract(epoch from now())::bigint)) || '-' || upper(substring(md5(random()::text) from 1 for 4));

    INSERT INTO patient_invoices (
        appointment_id, patient_id, invoice_number, total_amount, insurance_covered_amount,
        patient_paid_amount, payment_status, payment_method, insurance_provider, settled_at
    ) VALUES (
        p_appointment_id,
        v_appointment.patient_id,
        v_invoice_num,
        v_base_fee,
        v_insurance_paid,
        v_patient_paid,
        'paid',
        p_payment_method,
        COALESCE(p_insurance_provider, 'MediShield Global Health'),
        NOW()
    ) RETURNING * INTO v_invoice;

    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'SETTLE_INVOICE_PAYMENT',
        'patient_invoices',
        v_invoice.id,
        jsonb_build_object(
            'invoice_number', v_invoice_num,
            'total_amount', v_base_fee,
            'patient_paid', v_patient_paid,
            'payment_method', p_payment_method,
            'timestamp', NOW()
        )
    );

    RETURN to_jsonb(v_invoice);
END;
$$;

-- 20. TELEMEDICINE SECURE ROOM RPC (C-03 Resolution: Participant Authorization Enforcement)
CREATE OR REPLACE FUNCTION create_telemedicine_room_atomic(
    p_appointment_id UUID,
    p_room_name VARCHAR DEFAULT 'MediArca Virtual Suite'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_appointment appointments%ROWTYPE;
    v_doctor doctors%ROWTYPE;
    v_room telemedicine_rooms%ROWTYPE;
    v_token VARCHAR;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create telemedicine room.';
    END IF;

    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment not found.';
    END IF;

    SELECT * INTO v_doctor FROM doctors WHERE id = v_appointment.doctor_id;
    SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;

    -- C-03: Participant authorization: Only appointment patient, attending doctor, receptionist, or admin
    IF v_actor_id != v_appointment.patient_id 
       AND v_doctor.user_id != v_actor_id 
       AND v_actor_role NOT IN ('receptionist', 'admin') 
       AND NOT is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Access Denied: Only registered consultation participants or clinical staff can initialize telemedicine rooms.';
    END IF;

    -- Generate high-entropy 128-bit session credential
    v_token := 'MED-RTC-' || lower(encode(gen_random_bytes(16), 'hex'));

    INSERT INTO telemedicine_rooms (
        appointment_id, doctor_id, patient_id, room_name, room_token, session_status, expires_at
    ) VALUES (
        p_appointment_id,
        v_appointment.doctor_id,
        v_appointment.patient_id,
        p_room_name,
        v_token,
        'active',
        NOW() + interval '2 hours'
    ) RETURNING * INTO v_room;

    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'CREATE_TELEMEDICINE_SESSION',
        'telemedicine_rooms',
        v_room.id,
        jsonb_build_object('appointment_id', p_appointment_id, 'room_name', p_room_name, 'timestamp', NOW())
    );

    RETURN to_jsonb(v_room);
END;
$$;

-- 21. REAL AGGREGATE HOSPITAL OPERATIONAL ANALYTICS RPC (C-04 Resolution: Restrict to Management & Staff)
CREATE OR REPLACE FUNCTION get_hospital_operational_analytics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_total_appointments INT;
    v_completed_appointments INT;
    v_noshow_appointments INT;
    v_active_queues INT;
    v_total_revenue NUMERIC;
    v_avg_wait NUMERIC;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- C-04: Restrict operational and financial analytics strictly to reception/admin staff
    SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;
    IF v_actor_role NOT IN ('receptionist', 'admin') AND NOT is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Access Denied: Hospital operational analytics restricted to management and administrative staff.';
    END IF;

    -- Aggregate counts directly from authoritative tables
    SELECT COUNT(*) INTO v_total_appointments FROM appointments WHERE scheduled_date = CURRENT_DATE;
    SELECT COUNT(*) INTO v_completed_appointments FROM appointments WHERE scheduled_date = CURRENT_DATE AND status = 'completed';
    SELECT COUNT(*) INTO v_noshow_appointments FROM appointments WHERE scheduled_date = CURRENT_DATE AND status = 'no-show';
    SELECT COUNT(*) INTO v_active_queues FROM clinic_queues WHERE queue_date = CURRENT_DATE AND status = 'in-session';
    SELECT COALESCE(SUM(total_amount), 0.00) INTO v_total_revenue FROM patient_invoices WHERE DATE(settled_at) = CURRENT_DATE;

    -- H-24: Calculate real measured wait times from check_in_time to start_at
    SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (start_at - check_in_time)) / 60.0),
        12.0
    ) INTO v_avg_wait 
    FROM appointments 
    WHERE scheduled_date = CURRENT_DATE 
      AND check_in_time IS NOT NULL 
      AND start_at IS NOT NULL;

    RETURN jsonb_build_object(
        'date', CURRENT_DATE,
        'totalAppointmentsToday', v_total_appointments,
        'completedConsultations', v_completed_appointments,
        'noShowCount', v_noshow_appointments,
        'activeQueues', v_active_queues,
        'averageWaitTimeMins', ROUND(v_avg_wait, 1),
        'todayRevenue', v_total_revenue,
        'timestamp', NOW()
    );
END;
$$;

-- 12. EXPLICIT RPC EXECUTE PERMISSION ENFORCEMENT (C-06 Resolution: Privileged RPCs Granted ONLY to Authenticated Role)
REVOKE ALL ON FUNCTION issue_next_opd_token(UUID, TEXT, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION issue_next_opd_token(UUID, TEXT, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION advance_doctor_queue_atomic(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION advance_doctor_queue_atomic(UUID) TO authenticated;

REVOKE ALL ON FUNCTION complete_consultation_rx_atomic(UUID, INT, TEXT, TEXT[], TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_consultation_rx_atomic(UUID, INT, TEXT, TEXT[], TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION mark_appointment_status_atomic(UUID, INT, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_appointment_status_atomic(UUID, INT, VARCHAR, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION update_patient_stage_atomic(UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_patient_stage_atomic(UUID, VARCHAR, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION record_patient_consent_atomic(VARCHAR, VARCHAR, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_patient_consent_atomic(VARCHAR, VARCHAR, BOOLEAN, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION generate_and_settle_invoice_atomic(UUID, VARCHAR, VARCHAR, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_and_settle_invoice_atomic(UUID, VARCHAR, VARCHAR, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION create_telemedicine_room_atomic(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_telemedicine_room_atomic(UUID, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION get_hospital_operational_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_hospital_operational_analytics() TO authenticated;

REVOKE ALL ON FUNCTION flag_priority_appointment_atomic(UUID, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION flag_priority_appointment_atomic(UUID, INT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION verify_doctor_admin_atomic(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION verify_doctor_admin_atomic(UUID, BOOLEAN, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION check_in_patient_qr_atomic(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_in_patient_qr_atomic(VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION transfer_patient_queue_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION transfer_patient_queue_atomic(UUID, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION reschedule_appointment_atomic(UUID, DATE, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reschedule_appointment_atomic(UUID, DATE, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION issue_reception_walkin_token(UUID, VARCHAR, VARCHAR, INT, VARCHAR, TEXT, BOOLEAN, TEXT, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION issue_reception_walkin_token(UUID, VARCHAR, VARCHAR, INT, VARCHAR, TEXT, BOOLEAN, TEXT, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION schedule_future_appointment_atomic(UUID, DATE, VARCHAR, TEXT, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION schedule_future_appointment_atomic(UUID, DATE, VARCHAR, TEXT, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION transition_appointment_status_atomic(UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION transition_appointment_status_atomic(UUID, VARCHAR, TEXT) TO authenticated;

-- 13. STRICT RESTRICTIVE ROW LEVEL SECURITY (RLS) POLICIES (C-07 & C-08 Resolution)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- USERS TABLE POLICIES (Strict identity linkage: id = auth.uid() - C-04 Resolution)
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (
    auth.uid() = id
);

DROP POLICY IF EXISTS "Users can create own profile" ON users;
DROP POLICY IF EXISTS "Public can register user profile" ON users;
CREATE POLICY "Users can create own profile" ON users FOR INSERT WITH CHECK (
    auth.uid() = id
);

DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (
    auth.uid() = id
);

-- DOCTORS TABLE POLICIES (Practitioners insert ONLY for own user_id as pending - C-05 Resolution)
DROP POLICY IF EXISTS "Public can view verified doctors" ON doctors;
CREATE POLICY "Public can view verified doctors" ON doctors FOR SELECT USING (
    verification_status = 'verified' OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "Practitioners can submit accreditation application" ON doctors;
CREATE POLICY "Practitioners can submit accreditation application" ON doctors FOR INSERT WITH CHECK (
    auth.uid() = user_id AND verification_status = 'pending'
);

DROP POLICY IF EXISTS "Doctor can update own practitioner profile" ON doctors;
CREATE POLICY "Doctor can update own practitioner profile" ON doctors FOR UPDATE USING (
    auth.uid() = user_id
);

-- CLINIC QUEUES TABLE POLICIES (M-01 Resolution: Restrict Public Read to Today's Active Queues)
DROP POLICY IF EXISTS "Public can read live queue telemetry" ON clinic_queues;
CREATE POLICY "Public can read live queue telemetry" ON clinic_queues FOR SELECT USING (
    queue_date = CURRENT_DATE
);

DROP POLICY IF EXISTS "Doctor can update own queue" ON clinic_queues;
CREATE POLICY "Doctor can update own queue" ON clinic_queues FOR ALL USING (
    doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
);

-- 22. MINIMAL PUBLIC QUEUE TELEMETRY VIEW (M-02 Resolution)
CREATE OR REPLACE VIEW public_queue_telemetry AS
SELECT 
    cq.id AS queue_id,
    cq.doctor_id,
    d.name AS doctor_name,
    d.specialty,
    cq.queue_date,
    cq.current_token,
    cq.total_tokens,
    cq.status,
    cq.avg_consult_time_mins,
    cq.updated_at
FROM clinic_queues cq
JOIN doctors d ON d.id = cq.doctor_id
WHERE cq.queue_date = CURRENT_DATE AND d.verification_status = 'verified';

GRANT SELECT ON public_queue_telemetry TO anon, authenticated;

-- APPOINTMENTS TABLE POLICIES (Strict isolated access between patient & doctor)
DROP POLICY IF EXISTS "Patients and Doctors can access relevant appointments" ON appointments;
CREATE POLICY "Patients and Doctors can access relevant appointments" ON appointments FOR SELECT USING (
    patient_id = auth.uid() OR doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated patient or doctor can create appointment" ON appointments;
CREATE POLICY "Authenticated patient or doctor can create appointment" ON appointments FOR INSERT WITH CHECK (
    patient_id = auth.uid() OR doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Doctor can update consultation status and prescription" ON appointments;
CREATE POLICY "Doctor can update consultation status and prescription" ON appointments FOR UPDATE USING (
    doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
);

-- PATIENT CLINICAL PROFILES RLS (D-02 & D-03 Resolution: Strict Medical Isolation)
ALTER TABLE patient_clinical_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can manage own clinical profile" ON patient_clinical_profiles;
CREATE POLICY "Patients can manage own clinical profile" ON patient_clinical_profiles FOR ALL USING (
    auth.uid() = user_id
);

DROP POLICY IF EXISTS "Attending doctors can view patient clinical profile" ON patient_clinical_profiles;
CREATE POLICY "Attending doctors can view patient clinical profile" ON patient_clinical_profiles FOR SELECT USING (
    user_id IN (
        SELECT patient_id FROM appointments 
        WHERE doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
          AND scheduled_date = CURRENT_DATE
    )
);

-- CLINICAL ENCOUNTERS RLS (C-19 Resolution: Patients Read-Only; Attending Physicians Manage)
ALTER TABLE clinical_encounters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Encounter access" ON clinical_encounters;
DROP POLICY IF EXISTS "Patients can view own encounters" ON clinical_encounters;
DROP POLICY IF EXISTS "Attending doctors can manage encounters" ON clinical_encounters;

CREATE POLICY "Patients can view own encounters" ON clinical_encounters
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid());

CREATE POLICY "Attending doctors can manage encounters" ON clinical_encounters
    FOR ALL TO authenticated
    USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()) OR is_admin(auth.uid()))
    WITH CHECK (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()) OR is_admin(auth.uid()));

-- CLINICAL PRESCRIPTIONS RLS (C-20 Resolution: Patients Read-Only; Licensed Doctors Prescribe)
ALTER TABLE clinical_prescriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Prescription access" ON clinical_prescriptions;
DROP POLICY IF EXISTS "Patients can view own prescriptions" ON clinical_prescriptions;
DROP POLICY IF EXISTS "Doctors can manage prescriptions" ON clinical_prescriptions;

CREATE POLICY "Patients can view own prescriptions" ON clinical_prescriptions
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid());

CREATE POLICY "Doctors can manage prescriptions" ON clinical_prescriptions
    FOR ALL TO authenticated
    USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()) OR is_admin(auth.uid()))
    WITH CHECK (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()) OR is_admin(auth.uid()));

-- PRESCRIPTION ITEMS RLS (C-21 Resolution: Patients Read-Only; Doctors Mutate Items)
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Prescription items access" ON prescription_items;
DROP POLICY IF EXISTS "Patients can view own prescription items" ON prescription_items;
DROP POLICY IF EXISTS "Doctors can manage prescription items" ON prescription_items;

CREATE POLICY "Patients can view own prescription items" ON prescription_items
    FOR SELECT TO authenticated
    USING (
        prescription_id IN (
            SELECT id FROM clinical_prescriptions WHERE patient_id = auth.uid()
        )
    );

CREATE POLICY "Doctors can manage prescription items" ON prescription_items
    FOR ALL TO authenticated
    USING (
        prescription_id IN (
            SELECT id FROM clinical_prescriptions 
            WHERE doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
        ) OR is_admin(auth.uid())
    )
    WITH CHECK (
        prescription_id IN (
            SELECT id FROM clinical_prescriptions 
            WHERE doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
        ) OR is_admin(auth.uid())
    );

-- LAB ORDERS & RESULTS RLS (C-22 Resolution: Patients Read-Only; Doctors/Labs Manage)
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lab orders access" ON lab_orders;
DROP POLICY IF EXISTS "Patients can view own lab orders" ON lab_orders;
DROP POLICY IF EXISTS "Doctors can manage lab orders" ON lab_orders;

CREATE POLICY "Patients can view own lab orders" ON lab_orders
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid());

CREATE POLICY "Doctors can manage lab orders" ON lab_orders
    FOR ALL TO authenticated
    USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()) OR is_admin(auth.uid()))
    WITH CHECK (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()) OR is_admin(auth.uid()));

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lab results access" ON lab_results;
DROP POLICY IF EXISTS "Patients can view own lab results" ON lab_results;
DROP POLICY IF EXISTS "Doctors and lab techs can manage results" ON lab_results;

CREATE POLICY "Patients can view own lab results" ON lab_results
    FOR SELECT TO authenticated
    USING (
        order_id IN (SELECT id FROM lab_orders WHERE patient_id = auth.uid())
    );

CREATE POLICY "Doctors and lab techs can manage results" ON lab_results
    FOR ALL TO authenticated
    USING (
        order_id IN (
            SELECT id FROM lab_orders 
            WHERE doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
        ) OR is_admin(auth.uid())
    )
    WITH CHECK (
        order_id IN (
            SELECT id FROM lab_orders 
            WHERE doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
        ) OR is_admin(auth.uid())
    );

-- CLINICAL DOCUMENTS RLS (Patients Upload Own & View; Attending Doctors View)
ALTER TABLE clinical_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clinical documents access" ON clinical_documents;
DROP POLICY IF EXISTS "Patients can view own documents" ON clinical_documents;
DROP POLICY IF EXISTS "Patients can upload own documents" ON clinical_documents;
DROP POLICY IF EXISTS "Attending doctors can view clinical documents" ON clinical_documents;

CREATE POLICY "Patients can view own documents" ON clinical_documents
    FOR SELECT TO authenticated
    USING (patient_id = auth.uid());

CREATE POLICY "Patients can upload own documents" ON clinical_documents
    FOR INSERT TO authenticated
    WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Attending doctors can view clinical documents" ON clinical_documents
    FOR SELECT TO authenticated
    USING (
        doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
        OR patient_id IN (
            SELECT patient_id FROM appointments 
            WHERE doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
        ) OR is_admin(auth.uid())
    );

-- 14. MULTI-HOSPITAL & FACILITY RLS POLICIES (P0 Resolution: Mandatory RLS across all infrastructure tables)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can manage organizations" ON organizations;
CREATE POLICY "Public can view organizations" ON organizations FOR SELECT USING (true);
CREATE POLICY "Admins can manage organizations" ON organizations FOR ALL TO authenticated
    USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view facilities" ON facilities;
DROP POLICY IF EXISTS "Admins can manage facilities" ON facilities;
CREATE POLICY "Public can view facilities" ON facilities FOR SELECT USING (true);
CREATE POLICY "Admins can manage facilities" ON facilities FOR ALL TO authenticated
    USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

ALTER TABLE hospital_departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view hospital departments" ON hospital_departments;
DROP POLICY IF EXISTS "Admins can manage hospital departments" ON hospital_departments;
CREATE POLICY "Public can view hospital departments" ON hospital_departments FOR SELECT USING (true);
CREATE POLICY "Admins can manage hospital departments" ON hospital_departments FOR ALL TO authenticated
    USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

ALTER TABLE clinic_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view clinic rooms" ON clinic_rooms;
DROP POLICY IF EXISTS "Admins can manage clinic rooms" ON clinic_rooms;
CREATE POLICY "Public can view clinic rooms" ON clinic_rooms FOR SELECT USING (true);
CREATE POLICY "Admins can manage clinic rooms" ON clinic_rooms FOR ALL TO authenticated
    USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- 15. STATUTORY DIGITAL CONSENT RLS POLICIES (Immutable patient audit artifacts)
ALTER TABLE patient_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Patients can view own consents" ON patient_consents;
DROP POLICY IF EXISTS "Patients can record consents" ON patient_consents;
DROP POLICY IF EXISTS "Admins can view consents" ON patient_consents;
CREATE POLICY "Patients can view own consents" ON patient_consents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Patients can record consents" ON patient_consents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view consents" ON patient_consents FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 16. PATIENT INVOICES & BILLING RLS POLICIES (Strict financial data isolation)
ALTER TABLE patient_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Patients can view own invoices" ON patient_invoices;
DROP POLICY IF EXISTS "Doctors can view relevant invoices" ON patient_invoices;
DROP POLICY IF EXISTS "Staff and Admins can manage invoices" ON patient_invoices;
CREATE POLICY "Patients can view own invoices" ON patient_invoices FOR SELECT TO authenticated USING (patient_id = auth.uid());
CREATE POLICY "Doctors can view relevant invoices" ON patient_invoices FOR SELECT TO authenticated USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));
CREATE POLICY "Staff and Admins can manage invoices" ON patient_invoices FOR ALL TO authenticated
    USING (
        is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('receptionist', 'admin'))
    )
    WITH CHECK (
        is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('receptionist', 'admin'))
    );

-- 17. TELEMEDICINE ROOMS RLS POLICIES (Encrypted session room token isolation)
ALTER TABLE telemedicine_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants can access telemedicine room" ON telemedicine_rooms;
DROP POLICY IF EXISTS "Doctors can create telemedicine room" ON telemedicine_rooms;
DROP POLICY IF EXISTS "Participants can update room status" ON telemedicine_rooms;

CREATE POLICY "Participants can access telemedicine room" ON telemedicine_rooms FOR SELECT TO authenticated
    USING (
        appointment_id IN (
            SELECT id FROM appointments 
            WHERE patient_id = auth.uid() OR doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
        ) OR is_admin(auth.uid())
    );

CREATE POLICY "Doctors can create telemedicine room" ON telemedicine_rooms FOR INSERT TO authenticated
    WITH CHECK (
        appointment_id IN (
            SELECT id FROM appointments 
            WHERE doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
        ) OR is_admin(auth.uid())
    );

CREATE POLICY "Participants can update room status" ON telemedicine_rooms FOR UPDATE TO authenticated
    USING (
        appointment_id IN (
            SELECT id FROM appointments 
            WHERE patient_id = auth.uid() OR doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
        ) OR is_admin(auth.uid())
    );

-- 23. CENTRALIZED APPOINTMENT LIFECYCLE STATE TRANSITION RPC (M-06 Resolution)
CREATE OR REPLACE FUNCTION transition_appointment_status_atomic(
    p_appointment_id UUID,
    p_target_status VARCHAR,
    p_reason TEXT DEFAULT 'Clinical workflow transition'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role VARCHAR;
    v_appointment appointments%ROWTYPE;
    v_valid BOOLEAN := false;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_appointment FROM appointments WHERE id = p_appointment_id;
    IF v_appointment.id IS NULL THEN
        RAISE EXCEPTION 'Appointment record not found.';
    END IF;

    SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;

    -- Lifecycle state machine validation
    IF v_appointment.status = p_target_status THEN
        RETURN to_jsonb(v_appointment);
    END IF;

    IF v_appointment.status = 'booked' AND p_target_status IN ('checked_in', 'cancelled', 'no-show') THEN
        v_valid := true;
    ELSIF v_appointment.status = 'checked_in' AND p_target_status IN ('waiting', 'cancelled') THEN
        v_valid := true;
    ELSIF v_appointment.status = 'waiting' AND p_target_status IN ('in-consultation', 'skipped', 'no-show', 'cancelled') THEN
        v_valid := true;
    ELSIF v_appointment.status = 'in-consultation' AND p_target_status IN ('completed', 'cancelled') THEN
        v_valid := true;
    END IF;

    IF NOT v_valid THEN
        RAISE EXCEPTION 'Invalid status transition: Cannot transition appointment from % to %.', v_appointment.status, p_target_status;
    END IF;

    UPDATE appointments
    SET status = p_target_status,
        check_in_time = CASE WHEN p_target_status = 'checked_in' AND check_in_time IS NULL THEN NOW() ELSE check_in_time END,
        start_at = CASE WHEN p_target_status = 'in-consultation' AND start_at IS NULL THEN NOW() ELSE start_at END,
        end_at = CASE WHEN p_target_status = 'completed' AND end_at IS NULL THEN NOW() ELSE end_at END
    WHERE id = p_appointment_id
    RETURNING * INTO v_appointment;

    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'APPOINTMENT_STATUS_TRANSITION',
        'appointments',
        p_appointment_id,
        jsonb_build_object(
            'from_status', v_appointment.status,
            'to_status', p_target_status,
            'reason', p_reason,
            'actor_role', COALESCE(v_actor_role, 'user')
        )
    );

    RETURN to_jsonb(v_appointment);
END;
$$;

-- 24. MINIMAL PUBLIC DOCTOR DIRECTORY VIEW (M-03 Resolution: Strictly Verified Public Data)
CREATE OR REPLACE VIEW public_doctor_directory AS
SELECT 
    d.id,
    d.name,
    d.specialty,
    d.specialty_id,
    d.title,
    d.degrees,
    d.experience_years,
    d.hospital,
    d.fee,
    d.rating,
    d.reviews_count,
    d.avatar,
    d.bio,
    d.schedule,
    d.mediarca_id,
    COALESCE(cq.current_token, 0) AS current_token,
    COALESCE(cq.total_tokens, 0) AS total_tokens,
    COALESCE(cq.status, 'idle') AS queue_status,
    COALESCE(cq.avg_consult_time_mins, 12) AS avg_consult_time_mins
FROM doctors d
LEFT JOIN clinic_queues cq ON cq.doctor_id = d.id AND cq.queue_date = CURRENT_DATE
WHERE d.verification_status = 'verified';

GRANT SELECT ON public_doctor_directory TO anon, authenticated;

-- 15. AUDIT LOG ACCESS POLICIES & ADMIN RETRIEVAL RPC (C-12 Resolution: Administrator Authentication Required)
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT USING (
    is_admin(auth.uid())
);

CREATE OR REPLACE FUNCTION get_system_audit_logs(p_limit INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin_id UUID;
    v_is_admin BOOLEAN;
    v_logs JSONB;
BEGIN
    v_admin_id := auth.uid();

    -- C-12: Require non-null authenticated identity
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required. Only authenticated administrators can retrieve system audit logs.';
    END IF;

    -- Verify administrator authorization
    SELECT is_admin(v_admin_id) INTO v_is_admin;
    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access Denied: Medical Board Administrator privileges required.';
    END IF;

    SELECT jsonb_agg(to_jsonb(a)) INTO v_logs
    FROM (
        SELECT * FROM audit_logs
        ORDER BY created_at DESC
        LIMIT p_limit
    ) a;

    RETURN COALESCE(v_logs, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION get_system_audit_logs(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_system_audit_logs(INT) TO authenticated;

-- 16. REALTIME TELEMETRY PUBLICATION (P-03 Resolution: Exclusively publishes queue counters, never doctors PII table)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'clinic_queues') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE clinic_queues;
  END IF;
  -- Ensure sensitive doctors table is NOT in realtime publication to prevent PII leakage
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'doctors') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE doctors;
  END IF;
END $$;

-- 16B. PRIVATE SUPABASE STORAGE VAULT CONFIGURATION (H-21, H-22, H-23 Resolution)
-- Initialize private bucket for patient records & diagnostic imaging
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'clinical_documents',
    'clinical_documents',
    false,
    10485760, -- 10MB maximum
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

-- STORAGE RLS: Authenticated patients can upload files into their own UUID directory
DROP POLICY IF EXISTS "Patients can upload to own vault directory" ON storage.objects;
CREATE POLICY "Patients can upload to own vault directory"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'clinical_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- STORAGE RLS: Authenticated patients can read/download their own vault files
DROP POLICY IF EXISTS "Patients can view own vault documents" ON storage.objects;
CREATE POLICY "Patients can view own vault documents"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'clinical_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- STORAGE RLS: Attending physicians and administrators can view patient documents
DROP POLICY IF EXISTS "Doctors can view patient vault documents" ON storage.objects;
CREATE POLICY "Doctors can view patient vault documents"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'clinical_documents'
    AND (
        EXISTS (
            SELECT 1 FROM appointments a
            JOIN doctors d ON d.id = a.doctor_id
            WHERE d.user_id = auth.uid()
              AND a.patient_id::text = (storage.foldername(name))[1]
        )
        OR is_admin(auth.uid())
    )
);

-- 17. INITIAL SEED DATA (Zero Password Hashes - Passwords Authenticated via Supabase Auth)
INSERT INTO users (id, role, email, full_name, phone) VALUES
('a0000000-0000-0000-0000-000000000001', 'patient', 'sarah@mediarca.health', 'Sarah Johnson', '+1 (555) 234-8900'),
('a0000000-0000-0000-0000-000000000002', 'doctor', 'bikeshray3764@gmail.com', 'Dr. Bikesh Ray', '+1 (555) 123-4567'),
('a0000000-0000-0000-0000-000000000003', 'doctor', 'thorne@mediarca.health', 'Dr. Aris Thorne', '+1 (555) 345-6789'),
('a0000000-0000-0000-0000-000000000004', 'doctor', 'vance@mediarca.health', 'Dr. Elena Vance', '+1 (555) 456-7890'),
('a0000000-0000-0000-0000-000000000005', 'admin', 'admin@mediarca.health', 'Medical Board Director Robert Vance', '+1 (555) 999-0000'),
('a0000000-0000-0000-0000-000000000006', 'receptionist', 'reception@mediarca.health', 'Front Desk Officer Maya Singh', '+1 (555) 777-0000')
ON CONFLICT (email) DO NOTHING;

INSERT INTO patient_clinical_profiles (user_id, age, gender, blood_group, allergies, emergency_contact) VALUES
('a0000000-0000-0000-0000-000000000001', 32, 'Female', 'O+', ARRAY['Penicillin'], '+1 (555) 987-6543')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO doctors (id, user_id, name, email, specialty, specialty_id, title, degrees, reg_number, mediarca_id, verification_status, experience_years, hospital, fee, rating, reviews_count, avatar, bio, schedule, queue_active, current_token, total_tokens, avg_consult_time_mins) VALUES
('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'Dr. Bikesh Ray', 'bikeshray3764@gmail.com', 'Cardiology & Critical Care', 'cardiology', 'Consultant Interventional Cardiologist', 'MBBS, MD (Cardiology), FACC', 'NMC-98765-IND', 'MED-DOC-7700', 'verified', 12, 'Apex Heart Institute & Research Center, Suite 402', 60.00, 4.95, 340, 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&fit=crop&crop=faces&q=80', 'Specialist in clinical cardiology, angioplasty, hypertension therapeutics, and acute cardiovascular interventions.', 'Mon - Sat | 09:00 AM - 03:00 PM', true, 3, 8, 12),
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Dr. Aris Thorne', 'thorne@mediarca.health', 'Cardiology', 'cardiology', 'Senior Interventional Cardiologist', 'MBBS, MD (Cardiology), FACC', 'NMC-84920-IND', 'MED-DOC-1082', 'verified', 16, 'Metro Heart Institute, Wing B - Room 304', 65.00, 4.9, 312, 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&fit=crop&crop=faces&q=80', 'Specialist in preventative cardiology, coronary angioplasty, and hypertension management.', 'Mon - Fri | 09:00 AM - 02:00 PM', true, 4, 7, 12),
('d0000000-0000-0000-0000-000000000002', NULL, 'Dr. Ananya Sen', 'sen@mediarca.health', 'Dermatology', 'dermatology', 'Consultant Dermatologist & Dermatosurgeon', 'MBBS, MD - Dermatology, Venereology & Leprosy', 'WBMC-77341-REG', 'MED-DOC-2390', 'verified', 11, 'Apex Skin & Laser Clinic, Suite 12', 50.00, 4.8, 245, 'https://images.unsplash.com/photo-1594824813501-48e02d64a27a?w=300&h=300&fit=crop&crop=faces&q=80', 'Expertise in clinical dermatology, acne therapeutics, and psoriasis biologics.', 'Mon, Wed, Sat | 10:00 AM - 04:00 PM', true, 2, 6, 15),
('d0000000-0000-0000-0000-000000000003', NULL, 'Dr. Marcus Vance', 'marcus@mediarca.health', 'Orthopedics', 'orthopedics', 'Chief Joint Replacement Surgeon', 'MBBS, MS (Orthopedics), MCh (Ortho)', 'DMC-90114-MED', 'MED-DOC-4482', 'verified', 19, 'Global Orthopedic Center, Level 2', 80.00, 4.95, 489, 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&h=300&fit=crop&crop=faces&q=80', 'Pioneer in robotic total knee and hip arthroplasty with over 4,500 procedures.', 'Tue, Thu, Sat | 08:30 AM - 01:30 PM', true, 6, 12, 10),
('d0000000-0000-0000-0000-000000000004', NULL, 'Dr. Clara Sterling', 'clara@mediarca.health', 'Pediatrics', 'pediatrics', 'Senior Pediatrician & Neonatologist', 'MBBS, DNB (Pediatrics), FIAP', 'MMC-65239-REG', 'MED-DOC-5519', 'verified', 14, 'Care Children Hospital, Pediatric OPD 4', 45.00, 4.9, 380, 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&fit=crop&crop=faces&q=80', 'Specialized in newborn care, developmental milestones, and pediatric asthma.', 'Daily | 09:30 AM - 03:30 PM', true, 1, 5, 12),
('d0000000-0000-0000-0000-000000000005', NULL, 'Dr. Kabir Oberoi', 'kabir@mediarca.health', 'Neurology', 'neurology', 'Consultant Neurologist & Stroke Specialist', 'MBBS, MD (Gen Med), DM (Neurology)', 'MCI-18834-NEU', 'MED-DOC-8924', 'verified', 13, 'Neuro Care & Research Institute, Block A', 75.00, 4.85, 194, 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&h=300&fit=crop&crop=faces&q=80', 'Expert in migraines, epilepsy management, and Parkinson disease.', 'Mon - Fri | 11:00 AM - 05:00 PM', false, 0, 0, 15),
('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004', 'Dr. Elena Vance', 'vance@mediarca.health', 'General Medicine', 'general', 'Associate Physician & Family Specialist', 'MBBS, MD (Internal Medicine)', 'KMC-54321-APP', NULL, 'pending', 8, 'City Life Health Center', 40.00, 4.7, 88, 'https://images.unsplash.com/photo-1594824813689-53e7b1a13437?w=300&h=300&fit=crop&crop=faces&q=80', 'Comprehensive internal medicine and preventive health checkups.', 'Mon - Sat | 10:00 AM - 02:00 PM', false, 0, 0, 12)
ON CONFLICT (email) DO NOTHING;

INSERT INTO clinic_queues (doctor_id, current_token, total_tokens, status, avg_consult_time_mins) VALUES
('d0000000-0000-0000-0000-000000000007', 3, 8, 'in-session', 12),
('d0000000-0000-0000-0000-000000000001', 4, 7, 'in-session', 12),
('d0000000-0000-0000-0000-000000000002', 2, 6, 'in-session', 15)
ON CONFLICT (doctor_id, queue_date) DO NOTHING;
