-- Existing booking flows: patient identity always comes from the authenticated account.
CREATE OR REPLACE FUNCTION public.issue_next_opd_token(
  p_doctor_id uuid,
  p_symptoms text DEFAULT 'General Consultation',
  p_patient_name varchar DEFAULT NULL,
  p_patient_phone varchar DEFAULT NULL,
  p_patient_age integer DEFAULT NULL,
  p_patient_gender varchar DEFAULT NULL,
  p_timezone varchar DEFAULT 'Asia/Kolkata'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor_id uuid := auth.uid(); v_patient public.users%ROWTYPE; v_clinical public.patient_clinical_profiles%ROWTYPE;
  v_doctor public.doctors%ROWTYPE; v_queue public.clinic_queues%ROWTYPE; v_next integer; v_booking_id varchar;
  v_checkin_token varchar; v_appt public.appointments%ROWTYPE; v_today date := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT * INTO v_patient FROM public.users WHERE id=v_actor_id AND role='patient';
  IF v_patient.id IS NULL THEN RAISE EXCEPTION 'Only a registered patient can book an OPD token.'; END IF;
  SELECT * INTO v_clinical FROM public.patient_clinical_profiles WHERE user_id=v_actor_id;
  SELECT * INTO v_doctor FROM public.doctors WHERE id=p_doctor_id AND verification_status='verified';
  IF v_doctor.id IS NULL THEN RAISE EXCEPTION 'Doctor is not verified or does not accept appointments.'; END IF;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE patient_id=v_actor_id AND doctor_id=v_doctor.id AND scheduled_date=v_today AND status IN ('booked','checked_in','waiting','in-consultation')) THEN
    RAISE EXCEPTION 'You already have an active appointment ticket with this doctor for today.';
  END IF;
  INSERT INTO public.clinic_queues(doctor_id,queue_date,current_token,total_tokens,status) VALUES(v_doctor.id,v_today,0,0,'in-session') ON CONFLICT(doctor_id,queue_date) DO UPDATE SET updated_at=NOW();
  SELECT * INTO v_queue FROM public.clinic_queues WHERE doctor_id=v_doctor.id AND queue_date=v_today FOR UPDATE;
  IF v_queue.status='paused' THEN RAISE EXCEPTION 'This doctor OPD queue is currently paused. Please wait for the queue to resume.'; END IF;
  IF v_queue.status='completed' THEN RAISE EXCEPTION 'Doctor OPD consultations are concluded for today.'; END IF;
  v_next := COALESCE(v_queue.total_tokens,0)+1;
  v_booking_id := 'MED-BK-' || upper(to_hex(extract(epoch from now())::bigint)) || '-' || upper(substring(md5(random()::text) from 1 for 4));
  v_checkin_token := 'MED-QR-' || lower(replace(gen_random_uuid()::text,'-',''));
  UPDATE public.clinic_queues SET total_tokens=v_next,status='in-session',updated_at=NOW() WHERE doctor_id=v_doctor.id AND queue_date=v_today;
  UPDATE public.doctors SET total_tokens=v_next, queue_active=true WHERE id=v_doctor.id;
  INSERT INTO public.appointments(booking_id,patient_id,doctor_id,patient_name,patient_phone,patient_age,patient_gender,token_number,status,checkin_token,checkin_token_expires_at,check_in_time,appointment_date,scheduled_date,timezone,symptoms)
  VALUES(v_booking_id,v_actor_id,v_doctor.id,v_patient.full_name,COALESCE(v_patient.phone,'Not specified'),v_clinical.age,v_clinical.gender,v_next,'waiting',v_checkin_token,NOW()+interval '24 hours',NULL,v_today,v_today,COALESCE(NULLIF(p_timezone,''),'Asia/Kolkata'),COALESCE(NULLIF(p_symptoms,''),'General Consultation'))
  RETURNING * INTO v_appt;
  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,metadata) VALUES(v_actor_id,'BOOK_TOKEN','appointments',v_appt.id,jsonb_build_object('token_number',v_next,'doctor_id',v_doctor.id));
  RETURN to_jsonb(v_appt);
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_future_appointment_atomic(
  p_doctor_id uuid,p_scheduled_date date,p_scheduled_slot varchar,p_symptoms text DEFAULT 'General Consultation',
  p_patient_name varchar DEFAULT NULL,p_patient_phone varchar DEFAULT NULL,p_patient_age integer DEFAULT NULL,
  p_patient_gender varchar DEFAULT NULL,p_timezone varchar DEFAULT 'Asia/Kolkata'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor_id uuid := auth.uid(); v_patient public.users%ROWTYPE; v_clinical public.patient_clinical_profiles%ROWTYPE;
  v_doctor public.doctors%ROWTYPE; v_booking_id varchar; v_checkin_token varchar; v_appt public.appointments%ROWTYPE;
  v_today date := (NOW() AT TIME ZONE 'Asia/Kolkata')::date; v_expiry timestamptz;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  SELECT * INTO v_patient FROM public.users WHERE id=v_actor_id AND role='patient';
  IF v_patient.id IS NULL THEN RAISE EXCEPTION 'Registered patient profile not found.'; END IF;
  IF p_scheduled_date < v_today THEN RAISE EXCEPTION 'Cannot schedule an appointment for a past date.'; END IF;
  IF NULLIF(trim(p_scheduled_slot),'') IS NULL THEN RAISE EXCEPTION 'Appointment slot is required.'; END IF;
  SELECT * INTO v_doctor FROM public.doctors WHERE id=p_doctor_id AND verification_status='verified';
  IF v_doctor.id IS NULL THEN RAISE EXCEPTION 'Doctor is not verified or does not accept appointments.'; END IF;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE doctor_id=v_doctor.id AND scheduled_date=p_scheduled_date AND scheduled_slot=p_scheduled_slot AND status IN ('booked','checked_in','waiting','in-consultation')) THEN
    RAISE EXCEPTION 'Selected slot (%) is already reserved. Please select another slot.', p_scheduled_slot;
  END IF;
  SELECT * INTO v_clinical FROM public.patient_clinical_profiles WHERE user_id=v_actor_id;
  v_booking_id := 'MED-BK-' || upper(to_hex(extract(epoch from now())::bigint)) || '-' || upper(substring(md5(random()::text) from 1 for 4));
  v_checkin_token := 'MED-QR-' || lower(replace(gen_random_uuid()::text,'-',''));
  v_expiry := ((p_scheduled_date + time '23:59:59') AT TIME ZONE 'Asia/Kolkata');
  INSERT INTO public.appointments(booking_id,patient_id,doctor_id,patient_name,patient_phone,patient_age,patient_gender,token_number,status,checkin_token,checkin_token_expires_at,check_in_time,appointment_date,scheduled_date,scheduled_slot,timezone,symptoms)
  VALUES(v_booking_id,v_actor_id,v_doctor.id,v_patient.full_name,COALESCE(v_patient.phone,'Not specified'),v_clinical.age,v_clinical.gender,NULL,'booked',v_checkin_token,v_expiry,NULL,p_scheduled_date,p_scheduled_date,p_scheduled_slot,COALESCE(NULLIF(p_timezone,''),'Asia/Kolkata'),COALESCE(NULLIF(p_symptoms,''),'General Consultation'))
  RETURNING * INTO v_appt;
  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,metadata) VALUES(v_actor_id,'SCHEDULE_FUTURE_APPOINTMENT','appointments',v_appt.id,jsonb_build_object('booking_id',v_booking_id,'doctor_id',v_doctor.id,'scheduled_date',p_scheduled_date,'scheduled_slot',p_scheduled_slot));
  RETURN to_jsonb(v_appt);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_next_opd_token(uuid,text,varchar,varchar,integer,varchar,varchar) FROM anon;
REVOKE ALL ON FUNCTION public.schedule_future_appointment_atomic(uuid,date,varchar,text,varchar,varchar,integer,varchar,varchar) FROM anon;
GRANT EXECUTE ON FUNCTION public.issue_next_opd_token(uuid,text,varchar,varchar,integer,varchar,varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_future_appointment_atomic(uuid,date,varchar,text,varchar,varchar,integer,varchar,varchar) TO authenticated;
