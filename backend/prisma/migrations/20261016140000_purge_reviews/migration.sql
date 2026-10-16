-- DropTable
DROP TABLE IF EXISTS "Review" CASCADE;

-- AlterTable
ALTER TABLE "DoctorProfile" DROP COLUMN IF EXISTS "rating", DROP COLUMN IF EXISTS "totalReviews";
