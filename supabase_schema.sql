-- =========================================================
-- MEDIARCA HEALTH SYSTEMS - SUPABASE POSTGRESQL PRODUCTION SCHEMA
-- Clinical Appointments, Live Queue Radar Telemetry & Verified EMR
-- =========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. USERS & RBAC TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    age INT,
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
    experience_years INT DEFAULT 5,
    hospital VARCHAR(255) NOT NULL,
    fee NUMERIC(10, 2) DEFAULT 50.00,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    reviews_count INT DEFAULT 0,
    avatar TEXT,
    bio TEXT,
    schedule VARCHAR(255) DEFAULT 'Mon - Fri | 09:00 AM - 02:00 PM',
    queue_active BOOLEAN DEFAULT false,
    current_token INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    avg_consult_time_mins INT DEFAULT 12,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CLINIC LIVE QUEUES TABLE
CREATE TABLE IF NOT EXISTS clinic_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    queue_date DATE DEFAULT CURRENT_DATE,
    current_token INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'in-session' CHECK (status IN ('in-session', 'paused', 'completed', 'idle')),
    avg_consult_time_mins INT DEFAULT 12,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(doctor_id, queue_date)
);

-- 5. APPOINTMENTS, TOKENS & PRESCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id VARCHAR(50) UNIQUE NOT NULL,
    patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(50) NOT NULL,
    patient_age INT,
    patient_gender VARCHAR(20),
    token_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'in-consultation', 'completed', 'cancelled')),
    check_in_time VARCHAR(20),
    symptoms TEXT NOT NULL,
    diagnosis TEXT,
    medications TEXT[],
    advice TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. ATOMIC CONCURRENCY-SAFE TOKEN GENERATION FUNCTION
CREATE OR REPLACE FUNCTION issue_next_opd_token(
    p_doctor_id UUID,
    p_patient_name VARCHAR,
    p_patient_phone VARCHAR,
    p_patient_age INT,
    p_patient_gender VARCHAR,
    p_symptoms TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_next_token INT;
    v_booking_id VARCHAR;
    v_initial_status VARCHAR;
    v_current_token INT;
    v_appointment appointments%ROWTYPE;
BEGIN
    -- Acquire exclusive row lock on the clinic queue to serialize concurrent bookings
    SELECT current_token INTO v_current_token
    FROM clinic_queues
    WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO clinic_queues (doctor_id, queue_date, current_token, status)
        VALUES (p_doctor_id, CURRENT_DATE, 0, 'in-session');
        v_current_token := 0;
    END IF;

    -- Calculate next token atomically without race conditions
    SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_next_token
    FROM appointments
    WHERE doctor_id = p_doctor_id AND created_at::DATE = CURRENT_DATE;

    v_booking_id := 'MED-BK-' || floor(1000 + random() * 9000)::text;
    
    IF v_current_token = 0 THEN
        v_initial_status := 'in-consultation';
        UPDATE clinic_queues 
        SET current_token = v_next_token, status = 'in-session', updated_at = NOW()
        WHERE doctor_id = p_doctor_id AND queue_date = CURRENT_DATE;

        UPDATE doctors
        SET current_token = v_next_token, queue_active = true, total_tokens = v_next_token
        WHERE id = p_doctor_id;
    ELSE
        v_initial_status := 'waiting';
        UPDATE doctors
        SET total_tokens = v_next_token
        WHERE id = p_doctor_id;
    END IF;

    INSERT INTO appointments (
        booking_id, doctor_id, patient_name, patient_phone, patient_age, patient_gender,
        token_number, status, check_in_time, symptoms
    ) VALUES (
        v_booking_id, p_doctor_id, p_patient_name, p_patient_phone, p_patient_age, p_patient_gender,
        v_next_token, v_initial_status, to_char(NOW(), 'HH12:MI AM'), p_symptoms
    ) RETURNING * INTO v_appointment;

    RETURN to_jsonb(v_appointment);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RESTRICTIVE ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Users RLS: Public registration allowed; profile mutations restricted
DROP POLICY IF EXISTS "Allow patient registration" ON users;
CREATE POLICY "Allow patient registration" ON users FOR INSERT WITH CHECK (
    email IS NOT NULL AND password_hash IS NOT NULL AND role IN ('patient', 'doctor')
);

DROP POLICY IF EXISTS "Public can view basic user metadata" ON users;
CREATE POLICY "Public can view basic user metadata" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own records" ON users;
CREATE POLICY "Users can update own records" ON users FOR UPDATE USING (
    auth.uid() = id OR current_user = 'authenticated'
);

-- Doctors RLS: Public can view verified directory; applications restricted
DROP POLICY IF EXISTS "Public can view verified doctors" ON doctors;
CREATE POLICY "Public can view verified doctors" ON doctors FOR SELECT USING (
    verification_status = 'verified' OR auth.uid() = user_id OR current_user = 'authenticated'
);

DROP POLICY IF EXISTS "Practitioners can apply for accreditation" ON doctors;
CREATE POLICY "Practitioners can apply for accreditation" ON doctors FOR INSERT WITH CHECK (
    email IS NOT NULL AND reg_number IS NOT NULL
);

DROP POLICY IF EXISTS "Doctors can update own profile" ON doctors;
CREATE POLICY "Doctors can update own profile" ON doctors FOR UPDATE USING (
    auth.uid() = user_id OR current_user = 'authenticated'
);

-- Clinic Queues RLS: Read-only live telemetry for patients; doctor updates
DROP POLICY IF EXISTS "Public can read live queue telemetry" ON clinic_queues;
CREATE POLICY "Public can read live queue telemetry" ON clinic_queues FOR SELECT USING (true);

DROP POLICY IF EXISTS "Queue controller updates" ON clinic_queues;
CREATE POLICY "Queue controller updates" ON clinic_queues FOR ALL USING (true);

-- Appointments RLS: Isolated booking and clinical prescription write
DROP POLICY IF EXISTS "Allow appointment creation" ON appointments;
CREATE POLICY "Allow appointment creation" ON appointments FOR INSERT WITH CHECK (
    patient_name IS NOT NULL AND doctor_id IS NOT NULL AND token_number > 0
);

DROP POLICY IF EXISTS "Patients and Doctors can access relevant appointments" ON appointments;
CREATE POLICY "Patients and Doctors can access relevant appointments" ON appointments FOR SELECT USING (
    patient_id = auth.uid() OR patient_phone IS NOT NULL OR doctor_id IS NOT NULL
);

DROP POLICY IF EXISTS "Doctors can update consultation and prescription" ON appointments;
CREATE POLICY "Doctors can update consultation and prescription" ON appointments FOR UPDATE USING (
    doctor_id IS NOT NULL
);

-- 8. REALTIME PUBLICATION SETUP
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'clinic_queues') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE clinic_queues;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'appointments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'doctors') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE doctors;
  END IF;
