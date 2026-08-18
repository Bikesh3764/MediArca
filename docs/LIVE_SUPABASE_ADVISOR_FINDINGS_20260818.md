# Live Supabase Advisor Findings — 2026-08-18

Project: `pkvwnsigucncdwrjtggs` (MediArca production)

## Security advisor

The live security advisor reports `authenticated_security_definer_function_executable` warnings for the application’s authenticated RPCs, including queue advancement, QR check-in, prescription completion, invoice settlement, analytics, hospital settings, OPD booking, reception walk-ins, appointment status changes, queue pause, future scheduling, queue transfer, and patient-profile updates. These functions are intentionally exposed to the `authenticated` role because the SPA invokes them; each is `SECURITY DEFINER` and contains server-side authentication, role, ownership, and/or verified-doctor checks. Revoking `authenticated` execution would break the production workflows, and switching them to `SECURITY INVOKER` would conflict with their RLS-bypassing transactional design. These are therefore intentional linter warnings that require ongoing review rather than an unresolved authorization bypass.

The advisor also reports that Supabase Auth leaked-password protection is disabled. This is an account-level Auth configuration item and was not changed through the available database migration interface; it should be enabled in the Supabase Auth dashboard before public release if the project owner approves the account-policy change.

## Performance advisor

The performance advisor reports one `auth_rls_initplan` warning for the existing `hospital_departments` policy and multiple permissive-policy warnings across legacy facility tables, clinical documents, doctors, and the new `system_settings` table. The new `system_settings` read/write policies overlap for authenticated admins because the write policy is defined `FOR ALL`; the functional access remains admin-only, but the overlap can be consolidated in a future maintenance migration. It also reports unused indexes. These are optimization notices, not correctness or data-exposure findings; the authoritative MediArca clinical RLS policies and new settings RPC remain server-validated.

## Sources

The findings were obtained from the Supabase project advisor endpoints for the production project on 2026-08-18. Supabase advisor remediation documentation is linked in each returned finding, including [authenticated SECURITY DEFINER function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [Auth leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), and [RLS init-plan guidance](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan).
