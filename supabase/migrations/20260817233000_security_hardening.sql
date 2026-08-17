-- MediArca security hardening migration
-- Existing-feature security fixes only. No new product functionality.
-- Apply to the same Supabase project as the application.

begin;

-- Public users/appointments must never be directly readable.
drop policy if exists "Allow public read users" on public.users;
drop policy if exists "Allow public read appointments" on public.appointments;

-- Keep patient/role reads authenticated and ownership/role controlled.
create policy "Users can read own profile or authorized staff"
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin(auth.uid())
  or public.is_receptionist(auth.uid())
  or public.is_verified_doctor(auth.uid())
);

create policy "Users can update own profile"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Appointment data is clinical data: no public access.
drop policy if exists "Allow authenticated read appointments" on public.appointments;
create policy "Authorized users can read appointments"
on public.appointments
for select
to authenticated
using (
  patient_id = auth.uid()
  or public.is_admin(auth.uid())
  or public.is_receptionist(auth.uid())
  or exists (
    select 1 from public.doctors d
    where d.id = appointments.doctor_id
      and d.user_id = auth.uid()
      and d.verification_status = 'verified'
  )
);

-- Remove anonymous execution from clinical/booking RPCs.
revoke execute on function public.issue_next_opd_token(uuid,text,text,text,integer,text,text) from anon;
revoke execute on function public.issue_next_opd_token(uuid,text,text,text,integer,text,text,uuid) from anon;
revoke execute on function public.schedule_future_appointment_atomic(uuid,date,text,text,text,text,integer,text,text) from anon;
revoke execute on function public.schedule_future_appointment_atomic(uuid,date,text,text,text,text,integer,text,text,uuid) from anon;
revoke execute on function public.check_in_patient_qr_atomic(text) from anon;
revoke execute on function public.generate_and_settle_invoice_atomic(uuid,text,text,numeric,text) from anon;

-- Sensitive RPCs must be invoked only by authenticated callers.
grant execute on function public.check_in_patient_qr_atomic(text) to authenticated;
grant execute on function public.generate_and_settle_invoice_atomic(uuid,text,text,numeric,text) to authenticated;

-- QR check-in: token alone is not an authorization boundary.
create or replace function public.check_in_patient_qr_atomic(p_checkin_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select * into v_appt
  from public.appointments
  where checkin_token = p_checkin_token
  for update;

  if not found then
    raise exception 'Invalid check-in token';
  end if;

  if v_appt.checkin_token_used_at is not null then
    raise exception 'Check-in token already used';
  end if;

  if not (
    v_appt.patient_id = v_user
    or public.is_admin(v_user)
    or public.is_receptionist(v_user)
    or exists (
      select 1 from public.doctors d
      where d.id = v_appt.doctor_id
        and d.user_id = v_user
        and d.verification_status = 'verified'
    )
  ) then
    raise exception 'Not authorized to check in this appointment';
  end if;

  update public.appointments
  set status = 'checked_in',
      check_in_time = coalesce(check_in_time, now()),
      checkin_token_used_at = now(),
      updated_at = now()
  where id = v_appt.id
    and checkin_token_used_at is null;

  if not found then
    raise exception 'Check-in token already used';
  end if;

  return jsonb_build_object('success', true, 'appointment_id', v_appt.id);
end;
$$;

-- Prevent public callers from manufacturing privileged roles through profile metadata.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_email text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_email := lower(trim(new.email));

  insert into public.users (id, email, full_name, role, phone)
  values (new.id, v_email, v_name, 'patient', null)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Auth-trigger function itself is not an application API.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
grant execute on function public.handle_new_auth_user() to supabase_auth_admin;

commit;
