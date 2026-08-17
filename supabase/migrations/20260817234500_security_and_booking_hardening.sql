-- MediArca existing-feature hardening migration.
-- India-only deployment: business date is Asia/Kolkata.
-- No new product features are introduced by this migration.

-- Public privacy boundary.
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
DROP POLICY IF EXISTS "Allow public read appointments" ON public.appointments;
DROP POLICY IF EXISTS "Allow public read doctors" ON public.doctors;

CREATE POLICY IF NOT EXISTS "users_read_own_or_admin"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY IF NOT EXISTS "appointments_read_owner_staff"
ON public.appointments FOR SELECT TO authenticated
USING (
  patient_id = auth.uid()
  OR doctor_id IN (SELECT d.id FROM public.doctors d WHERE d.user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('admin','receptionist')
  )
);

-- Self-signup/onboarding must never manufacture privileged roles or clinical facts.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(NEW.raw_user_meta_data->>'role','patient');
  v_full_name text;
  v_phone text;
BEGIN
  IF v_role NOT IN ('patient','doctor') THEN
    v_role := 'patient';
  END IF;

  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'),''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'),''),
    split_part(COALESCE(NEW.email,''),'@',1)
  );
  v_phone := NULLIF(trim(NEW.raw_user_meta_data->>'phone'),'');

  INSERT INTO public.users(id,email,full_name,role,phone,created_at,updated_at)
  VALUES(NEW.id,NEW.email,v_full_name,v_role,v_phone,NOW(),NOW())
  ON CONFLICT(id) DO UPDATE
  SET email=EXCLUDED.email,
      full_name=EXCLUDED.full_name,
      updated_at=NOW();

  IF v_role='patient' THEN
    INSERT INTO public.patient_clinical_profiles(user_id,age,gender,blood_group,created_at,updated_at)
    VALUES(NEW.id,NULL,NULL,NULL,NOW(),NOW())
    ON CONFLICT(user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- QR check-in is authenticated and bound to the intended patient or authorized staff/doctor.
CREATE OR REPLACE FUNCTION public.check_in_patient_qr_atomic(p_checkin_token varchar)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_appointment public.appointments%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT role INTO v_role FROM public.users WHERE id=v_actor;

  SELECT * INTO v_appointment
  FROM public.appointments
  WHERE checkin_token=p_checkin_token
  FOR UPDATE;

  IF v_appointment.id IS NULL THEN RAISE EXCEPTION 'Invalid check-in token credential.'; END IF;
  IF v_appointment.checkin_token_used_at IS NOT NULL THEN RAISE EXCEPTION 'Check-in token has already been used.'; END IF;
  IF v_appointment.checkin_token_expires_at IS NOT NULL AND v_appointment.checkin_token_expires_at < NOW() THEN RAISE EXCEPTION 'Check-in token has expired.'; END IF;

  IF NOT (
    v_actor=v_appointment.patient_id
    OR v_role IN ('admin','receptionist')
    OR EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id=v_appointment.doctor_id AND d.user_id=v_actor
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to check in this appointment.';
  END IF;

  UPDATE public.appointments
  SET status='checked_in', check_in_time=NOW(), checkin_token_used_at=NOW()
  WHERE id=v_appointment.id AND checkin_token_used_at IS NULL
  RETURNING * INTO v_appointment;

  IF v_appointment.id IS NULL THEN RAISE EXCEPTION 'Check-in token has already been used.'; END IF;
  RETURN to_jsonb(v_appointment);
END;
$$;

-- Billing is authorized by appointment ownership/role. Insurance overrides are staff-only.
CREATE OR REPLACE FUNCTION public.generate_and_settle_invoice_atomic(
  p_appointment_id uuid,
  p_payment_method varchar DEFAULT 'Card',
  p_insurance_provider varchar DEFAULT NULL,
  p_insurance_coverage numeric DEFAULT 0,
  p_coupon_code varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_appt public.appointments%ROWTYPE;
  v_doctor public.doctors%ROWTYPE;
  v_base numeric;
  v_discount numeric := 0;
  v_net numeric;
  v_ins numeric;
  v_patient_paid numeric;
  v_invoice public.patient_invoices%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT role INTO v_role FROM public.users WHERE id=v_actor;
  SELECT * INTO v_appt FROM public.appointments WHERE id=p_appointment_id;
  IF v_appt.id IS NULL THEN RAISE EXCEPTION 'Appointment not found.'; END IF;

  IF NOT (
    v_actor=v_appt.patient_id
    OR v_role IN ('admin','receptionist')
    OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id=v_appt.doctor_id AND d.user_id=v_actor)
  ) THEN
    RAISE EXCEPTION 'Not authorized to settle this appointment.';
  END IF;

  SELECT * INTO v_doctor FROM public.doctors WHERE id=v_appt.doctor_id;
  v_base := COALESCE(v_doctor.fee,0);
  IF p_coupon_code='HEALTH10' THEN v_discount := round(v_base*0.10,2);
  ELSIF p_coupon_code='PREVENT20' THEN v_discount := least(20,v_base);
  END IF;
  v_net := greatest(0,v_base-v_discount);

  IF v_role IN ('admin','receptionist') THEN
    IF p_insurance_coverage IS NULL OR p_insurance_coverage < 0 OR p_insurance_coverage > 100 THEN
      RAISE EXCEPTION 'Invalid insurance coverage.';
    END IF;
    v_ins := round(v_net*(p_insurance_coverage/100.0),2);
  ELSE
    v_ins := 0;
  END IF;
  v_patient_paid := greatest(0,v_net-v_ins);

  INSERT INTO public.patient_invoices(
    appointment_id,patient_id,doctor_id,invoice_number,consultation_fee,total_amount,
    discount_code,discount_amount,net_payable,insurance_covered_amount,patient_paid_amount,
    payment_status,payment_method,insurance_provider,settled_at
  ) VALUES(
    p_appointment_id,v_appt.patient_id,v_appt.doctor_id,
    'INV-2026-'||upper(to_hex(extract(epoch from now())::bigint))||'-'||upper(substring(md5(random()::text) from 1 for 4)),
    v_base,v_base,p_coupon_code,v_discount,v_net,v_ins,v_patient_paid,'paid',p_payment_method,
    CASE WHEN v_role IN ('admin','receptionist') THEN NULLIF(p_insurance_provider,'') ELSE NULL END,
    NOW()
  )
  ON CONFLICT (appointment_id) DO UPDATE SET
    discount_code=EXCLUDED.discount_code,
    discount_amount=EXCLUDED.discount_amount,
    net_payable=EXCLUDED.net_payable,
    insurance_covered_amount=EXCLUDED.insurance_covered_amount,
    patient_paid_amount=EXCLUDED.patient_paid_amount,
    payment_status='paid',
    payment_method=EXCLUDED.payment_method,
    insurance_provider=EXCLUDED.insurance_provider,
    settled_at=NOW()
  RETURNING * INTO v_invoice;

  RETURN to_jsonb(v_invoice);
END;
$$;

-- OPD token booking: authenticated caller always books for their own patient identity.
CREATE OR REPLACE FUNCTION public.issue_next_opd_token(
  p_doctor_id uuid,
  p_symptoms text DEFAULT 'General Consultation',
  p_patient_name varchar DEFAULT NULL,
  p_patient_phone varchar DEFAULT NULL,
  p_patient_age integer DEFAULT NULL,
  p_patient_gender varchar DEFAULT NULL,
  p_timezone varchar DEFAULT 'Asia/Kolkata'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_patient public.users%ROWTYPE;
  v_clinical public.patient_clinical_profiles%ROWTYPE;
  v_doctor public.doctors%ROWTYPE;
  v_queue public.clinic_queues%ROWTYPE;
  v_next integer;
  v_booking_id varchar;
  v_checkin_token varchar;
  v_appt public.appointments%ROWTYPE;
  v_today date := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT * INTO v_patient FROM public.users WHERE id=v_actor_id AND role='patient';
  IF v_patient.id IS NULL THEN RAISE EXCEPTION 'Only a registered patient can book an OPD token.'; END IF;
  SELECT * INTO v_clinical FROM public.patient_clinical_profiles WHERE user_id=v_actor_id;
  SELECT * INTO v_doctor FROM public.doctors WHERE id=p_doctor_id AND verification_status='verified';
  IF v_doctor.id IS NULL THEN RAISE EXCEPTION 'Doctor is not verified or does not accept appointments.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE patient_id=v_actor_id AND doctor_id=v_doctor.id AND scheduled_date=v_today
      AND status IN ('booked','checked_in','waiting','in-consultation')
  ) THEN
    RAISE EXCEPTION 'You already have an active appointment ticket with this doctor for today.';
  END IF;

  INSERT INTO public.clinic_queues(doctor_id,queue_date,current_token,total_tokens,status)
  VALUES(v_doctor.id,v_today,0,0,'in-session')
  ON CONFLICT(doctor_id,queue_date) DO UPDATE SET updated_at=NOW();
  SELECT * INTO v_queue FROM public.clinic_queues WHERE doctor_id=v_doctor.id AND queue_date=v_today FOR UPDATE;
  IF v_queue.status='paused' THEN RAISE EXCEPTION 'This doctor OPD queue is currently paused. Please wait for the queue to resume.'; END IF;
  IF v_queue.status='completed' THEN RAISE EXCEPTION 'Doctor OPD consultations are concluded for today.'; END IF;

  v_next := COALESCE(v_queue.total_tokens,0)+1;
  v_booking_id := 'MED-BK-' || upper(to_hex(extract(epoch from now())::bigint)) || '-' || upper(substring(md5(random()::text) from 1 for 4));
  v_checkin_token := 'MED-QR-' || lower(replace(gen_random_uuid()::text,'-',''));

  UPDATE public.clinic_queues SET total_tokens=v_next,status='in-session',updated_at=NOW() WHERE doctor_id=v_doctor.id AND queue_date=v_today;
  UPDATE public.doctors SET total_tokens=v_next, queue_active=true WHERE id=v_doctor.id;

  INSERT INTO public.appointments(
    booking_id,patient_id,doctor_id,patient_name,patient_phone,patient_age,patient_gender,
    token_number,status,checkin_token,checkin_token_expires_at,check_in_time,appointment_date,scheduled_date,timezone,symptoms
  ) VALUES(
    v_booking_id,v_actor_id,v_doctor.id,
    COALESCE(NULLIF(p_patient_name,''),v_patient.full_name,'Registered Patient'),
    COALESCE(NULLIF(p_patient_phone,''),v_patient.phone,'Not specified'),
    COALESCE(p_patient_age,v_clinical.age),
    COALESCE(NULLIF(p_patient_gender,''),v_clinical.gender),
    v_next,'waiting',v_checkin_token,NOW()+interval '24 hours',NULL,v_today,v_today,
    COALESCE(NULLIF(p_timezone,''),'Asia/Kolkata'),COALESCE(NULLIF(p_symptoms,''),'General Consultation')
  ) RETURNING * INTO v_appt;

  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,metadata)
  VALUES(v_actor_id,'BOOK_TOKEN','appointments',v_appt.id,jsonb_build_object('token_number',v_next,'doctor_id',v_doctor.id));
  RETURN to_jsonb(v_appt);
END;
$$;

-- Future booking: authenticated caller books for their own identity; no guest provisioning/fallback doctor.
CREATE OR REPLACE FUNCTION public.schedule_future_appointment_atomic(
  p_doctor_id uuid,
  p_scheduled_date date,
  p_scheduled_slot varchar,
  p_symptoms text DEFAULT 'General Consultation',
  p_patient_name varchar DEFAULT NULL,
  p_patient_phone varchar DEFAULT NULL,
  p_patient_age integer DEFAULT NULL,
  p_patient_gender varchar DEFAULT NULL,
  p_timezone varchar DEFAULT 'Asia/Kolkata'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_patient public.users%ROWTYPE;
  v_clinical public.patient_clinical_profiles%ROWTYPE;
  v_doctor public.doctors%ROWTYPE;
  v_booking_id varchar;
  v_checkin_token varchar;
  v_appt public.appointments%ROWTYPE;
  v_today date := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_expiry timestamptz;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT * INTO v_patient FROM public.users WHERE id=v_actor_id;
  IF v_patient.id IS NULL THEN RAISE EXCEPTION 'Registered patient profile not found.'; END IF;
  IF p_scheduled_date < v_today THEN RAISE EXCEPTION 'Cannot schedule an appointment for a past date.'; END IF;
  IF NULLIF(trim(p_scheduled_slot),'') IS NULL THEN RAISE EXCEPTION 'Appointment slot is required.'; END IF;

  SELECT * INTO v_doctor FROM public.doctors WHERE id=p_doctor_id AND verification_status='verified';
  IF v_doctor.id IS NULL THEN RAISE EXCEPTION 'Doctor is not verified or does not accept appointments.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE doctor_id=v_doctor.id AND scheduled_date=p_scheduled_date AND scheduled_slot=p_scheduled_slot
      AND status IN ('booked','checked_in','waiting','in-consultation')
  ) THEN
    RAISE EXCEPTION 'Selected slot (%) is already reserved. Please select another slot.', p_scheduled_slot;
  END IF;

  SELECT * INTO v_clinical FROM public.patient_clinical_profiles WHERE user_id=v_actor_id;
  v_booking_id := 'MED-BK-' || upper(to_hex(extract(epoch from now())::bigint)) || '-' || upper(substring(md5(random()::text) from 1 for 4));
  v_checkin_token := 'MED-QR-' || lower(replace(gen_random_uuid()::text,'-',''));
  v_expiry := ((p_scheduled_date + time '23:59:59') AT TIME ZONE 'Asia/Kolkata');

  INSERT INTO public.appointments(
    booking_id,patient_id,doctor_id,patient_name,patient_phone,patient_age,patient_gender,
    token_number,status,checkin_token,checkin_token_expires_at,check_in_time,appointment_date,scheduled_date,scheduled_slot,timezone,symptoms
  ) VALUES(
    v_booking_id,v_actor_id,v_doctor.id,
    COALESCE(NULLIF(p_patient_name,''),v_patient.full_name,'Registered Patient'),
    COALESCE(NULLIF(p_patient_phone,''),v_patient.phone,'Not specified'),
    p_patient_age,
    COALESCE(NULLIF(p_patient_gender,''),v_clinical.gender),
    NULL,'booked',v_checkin_token,v_expiry,NULL,p_scheduled_date,p_scheduled_date,p_scheduled_slot,
    COALESCE(NULLIF(p_timezone,''),'Asia/Kolkata'),COALESCE(NULLIF(p_symptoms,''),'General Consultation')
  ) RETURNING * INTO v_appt;

  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,metadata)
  VALUES(v_actor_id,'SCHEDULE_FUTURE_APPOINTMENT','appointments',v_appt.id,
         jsonb_build_object('booking_id',v_booking_id,'doctor_id',v_doctor.id,'scheduled_date',p_scheduled_date,'scheduled_slot',p_scheduled_slot));
  RETURN to_jsonb(v_appt);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_next_opd_token(uuid,text,varchar,varchar,integer,varchar,varchar) FROM anon;
REVOKE ALL ON FUNCTION public.schedule_future_appointment_atomic(uuid,date,varchar,text,varchar,varchar,integer,varchar,varchar) FROM anon;
GRANT EXECUTE ON FUNCTION public.issue_next_opd_token(uuid,text,varchar,varchar,integer,varchar,varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_future_appointment_atomic(uuid,date,varchar,text,varchar,varchar,integer,varchar,varchar) TO authenticated;

-- Existing Document Vault backend.
INSERT INTO storage.buckets(id,name,public)
VALUES('clinical_documents','clinical_documents',false)
ON CONFLICT(id) DO UPDATE SET public=false;
