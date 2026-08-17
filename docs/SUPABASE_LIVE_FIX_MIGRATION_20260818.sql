-- MediArca live-release hardening applied on 2026-08-18
-- Payment/billing intentionally excluded.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient', 'doctor', 'admin', 'receptionist'));

REVOKE ALL ON FUNCTION public.issue_next_opd_token(uuid,text,character varying,character varying,integer,character varying,character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_next_opd_token(uuid,text,character varying,character varying,integer,character varying,character varying) TO authenticated;

REVOKE ALL ON FUNCTION public.schedule_future_appointment_atomic(uuid,date,character varying,text,character varying,character varying,integer,character varying,character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_future_appointment_atomic(uuid,date,character varying,text,character varying,character varying,integer,character varying,character varying) TO authenticated;
