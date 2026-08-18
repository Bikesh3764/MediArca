-- MediArca: normalize all remaining operational date predicates to India business date.

BEGIN;

DO $$
DECLARE
  r record;
  v_def text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname IN (
        'issue_reception_walkin_token',
        'flag_priority_appointment_atomic',
        'transfer_patient_queue_atomic',
        'reschedule_appointment_atomic',
        'verify_doctor_admin_atomic'
      )
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, 'CURRENT_DATE', '(NOW() AT TIME ZONE ''Asia/Kolkata'')::date');
    EXECUTE v_def;
  END LOOP;
END $$;

-- Keep the public queue view date-scoped if the project exposes it under this name.
DO $$
BEGIN
  IF to_regclass('public.public_queue_telemetry') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.public_queue_telemetry AS
      SELECT cq.id AS queue_id, cq.doctor_id, d.name AS doctor_name, d.specialty,
             cq.queue_date, cq.current_token, cq.total_tokens, cq.status,
             cq.avg_consult_time_mins, cq.updated_at
      FROM public.clinic_queues cq
      JOIN public.doctors d ON d.id = cq.doctor_id
      WHERE cq.queue_date = (NOW() AT TIME ZONE ''Asia/Kolkata'')::date
        AND d.verification_status = ''verified''';
    EXECUTE 'GRANT SELECT ON public.public_queue_telemetry TO anon, authenticated';
  END IF;
END $$;

COMMIT;
