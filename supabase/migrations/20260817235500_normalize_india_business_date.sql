-- Existing queue/consultation workflows use India business date consistently.
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
        'advance_doctor_queue_atomic',
        'complete_consultation_rx_atomic',
        'mark_appointment_status_atomic',
        'pause_doctor_queue_atomic'
      )
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, 'CURRENT_DATE', '(NOW() AT TIME ZONE ''Asia/Kolkata'')::date');
    EXECUTE v_def;
  END LOOP;
END $$;
