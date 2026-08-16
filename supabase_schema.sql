-- ==============================================================================
-- MEDIARCA HEALTHCARE - SUPABASE CLOUD DATABASE SCHEMA & REALTIME ENGINE
-- Run this in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DROP EXISTING TABLES IF ANY
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS clinic_queues CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. USERS TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    age INT,
    gender VARCHAR(20),
    blood_group VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. DOCTORS TABLE (Includes Mediarca ID & Medical Council License)
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    specialty_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) DEFAULT 'Consultant Specialist',
    degrees TEXT NOT NULL,
    reg_number VARCHAR(100) UNIQUE NOT NULL, -- Medical Council License
    mediarca_id VARCHAR(50) UNIQUE,          -- Official ID e.g. MED-DOC-1082
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    experience_years INT NOT NULL DEFAULT 5,
    hospital TEXT NOT NULL,
    fee NUMERIC(10,2) NOT NULL DEFAULT 50.00,
    rating NUMERIC(3,2) DEFAULT 4.9,
    reviews_count INT DEFAULT 150,
    avatar TEXT,
    bio TEXT,
    schedule TEXT DEFAULT 'Mon - Fri | 09:00 AM - 02:00 PM',
    queue_active BOOLEAN DEFAULT false,
    current_token INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    avg_consult_time_mins INT DEFAULT 12,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CLINIC LIVE QUEUES TABLE
