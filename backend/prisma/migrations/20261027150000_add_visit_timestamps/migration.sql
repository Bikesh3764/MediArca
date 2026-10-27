-- Visit timestamps for the live wait estimate. Both optional; existing rows stay NULL.
ALTER TABLE "Appointment" ADD COLUMN "calledAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "completedAt" TIMESTAMP(3);
