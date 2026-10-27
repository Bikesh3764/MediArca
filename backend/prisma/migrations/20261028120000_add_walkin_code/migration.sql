-- Walk-in patients get a 6-character code to track their queue from the home page (FIX-058).
-- Unique per day; empty for normal app bookings. RLS on "Appointment" is already enabled.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "walkInCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_appointmentDate_walkInCode_key" ON "Appointment"("appointmentDate", "walkInCode");
