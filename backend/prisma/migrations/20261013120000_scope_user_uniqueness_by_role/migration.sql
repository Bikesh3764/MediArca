-- Drop old global email unique constraint & index so a single email can open separate accounts per portal (PATIENT, DOCTOR, RECEPTIONIST, CLINIC, ADMIN)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_email_key";

-- Create composite unique index on (email, role) and lookup index on email
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_role_key" ON "User"("email", "role");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
