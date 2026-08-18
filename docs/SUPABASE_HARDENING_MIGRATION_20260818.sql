-- MediArca live Supabase hardening migration
-- Project: pkvwnsigucncdwrjtggs
-- Purpose: close anonymous SECURITY DEFINER execution paths and scope clinical-document access.

BEGIN;

-- Clinical documents: patients can access their own vault, administrators can manage all records,
-- and verified attending doctors can read only the patient's active same-day care episode.
ALTER TABLE public.clinical_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clinical documents access" ON public.clinical_documents;
DROP POLICY IF EXISTS "Patients can view own documents" ON public.clinical_documents;
DROP POLICY IF EXISTS "Patients can upload own documents" ON public.clinical_documents;
DROP POLICY IF EXISTS "Attending doctors can view clinical documents" ON public.clinical_documents;
DROP POLICY IF EXISTS "documents_patient_access" ON public.clinical_documents;
DROP POLICY IF EXISTS "documents_patient_doctor_admin_access" ON public.clinical_documents;
DROP POLICY IF EXISTS "documents_admin_manage" ON public.clinical_documents;

CREATE POLICY "documents_patient_doctor_admin_access" ON public.clinical_documents
FOR SELECT TO authenticated
USING (
    patient_id = (SELECT auth.uid())
    OR is_admin((SELECT auth.uid()))
    OR EXISTS (
        SELECT 1
        FROM public.doctors d
        JOIN public.appointments a ON a.doctor_id = d.id
        WHERE d.user_id = (SELECT auth.uid())
          AND d.verification_status = 'verified'
          AND a.patient_id = public.clinical_documents.patient_id
          AND a.scheduled_date = ((NOW() AT TIME ZONE 'Asia/Kolkata')::date)
          AND a.status IN ('waiting', 'in-consultation')
    )
);

CREATE POLICY "Patients can upload own documents" ON public.clinical_documents
FOR INSERT TO authenticated
WITH CHECK (
    patient_id = (SELECT auth.uid())
    AND (
        doctor_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM public.doctors d
            JOIN public.appointments a ON a.doctor_id = d.id
            WHERE d.id = public.clinical_documents.doctor_id
              AND d.verification_status = 'verified'
              AND a.patient_id = (SELECT auth.uid())
              AND a.scheduled_date = ((NOW() AT TIME ZONE 'Asia/Kolkata')::date)
              AND a.status IN ('waiting', 'in-consultation')
        )
    )
);

CREATE POLICY "documents_admin_manage" ON public.clinical_documents
FOR ALL TO authenticated
USING (is_admin((SELECT auth.uid())))
WITH CHECK (is_admin((SELECT auth.uid())));

-- RPCs invoked by signed-in application users must never be callable anonymously.
REVOKE ALL ON FUNCTION public.issue_next_opd_token(uuid, text, character varying, character varying, integer, character varying, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_next_opd_token(uuid, text, character varying, character varying, integer, character varying, character varying) TO authenticated;

REVOKE ALL ON FUNCTION public.issue_reception_walkin_token(uuid, character varying, character varying, integer, character varying, text, boolean, text, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_reception_walkin_token(uuid, character varying, character varying, integer, character varying, text, boolean, text, character varying) TO authenticated;

REVOKE ALL ON FUNCTION public.schedule_future_appointment_atomic(uuid, date, character varying, text, character varying, character varying, integer, character varying, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_future_appointment_atomic(uuid, date, character varying, text, character varying, character varying, integer, character varying, character varying) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_appointment_status_atomic(uuid, integer, character varying, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_appointment_status_atomic(uuid, integer, character varying, text) TO authenticated;

REVOKE ALL ON FUNCTION public.transfer_patient_queue(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_patient_queue(uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.advance_doctor_queue_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_doctor_queue_atomic(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.check_in_patient_qr_atomic(character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_patient_qr_atomic(character varying) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_consultation_rx_atomic(uuid, integer, text, text[], text, jsonb, text, text, text, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_consultation_rx_atomic(uuid, integer, text, text[], text, jsonb, text, text, text, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.generate_and_settle_invoice_atomic(uuid, character varying, character varying, numeric, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_and_settle_invoice_atomic(uuid, character varying, character varying, numeric, character varying) TO authenticated;

REVOKE ALL ON FUNCTION public.pause_doctor_queue_atomic(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pause_doctor_queue_atomic(uuid, boolean, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_patient_profile_atomic(text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_patient_profile_atomic(text, text, integer, text, text) TO authenticated;

-- Trigger-only guard: no API caller should be able to invoke it directly.
REVOKE ALL ON FUNCTION public.prevent_user_identity_self_update() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Note: Supabase Auth leaked-password protection is a dashboard Auth setting and cannot be enabled by SQL.
-- The public_doctor_directory view intentionally uses SECURITY DEFINER to expose a sanitized directory
-- while doctors remains private; retain it until a dedicated public-directory table is introduced.

-- Verification queries (run separately; kept here as operator notes):
-- SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clinical_documents';
-- SELECT has_function_privilege('anon', 'public.issue_next_opd_token(uuid,text,character varying,character varying,integer,character varying,character varying)', 'EXECUTE');
-- SELECT has_function_privilege('authenticated', 'public.issue_next_opd_token(uuid,text,character varying,character varying,integer,character varying,character varying)', 'EXECUTE');

