-- Existing Document Vault workflow: assigned/linked doctors may read document metadata.
DROP POLICY IF EXISTS "documents_patient_access" ON public.clinical_documents;
CREATE POLICY "documents_patient_doctor_admin_access"
ON public.clinical_documents
FOR SELECT TO authenticated
USING (
  patient_id = auth.uid()
  OR is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.doctors d
    WHERE d.user_id = auth.uid()
      AND (
        d.id = public.clinical_documents.doctor_id
        OR EXISTS (
          SELECT 1
          FROM public.appointments a
          WHERE a.patient_id = public.clinical_documents.patient_id
            AND a.doctor_id = d.id
            AND a.scheduled_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        )
      )
  )
);
