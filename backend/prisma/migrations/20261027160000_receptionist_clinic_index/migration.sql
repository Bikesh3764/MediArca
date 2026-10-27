-- Faster lookup of a clinic's receptionists (Supabase advisor: unindexed foreign key).
CREATE INDEX IF NOT EXISTS "ReceptionistProfile_clinicId_idx" ON "ReceptionistProfile"("clinicId");