CREATE TABLE clinic_queues (
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
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id VARCHAR(50) UNIQUE NOT NULL, -- e.g. MED-BK-7890
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

-- 6. ENABLE ROW LEVEL SECURITY (RLS) FOR SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Allow public read and client operations for this demo
CREATE POLICY "Allow public read users" ON users FOR ALL USING (true);
CREATE POLICY "Allow public read doctors" ON doctors FOR ALL USING (true);
CREATE POLICY "Allow public read clinic_queues" ON clinic_queues FOR ALL USING (true);
CREATE POLICY "Allow public read appointments" ON appointments FOR ALL USING (true);

-- 7. ENABLE REALTIME SYNC (WebSockets)
ALTER PUBLICATION supabase_realtime ADD TABLE clinic_queues;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE doctors;

-- 8. SEED INITIAL USERS & ACCREDITED DOCTORS
INSERT INTO users (id, role, email, password_hash, full_name, phone, age, gender, blood_group) VALUES
('a0000000-0000-0000-0000-000000000001', 'patient', 'sarah@mediarca.health', 'patient123', 'Sarah Johnson', '+1 (555) 234-8900', 32, 'Female', 'O+'),
('a0000000-0000-0000-0000-000000000002', 'doctor', 'thorne@mediarca.health', 'doc123', 'Dr. Aris Thorne', '+1 (555) 345-6789', 48, 'Male', 'A+'),
('a0000000-0000-0000-0000-000000000003', 'doctor', 'vance@mediarca.health', 'doc123', 'Dr. Elena Vance', '+1 (555) 456-7890', 39, 'Female', 'B+'),
('a0000000-0000-0000-0000-000000000004', 'admin', 'admin@mediarca.health', 'admin2026', 'Medical Board Director Robert Vance', '+1 (555) 999-0000', 52, 'Male', 'AB+');

-- SEED DOCTORS
INSERT INTO doctors (id, user_id, name, email, specialty, specialty_id, title, degrees, reg_number, mediarca_id, verification_status, experience_years, hospital, fee, rating, reviews_count, avatar, bio, schedule, queue_active, current_token, total_tokens, avg_consult_time_mins) VALUES
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Dr. Aris Thorne', 'thorne@mediarca.health', 'Cardiology', 'cardiology', 'Senior Interventional Cardiologist', 'MBBS, MD (Cardiology), FACC', 'NMC-84920-IND', 'MED-DOC-1082', 'verified', 16, 'Metro Heart Institute, Wing B - Room 304', 65.00, 4.9, 312, 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&h=300&fit=crop&crop=faces&q=80', 'Specialist in preventative cardiology, coronary angioplasty, and hypertension management.', 'Mon - Fri | 09:00 AM - 02:00 PM', true, 4, 7, 12),
('d0000000-0000-0000-0000-000000000002', NULL, 'Dr. Ananya Sen', 'sen@mediarca.health', 'Dermatology', 'dermatology', 'Consultant Dermatologist & Dermatosurgeon', 'MBBS, MD - Dermatology, Venereology & Leprosy', 'WBMC-77341-REG', 'MED-DOC-2390', 'verified', 11, 'Apex Skin & Laser Clinic, Suite 12', 50.00, 4.8, 245, 'https://images.unsplash.com/photo-1594824813501-48e02d64a27a?w=300&h=300&fit=crop&crop=faces&q=80', 'Expertise in clinical dermatology, acne therapeutics, and psoriasis biologics.', 'Mon, Wed, Sat | 10:00 AM - 04:00 PM', true, 2, 6, 15),
('d0000000-0000-0000-0000-000000000003', NULL, 'Dr. Marcus Vance', 'marcus@mediarca.health', 'Orthopedics', 'orthopedics', 'Chief Joint Replacement Surgeon', 'MBBS, MS (Orthopedics), MCh (Ortho)', 'DMC-90114-MED', 'MED-DOC-4482', 'verified', 19, 'Global Orthopedic Center, Level 2', 80.00, 4.95, 489, 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&h=300&fit=crop&crop=faces&q=80', 'Pioneer in robotic total knee and hip arthroplasty with over 4,500 procedures.', 'Tue, Thu, Sat | 08:30 AM - 01:30 PM', true, 6, 12, 10),
('d0000000-0000-0000-0000-000000000004', NULL, 'Dr. Clara Sterling', 'clara@mediarca.health', 'Pediatrics', 'pediatrics', 'Senior Pediatrician & Neonatologist', 'MBBS, DNB (Pediatrics), FIAP', 'MMC-65239-REG', 'MED-DOC-5519', 'verified', 14, 'Care Children Hospital, Pediatric OPD 4', 45.00, 4.9, 380, 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&fit=crop&crop=faces&q=80', 'Specialized in newborn care, developmental milestones, and pediatric asthma.', 'Daily | 09:30 AM - 03:30 PM', true, 1, 5, 12),
('d0000000-0000-0000-0000-000000000005', NULL, 'Dr. Kabir Oberoi', 'kabir@mediarca.health', 'Neurology', 'neurology', 'Consultant Neurologist & Stroke Specialist', 'MBBS, MD (Gen Med), DM (Neurology)', 'MCI-18834-NEU', 'MED-DOC-8924', 'verified', 13, 'Neuro Care & Research Institute, Block A', 75.00, 4.85, 194, 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&h=300&fit=crop&crop=faces&q=80', 'Expert in migraines, epilepsy management, and Parkinson disease.', 'Mon - Fri | 11:00 AM - 05:00 PM', false, 0, 0, 15),
('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'Dr. Elena Vance', 'vance@mediarca.health', 'General Medicine', 'general', 'Associate Physician & Family Specialist', 'MBBS, MD (Internal Medicine)', 'KMC-54321-APP', NULL, 'pending', 8, 'City Life Health Center', 40.00, 4.7, 88, 'https://images.unsplash.com/photo-1594824813689-53e7b1a13437?w=300&h=300&fit=crop&crop=faces&q=80', 'Comprehensive internal medicine and preventive health checkups.', 'Mon - Sat | 10:00 AM - 02:00 PM', false, 0, 0, 12);

-- SEED ACTIVE QUEUES
INSERT INTO clinic_queues (doctor_id, current_token, status, avg_consult_time_mins) VALUES
('d0000000-0000-0000-0000-000000000001', 4, 'in-session', 12),
('d0000000-0000-0000-0000-000000000002', 2, 'in-session', 15);

-- SEED APPOINTMENTS
INSERT INTO appointments (booking_id, patient_id, doctor_id, patient_name, patient_phone, patient_age, patient_gender, token_number, status, check_in_time, symptoms, diagnosis, medications, advice) VALUES
('MED-BK-7890', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Sarah Johnson', '+1 (555) 234-8900', 32, 'Female', 4, 'in-consultation', '09:42 AM', 'Occasional chest tightness during intense workout sessions', 'Mild exercise-induced tachycardia. Normal sinus rhythm on resting ECG.', ARRAY['Tab. Metoprolol 25mg (OD Morning)', 'Electrolytes & Hydration'], 'Avoid high caffeine stimulants pre-workout. Follow-up 2D Echo next week.'),
('MED-BK-1001', NULL, 'd0000000-0000-0000-0000-000000000001', 'Arthur Dent', '+1 (555) 111-2222', 45, 'Male', 1, 'completed', '09:00 AM', 'ECG review & palpitations', 'Normal resting rhythm', ARRAY['Multivitamins'], 'Drink plenty of water.'),
('MED-BK-1002', NULL, 'd0000000-0000-0000-0000-000000000001', 'Maria Garcia', '+1 (555) 333-4444', 50, 'Female', 2, 'completed', '09:14 AM', 'Post-angioplasty routine check', 'Stable recovery', ARRAY['Aspirin 75mg'], 'Maintain low sodium diet.'),
('MED-BK-1003', NULL, 'd0000000-0000-0000-0000-000000000001', 'Liam Wilson', '+1 (555) 555-6666', 38, 'Male', 3, 'completed', '09:28 AM', 'Blood pressure adjustment', 'Stage 1 hypertension controlled', ARRAY['Telmisartan 40mg'], 'Morning walk 30 mins.'),
('MED-BK-1005', NULL, 'd0000000-0000-0000-0000-000000000001', 'Dev Patel', '+1 (555) 777-8888', 29, 'Male', 5, 'waiting', '09:50 AM', 'Cholesterol profile analysis', NULL, NULL, NULL),
('MED-BK-1006', NULL, 'd0000000-0000-0000-0000-000000000001', 'Hannah Abbott', '+1 (555) 888-9999', 34, 'Female', 6, 'waiting', '09:55 AM', 'Shortness of breath on stairs', NULL, NULL, NULL);
