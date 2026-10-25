-- Data integrity rules. Safe to re-run.

-- 1. Store every phone in the app's canonical "+91 XXXXXXXXXX" format
--    (formatIndianPhone). Only touches values that clearly hold one Indian mobile number.
UPDATE "User"
SET "phone" = '+91 ' || right(regexp_replace("phone", '\D', '', 'g'), 10)
WHERE "phone" IS NOT NULL
  AND regexp_replace("phone", '\D', '', 'g') ~ '^(91)?[6-9][0-9]{9}$'
  AND "phone" <> '+91 ' || right(regexp_replace("phone", '\D', '', 'g'), 10);

UPDATE "ClinicProfile"
SET "phone" = '+91 ' || right(regexp_replace("phone", '\D', '', 'g'), 10)
WHERE "phone" IS NOT NULL
  AND regexp_replace("phone", '\D', '', 'g') ~ '^(91)?[6-9][0-9]{9}$'
  AND "phone" <> '+91 ' || right(regexp_replace("phone", '\D', '', 'g'), 10);

UPDATE "ReceptionistProfile"
SET "phone" = '+91 ' || right(regexp_replace("phone", '\D', '', 'g'), 10)
WHERE "phone" IS NOT NULL
  AND regexp_replace("phone", '\D', '', 'g') ~ '^(91)?[6-9][0-9]{9}$'
  AND "phone" <> '+91 ' || right(regexp_replace("phone", '\D', '', 'g'), 10);

-- 2. Reject unknown status / role values at the database level
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_status_check') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_status_check" CHECK ("status" IN (
      'PENDING_APPROVAL', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'
    ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_paymentStatus_check') THEN
    ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_paymentStatus_check" CHECK ("paymentStatus" IN ('PENDING', 'PAID', 'FAILED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_role_check') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK ("role" IN ('PATIENT', 'DOCTOR', 'RECEPTIONIST', 'CLINIC', 'ADMIN'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fee_not_negative') THEN
    ALTER TABLE "DoctorProfile" ADD CONSTRAINT "fee_not_negative" CHECK ("consultationFee" >= 0);
  END IF;
END $$;

-- 3. One queue number per doctor/clinic/date/shift, even when clinic or shift is empty.
--    Postgres normally treats empty (NULL) values as all different, so walk-ins without a
--    clinic or shift could share a token number. NULLS NOT DISTINCT needs PostgreSQL 15+.
DROP INDEX IF EXISTS "Appointment_clinicId_doctorId_appointmentDate_slotId_queueNumber_key";
CREATE UNIQUE INDEX "Appointment_clinicId_doctorId_appointmentDate_slotId_queueNumber_key"
  ON "Appointment" ("clinicId", "doctorId", "appointmentDate", "slotId", "queueNumber") NULLS NOT DISTINCT;
