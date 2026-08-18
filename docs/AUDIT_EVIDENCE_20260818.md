# MediArca Audit Evidence — 18 August 2026

This file records externally verified facts used during the repository and backend audit.

| Evidence | Verified result | Source |
|---|---|---|
| Public MediArca product surface | The public home page identifies MediArca as a healthcare platform with patient, doctor, clinic, and receptionist portals. | [https://mediarca.in/](https://mediarca.in/) |
| Supabase project | Project `pkvwnsigucncdwrjtggs` (`Bikesh3764's Project`) is active and healthy in `ap-southeast-1`; its database host is `db.pkvwnsigucncdwrjtggs.supabase.co`. | Supabase project metadata for the connected project |
| Clinical document RLS issue | The original live policy allowed physician document reads through a same-day appointment predicate without requiring an active status. The hardening migration now requires a verified doctor and a same-day `waiting` or `in-consultation` episode. | Supabase `pg_policies` inspection; migration in [`SUPABASE_HARDENING_MIGRATION_20260818.sql`](SUPABASE_HARDENING_MIGRATION_20260818.sql) |
| Anonymous RPC exposure | The live privilege matrix now reports `anon_execute = false` and `authenticated_execute = true` for the 11 audited application RPCs. | Supabase `pg_proc` privilege verification |
| Supabase security advisor references | The relevant linter remediation links are [security-definer view](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [anonymous SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). |

The remaining authenticated SECURITY DEFINER advisor notices are intentional for the server-authoritative RPCs: the application requires signed-in callers, and each RPC performs its own role, ownership, accreditation, and state validation. Supabase Auth leaked-password protection is a dashboard-level setting and is not changed by the SQL migration.
