-- MediArca Supabase Auth trigger hardening
-- Fixes live AuthRetryableFetchError: Database error querying schema during password sign-in.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role TEXT := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');
    v_full_name TEXT;
    v_phone TEXT;
BEGIN
    IF v_role NOT IN ('patient', 'doctor', 'admin', 'receptionist') THEN
        v_role := 'patient';
    END IF;

    v_full_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
        split_part(COALESCE(NEW.email, ''), '@', 1),
        'Registered User'
    );
    v_phone := NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '');

    INSERT INTO public.users (id, email, full_name, role, phone, created_at, updated_at)
    VALUES (NEW.id, NEW.email, v_full_name, v_role, v_phone, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, public.users.phone),
        updated_at = NOW();

    IF v_role = 'patient' THEN
        INSERT INTO public.patient_clinical_profiles (user_id, age, gender, blood_group, created_at, updated_at)
        VALUES (
            NEW.id,
            NULLIF(NEW.raw_user_meta_data->>'age', '')::INT,
            NULLIF(NEW.raw_user_meta_data->>'gender', ''),
            NULLIF(NEW.raw_user_meta_data->>'bloodGroup', ''),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Application-profile mirroring must never block Supabase Auth login or token issuance.
    RAISE WARNING 'MediArca auth profile mirror skipped for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

COMMIT;
