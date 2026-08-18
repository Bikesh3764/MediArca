-- MediArca authoritative hospital settings
-- Persist administrator configuration server-side; never rely on browser localStorage for operational settings.

BEGIN;

CREATE TABLE IF NOT EXISTS public.system_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    slot_buffer_mins INTEGER NOT NULL DEFAULT 12 CHECK (slot_buffer_mins BETWEEN 1 AND 120),
    hospital_name TEXT NOT NULL DEFAULT 'Apex Healthcare Network International' CHECK (char_length(trim(hospital_name)) BETWEEN 2 AND 255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.system_settings (id, slot_buffer_mins, hospital_name)
VALUES ('global', 12, 'Apex Healthcare Network International')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_settings_admin_read ON public.system_settings;
CREATE POLICY system_settings_admin_read ON public.system_settings
FOR SELECT TO authenticated
USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS system_settings_admin_write ON public.system_settings;
CREATE POLICY system_settings_admin_write ON public.system_settings
FOR ALL TO authenticated
USING (public.is_admin((SELECT auth.uid())))
WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.get_hospital_settings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_role TEXT;
    v_settings public.system_settings%ROWTYPE;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;
    SELECT role INTO v_role FROM public.users WHERE id = v_actor_id;
    IF v_role <> 'admin' AND NOT public.is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Access Denied: Hospital settings are restricted to administrators.';
    END IF;

    SELECT * INTO v_settings FROM public.system_settings WHERE id = 'global';
    IF v_settings.id IS NULL THEN
        INSERT INTO public.system_settings (id) VALUES ('global') RETURNING * INTO v_settings;
    END IF;
    RETURN to_jsonb(v_settings);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_hospital_settings_atomic(
    p_slot_buffer_mins INTEGER,
    p_hospital_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_role TEXT;
    v_settings public.system_settings%ROWTYPE;
    v_name TEXT := NULLIF(trim(p_hospital_name), '');
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;
    SELECT role INTO v_role FROM public.users WHERE id = v_actor_id;
    IF v_role <> 'admin' AND NOT public.is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can update hospital settings.';
    END IF;
    IF p_slot_buffer_mins IS NULL OR p_slot_buffer_mins NOT BETWEEN 1 AND 120 THEN
        RAISE EXCEPTION 'Slot buffer must be between 1 and 120 minutes.';
    END IF;
    IF v_name IS NULL OR char_length(v_name) < 2 OR char_length(v_name) > 255 THEN
        RAISE EXCEPTION 'Hospital group name must contain between 2 and 255 characters.';
    END IF;

    INSERT INTO public.system_settings (id, slot_buffer_mins, hospital_name, updated_at)
    VALUES ('global', p_slot_buffer_mins, v_name, NOW())
    ON CONFLICT (id) DO UPDATE
    SET slot_buffer_mins = EXCLUDED.slot_buffer_mins,
        hospital_name = EXCLUDED.hospital_name,
        updated_at = NOW()
    RETURNING * INTO v_settings;

    INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
    VALUES (
        v_actor_id,
        'ADMIN_HOSPITAL_SETTINGS_SAVED',
        'system_settings',
        'global',
        jsonb_build_object(
            'slot_buffer_mins', v_settings.slot_buffer_mins,
            'hospital_name', v_settings.hospital_name
        )
    );

    RETURN to_jsonb(v_settings);
END;
$$;

REVOKE ALL ON FUNCTION public.get_hospital_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hospital_settings() TO authenticated;
REVOKE ALL ON FUNCTION public.save_hospital_settings_atomic(INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_hospital_settings_atomic(INTEGER, TEXT) TO authenticated;

COMMIT;
