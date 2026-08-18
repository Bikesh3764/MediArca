-- MediArca analytics correctness: India business date and measured consultation duration.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_hospital_operational_analytics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_role VARCHAR;
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
    v_total_appointments INT;
    v_completed_appointments INT;
    v_noshow_appointments INT;
    v_active_queues INT;
    v_total_revenue NUMERIC;
    v_avg_wait NUMERIC;
    v_avg_consult NUMERIC;
BEGIN
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
    SELECT role INTO v_actor_role FROM public.users WHERE id = v_actor_id;
    IF v_actor_role NOT IN ('receptionist', 'admin') AND NOT public.is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Access Denied: Hospital operational analytics restricted to management and administrative staff.';
    END IF;

    SELECT COUNT(*) INTO v_total_appointments FROM public.appointments WHERE scheduled_date = v_today;
    SELECT COUNT(*) INTO v_completed_appointments FROM public.appointments WHERE scheduled_date = v_today AND status = 'completed';
    SELECT COUNT(*) INTO v_noshow_appointments FROM public.appointments WHERE scheduled_date = v_today AND status = 'no-show';
    SELECT COUNT(*) INTO v_active_queues FROM public.clinic_queues WHERE queue_date = v_today AND status = 'in-session';
    SELECT COALESCE(SUM(total_amount), 0.00) INTO v_total_revenue
    FROM public.patient_invoices WHERE (settled_at AT TIME ZONE 'Asia/Kolkata')::date = v_today;
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (start_at - check_in_time)) / 60.0), 0.0) INTO v_avg_wait
    FROM public.appointments WHERE scheduled_date = v_today AND check_in_time IS NOT NULL AND start_at IS NOT NULL;
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (end_at - start_at)) / 60.0), 0.0) INTO v_avg_consult
    FROM public.appointments WHERE scheduled_date = v_today AND status = 'completed' AND start_at IS NOT NULL AND end_at IS NOT NULL;

    RETURN jsonb_build_object(
        'date', v_today,
        'totalAppointmentsToday', v_total_appointments,
        'completedConsultations', v_completed_appointments,
        'noShowCount', v_noshow_appointments,
        'activeQueues', v_active_queues,
        'averageWaitTimeMins', ROUND(v_avg_wait, 1),
        'averageConsultDurationMins', ROUND(v_avg_consult, 1),
        'todayRevenue', v_total_revenue,
        'timestamp', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_hospital_operational_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hospital_operational_analytics() TO authenticated;

COMMIT;
