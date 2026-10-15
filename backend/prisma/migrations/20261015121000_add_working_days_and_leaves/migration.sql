-- AlterTable
ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "workingDays" TEXT;
ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "leaves" TEXT;

-- AlterTable
ALTER TABLE "ClinicDoctor" ADD COLUMN IF NOT EXISTS "workingDays" TEXT;
ALTER TABLE "ClinicDoctor" ADD COLUMN IF NOT EXISTS "leaves" TEXT;
