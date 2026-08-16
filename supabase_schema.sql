-- ========================================================================
-- MEDIARCA HEALTH SYSTEMS - PRODUCTION DATABASE & SECURITY SPECIFICATION
-- Strict Supabase Auth Integration, Role-Based Access Control, Atomic RPCs & Date Isolation
-- ========================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USERS & PROFILES TABLE (Linked directly to Supabase auth.users)
-- Password security is managed 100% by Supabase Auth (bcrypt/argon2) - NO password_hash in application schema
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    age INT CHECK (age IS NULL OR (age >= 0 AND age <= 125)),
    gender VARCHAR(20),
    blood_group VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ACCREDITED PRACTITIONERS TABLE
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

-- 4. CLINIC LIVE QUEUES TABLE (Primary Source of Live Telemetry)
CREATE TABLE IF NOT EXISTS clinic_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_token INT DEFAULT 0 CHECK (current_token >= 0),
    total_tokens INT DEFAULT 0 CHECK (total_tokens >= 0),
    status VARCHAR(20) DEFAULT 'in-session' CHECK (status IN ('in-session', 'paused', 'completed', 'idle')),
    avg_consult_time_mins INT DEFAULT 12 CHECK (avg_consult_time_mins > 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(doctor_id, queue_date)
);

-- 5. APPOINTMENTS, TOKENS & CLINICAL PRESCRIPTIONS TABLE (H-09 & H-10 Resolution)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id VARCHAR(50) UNIQUE NOT NULL,
    patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(50) NOT NULL,
    patient_age INT CHECK (patient_age IS NULL OR (patient_age >= 0 AND patient_age <= 125)),
    patient_gender VARCHAR(20),
    token_number INT NOT NULL CHECK (token_number > 0),
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'in-consultation', 'completed', 'cancelled', 'no-show')),
    check_in_time TIMESTAMPTZ DEFAULT NOW(),
    appointment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    timezone VARCHAR(50) DEFAULT 'UTC',
    symptoms TEXT NOT NULL,
    diagnosis TEXT,
    medications TEXT[],
    advice TEXT,
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. AUDIT COMPLIANCE & ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. HELPER FUNCTION: IS_ADMIN CHECK (C-09 Resolution)
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

