-- Drop old global queue unique constraint and index across shifts
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_doctorId_appointmentDate_queueNumber_key";
DROP INDEX IF EXISTS "Appointment_doctorId_appointmentDate_queueNumber_key";
DROP INDEX IF EXISTS "Appointment_clinicId_doctorId_appointmentDate_queueNumber_key";

-- Create new per-shift unique index including slotId
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_clinicId_doctorId_appointmentDate_slotId_queueNumber_key" ON "Appointment"("clinicId", "doctorId", "appointmentDate", "slotId", "queueNumber");
