-- RLS performance cleanup; access semantics remain unchanged.
DROP POLICY IF EXISTS "doctors_read_authenticated_scope" ON public.doctors;
DROP POLICY IF EXISTS "verified_doctors_public_directory" ON public.doctors;
CREATE POLICY "doctors_read_scoped"
ON public.doctors FOR SELECT TO anon, authenticated
USING (
  verification_status = 'verified'
  OR user_id = (select auth.uid())
  OR is_admin((select auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (select auth.uid()) AND u.role = 'receptionist'
  )
);

DROP POLICY IF EXISTS "doctors_update_own_or_admin" ON public.doctors;
CREATE POLICY "doctors_update_own_or_admin"
ON public.doctors FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()) OR is_admin((select auth.uid())))
WITH CHECK (user_id = (select auth.uid()) OR is_admin((select auth.uid())));

DROP POLICY IF EXISTS "users_read_own_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_own_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_update_own_authenticated" ON public.users;
CREATE POLICY "users_read_own_or_admin" ON public.users FOR SELECT TO authenticated
USING (id = (select auth.uid()) OR is_admin((select auth.uid())));
CREATE POLICY "users_insert_own_authenticated" ON public.users FOR INSERT TO authenticated
WITH CHECK (id = (select auth.uid()) OR is_admin((select auth.uid())));
CREATE POLICY "users_update_own_authenticated" ON public.users FOR UPDATE TO authenticated
USING (id = (select auth.uid()) OR is_admin((select auth.uid())))
WITH CHECK (id = (select auth.uid()) OR is_admin((select auth.uid())));

DROP POLICY IF EXISTS "appointments_read_owner_staff" ON public.appointments;
CREATE POLICY "appointments_read_owner_staff" ON public.appointments FOR SELECT TO authenticated
USING (
  patient_id = (select auth.uid())
  OR doctor_id IN (SELECT d.id FROM public.doctors d WHERE d.user_id = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (select auth.uid()) AND u.role IN ('admin','receptionist'))
);

DROP POLICY IF EXISTS "patient_clinical_profiles_read" ON public.patient_clinical_profiles;
DROP POLICY IF EXISTS "patient_clinical_profiles_insert" ON public.patient_clinical_profiles;
DROP POLICY IF EXISTS "patient_clinical_profiles_update" ON public.patient_clinical_profiles;
CREATE POLICY "patient_clinical_profiles_read" ON public.patient_clinical_profiles FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR is_admin((select auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.doctors d ON d.id = a.doctor_id
    WHERE a.patient_id = public.patient_clinical_profiles.user_id
      AND d.user_id = (select auth.uid())
      AND a.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
  )
);
CREATE POLICY "patient_clinical_profiles_insert" ON public.patient_clinical_profiles FOR INSERT TO authenticated
WITH CHECK (user_id = (select auth.uid()) OR is_admin((select auth.uid())));
CREATE POLICY "patient_clinical_profiles_update" ON public.patient_clinical_profiles FOR UPDATE TO authenticated
USING (user_id = (select auth.uid()) OR is_admin((select auth.uid())))
WITH CHECK (user_id = (select auth.uid()) OR is_admin((select auth.uid())));

DROP POLICY IF EXISTS "documents_patient_doctor_admin_access" ON public.clinical_documents;
CREATE POLICY "documents_patient_doctor_admin_access"
ON public.clinical_documents FOR SELECT TO authenticated
USING (
  patient_id = (select auth.uid())
  OR is_admin((select auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.user_id = (select auth.uid())
      AND (
        d.id = public.clinical_documents.doctor_id
        OR EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.patient_id = public.clinical_documents.patient_id
            AND a.doctor_id = d.id
            AND a.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        )
      )
  )
);