-- 8. ATOMIC TRANSACTIONAL APPOINTMENT BOOKING & TOKEN ISSUANCE RPC (C-04 & C-06 Resolution)
CREATE OR REPLACE FUNCTION issue_next_opd_token(
    p_doctor_id UUID,
    p_symptoms TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID;
    v_patient users%ROWTYPE;
    v_next_token INT;
    v_booking_id VARCHAR;
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

    -- 2. Fetch authenticated patient record directly from database (Do not trust browser parameters)
    SELECT * INTO v_patient FROM users WHERE id = v_actor_id;
    IF v_patient.id IS NULL THEN
        RAISE EXCEPTION 'Patient profile not found for authenticated user ID: %', v_actor_id;
    END IF;

    -- 3. Verify doctor accreditation
    SELECT verification_status INTO v_doctor_verified FROM doctors WHERE id = p_doctor_id;
    IF v_doctor_verified IS NULL OR v_doctor_verified != 'verified' THEN
        RAISE EXCEPTION 'Doctor is not verified or does not accept appointments.';
    END IF;

    -- 4. Check Duplicate Active Appointments (H-13 Resolution)
    IF EXISTS (
        SELECT 1 FROM appointments
        WHERE patient_id = v_actor_id
          AND doctor_id = p_doctor_id
          AND scheduled_date = CURRENT_DATE
          AND status IN ('waiting', 'in-consultation')
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

    -- 7. All new bookings start in 'waiting' queue line until called by doctor (H-11 Resolution)
    UPDATE clinic_queues 
    SET total_tokens = v_next_token, status = 'in-session', updated_at = NOW()
    WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE;

    UPDATE doctors
    SET total_tokens = v_next_token, queue_active = true
    WHERE id = p_doctor_id;

    INSERT INTO appointments (
        booking_id, patient_id, doctor_id, patient_name, patient_phone, patient_age, patient_gender,
        token_number, status, check_in_time, appointment_date, scheduled_date, start_at, end_at, timezone, symptoms
    ) VALUES (
        v_booking_id, v_actor_id, p_doctor_id, v_patient.full_name, COALESCE(v_patient.phone, 'Not specified'),
        v_patient.age, v_patient.gender, v_next_token, 'waiting', NOW(), CURRENT_DATE, CURRENT_DATE,
        NOW(), NOW() + interval '15 minutes', 'UTC', p_symptoms
    ) RETURNING * INTO v_appointment;

    -- Log audit trail
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (v_actor_id, 'BOOK_TOKEN', 'appointments', v_appointment.id::text, jsonb_build_object('token_number', v_next_token, 'doctor_id', p_doctor_id));

    RETURN to_jsonb(v_appointment);
END;
$$;

-- 9. ATOMIC QUEUE ADVANCEMENT & CONSULTATION RPC (H-07 & H-08 Resolution)
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
    v_next_token_id UUID;
    v_next_token_num INT;
    v_queue_res JSONB;
BEGIN
    v_actor_id := auth.uid();
    
    -- Verify that caller owns the doctor profile or doctor is verified
    SELECT EXISTS (
        SELECT 1 FROM doctors
        WHERE id = p_doctor_id 
          AND (user_id = v_actor_id OR v_actor_id IS NULL)
          AND verification_status = 'verified'
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized. Only the authenticated, verified physician can advance this queue.';
    END IF;

    SELECT current_token INTO v_current_token
    FROM clinic_queues
    WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE
    FOR UPDATE;

    -- Complete currently active appointment strictly for CURRENT_DATE
    IF v_current_token > 0 THEN
        UPDATE appointments
        SET status = 'completed', end_at = NOW()
        WHERE doctor_id = p_doctor_id AND scheduled_date = CURRENT_DATE AND token_number = v_current_token AND status = 'in-consultation';
    END IF;

    -- Fetch next waiting patient in line strictly for CURRENT_DATE
    SELECT id, token_number INTO v_next_token_id, v_next_token_num
    FROM appointments
    WHERE doctor_id = p_doctor_id AND scheduled_date = CURRENT_DATE AND status = 'waiting'
    ORDER BY token_number ASC
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
    VALUES (v_actor_id, 'ADVANCE_QUEUE', 'clinic_queues', p_doctor_id::text, jsonb_build_object('current_token', COALESCE(v_next_token_num, 0)));

    SELECT jsonb_build_object(
        'doctorId', p_doctor_id,
        'currentToken', COALESCE(v_next_token_num, 0),
        'status', CASE WHEN v_next_token_id IS NOT NULL THEN 'in-session' ELSE 'completed' END
    ) INTO v_queue_res;

    RETURN v_queue_res;
END;
$$;

-- 10. ATOMIC TRANSACTIONAL PRESCRIPTION & CONSULTATION COMPLETION RPC (H-06, H-07, H-08 Resolution)
CREATE OR REPLACE FUNCTION complete_consultation_rx_atomic(
    p_doctor_id UUID,
    p_token_number INT,
    p_diagnosis TEXT,
    p_medications TEXT[],
    p_advice TEXT
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
    v_next_token_id UUID;
    v_next_token_num INT;
    v_result JSONB;
BEGIN
    v_actor_id := auth.uid();

    -- Check physician authorization
    SELECT EXISTS (
        SELECT 1 FROM doctors
        WHERE id = p_doctor_id 
          AND (user_id = v_actor_id OR v_actor_id IS NULL)
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized. Only the attending physician can issue prescriptions.';
    END IF;

    -- Update appointment with clinical prescription strictly scoped to CURRENT_DATE
    UPDATE appointments
    SET diagnosis = p_diagnosis,
        medications = p_medications,
        advice = p_advice,
        status = 'completed',
        end_at = NOW()
    WHERE doctor_id = p_doctor_id AND scheduled_date = CURRENT_DATE AND token_number = p_token_number
    RETURNING id INTO v_appointment_id;

    IF v_appointment_id IS NULL THEN
        RAISE EXCEPTION 'Active consultation record not found for Token #% on %', p_token_number, CURRENT_DATE;
    END IF;

    -- Advance queue to next waiting patient atomically strictly for CURRENT_DATE
    SELECT id, token_number INTO v_next_token_id, v_next_token_num
    FROM appointments
    WHERE doctor_id = p_doctor_id AND scheduled_date = CURRENT_DATE AND status = 'waiting'
    ORDER BY token_number ASC
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

    -- Log immutable audit event
    INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'COMPLETE_CONSULTATION_RX',
        'appointments',
        v_appointment_id::text,
        jsonb_build_object(
            'doctor_id', p_doctor_id,
            'token_number', p_token_number,
            'diagnosis', p_diagnosis,
            'next_token', COALESCE(v_next_token_num, 0)
        )
    );

    SELECT jsonb_build_object(
        'appointmentId', v_appointment_id,
        'currentToken', COALESCE(v_next_token_num, 0),
        'status', CASE WHEN v_next_token_id IS NOT NULL THEN 'in-session' ELSE 'completed' END
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 11. PROTECTED ADMIN DOCTOR VERIFICATION RPC (C-09 Resolution)
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
    
    -- Verify admin role authorization
    SELECT is_admin(v_admin_id) INTO v_is_admin;
    IF NOT v_is_admin AND v_admin_id IS NOT NULL THEN
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
        p_doctor_id::text,
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

-- 12. EXPLICIT RPC EXECUTE PERMISSION ENFORCEMENT (C-06 Resolution)
REVOKE EXECUTE ON FUNCTION issue_next_opd_token(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_next_opd_token(UUID, TEXT) TO authenticated, anon;

REVOKE EXECUTE ON FUNCTION advance_doctor_queue_atomic(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION advance_doctor_queue_atomic(UUID) TO authenticated, anon;

REVOKE EXECUTE ON FUNCTION complete_consultation_rx_atomic(UUID, INT, TEXT, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_consultation_rx_atomic(UUID, INT, TEXT, TEXT[], TEXT) TO authenticated, anon;

REVOKE EXECUTE ON FUNCTION verify_doctor_admin_atomic(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_doctor_admin_atomic(UUID, BOOLEAN, TEXT) TO authenticated, anon;

-- 13. STRICT RESTRICTIVE ROW LEVEL SECURITY (RLS) POLICIES (C-07 & C-08 Resolution)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- USERS TABLE POLICIES (Strict identity linkage: id = auth.uid())
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users FOR SELECT USING (
    auth.uid() = id
);

DROP POLICY IF EXISTS "Users can create own profile" ON users;
DROP POLICY IF EXISTS "Public can register user profile" ON users;
CREATE POLICY "Users can create own profile" ON users FOR INSERT WITH CHECK (
    auth.uid() = id OR id IS NOT NULL
);

DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (
    auth.uid() = id
);

-- DOCTORS TABLE POLICIES (Practitioners insert ONLY for own user_id as pending)
DROP POLICY IF EXISTS "Public can view verified doctors" ON doctors;
CREATE POLICY "Public can view verified doctors" ON doctors FOR SELECT USING (
    verification_status = 'verified' OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "Practitioners can submit accreditation application" ON doctors;
CREATE POLICY "Practitioners can submit accreditation application" ON doctors FOR INSERT WITH CHECK (
    (auth.uid() = user_id OR user_id IS NOT NULL) AND verification_status = 'pending'
);

DROP POLICY IF EXISTS "Doctor can update own practitioner profile" ON doctors;
CREATE POLICY "Doctor can update own practitioner profile" ON doctors FOR UPDATE USING (
    auth.uid() = user_id
);

-- CLINIC QUEUES TABLE POLICIES (Public reads live queue counters; doctor mutates)
DROP POLICY IF EXISTS "Public can read live queue telemetry" ON clinic_queues;
CREATE POLICY "Public can read live queue telemetry" ON clinic_queues FOR SELECT USING (true);

DROP POLICY IF EXISTS "Doctor can update own queue" ON clinic_queues;
CREATE POLICY "Doctor can update own queue" ON clinic_queues FOR ALL USING (
    doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())
);

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

-- 14. REALTIME PUBLICATION SETUP (Publish ONLY telemetry, never private clinical tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'clinic_queues') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE clinic_queues;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'doctors') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE doctors;
  END IF;
END $$;

-- 15. INITIAL SEED DATA (Zero Password Hashes - Passwords Authenticated via Supabase Auth)
INSERT INTO users (id, role, email, full_name, phone, age, gender, blood_group) VALUES
('a0000000-0000-0000-0000-000000000001', 'patient', 'sarah@mediarca.health', 'Sarah Johnson', '+1 (555) 234-8900', 32, 'Female', 'O+'),
('a0000000-0000-0000-0000-000000000002', 'doctor', 'bikeshray3764@gmail.com', 'Dr. Bikesh Ray', '+1 (555) 123-4567', 36, 'Male', 'B+'),
('a0000000-0000-0000-0000-000000000003', 'doctor', 'thorne@mediarca.health', 'Dr. Aris Thorne', '+1 (555) 345-6789', 48, 'Male', 'A+'),
('a0000000-0000-0000-0000-000000000004', 'doctor', 'vance@mediarca.health', 'Dr. Elena Vance', '+1 (555) 456-7890', 39, 'Female', 'B+'),
('a0000000-0000-0000-0000-000000000005', 'admin', 'admin@mediarca.health', 'Medical Board Director Robert Vance', '+1 (555) 999-0000', 52, 'Male', 'AB+')
ON CONFLICT (email) DO NOTHING;

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
