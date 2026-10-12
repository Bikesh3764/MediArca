-- Drop old global queue unique index across shifts
DROP INDEX IF EXISTS "Appointment_clinicId_doctorId_appointmentDate_queueNumber_key";

-- Create new per-shift unique index including slotId
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_clinicId_doctorId_appointmentDate_slotId_queueNumber_key" ON "Appointment"("clinicId", "doctorId", "appointmentDate", "slotId", "queueNumber");
