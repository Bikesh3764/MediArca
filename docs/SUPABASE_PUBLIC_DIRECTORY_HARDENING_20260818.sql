-- MediArca public directory view hardening
-- The view exposes only approved directory columns; row access is now enforced by doctors RLS.

BEGIN;

DROP POLICY IF EXISTS "doctors_public_directory_select" ON public.doctors;
CREATE POLICY "doctors_public_directory_select" ON public.doctors
FOR SELECT TO anon, authenticated
USING (verification_status = 'verified');

ALTER VIEW public.public_doctor_directory SET (security_invoker = true);

COMMIT;