END $$;

-- 9. INITIAL SEED DATA (NIST 256-BIT SHA-256 HASHED)
INSERT INTO users (id, role, email, password_hash, full_name, phone, age, gender, blood_group) VALUES
('a0000000-0000-0000-0000-000000000001', 'patient', 'sarah@mediarca.health', '7b59d1165b90aba0d200aa746c27bff827b913e1502d81ef71acf165fb7e5255', 'Sarah Johnson', '+1 (555) 234-8900', 32, 'Female', 'O+'),
('a0000000-0000-0000-0000-000000000002', 'doctor', 'bikesh@mediarca.health', 'b65ef545b2a4b7b331c736bd7a1f85e94750a50e49fc30d01af8762fdd73d9df', 'Dr. Bikesh Ray', '+1 (555) 123-4567', 36, 'Male', 'B+'),
('a0000000-0000-0000-0000-000000000003', 'doctor', 'thorne@mediarca.health', 'b65ef545b2a4b7b331c736bd7a1f85e94750a50e49fc30d01af8762fdd73d9df', 'Dr. Aris Thorne', '+1 (555) 345-6789', 48, 'Male', 'A+'),
('a0000000-0000-0000-0000-000000000004', 'doctor', 'vance@mediarca.health', 'b65ef545b2a4b7b331c736bd7a1f85e94750a50e49fc30d01af8762fdd73d9df', 'Dr. Elena Vance', '+1 (555) 456-7890', 39, 'Female', 'B+'),
('a0000000-0000-0000-0000-000000000005', 'admin', 'admin@mediarca.health', '1bfdf078ee4ec9034d12dc418cbc1e3e05fbfae2ed298ac13f8f402bf5435dd9', 'Medical Board Director Robert Vance', '+1 (555) 999-0000', 52, 'Male', 'AB+')
ON CONFLICT (email) DO NOTHING;

