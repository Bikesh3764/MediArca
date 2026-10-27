-- Doctors no longer write notes or vitals in MediArca (FIX-055); paper scripts are given at the clinic.
ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "vitals";
ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "clinicalNotes";