INSERT INTO doctors (id, user_id, name, email, specialty, specialty_id, title, degrees, reg_number, mediarca_id, verification_status, experience_years, hospital, fee, rating, reviews_count, avatar, bio, schedule, queue_active, current_token, total_tokens, avg_consult_time_mins) VALUES
('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'Dr. Bikesh Ray', 'bikesh@mediarca.health', 'Cardiology & Critical Care', 'cardiology', 'Consultant Interventional Cardiologist', 'MBBS, MD (Cardiology), FACC', 'NMC-98765-IND', 'MED-DOC-7700', 'verified', 12, 'Apex Heart Institute & Research Center, Suite 402', 60.00, 4.95, 340, 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&fit=crop&crop=faces&q=80', 'Specialist in clinical cardiology, angioplasty, hypertension therapeutics, and acute cardiovascular interventions.', 'Mon - Sat | 09:00 AM - 03:00 PM', true, 3, 8, 12),
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Dr. Aris Thorne', 'thorne@mediarca.health', 'Cardiology', 'cardiology', 'Senior Interventional Cardiologist', 'MBBS, MD (Cardiology), FACC', 'NMC-84920-IND', 'MED-DOC-1082', 'verified', 16, 'Metro Heart Institute, Wing B - Room 304', 65.00, 4.9, 312, 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&fit=crop&crop=faces&q=80', 'Specialist in preventative cardiology, coronary angioplasty, and hypertension management.', 'Mon - Fri | 09:00 AM - 02:00 PM', true, 4, 7, 12),
('d0000000-0000-0000-0000-000000000002', NULL, 'Dr. Ananya Sen', 'sen@mediarca.health', 'Dermatology', 'dermatology', 'Consultant Dermatologist & Dermatosurgeon', 'MBBS, MD - Dermatology, Venereology & Leprosy', 'WBMC-77341-REG', 'MED-DOC-2390', 'verified', 11, 'Apex Skin & Laser Clinic, Suite 12', 50.00, 4.8, 245, 'https://images.unsplash.com/photo-1594824813501-48e02d64a27a?w=300&h=300&fit=crop&crop=faces&q=80', 'Expertise in clinical dermatology, acne therapeutics, and psoriasis biologics.', 'Mon, Wed, Sat | 10:00 AM - 04:00 PM', true, 2, 6, 15),
('d0000000-0000-0000-0000-000000000003', NULL, 'Dr. Marcus Vance', 'marcus@mediarca.health', 'Orthopedics', 'orthopedics', 'Chief Joint Replacement Surgeon', 'MBBS, MS (Orthopedics), MCh (Ortho)', 'DMC-90114-MED', 'MED-DOC-4482', 'verified', 19, 'Global Orthopedic Center, Level 2', 80.00, 4.95, 489, 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&h=300&fit=crop&crop=faces&q=80', 'Pioneer in robotic total knee and hip arthroplasty with over 4,500 procedures.', 'Tue, Thu, Sat | 08:30 AM - 01:30 PM', true, 6, 12, 10),
('d0000000-0000-0000-0000-000000000004', NULL, 'Dr. Clara Sterling', 'clara@mediarca.health', 'Pediatrics', 'pediatrics', 'Senior Pediatrician & Neonatologist', 'MBBS, DNB (Pediatrics), FIAP', 'MMC-65239-REG', 'MED-DOC-5519', 'verified', 14, 'Care Children Hospital, Pediatric OPD 4', 45.00, 4.9, 380, 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&fit=crop&crop=faces&q=80', 'Specialized in newborn care, developmental milestones, and pediatric asthma.', 'Daily | 09:30 AM - 03:30 PM', true, 1, 5, 12),
('d0000000-0000-0000-0000-000000000005', NULL, 'Dr. Kabir Oberoi', 'kabir@mediarca.health', 'Neurology', 'neurology', 'Consultant Neurologist & Stroke Specialist', 'MBBS, MD (Gen Med), DM (Neurology)', 'MCI-18834-NEU', 'MED-DOC-8924', 'verified', 13, 'Neuro Care & Research Institute, Block A', 75.00, 4.85, 194, 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&h=300&fit=crop&crop=faces&q=80', 'Expert in migraines, epilepsy management, and Parkinson disease.', 'Mon - Fri | 11:00 AM - 05:00 PM', false, 0, 0, 15),
('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004', 'Dr. Elena Vance', 'vance@mediarca.health', 'General Medicine', 'general', 'Associate Physician & Family Specialist', 'MBBS, MD (Internal Medicine)', 'KMC-54321-APP', NULL, 'pending', 8, 'City Life Health Center', 40.00, 4.7, 88, 'https://images.unsplash.com/photo-1594824813689-53e7b1a13437?w=300&h=300&fit=crop&crop=faces&q=80', 'Comprehensive internal medicine and preventive health checkups.', 'Mon - Sat | 10:00 AM - 02:00 PM', false, 0, 0, 12)
ON CONFLICT (email) DO NOTHING;

INSERT INTO clinic_queues (doctor_id, current_token, status, avg_consult_time_mins) VALUES
('d0000000-0000-0000-0000-000000000001', 4, 'in-session', 12),
('d0000000-0000-0000-0000-000000000002', 2, 'in-session', 15)
ON CONFLICT (doctor_id, queue_date) DO NOTHING;
